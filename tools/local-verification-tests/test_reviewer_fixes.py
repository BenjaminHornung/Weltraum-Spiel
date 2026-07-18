import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from tools.local_verification.cli import main
from tools.local_verification.environment import resolve_environment, validate_command_argv
from tools.local_verification.git import inspect_repository, worktree_fingerprint
from tools.local_verification.plan import build_plan, tokens_for_profile
from tools.local_verification.process_control import (
    PosixProcessGroup,
    WindowsJob,
    get_process_identity,
    process_is_alive,
    process_identity_matches,
    resume_process,
)
from tools.local_verification.profiles import load_profile
from tools.local_verification.reservations import ReservationConflict, Reservations
from tools.local_verification.runner import execute_plan
from tools.local_verification.status import status_details
from tools.local_verification.summary import build_summary, build_summary_from_run_record


VITEST_OUTPUT = " Tests  2 passed (2)\n"


def make_repository(directory):
    subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
    subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
    subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
    Path(directory, "tracked.txt").write_text("clean", encoding="utf-8")
    subprocess.run(["git", "-C", directory, "add", "tracked.txt"], check=True)
    subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
    return inspect_repository(directory)


def plan_for(repository, command, profile_name="laptop-safe", **changes):
    state = inspect_repository(repository)
    profile = load_profile(profile_name)
    values = {
        "repository_root": ".",
        "worktree": ".",
        "worktree_fingerprint": worktree_fingerprint(repository),
        "expected_branch": state["branch"],
        "expected_sha": state["sha"],
        "node_version": "v22",
        "npm_version": "10",
        "command_argv": command,
        "environment": {},
        "working_directory": ".",
        "timeout_seconds": 5,
        "resource_tokens": tokens_for_profile(profile, command),
        "port": None,
        "allowed_changed_paths": [],
        "expected_output_counts": {},
        "cleanup_policy": {"git": "dry-run-only", "retry_count": 0},
    }
    values.update(changes)
    return build_plan(**values)


def descendant_tree_command(child_pid_path, grandchild_pid_path, parent_sleep=False):
    grandchild_code = (
        "import os,sys,time,pathlib;"
        "pathlib.Path(sys.argv[1]).write_text(str(os.getpid()),encoding='utf-8');"
        "time.sleep(30)"
    )
    child_code = (
        "import os,sys,time,pathlib,subprocess;"
        "pathlib.Path(sys.argv[1]).write_text(str(os.getpid()),encoding='utf-8');"
        f"subprocess.Popen([sys.executable,'-c',{grandchild_code!r},sys.argv[2]]);"
        "time.sleep(30)"
    )
    parent_code = (
        "import sys,time,pathlib,subprocess;"
        f"subprocess.Popen([sys.executable,'-c',{child_code!r},sys.argv[1],sys.argv[2]]);"
        "deadline=time.time()+4;"
        "\nwhile not pathlib.Path(sys.argv[2]).exists() and time.time()<deadline: time.sleep(.02)"
    )
    if parent_sleep:
        parent_code += "\ntime.sleep(30)"
    return ["python", "-c", parent_code, str(child_pid_path), str(grandchild_pid_path)]


