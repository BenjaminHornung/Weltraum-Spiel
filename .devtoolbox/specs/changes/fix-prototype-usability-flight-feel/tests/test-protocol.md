# Test Protocol: fix-prototype-usability-flight-feel

Date: 2026-05-20

## Scope

Validated the spec-driven usability/flight-feel change covering:

- UI declutter, scrollable keybind help, minimap filters/default labels off.
- Autopilot discoverability in HUD and debug console.
- RCS Maneuver Mode with Attitude and Translation layers.
- Physical Kill Momentum / Momentum Assist path.
- Ship module and VFX readability.
- README and physics-flight-model documentation alignment.

## DevToolbox

- `specs_validate(workspaceRoot=E:\Unity\Weltraum Spiel\Weltraum Spiel, changeName=fix-prototype-usability-flight-feel)` passed.
- Parsed artifacts: proposal, design, tasks, 5 capability specs, 56 task items.

## Unity MCP Script Validation

All changed scripts were validated with Unity MCP `validate_script`.

Scripts with 0 errors / 0 warnings:

- `Assets/Scripts/Prototype/FlightAssistRequest.cs`
- `Assets/Scripts/Prototype/MainThrusterModule.cs`
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
- `Assets/Scripts/Prototype/PrototypeFlightHud.cs`
- `Assets/Scripts/Prototype/PrototypeKeybindOverlay.cs`
- `Assets/Scripts/Prototype/PrototypeMinimapOverlay.cs`
- `Assets/Scripts/Prototype/PrototypeModuleColorPalette.cs`
- `Assets/Scripts/Prototype/PrototypeTestEnvironment.cs`
- `Assets/Scripts/Prototype/RcsThrusterController.cs`
- `Assets/Tests/Editor/PrototypeMomentumAssistValidationTests.cs`

Scripts with 0 errors and accepted MCP analyzer warnings:

- `Assets/Scripts/Prototype/EngineVfxController.cs`: MCP heuristic warning "Consider using FixedUpdate() for Rigidbody operations". Accepted because this script only controls generated engine VFX state; physical force application remains in thruster/physics systems.
- `Assets/Scripts/Prototype/PlayerShipController.cs`: MCP heuristic warning "String concatenation in Update() can cause garbage collection issues". Accepted as an existing prototype IMGUI/diagnostic pattern; no compiler warning.
- `Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: MCP heuristic warnings for Rigidbody operations/string concatenation. Accepted because this is editor/debug IMGUI diagnostics and debug action UI.
- `Assets/Scripts/Prototype/PrototypeMomentumAssist.cs`: MCP heuristic warning "String concatenation in Update() can cause garbage collection issues". Accepted; the assist has no `Update()` method and the warning is a broad analyzer heuristic, not a compiler diagnostic.

## Unity Refresh / Console

- `refresh_unity(scope=scripts/all, compile=request, wait_for_ready=true)` completed after the new `PrototypeMomentumAssist` import.
- `read_console(types=error,warning)` after final compile returned no script compiler errors.
- Console warnings observed after test runs were Unity Test Runner / MCP transport noise:
  - MCP WebSocket "not initialised" warning from the MCP package.
  - Unity Test Runner prebuild/postbuild cleanup warnings.
  - Unity Test Runner "Saving results to ... TestResults.xml" entries surfaced as Exception log type, with tests passing.

## Unity EditMode Tests

First full run found two regressions:

- EditMode material instantiation log from new engine-nozzle-ring VFX using `renderer.material`.
- RCS diagnostics counted visible VFX nozzles instead of physically active nozzles when a throttle was below the visual threshold.

Fixes applied:

- `EngineVfxController` now uses `sharedMaterial` in EditMode and `DestroyImmediate` for the generated ring collider outside Play Mode.
- `RcsThrusterController` now counts physically active nozzles separately from VFX visibility.

Focused rerun:

- Job `338b627fc8d44172980fd5ead5f2f252`
- Tests: 4/4 passed.

Final full run before PlayMode visual pass:

- Job `0bc683fbaf3c49c9956a68350a9733a7`
- Mode: EditMode
- Result: 71/71 passed, 0 failed, 0 skipped.

Final full run after PlayMode visual pass/label scaling:

- Job `6d9b26a53d2f45a19e7bf91258f7ecfd`
- Mode: EditMode
- Result: 71/71 passed, 0 failed, 0 skipped.

Final full run after formatting cleanup in changed controller files:

- Job `a97a4268ecb2487cb6ca2269ef30f1d9`
- Mode: EditMode
- Result: 71/71 passed, 0 failed, 0 skipped.

## Local CLI Verification

- `dotnet build "Weltraum Spiel.sln"`: exit 0.
  - Existing warnings accepted: Unity/MCP `MSB3277` assembly version conflicts, existing unassigned serialized fields, and existing obsolete `FindObjectsSortMode` test API warning.
- `dotnet test "Weltraum Spiel.sln"`: exit 0.
- `git diff --check`: no whitespace errors; only Git line-ending conversion warnings.
- DevToolbox `verify_run` was attempted after external verification was recorded. Its `Specs` step passed, but default `Build`, `Test`, and `Lint` failed with MSB1011 because the Unity workspace root contains multiple project/solution files and those default steps run naked `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without specifying `Weltraum Spiel.sln`. This is tracked as a DevToolbox/default-command limitation for this Unity root; explicit solution-scoped build/test above remain green.
- `dotnet format "Weltraum Spiel.sln" --verify-no-changes --no-restore` was also run. Formatting issues in changed files were fixed; the remaining failures are pre-existing/unrelated formatting in `PrototypeShipLayout.cs`, `ShipStats.cs`, `SimpleFollowCamera.cs`, and `Assets/TutorialInfo/Scripts/Editor/ReadmeEditor.cs`.

