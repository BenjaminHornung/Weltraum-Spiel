"""Complete read-only local orchestrator status reporting."""

import json
import os
import tempfile
from pathlib import Path

from .git import inspect_repository
from .process_control import process_identity_matches


def state_directory() -> Path:
    return Path(
        os.environ.get(
            "LOCAL_VERIFICATION_STATE_DIR",
            Path(tempfile.gettempdir()) / "weltraum-local-verification",
        )
    )


def status_details(repository: str, state_root: str | Path | None = None) -> dict:
    state = inspect_repository(repository)
    root = Path(state_root) if state_root is not None else state_directory()
    running, stale_running = _owned_documents(root / "running", root, "running")
    reservations, stale_reservations = _reservation_documents(root / "reservations", root)
    stale = stale_running + stale_reservations
    state.update(
        {
            "devtoolbox_changes": _devtoolbox_changes(Path(repository)),
            "running_owned_runs": running,
            "live_reservations": reservations,
            "reserved_ports": _reserved_ports(reservations),
            "stale_state": stale,
            "cleanup_plan": {
                "mode": "dry-run-only",
                "actions": [
                    {"action": "remove-stale-state", "state_path": item["state_path"]}
                    for item in stale
                ],
            },
            "latest_local_summary": _read_json(root / "latest-summary.json"),
        }
    )
    return state


def status_markdown(state: dict) -> str:
    dirty = state["dirty_paths"] or ["(none)"]
    changes = state["devtoolbox_changes"] or ["(none)"]
    upstream = "unavailable" if state["ahead"] is None else f"{state['ahead']}/{state['behind']}"
    latest = state.get("latest_local_summary")
    latest_text = "(none)" if latest is None else f"passed={str(latest.get('passed')).lower()}, plan={latest.get('plan_hash')}"
    lines = [
        "# Local verification status",
        "",
        f"- Branch: `{state['branch']}`",
        f"- SHA: `{state['sha']}`",
        f"- Ahead/behind: {upstream}",
        f"- Running owned runs: {len(state['running_owned_runs'])}",
        f"- Reserved ports: {', '.join(str(port) for port in state['reserved_ports']) or '(none)'}",
        f"- Stale state records: {len(state.get('stale_state', []))}",
        f"- Cleanup mode: {state.get('cleanup_plan', {}).get('mode', 'dry-run-only')}",
        f"- Latest local summary: {latest_text}",
        "",
        "## Dirty paths",
        *[f"- `{path}`" for path in dirty],
        "",
        "## DevToolbox changes",
        *[f"- `{change}`" for change in changes],
    ]
    return "\n".join(lines)


def _devtoolbox_changes(repository: Path) -> list[str]:
    root = repository / ".devtoolbox" / "specs" / "changes"
    if not root.is_dir():
        return []
    return sorted(path.name for path in root.iterdir() if path.is_dir())


def _owned_documents(directory: Path, root: Path, kind: str) -> tuple[list[dict], list[dict]]:
    live, stale = [], []
    if not directory.is_dir():
        return live, stale
    for path in sorted(directory.glob("*.json")):
        value = _read_json(path)
        if isinstance(value, dict) and process_identity_matches(
            value.get("owner_pid"), value.get("process_identity")
        ):
            live.append(value)
        else:
            stale.append(_stale_record(root, path, kind, value))
    return live, stale


def _reservation_documents(directory: Path, root: Path) -> tuple[list[dict], list[dict]]:
    live, stale = [], []
    if not directory.is_dir():
        return live, stale
    for path in sorted(directory.glob("*/owner.json")):
        value = _read_json(path)
        if isinstance(value, dict) and process_identity_matches(
            value.get("owner_pid"), value.get("process_identity")
        ):
            live.append(value)
        else:
            stale.append(_stale_record(root, path.parent, "reservation", value))
    return live, stale


def _reserved_ports(reservations: list[dict]) -> list[int]:
    ports = []
    for value in reservations:
        resource = value.get("resource", "") if isinstance(value, dict) else ""
        if resource.startswith("port:"):
            try:
                ports.append(int(resource.split(":", 1)[1]))
            except ValueError:
                continue
    return sorted(set(ports))


def _stale_record(root: Path, path: Path, kind: str, value) -> dict:
    owner_pid = None
    if isinstance(value, dict):
        owner_pid = value.get("owner_pid", value.get("pid"))
    reason = "invalid-owner-record"
    if isinstance(owner_pid, int):
        reason = "owner-identity-stale-or-unverified"
    return {
        "kind": kind,
        "state_path": path.relative_to(root).as_posix(),
        "owner_pid": owner_pid,
        "run_id": value.get("run_id") if isinstance(value, dict) else None,
        "resource": value.get("resource") if isinstance(value, dict) else None,
        "reason": reason,
    }


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, ValueError):
        return None
