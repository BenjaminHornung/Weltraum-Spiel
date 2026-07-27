# Proposal

## Change
`browser-hestia-first-person-combat-slice-v1`

## Problem
The browser mainline has deterministic Hestia generation, SurfaceLocalFrame, combat, adaptive microvoxel, and structural destruction foundations, but no binding contract joins them into a player-facing first-person surface slice. Starting implementation without that boundary would let renderer state, stale region data, or presentation telemetry become gameplay authority and would make independent worker lanes conflict.

## Goal
Define the renderer-independent contracts, acceptance specification, reuse evidence, and worker ownership for a bounded Hestia `SurfaceRegion` slice reachable later through exactly `?surfacePlay=1`. The eventual player path supports deterministic Hestia spawn, walk/sprint/jump with terrain collision and gravity, a visible Pulse Cutter, a damageable Survey/Security drone through the existing Combat Core, revisioned `SubtractSphere` terrain edits, and a player-facing Suit HUD.

## In Scope For This Change
- Immutable TypeScript contracts and focused unit tests under the approved write scope.
- Binding authority, identity, frame/revision, SI-unit, rejection, and presentation boundaries.
- Remote/historical reuse audit with exact commit evidence.
- Parallel task plan for the later playable implementation.

## Out of Scope
- Runtime integration, route wiring, renderer/UI implementation, package changes, global planet shell, orbit-to-surface transition, multiplayer, final balance, and edits to existing Surface Lab, Combat, Voxel, World Generation, or main bootstrap files.

## Success
The contracts compile, focused tests pass, the browser production build succeeds, validation/audits are clean, and all later workers can pin one contract commit SHA without changing public behavior or authority boundaries.