"""Host-independent canonical path handling."""

import ntpath
import posixpath
import re


def normalize_path(value: str) -> str:
    """Return a slash-separated lexical path for Windows or POSIX input."""
    if not isinstance(value, str) or not value:
        raise ValueError("path must be a non-empty string")
    path = value.replace("\\", "/")
    normalized = posixpath.normpath(path)
    if normalized == ".":
        return "."
    drive, tail = ntpath.splitdrive(normalized)
    if drive:
        drive = drive.rstrip(":").lower() + ":"
        normalized = drive + tail
    return normalized.rstrip("/") or "/"


def is_absolute_path(value: str) -> bool:
    normalized = value.replace("\\", "/") if isinstance(value, str) else ""
    return bool(re.match(r"^[A-Za-z]:/", normalized) or normalized.startswith("/"))


def contains_absolute_path(value: str) -> bool:
    if not isinstance(value, str):
        return False
    return bool(
        re.search(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]", value)
        or re.search(r"(?:^|[\s='\"])/", value)
    )


def canonical_relative_path(value: str, field: str, *, root_only: bool = False) -> str:
    """Validate a portable repository-relative canonical path."""
    normalized = normalize_path(value)
    if is_absolute_path(normalized) or normalized == ".." or normalized.startswith("../"):
        raise ValueError(f"{field} must be repository-relative")
    if root_only and normalized != ".":
        raise ValueError(f"{field} must identify the invocation worktree as '.'")
    return normalized


def repository_relative(value: str, repository_root: str) -> str:
    """Relativize lexical paths using semantics inferred from their spelling."""
    value_n = normalize_path(value)
    root_n = normalize_path(repository_root)
    windows = bool(ntpath.splitdrive(value_n)[0] or ntpath.splitdrive(root_n)[0])
    module = ntpath if windows else posixpath
    try:
        relative = module.relpath(value_n, root_n).replace("\\", "/")
    except ValueError as error:
        raise ValueError("path is not on the repository root volume") from error
    if relative == ".." or relative.startswith("../"):
        raise ValueError("path is outside repository root")
    return normalize_path(relative)
