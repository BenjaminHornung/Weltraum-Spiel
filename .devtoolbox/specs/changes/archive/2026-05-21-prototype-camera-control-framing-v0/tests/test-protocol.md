# Test Protocol: prototype-camera-control-framing-v0

Date: 2026-05-20
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity: 6000.4.7f1

## Automated Verification

- `specs_validate --change prototype-camera-control-framing-v0`: passed after removing the scaffold `specs/default/spec.md`; four requested capability specs remain.
- Local Unity docs checked:
  - `E:\Unity\Documentation\en\ScriptReference\Renderer-bounds.html`: `Renderer.bounds` is a world-space AABB.
  - `E:\Unity\Documentation\en\ScriptReference\Input.GetAxis.html`: legacy axis behavior noted; project uses Input System for runtime input.
  - `E:\Unity\Documentation\en\ScriptReference\Transform.TransformDirection.html`: local direction to world direction for FreeInspect movement.
  - `E:\Unity\Documentation\en\ScriptReference\Camera-main.html`: `Camera.main` is acceptable for low-frequency visual-switch notification.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/SimpleFollowCamera.cs`: 0 errors, 1 heuristic warning.
  - `Assets/Scripts/Prototype/PrototypeShipVisualSwitcher.cs`: 0 errors, 3 heuristic warnings.
  - `Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: 0 errors, 2 heuristic warnings.
  - `Assets/Scripts/Prototype/PrototypeFlightHud.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/PrototypeKeybindOverlay.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 heuristic warnings.
  - `Assets/Tests/Editor/PrototypeSimpleFollowCameraValidationTests.cs`: 0 errors, 0 warnings.
- Post-manual-feedback correction:
  - Mouse-wheel zoom now clamps against visible visual-bounds radius, so extreme zoom-in cannot move through or past large imported ship visuals.
  - `ChaseLocked`, `OrbitInspect`, and `Side` now share the same visual-bounds focus point, so framed visuals can be offset from the gameplay transform without losing the anchor.
  - Added editor validation coverage for large-bounds zoom clamp and offset visual focus.
- Unity MCP `refresh_unity` with script compile: completed; editor returned ready.
- Unity MCP `read_console` after compile: no errors after fixing NUnit constraint compatibility; remaining warnings were pre-existing obsolete API and MCP transport noise.
- Unity MCP targeted EditMode tests: `PrototypeSimpleFollowCameraValidationTests` passed 4/4.
- Unity MCP full EditMode suite: passed 89/89.
- `dotnet build "Weltraum Spiel.sln"`: passed. Known warnings remain for Unity/MCP assembly version conflicts and existing serialized fields.
- `dotnet test "Weltraum Spiel.sln"`: exit 0.
- Later local `dotnet build "Weltraum Spiel.sln"` after unrelated dirty Autopilot test edits failed in `PrototypeWaypointAutopilotValidationTests.cs` with ambiguous `Object` references. Those files are outside this camera workitem and were left unstaged for this commit.
- DevToolbox `verify_run`: failed its default Build/Test/Lint steps because it runs naked `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a Unity root with multiple project/solution files (`MSB1011`). The project-specific explicit solution commands above passed.
- `tasks_completion_preflight`: run after evidence; blocked because latest DevToolbox verification result is failed. No tasks were toggled.

## Runtime Scene Probe

- Entered PlayMode with `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Confirmed the runtime bootstrap binds `Main Camera` with:
  - `SimpleFollowCamera`
  - `PrototypeDebugOverlay`
  - `PrototypeFlightHud`
  - `PrototypeKeybindOverlay`
  - `PrototypeFlightDebugConsole`
- Runtime camera state observed:
  - mode: `ChaseLocked`
  - `BaseVisualDistance`: `18.00`
  - `EffectiveDistance`: `18.00`
  - `BaseVisualBoundsRadius`: about `4.54`
  - target: `PrototypeShip`
- Scene validation reported 0 missing scripts and 0 broken prefabs.
- After clearing transient console output, Unity MCP `read_console` returned 0 errors/warnings.

## Visual Switch Probe

Executed a PlayMode probe that cycled `PrototypeShipVisualSwitcher` through the available modes and forced camera reframe:

- `Imported Demo Scout`: `mode=ChaseLocked`, `base=18.00`, `effective=18.00`, `radius=4.60`
- `Imported Demo Cargo`: `mode=ChaseLocked`, `base=18.00`, `effective=18.00`, `radius=4.60`
- `Generated Primitives`: `mode=ChaseLocked`, `base=18.00`, `effective=18.00`, `radius=4.62`

The notification/reframe path executed without console errors. The observed scout/cargo radii are close to generated primitives in the current runtime setup, so manual inspection should still verify final art feel after prefab assignments change.

## Manual PlayMode Checklist

Status: protocol written; automated/runtime probes completed. Human visual feel checks should be run in the Game view before accepting final art tuning.

- [ ] Generated primitives visible and usefully framed.
- [ ] F6 Scout framed correctly.
- [ ] F6 Cargo framed correctly.
- [ ] Mouse wheel zoom works in `ChaseLocked`.
- [ ] Mouse wheel zoom works in `OrbitInspect`.
- [ ] Mouse wheel zoom works in `Side`.
- [ ] Mouse wheel zoom works in `FreeInspect`.
- [ ] `FreeInspect` can move around the ship while RMB is held.
- [ ] Reset camera returns to useful `ChaseLocked` framing.

## Residual Notes

- `dotnet build` still emits known Unity/MCP assembly conflict warnings (`System.Net.Http`, `System.IO.Compression`) and existing serialized-field warnings.
- `PrototypeTestEnvironmentValidationTests` still emits an unrelated obsolete API warning for `FindObjectsSortMode`.
- No gameplay physics or `ShipStats` follow-distance persistence changes were made for camera zoom/framing.
