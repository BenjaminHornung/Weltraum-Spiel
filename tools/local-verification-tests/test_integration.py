import contextlib
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from tools.local_verification.cli import main
from tools.local_verification.git import inspect_repository, worktree_fingerprint
from tools.local_verification.parsing import (
    FAILURE_CLASSIFICATIONS,
    classify_failure,
    compare_expected_counts,
    parse_playwright_counts,
    parse_vitest_counts,
    infer_framework,
)
from tools.local_verification.plan import build_plan, tokens_for_profile
from tools.local_verification.process_control import get_process_identity
from tools.local_verification.profiles import load_profile
from tools.local_verification.redaction import REDACTED, Redactor
from tools.local_verification.reservations import ReservationConflict, Reservations
from tools.local_verification.runner import _run_attempt, _terminate_owned, execute_plan
from tools.local_verification.status import status_details, status_markdown
from tools.local_verification.summary import (
    build_summary,
    compute_summary_hash,
    normalize_summary_path,
)


VITEST_OUTPUT = """\
 Test Files  2 passed (2)
      Tests  12 passed | 1 failed | 2 skipped (15)
   Duration  1.23s
"""
PLAYWRIGHT_OUTPUT = """\
  1 failed
  2 skipped
  7 passed (3.2s)
"""


def make_repository(directory):
    subprocess.run(["git", "init", "-b", "test-branch", directory], check=True, capture_output=True)
    subprocess.run(["git", "-C", directory, "config", "user.email", "test@example.invalid"], check=True)
    subprocess.run(["git", "-C", directory, "config", "user.name", "Test"], check=True)
    Path(directory, "tracked.txt").write_text("clean", encoding="utf-8")
    subprocess.run(["git", "-C", directory, "add", "tracked.txt"], check=True)
    subprocess.run(["git", "-C", directory, "commit", "-m", "initial"], check=True, capture_output=True)
    return inspect_repository(directory)


def runnable_plan(repository, command, **changes):
    state = inspect_repository(repository)
    values = dict(
        repository_root=".",
        worktree=".",
        worktree_fingerprint=worktree_fingerprint(repository),
        expected_branch=state["branch"],
        expected_sha=state["sha"],
        node_version="v22",
        npm_version="10",
        command_argv=command,
        environment={},
        working_directory=".",
        timeout_seconds=5,
        resource_tokens=tokens_for_profile(load_profile("laptop-safe"), command),
        port=None,
        allowed_changed_paths=[],
        expected_output_counts={},
        cleanup_policy={"git": "dry-run-only", "retry_count": 0},
    )
    values.update(changes)
    return build_plan(**values)


class ParserAndClassificationTests(unittest.TestCase):
    def test_representative_vitest_and_playwright_counts(self):
        self.assertEqual(
            {"passed": 12, "failed": 1, "skipped": 2, "total": 15},
            parse_vitest_counts(VITEST_OUTPUT),
        )
        self.assertEqual(
            {"failed": 1, "skipped": 2, "passed": 7, "total": 10},
            parse_playwright_counts(PLAYWRIGHT_OUTPUT),
        )
        self.assertEqual("playwright", infer_framework(["npm", "run", "test:e2e:core"]))

    def test_expected_counts_report_missing_and_wrong_values(self):
        mismatch = compare_expected_counts({"passed": 3}, {"passed": 4, "failed": 0})
        self.assertEqual({"expected": 0, "actual": None}, mismatch["failed"])
        self.assertEqual({"expected": 4, "actual": 3}, mismatch["passed"])

    def test_every_required_failure_classification(self):
        cases = {
            "AssertionFailure": dict(output="AssertionError: expected 1 to equal 2", exit_code=1),
            "TestTimeout": dict(output="Test timed out in 5000ms", exit_code=1),
            "HookTimeout": dict(output="beforeAll hook timed out", exit_code=1),
            "ProcessCrash": dict(output="worker process crashed with SIGSEGV", exit_code=-11),
            "PortConflict": dict(output="listen EADDRINUSE", exit_code=1),
            "DirtyEvidence": dict(output="unexpected dirty path: evidence/a.json", exit_code=1),
            "DependencyMismatch": dict(output="npm version mismatch", exit_code=1),
            "InfrastructureFailure": dict(output="browser executable unavailable", exit_code=1),
        }
        self.assertEqual(set(FAILURE_CLASSIFICATIONS), set(cases))
        for expected, arguments in cases.items():
            with self.subTest(expected):
                self.assertEqual(expected, classify_failure(**arguments))


