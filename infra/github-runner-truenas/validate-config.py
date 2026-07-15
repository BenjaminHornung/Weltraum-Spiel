#!/usr/bin/env python3
"""Fail-closed validation for the persistent TrueNAS browser runner contract."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover - environment preflight
    raise SystemExit(
        "PyYAML is required in the validation environment; do not install it in the repository."
    ) from exc


ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT / "infra" / "github-runner-truenas"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "browser-mainline-ci.yml"
COMPOSE_PATH = INFRA / "compose.yaml"
DOCKERFILE_PATH = INFRA / "Dockerfile"
ENV_EXAMPLE_PATH = INFRA / ".env.example"
README_PATH = INFRA / "README.md"
OPERATIONS_PATH = ROOT / "docs" / "operations" / "truenas-self-hosted-github-runner.md"

failures: list[str] = []
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        failures.append(message)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class GitHubActionsLoader(yaml.SafeLoader):
    """YAML 1.2-like booleans so the GitHub `on` key stays a string."""


GitHubActionsLoader.yaml_implicit_resolvers = {
    key: [
        (tag, pattern)
        for tag, pattern in resolvers
        if tag != "tag:yaml.org,2002:bool"
    ]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
GitHubActionsLoader.add_implicit_resolver(
    "tag:yaml.org,2002:bool",
    re.compile(r"^(?:true|false)$", re.IGNORECASE),
    list("tTfF"),
)

workflow_text = read(WORKFLOW_PATH)
compose_text = read(COMPOSE_PATH)
dockerfile_text = read(DOCKERFILE_PATH)
env_example_text = read(ENV_EXAMPLE_PATH)
readme_text = read(README_PATH)
operations_text = read(OPERATIONS_PATH)

try:
    workflow = yaml.load(workflow_text, Loader=GitHubActionsLoader)
    check(isinstance(workflow, dict), "Workflow YAML must parse to a mapping")
except Exception as exc:  # noqa: BLE001 - collect all validation errors
    workflow = {}
    failures.append(f"Workflow YAML parse failed: {exc}")

try:
    compose = yaml.safe_load(compose_text)
    check(isinstance(compose, dict), "Compose YAML must parse to a mapping")
except Exception as exc:  # noqa: BLE001
    compose = {}
    failures.append(f"Compose YAML parse failed: {exc}")

for json_path in sorted(INFRA.glob("*.json")):
    try:
        json.loads(read(json_path))
        check(True, f"JSON must parse: {json_path.relative_to(ROOT)}")
    except Exception as exc:  # noqa: BLE001
        failures.append(f"JSON parse failed for {json_path.relative_to(ROOT)}: {exc}")

bash = shutil.which("bash")
if not bash and sys.platform == "win32":
    windows_bash = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "bin" / "bash.exe"
    if windows_bash.is_file():
        bash = str(windows_bash)
check(bool(bash), "bash must be available for shell syntax validation")
if bash:
    for shell_path in sorted(INFRA.glob("*.sh")):
        relative = shell_path.relative_to(ROOT).as_posix()
        result = subprocess.run(
            [bash, "-n", relative],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        check(
            result.returncode == 0,
            f"bash -n failed for {relative}: {result.stderr.strip()}",
        )

triggers = workflow.get("on", {}) if isinstance(workflow, dict) else {}
check(isinstance(triggers, dict), "Workflow on: must be a mapping")
if isinstance(triggers, dict):
    check(
        set(triggers) == {"push", "repository_dispatch"},
        "Only push and repository_dispatch triggers are permitted",
    )
    for forbidden in (
        "pull_request",
        "pull_request_target",
        "workflow_dispatch",
        "workflow_call",
        "issue_comment",
    ):
        check(forbidden not in triggers, f"Forbidden workflow trigger present: {forbidden}")

    push = triggers.get("push", {})
    expected_paths = [
        "apps/weltraum-browser/**",
        ".gitattributes",
        ".github/workflows/browser-mainline-ci.yml",
        "infra/github-runner-truenas/**",
        "docs/operations/truenas-self-hosted-github-runner.md",
        "docs/browser-mainline/**",
        ".devtoolbox/specs/changes/browser-*/**",
    ]
    check(push.get("branches") == ["main"], "push must target main only")
    check(push.get("paths") == expected_paths, "push path allowlist drifted")
    dispatch = triggers.get("repository_dispatch", {})
    check(
        dispatch.get("types") == ["browser-mainline-ci"],
        "repository_dispatch must allow only browser-mainline-ci",
    )

jobs = workflow.get("jobs", {}) if isinstance(workflow, dict) else {}
check(isinstance(jobs, dict), "Workflow jobs must be a mapping")
if isinstance(jobs, dict):
    check(set(jobs) == {"browser-mainline"}, "Browser workflow must contain exactly one expected job")
job = jobs.get("browser-mainline", {}) if isinstance(jobs, dict) else {}
check(bool(job), "browser-mainline job is missing")
expected_guard = (
    "(github.event_name == 'push' && github.ref == 'refs/heads/main') || "
    "(github.event_name == 'repository_dispatch' && github.ref == 'refs/heads/main')"
)
actual_guard = " ".join(str(job.get("if", "")).split())
check(actual_guard == expected_guard, "Job event/ref guard is not the exact fail-closed policy")
check(
    job.get("runs-on") == ["self-hosted", "linux", "x64", "weltraum-browser"],
    "Self-hosted runner labels drifted",
)
check(job.get("timeout-minutes") == 45, "Browser job timeout must remain 45 minutes")

steps = job.get("steps", []) if isinstance(job, dict) else []
check(isinstance(steps, list), "Workflow steps must be a list")
checkout_steps = [step for step in steps if str(step.get("uses", "")).startswith("actions/checkout@")]
check(len(checkout_steps) == 1, "Exactly one actions/checkout step is required")
if len(checkout_steps) == 1:
    checkout_with = checkout_steps[0].get("with", {}) or {}
    check("ref" not in checkout_with, "Checkout must not accept or set a ref")
    check(checkout_with.get("fetch-depth") == 0, "Checkout must fetch full history for ancestry proof")
    check(checkout_with.get("lfs") is False, "Selective LFS behavior must remain enabled")

step_by_name = {step.get("name"): step for step in steps if isinstance(step, dict)}
verify_step = step_by_name.get("Verify protected main checkout", {})
check(bool(verify_step), "Protected main checkout verification step is missing")
if verify_step:
    verify_env = verify_step.get("env", {}) or {}
    verify_script = str(verify_step.get("run", ""))
    check(verify_step.get("working-directory") == ".", "Checkout verification must run at repository root")
    check(verify_env.get("EVENT_NAME") == "${{ github.event_name }}", "EVENT_NAME must come from GitHub context")
    check(verify_env.get("EXPECTED_REF") == "${{ github.ref }}", "EXPECTED_REF must come from GitHub context")
    check(verify_env.get("EXPECTED_SHA") == "${{ github.sha }}", "EXPECTED_SHA must come from GitHub context")
    for token in (
        "push|repository_dispatch",
        '"refs/heads/main"',
        'actual_head="$(git rev-parse HEAD)"',
        "+refs/heads/main:refs/remotes/origin/main",
        'git merge-base --is-ancestor "${EXPECTED_SHA}" refs/remotes/origin/main',
        '"${EVENT_NAME}" == "repository_dispatch"',
        '"${main_head}" != "${EXPECTED_SHA}"',
    ):
        check(token in verify_script, f"Checkout verification is missing: {token}")
    verify_index = steps.index(verify_step)
    checkout_index = steps.index(checkout_steps[0]) if len(checkout_steps) == 1 else -1
    check(checkout_index == 0, "Checkout must be the first workflow step")
    check(verify_index == 1, "Checkout verification must be the immediate second workflow step")
    check(
        steps[:verify_index] == checkout_steps,
        "No run or action step may execute between checkout and protected-main verification",
    )

for forbidden_text in (
    "client_payload",
    "head_ref",
    "refs/pull/",
    "github.event.pull_request",
    "workflow_dispatch",
    "pull_request_target",
):
    check(forbidden_text not in workflow_text, f"Forbidden ref/event input appears in workflow: {forbidden_text}")
check("secrets." not in workflow_text.casefold(), "Browser workflow must not consume repository secrets")
check("github.token" not in workflow_text.casefold(), "Browser workflow must not consume github.token")

runner_route_labels = {"self-hosted", "linux", "x64", "weltraum-browser", "truenas"}
for candidate_path in sorted((ROOT / ".github" / "workflows").glob("*.y*ml")):
    try:
        candidate_workflow = yaml.load(read(candidate_path), Loader=GitHubActionsLoader)
    except Exception as exc:  # noqa: BLE001
        failures.append(f"Workflow YAML parse failed for {candidate_path.relative_to(ROOT)}: {exc}")
        continue
    candidate_jobs = candidate_workflow.get("jobs", {}) if isinstance(candidate_workflow, dict) else {}
    check(
        isinstance(candidate_jobs, dict),
        f"Workflow jobs must be a mapping: {candidate_path.relative_to(ROOT)}",
    )
    if not isinstance(candidate_jobs, dict):
        continue
    for candidate_job_id, candidate_job in candidate_jobs.items():
        if not isinstance(candidate_job, dict) or "runs-on" not in candidate_job:
            continue
        runs_on = candidate_job.get("runs-on")
        if isinstance(runs_on, str):
            route_values = [runs_on]
        elif isinstance(runs_on, list) and all(isinstance(value, str) for value in runs_on):
            route_values = runs_on
        else:
            route_values = []
            check(
                False,
                f"runs-on must use literal string labels: {candidate_path.relative_to(ROOT)}:{candidate_job_id}",
            )
        check(
            all("${{" not in value for value in route_values),
            f"Dynamic runs-on expressions are forbidden: {candidate_path.relative_to(ROOT)}:{candidate_job_id}",
        )
        normalized_routes = {value.casefold() for value in route_values}
        selects_runner = bool(normalized_routes & runner_route_labels)
        is_allowed_job = candidate_path == WORKFLOW_PATH and candidate_job_id == "browser-mainline"
        check(
            not selects_runner or is_allowed_job,
            f"Runner label route outside protected job: {candidate_path.relative_to(ROOT)}:{candidate_job_id}",
        )

services = compose.get("services", {}) if isinstance(compose, dict) else {}
runner = services.get("runner", {}) if isinstance(services, dict) else {}
check(bool(runner), "Compose runner service is missing")
check(runner.get("user") == "1000:1000", "Runner must use UID/GID 1000:1000")
check(runner.get("privileged", False) is False, "privileged mode is forbidden")
check(runner.get("network_mode") != "host", "Host networking is forbidden")
check(not runner.get("ports"), "Published ports are forbidden")
check(not runner.get("expose"), "Exposed ports are forbidden")
check(runner.get("cap_drop") == ["ALL"], "All Linux capabilities must be dropped")
security_opt = runner.get("security_opt", []) or []
check("no-new-privileges:true" in security_opt, "no-new-privileges must be enabled")
check(any(str(value).startswith("seccomp=") for value in security_opt), "Pinned seccomp profile must be configured")

volumes = runner.get("volumes", []) or []
expected_mounts = {
    ("/mnt/Storage/apps/github-runner-weltraum/state", "/runner-state", False),
    ("/mnt/Storage/apps/github-runner-weltraum/work", "/runner-state/_work", False),
    ("/mnt/Storage/apps/github-runner-weltraum/npm-cache", "/home/runner/.npm", False),
    ("/mnt/Storage/apps/github-runner-weltraum/logs", "/runner-state/_diag", False),
    (
        "/mnt/Storage/apps/github-runner-weltraum/secrets/runner-registration-token",
        "/run/secrets/runner-registration-token",
        True,
    ),
}
actual_mounts = {
    (volume.get("source"), volume.get("target"), bool(volume.get("read_only", False)))
    for volume in volumes
    if isinstance(volume, dict)
}
check(actual_mounts == expected_mounts, "Compose mount contract drifted")
check("/var/run/docker.sock" not in compose_text, "Docker socket mount is forbidden")
for forbidden_source in ("/mnt", "/mnt/Storage", "/etc", "/root", "/home"):
    check(
        all(volume.get("source") != forbidden_source for volume in volumes),
        f"Forbidden broad host mount present: {forbidden_source}",
    )

environment = runner.get("environment", {}) or {}
check(environment.get("RUNNER_NAME") == "truenas-weltraum-browser-01", "Runner name drifted")
check(environment.get("RUNNER_LABELS") == "weltraum-browser,truenas", "Runner labels drifted")
check(environment.get("RUNNER_TOOL_CACHE") == "/runner-state/_tool", "Runner toolcache path drifted")
check(environment.get("npm_config_cache") == "/home/runner/.npm", "npm cache path drifted")
check(environment.get("PLAYWRIGHT_BROWSERS_PATH") == "/ms-playwright", "Playwright path drifted")
check(
    environment.get("RUNNER_REGISTRATION_TOKEN_FILE") == "/run/secrets/runner-registration-token",
    "Registration token must be file-backed",
)
for key, value in environment.items():
    normalized_key = str(key).upper()
    if "TOKEN" in normalized_key:
        check(normalized_key.endswith("_FILE"), f"Token environment key must identify a file, not a value: {key}")
        check(str(value).startswith("/run/secrets/"), f"Token file must be under /run/secrets: {key}")
    elif any(sensitive in normalized_key for sensitive in ("PASSWORD", "CREDENTIAL", "SECRET")):
        check(value in (None, ""), f"Sensitive environment value is forbidden: {key}")

check(environment.get("ACTIONS_RUNNER_HOOK_JOB_STARTED") == "/opt/runner-hooks/job-started.sh", "Job-start hook path drifted")
check(environment.get("ACTIONS_RUNNER_HOOK_JOB_COMPLETED") == "/opt/runner-hooks/job-completed.sh", "Job-completed hook path drifted")
check(
    "COPY --chmod=0555 cleanup-workspace.sh job-started.sh job-completed.sh /opt/runner-hooks/"
    in dockerfile_text,
    "Runner hook COPY contract drifted",
)
job_started_bytes = (INFRA / "job-started.sh").read_bytes()
check(b"\r" not in job_started_bytes, "Runner-wide job-start hook must use LF line endings")
try:
    job_started_text = job_started_bytes.decode("utf-8")
except UnicodeDecodeError as exc:
    failures.append(f"Runner-wide job-start hook is not UTF-8: {exc}")
    job_started_text = ""
expected_job_started_sha256 = "ed49cd56c97c5c362d89638755963b4c76dfcca01fa2ca2c7723172fc3703f3a"
check(
    hashlib.sha256(job_started_bytes).hexdigest() == expected_job_started_sha256,
    "Runner-wide job-start hook content digest drifted",
)
for snippet in (
    'readonly expected_repository="BenjaminHornung/Weltraum-Spiel"',
    'readonly expected_ref="refs/heads/main"',
    'readonly expected_workflow_ref="BenjaminHornung/Weltraum-Spiel/.github/workflows/browser-mainline-ci.yml@refs/heads/main"',
    "GITHUB_REF_PROTECTED",
    "GITHUB_WORKFLOW_REF",
    "GITHUB_WORKFLOW_SHA",
    'push|repository_dispatch',
    '.repository.full_name == $repository',
    '.action == "browser-mainline-ci"',
    '.client_payload == null',
):
    check(snippet in job_started_text, f"Runner-wide job-start trust gate is missing: {snippet}")
marker_write = "printf 'started_at=%s\\n'"
check(job_started_text.count(marker_write) == 1, "Job marker write contract drifted")
check(
    job_started_text.find(marker_write) > job_started_text.find('.action == "browser-mainline-ci"'),
    "Job marker must be written only after every runner-wide trust check",
)

values: dict[str, str] = {}
for line in env_example_text.splitlines():
    stripped = line.strip()
    if stripped and not stripped.startswith("#") and "=" in stripped:
        key, value = stripped.split("=", 1)
        values[key] = value
expected_versions = {
    "PLAYWRIGHT_VERSION": "1.61.1",
    "ACTIONS_RUNNER_VERSION": "2.335.1",
    "NODE_VERSION": "22.23.1",
}
for key, expected in expected_versions.items():
    check(values.get(key) == expected, f"Pinned {key} must remain {expected}")

base_match = re.search(
    r"ARG PLAYWRIGHT_IMAGE=mcr\.microsoft\.com/playwright:v1\.61\.1-noble@sha256:([0-9a-f]{64})",
    dockerfile_text,
)
check(bool(base_match), "Playwright Noble base image must be digest-pinned")
check("ARG NODE_VERSION=22.23.1" in dockerfile_text, "Dockerfile Node version drifted")
check("ARG ACTIONS_RUNNER_VERSION=2.335.1" in dockerfile_text, "Dockerfile runner version drifted")
check("USER 1000:1000" in dockerfile_text, "Final Dockerfile user must be 1000:1000")
build_args = runner.get("build", {}).get("args", {}) if isinstance(runner.get("build"), dict) else {}
check(str(build_args.get("NODE_VERSION")) == "22.23.1", "Compose Node build arg drifted")
check(str(build_args.get("ACTIONS_RUNNER_VERSION")) == "2.335.1", "Compose runner build arg drifted")
check("v1.61.1-noble@sha256:" in str(build_args.get("PLAYWRIGHT_IMAGE", "")), "Compose Playwright digest pin is missing")
if base_match:
    digest = base_match.group(1)
    check(digest in str(build_args.get("PLAYWRIGHT_IMAGE")), "Dockerfile and Compose base digests differ")
    check(digest in operations_text, "Operations documentation base digest drifted")

for version in ("1.61.1", "2.335.1", "22.23.1"):
    check(version in readme_text, f"README is missing pinned version {version}")
    check(version in operations_text, f"Operations documentation is missing pinned version {version}")

cleanup_text = read(INFRA / "cleanup-workspace.sh")
check('readonly expected_work_root="/runner-state/_work"' in cleanup_text, "Cleanup work root drifted")
expected_delete = 'find "${actual_work_root}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
check(expected_delete in cleanup_text, "Cleanup must delete only first-level entries under resolved _work")
check(cleanup_text.count("rm -rf") == 1, "Cleanup contains an unexpected recursive delete")
for shell_path in sorted(INFRA.glob("*.sh")):
    if shell_path.name != "cleanup-workspace.sh":
        check("rm -rf" not in read(shell_path), f"Unexpected recursive delete in {shell_path.name}")
check('rm -f -- "${marker}"' in cleanup_text, "Cleanup marker removal drifted")
check("/runner-state/.credentials" not in cleanup_text, "Cleanup must never target runner credentials")

required_operations = (
    "## Aktuelle Trust Boundary",
    "PR-Heads",
    "## PR-Verifikation",
    "## Sicherer manueller Lauf",
    "-f event_type=browser-mainline-ci",
    "Kein client_payload mitsenden",
    "## Spätere PR-fähige Lösung",
    "frische Runner-Registrierung pro Job",
    "Runner mit --ephemeral",
    "vollständige Vernichtung nach Jobende",
    "Secret-Broker außerhalb des Job-Containers",
    "Das Löschen von _work allein ist ausdrücklich nicht ephemeral",
    "protected=false",
    "ACTIONS_RUNNER_HOOK_JOB_STARTED",
    "## Aktivierungsbedingungen nach diesem Fix",
    "Runner-Credentials rotiert",
)
for snippet in required_operations:
    check(snippet in operations_text, f"Operations documentation is missing: {snippet}")
check(
    "Pull-Request-Workflow läuft auf diesem Runner vollständig grün" not in operations_text,
    "Operations documentation still claims persistent PR execution",
)
for snippet in (
    "## Execution trust boundary",
    "not a sandbox",
    "repository_dispatch with the fixed type browser-mainline-ci",
    "## Repository validation",
    "cleanup is not ephemeral isolation",
    "## Activation prerequisite",
    "runner-wide check",
):
    check(snippet in readme_text, f"README is missing: {snippet}")

sensitive_assignment_pattern = re.compile(
    r"(?im)^\s*(?:-\s*)?[a-z0-9_]*(?:token|password|credential|secret)[a-z0-9_]*"
    r"\s*[:=]\s*[\"']?(?!\$\(|\$\{|\{\{|/run/secrets/)[a-z0-9._-]{16,}"
)
for unsafe_assignment in (
    "runner_token=abcdefghijklmnopqrstuvwxyz123456",
    "myPassword: abcdefghijklmnopqrstuvwxyz123456",
    "credentialValue=abcdefghijklmnopqrstuvwxyz123456",
):
    check(
        bool(sensitive_assignment_pattern.search(unsafe_assignment)),
        f"Sensitive-assignment detector missed fixture: {unsafe_assignment.split(':', 1)[0].split('=', 1)[0]}",
    )
for safe_assignment in (
    'RUNNER_REGISTRATION_TOKEN_FILE: /run/secrets/runner-registration-token',
    'registration_token="$(<\"${token_file}\")"',
    'invalidToken: "||"',
):
    check(
        not sensitive_assignment_pattern.search(safe_assignment),
        "Sensitive-assignment detector rejected a safe reference fixture",
    )

secret_patterns = {
    "GitHub token": re.compile(r"(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})"),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "authorization value": re.compile(r"Authorization:\s*(?:Bearer|token)\s+[A-Za-z0-9._-]{16,}", re.I),
    "literal sensitive assignment": sensitive_assignment_pattern,
}
scan_paths = [WORKFLOW_PATH, OPERATIONS_PATH, *sorted(path for path in INFRA.rglob("*") if path.is_file())]
for scan_path in scan_paths:
    if scan_path.suffix in {".gz", ".zip", ".pyc"} or "__pycache__" in scan_path.parts:
        continue
    text = read(scan_path)
    for label, pattern in secret_patterns.items():
        check(not pattern.search(text), f"Potential {label} in {scan_path.relative_to(ROOT)}")

tracked = subprocess.run(
    ["git", "ls-files", "infra/github-runner-truenas"],
    cwd=ROOT,
    capture_output=True,
    text=True,
    check=True,
).stdout.splitlines()
for tracked_path in tracked:
    name = Path(tracked_path).name
    check(name != ".env", "A real .env file is tracked")
    check(not name.endswith(".token"), f"Token file is tracked: {tracked_path}")
    check(not name.startswith("actions-runner-linux-x64-") or not name.endswith(".tar.gz"), f"Runner archive is tracked: {tracked_path}")

if failures:
    for failure in failures:
        print(f"ERROR: {failure}", file=sys.stderr)
    print(f"Validation failed: {len(failures)} finding(s), {checks} checks.", file=sys.stderr)
    raise SystemExit(1)

print(f"Validated persistent TrueNAS runner contract: {checks} checks passed.")
