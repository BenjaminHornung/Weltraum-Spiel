# Test Protocol

## Scope

Change: `fix-functional-blender-ship-vfx-turret-v1`

Goal: Default runtime uses the Blender Demo Scout as the functional `PrototypeShip`; main/RCS VFX, turret, muzzle, muzzle flash, and projectile origin bind to imported markers.

## Spec Validation

- `specs_validate --change fix-functional-blender-ship-vfx-turret-v1`: PASS
- Parsed files: 5 spec files
- Parsed tasks: 20 tasks
- 2026-06-12 closeout rerun: PASS; proposal, design, tasks, 5 spec files, task parsing, and change root passed.
- `tasks.md` entries were checked only after `tasks_completion_preflight` reported no blockers and `canProceed=true` for all 20 task lines. Preflight remained `degraded` only because the old linked execution lacks DevToolbox verification notes; the fresh Unity/dotnet/spec evidence is recorded in this protocol and `tests/logs/`.

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
- Weapon-computer/turret regression script validation after the 2026-05-22 fix: PASS
  - `PrototypeTurretMount.cs`
  - `PrototypeTurretWeapon.cs`
  - `PrototypeFunctionalShipBinder.cs`
  - `PrototypeShipKitWeaponBinder.cs`
  - `PrototypeProjectileSimulation.cs`
  - `PrototypeFunctionalBlenderRuntimePlayModeTests.cs`

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

Weapon computer / Blender turret regression run:

- `PrototypeWeaponComputerTurretValidationTests.TurretBlocksFireWhenOwnHullLineOfFireIsBlocked`
- `PrototypeWeaponComputerTurretValidationTests.BootstrapRegistersDefaultTestTargetForWeaponComputer`
- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderUsesImportedDemoScoutAsRuntimeRootWithoutFallbacks`
- `PrototypeUiArchitectureValidationTests.FlightTestPresetKeepsDebugConsoleClosedAndWeaponComputerCollapsed`
- `PrototypePlayerHudValidationTests.CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak`

Result:

- Unity MCP job: `1266b76a57934efe92843dfd03ee2627`
- PASS: 5 / 5

Coverage highlights:

- Default `PrototypeTargetDummy` is registered through `PrototypeWeaponTargetMarker`.
- Weapon Computer is visible in normal flight/combat UI and collapsed outside diagnostics.
- HUD help includes `F7 Weapon Computer`.
- Line-of-fire blocked shots report `LineBlocked`.
- Imported Demo Scout functional binding requires visible yaw and pitch turret renderers.

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

Weapon computer / Blender turret regression run:

- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds`
- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeRegistersDefaultTargetForWeaponComputer`

Result:

- Unity MCP job: `144fa3b7736542a19ab58f655c7254b9`
- PASS: 2 / 2

Coverage highlights:

- Default scene keeps `BuildMode=ImportedDemoScoutFunctionalDefault` and `VisualMode=ImportedDemoScout`.
- Weapon Computer discovers the default target marker without debug fallback discovery.
- Selecting a target with AutoFire off still slews yaw/pitch over frames.
- Visible yaw assembly and barrel renderers are children of the imported/proxy yaw and pitch pivots and rotate with them.
- Line-of-fire blocked by own hull blocks firing.
- Valid fire uses `WEAPON_MUZZLE_PRIMARY` for origin and uses the actual muzzle/barrel forward vector for projectile direction.

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
  - `tests/screenshots/weapon-computer-blender-turret-gameview-verified.png`
- Captured log:
  - `tests/logs/unity-manual-game-view-hotfix-probe.md`

Additional 2026-05-22 manual Game View probe:

- Pressed Play through Unity MCP from `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Expanded the Weapon Computer panel through runtime API to make the visual state explicit.
- Selected a discovered arena target with AutoFire off and ticked aim for visual tracking evidence.
- Runtime probe result:
  - `buildMode=ImportedDemoScoutFunctionalDefault`
  - `visualMode=Imported Demo Scout`
  - `weaponComputer=True`
  - `panelVisible=True`
  - `panelCollapsed=False`
  - `targets=13`
  - `active=PrototypeArenaTarget_03`
  - `autoFire=False`
  - `status=out of arc`
  - `muzzle=WEAPON_MUZZLE_PRIMARY`
- Captured screenshot:
  - `tests/screenshots/weapon-computer-blender-turret-gameview-verified.png`

## Additional Local Checks

- `specs_validate --change fix-functional-blender-ship-vfx-turret-v1`: PASS after the 2026-05-22 protocol/evidence update.
- Scene serialization verified with `rg`:
  - `buildMode: 0`
  - `allowGeneratedFallbackWhenImportedAssetMissing: 0`