class RedactionAndSummaryTests(unittest.TestCase):
    def test_secret_names_values_and_inline_assignments_are_redacted(self):
        redactor = Redactor({"NORMAL": "visible", "API_TOKEN": "super-secret"})
        value = redactor.redact("super-secret API_TOKEN=other NORMAL=visible")
        self.assertNotIn("super-secret", value)
        self.assertNotIn("other", value)
        self.assertEqual(2, value.count(REDACTED))
        self.assertIn("NORMAL=visible", value)

    def test_short_secret_is_rejected_without_corrupting_parser_input(self):
        with self.assertRaisesRegex(ValueError, "shorter than four"):
            Redactor({"API_TOKEN": "1"})
        self.assertEqual(" Tests  1 passed (1)\n", Redactor({}).redact(" Tests  1 passed (1)\n"))

    def test_windows_and_posix_summary_paths_are_relative_or_redacted(self):
        self.assertEqual("tools/x.py", normalize_summary_path(r"C:\repo\tools\x.py", r"C:\repo"))
        self.assertEqual("[ABSOLUTE_PATH]", normalize_summary_path(r"D:\outside\x.py", r"C:\repo"))
        self.assertEqual("[ABSOLUTE_PATH]", normalize_summary_path(r"C:\repo\tools\x.py", "."))

    def test_summary_claims_counts_dirty_state_and_hash_deterministically(self):
        plan = build_plan(
            repository_root=".", worktree=".", worktree_fingerprint="0" * 64,
            expected_branch="feature/a",
            expected_sha="abc", node_version="v22", npm_version="10",
            command_argv=["vitest"], environment={}, working_directory=".",
            timeout_seconds=30, resource_tokens=tokens_for_profile(load_profile("laptop-safe"), ["vitest"]), port=None,
            allowed_changed_paths=[], expected_output_counts={"passed": 12, "total": 15},
            cleanup_policy={"git": "dry-run-only", "retry_count": 0},
        )
        result = {"attempts": [{"attempt": 1, "exit_code": 0, "timed_out": False, "signal": None}]}
        state = {"branch": "feature/a", "sha": "abc", "dirty_paths": [], "unexpected_dirty_paths": []}
        first = build_summary(plan, result, VITEST_OUTPUT, repository_state=state)
        second = build_summary(plan, result, VITEST_OUTPUT, repository_state=state)
        self.assertTrue(first["hash_valid"])
        self.assertTrue(first["passed"])
        self.assertEqual(first["summary_hash"], second["summary_hash"])
        self.assertEqual(first["summary_hash"], compute_summary_hash(first))
        dirty = build_summary(plan, result, VITEST_OUTPUT, repository_state={**state, "dirty_paths": ["evidence/a.json"], "unexpected_dirty_paths": ["evidence/a.json"]})
        self.assertFalse(dirty["passed"])
        self.assertEqual("DirtyEvidence", dirty["failure_classification"])
        self.assertEqual(["evidence/a.json"], dirty["repository"]["dirty_paths"])

    def test_count_or_exit_mismatch_cannot_claim_pass(self):
        plan = build_plan(
            repository_root=".", worktree=".", worktree_fingerprint="0" * 64,
            expected_branch="x", expected_sha="y",
            node_version="v22", npm_version="10", command_argv=["playwright"],
            environment={}, working_directory=".", timeout_seconds=30,
            resource_tokens=tokens_for_profile(load_profile("laptop-safe"), ["playwright"]), port=None, allowed_changed_paths=[],
            expected_output_counts={"passed": 8},
            cleanup_policy={"git": "dry-run-only", "retry_count": 0},
        )
        result = {"attempts": [{"attempt": 1, "exit_code": 1, "timed_out": False, "signal": None}]}
        summary = build_summary(plan, result, PLAYWRIGHT_OUTPUT)
        self.assertFalse(summary["passed"])
        self.assertEqual({"expected": 8, "actual": 7}, summary["count_mismatches"]["passed"])


