# Spec: DevToolbox Change Reconciliation

## Requirements

### REQ-001: Spec Sorting Document

The project MUST have a spec-sorting document at
`docs/roadmap/spec-sorting-2026-06-15.md` that lists every active
`.devtoolbox/specs/changes` folder (excluding `archive/`), grouped into:

- A Architecture/Hygiene
- B Navigation/Autopilot
- C UI/Input/Map
- D Data Contracts
- E Gameplay Slices
- F Archive/Reconcile

Each entry MUST include: change name, group, status, evidence present, blocker,
recommendation, and next action.

### REQ-002: Stale Metadata Backlog

The project MUST have a stale-metadata backlog at
`docs/roadmap/stale-metadata-backlog-2026-06-15.md` that records:

- contradictory documentation,
- open or stale task checkboxes,
- evidence present but tasks open,
- tasks green but validation missing,
- superseded changes.

### REQ-003: Exact-Arrival Contradiction Resolution

`docs/current-prototype-state.md` MUST NOT contradict the passing exact-arrival
evidence recorded in
`fix-autopilot-exact-point-arrival-v1/tests/test-protocol.md`.

If the evidence shows acceptance gate PASS, the documentation MUST reflect a
resolved or passing state, not a stale failing state.

### REQ-004: No Runtime Changes

No files under `Assets/`, `Packages/`, or `ProjectSettings/` MAY be modified by
this change.

### REQ-005: Test Protocol

A test protocol MUST exist at
`.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/tests/test-protocol.md`.

### REQ-006: Archive Proposal

The spec-sorting document MUST include a proposal section listing changes that
are candidates for future archiving, but MUST NOT perform any archiving.