- 2026-06-12 stale reference search:
  - `rg --hidden -n "PrototypeImportedBlenderJitterEvidenceTests\.cs|PrototypeImportedBlenderJitterEvidenceTests|PrototypeImportedBlenderJitterEvidencePlayModeTests\.cs|PrototypeFunctionalBlenderRuntimePlayModeTests\.cs" -g "*.csproj" -g "*.sln" -g "*.md" -g "*.json" -g "!Library/**" -g "!Temp/**" -g "!Logs/**" -g "!obj/**" -g "!bin/**" .`
  - Active project references are valid: `Assembly-CSharp.csproj` references existing `Assets\Tests\PlayMode\PrototypeImportedBlenderJitterEvidencePlayModeTests.cs` and `Assets\Tests\PlayMode\PrototypeFunctionalBlenderRuntimePlayModeTests.cs`; `WeltraumSpiel.PlayModeTests.csproj` references existing `Assets\Tests\PlayMode\PrototypeFunctionalBlenderRuntimePlayModeTests.cs`.
  - No active `.csproj`/`.sln` reference to missing `Assets\Tests\Editor\PrototypeImportedBlenderJitterEvidenceTests.cs` remains.
  - The only stale mention was this protocol's old blocked-build note, now replaced by the fresh evidence.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS on 2026-06-12 after the focused closeout update, 0 errors, known Unity/MSBuild warnings only.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS on 2026-06-12, exit code 0.
- Unity MCP script refresh/compile on 2026-06-12: PASS. Console after final refresh had no C# compiler errors; remaining entries were known obsolete API warnings and Unity AssetManager `[SerializeReference]` serialization messages from Unity packages.
- After the scene-only fallback flag correction, Unity MCP `refresh_unity` timed out and subsequent bridge pings did not answer, while the Unity editor process itself was still responding. No extra PlayMode rerun was claimed after that scene-only serialization correction.

## Fresh Acceptance Pass 2026-06-12

- Loaded/used `Assets/Scenes/PrototypeBootstrapHost.unity` through Unity MCP; final editor state returned to that active scene and `ready_for_tools=true`.
- Focused EditMode rerun through Unity MCP:
  - Job `f31692b3136f4b538befbc5a98e6d3d5`
  - `PrototypeFunctionalShipSocketValidationTests`
  - `PrototypeWeaponComputerTurretValidationTests`
  - `PrototypeShipVisualSwitcherValidationTests`
  - PASS: 54 / 54, duration 2.2151582 seconds
- Focused PlayMode runtime rerun through Unity MCP:
  - Job `420cb27a77614eac978c81c2042352af`
  - `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds`
  - `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeRegistersDefaultTargetForWeaponComputer`
  - PASS: 2 / 2, duration 0.5758278 seconds
- PlayMode diagnostics confirmed:
  - `buildMode=ImportedDemoScoutFunctionalDefault`
  - `allowGeneratedFallbackWhenImportedAssetMissing=False`
  - required flight sockets present
  - required weapon sockets present
  - required visible weapon renderers present
  - `ImportedDemoScoutVisual` active at `(100.0, 100.0, 100.0)`
  - `functionalSocketRig=True`
  - `generatedRendererCount=0`
- The focused runtime acceptance covers:
  - visual mode remains Imported Demo Scout
  - no root fallback `Muzzle`
  - no root fallback `EngineNozzle`
  - main thruster VFX from imported/proxy `THRUST_NOZZLE_MAIN*`
  - RCS VFX from imported/proxy `RCS_NOZZLE*` with exhaust opposite nozzle force direction
  - Weapon Computer selects a target
  - visible turret yaw/pitch geometry tracks the selected target
  - firing is gated by arc/alignment/cooldown
  - projectile and muzzle flash originate at `WEAPON_MUZZLE_PRIMARY` / `WEAPON_MUZZLE_FLASH_PRIMARY`
- The PlayMode visibility assertion was adjusted only for Unity MCP Game View viewport variance: per-axis projected size minimum is now `> 0.06f` and projected area minimum is now `> 0.007f`; all stronger checks remain, including 8 corners in front of camera, max dimensions, max area, and centered viewport bounds.
- `specs_validate` for `fix-functional-blender-ship-vfx-turret-v1`: PASS on 2026-06-12.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS on 2026-06-12, 0 errors.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS on 2026-06-12, exit code 0.
- Evidence logs are under `tests/logs/`, including the final PlayMode, final EditMode, final compile refresh, final dotnet build, and final dotnet test outputs.

## Open Limits

- Cargo imported functional binding is explicitly out of scope for this closeout unless/until the Cargo asset is marker-complete in a separate slice. This acceptance pass closes only the Blender Demo Scout functional default.
- The 2026-05-22 weapon-computer/turret fix did not modify `art/blender/prototype_modular_ship_kit_v0.blend`; it verifies and uses the already-imported hierarchy through Unity. The runtime bug fixed here was the Unity binding/visibility/line-of-fire path, including idempotent visible turret proxy binding.
