"""Shell-free execution of one canonical local verification plan."""

import json
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path, PureWindowsPath

from .git import inspect_repository, verify_allowed_paths, worktree_fingerprint, worktree_root
from .environment import resolve_environment
from .plan import compute_plan_hash, validate_plan
from .process_control import create_process_container, get_process_identity, resume_process
from .redaction import Redactor
from .reservations import ReservationConflict, Reservations
from .status import state_directory
from .summary import build_summary_from_run_record, compute_summary_hash


class DependencyMismatchError(RuntimeError):
    pass


class DirtyEvidenceError(RuntimeError):
    pass


class PortConflictError(RuntimeError):
    pass


WINDOWS_NATIVE_EXECUTABLE_ERROR = (
    "Windows command must resolve to an existing native .COM or .EXE executable"
)
_WINDOWS_NATIVE_EXTENSIONS = (".COM", ".EXE")
_WINDOWS_BATCH_EXTENSIONS = (".CMD", ".BAT")


class WindowsNativeExecutableError(RuntimeError):
    pass


def _port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try: sock.bind(("127.0.0.1", port))
        except OSError: return False
    return True

def _terminate_owned(process, ownership, grace=2.0):
    return ownership.terminate(grace)

def _pump(stream, console, log, lock, redactor, captured):
    try:
        for line in iter(stream.readline, ""):
            line = redactor.redact(line)
            with lock:
                captured.append(line)
                console.write(line)
                console.flush()
                log.write(line)
                log.flush()
    finally:
        stream.close()

def _runtime_argv(argv, env, child_working_directory=None):
    if os.name != "nt":
        return argv

    command = argv[0]
    extension = os.path.splitext(command)[1].upper()
    if extension in _WINDOWS_BATCH_EXTENSIONS:
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)

    if _is_fully_qualified_windows_path(command):
        executable = os.path.normpath(command)
        if extension in _WINDOWS_NATIVE_EXTENSIONS and os.path.isfile(executable):
            return [executable, *argv[1:]]
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)
    if os.path.isabs(command):
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)

    drive, _ = os.path.splitdrive(command)
    has_separator = any(
        separator and separator in command for separator in (os.sep, os.altsep)
    )
    if drive:
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)
    if has_separator:
        child_root = os.path.realpath(
            os.path.abspath(os.fspath(child_working_directory or "."))
        )
        executable_base = os.path.realpath(os.path.join(child_root, command))
        try:
            contained = os.path.normcase(
                os.path.commonpath((child_root, executable_base))
            ) == os.path.normcase(child_root)
        except ValueError:
            contained = False
        if not contained:
            raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)
        executable = _resolve_windows_candidate(executable_base, extension)
        if executable is not None:
            return [executable, *argv[1:]]
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)

    if extension and extension not in _WINDOWS_NATIVE_EXTENSIONS:
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)
    for directory in _absolute_windows_path_entries(env):
        executable = _resolve_windows_candidate(
            os.path.join(directory, command), extension
        )
        if executable is not None:
            return [executable, *argv[1:]]
    raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)


def _absolute_windows_path_entries(env):
    path = ""
    for key, value in env.items():
        if isinstance(key, str) and key.upper() == "PATH":
            path = value
    if not isinstance(path, str):
        return
    for raw_entry in path.split(os.pathsep):
        entry = raw_entry.strip()
        if len(entry) >= 2 and entry[0] == entry[-1] == '"':
            entry = entry[1:-1]
        if entry and _is_fully_qualified_windows_path(entry):
            yield os.path.normpath(entry)


def _is_fully_qualified_windows_path(value):
    return PureWindowsPath(value).is_absolute()


def _resolve_windows_candidate(executable_base, extension):
    if extension:
        if extension not in _WINDOWS_NATIVE_EXTENSIONS:
            return None
        return executable_base if os.path.isfile(executable_base) else None

    for native_extension in _WINDOWS_NATIVE_EXTENSIONS:
        executable = executable_base + native_extension
        if os.path.isfile(executable):
            return executable
    if any(
        os.path.isfile(executable_base + batch_extension)
        for batch_extension in _WINDOWS_BATCH_EXTENSIONS
    ):
        raise WindowsNativeExecutableError(WINDOWS_NATIVE_EXECUTABLE_ERROR)
    return None

