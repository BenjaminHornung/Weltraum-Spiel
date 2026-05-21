# Design

## Change
`fix-functional-blender-ship-vfx-turret-v1`

## Architecture Notes
The default ship build path should become mode-driven. Add a runtime build mode such as `PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault` with `GeneratedPrimitiveFallback` retained for explicit debug/fallback use. The default mode must instantiate or bind the Blender Demo Scout under the `PrototypeShip` root and make its imported sockets authoritative for physics, VFX, weapon muzzle, muzzle flash, and turret pivots.

Introduce or refactor a single functional orchestration point, e.g. `PrototypeFunctionalShipBinder`, rather than spreading default rebinding across `PrototypeBootstrap` and visual switch code. This binder should reuse the existing imported binding components and utilities where possible:
- `PrototypeShipSocketUtility.EnsureSocketsInHierarchy` for imported marker classification.
- `PrototypeImportedShipBinder` behavior for main thruster/RCS module creation.
- `PrototypeShipKitVfxBinder` behavior for main/RCS VFX attachment.
- `PrototypeShipKitWeaponBinder` behavior for weapon turret/muzzle/muzzle-flash binding.

`PrototypeBootstrap` remains responsible for creating the stable `PrototypeShip` root, shared ship systems, stats, camera/hud/panels, and selecting the build mode. In imported default mode it must avoid generating functional gun/muzzle/main-thruster/RCS fallbacks before imported binding. Generated primitives are only created when the fallback/debug mode is selected or when imported assets are unavailable and the mode explicitly permits fallback.

`PrototypeShipVisualSwitcher` must no longer leave a visible imported ship disconnected from functional transforms. Switching to an imported visual must run the functional binder or clearly switch into a purely debug visual-only state. Switching back to generated mode must restore generated functional bindings deliberately.

`EngineVfxController`, `RcsThrusterController`, `GunModule`, and `PrototypeProjectileSimulation` must support strict imported-default behavior: missing sockets report a warning/status and prevent firing/VFX, instead of creating root/default fallback origins. Existing generated/debug fallback behavior can remain for `GeneratedPrimitiveFallback` only.

Turret tracking should separate status evaluation from rotation mutation. `EvaluateFireStatus` must be side-effect-free by default, while explicit tick methods slew yaw/pitch toward the target at `turretSlewDegreesPerSecond`. Auto-fire and manual target fire must fire only when arc/range/cooldown and alignment are satisfied.

The Blender source must contain the visible functional turret hierarchy, not just marker empties. The yaw assembly mesh must be a child of `WEAPON_TURRET_YAW_PRIMARY`, the barrel/pitch mesh a child of `WEAPON_TURRET_PITCH_PRIMARY`, and `WEAPON_MUZZLE_PRIMARY` plus `WEAPON_MUZZLE_FLASH_PRIMARY` must be at the barrel end. Marker forward direction is the force/projectile direction; exhaust/plume VFX renders opposite that direction.

## Reuse Decisions
Existing socket, imported binder, VFX binder, weapon binder, projectile simulation, and weapon computer systems should be reused and orchestrated. New code is justified only where the current systems lack a single default functional binding mode, strict no-fallback policy, or slew-based turret tracking API.

## Verification Strategy
- Editor tests load `demo_scout_mk1.fbx` or a runtime prefab variant, run the functional binder, and assert imported main/RCS/weapon bindings plus no root fallbacks.
- Runtime/PlayMode tests bootstrap from an empty scene or `PrototypeBootstrapHost`, assert default build mode, pulse main/RCS thrust, track/fire at a target, and verify VFX/muzzle positions near imported markers.
- Blender validation script treats missing main/RCS/weapon markers and invalid turret hierarchy as errors, then exports FBX/GLB and updates the report.
- Unity MCP checks include refresh/compile, console, EditMode tests, PlayMode/runtime checks if available, and screenshots/logs saved under this change's `tests/` folder.

## Risks
- Existing tests and docs still assume `GeneratedPrimitives` baseline in places; these must be updated deliberately.
- Imported FBX hierarchy changes can invalidate Unity meta/import expectations; rerun Blender export and Unity import validation before claiming completion.
- Strict no-fallback behavior can surface legitimate missing-marker defects that were previously hidden; tests should assert status/warnings rather than allowing silent root-origin fire.
- Dirty unrelated files exist in the working tree; implementation must preserve unrelated user changes.
