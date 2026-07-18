import contextlib
import io
import json
import os
import shutil
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
from tools.local_verification.plan import build_plan, compute_plan_hash, tokens_for_profile
from tools.local_verification.process_control import get_process_identity
from tools.local_verification.profiles import load_profile
from tools.local_verification.redaction import REDACTED, Redactor
from tools.local_verification.reservations import ReservationConflict, Reservations
from tools.local_verification import runner as runner_module
from tools.local_verification.runner import (
    _run_attempt,
    _runtime_argv,
    _terminate_owned,
    execute_plan,
)
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


def copy_native_executable(directory, name):
    destination = Path(directory, name)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(sys.executable, destination)
    return destination


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

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_extensionless_native_command_uses_child_path_job_and_preserves_plan(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as bin_dir:
            make_repository(repository)
            copy_native_executable(bin_dir, "native-shim.exe")
            plan = runnable_plan(
                repository,
                [
                    "native-shim",
                    "-c",
                    "print('native-ran')",
                ],
            )
            canonical_argv = list(plan["command_argv"])
            canonical_hash = plan["canonical_plan_hash"]
            child_path = os.pathsep.join((bin_dir, str(Path(sys.executable).parent)))

            with mock.patch(
                "tools.local_verification.runner.resolve_environment",
                return_value={"PATH": child_path, "PATHEXT": ".CMD;.BAT"},
            ), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(
                io.StringIO()
            ):
                result = execute_plan(
                    plan,
                    invocation_directory=repository,
                )

            attempt = result["attempts"][0]
            run_record = json.loads(Path(result["run_path"]).read_text(encoding="utf-8"))
            self.assertEqual(0, attempt["exit_code"])
            self.assertEqual(1, attempt["attempt"])
            self.assertEqual("windows-job-object", attempt["owned_process"]["kind"])
            self.assertEqual(canonical_argv, plan["command_argv"])
            self.assertEqual(canonical_hash, plan["canonical_plan_hash"])
            self.assertEqual(canonical_hash, compute_plan_hash(plan))
            self.assertEqual(canonical_argv, run_record["plan"]["command_argv"])
            self.assertEqual(canonical_hash, run_record["plan"]["canonical_plan_hash"])
            self.assertEqual(canonical_hash, result["summary"]["plan_hash"])
            self.assertTrue(result["summary"]["hash_valid"])
            self.assertTrue(result["summary"]["passed"])

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_batch_shims_with_metacharacters_are_rejected_before_popen(self):
        with tempfile.TemporaryDirectory() as repository:
            bin_dir = Path(repository, "bin")
            evil_argument = "literal & echo injected>injected-marker.txt"
            commands = []
            for extension in (".cmd", ".bat"):
                stem = f"batch-shim-{extension[1:]}"
                shim = bin_dir / f"{stem}{extension}"
                shim.parent.mkdir(parents=True, exist_ok=True)
                shim.write_text(
                    "@echo off\r\necho shim-ran>batch-marker.txt\r\nexit /b 0\r\n",
                    encoding="utf-8",
                )
                commands.extend(
                    (
                        [str(Path("bin", shim.name)), evil_argument],
                        [stem, evil_argument],
                    )
                )

            with mock.patch("tools.local_verification.runner.subprocess.Popen") as popen:
                for command in commands:
                    with self.subTest(command=command[0]):
                        plan = {
                            "command_argv": command,
                            "environment": {},
                            "working_directory": repository,
                            "timeout_seconds": 1,
                        }
                        with self.assertRaises(RuntimeError) as caught:
                            _run_attempt(
                                plan,
                                1,
                                io.StringIO(),
                                "windows-batch-rejection",
                                Redactor({}),
                                resolved_environment={"PATH": str(bin_dir)},
                                runtime_working_directory=repository,
                            )
                        self.assertEqual(
                            runner_module.WINDOWS_NATIVE_EXECUTABLE_ERROR,
                            str(caught.exception),
                        )
                        self.assertNotIn(evil_argument, str(caught.exception))

                popen.assert_not_called()

            self.assertFalse(Path(repository, "batch-marker.txt").exists())
            self.assertFalse(Path(repository, "injected-marker.txt").exists())

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_windows_path_directory_priority_precedes_native_extension_priority(self):
        with tempfile.TemporaryDirectory() as root:
            first = Path(root, "first")
            second = Path(root, "second")
            first_exe = copy_native_executable(first, "priority-shim.exe")
            copy_native_executable(second, "priority-shim.com")
            argv = ["priority-shim", "literal argument"]

            resolved = _runtime_argv(
                argv,
                {"PATH": os.pathsep.join((str(first), str(second)))},
                root,
            )

            self.assertEqual(first_exe.resolve(), Path(resolved[0]).resolve())
            self.assertEqual(argv[1:], resolved[1:])
            self.assertEqual(["priority-shim", "literal argument"], argv)

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_windows_path_skips_empty_relative_and_cwd_fallbacks(self):
        with tempfile.TemporaryDirectory() as root:
            parent = Path(root, "parent")
            child = Path(root, "child")
            relative_bin = parent / "relative-bin"
            parent.mkdir()
            child.mkdir()
            copy_native_executable(parent, "cwd-shadow.exe")
            copy_native_executable(child, "child-shadow.exe")
            copy_native_executable(relative_bin, "relative-shadow.exe")
            original_cwd = Path.cwd()
            os.chdir(parent)
            try:
                cases = (
                    (["cwd-shadow"], {"PATH": ""}),
                    (["cwd-shadow"], {"PATH": "."}),
                    (["relative-shadow"], {"PATH": "relative-bin"}),
                    (["child-shadow"], {"PATH": ""}),
                )
                for argv, env in cases:
                    with self.subTest(argv=argv, path=env["PATH"]):
                        with self.assertRaises(RuntimeError) as caught:
                            _runtime_argv(argv, env, child)
                        self.assertEqual(
                            runner_module.WINDOWS_NATIVE_EXECUTABLE_ERROR,
                            str(caught.exception),
                        )
            finally:
                os.chdir(original_cwd)

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_root_relative_windows_paths_are_rejected_before_popen(self):
        with tempfile.TemporaryDirectory() as root:
            native = copy_native_executable(root, "rooted-shim.exe")
            _, rooted_native = os.path.splitdrive(str(native))
            _, rooted_directory = os.path.splitdrive(str(native.parent))
            original_cwd = Path.cwd()
            os.chdir(root)
            try:
                cases = (
                    ([rooted_native], {"PATH": ""}),
                    (["rooted-shim"], {"PATH": rooted_directory}),
                )
                with mock.patch(
                    "tools.local_verification.runner.subprocess.Popen"
                ) as popen:
                    for command, resolved_environment in cases:
                        with self.subTest(command=command[0]):
                            plan = {
                                "command_argv": command,
                                "environment": {},
                                "working_directory": root,
                                "timeout_seconds": 1,
                            }
                            with self.assertRaises(RuntimeError) as caught:
                                _run_attempt(
                                    plan,
                                    1,
                                    io.StringIO(),
                                    "windows-root-relative-rejection",
                                    Redactor({}),
                                    resolved_environment=resolved_environment,
                                    runtime_working_directory=root,
                                )
                            self.assertEqual(
                                runner_module.WINDOWS_NATIVE_EXECUTABLE_ERROR,
                                str(caught.exception),
                            )
                    popen.assert_not_called()
            finally:
                os.chdir(original_cwd)

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_mixed_case_child_path_overrides_inherited_path_before_popen(self):
        with tempfile.TemporaryDirectory() as bin_dir:
            copy_native_executable(bin_dir, "parent-shadow.exe")
            plan = {
                "command_argv": ["parent-shadow"],
                "environment": {},
                "working_directory": bin_dir,
                "timeout_seconds": 1,
            }

            with mock.patch.dict(
                os.environ, {"PATH": bin_dir}, clear=True
            ), mock.patch(
                "tools.local_verification.runner.subprocess.Popen"
            ) as popen:
                child_environment = runner_module._child_environment({"Path": ""})
                self.assertEqual("", child_environment["PATH"])
                self.assertNotIn("Path", child_environment)
                with self.assertRaises(RuntimeError) as caught:
                    _run_attempt(
                        plan,
                        1,
                        io.StringIO(),
                        "windows-mixed-case-path-rejection",
                        Redactor({}),
                        resolved_environment={"Path": ""},
                        runtime_working_directory=bin_dir,
                    )
                self.assertEqual(
                    runner_module.WINDOWS_NATIVE_EXECUTABLE_ERROR,
                    str(caught.exception),
                )
                popen.assert_not_called()

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_quoted_absolute_child_path_entry_resolves(self):
        with tempfile.TemporaryDirectory(prefix="native path ") as bin_dir:
            native = copy_native_executable(bin_dir, "quoted-shim.exe")

            resolved = _runtime_argv(
                ["quoted-shim"],
                {"PATH": f'"{bin_dir}"'},
                bin_dir,
            )

            self.assertEqual(native.resolve(), Path(resolved[0]).resolve())

    @unittest.skipUnless(os.name == "nt", "Windows native executable resolution")
    def test_explicit_native_paths_are_child_bounded_and_must_exist(self):
        with tempfile.TemporaryDirectory() as root:
            child = Path(root, "child")
            native = copy_native_executable(child / "bin", "relative-shim.exe")
            outside = copy_native_executable(root, "outside-shim.exe")
            relative_argv = [str(Path("bin", native.name)), "literal"]

            resolved_relative = _runtime_argv(relative_argv, {"PATH": ""}, child)
            resolved_absolute = _runtime_argv([str(native)], {"PATH": ""}, child)

            self.assertEqual(native.resolve(), Path(resolved_relative[0]).resolve())
            self.assertEqual(["literal"], resolved_relative[1:])
            self.assertEqual(native.resolve(), Path(resolved_absolute[0]).resolve())
            for rejected in (
                [str(Path("bin", "missing.exe"))],
                [str(child / "missing.exe")],
                [str(Path("..", outside.name))],
            ):
                with self.subTest(rejected=rejected[0]):
                    with self.assertRaises(RuntimeError) as caught:
                        _runtime_argv(rejected, {"PATH": ""}, child)
                    self.assertEqual(
                        runner_module.WINDOWS_NATIVE_EXECUTABLE_ERROR,
                        str(caught.exception),
                    )

    def test_non_windows_runtime_argv_is_unchanged(self):
        argv = ["batch-shim.cmd", "literal & untouched"]
        with mock.patch.object(runner_module.os, "name", "posix"):
            self.assertIs(argv, _runtime_argv(argv, {"PATH": ""}, "."))

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
        with mock.patch("tools.local_verification.runner._runtime_argv", return_value=plan["command_argv"]), mock.patch("tools.local_verification.runner.subprocess.Popen", return_value=process), mock.patch("tools.local_verification.runner.create_process_container", return_value=ownership), mock.patch("tools.local_verification.runner.resume_process"), mock.patch("tools.local_verification.runner._terminate_owned", return_value="sigterm") as terminate:
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
