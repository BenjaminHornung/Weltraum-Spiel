# Tasks

## Phase 0 - Analysis and Spec
- [x] Record current generated-vs-imported runtime cause analysis and keep implementation scoped to the imported functional default.
- [x] Validate this spec change with DevToolbox before product implementation.

## Phase 1 - Blender Source and Export
- [x] Update `art/blender/prototype_modular_ship_kit_v0.blend` so `demo_scout_mk1` has complete functional main/RCS/weapon sockets and visible yaw/pitch/barrel turret hierarchy.
- [x] Extend `art/blender/validate_ship_kit_meshes.py` so missing main/RCS/weapon markers and broken turret hierarchy are errors, then regenerate FBX/GLB exports and `ship_kit_mesh_validation_report.md`.
- [x] Update `Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json` to include the full Demo Scout main/RCS/weapon socket contract and direction semantics.

## Phase 2 - Runtime Functional Binding
- [x] Add/refactor a mode-driven functional ship build path where `ImportedDemoScoutFunctionalDefault` is the default and generated primitives are explicit fallback/debug only.
- [x] Add/refactor a functional binder that runs on the `PrototypeShip` root, reuses imported socket/VFX/weapon binders, and binds main thrusters, RCS, engine VFX, turret, gun, weapon computer, and panel from imported sockets.
- [x] Update `PrototypeShipVisualSwitcher` so imported mode cannot remain a visual-only overlay disconnected from functional transforms.

## Phase 3 - No-Fallback Runtime Safety
- [x] Make imported-default main thruster VFX strict: no root `EngineNozzle` fallback and no fake VFX when imported main nozzle is missing.
- [x] Make imported-default RCS strict: `UseImportedFunctionalSockets` true, imported RCS nozzles authoritative, and VFX found under `VFX`, `PreviewRcsThrusterVfx`, or `RcsThrusterVfx`.
- [x] Make imported-default weapon fire strict: no root `Muzzle`, no `Vector3.zero` shot origin, and missing muzzle/status prevents fire.

## Phase 4 - Visible Turret Tracking and Fire
- [x] Separate turret status evaluation from aim mutation and implement slew-rate yaw/pitch tracking using `turretSlewDegreesPerSecond`.
- [x] Update auto-fire/manual-fire flow so target tracking fires only when aligned, in arc/range, and cooldown-ready; muzzle flash/tracer/projectile originate at imported muzzle/flash markers.
- [x] Update weapon computer/panel status text for no target, tracking, aligning, in arc, out of arc, cooldown, no muzzle, and missing imported marker.

## Phase 5 - Tests and Evidence
- [x] Add Editor tests that load the real imported Demo Scout asset/prefab, run functional binding, and assert imported main/RCS/weapon bindings plus no root fallbacks.
- [x] Add PlayMode/runtime simulation coverage for default bootstrap, main throttle VFX, RCS pulse VFX, target tracking, visible turret rotation, aligned auto-fire, muzzle origin, and negative missing-muzzle behavior.
- [x] Run Unity MCP refresh/console checks plus relevant EditMode/PlayMode tests; save logs/screenshots under this change's `tests/` folder.
- [x] Run Blender validation/export through Blender MCP or Blender CLI and save report/evidence under this change's `tests/` folder.

## Phase 6 - Documentation and Protocol
- [x] Update `README.md` and `docs/physics-flight-model.md` with imported functional default, generated fallback/debug, socket direction, weapon computer, auto-fire, and VFX origin behavior.
- [x] Write `.devtoolbox/specs/changes/fix-functional-blender-ship-vfx-turret-v1/tests/test-protocol.md` with DevToolbox validation, Unity tests, Blender validation/export, manual scene evidence, and any remaining limits.
