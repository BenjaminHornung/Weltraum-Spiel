# Design

## Change
`prototype-legacy-boundary-audit-v1`

This is a planning-only boundary audit. It documents the Prototype legacy surface and defines the migration seam for Clean Core.

## Boundary model

The audit uses three explicit buckets:

1. **Reference only**
   - Keep as historical/behavioral reference.
   - Clean Core may not depend on the implementation types.

2. **Migrate semantics**
   - Preserve the gameplay meaning, but re-cut the implementation in `Assets/_Weltraum` later.
   - The Prototype version remains only as a source of truth for behavior and evidence.

3. **Adapter surface**
   - Narrow read/command seams that convert Prototype state into DTOs, snapshots, or ViewModels.
   - No business logic belongs here.

## System classification approach

The main audit doc classifies these Prototype systems:

- Autopilot (`PrototypeWaypointAutopilot`, `PrototypeTrajectoryPlanner`)
- Flight / RCS / SAS (`PlayerShipController`)
- HUD / UI (`PrototypePlayerHud`, `PrototypeFlightHud`)
- Minimap / Radar (`PrototypeMinimapOverlay`)
- Camera (`SimpleFollowCamera`)
- Bootstrap / Scene Wiring (`PrototypeBootstrap`, `PrototypeBootstrapHost.unity`)
- Weapon Computer (`PrototypeWeaponComputer`)
- Ship Binder / Blender Functional Ship (`PrototypeFunctionalShipBinder`, `PrototypeImportedShipBinder`)
- Proving Ground Tests and evidence fixtures

Each row gets the same decision axes:
- keep as reference?
- migrate?
- adapter needed?
- delete/archive later?

## Evidence model

The audit relies on existing docs and proof artifacts only:

- current prototype state docs
- clean-core architecture docs
- roadmap and spec-sorting docs
- prototype proving-ground and regression tests

Future migration claims must be backed by:
- focused EditMode/PlayMode tests
- Unity script validation or console checks
- solution build/test results
- screenshots, CSV, or JSON evidence when the slice is visual or simulation-heavy

## Boundary rules encoded by the audit

- Clean Core may read Prototype only through immutable snapshots, DTOs, evidence summaries, or command outputs emitted by approved adapters.
- Clean Core must never directly reference Prototype MonoBehaviours, Prototype scene wiring, or IMGUI/uGUI renderer classes.
- Allowed adapter points are scene composition roots, presenters, snapshot mappers, and test/evidence harnesses.
- The first migration focus is authority-bearing data: autopilot and flight snapshots before UI polish or scene cleanup.

## Risks

- A too-broad adapter could reintroduce Prototype internals through backdoor references.
- A UI-first migration could hide authority bugs in autopilot or flight state.
- Treating bootstrap or camera behavior as core logic would make the new product harder to test outside Unity scenes.
