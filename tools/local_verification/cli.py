"""Command-line surfaces for Task 1 planning and observation."""

import argparse
import json
from pathlib import Path

from .git import (
    inspect_repository,
    require_attached_identity,
    verify_allowed_paths,
    worktree_fingerprint,
    worktree_root,
)
from .environment import is_environment_key, validate_environment
from .plan import build_plan, tokens_for_profile
from .profiles import PROFILE_NAMES, load_profile
from .runner import execute_plan, record_plan_load_failure
from .status import status_details, status_markdown


class _SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError("invalid command line") from None


def parser() -> argparse.ArgumentParser:
    root = _SafeArgumentParser(prog="python -m tools.local_verification")
    commands = root.add_subparsers(
        dest="command", required=True, parser_class=_SafeArgumentParser
    )
    status = commands.add_parser("status", help="inspect repository state")
    status.add_argument("--repository", default=".")
    status.add_argument("--format", choices=("json", "markdown"), default="json")

    plan = commands.add_parser("plan", help="construct a canonical plan")
    plan.add_argument("--profile", choices=PROFILE_NAMES, required=True)
    plan.add_argument("--repository", default=".")
    plan.add_argument("--worktree", default=".")
    plan.add_argument("--branch", required=True)
    plan.add_argument("--sha", required=True)
    plan.add_argument("--node-version", required=True)
    plan.add_argument("--npm-version", required=True)
    plan.add_argument("--cwd", default=".")
    plan.add_argument("--timeout", type=float, required=True)
    plan.add_argument("--port", type=int)
    plan.add_argument("--allow-path", action="append", default=[])
    plan.add_argument("--env", action="append", default=[])
    plan.add_argument("--host-env", action="append", default=[])
    plan.add_argument("--expected-count", action="append", default=[])
    plan.add_argument("argv", nargs=argparse.REMAINDER)

    verify = commands.add_parser("verify-git", help="verify branch, SHA, and dirty paths")
    verify.add_argument("--repository", default=".")
    verify.add_argument("--branch")
    verify.add_argument("--sha")
    verify.add_argument("--allow-path", action="append", default=[])

    summarize = commands.add_parser("summarize", help="summarize an actual run record")
    summarize.add_argument("--run", required=True, dest="run_file")

    run = commands.add_parser("run", help="execute an approved canonical plan")
    run.add_argument("--plan", required=True, dest="plan_file")
    return root


def _pairs(items: list[str], value_type=str, key_validator=None) -> dict:
    result = {}
    for index, item in enumerate(items, start=1):
        if "=" not in item:
            raise ValueError(f"expected KEY=VALUE at entry {index}")
        key, value = item.split("=", 1)
        if key_validator is not None and not key_validator(key):
            raise ValueError(f"invalid key at entry {index}")
        try:
            result[key] = value_type(value)
        except (TypeError, ValueError):
            raise ValueError(f"invalid value at entry {index}") from None
    return result


def _print(value: dict) -> None:
    print(json.dumps(value, sort_keys=True, indent=2))


def _environment(literals: list[str], references: list[str]) -> dict:
    environment = _pairs(literals, key_validator=is_environment_key)
    for index, item in enumerate(references, start=1):
        target, source = item.split("=", 1) if "=" in item else (item, item)
        if not is_environment_key(target) or not is_environment_key(source):
            raise ValueError(f"invalid host-env reference at entry {index}")
        if target in environment:
            raise ValueError(f"duplicate environment key: {target}")
        environment[target] = {"source": "host-env", "key": source}
    return validate_environment(environment)


def _canonical_target(repository: str, worktree: str, working_directory: str, branch: str, sha: str):
    repository_root = worktree_root(repository)
    target_root = worktree_root(worktree)
    if not repository_root.samefile(target_root):
        raise ValueError("repository and worktree must be the same actual Git worktree")
    require_attached_identity(target_root, branch, sha)
    requested_cwd = Path(working_directory)
    actual_cwd = (target_root / requested_cwd).resolve() if not requested_cwd.is_absolute() else requested_cwd.resolve()
    if not actual_cwd.is_dir() or not worktree_root(actual_cwd).samefile(target_root):
        raise ValueError("working directory must belong to the selected Git worktree")
    try:
        relative_cwd = actual_cwd.relative_to(target_root).as_posix() or "."
    except ValueError as error:
        raise ValueError("working directory must be inside the selected Git worktree") from error
    return ".", ".", worktree_fingerprint(target_root), relative_cwd


def _dispatch(argv=None) -> int:
    args = parser().parse_args(argv)
    if args.command == "status":
        state = status_details(args.repository)
        if args.format == "markdown":
            print(status_markdown(state))
        else:
            _print(state)
        return 0
    if args.command == "plan":
        profile = load_profile(args.profile)
        repository_root, worktree, fingerprint, working_directory = _canonical_target(
            args.repository, args.worktree, args.cwd, args.branch, args.sha
        )
        plan = build_plan(
            repository_root=repository_root, worktree=worktree,
            worktree_fingerprint=fingerprint,
            expected_branch=args.branch, expected_sha=args.sha,
            node_version=args.node_version, npm_version=args.npm_version,
            command_argv=args.argv, environment=_environment(args.env, args.host_env),
            working_directory=working_directory, timeout_seconds=args.timeout,
            resource_tokens=tokens_for_profile(profile, args.argv),
            port=args.port, allowed_changed_paths=args.allow_path,
            expected_output_counts=_pairs(args.expected_count, int),
            cleanup_policy={"git": "dry-run-only", "retry_count": 0},
        )
        _print(plan)
        return 0
    if args.command == "verify-git":
        state = inspect_repository(args.repository)
        unexpected = verify_allowed_paths(state["dirty_paths"], args.allow_path)
        mismatches = []
        if not state["branch"] or not state["sha"]:
            mismatches.append("identity")
        if args.branch and state["branch"] != args.branch:
            mismatches.append("branch")
        if args.sha and state["sha"] != args.sha:
            mismatches.append("sha")
        _print({**state, "unexpected_dirty_paths": unexpected, "mismatches": mismatches, "ok": not unexpected and not mismatches})
        return 0 if not unexpected and not mismatches else 1
    if args.command == "summarize":
        from .summary import build_summary_from_run_record

        record = json.loads(Path(args.run_file).read_text(encoding="utf-8"))
        summary = build_summary_from_run_record(record)
        _print(summary)
        return 0 if summary["passed"] else 1
    if args.command == "run":
        plan_loaded = False
        try:
            plan = json.loads(Path(args.plan_file).read_text(encoding="utf-8"))
            plan_loaded = True
            result = execute_plan(plan)
        except (OSError, RuntimeError, ValueError) as error:
            if not plan_loaded:
                record_plan_load_failure()
            raise error from None
        _print({"ok": result["summary"]["passed"], **result})
        if result["signal"]:
            return 130
        return 0 if result["summary"]["passed"] else 1
    raise AssertionError(args.command)


def main(argv=None) -> int:
    try:
        return _dispatch(argv)
    except KeyboardInterrupt:
        _print({"ok": False, "error": "operation interrupted"})
        return 130
    except (OSError, RuntimeError, ValueError):
        _print({"ok": False, "error": "operation failed"})
        return 2
