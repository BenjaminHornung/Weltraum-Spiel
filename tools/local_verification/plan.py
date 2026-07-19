"""Canonical plan construction and identity."""

import hashlib
import json
from copy import deepcopy

from .environment import validate_command_argv, validate_environment
from .parsing import infer_framework, is_full_matrix
from .paths import canonical_relative_path, contains_absolute_path
from .profiles import load_profile, resource_tokens


PLAN_VERSION = 1
REQUIRED_FIELDS = (
    "repository_root", "worktree", "worktree_fingerprint", "expected_branch", "expected_sha",
    "node_version", "npm_version", "command_argv", "environment",
    "working_directory", "timeout_seconds", "resource_tokens", "port",
    "allowed_changed_paths", "expected_output_counts", "cleanup_policy",
)


def _without_identity(plan: dict) -> dict:
    value = deepcopy(plan)
    value.pop("canonical_plan_hash", None)
    value.pop("runtime", None)
    value.pop("machine_data", None)
    return value


def canonical_plan_bytes(plan: dict) -> bytes:
    return json.dumps(
        _without_identity(plan), sort_keys=True, separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def compute_plan_hash(plan: dict) -> str:
    return hashlib.sha256(canonical_plan_bytes(plan)).hexdigest()


def build_plan(**values) -> dict:
    missing = [field for field in REQUIRED_FIELDS if field not in values]
    if missing:
        raise ValueError("missing plan fields: " + ", ".join(missing))
    plan = {"plan_version": PLAN_VERSION, **deepcopy(values)}
    tokens = plan.get("resource_tokens")
    if not isinstance(tokens, dict) or not isinstance(tokens.get("profile"), str):
        raise ValueError("resource_tokens.profile is required")
    plan["command_argv"] = _profile_command(
        load_profile(tokens["profile"]), plan.get("command_argv"), add_missing=True
    )
    plan["repository_root"] = canonical_relative_path(
        plan["repository_root"], "repository_root", root_only=True
    )
    plan["worktree"] = canonical_relative_path(
        plan["worktree"], "worktree", root_only=True
    )
    plan["working_directory"] = canonical_relative_path(
        plan["working_directory"], "working_directory"
    )
    plan["allowed_changed_paths"] = sorted(
        canonical_relative_path(path, "allowed_changed_paths")
        for path in plan["allowed_changed_paths"]
    )
    plan["environment"] = validate_environment(plan["environment"])
    validate_plan(plan)
    plan["canonical_plan_hash"] = compute_plan_hash(plan)
    return plan


def tokens_for_profile(profile: dict, argv: list[str]) -> dict:
    framework = infer_framework(argv)
    return resource_tokens(profile, framework, is_full_matrix(argv))


def validate_plan(plan: dict) -> None:
    if not isinstance(plan, dict):
        raise ValueError("plan must be an object")
    allowed_fields = set(REQUIRED_FIELDS) | {"plan_version", "canonical_plan_hash"}
    unexpected_fields = sorted(set(plan) - allowed_fields)
    if unexpected_fields:
        raise ValueError("unexpected plan fields: " + ", ".join(unexpected_fields))
    if plan.get("plan_version") != PLAN_VERSION:
        raise ValueError(f"plan_version must be {PLAN_VERSION}")
    missing = [field for field in REQUIRED_FIELDS if field not in plan]
    if missing:
        raise ValueError("missing plan fields: " + ", ".join(missing))
    argv = plan["command_argv"]
    if not isinstance(argv, list) or not argv or not all(isinstance(value, str) and value for value in argv):
        raise ValueError("command_argv must be a non-empty string array")
    validate_command_argv(argv)
    fingerprint = plan["worktree_fingerprint"]
    if not isinstance(fingerprint, str) or len(fingerprint) != 64 or any(
        character not in "0123456789abcdef" for character in fingerprint
    ):
        raise ValueError("worktree_fingerprint must be a lowercase SHA-256 value")
    for field in ("expected_branch", "expected_sha"):
        if not isinstance(plan[field], str) or not plan[field].strip():
            raise ValueError(f"{field} must be non-empty")
    for field in ("node_version", "npm_version"):
        if not isinstance(plan[field], str) or not plan[field].strip():
            raise ValueError(f"{field} must be non-empty")
        if contains_absolute_path(plan[field]):
            raise ValueError(f"{field} must not contain an absolute machine path")
    canonical_relative_path(plan["repository_root"], "repository_root", root_only=True)
    canonical_relative_path(plan["worktree"], "worktree", root_only=True)
    canonical_relative_path(plan["working_directory"], "working_directory")
    for path in plan["allowed_changed_paths"]:
        canonical_relative_path(path, "allowed_changed_paths")
    absolute_argument = next((value for value in argv if contains_absolute_path(value)), None)
    if absolute_argument is not None:
        raise ValueError("command_argv must not contain absolute machine paths")
    if not isinstance(plan["timeout_seconds"], (int, float)) or isinstance(plan["timeout_seconds"], bool) or plan["timeout_seconds"] <= 0:
        raise ValueError("timeout_seconds must be positive")
    plan["environment"] = validate_environment(plan["environment"])
    tokens = plan["resource_tokens"]
    if not isinstance(tokens, dict) or not isinstance(tokens.get("profile"), str):
        raise ValueError("resource_tokens.profile is required")
    profile = load_profile(tokens["profile"])
    _profile_command(profile, argv, add_missing=False)
    expected_tokens = tokens_for_profile(profile, argv)
    if tokens != expected_tokens:
        raise ValueError("resource_tokens must exactly match the explicit profile and command workload")
    port = plan["port"]
    port_range = profile["port_range"]
    if port is not None and (
        not isinstance(port, int)
        or isinstance(port, bool)
        or not port_range["start"] <= port <= port_range["end"]
    ):
        raise ValueError(
            f"port must be within profile range {port_range['start']}-{port_range['end']}"
        )
    policy = plan["cleanup_policy"]
    if not isinstance(policy, dict) or policy.get("git") != "dry-run-only":
        raise ValueError("cleanup_policy.git must be dry-run-only")
    if set(policy) - {"git", "retry_count", "diagnostic_retry"}:
        raise ValueError("cleanup_policy contains unsupported fields")
    if policy.get("retry_count", 0) not in (0, 1):
        raise ValueError("retry_count must be 0 or 1")
    if policy.get("diagnostic_retry") not in (None, False, True):
        raise ValueError("diagnostic_retry must be boolean")
    counts = plan["expected_output_counts"]
    if not isinstance(counts, dict) or any(
        not isinstance(key, str)
        or not key
        or contains_absolute_path(key)
        or not isinstance(value, int)
        or isinstance(value, bool)
        or value < 0
        for key, value in counts.items()
    ):
        raise ValueError("expected_output_counts must contain non-negative integer counts")


def _profile_command(profile: dict, argv: list[str], add_missing: bool) -> list[str]:
    if not isinstance(argv, list):
        return argv
    framework = infer_framework(argv)
    full_matrix = is_full_matrix(argv)
    if framework == "vitest":
        option = "--maxWorkers"
        expected = profile["vitest_workers_per_worktree"]
    elif framework == "playwright" and not full_matrix:
        option = "--workers"
        expected = profile["playwright_workers_per_focused_run"]
    else:
        return argv
    observed = _option_values(argv, option)
    if observed:
        if observed != [str(expected)]:
            raise ValueError(f"{option} must equal explicit profile value {expected}")
        return argv
    if not add_missing:
        raise ValueError(f"{option} is required by the explicit profile")
    command = list(argv)
    executable = command[0].replace("\\", "/").rsplit("/", 1)[-1].lower() if command else ""
    if executable in ("npm", "npm.cmd") and "--" not in command:
        command.append("--")
    command.append(f"{option}={expected}")
    return command


def _option_values(argv: list[str], option: str) -> list[str]:
    values = []
    for index, token in enumerate(argv):
        if token == option:
            values.append(argv[index + 1] if index + 1 < len(argv) else "")
        elif token.startswith(option + "="):
            values.append(token.split("=", 1)[1])
    return values
