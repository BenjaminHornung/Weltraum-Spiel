# fix-functional-blender-runtime-v3 Test Protocol

Date: 2026-05-24
Workspace: E:\Unity\Weltraum Spiel\Weltraum Spiel
Unity: 6000.4.7f1

## Runtime Defect

Symptom: the player could see RCS/marker effects, but the imported Blender Scout body was not readable in the Game View.

Current runtime diagnosis showed the ship root and imported visual existed, but `SimpleFollowCamera` framed against non-ship renderers under `PrototypeShip`. The camera visual bounds were inflated to radius `22.21`, with effective camera distance `59.30m`, while the imported Scout body bounds were only about `2.42 x 1.60 x 4.39`.

Before-fix evidence:

- GameView: `tests/screenshots/current-repro-gameview.png`
- SceneView/MCP framing attempt: `tests/screenshots/current-repro-sceneview.png`
- Camera state before fix: `VisualBoundsRadius=22.21`, `EffectiveDistance=59.30`, `VisualBoundsRendererCount=84`.

## Fix

- `SimpleFollowCamera` now prefers the active imported Blender visual root when calculating camera visual bounds.
- For imported visuals, only real `DEMO_*` ship mesh renderers contribute to camera framing through `PrototypeShipVisualBoundsUtility`.
- Socket, connector (`CONN_*`), hardpoint, nozzle, muzzle, turret marker, VFX, ring, label, debug, and marker renderers no longer push the player camera away from the ship.
- Generated/fallback ships still use the existing general renderer bounds path.

After-fix runtime evidence:

- GameView: `tests/screenshots/after-camera-bounds-fix-gameview.png`
- GameView after shared utility / connector-filter review fix: `tests/screenshots/after-connector-filter-gameview.png`
- SceneView/MCP framing attempt: `tests/screenshots/after-camera-bounds-fix-sceneview.png`
- Camera state after fix: `VisualBoundsRadius=2.63`, `EffectiveDistance=18.00`, `VisualBoundsRendererCount=43`.
- The GameView screenshot shows the imported Scout body centered and readable, with RCS/marker overlays still visible.

## Unity Docs Checked

Local Unity 6.4 docs were checked for the camera/renderer APIs used in the new assertions:

- `E:\Unity\Documentation\en\ScriptReference\Camera.WorldToViewportPoint.html`
- `E:\Unity\Documentation\en\ScriptReference\Renderer-bounds.html`

## Unity Script Validation

Unity MCP `validate_script`:

- `Assets/Scripts/Prototype/PrototypeShipVisualBoundsUtility.cs`: 0 errors.
- `Assets/Scripts/Prototype/SimpleFollowCamera.cs`: 0 errors, 2 existing heuristic warnings.
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors.
- `Assets/Tests/Editor/PrototypeSimpleFollowCameraValidationTests.cs`: 0 errors.
- `Assets/Tests/PlayMode/PrototypeFunctionalBlenderRuntimePlayModeTests.cs`: 0 errors.

## Unity Test Framework

Editor:

- Job `b351c663a4c34730bf90ad1ace5e510a`: PASS 1/1.
- Job `dd1be10680704c9681cfe8b6bed9cf45`: PASS 4/4.
- Final job `7e9d168408604ddc99b00d5df4cff351`: PASS 4/4.

PlayMode:

- Job `d0c68bb650934f43850b51b6b5904605`: PASS 2/2.
- Job `3d2eabedc06c46a19e9022b97f32fc4b`: PASS 2/2.
- Final functional Blender job `e74c6762e0574a199afba7df4c513037`: PASS 2/2.
- Final navigation job `3012a658a615488ea29afd82adfd8925`: PASS 2/2.

Coverage notes:

- `PrototypeFunctionalBlenderRuntimePlayModeTests.BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds` now asserts imported visual scale, real ship mesh renderer count, visual bounds radius, camera effective distance, and projected viewport area.
- The same PlayMode test still covers main thruster force/VFX, RCS pulse/VFX, bounded angular velocity, target selection, turret yaw/pitch motion, visible yaw/barrel hierarchy, line-of-fire block, auto-fire, muzzle flash/projectile origin, and muzzle-forward projectile direction.
- `PrototypeAutopilotNavigationPlayModeTests` covers navigation/no-obstacle and obstacle-avoidance movement.

Intermediate failure that caught the threshold:

- Job `3655c532781a4f60a1ae0568152afa43` failed because the first viewport-area threshold was slightly too high (`0.011636` vs `0.012`). The final threshold still fails the old 59m camera state by a wide margin and passes the visible 18m camera state.

## Build

Command:

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore
```

Result: PASS, 25 warnings, 0 errors. Warnings are the existing Unity/MCP assembly binding and obsolete/unused-field warnings.

## Blender Validation

Command:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background "art\blender\prototype_modular_ship_kit_v0.blend" --python "art\blender\validate_ship_kit_meshes.py"
```

Result: PASS.

- Object count: 475
- Mesh count: 266
- Missing functional markers: 0
- Turret hierarchy issues: 0
- Missing material meshes: 0
- Negative scale objects: 0

## Tooling Notes

- Unity MCP `execute_code` remains unusable in this environment due a `filename or extension is too long` Mono invocation failure, so runtime state was gathered through Unity MCP hierarchy/resources, console, tests, and screenshots.
- Unity MCP SceneView framing did not reliably focus `PrototypeShip`; GameView screenshots are the primary player-facing evidence.
- Claude plan-review was attempted with the GameView screenshot path as requested. The wrapper timed out after local context submission, so no Claude findings were available to apply.
