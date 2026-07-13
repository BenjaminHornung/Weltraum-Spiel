# fix-visible-ship-regression-v2 Test Protocol

Date: 2026-05-24
Workspace: E:\Unity\Weltraum Spiel\Weltraum Spiel
Unity: 6000.4.7f1

## Runtime Defect

Symptom: RCS effects were visible in Play Mode, but the imported Blender Scout ship model was effectively missing.

Root cause found in current runtime state: the imported FBX renderers existed and were enabled, but the default functional binder instantiated `ImportedDemoScoutVisual` with `localScale = 1`. The FBX is authored in centimeter-scale units, so the visible mesh bounds were tiny in Unity world units while the camera was framed for normal prototype scale.

Before-fix runtime renderer evidence:

- Example `DEMO_Scout_Mk1_GEO_Hull_Core_Faceted` MeshRenderer bounds size was approximately `(0.014, 0.010, 0.020)` Unity units.
- GameView screenshot before scale fix: `tests/screenshots/runtime-start-gameview.png`.

## Fix

- `PrototypeFunctionalShipBinder` now scales the visible imported FBX instance to `100f`.
- The physics/runtime binding still uses `FunctionalSocketRig` proxies with `localScale = Vector3.one`.
- `PrototypeBootstrap` visibility diagnostics now log active imported instance scale, visible non-VFX ship mesh renderer count, and visible ship mesh bounds size.
- Editor and PlayMode tests now assert visible imported mesh bounds, not only renderer presence.

After-fix runtime diagnostic:

```text
PrototypeBootstrap visibility diagnostics: buildMode=ImportedDemoScoutFunctionalDefault allowGeneratedFallbackWhenImportedAssetMissing=True useGeneratedFallbackBeforePolicy=False useGeneratedFallbackAfterPolicy=False hasRequiredFlightSockets=True hasRequiredWeaponSockets=True hasRequiredVisibleWeaponRenderers=True hasVisibleImportedShip=True missingRequiredSockets= missingWeaponSockets= missingVisibleWeaponRenderers= importedVisualRoot=True importedVisualRootActive=True importedShipInstance=ImportedDemoScoutVisual importedShipInstanceActive=True importedShipInstanceLocalScale=(100.0, 100.0, 100.0) functionalSocketRig=True importedRendererCount=126 importedEnabledRendererCount=81 importedVisibleMeshRendererCount=47 importedVisibleMeshBoundsSize=(2.42, 1.60, 4.39) generatedRendererCount=0 generatedEnabledRendererCount=0 cameraTargetDistance=19.0
```

## Screenshots

- GameView after fix: `tests/screenshots/runtime-start-gameview-scaled-ship.png`
- SceneView framed on `PrototypeShip`: `tests/screenshots/runtime-sceneview-prototypeship.png`
- Fresh Unity MCP GameView after fix: `tests/screenshots/runtime-start-gameview-scaled-ship-fresh.png`
- Fresh Unity MCP SceneView framed on `PrototypeShip`: `tests/screenshots/runtime-sceneview-prototypeship-fresh.png`
- GameView before fix / tiny model evidence: `tests/screenshots/runtime-start-gameview.png`

## Build And Script Validation

Command:

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore
```

Result: PASS, with known Unity/MCP assembly binding warnings and existing obsolete Unity API warnings.

Unity `validate_script`: 0 errors for:

- `Assets/Scripts/Prototype/PrototypeFunctionalShipBinder.cs`
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
- `Assets/Tests/Editor/PrototypeFunctionalShipSocketValidationTests.cs`
- `Assets/Tests/PlayMode/PrototypeFunctionalBlenderRuntimePlayModeTests.cs`

## Unity Test Framework

Focused EditMode:

- Job `28e3449346044e9b8baeca14b0ab7295`: PASS 1/1
- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderUsesImportedDemoScoutAsRuntimeRootWithoutFallbacks`

Additional EditMode:

- Job `0d43a11e6731473b975ac5153a71b76b`: PASS 4/4
- Fresh Unity MCP job `e27bded0ac3641c6906d179eb1b59b50`: PASS 5/5
- `PrototypeFunctionalShipSocketValidationTests.FunctionalBinderTreatsMissingTurretRenderersAsWeaponVisualDegradationOnly`
- `PrototypeShipVisualSwitcherValidationTests.ImportedVisualSwitcherKeepsGeneratedVisibleWhenImportedHasNoEnabledRenderers`
- `PrototypeAutopilotNavigationComputerV2ValidationTests.Planner_DirectCandidateWinsWhenClear`
- `PrototypeControlModeValidationTests.TranslationMode_WHeld_DoesNotAutoBrake`

Focused PlayMode:

- Job `6524f07d61e247d990224f255bc02006`: PASS 2/2
- Fresh Unity MCP job `18fd91ecf14246a5b9c002b887def3d4`: PASS 2/2
- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds`
- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeRegistersDefaultTargetForWeaponComputer`

The functional Blender runtime PlayMode test covers:

- Imported Scout remains default build/visual mode.
- Active imported visual has scale >= 50, more than 20 visible ship mesh renderers, and combined visible mesh bounds > 1 Unity unit.
- Functional sockets keep safe scale (`lossyScale ~= Vector3.one`).
- Main thruster applies thrust and plays particles at imported main nozzle.
- RCS pulse activates VFX near imported RCS nozzles and keeps angular velocity bounded.
- Weapon target selection works without debug fallback.
- Turret yaw/pitch values change over frames.
- Visible yaw and barrel meshes are children of the correct pivots and rotate with them.
- Line-of-fire blocker prevents firing.
- Auto fire eventually fires from `WEAPON_MUZZLE_PRIMARY` with projectile direction near `muzzle.forward`.

Navigation PlayMode:

- Job `a797290ba5ed474a95761d3f546d9a4d`: status succeeded, progress 2/2
- Fresh Unity MCP job `2847e37b79db45d3b15cb3ffc0829ab9`: PASS 2/2
- `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_ReachesWaypoint_NoObstacle`
- `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_AvoidsObstacle_ThenReachesWaypoint`

## Blender Validation

Command:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background "art\blender\prototype_modular_ship_kit_v0.blend" --python "art\blender\validate_ship_kit_meshes.py"
```

Result: PASS

- Object count: 475
- Mesh count: 266
- Missing Demo Scout functional markers: 0
- Demo Scout turret hierarchy issues: 0
- Meshes missing materials: 0
- Non-opaque materials: 0
- Negative scale objects: 0

## Tooling Notes

- Blender MCP direct scene call timed out/aborted, so Blender CLI validation was used and passed.
- `$claude-plan-review` was invoked with the current plan and screenshot paths, including the fresh Unity MCP screenshots. The wrapper timed out after 120 seconds again and produced no actionable review output.
- Unity MCP `execute_code` remains unreliable in this environment; verification used Unity Test Framework, Unity MCP screenshots, hierarchy/resource reads, console logs, and Blender CLI.
- Current worktree contains unrelated dirty/untracked package, HUD/UI, Asset Manager, and recovery files. They were not touched for this fix.
