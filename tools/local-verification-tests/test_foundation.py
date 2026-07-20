import contextlib
import io
import json
import os
import subprocess
import tempfile
import socket
import sys
import unittest
from pathlib import Path
from unittest import mock

from tools.local_verification.cli import main, parser
from tools.local_verification.git import inspect_repository, verify_allowed_paths, worktree_fingerprint
from tools.local_verification.paths import normalize_path, repository_relative
from tools.local_verification.plan import build_plan, compute_plan_hash, tokens_for_profile, validate_plan
from tools.local_verification.profiles import load_profile
from tools.local_verification.runner import execute_plan


def sample_plan(**changes):
    command = changes.get("command_argv", ["npm", "test", "--", "one two"])
    values = dict(
        repository_root=".", worktree=".", worktree_fingerprint="0" * 64,
        expected_branch="feature/a",
        expected_sha="abc123", node_version="v22", npm_version="10",
        command_argv=command, environment={"CI": "1"},
        working_directory=".", timeout_seconds=60,
        resource_tokens=tokens_for_profile(load_profile("laptop-safe"), command), port=5201,
        allowed_changed_paths=["evidence/tmp", "tools/local_verification"],
        expected_output_counts={"passed": 2},
        cleanup_policy={"git": "dry-run-only", "retry_count": 0},
    )
    values.update(changes)
    if "command_argv" in changes and "resource_tokens" not in changes:
        values["resource_tokens"] = tokens_for_profile(load_profile("laptop-safe"), changes["command_argv"])
    return build_plan(**values)


class ProfileTests(unittest.TestCase):
    def test_explicit_profile_values(self):
        desktop = load_profile("desktop-heavy")
        self.assertEqual((4, 4, 2, 1), (desktop["max_concurrent_worktrees"], desktop["vitest_workers_per_worktree"], desktop["playwright_workers_per_focused_run"], desktop["full_matrix_global_concurrency"]))
        self.assertEqual({"start": 5201, "end": 5299}, desktop["port_range"])
        laptop = load_profile("laptop-safe")
        self.assertEqual((1, 1, 1), (laptop["max_concurrent_worktrees"], laptop["vitest_workers_per_worktree"], laptop["playwright_workers_per_focused_run"]))


class PlanAndPathTests(unittest.TestCase):
    def test_hash_is_deterministic_and_excludes_identity_runtime(self):
        first = sample_plan(environment={"B": "2", "A": "1"})
        second = sample_plan(environment={"A": "1", "B": "2"})
        self.assertEqual(first["canonical_plan_hash"], second["canonical_plan_hash"])
        second["runtime"] = {"pid": os.getpid(), "absolute_path": "C:/machine"}
        second["canonical_plan_hash"] = "ignored"
        self.assertEqual(first["canonical_plan_hash"], compute_plan_hash(second))

    def test_windows_and_posix_normalization(self):
        self.assertEqual("c:/repo/tools/x", normalize_path(r"C:\repo\.\tools\x"))
        self.assertEqual("tools/x", repository_relative(r"C:\repo\tools\x", r"C:\repo"))
        self.assertEqual("tools/x", repository_relative("/repo/tools/./x", "/repo"))
        with self.assertRaises(ValueError):
            repository_relative("/other/x", "/repo")

    def test_canonical_plan_rejects_absolute_paths_and_empty_identity(self):
        for changes in (
            {"repository_root": r"C:\\repo"},
            {"worktree": "/repo"},
            {"working_directory": r"C:\\repo\\app"},
            {"command_argv": [r"C:\\Python\\python.exe", "-V"]},
            {"command_argv": ["python", "-c", r"open('C:\\machine\\file')"]},
            {"expected_branch": ""},
            {"expected_sha": ""},
        ):
            with self.subTest(changes), self.assertRaises(ValueError):
                sample_plan(**changes)
        tampered = sample_plan()
        tampered["machine_data"] = {"path": r"C:\\machine"}
        with self.assertRaisesRegex(ValueError, "unexpected plan fields"):
            validate_plan(tampered)


