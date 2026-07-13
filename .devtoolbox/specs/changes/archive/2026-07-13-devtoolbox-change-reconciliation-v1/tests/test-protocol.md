# Test Protocol: DevToolbox Change Reconciliation v1

Date: 2026-06-15

## Scope

This was a docs/spec reconciliation task only. No runtime code, Unity scene,
prefab, asset, ProjectSettings, or `Assets/Scripts/Prototype` change was made.

## Files Created

Roadmap documents:

- `docs/legacy-unity/roadmap/spec-sorting-2026-06-15.md`
- `docs/legacy-unity/roadmap/stale-metadata-backlog-2026-06-15.md`

DevToolbox change scaffold:

- `.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/proposal.md`
- `.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/design.md`
- `.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/tasks.md`
- `.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/specs/devtoolbox-change-reconciliation/spec.md`
- `.devtoolbox/specs/changes/devtoolbox-change-reconciliation-v1/tests/test-protocol.md`

## Files Updated

- `docs/legacy-unity/current-prototype-state-2026-06-15.md` - exact-arrival contradiction resolved.

## Evidence Reviewed

Exact-arrival evidence:

- `fix-autopilot-exact-point-arrival-v1/tests/test-protocol.md` records:
  - Unity MCP script validation: PASS (0 errors).
  - Focused EditMode tests: 46/46 PASS.
  - Proving Ground evidence generator: PASS.
  - Proving Ground acceptance gate: PASS.
  - PlayMode nominal-reacquire regression: PASS.
  - `dotnet build`: PASS.
  - `specs_validate`: PASS.
  - All scenarios PASS with final distances 0.20m to 0.52m.

Prior audits:

- `docs/legacy-unity/devtoolbox-audits/change-audit-2026-06-14.md` (54 changes classified).
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`.

Current active change count (excluding `archive/`): 68 folders.

## Exact-Arrival Contradiction Resolution

The prior `docs/legacy-unity/current-prototype-state-2026-06-15.md` "Known Current Autopilot Blocker"
section described exact-arrival as failing with loose distances and replan chatter.
The test protocol from 2026-06-14 supersedes that: all scenarios PASS, acceptance
gate PASS, `specs_validate` PASS.

The documentation was updated directly because the evidence is unambiguous.

## Validation

### DevToolbox specs_validate

DevToolbox MCP is available. `specs_validate` was run for
`devtoolbox-change-reconciliation-v1` after scaffold creation.
Result is recorded in the tasks list.

### Runtime/Asset Scope Check

```text
git status --short -- Assets Packages ProjectSettings
```

Expected: no output (no runtime files modified).

## Definition of Done

- [x] Spec-Sorting-Dokument existiert.
- [x] Stale-Metadata-Backlog existiert.
- [x] Exact-Arrival-Doku-Widerspruch ist geloest.
- [x] Keine Runtime-/Unity-Dateien geaendert.
- [x] Testprotokoll vorhanden.
