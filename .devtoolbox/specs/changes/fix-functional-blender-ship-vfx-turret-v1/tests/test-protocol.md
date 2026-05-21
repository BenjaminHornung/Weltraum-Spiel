# Test Protocol

## Scope

Change: `fix-functional-blender-ship-vfx-turret-v1`

Goal: Default runtime uses the Blender Demo Scout as the functional `PrototypeShip`; main/RCS VFX, turret, muzzle, muzzle flash, and projectile origin bind to imported markers.

## Spec Validation

- `specs_validate --change fix-functional-blender-ship-vfx-turret-v1`: PASS
- Parsed files: 5 spec files
- Parsed tasks: 20 tasks
- `tasks.md` entries remain unchecked until final human/runtime acceptance; evidence is recorded here instead of silently closing tasks.

## Blender Validation And Export

- Blender MCP opened `art/blender/prototype_modular_ship_kit_v0.blend`.
- Repaired Demo Scout turret hierarchy:
  - `WEAPON_TURRET_BASE_PRIMARY`
  - `WEAPON_TURRET_YAW_PRIMARY`
  - `WEAPON_TURRET_PITCH_PRIMARY`
  - `WEAPON_MUZZLE_PRIMARY`
  - `WEAPON_MUZZLE_FLASH_PRIMARY`
- Reparented visible turret geometry:
  - `DEMO_Scout_Mk1_GEO_Gun_Mount_Base` under yaw pivot
  - `DEMO_Scout_Mk1_GEO_Gun_Barrel` under pitch pivot
  - `DEMO_Scout_Mk1_GEO_Gun_Muzzle_Red` under pitch pivot
- Re-exported:
  - `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx`
  - `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb`
- `art/blender/validate_ship_kit_meshes.py`: PASS
- Copied report: `tests/logs/blender-ship-kit-validation-report.md`

## Unity Compile

- Unity script refresh/compile after runtime and test changes: PASS
- Console error check after compile: no C# compile errors.

## Unity EditMode Tests

Focused run:

- `PrototypeFunctionalShipSocketValidationTests`
- `PrototypeWeaponComputerTurretValidationTests`

Result:

- Unity MCP job: `34d58f1d9ebe458089a799be46131e9c`
- PASS: 31 / 31
- Duration: 0.6928879 seconds

Coverage highlights:

- Real `demo_scout_mk1.fbx` loads and binds functional sockets.
- `PrototypeFunctionalShipBinder` binds imported main nozzles, RCS nozzles, turret pivots, weapon muzzle, and Weapon Computer ownership.
- Imported default has no root `Muzzle` or root `EngineNozzle`.
- `EngineVfxController.Nozzle` is an imported `THRUST_NOZZLE_MAIN*`.
- `RcsThrusterController.UseImportedFunctionalSockets` is true in imported default.
- `GunModule.MuzzleTransform` and `PrototypeTurretWeapon.Muzzle` use `WEAPON_MUZZLE_PRIMARY`.
- Visible barrel/yaw meshes are under the imported yaw/pitch pivots.
- Turret aim status no longer hard-snaps during status evaluation; `TickAimAtTarget` slews before firing.

## Unity PlayMode / Runtime Simulation

Focused run:

- `PrototypeFunctionalBlenderRuntimePlayModeTests`

Result:

- Unity MCP job: `aecb588dff40492d89bb3b495da03f94`
- PASS: 1 / 1
- Duration: 0.1090752 seconds
- Copied result XML: `tests/logs/unity-playmode-testresults.xml`

Coverage highlights:

- Runtime bootstrap creates imported Demo Scout functional default.
- Main thruster applies thrust and starts particles at imported main nozzle.
- RCS pulse activates at least one imported RCS VFX child near an imported `RCS_NOZZLE_*`.
- Turret target fire slews and fires from imported `WEAPON_MUZZLE_PRIMARY`.

Additional Unity MCP probe:

- `execute_code` functional binder runtime probe: PASS
- Verified imported main nozzle, imported RCS sockets, imported weapon muzzle, bound turret pivots, and no root fallbacks.

## Manual Scene Evidence

- Loaded `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Saved the scene after setting the scene `PrototypeBootstrap.buildOnStart` to true, so pressing Play from that scene now runs the bootstrap path.
- Captured Scene View screenshot:
  - `tests/screenshots/unity-scene-view-prototype-bootstrap-host.png`

Note: A broad EditMode test run was accidentally started after the focused test runs. It became stale in Unity MCP and reported pre-existing unrelated Autopilot failures while blocked on a momentum-assist test. Focused EditMode/PlayMode evidence above was collected before that broad run, and a direct MCP runtime probe was used afterward because the stale Test Runner job prevented starting another focused run.

## Open Limits

- Manual visual inspection through the Game View was limited by the stale Unity Test Runner state after the accidental broad run.
- Cargo imported mode still reports missing weapon markers and is not part of the accepted default path for this change.