class ProcessAndReservationTests(unittest.TestCase):
    def setUp(self):
        self.old_state = os.environ.get("LOCAL_VERIFICATION_STATE_DIR")
        self.state = tempfile.TemporaryDirectory()
        os.environ["LOCAL_VERIFICATION_STATE_DIR"] = self.state.name

    def tearDown(self):
        self.state.cleanup()
        if self.old_state is None:
            os.environ.pop("LOCAL_VERIFICATION_STATE_DIR", None)
        else:
            os.environ["LOCAL_VERIFICATION_STATE_DIR"] = self.old_state

    def test_literal_argv_is_not_shell_interpreted(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            output = Path(repository, "argv.json")
            literal = ["one two", "$(must-not-expand)", "; exit 9", 'quote"value']
            command = ["python", "-c", "import json,sys;open(sys.argv[1],'w',encoding='utf-8').write(json.dumps(sys.argv[2:]))", "argv.json", *literal]
            result = execute_plan(runnable_plan(repository, command), invocation_directory=repository)
            self.assertEqual(0, result["exit_code"])
            self.assertEqual(literal, json.loads(output.read_text(encoding="utf-8")))

    def test_runtime_log_redacts_configured_and_inline_secrets(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            secret = "unit-secret-value"
            command = ["python", "-c", "import os;print(os.environ['API_TOKEN']);print('PASS'+'WORD=inline-secret')"]
            plan = runnable_plan(repository, command, environment={"API_TOKEN": {"source": "host-env", "key": "TEST_API_TOKEN"}})
            with mock.patch.dict(os.environ, {"TEST_API_TOKEN": secret}), contextlib.redirect_stdout(io.StringIO()):
                result = execute_plan(plan, invocation_directory=repository)
            log = Path(result["runtime_log"]).read_text(encoding="utf-8")
            self.assertNotIn(secret, log)
            self.assertNotIn("inline-secret", log)
            self.assertGreaterEqual(log.count(REDACTED), 2)

    def test_expected_counts_are_enforced_by_real_fake_child(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            command = ["python", "-c", f"print({VITEST_OUTPUT!r})"]
            plan = runnable_plan(repository, command, expected_output_counts={"passed": 12, "total": 15})
            with contextlib.redirect_stdout(io.StringIO()):
                result = execute_plan(plan, invocation_directory=repository)
            self.assertTrue(result["summary"]["passed"])
            self.assertEqual({}, result["summary"]["count_mismatches"])

    def test_concurrent_slot_and_port_reservations_conflict_then_release(self):
        first = Reservations(self.state.name, "first")
        second = Reservations(self.state.name, "second")
        first.claim_slot("worktrees", 1)
        first.claim("port:5299")
        with self.assertRaises(ReservationConflict):
            second.claim_slot("worktrees", 1)
        with self.assertRaises(ReservationConflict):
            second.claim("port:5299")
        first.release_all()
        second.claim_slot("worktrees", 1)
        second.claim("port:5299")
        second.release_all()

    def test_ctrl_c_targets_only_spawned_process_and_returns_signal(self):
        process = mock.Mock(pid=4321, stdout=io.StringIO(""), stderr=io.StringIO(""), returncode=-2)
        process.wait.side_effect = KeyboardInterrupt
        ownership = mock.Mock(metadata={"kind": "fake", "root_pid": 4321})
        plan = {"command_argv": ["fake", "literal arg"], "environment": {}, "working_directory": ".", "timeout_seconds": 1}
        with mock.patch("tools.local_verification.runner.subprocess.Popen", return_value=process), mock.patch("tools.local_verification.runner.create_process_container", return_value=ownership), mock.patch("tools.local_verification.runner.resume_process"), mock.patch("tools.local_verification.runner._terminate_owned", return_value="sigterm") as terminate:
            attempt = _run_attempt(plan, 1, io.StringIO(), "run", Redactor({}))
        terminate.assert_called_once_with(process, ownership)
        self.assertEqual("SIGINT", attempt["signal"])
        self.assertEqual(4321, attempt["owned_process"]["root_pid"])

    def test_posix_timeout_termination_addresses_only_owned_group(self):
        process = mock.Mock(pid=8765)
        ownership = mock.Mock()
        ownership.terminate.return_value = "sigterm"
        self.assertEqual("sigterm", _terminate_owned(process, ownership))
        ownership.terminate.assert_called_once_with(2.0)

    def test_port_conflict_never_starts_child(self):
        with tempfile.TemporaryDirectory() as repository, socket.socket() as occupied:
            make_repository(repository)
            for port in range(5201, 5300):
                try:
                    occupied.bind(("127.0.0.1", port))
                    break
                except OSError:
                    continue
            else:
                self.fail("no free profile port available for conflict test")
            plan = runnable_plan(repository, ["python", "-c", "raise SystemExit(99)"], port=port)
            with mock.patch("tools.local_verification.runner._run_attempt") as run_attempt:
                with self.assertRaisesRegex(RuntimeError, "port conflict before"):
                    execute_plan(plan, invocation_directory=repository)
                run_attempt.assert_not_called()
            self.assertFalse(any((Path(self.state.name) / "reservations").iterdir()))
            summary = json.loads(Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8"))
            self.assertFalse(summary["passed"])
            self.assertEqual("PortConflict", summary["failure_classification"])

    def test_post_run_port_conflict_updates_latest_failure(self):
        with tempfile.TemporaryDirectory() as repository:
            make_repository(repository)
            plan = runnable_plan(
                repository, ["python", "-c", "print('completed')"], port=5201
            )
            with mock.patch(
                "tools.local_verification.runner._port_available", side_effect=[True, False]
            ), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, "port conflict after"):
                    execute_plan(plan, invocation_directory=repository)
            summary = json.loads(
                Path(self.state.name, "latest-summary.json").read_text(encoding="utf-8")
            )
            self.assertEqual("PortConflict", summary["failure_classification"])
            self.assertEqual(1, len(summary["attempts"]))


class GitAndStatusTests(unittest.TestCase):
    def test_git_inspection_constructs_only_read_only_commands(self):
        calls = []

        def fake_run(argv, **kwargs):
            calls.append(argv)
            if "status" in argv:
                output = ""
            elif "branch" in argv:
                output = "feature/a\n"
            elif "rev-parse" in argv:
                output = "abc\n"
            else:
                output = "0 0\n"
            return subprocess.CompletedProcess(argv, 0, output, "")

        with mock.patch("tools.local_verification.git.subprocess.run", side_effect=fake_run):
            inspect_repository(".")
        forbidden = {"restore", "reset", "clean", "stash", "checkout", "switch", "commit", "push", "fetch"}
        self.assertFalse(forbidden.intersection(arg for call in calls for arg in call))

    def test_status_json_data_and_markdown_are_complete(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state_root:
            make_repository(repository)
            Path(repository, ".devtoolbox", "specs", "changes", "change-a").mkdir(parents=True)
            Path(state_root, "running").mkdir()
            identity = get_process_identity(os.getpid())
            self.assertIsNotNone(identity)
            Path(state_root, "running", "run-a.json").write_text(json.dumps({"run_id":"run-a","owner_pid":os.getpid(),"process_identity":identity}), encoding="utf-8")
            reservation = Path(state_root, "reservations", "port")
            reservation.mkdir(parents=True)
            Path(reservation, "owner.json").write_text(json.dumps({"run_id":"run-a","owner_pid":os.getpid(),"process_identity":identity,"resource":"port:5201"}), encoding="utf-8")
            Path(state_root, "latest-summary.json").write_text('{"passed":true,"plan_hash":"abc"}', encoding="utf-8")
            state = status_details(repository, state_root)
            self.assertEqual(["change-a"], state["devtoolbox_changes"])
            self.assertEqual([5201], state["reserved_ports"])
            self.assertEqual("run-a", state["running_owned_runs"][0]["run_id"])
            self.assertTrue(state["latest_local_summary"]["passed"])
            markdown = status_markdown(state)
            for label in ("Branch", "SHA", "Ahead/behind", "Dirty paths", "DevToolbox changes", "Running owned runs", "Reserved ports", "Latest local summary"):
                self.assertIn(label, markdown)

    def test_status_cli_json_has_complete_keys(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state_root:
            make_repository(repository)
            old = os.environ.get("LOCAL_VERIFICATION_STATE_DIR")
            os.environ["LOCAL_VERIFICATION_STATE_DIR"] = state_root
            try:
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    self.assertEqual(0, main(["status", "--repository", repository]))
                value = json.loads(output.getvalue())
            finally:
                if old is None:
                    os.environ.pop("LOCAL_VERIFICATION_STATE_DIR", None)
                else:
                    os.environ["LOCAL_VERIFICATION_STATE_DIR"] = old
            required = {"branch", "sha", "dirty_paths", "ahead", "behind", "devtoolbox_changes", "running_owned_runs", "reserved_ports", "stale_state", "cleanup_plan", "latest_local_summary"}
            self.assertTrue(required.issubset(value))


if __name__ == "__main__":
    unittest.main()
