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

Original focused run:

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

Hotfix regression run:

- `PrototypeFunctionalShipSocketValidationTests`
- `PrototypeShipVisualSwitcherValidationTests`

Result:

- Unity MCP job: `e12637df55a74c3193b5d80f6017a582`
- PASS: 20 / 20
- Duration: 0.9924421 seconds

Hotfix coverage highlights:

- `ResetForRuntimeBaseline` mirrors imported bootstrap default instead of forcing `GeneratedPrimitives`.
- VisualSwitcher does not switch the default runtime to `GeneratedPrimitiveFallback` unless generated mode is explicitly selected.
- Imported visual remains active for the default path.
- Functional sockets bind through unscaled `FunctionalSocketRig` proxies.
- Main nozzle proxy scale is safe and `THRUST_NOZZLE_MAIN*.forward` aligns with `PrototypeShip.forward`.
- No root `Muzzle` or root `EngineNozzle` exists in imported default.

## Unity PlayMode / Runtime Simulation

Original focused run:

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

Hotfix regression run:

- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds`

Result:

- Unity MCP job: `5b23f80f26b74e4ea34ee03628a73b4b`
- PASS: 1 / 1
- Duration: 0.1813091 seconds

Hotfix coverage highlights:

- Host-like bootstrap flow keeps `BuildMode=ImportedDemoScoutFunctionalDefault`.
- VisualSwitcher stays `ImportedDemoScout` after repeated runtime frames.
- `ImportedShipVisual` remains active.
- PlayerShipController `FullMainThrottle` / `FixedUpdate` path increases Rigidbody velocity along `PrototypeShip.forward`.
- 10 seconds of scripted PlayMode physics keeps position finite, max frame jump below 25 m, and angular velocity below 5 rad/s.
- Main thruster VFX plays at imported/proxy `THRUST_NOZZLE_MAIN*`.
- RCS pulse through `PlayerShipController.PulseRcsTranslation` activates imported RCS VFX.
- Weapon Computer target selection and AutoFire rotate yaw/pitch and fire from `WEAPON_MUZZLE_PRIMARY`.

Additional Unity MCP probe:

- `execute_code` functional binder runtime probe: PASS
- Verified imported main nozzle, imported RCS sockets, imported weapon muzzle, bound turret pivots, and no root fallbacks.

## Manual Scene Evidence

- Loaded `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Saved the scene after setting the scene `PrototypeBootstrap.buildOnStart` to true, so pressing Play from that scene now runs the bootstrap path.
- Scene serialized `allowGeneratedFallbackWhenImportedAssetMissing: 0`, so generated fallback is not automatic default.
- Pressed Play through Unity MCP and verified:
  - `buildMode=ImportedDemoScoutFunctionalDefault`
  - `visualMode=ImportedDemoScout`
  - `importedActive=True`
  - no root fallback `Muzzle`
  - no root fallback `EngineNozzle`
  - main nozzle dot to ship forward `1.000`
  - main nozzle lossy scale `(1.00, 1.00, 1.00)`
  - PlayerShipController throttle speed delta `119.458`
  - max frame jump `2.389`
  - max angular velocity `0.000`
  - RCS active nozzles `4`
  - RCS angular velocity `0.027`
  - turret yaw delta `17.988`
  - turret pitch delta `8.007`
  - turret fired from `WEAPON_MUZZLE_PRIMARY`
- Captured screenshots:
  - `tests/screenshots/unity-scene-view-prototype-bootstrap-host.png`
  - `tests/screenshots/unity-game-view-imported-default-hotfix.png`
  - `tests/screenshots/unity-scene-view-imported-default-hotfix.png`
  - `tests/screenshots/unity-game-view-hotfix-after-controls.png`
- Captured log:
  - `tests/logs/unity-manual-game-view-hotfix-probe.md`

## Open Limits

- Cargo imported mode still reports missing weapon markers and is not part of the accepted default path for this change.
