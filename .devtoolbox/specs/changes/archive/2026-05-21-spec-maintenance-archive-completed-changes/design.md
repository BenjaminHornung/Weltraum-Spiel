# Design

## Change
`spec-maintenance-archive-completed-changes`

## Approach
The maintenance pass treats DevToolbox as authoritative for archive readiness:

- Run `workspace_discover`, `specs_list_changes`, `specs_get_status`, and `specs_validate` to establish the candidate list and blockers.
- Repair only metadata gaps that prevent preflight from representing the real workspace state.
- Archive candidates only through `specs_archive_change`.
- Record results in `tests/test-protocol.md`.

## Metadata Repair
`player-facing-ui-concept-v0` and `fix-flight-control-jitter-regression-v1` already contain completed evidence under `tests/`, but they were created as evidence folders without proposal/spec/tasks artifacts. The repair is intentionally documentation-only so the validation tool can parse them and archive readiness can be checked.

## Risks
- Completed-looking changes can still be referenced by active follow-up work. Those are skipped unless DevToolbox reports archive readiness.
- Generic verification records can be stale or misconfigured for Unity roots with multiple solutions. The protocol records when Unity-specific evidence is used instead of generic `verify_run`.
- Existing dirty workspace files are preserved and not reverted.
