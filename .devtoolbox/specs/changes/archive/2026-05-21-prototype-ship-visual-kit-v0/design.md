# Design

## Approach

Introduce a prototype-only visual helper named `PrototypeShipVisualKit` or `PrototypeShipPartVisualFactory`. It should centralize procedural low-poly module construction, material assignment, optional connector markers, and builder-ready metadata so `PrototypeBootstrap` and related layout code do not accumulate one-off primitive assembly logic.

## Reuse Strategy

The implementation must first reuse existing prototype layout, palette, mass, thruster, RCS, gun, and VFX code paths. Existing runtime names and component attachment points remain authoritative for gameplay. New code is justified only for the visual factory/helper and lightweight metadata because the requirement needs reusable archetype-level part construction that current cube-based assembly does not provide.

Relevant reusable surfaces:

- `PrototypeShipLayout` and `PrototypeShipVariant` for existing module entries.
- `PrototypeModuleColorPalette` for color/material ownership.
- `MainThrusterModule`, `MainThrusterBank`, `RcsThrusterController`, and gun setup for gameplay transforms.
- Existing docs and tests for mass, thrust, RCS, and projectile behavior.

## Visual Archetypes

The factory maps existing layout entries to these visual archetypes:

- `CockpitWedge`
- `HullCore`
- `HullLongSegment`
- `FuelTankPod`
- `MainEngineBell`
- `RcsPod`
- `GunMount`
- `CargoBox`
- `UtilityBlock`
- `ConnectorHardpointMarker`

Archetypes should be built from procedural meshes or Unity primitives arranged as low-poly shapes. Procedural meshes are preferred when a wedge or segmented shape would otherwise need awkward primitive overlap. Primitives remain acceptable for simple barrels, nozzles, markers, boxes, and cylinders where they keep the prototype lightweight.

## Metadata Shape

Add lightweight part metadata close to the layout/visual mapping. Required fields are:

- `partId`
- `displayName`
- `category`
- `visualArchetype`
- `localSize`
- `massRole`
- connector or hardpoint marker placeholders
- gameplay role

This metadata is a foundation only. It must not introduce builder UI, snapping, inventory, unlocks, save/load, or economy logic.

## Materials and VFX

Materials must remain URP-compatible. Hull material should be darker neutral gray and non-emissive. Cockpit canopy should be visibly darker/glossier. Engine and RCS elements may use targeted emissive colors, but debug vectors should remain off by default and visually distinct from engine/RCS thrust effects.

## Risks

- Replacing primitives can accidentally move or rename gameplay transforms. Mitigation: preserve transform names exactly and validate RCS, gun, and main thruster behavior.
- More visible VFX can be confused with debug vectors. Mitigation: keep debug vectors default off and document the difference.
- Existing dirty HUD/camera files are present in the worktree. Mitigation: preserve unrelated edits and avoid unnecessary HUD changes.

## Verification

Verification must include Unity MCP script validation, refresh/console checks, Unity tests, and a PlayMode screenshot/visual inspection recorded in `tests/test-protocol.md`. Local build/test commands should target `Weltraum Spiel.sln` explicitly if used, because generic DevToolbox `verify_run` has known MSB1011 behavior for this Unity root.
