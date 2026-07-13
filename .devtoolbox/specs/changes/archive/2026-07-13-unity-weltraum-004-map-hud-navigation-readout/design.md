# Design

## Why this change
The orbit-map prototype is currently visible in a standalone debug window. `weltraum-004` should make the same catalog/orbit context available through existing play-facing HUD/map debug surfaces while keeping the feature read-only and prototype-scoped.

## Reuse decisions
- Use `PrototypeOrbitMapDebugWindow` and `CelestialOrbitMapSnapshotBuilder` as the source pattern for real-vs-map values.
- Reuse `PrototypePlayerHud` snapshot/readout patterns for text surfaced near the player HUD.
- Reuse `PrototypeMinimapOverlay` for map-adjacent visual conventions where a map readout is needed.
- Use `PrototypeBootstrap` only for wiring existing prototype components; do not add scene-only dependencies.

## UI lane
`zai-ui-glm51` is mandatory before implementation starts and after screenshot/evidence exists. The review should focus on readability, clutter, overlap with existing debug windows, and whether the readout remains clearly prototype-only.

## Runtime boundaries
The implementation slice must remain non-actionable. It may display target/catalog/orbit state, but it must not expose controls that execute travel, route plans, timewarp, drone missions, or autopilot behavior.

## Coordination boundaries
The shared workspace may contain parallel DirectFastTransfer/autopilot/benchmark work. This change must use explicit file scopes and must not revert, overwrite, stage, or commit foreign files.

## Risks
- Adding another readout can make the existing HUD cluttered; Z.AI UI review and screenshot evidence are required before closeout.
- Copying orbit-map logic into HUD code would create parallel data paths; the implementation should reuse the 002 snapshot builder or a tiny adapter around it.
- Accidentally adding travel controls would violate the slice boundary and should block task completion.
