"""Strictly observational Git inspection."""

import fnmatch
import hashlib
import json
import os
import subprocess
from pathlib import Path

from .paths import normalize_path


def _git(root: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(Path(root)), *args], check=check,
        capture_output=True, text=True, encoding="utf-8",
    )


def dirty_paths(root: str) -> list[str]:
    output = _git(
        root, "status", "--porcelain=v1", "-z", "--untracked-files=all"
    ).stdout
    paths = []
    records = output.split("\0")
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record:
            continue
        destination = record[3:]
        paths.append(normalize_path(destination))
        if any(status in ("R", "C") for status in record[:2]) and index < len(records):
            source = records[index]
            index += 1
            if source:
                paths.append(normalize_path(source))
    return sorted(set(paths))


def worktree_root(path: str | Path) -> Path:
    output = _git(str(path), "rev-parse", "--show-toplevel").stdout.strip()
    if not output:
        raise ValueError("Git worktree root is unavailable")
    return Path(output).resolve()


def worktree_fingerprint(path: str | Path) -> str:
    """Return an opaque binding for one concrete local worktree instance."""
    root = worktree_root(path)
    git_directory = _git(str(root), "rev-parse", "--absolute-git-dir").stdout.strip()
    if not git_directory:
        raise ValueError("Git worktree-local identity is unavailable")
    identities = (_filesystem_identity(root), _filesystem_identity(Path(git_directory)))
    canonical = json.dumps(
        ["local-worktree-v2", *identities], separators=(",", ":")
    ).encode("ascii")
    return hashlib.sha256(canonical).hexdigest()


def _filesystem_identity(path: str | Path) -> list[int]:
    try:
        state = os.stat(path, follow_symlinks=True)
        device = int(state.st_dev)
        file_index = int(state.st_ino)
    except (AttributeError, OSError, TypeError, ValueError):
        raise ValueError("local worktree filesystem identity is unavailable") from None
    if device <= 0 or file_index <= 0:
        raise ValueError("local worktree filesystem identity is unavailable")
    return [device, file_index]


def inspect_repository(root: str) -> dict:
    branch = _git(root, "branch", "--show-current").stdout.strip()
    sha = _git(root, "rev-parse", "HEAD").stdout.strip()
    upstream = _git(
        root, "rev-list", "--left-right", "--count", "@{upstream}...HEAD",
        check=False,
    )
    ahead = behind = None
    if upstream.returncode == 0:
        behind, ahead = (int(value) for value in upstream.stdout.split())
    return {
        "branch": branch, "sha": sha, "dirty_paths": dirty_paths(root),
        "ahead": ahead, "behind": behind,
    }


def require_attached_identity(root: str | Path, branch: str, sha: str) -> dict:
    state = inspect_repository(str(root))
    if not state["branch"]:
        raise ValueError("detached HEAD is not a valid execution identity")
    if not branch or not sha:
        raise ValueError("expected branch and SHA must be non-empty")
    mismatches = []
    if state["branch"] != branch:
        mismatches.append("branch")
    if state["sha"] != sha:
        mismatches.append("sha")
    if mismatches:
        raise ValueError("Git execution identity mismatch: " + ", ".join(mismatches))
    return state


def verify_allowed_paths(paths: list[str], allowed: list[str]) -> list[str]:
    normalized_allowed = [normalize_path(item).rstrip("/") for item in allowed]
    unexpected = []
    for path in paths:
        path_n = normalize_path(path)
        accepted = any(
            path_n == rule or path_n.startswith(rule + "/") or fnmatch.fnmatchcase(path_n, rule)
            for rule in normalized_allowed
        )
        if not accepted:
            unexpected.append(path_n)
    return sorted(unexpected)