def _run_attempt(
    plan, attempt, log, run_id, redactor, resolved_environment=None,
    runtime_working_directory=None,
):
    argv = plan["command_argv"]
    if not isinstance(argv, list) or not argv or not all(isinstance(v, str) and v for v in argv): raise ValueError("command_argv must be a non-empty string array")
    resolved_environment = resolved_environment if resolved_environment is not None else resolve_environment(plan.get("environment", {}), os.environ)
    env = _child_environment(resolved_environment)
    child_working_directory = runtime_working_directory or plan["working_directory"]
    kwargs = dict(args=_runtime_argv(argv, env, child_working_directory), cwd=child_working_directory, env=env, shell=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | 0x00000004
    else: kwargs["start_new_session"] = True
    started = time.monotonic()
    process = subprocess.Popen(**kwargs)
    try:
        ownership = create_process_container(process)
        resume_process(process)
    except BaseException:
        try:
            ownership.terminate() if "ownership" in locals() else process.kill()
            process.wait()
        finally:
            if "ownership" in locals():
                ownership.close()
        raise
    lock = threading.Lock(); captured = []
    threads = [
        threading.Thread(target=_pump, args=(process.stdout, sys.stdout, log, lock, redactor, captured), daemon=True),
        threading.Thread(target=_pump, args=(process.stderr, sys.stderr, log, lock, redactor, captured), daemon=True),
    ]
    for thread in threads: thread.start()
    timed_out, received_signal, termination = False, None, None
    try: process.wait(timeout=float(plan["timeout_seconds"]))
    except subprocess.TimeoutExpired: timed_out, termination = True, _terminate_owned(process, ownership)
    except KeyboardInterrupt: received_signal, termination = "SIGINT", _terminate_owned(process, ownership)
    finally:
        try:
            ownership.close()
        finally:
            for thread in threads: thread.join(timeout=3)
    return {
        "attempt": attempt, "run_id": run_id, "owned_process": ownership.metadata,
        "exit_code": process.returncode,
        "duration_seconds": round(time.monotonic()-started, 6),
        "timed_out": timed_out, "signal": received_signal,
        "termination": termination, "_captured_output": "".join(captured),
    }


def _child_environment(resolved_environment):
    if os.name != "nt":
        env = os.environ.copy()
        env.update(resolved_environment)
        return env
    env = {key.upper(): value for key, value in os.environ.items()}
    env.update({key.upper(): value for key, value in resolved_environment.items()})
    return env

def execute_plan(plan, invocation_directory=None):
    run_id = uuid.uuid4().hex
    state = state_directory()
    state.mkdir(parents=True, exist_ok=True)
    log_path = state / "runs" / f"{run_id}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    running_path = state / "running" / f"{run_id}.json"
    reservations = None
    attempts = []
    output = ""
    repository_state = None
    plan_valid = False
    try:
        validate_plan(plan)
        plan_valid = True
        if plan.get("canonical_plan_hash") != compute_plan_hash(plan):
            raise ValueError("canonical plan hash mismatch")
        runtime_root, runtime_cwd = _resolve_runtime_target(plan, invocation_directory)
        repository_state = _repository_state(plan, runtime_root, strict=True)
        _require_pre_run_state(plan, repository_state)
        resolved_environment = resolve_environment(plan.get("environment", {}), os.environ)
        referenced_values = [
            resolved_environment[key]
            for key, entry in plan.get("environment", {}).items()
            if isinstance(entry, dict)
        ]
        redactor = Redactor(
            {**os.environ, **resolved_environment},
            explicit_secret_values=referenced_values,
        )
        owner_pid = os.getpid()
        process_identity = get_process_identity(owner_pid)
        if not process_identity:
            raise RuntimeError("owner process identity could not be corroborated")
        running_path.parent.mkdir(parents=True, exist_ok=True)
        _write_json(
            running_path,
            {
                "run_id": run_id,
                "plan_hash": plan["canonical_plan_hash"],
                "owner_pid": owner_pid,
                "process_identity": process_identity,
            },
        )
        reservations = Reservations(
            state, run_id, owner_pid=owner_pid, process_identity=process_identity
        )
        reservations.claim(f"worktree:{plan['worktree_fingerprint']}")
        tokens = plan["resource_tokens"]
        reservations.claim_slot("worktrees", tokens["max_concurrent_worktrees"])
        if tokens["full_matrix"]:
            reservations.claim_slot("full-matrix", tokens["full_matrix_global_concurrency"])
        port = plan.get("port")
        if port is not None:
            try:
                reservations.claim(f"port:{port}")
            except ReservationConflict as error:
                raise PortConflictError(str(error)) from error
            if not _port_available(int(port)):
                raise PortConflictError(f"port conflict before execution: {port}")
        policy=plan["cleanup_policy"]
        retry_count=policy.get("retry_count", 0)
        with log_path.open("w", encoding="utf-8") as log:
            attempts.append(_run_attempt(
                plan, 1, log, run_id, redactor, resolved_environment,
                runtime_working_directory=runtime_cwd,
            ))
            ordinary_failure = (
                attempts[-1]["exit_code"] not in (None, 0)
                and not attempts[-1]["timed_out"]
                and not attempts[-1]["signal"]
            )
            if ordinary_failure and retry_count == 1 and policy.get("diagnostic_retry") is True:
                attempts.append(_run_attempt(
                    plan, 2, log, run_id, redactor, resolved_environment,
                    runtime_working_directory=runtime_cwd,
                ))
        repository_state = _repository_state(plan, runtime_root)
        if port is not None and not _port_available(int(port)):
            raise PortConflictError(f"port conflict after execution: {port}")
        output = "".join(attempt.pop("_captured_output") for attempt in attempts)
        last = attempts[-1]
        result = {
            "run_id": run_id, "plan_hash": plan["canonical_plan_hash"],
            "attempt_count": len(attempts), "attempts": attempts,
            "exit_code": last["exit_code"],
            "duration_seconds": round(sum(a["duration_seconds"] for a in attempts), 6),
            "timed_out": any(a["timed_out"] for a in attempts),
            "signal": next((a["signal"] for a in attempts if a["signal"]), None),
            "runtime_log": str(log_path),
        }
        run_record = _run_record(plan, result, repository_state)
        run_path = state / "runs" / f"{run_id}.json"
        _write_json(run_path, run_record)
        summary = build_summary_from_run_record(run_record, output=output)
        summary_path = state / "summaries" / f"{run_id}.json"
        _write_json(summary_path, summary)
        _write_json(state / "latest-summary.json", summary)
        result["summary"] = summary
        result["summary_path"] = str(summary_path)
        result["run_path"] = str(run_path)
        return result
    except BaseException as error:
        if isinstance(error, KeyboardInterrupt):
            raise
        output = output or "".join(
            attempt.get("_captured_output", "") for attempt in attempts
        )
        if plan_valid:
            _record_failure_summary(
                state,
                run_id,
                plan,
                attempts,
                output,
                repository_state=repository_state,
                port_conflict=isinstance(error, PortConflictError),
                dependency_mismatch=isinstance(error, DependencyMismatchError),
                infrastructure_failure=not isinstance(
                    error, (PortConflictError, DependencyMismatchError, DirtyEvidenceError)
                ),
            )
        else:
            _record_invalid_plan_failure(state, run_id, plan)
        raise
    finally:
        if reservations is not None:
            reservations.release_all()
        try:
            running_path.unlink()
        except FileNotFoundError:
            pass


def _resolve_runtime_target(plan, invocation_directory=None):
    invocation = Path(invocation_directory or Path.cwd()).resolve()
    try:
        runtime_root = worktree_root(invocation)
        observed_fingerprint = worktree_fingerprint(runtime_root)
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise DependencyMismatchError("invocation worktree identity is unavailable") from error
    if observed_fingerprint != plan["worktree_fingerprint"]:
        raise DependencyMismatchError("invocation worktree does not match the canonical plan binding")
    runtime_cwd = (runtime_root / plan["working_directory"]).resolve()
    if not runtime_cwd.is_dir():
        raise DependencyMismatchError("command working directory is unavailable")
    try:
        runtime_cwd.relative_to(runtime_root)
    except ValueError as error:
        raise DependencyMismatchError("command working directory escaped the invocation worktree") from error
    if not worktree_root(runtime_cwd).samefile(runtime_root):
        raise DependencyMismatchError("command working directory belongs to an unrelated Git worktree")
    return runtime_root, runtime_cwd


def _require_pre_run_state(plan, repository_state):
    if not repository_state.get("branch"):
        raise DependencyMismatchError("detached HEAD cannot execute a plan")
    if (
        repository_state.get("branch") != plan["expected_branch"]
        or repository_state.get("sha") != plan["expected_sha"]
    ):
        raise DependencyMismatchError("pre-run Git branch/SHA mismatch")
    if repository_state.get("unexpected_dirty_paths"):
        raise DirtyEvidenceError("pre-run dirty paths are outside the plan allowance")


def _repository_state(plan, runtime_root, strict=False):
    try:
        state = inspect_repository(str(runtime_root))
    except (OSError, subprocess.SubprocessError, ValueError):
        if strict:
            raise DependencyMismatchError("Git execution identity is unavailable")
        return None
    state["unexpected_dirty_paths"] = verify_allowed_paths(
        state["dirty_paths"], plan.get("allowed_changed_paths", [])
    )
    return state


def _write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + f".{uuid.uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(value, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )
    os.replace(temporary, path)


def _record_failure_summary(
    state, run_id, plan, attempts, output, repository_state=None, **failure_state
):
    result = {
        "attempts": [
            {key: value for key, value in attempt.items() if key != "_captured_output"}
            for attempt in attempts
        ]
    }
    runtime_log = Path(state) / "runs" / f"{run_id}.log"
    if runtime_log.is_file():
        result["runtime_log"] = str(runtime_log)
    record = _run_record(plan, result, repository_state, **failure_state)
    _write_json(Path(state) / "runs" / f"{run_id}.json", record)
    summary = build_summary_from_run_record(record, output=output)
    _write_json(Path(state) / "summaries" / f"{run_id}.json", summary)
    _write_json(Path(state) / "latest-summary.json", summary)


def _run_record(plan, result, repository_state, **failure_state):
    return {
        "run_record_version": 1,
        "plan": plan,
        "result": result,
        "repository_state": repository_state,
        "port_conflict": bool(failure_state.get("port_conflict")),
        "dependency_mismatch": bool(failure_state.get("dependency_mismatch")),
        "infrastructure_failure": bool(failure_state.get("infrastructure_failure")),
    }


def _record_invalid_plan_failure(state, run_id, plan):
    plan_hash = plan.get("canonical_plan_hash") if isinstance(plan, dict) else None
    summary = {
        "summary_version": 1,
        "plan_hash": plan_hash if isinstance(plan_hash, str) else None,
        "hash_valid": False,
        "passed": False,
        "failure_classification": "InfrastructureFailure",
        "attempts": [],
        "counts": {},
        "expected_counts": {},
        "count_mismatches": {},
        "repository": {
            "available": False,
            "branch": None,
            "sha": None,
            "branch_matches": False,
            "sha_matches": False,
            "dirty_paths": [],
            "unexpected_dirty_paths": [],
        },
        "port_conflict": False,
    }
    summary["summary_hash"] = compute_summary_hash(summary)
    record = {
        "run_record_version": 1,
        "invalid_plan": True,
        "plan_hash": summary["plan_hash"],
        "failure_classification": "InfrastructureFailure",
    }
    _write_json(Path(state) / "runs" / f"{run_id}.json", record)
    _write_json(Path(state) / "summaries" / f"{run_id}.json", summary)
    _write_json(Path(state) / "latest-summary.json", summary)


def record_plan_load_failure():
    """Replace stale latest status when a run input cannot become a plan object."""
    state = state_directory()
    state.mkdir(parents=True, exist_ok=True)
    _record_invalid_plan_failure(state, uuid.uuid4().hex, None)
