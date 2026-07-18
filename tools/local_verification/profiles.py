"""Explicit versioned machine-profile loading."""

import json
from pathlib import Path


PROFILE_VERSION = 1
PROFILE_NAMES = ("desktop-heavy", "laptop-safe")
PROFILE_KEYS = {
    "profile_version",
    "name",
    "max_concurrent_worktrees",
    "vitest_workers_per_worktree",
    "playwright_workers_per_focused_run",
    "full_matrix_global_concurrency",
    "port_range",
}


def load_profile(name: str, version: int = PROFILE_VERSION) -> dict:
    if name not in PROFILE_NAMES:
        raise ValueError(f"unknown profile: {name}")
    path = Path(__file__).with_name("profiles") / f"{name}.v{version}.json"
    if not path.is_file():
        raise ValueError(f"unsupported profile version: {name} v{version}")
    with path.open(encoding="utf-8") as stream:
        profile = json.load(stream)
    if profile.get("name") != name or profile.get("profile_version") != version:
        raise ValueError(f"invalid profile document: {path.name}")
    if set(profile) != PROFILE_KEYS:
        raise ValueError(f"profile must contain only explicit V1 fields: {path.name}")
    for key in (
        "max_concurrent_worktrees",
        "vitest_workers_per_worktree",
        "playwright_workers_per_focused_run",
        "full_matrix_global_concurrency",
    ):
        if not isinstance(profile[key], int) or isinstance(profile[key], bool) or profile[key] < 1:
            raise ValueError(f"invalid profile value {key}: {path.name}")
    port_range = profile["port_range"]
    if (
        not isinstance(port_range, dict)
        or set(port_range) != {"start", "end"}
        or not all(isinstance(port_range[key], int) and not isinstance(port_range[key], bool) for key in ("start", "end"))
        or not 1 <= port_range["start"] <= port_range["end"] <= 65535
    ):
        raise ValueError(f"invalid profile port_range: {path.name}")
    return profile


def resource_tokens(profile: dict, framework: str | None, full_matrix: bool) -> dict:
    return {
        "profile": profile["name"],
        "max_concurrent_worktrees": profile["max_concurrent_worktrees"],
        "vitest_workers_per_worktree": profile["vitest_workers_per_worktree"],
        "playwright_workers_per_focused_run": profile["playwright_workers_per_focused_run"],
        "full_matrix_global_concurrency": profile["full_matrix_global_concurrency"],
        "framework": framework,
        "full_matrix": bool(full_matrix),
    }
