# Proposal: DevToolbox Change Reconciliation v1

## Problem

The active change set under `.devtoolbox/specs/changes` has grown to 68 non-archived
folders. Many of them are completed in practice but blocked by stale task metadata.
Others are superseded by archived copies or newer changes. The project documentation
(`docs/current-prototype-state.md`) contradicts fresh evidence for the exact-arrival
autopilot fix. The roadmap needs a single sorting document and a stale-metadata
backlog so the next agents can work with a clear truth instead of reconciling
folders ad hoc.

## Outcome

This change produces three docs/spec artifacts and no runtime code:

1. `docs/roadmap/spec-sorting-2026-06-15.md` - groups all active changes, their
   status, evidence, blockers, recommendations, and next actions.
2. `docs/roadmap/stale-metadata-backlog-2026-06-15.md` - lists contradictory docs,
   stale task checkboxes, evidence-without-tasks, tasks-green-without-validation,
   and superseded changes.
3. An updated `docs/current-prototype-state.md` that resolves the exact-arrival
   documentation contradiction using the passing evidence from
   `fix-autopilot-exact-point-arrival-v1`.

## Scope

In scope:

- Read-only inspection of all active change folders.
- Grouping changes into A Architecture/Hygiene, B Navigation/Autopilot,
  C UI/Input/Map, D Data Contracts, E Gameplay Slices, F Archive/Reconcile.
- Creating the spec-sorting and stale-metadata documents.
- Updating `docs/current-prototype-state.md` because exact-arrival evidence is
  unambiguous.
- Creating this DevToolbox change scaffold with proposal, design, tasks, spec,
  and test protocol.

Out of scope:

- No runtime code changes.
- No Unity scene, prefab, asset, or ProjectSettings changes.
- No changes to `Assets/Scripts/Prototype`.
- No archiving of changes.
- No toggling of existing task checkboxes.
- No implementation of any feature.

## Success Criteria

- `docs/roadmap/spec-sorting-2026-06-15.md` exists and covers all active changes.
- `docs/roadmap/stale-metadata-backlog-2026-06-15.md` exists.
- Exact-arrival contradiction in `docs/current-prototype-state.md` is resolved.
- No files under `Assets/`, `Packages/`, or `ProjectSettings/` are modified.
- Test protocol exists under this change's `tests/` folder.