class GitTests(unittest.TestCase):
    def test_worktree_fingerprint_fails_closed_for_zero_filesystem_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            unavailable = mock.Mock(st_dev=0, st_ino=1)
            with mock.patch("tools.local_verification.git.os.stat", return_value=unavailable):
                with self.assertRaises(ValueError) as raised:
                    worktree_fingerprint(directory)
            self.assertIn("identity is unavailable", str(raised.exception))
            self.assertNotIn(directory, str(raised.exception))

    def test_observes_branch_sha_and_dirty_paths(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as state_directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            Path(directory, "tracked.txt").write_text("one", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "tracked.txt"], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            Path(directory, "tracked.txt").write_text("two", encoding="utf-8")
            Path(directory, "allowed").mkdir()
            Path(directory, "allowed", "new.txt").write_text("new", encoding="utf-8")
            state = inspect_repository(directory)
            self.assertEqual("test-branch", state["branch"])
            self.assertEqual(40, len(state["sha"]))
            self.assertEqual(["allowed/new.txt", "tracked.txt"], state["dirty_paths"])
            self.assertEqual(["tracked.txt"], verify_allowed_paths(state["dirty_paths"], ["allowed"]))

    def test_rename_reports_destination_and_source_and_forbidden_destination_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            source = Path(directory, "allowed", "original.txt")
            source.parent.mkdir()
            source.write_text("tracked", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            Path(directory, "forbidden").mkdir()
            subprocess.run(
                ["git", "-C", directory, "mv", "allowed/original.txt", "forbidden/renamed.txt"],
                check=True,
            )
            state = inspect_repository(directory)
            self.assertEqual(
                ["allowed/original.txt", "forbidden/renamed.txt"], state["dirty_paths"]
            )
            self.assertEqual(
                ["forbidden/renamed.txt"], verify_allowed_paths(state["dirty_paths"], ["allowed"])
            )
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                exit_code = main([
                    "verify-git", "--repository", directory,
                    "--branch", state["branch"], "--sha", state["sha"],
                    "--allow-path", "allowed",
                ])
            self.assertEqual(1, exit_code)
            self.assertEqual(["forbidden/renamed.txt"], json.loads(output.getvalue())["unexpected_dirty_paths"])

    def test_copy_reports_destination_and_source_and_forbidden_destination_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", directory, "config", "status.renames", "copies"], check=True)
            source = Path(directory, "allowed", "original.txt")
            source.parent.mkdir()
            source.write_text("distinct copy source\n" * 100, encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            destination = Path(directory, "forbidden", "copied.txt")
            destination.parent.mkdir()
            destination.write_bytes(source.read_bytes())
            source.write_text(source.read_text(encoding="utf-8") + "changed\n", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)

            state = inspect_repository(directory)
            self.assertEqual(
                ["allowed/original.txt", "forbidden/copied.txt"], state["dirty_paths"]
            )
            self.assertEqual(
                ["forbidden/copied.txt"], verify_allowed_paths(state["dirty_paths"], ["allowed"])
            )

    def test_rename_from_forbidden_source_into_allowed_destination_still_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            source = Path(directory, "forbidden", "original.txt")
            source.parent.mkdir()
            source.write_text("tracked", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            Path(directory, "allowed").mkdir()
            subprocess.run(["git", "-C", directory, "mv", "forbidden/original.txt", "allowed/renamed.txt"], check=True)

            state = inspect_repository(directory)
            self.assertEqual(["allowed/renamed.txt", "forbidden/original.txt"], state["dirty_paths"])
            self.assertEqual(["forbidden/original.txt"], verify_allowed_paths(state["dirty_paths"], ["allowed"]))

    def test_copy_from_forbidden_source_into_allowed_destination_still_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", directory, "config", "status.renames", "copies"], check=True)
            source = Path(directory, "forbidden", "original.txt")
            source.parent.mkdir()
            source.write_text("distinct reverse copy source\n" * 100, encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            destination = Path(directory, "allowed", "copied.txt")
            destination.parent.mkdir()
            destination.write_bytes(source.read_bytes())
            source.write_text(source.read_text(encoding="utf-8") + "changed\n", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)

            state = inspect_repository(directory)
            self.assertEqual(["allowed/copied.txt", "forbidden/original.txt"], state["dirty_paths"])
            self.assertEqual(["forbidden/original.txt"], verify_allowed_paths(state["dirty_paths"], ["allowed"]))


class CliTests(unittest.TestCase):
    def test_all_commands_parse(self):
        for command in ("status", "plan", "verify-git", "summarize", "run"):
            self.assertIn(command, parser().format_help())

    def test_plan_cli_smoke(self):
        output = io.StringIO()
        state = inspect_repository(".")
        argv = ["plan", "--profile", "laptop-safe", "--branch", state["branch"], "--sha", state["sha"], "--node-version", "v22", "--npm-version", "10", "--timeout", "30", "--allow-path", "tools/local_verification", "--expected-count", "passed=1", "npm", "test"]
        with contextlib.redirect_stdout(output):
            self.assertEqual(0, main(argv))
        plan = json.loads(output.getvalue())
        self.assertEqual(["npm", "test", "--", "--maxWorkers=1"], plan["command_argv"])
        self.assertEqual("laptop-safe", plan["resource_tokens"]["profile"])
        self.assertEqual(1, plan["resource_tokens"]["vitest_workers_per_worktree"])
        self.assertEqual(compute_plan_hash(plan), plan["canonical_plan_hash"])
        self.assertEqual((".", ".", "."), (plan["repository_root"], plan["worktree"], plan["working_directory"]))

    def test_plan_rejects_detached_head_and_emits_no_machine_path(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            Path(directory, "tracked.txt").write_text("clean", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "."], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            state = inspect_repository(directory)
            base = [
                "plan", "--profile", "laptop-safe", "--repository", directory,
                "--worktree", directory, "--branch", state["branch"], "--sha", state["sha"],
                "--node-version", "v22", "--npm-version", "10", "--timeout", "5",
                "python", "-c", "pass",
            ]
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, main(base))
            encoded = output.getvalue()
            self.assertNotIn(normalize_path(directory), normalize_path(encoded))
            subprocess.run(["git", "-C", directory, "checkout", "--detach"], check=True, capture_output=True)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(2, main(base))
            self.assertEqual({"ok": False, "error": "operation failed"}, json.loads(output.getvalue()))

class RunTests(unittest.TestCase):
    def test_success_timeout_port_conflict_and_retry_policy(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as state_directory:
            subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
            subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
            Path(directory, "tracked.txt").write_text("clean", encoding="utf-8")
            subprocess.run(["git", "-C", directory, "add", "tracked.txt"], check=True)
            subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
            repository = inspect_repository(directory)
            old=os.environ.get("LOCAL_VERIFICATION_STATE_DIR"); os.environ["LOCAL_VERIFICATION_STATE_DIR"]=state_directory
            try:
                base=dict(
                    expected_branch=repository["branch"], expected_sha=repository["sha"],
                    worktree_fingerprint=worktree_fingerprint(directory), port=None,
                )
                output=io.StringIO()
                with contextlib.redirect_stdout(output): result=execute_plan(sample_plan(**base,command_argv=["python","-c","print('child-ok')"]), invocation_directory=directory)
                self.assertEqual(0,result["exit_code"]); self.assertIn("child-ok",output.getvalue()); self.assertIn("child-ok",Path(result["runtime_log"]).read_text(encoding="utf-8"))
                timeout=execute_plan(sample_plan(**base,timeout_seconds=.1,command_argv=["python","-c","import time; time.sleep(10)"]), invocation_directory=directory)
                self.assertTrue(timeout["timed_out"]); self.assertIsNotNone(timeout["attempts"][0]["termination"])
                no_retry=execute_plan(sample_plan(**base,command_argv=["python","-c","raise SystemExit(3)"],cleanup_policy={"git":"dry-run-only","retry_count":1}), invocation_directory=directory)
                self.assertEqual(1,no_retry["attempt_count"])
                retry=execute_plan(sample_plan(**base,command_argv=["python","-c","raise SystemExit(3)"],cleanup_policy={"git":"dry-run-only","retry_count":1,"diagnostic_retry":True}), invocation_directory=directory)
                self.assertEqual(2,retry["attempt_count"])
                with socket.socket() as occupied:
                    for port in range(5201, 5300):
                        try:
                            occupied.bind(("127.0.0.1",port)); break
                        except OSError: continue
                    else: self.fail("no free profile port available for conflict test")
                    conflict_base={**base,"port":port}
                    with self.assertRaisesRegex(RuntimeError,"port conflict before"): execute_plan(sample_plan(**conflict_base,command_argv=["python","-c","print('must-not-run')"]), invocation_directory=directory)
                self.assertFalse(any((Path(state_directory)/"reservations").iterdir()))
            finally:
                if old is None: os.environ.pop("LOCAL_VERIFICATION_STATE_DIR",None)
                else: os.environ["LOCAL_VERIFICATION_STATE_DIR"]=old


if __name__ == "__main__":
    unittest.main()
