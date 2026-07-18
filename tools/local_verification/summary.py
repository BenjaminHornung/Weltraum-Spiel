"""Normalized, deterministic local verification summaries."""

import hashlib
import json
import re
from copy import deepcopy
from pathlib import Path

from .parsing import classify_failure, compare_expected_counts, infer_framework, parse_test_counts
from .paths import normalize_path, repository_relative
from .plan import compute_plan_hash


SUMMARY_VERSION = 1


def build_summary(
    plan: dict,
    result: dict,
    output: str = "",
    *,
    repository_state: dict | None = None,
    port_conflict: bool = False,
    dependency_mismatch: bool = False,
    infrastructure_failure: bool = False,
) -> dict:
    """Derive every pass claim from validated plan and observed run state."""
    actual_hash = plan.get("canonical_plan_hash")
    hash_valid = isinstance(actual_hash, str) and actual_hash == compute_plan_hash(plan)
    attempts = [
        {
            "attempt": attempt.get("attempt"),
            "exit_code": attempt.get("exit_code"),
            "timed_out": bool(attempt.get("timed_out")),
            "signal": attempt.get("signal"),
        }
        for attempt in result.get("attempts", [])
    ]
    counts = parse_test_counts(output, infer_framework(plan.get("command_argv", [])))
    expected = {str(key): int(value) for key, value in plan.get("expected_output_counts", {}).items()}
    mismatches = compare_expected_counts(counts, expected)
    state = repository_state if isinstance(repository_state, dict) else {}
    repository_available = (
        isinstance(repository_state, dict)
        and isinstance(state.get("branch"), str)
        and bool(state.get("branch"))
        and isinstance(state.get("sha"), str)
        and bool(state.get("sha"))
    )
    repository_root = plan.get("repository_root", ".")
    dirty_paths = sorted(normalize_summary_path(str(path), repository_root) for path in state.get("dirty_paths", []))
    unexpected = sorted(normalize_summary_path(str(path), repository_root) for path in state.get("unexpected_dirty_paths", []))
    branch_matches = repository_available and state.get("branch") == plan.get("expected_branch")
    sha_matches = repository_available and state.get("sha") == plan.get("expected_sha")
    dirty_evidence = bool(unexpected)
    attempts_pass = bool(attempts) and all(
        attempt["exit_code"] == 0 and not attempt["timed_out"] and not attempt["signal"]
        for attempt in attempts
    )
    passed = all((hash_valid, attempts_pass, not mismatches, not port_conflict, not dirty_evidence, repository_available, branch_matches, sha_matches))
    classification = None
    if not passed:
        last = attempts[-1] if attempts else {}
        classification = classify_failure(
            output,
            exit_code=last.get("exit_code"),
            timed_out=any(attempt["timed_out"] for attempt in attempts),
            port_conflict=port_conflict,
            dirty_evidence=dirty_evidence,
            dependency_mismatch=dependency_mismatch or not branch_matches or not sha_matches,
        ) or "InfrastructureFailure"
        if infrastructure_failure:
            classification = "InfrastructureFailure"
    summary = {
        "summary_version": SUMMARY_VERSION,
        "plan_hash": actual_hash,
        "hash_valid": hash_valid,
        "passed": passed,
        "failure_classification": classification,
        "attempts": attempts,
        "counts": counts,
        "expected_counts": expected,
        "count_mismatches": mismatches,
        "repository": {
            "available": repository_available,
            "branch": state.get("branch"),
            "sha": state.get("sha"),
            "branch_matches": branch_matches,
            "sha_matches": sha_matches,
            "dirty_paths": dirty_paths,
            "unexpected_dirty_paths": unexpected,
        },
        "port_conflict": bool(port_conflict),
    }
    summary["summary_hash"] = compute_summary_hash(summary)
    return summary


def build_summary_from_run_record(record: dict, output: str | None = None) -> dict:
    if not isinstance(record, dict) or record.get("run_record_version") != 1:
        raise ValueError("unsupported run record")
    plan = record.get("plan")
    result = record.get("result")
    if not isinstance(plan, dict) or not isinstance(result, dict):
        raise ValueError("run record must contain plan and result objects")
    if output is None:
        output = ""
        runtime_log = result.get("runtime_log")
        if isinstance(runtime_log, str):
            try:
                output = Path(runtime_log).read_text(encoding="utf-8")
            except (OSError, ValueError):
                output = ""
    return build_summary(
        plan,
        result,
        output,
        repository_state=record.get("repository_state"),
        port_conflict=bool(record.get("port_conflict")),
        dependency_mismatch=bool(record.get("dependency_mismatch")),
        infrastructure_failure=bool(record.get("infrastructure_failure")),
    )


def compute_summary_hash(summary: dict) -> str:
    canonical = deepcopy(summary)
    canonical.pop("summary_hash", None)
    canonical.pop("duration_seconds", None)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def normalize_summary_path(value: str, repository_root: str) -> str:
    """Keep repository paths relative and redact all other absolute paths."""
    normalized = normalize_path(value)
    if _is_absolute(normalized):
        if not _is_absolute(normalize_path(repository_root)):
            return "[ABSOLUTE_PATH]"
        try:
            return repository_relative(normalized, repository_root)
        except ValueError:
            return "[ABSOLUTE_PATH]"
    return normalized


def _is_absolute(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z]:/", value) or value.startswith("/"))
