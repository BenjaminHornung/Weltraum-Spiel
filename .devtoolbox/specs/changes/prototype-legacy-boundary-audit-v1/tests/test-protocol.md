# Test Protocol: Prototype Legacy Boundary Audit

Date: 2026-06-15

## Scope

This was a docs/spec/audit task only. No runtime code, Unity scene, prefab, asset, or `Assets/` content was modified.

No DevToolbox task checkbox toggles were performed in this run.

## Read files and context used

Core project guidance:

- `AGENTS.md`
- `.agent/PLANS.md`
- `docs/current-prototype-state.md`
- `docs/architecture/clean-core-refactor-overview.md`
- `docs/architecture/clean-core-runtime-architecture.md`
- `docs/roadmap/milestones.md`
- `docs/roadmap/spec-sorting-2026-06-15.md`
- `docs/roadmap/spec-sorting-backlog.md`
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`

Prototype evidence pack (read-only context from the task brief):

- `PrototypeBootstrap.cs`
- `PrototypeWaypointAutopilot.cs`
- `PrototypeTrajectoryPlanner.cs`
- `PlayerShipController.cs`
- `PrototypePlayerHud.cs`
- `PrototypeFlightHud.cs`
- `PrototypeMinimapOverlay.cs`
- `SimpleFollowCamera.cs`
- `PrototypeWeaponComputer.cs`
- `PrototypeFunctionalShipBinder.cs`
- `PrototypeImportedShipBinder.cs`
- Prototype proving-ground and regression tests under `Assets/Tests/PlayMode/` and `Assets/Tests/Editor/`

## Decisions / classifications

| System | Classification | Reason |
| --- | --- | --- |
| Autopilot | Keep as reference; migrate semantics/tests; adapter required | It is the current authority for exact-arrival and route behavior, so Clean Core must consume only snapshots/commands. |
| Flight / RCS / SAS | Keep as reference; migrate semantics; adapter required | Flight authority and control modes must become a clean flight contract rather than scene-bound MonoBehaviour state. |
| HUD / UI | Keep as reference; migrate concepts; adapter required | Player-facing state should move to ViewModels/Commands, while legacy renderers remain diagnostic/reference only. |
| Minimap / Radar | Keep as reference; migrate concepts; adapter required | Map/radar should become a product map service, not a Prototype IMGUI overlay. |
| Camera | Keep as reference; partial semantics only; adapter required | Camera framing remains scene/presenter-owned and should not become Clean Core logic. |
| Bootstrap / Scene Wiring | Reference only; no product migration here | Bootstrap is composition wiring, not durable business logic. |
| Weapon Computer | Keep as reference; migrate semantics; adapter required | Target selection and turret status should move into Combat contracts. |
| Ship Binder / Functional Ship | Keep as reference and adapter source; migrate contracts | Socket aliases and import validation are valuable evidence, but binder code itself should not become product logic. |
| Proving Ground Tests | Keep and use as authority | They are the current evidence baseline for autopilot and runtime claims. |

## Validation performed

- Reviewed the current prototype state and clean-core architecture docs to align the boundary with existing project truth.
- Reviewed roadmap ordering and spec-sorting docs to ensure the audit points at the correct migration sequence.
- Used the task brief's evidence pack to classify the Prototype systems and keep the scope out of `Assets/`.
- Wrote only markdown files in the new change folder and the architecture docs folder.

## Git checks

Note: git status --short shows only untracked (??) entries. This task's own output files appear alongside pre-existing unrelated untracked files. No tracked files were modified, and no files under Assets/ appear in the output.

Command:

```text
git status --short
```

Output:

```text
?? .devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/implementation-plan.md
?? .devtoolbox/specs/changes/player-facing-status-authority-v1/
?? .devtoolbox/specs/changes/prototype-legacy-boundary-audit-v1/
?? docs/architecture/prototype-legacy-boundary-audit-2026-06-15.md
?? docs/ux/player-facing-status-authority-v1.md
?? weltraum_refactor_strategy_package/
```

Command:

```text
git diff --name-only -- Assets
```

Output:

```text
<no output>
```

Command:

```text
git diff --name-only
```

Output:

```text
<no output>
```

## Confirmation note

If `git diff --name-only -- Assets` returns no lines, that is the explicit confirmation that no files under `Assets/` changed.