## Code Inspection Checks

- Stale player-facing text search found no remaining runtime/README/docs `precision controls` references. The only remaining `Precision Mode` text is an unchecked DevToolbox task describing the migration task.
- Kill Momentum path inspection:
  - `PrototypeMomentumAssist.cs` has no direct `.linearVelocity =`, `.angularVelocity =`, `ResetVelocity`, `ResetAngularVelocity`, or `ResetPosition` calls.
  - Direct velocity resets remain only in existing explicit debug reset methods on `PlayerShipController`.

## Manual / Visual Inspection

Play Mode was entered through Unity MCP `manage_editor(action=play)`. Game View screenshots revealed two default readability issues:

- The first screenshot showed `Target Close` as a huge world label.
- Follow-up screenshots showed the origin marker/axes still too strong near spawn.

Fixes applied:

- Training mode now labels only origin, station, first target, and first beacon; gate/range-ring labels stay off by default.
- Training label character size is much smaller.
- Origin beacon and environment line widths are scaled down outside FullDebug.

Final screenshot evidence:

- `.devtoolbox/specs/changes/fix-prototype-usability-flight-feel/tests/screenshots/playmode-environment-declutter.png`

- HUD quick actions bind to waypoint autopilot, Kill Momentum, RCS Maneuver Mode, and SAS.
- Keybind overlay is scrollable and documents RCS Attitude/Translation layers.
- Minimap labels default off and filtered.
- Environment display mode defaults away from Full Debug.
- Visual module contrast and VFX are primitive-only and generated at runtime.

## Critical Follow-up: Control Mode / HUD State / Momentum Assist

Additional verification after the control-mode correction:

- DevToolbox `specs_validate(workspaceRoot=E:\Unity\Weltraum Spiel\Weltraum Spiel, changeName=fix-prototype-usability-flight-feel)` passed with 5 spec files and 64 parsed task items.
- Unity MCP `refresh_unity(scope=scripts, compile=request, wait_for_ready=true)` completed and `read_console(types=error)` reported 0 compiler errors.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 accepted analyzer warning about string concatenation in Update.
  - `Assets/Scripts/Prototype/PrototypeFlightHud.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: 0 errors, accepted analyzer warnings for debug/IMGUI prototype code.
  - `Assets/Scripts/Prototype/PrototypeMomentumAssist.cs`: 0 errors, accepted broad analyzer warning.
  - `Assets/Tests/Editor/PrototypeControlModeValidationTests.cs`: 0 errors, 0 warnings.
- Unity MCP focused EditMode run:
  - Job `c85f76b97399469f999f5407efbd3d63`
  - `PrototypeControlModeValidationTests`: 5/5 passed.
- Unity MCP full EditMode run:
  - Job `598a141f21724dc5bb18cf4305a66319`
  - 76/76 passed, 0 failed, 0 skipped.
- Local CLI:
  - `dotnet build ".\Weltraum Spiel.sln" --no-restore`: exit 0 with existing Unity/MCP warnings.
  - `dotnet test ".\Weltraum Spiel.sln" --no-build`: exit 0.

Behavior covered:

- `FlightControlMode` cycles Normal -> Precision -> Translation -> Normal.
- Translation mode maps W/S and A/D to linear RCS translation and leaves pitch/yaw at zero.
- Precision and Translation force main throttle and gimbal authority off.
- UI state is available through `PrototypeFlightControlDiagnostics`.
- HUD, Flight Diagnostics, and Debug Console read SAS/RCS/control mode from the controller diagnostics snapshot.
- HUD mode button cycles the same mode as Caps Lock; Left Alt is no longer used as the primary translation switch.
- Kill Momentum remains wired through `PrototypeMomentumAssist`; Debug Console now exposes Engage/Abort plus state, speed, angular speed, brake direction, desired force, requested torque, throttle request, and authority/status.