class EnvironmentAndProfileTests(unittest.TestCase):
    def test_canonical_environment_references_hide_host_values(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            command = ["python", "-c", "print('ok')"]
            with self.assertRaisesRegex(ValueError, "secret environment key"):
                plan_for(repository, command, environment={"API_TOKEN": "secret-value"})
            with self.assertRaisesRegex(ValueError, "absolute environment value"):
                plan_for(repository, command, environment={"CACHE_DIR": r"C:\\host\\cache"})
            plan = plan_for(
                repository,
                command,
                environment={"API_TOKEN": {"source": "host-env", "key": "TEST_API_TOKEN"}},
            )
            encoded = json.dumps(plan)
            self.assertNotIn("secret-one", encoded)
            self.assertEqual(
                {"API_TOKEN": "secret-one"},
                resolve_environment(plan["environment"], {"TEST_API_TOKEN": "secret-one"}),
            )
            self.assertEqual(
                {"API_TOKEN": "secret-two"},
                resolve_environment(plan["environment"], {"TEST_API_TOKEN": "secret-two"}),
            )

    def test_cli_rejects_direct_secret_env_and_accepts_host_reference(self):
        with tempfile.TemporaryDirectory() as repository:
            state = make_repository(repository)
            base = [
                "plan", "--profile", "laptop-safe", "--repository", repository,
                "--worktree", repository, "--branch", state["branch"], "--sha", state["sha"],
                "--node-version", "v22", "--npm-version", "10", "--timeout", "5",
            ]
            rejected_output = io.StringIO()
            with contextlib.redirect_stdout(rejected_output):
                self.assertEqual(2, main([*base, "--env", "API_TOKEN=secret", "python", "-c", "pass"]))
            self.assertNotIn("secret", rejected_output.getvalue())
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, main([*base, "--host-env", "API_TOKEN=SOURCE_TOKEN", "python", "-c", "pass"]))
            self.assertEqual(
                {"source": "host-env", "key": "SOURCE_TOKEN"},
                json.loads(output.getvalue())["environment"]["API_TOKEN"],
            )

    def test_inline_argv_and_innocuous_env_secret_material_is_rejected_without_echo(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            rejected = (
                (["tool", "--token", "separate-secret-value"], {}),
                (["tool", "--password=equals-secret-value"], {}),
                (["tool", "--auth", "auth-secret-value"], {}),
                (["tool", "--bearer=bearer-secret-value"], {}),
                (["tool", "https://user:url-secret-value@example.invalid/path"], {}),
                (["tool", "https://example.invalid/path?api_key=query-secret-value"], {}),
                (["tool"], {"SERVICE_URL": "https://example.invalid/path?signature=env-secret-value"}),
            )
            for command, environment in rejected:
                secret = next(
                    marker for marker in (
                        "separate-secret-value", "equals-secret-value", "auth-secret-value",
                        "bearer-secret-value", "url-secret-value", "query-secret-value",
                        "env-secret-value",
                    )
                    if marker in json.dumps([command, environment])
                )
                with self.subTest(command=command, environment=environment):
                    with self.assertRaises(ValueError) as raised:
                        plan_for(repository, command, environment=environment)
                    self.assertNotIn(secret, str(raised.exception))

            allowed = plan_for(
                repository,
                ["tool"],
                environment={"SERVICE_URL": {"source": "host-env", "key": "SERVICE_SECRET_URL"}},
            )
            self.assertEqual(
                {"source": "host-env", "key": "SERVICE_SECRET_URL"},
                allowed["environment"]["SERVICE_URL"],
            )

    def test_reviewed_secret_forms_are_rejected_without_echo(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            cases = (
                ["tool", "--token", "separate-review-marker"],
                ["tool", "--client-secret=equal-review-marker"],
                ["tool", "-H", "Authorization: Basic basic-review-marker"],
                ["tool", "--header=Authorization: Bearer bearer-review-marker"],
                ["tool", "Authorization%3A%20Bearer%20encoded-header-review-marker"],
                ["tool", "X-API-Key: api-header-review-marker"],
                ["tool", "ghp_abcdefghijklmnopqrstuvwxyz0123456789AB"],
                ["tool", "github_pat_11AA_reviewmarker_abcdefghijklmnopqrstuvwxyz"],
                ["tool", "npm_abcdefghijklmnopqrstuvwxyz0123456789"],
                ["tool", "https://bare-userinfo-review-marker@example.invalid/path"],
                ["tool", "https://user:userpass-review-marker@example.invalid/path"],
                ["tool", "https://user%3Aencoded-userinfo-review-marker%40example.invalid/path"],
                ["tool", "https://example.invalid/path?access%5Ftoken=query-token-review-marker"],
                ["tool", "https://example.invalid/path?client%5Fsecret=query-secret-review-marker"],
                ["tool", "https://example.invalid/path?X-Amz-Signature=query-signature-review-marker"],
                ["tool", "https://example.invalid/path?sig=query-sig-review-marker"],
            )
            for command in cases:
                marker = command[-1]
                with self.subTest(command=command):
                    with self.assertRaises(ValueError) as raised:
                        plan_for(repository, command)
                    self.assertNotIn(marker, str(raised.exception))
                    self.assertNotIn("review-marker", str(raised.exception))
                    self.assertNotIn("reviewmarker", str(raised.exception))

            literal_materials = (
                "--token literal-option-review-marker",
                "--client-secret=literal-equal-review-marker",
                "Authorization: Basic literal-basic-review-marker",
                "Authorization%3A%20Bearer%20literal-encoded-review-marker",
                "X-API-Key: literal-api-key-review-marker",
                "ghp_abcdefghijklmnopqrstuvwxyz0123456789AB",
                "https://literal-userinfo-review-marker@example.invalid/path",
                "https://example.invalid/path?access%5Ftoken=literal-query-review-marker",
            )
            for material in literal_materials:
                with self.subTest(literal_environment=material):
                    with self.assertRaises(ValueError) as raised:
                        plan_for(repository, ["tool"], environment={"DISPLAY_VALUE": material})
                    self.assertNotIn(material, str(raised.exception))
                    self.assertNotIn("review-marker", str(raised.exception))

            safe = plan_for(
                repository,
                ["tool", "https://example.invalid/path?timeout=30&design=stable", "--signal-mode=normal"],
            )
            self.assertIn("design=stable", safe["command_argv"][1])

    def test_split_auth_headers_are_rejected_without_echo_and_safe_argv_is_accepted(self):
        marker = "split-header-review-marker"
        cases = (
            ["-H", "Authorization:", "Bearer", marker],
            ["-H", "Authorization:", "Basic", marker],
            ["Authorization:", "Bearer", marker],
            ["-H", "X-API-Key:", marker],
            ["--header", "Authorization:", "Bearer", marker],
        )
        for argv in cases:
            with self.subTest(argv=argv):
                with self.assertRaises(ValueError) as raised:
                    validate_command_argv(argv)
                self.assertNotIn(marker, str(raised.exception))
        validate_command_argv(["python", "-m", "unittest", "discover", "-v"])

    def test_malformed_environment_cli_input_never_echoes_raw_entry(self):
        with tempfile.TemporaryDirectory() as repository:
            state = make_repository(repository)
            marker = "malformed-env-review-marker"
            for arguments in (
                ["--env", marker],
                ["--host-env", f"BAD KEY={marker}"],
                ["--expected-count", f"passed={marker}"],
            ):
                with self.subTest(arguments=arguments):
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        self.assertEqual(2, main([
                            "plan", "--profile", "laptop-safe", "--repository", repository,
                            "--worktree", repository, "--branch", state["branch"], "--sha", state["sha"],
                            "--node-version", "v22", "--npm-version", "10", "--timeout", "5",
                            *arguments, "python", "-c", "pass",
                        ]))
                    self.assertNotIn(marker, output.getvalue())

    def test_argparse_failures_are_generic_for_every_command_and_help_still_works(self):
        marker = "ARGPARSE_SECRET_MARKER_987654"
        cases = (
            ["status", f"--{marker}"],
            ["plan", "--profile", marker],
            ["verify-git", f"--{marker}"],
            ["summarize", f"--{marker}"],
            ["run", f"--{marker}"],
        )
        expected = json.dumps(
            {"ok": False, "error": "operation failed"}, sort_keys=True, indent=2
        ) + "\n"
        repository_path = str(Path(__file__).resolve().parents[2])
        for argv in cases:
            with self.subTest(argv=argv):
                stdout = io.StringIO()
                stderr = io.StringIO()
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    self.assertEqual(2, main(argv))
                self.assertEqual(expected, stdout.getvalue())
                self.assertEqual("", stderr.getvalue())
                disclosure = stdout.getvalue() + stderr.getvalue()
                for forbidden in (
                    marker, "Traceback", "usage:", repr(argv), repository_path
                ):
                    self.assertNotIn(forbidden, disclosure)

        environment = os.environ.copy()
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        completed = subprocess.run(
            [sys.executable, "-m", "tools.local_verification", "--help"],
            cwd=repository_path,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(0, completed.returncode, completed.stderr)
        self.assertEqual("", completed.stderr)
        for command in ("status", "plan", "verify-git", "summarize", "run"):
            self.assertIn(command, completed.stdout)

    def test_cli_identity_failure_is_sanitized_and_keyboard_interrupt_returns_130(self):
        with tempfile.TemporaryDirectory() as repository:
            state = make_repository(repository)
            marker = "synthetic-path-review-marker"
            argv = [
                "plan", "--profile", "laptop-safe", "--repository", repository,
                "--worktree", repository, "--branch", state["branch"], "--sha", state["sha"],
                "--node-version", "v22", "--npm-version", "10", "--timeout", "5",
                "python", "-c", "pass",
            ]
            output = io.StringIO()
            with mock.patch(
                "tools.local_verification.git.os.stat",
                side_effect=OSError(marker),
            ), contextlib.redirect_stdout(output):
                self.assertEqual(2, main(argv))
            disclosure = output.getvalue()
            self.assertNotIn("Traceback", disclosure)
            self.assertNotIn(marker, disclosure)
            self.assertNotIn(repository, disclosure)
            self.assertNotIn("git.py", disclosure)

        output = io.StringIO()
        with mock.patch("tools.local_verification.cli._dispatch", side_effect=KeyboardInterrupt), contextlib.redirect_stdout(output):
            self.assertEqual(130, main(["status"]))
        self.assertNotIn("Traceback", output.getvalue())

    def test_profile_port_worker_and_global_matrix_values_are_enforced(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            focused = ["npm", "run", "test:e2e:core"]
            focused_plan = plan_for(repository, focused, profile_name="desktop-heavy")
            self.assertEqual("playwright", focused_plan["resource_tokens"]["framework"])
            self.assertFalse(focused_plan["resource_tokens"]["full_matrix"])
            self.assertEqual(2, focused_plan["resource_tokens"]["playwright_workers_per_focused_run"])
            self.assertEqual("--workers=2", focused_plan["command_argv"][-1])
            full = ["npm", "run", "test:e2e"]
            full_plan = plan_for(repository, full, profile_name="desktop-heavy")
            self.assertTrue(full_plan["resource_tokens"]["full_matrix"])
            self.assertEqual(1, full_plan["resource_tokens"]["full_matrix_global_concurrency"])
            with self.assertRaisesRegex(ValueError, "port must be within profile range"):
                plan_for(repository, focused, profile_name="desktop-heavy", port=5300)
            invalid = dict(focused_plan["resource_tokens"])
            invalid["playwright_workers_per_focused_run"] = 3
            with self.assertRaisesRegex(ValueError, "resource_tokens"):
                plan_for(repository, focused, profile_name="desktop-heavy", resource_tokens=invalid)
            with self.assertRaisesRegex(ValueError, "--workers"):
                plan_for(repository, [*focused, "--", "--workers=3"], profile_name="desktop-heavy")


class SchedulingAndStateTests(unittest.TestCase):
    def test_independent_worktrees_share_capacity_without_worker_index_collision(self):
        with tempfile.TemporaryDirectory() as state:
            first = Reservations(state, "first")
            second = Reservations(state, "second")
            first.claim("worktree:a")
            first.claim_slot("worktrees", 4)
            second.claim("worktree:b")
            second.claim_slot("worktrees", 4)
            first.claim_slot("full-matrix", 1)
            with self.assertRaises(ReservationConflict):
                second.claim_slot("full-matrix", 1)
            first.release_all()
            second.claim_slot("full-matrix", 1)
            second.release_all()

    def test_stale_state_is_reported_with_dry_run_cleanup_and_not_deleted(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            make_repository(repository)
            running = Path(state, "running")
            running.mkdir()
            live_path = running / "live.json"
            stale_path = running / "stale.json"
            identity = get_process_identity(os.getpid())
            self.assertIsNotNone(identity)
            live_path.write_text(json.dumps({"run_id": "live", "owner_pid": os.getpid(), "process_identity": identity}), encoding="utf-8")
            stale_path.write_text(json.dumps({"run_id": "dead", "owner_pid": 2147483647}), encoding="utf-8")
            reservation = Path(state, "reservations", "stale-reservation")
            reservation.mkdir(parents=True)
            owner_path = reservation / "owner.json"
            owner_path.write_text(
                json.dumps({"run_id": "dead", "owner_pid": 2147483647, "process_identity": "unrelated", "resource": "port:5201"}),
                encoding="utf-8",
            )
            status = status_details(repository, state)
            self.assertEqual(["live"], [item["run_id"] for item in status["running_owned_runs"]])
            self.assertEqual(2, len(status["stale_state"]))
            self.assertEqual([], status["reserved_ports"])
            self.assertEqual("dry-run-only", status["cleanup_plan"]["mode"])
            self.assertEqual(2, len(status["cleanup_plan"]["actions"]))
            self.assertTrue(stale_path.exists())
            self.assertTrue(owner_path.exists())

    def test_live_reused_pid_without_matching_birth_identity_is_stale(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            make_repository(repository)
            running = Path(state, "running")
            running.mkdir()
            identity = get_process_identity(os.getpid())
            self.assertIsNotNone(identity)
            Path(running, "reused.json").write_text(
                json.dumps({
                    "run_id": "reused",
                    "owner_pid": os.getpid(),
                    "process_identity": identity + "-different-birth",
                }),
                encoding="utf-8",
            )
            Path(running, "legacy.json").write_text(
                json.dumps({"run_id": "legacy", "owner_pid": os.getpid()}),
                encoding="utf-8",
            )
            status = status_details(repository, state)
            self.assertEqual([], status["running_owned_runs"])
            self.assertEqual({"legacy", "reused"}, {item["run_id"] for item in status["stale_state"]})
            self.assertTrue(all(
                item["reason"] == "owner-identity-stale-or-unverified"
                for item in status["stale_state"]
            ))

    def test_exited_owner_with_matching_birth_token_is_stale_and_cleanup_is_dry_run(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            make_repository(repository)
            running = Path(state, "running")
            running.mkdir()
            owner_path = running / "exited.json"
            owner_path.write_text(
                json.dumps({"run_id": "exited", "owner_pid": 4321, "process_identity": "birth-token"}),
                encoding="utf-8",
            )
            with mock.patch(
                "tools.local_verification.process_control.process_is_alive", return_value=False
            ), mock.patch(
                "tools.local_verification.process_control.get_process_identity", return_value="birth-token"
            ):
                self.assertFalse(process_identity_matches(4321, "birth-token"))
                status = status_details(repository, state)
            self.assertEqual([], status["running_owned_runs"])
            self.assertEqual(["exited"], [item["run_id"] for item in status["stale_state"]])
            self.assertEqual("dry-run-only", status["cleanup_plan"]["mode"])
            self.assertTrue(owner_path.exists())


class RetrySummaryAndGitTests(unittest.TestCase):
    def setUp(self):
        self.previous_state = os.environ.get("LOCAL_VERIFICATION_STATE_DIR")
        self.state = tempfile.TemporaryDirectory()
        os.environ["LOCAL_VERIFICATION_STATE_DIR"] = self.state.name

    def tearDown(self):
        self.state.cleanup()
        if self.previous_state is None:
            os.environ.pop("LOCAL_VERIFICATION_STATE_DIR", None)
        else:
            os.environ["LOCAL_VERIFICATION_STATE_DIR"] = self.previous_state

    def test_ctrl_c_never_uses_authorized_diagnostic_retry(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(
                repository,
                ["python", "-c", "pass"],
                cleanup_policy={"git": "dry-run-only", "retry_count": 1, "diagnostic_retry": True},
            )
            interrupted = {
                "attempt": 1,
                "run_id": "run",
                "owned_process": {"kind": "fake", "root_pid": 1},
                "exit_code": 130,
                "duration_seconds": 0.01,
                "timed_out": False,
                "signal": "SIGINT",
                "termination": "terminate-job",
                "_captured_output": "",
            }
            with mock.patch("tools.local_verification.runner._run_attempt", return_value=interrupted) as run_attempt:
                result = execute_plan(plan, invocation_directory=repository)
            self.assertEqual(1, result["attempt_count"])
            run_attempt.assert_called_once()

    def test_summarize_uses_actual_run_record_and_ignores_precomputed_claims(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            command = ["python", "-c", f"print({VITEST_OUTPUT!r})"]
            plan = plan_for(repository, command, expected_output_counts={"passed": 2, "total": 2})
            with contextlib.redirect_stdout(io.StringIO()):
                result = execute_plan(plan, invocation_directory=repository)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(0, main(["summarize", "--run", result["run_path"]]))
            summary = json.loads(output.getvalue())
            self.assertTrue(summary["passed"])
            self.assertEqual({"passed": 2, "total": 2}, summary["counts"])

            record = json.loads(Path(result["run_path"]).read_text(encoding="utf-8"))
            record["result"]["passed"] = True
            record["result"]["attempts"][0]["exit_code"] = 9
            derived = build_summary_from_run_record(record)
            self.assertFalse(derived["passed"])

    def test_git_identity_unavailable_fails_closed(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(repository, ["python", "-c", "pass"])
            result = {"attempts": [{"attempt": 1, "exit_code": 0, "timed_out": False, "signal": None}]}
            summary = build_summary(plan, result, repository_state=None)
            self.assertFalse(summary["passed"])
            self.assertFalse(summary["repository"]["available"])
            self.assertFalse(summary["repository"]["branch_matches"])
            self.assertFalse(summary["repository"]["sha_matches"])

    def test_mismatched_invocation_worktree_fails_before_spawn_and_updates_latest(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            make_repository(first)
            make_repository(second)
            Path(second, "tracked.txt").write_text("different", encoding="utf-8")
            subprocess.run(["git", "-C", second, "commit", "-am", "different"], check=True, capture_output=True)
            plan = plan_for(first, ["python", "-c", "print('must-not-run')"])
            with mock.patch("tools.local_verification.runner._run_attempt") as run_attempt:
                with self.assertRaisesRegex(RuntimeError, "canonical plan binding"):
                    execute_plan(plan, invocation_directory=second)
            run_attempt.assert_not_called()
            summary = json.loads(Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8"))
            self.assertEqual("DependencyMismatch", summary["failure_classification"])
            self.assertFalse(summary["passed"])

    def test_same_sha_separate_clone_fails_exact_worktree_binding_before_spawn(self):
        with tempfile.TemporaryDirectory() as parent:
            first = str(Path(parent, "first"))
            second = str(Path(parent, "second"))
            first_state = make_repository(first)
            subprocess.run(["git", "clone", "--no-hardlinks", first, second], check=True, capture_output=True)
            second_state = inspect_repository(second)
            self.assertEqual(first_state["branch"], second_state["branch"])
            self.assertEqual(first_state["sha"], second_state["sha"])
            plan = plan_for(first, ["python", "-c", "print('must-not-run')"])
            with mock.patch("tools.local_verification.runner._run_attempt") as run_attempt:
                with self.assertRaises(RuntimeError) as raised:
                    execute_plan(plan, invocation_directory=second)
            run_attempt.assert_not_called()
            message = str(raised.exception)
            self.assertIn("canonical plan binding", message)
            self.assertNotIn(first, message)
            self.assertNotIn(second, message)
            summary = json.loads(Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8"))
            self.assertEqual("DependencyMismatch", summary["failure_classification"])
            self.assertFalse(summary["passed"])

    def test_runtime_identity_unavailable_is_normalized_without_cause_disclosure(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(repository, ["python", "-c", "print('must-not-run')"])
            with mock.patch(
                "tools.local_verification.runner.worktree_fingerprint",
                side_effect=ValueError("raw-identity-review-marker"),
            ), mock.patch("tools.local_verification.runner._run_attempt") as run_attempt:
                with self.assertRaises(RuntimeError) as raised:
                    execute_plan(plan, invocation_directory=repository)
            run_attempt.assert_not_called()
            self.assertIn("identity is unavailable", str(raised.exception))
            self.assertNotIn("raw-identity-review-marker", str(raised.exception))
            summary = json.loads(Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8"))
            self.assertEqual("DependencyMismatch", summary["failure_classification"])

    def test_same_path_replacement_invalidates_old_plan_before_spawn_without_identity_leak(self):
        with tempfile.TemporaryDirectory() as parent:
            source = str(Path(parent, "source"))
            target = str(Path(parent, "target"))
            source_state = make_repository(source)
            subprocess.run(["git", "clone", "--no-hardlinks", source, target], check=True, capture_output=True)
            target_state = inspect_repository(target)
            self.assertEqual(source_state["branch"], target_state["branch"])
            self.assertEqual(source_state["sha"], target_state["sha"])
            plan = plan_for(target, ["python", "-c", "print('must-not-run')"])
            old_stat = os.stat(target)

            shutil.rmtree(target)
            subprocess.run(["git", "clone", "--no-hardlinks", source, target], check=True, capture_output=True)
            replacement_state = inspect_repository(target)
            self.assertEqual(target_state["branch"], replacement_state["branch"])
            self.assertEqual(target_state["sha"], replacement_state["sha"])

            with mock.patch(
                "tools.local_verification.runner._run_attempt",
                side_effect=AssertionError("child spawn was reached"),
            ) as run_attempt:
                with self.assertRaises(RuntimeError) as raised:
                    execute_plan(plan, invocation_directory=target)
            run_attempt.assert_not_called()
            disclosure = str(raised.exception)
            self.assertIn("canonical plan binding", disclosure)
            for forbidden in (target, source, str(old_stat.st_dev), str(old_stat.st_ino)):
                self.assertNotIn(forbidden, disclosure)
            summary_text = Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8")
            self.assertEqual("DependencyMismatch", json.loads(summary_text)["failure_classification"])
            for forbidden in (target, source, str(old_stat.st_dev), str(old_stat.st_ino)):
                self.assertNotIn(forbidden, summary_text)

    def test_innocuous_host_reference_value_is_redacted_from_every_output_surface(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            marker = "innocuous-host-ref-review-marker"
            command = [
                "python", "-c",
                "import os,sys; value=os.environ['DISPLAY_VALUE']; print(value); print('https'+'://user:'+value+'@example.invalid'); print('gh'+'p_'+value, file=sys.stderr)",
            ]
            plan = plan_for(
                repository,
                command,
                environment={"DISPLAY_VALUE": {"source": "host-env", "key": "INNOCUOUS_SOURCE"}},
            )
            stdout = io.StringIO()
            stderr = io.StringIO()
            with mock.patch.dict(os.environ, {"INNOCUOUS_SOURCE": marker}), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                result = execute_plan(plan, invocation_directory=repository)
            artifact_paths = (
                result["runtime_log"], result["run_path"], result["summary_path"],
                str(Path(self.state.name, "latest-summary.json")),
            )
            combined = stdout.getvalue() + stderr.getvalue() + json.dumps(result)
            combined += "".join(Path(path).read_text(encoding="utf-8") for path in artifact_paths)
            self.assertNotIn(marker, combined)
            self.assertIn("[REDACTED]", combined)

    def test_short_innocuous_host_reference_fails_closed_without_value_echo(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(
                repository,
                ["python", "-c", "pass"],
                environment={"DISPLAY_VALUE": {"source": "host-env", "key": "INNOCUOUS_SOURCE"}},
            )
            with mock.patch.dict(os.environ, {"INNOCUOUS_SOURCE": "xyz"}):
                with self.assertRaises(ValueError) as raised:
                    execute_plan(plan, invocation_directory=repository)
            self.assertNotIn("xyz", str(raised.exception))

    def test_renamed_outside_allowance_blocks_execution_as_dirty_evidence(self):
        with tempfile.TemporaryDirectory() as repository:
            state = make_repository(repository)
            Path(repository, "allowed").mkdir()
            subprocess.run(["git", "-C", repository, "mv", "tracked.txt", "allowed/tracked.txt"], check=True)
            subprocess.run(["git", "-C", repository, "commit", "-m", "move into allowed"], check=True, capture_output=True)
            state = inspect_repository(repository)
            plan = plan_for(
                repository,
                ["python", "-c", "print('must-not-run')"],
                allowed_changed_paths=["allowed"],
            )
            Path(repository, "forbidden").mkdir()
            subprocess.run(
                ["git", "-C", repository, "mv", "allowed/tracked.txt", "forbidden/tracked.txt"],
                check=True,
            )
            with mock.patch("tools.local_verification.runner._run_attempt") as run_attempt:
                with self.assertRaisesRegex(RuntimeError, "dirty paths"):
                    execute_plan(plan, invocation_directory=repository)
            run_attempt.assert_not_called()
            summary = json.loads(Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8"))
            self.assertEqual("DirtyEvidence", summary["failure_classification"])
            self.assertEqual(["forbidden/tracked.txt"], summary["repository"]["unexpected_dirty_paths"])

    def test_reservation_and_spawn_failures_replace_older_pass_summary(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(repository, ["python", "-c", "pass"])
            latest = Path(self.state.name, "latest-summary.json")
            latest.write_text('{"passed":true,"plan_hash":"older"}', encoding="utf-8")
            held = Reservations(self.state.name, "holder")
            held.claim_slot("worktrees", 1)
            try:
                with self.assertRaises(ReservationConflict):
                    execute_plan(plan, invocation_directory=repository)
            finally:
                held.release_all()
            self.assertEqual(
                "InfrastructureFailure",
                json.loads(latest.read_text(encoding="utf-8"))["failure_classification"],
            )
            with mock.patch(
                "tools.local_verification.runner._run_attempt",
                side_effect=OSError("synthetic spawn failure"),
            ):
                with self.assertRaisesRegex(OSError, "spawn failure"):
                    execute_plan(plan, invocation_directory=repository)
            self.assertEqual(
                "InfrastructureFailure",
                json.loads(latest.read_text(encoding="utf-8"))["failure_classification"],
            )

    def test_invalid_plan_file_replaces_older_pass_summary(self):
        latest = Path(self.state.name, "latest-summary.json")
        latest.write_text('{"passed":true,"plan_hash":"older"}', encoding="utf-8")
        invalid = Path(self.state.name, "invalid-plan.json")
        invalid.write_text("not-json", encoding="utf-8")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(2, main(["run", "--plan", str(invalid)]))
        summary = json.loads(latest.read_text(encoding="utf-8"))
        self.assertFalse(summary["passed"])
        self.assertEqual("InfrastructureFailure", summary["failure_classification"])

    def test_job_setup_resume_terminate_and_close_failures_are_normalized(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = plan_for(repository, ["python", "-c", "pass"])
            for label in ("Job create", "Job assign", "resume", "terminate", "close"):
                with self.subTest(label), mock.patch(
                    "tools.local_verification.runner._run_attempt",
                    side_effect=OSError(f"synthetic {label} failure"),
                ):
                    with self.assertRaisesRegex(OSError, label):
                        execute_plan(plan, invocation_directory=repository)
                    summary = json.loads(
                        Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8")
                    )
                    self.assertEqual("InfrastructureFailure", summary["failure_classification"])
                    self.assertFalse(summary["passed"])


class ProcessOwnershipTests(unittest.TestCase):
    def test_exited_process_is_not_authoritative_while_birth_token_is_queryable(self):
        process = subprocess.Popen([sys.executable, "-c", "pass"])
        try:
            identity = get_process_identity(process.pid)
            self.assertIsNotNone(identity)
            deadline = time.time() + 3
            while process_is_alive(process.pid) and time.time() < deadline:
                time.sleep(0.02)
            self.assertFalse(process_is_alive(process.pid))
            self.assertEqual(identity, get_process_identity(process.pid))
            self.assertFalse(process_identity_matches(process.pid, identity))
        finally:
            process.wait(timeout=3)

    def test_posix_group_termination_does_not_short_circuit_when_root_exited(self):
        process = mock.Mock(pid=8765)
        process.poll.return_value = 0
        ownership = PosixProcessGroup(process)
        with mock.patch.object(ownership, "_exists", side_effect=[True, False, False]), mock.patch("os.killpg", create=True) as kill_group:
            self.assertEqual("sigterm", ownership.terminate(grace=0))
        kill_group.assert_called_once_with(8765, mock.ANY)

    @unittest.skipUnless(os.name == "nt", "Windows API failure-path tests")
    def test_windows_job_api_create_assign_terminate_close_and_resume_failures(self):
        process = mock.Mock(pid=4100, _handle=123)

        kernel = mock.MagicMock()
        kernel.CreateJobObjectW.return_value = 0
        with mock.patch("ctypes.WinDLL", return_value=kernel):
            with self.assertRaises(OSError):
                WindowsJob(process)

        kernel = mock.MagicMock()
        kernel.CreateJobObjectW.return_value = 456
        kernel.SetInformationJobObject.return_value = True
        kernel.AssignProcessToJobObject.return_value = False
        kernel.CloseHandle.return_value = True
        with mock.patch("ctypes.WinDLL", return_value=kernel):
            with self.assertRaises(OSError):
                WindowsJob(process)
        kernel.CloseHandle.assert_called_once_with(456)

        kernel = mock.MagicMock()
        kernel.CreateJobObjectW.return_value = 457
        kernel.SetInformationJobObject.return_value = True
        kernel.AssignProcessToJobObject.return_value = True
        kernel.TerminateJobObject.return_value = False
        kernel.CloseHandle.return_value = True
        with mock.patch("ctypes.WinDLL", return_value=kernel):
            job = WindowsJob(process)
            with self.assertRaises(OSError):
                job.terminate()
            job.close()

        kernel = mock.MagicMock()
        kernel.CreateJobObjectW.return_value = 458
        kernel.SetInformationJobObject.return_value = True
        kernel.AssignProcessToJobObject.return_value = True
        kernel.TerminateJobObject.return_value = True
        kernel.CloseHandle.side_effect = [False, True]
        process.wait.return_value = None
        with mock.patch("ctypes.WinDLL", return_value=kernel):
            job = WindowsJob(process)
            with self.assertRaises(OSError):
                job.close()
        self.assertIsNone(job._handle)
        kernel.TerminateJobObject.assert_called_once_with(458, 1)

        ntdll = mock.MagicMock()
        ntdll.NtResumeProcess.return_value = 0xC0000001
        with mock.patch("ctypes.WinDLL", return_value=ntdll):
            with self.assertRaisesRegex(OSError, "NtResumeProcess failed"):
                resume_process(process)

    @unittest.skipUnless(os.name == "nt", "Windows Job Object containment test")
    def test_windows_job_contains_multilevel_descendants_after_root_exit(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            make_repository(repository)
            previous = os.environ.get("LOCAL_VERIFICATION_STATE_DIR")
            os.environ["LOCAL_VERIFICATION_STATE_DIR"] = state
            child_pid_path = Path(repository, "child.pid")
            grandchild_pid_path = Path(repository, "grandchild.pid")
            try:
                plan = plan_for(
                    repository,
                    descendant_tree_command("child.pid", "grandchild.pid"),
                )
                with contextlib.redirect_stdout(io.StringIO()):
                    result = execute_plan(plan, invocation_directory=repository)
                self.assertEqual("windows-job-object", result["attempts"][0]["owned_process"]["kind"])
                self.assertTrue(child_pid_path.is_file())
                self.assertTrue(grandchild_pid_path.is_file())
                child_pid = int(child_pid_path.read_text(encoding="utf-8"))
                grandchild_pid = int(grandchild_pid_path.read_text(encoding="utf-8"))
                deadline = time.time() + 3
                while (process_is_alive(child_pid) or process_is_alive(grandchild_pid)) and time.time() < deadline:
                    time.sleep(0.05)
                self.assertFalse(process_is_alive(child_pid))
                self.assertFalse(process_is_alive(grandchild_pid))
            finally:
                if previous is None:
                    os.environ.pop("LOCAL_VERIFICATION_STATE_DIR", None)
                else:
                    os.environ["LOCAL_VERIFICATION_STATE_DIR"] = previous

    @unittest.skipUnless(os.name == "nt", "Windows Job Object timeout test")
    def test_windows_timeout_terminates_multilevel_descendants(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            make_repository(repository)
            previous = os.environ.get("LOCAL_VERIFICATION_STATE_DIR")
            os.environ["LOCAL_VERIFICATION_STATE_DIR"] = state
            child_pid_path = Path(repository, "timeout-child.pid")
            grandchild_pid_path = Path(repository, "timeout-grandchild.pid")
            try:
                plan = plan_for(
                    repository,
                    descendant_tree_command("timeout-child.pid", "timeout-grandchild.pid", parent_sleep=True),
                    timeout_seconds=2,
                )
                with contextlib.redirect_stdout(io.StringIO()):
                    result = execute_plan(plan, invocation_directory=repository)
                self.assertTrue(result["timed_out"])
                self.assertEqual("terminate-job", result["attempts"][0]["termination"])
                self.assertTrue(child_pid_path.is_file())
                self.assertTrue(grandchild_pid_path.is_file())
                child_pid = int(child_pid_path.read_text(encoding="utf-8"))
                grandchild_pid = int(grandchild_pid_path.read_text(encoding="utf-8"))
                self.assertFalse(process_is_alive(child_pid))
                self.assertFalse(process_is_alive(grandchild_pid))
            finally:
                if previous is None:
                    os.environ.pop("LOCAL_VERIFICATION_STATE_DIR", None)
                else:
                    os.environ["LOCAL_VERIFICATION_STATE_DIR"] = previous


if __name__ == "__main__":
    unittest.main()
