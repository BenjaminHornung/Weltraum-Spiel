# Proposal

## Change
`prototype-legacy-boundary-audit-v1`

## Goal
- Create a docs/spec audit package that freezes the Prototype legacy boundary for Clean Core migration work.
- Classify Prototype systems by retain, migrate, adapter, and eventual archive status.
- Define what Clean Core may read from Prototype, what it must never reference, and which adapter seams are allowed.
- Record the next recommended migration slice so future work stays narrow and evidence-backed.

## Motivation
- The prototype is still the current playable authority for flight, autopilot, HUD, map, camera, combat, and ship binding behavior (`docs/legacy-unity/current-prototype-state-2026-06-15.md:7-16, 48-64, 65-157`).
- The architecture docs already require a controlled Clean-Core split with `Assets/_Weltraum` as the future product root and `Prototype` as legacy/reference (`docs/legacy-unity/architecture/clean-core-refactor-overview.md:10-22, 43-55`; `docs/legacy-unity/architecture/clean-core-runtime-architecture.md:53-62, 63-121, 208-213`).
- Without an explicit boundary audit, later migration slices can accidentally couple Clean Core to MonoBehaviours, scene wiring, IMGUI diagnostics, or binder-specific fallback behavior.

## Scope
- Documentation/spec/audit only.
- No runtime code, scenes, prefabs, assets, or test execution changes.
- No task checkbox toggles and no archive operations.
- No changes under `Assets/`.

## Outcomes
- `docs/legacy-unity/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-legacy-boundary-audit-v1/specs/prototype-legacy-boundary/spec.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-legacy-boundary-audit-v1/tasks.md`
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-legacy-boundary-audit-v1/tests/test-protocol.md`

## Non-goals
- No Clean Core runtime implementation.
- No Prototype refactor or cleanup beyond documenting the boundary.
- No asset import, Blender work, scene migration, or prefab updates.
- No archive/reconcile operations for existing DevToolbox changes.

## Risks captured by this audit
- A future slice may read directly from Prototype MonoBehaviours instead of using snapshot DTOs.
- Scene wiring and diagnostic UI may be mistaken for business logic.
- Autopilot, flight authority, and combat targeting may diverge if they are migrated independently without a shared snapshot contract.
