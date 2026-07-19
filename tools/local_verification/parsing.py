"""Synthetic Vitest/Playwright result parsing and failure classification."""

import re


FAILURE_CLASSIFICATIONS = (
    "AssertionFailure",
    "TestTimeout",
    "HookTimeout",
    "ProcessCrash",
    "PortConflict",
    "DirtyEvidence",
    "DependencyMismatch",
    "InfrastructureFailure",
)

_STATUS_PATTERN = re.compile(
    r"(?P<count>\d+)\s+(?P<status>passed|failed|skipped|todo|flaky|did not run)",
    re.IGNORECASE,
)
_PLAYWRIGHT_LINE = re.compile(
    r"^\s*(?P<count>\d+)\s+(?P<status>passed|failed|skipped|flaky|did not run)"
    r"(?:\s+\([^\r\n]*\))?\s*$",
    re.IGNORECASE,
)


def parse_vitest_counts(output: str) -> dict[str, int]:
    """Parse the final Vitest `Tests` summary line."""
    summary = None
    for line in output.splitlines():
        match = re.match(r"^\s*Tests\s+(.+?)\s*$", _strip_ansi(line), re.IGNORECASE)
        if match:
            summary = match.group(1)
    if summary is None:
        return {}
    counts = _parse_statuses(summary)
    total = re.search(r"\((\d+)\)\s*$", summary)
    counts["total"] = int(total.group(1)) if total else sum(counts.values())
    return counts


def parse_playwright_counts(output: str) -> dict[str, int]:
    """Parse Playwright's trailing one-status-per-line summary."""
    counts: dict[str, int] = {}
    for line in output.splitlines():
        match = _PLAYWRIGHT_LINE.match(_strip_ansi(line))
        if match:
            counts[_key(match.group("status"))] = int(match.group("count"))
    if counts:
        counts["total"] = sum(counts.values())
    return counts


def parse_test_counts(output: str, framework: str | None = None) -> dict[str, int]:
    """Parse counts using an explicit framework or unambiguous output markers."""
    name = framework.lower() if framework else None
    if name == "vitest":
        return parse_vitest_counts(output)
    if name == "playwright":
        return parse_playwright_counts(output)
    vitest = parse_vitest_counts(output)
    if vitest:
        return vitest
    return parse_playwright_counts(output)


def compare_expected_counts(actual: dict[str, int], expected: dict[str, int]) -> dict:
    """Return a stable per-key mismatch map; missing output is never treated as zero."""
    mismatches = {}
    for key in sorted(expected):
        expected_value = int(expected[key])
        actual_value = actual.get(key)
        if actual_value != expected_value:
            mismatches[key] = {"expected": expected_value, "actual": actual_value}
    return mismatches


def classify_failure(
    output: str,
    *,
    exit_code: int | None = None,
    timed_out: bool = False,
    port_conflict: bool = False,
    dirty_evidence: bool = False,
    dependency_mismatch: bool = False,
) -> str | None:
    """Return exactly one supported classification when failure evidence exists."""
    text = _strip_ansi(output)
    lower = text.lower()
    if port_conflict or re.search(r"eaddrinuse|address already in use|port conflict", lower):
        return "PortConflict"
    if dirty_evidence or re.search(r"unexpected dirty|dirty evidence|dirty path", lower):
        return "DirtyEvidence"
    if dependency_mismatch or re.search(
        r"dependency mismatch|lockfile mismatch|node version mismatch|npm version mismatch|"
        r"cannot find (?:module|package)|module not found",
        lower,
    ):
        return "DependencyMismatch"
    if re.search(
        r"(?:beforeall|afterall|beforeeach|aftereach|hook).{0,80}(?:timed out|timeout)",
        lower,
        re.DOTALL,
    ):
        return "HookTimeout"
    if timed_out or re.search(
        r"test timed out|test timeout|timeout of \d+\s*ms exceeded|exceeded the test timeout",
        lower,
    ):
        return "TestTimeout"
    if re.search(
        r"assertionerror|assertion failed|expected(?:.|\n){0,160}received|"
        r"expect\(.+?\)\.(?:to|not\.to)",
        text,
        re.IGNORECASE | re.DOTALL,
    ):
        return "AssertionFailure"
    if (exit_code is not None and (exit_code < 0 or exit_code in (134, 137, 139) or exit_code >= 0x80000000)) or re.search(
        r"segmentation fault|sigsegv|sigabrt|process (?:crashed|was killed)|"
        r"worker process exited unexpectedly|exit code (?:13[4-9]|[2-9]\d{2,})",
        lower,
    ):
        return "ProcessCrash"
    if exit_code not in (None, 0) or timed_out or text.strip():
        return "InfrastructureFailure"
    return None


def infer_framework(argv: list[str]) -> str | None:
    joined = " ".join(argv).lower()
    if "playwright" in joined or any(
        token.lower().startswith("test:e2e") for token in argv
    ):
        return "playwright"
    if "vitest" in joined or "npm test" in joined or "npm run test" in joined:
        return "vitest"
    return None


def is_full_matrix(argv: list[str]) -> bool:
    """Recognize only explicit ungrouped Playwright matrix commands."""
    lowered = [token.lower() for token in argv]
    return any(token == "test:e2e" for token in lowered)


def _parse_statuses(value: str) -> dict[str, int]:
    return {_key(match.group("status")): int(match.group("count")) for match in _STATUS_PATTERN.finditer(value)}


def _key(value: str) -> str:
    return value.lower().replace(" ", "_")


def _strip_ansi(value: str) -> str:
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", value)
