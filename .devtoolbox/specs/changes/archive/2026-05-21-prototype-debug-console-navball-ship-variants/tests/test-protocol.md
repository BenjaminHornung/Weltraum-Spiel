# Test Protocol: prototype-debug-console-navball-ship-variants

## Scope

Slice 1 implemented the prototype flight debug console and RCS allocator diagnostics.

## Unity MCP Validation

- `validate_script Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 pre-existing/performance warning about string concatenation in Update
- `validate_script Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings
- `validate_script Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings

## Unity EditMode Tests

- Job: `2fcd7276703141878215bb3dabd1d7fa`
- Result: Passed
- Total: 36
- Passed: 36
- Failed: 0
- Skipped: 0

New focused regression coverage:

- `PrototypePhysicsValidationTests.RcsUnavailableCommandsKeepDesiredResidualDiagnostics`

## Console Check

- `read_console` with `filter_text: error CS`: 0 entries
- Unity console still reports the TestResults.xml save message as an Exception-typed log entry; no C# compiler errors were present.

## DevToolbox Verification

- `verify_run` passed the DevToolbox specs step.
- `verify_run` failed its generic Build/Test/Lint steps because it runs `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` from the Unity project root without specifying a solution; MSBuild reports MSB1011 because multiple project/solution files exist.
- Follow-up explicit command: `dotnet build ".\Weltraum Spiel.sln"` succeeded with existing Unity/MCP assembly warnings and 0 errors.
- Follow-up explicit command: `dotnet test ".\Weltraum Spiel.sln" --no-build` exited successfully.

## Review Follow-Up

Reviewer finding fixed:

- Disabled/no-RCS/no-authority RCS requests now preserve desired force/torque, report zero actual output, full residual output, zero nozzle usage, and an allocator status (`disabled`, `no nozzles`, or `no authority`).

## Not Yet Verified

- Runtime clicking of every IMGUI button in Play Mode.
- Visual appearance of debug vector/gizmo toggles in the Game view.
- Ship variant selector beyond its Slice 1 placeholder state.

## Slice 2 Data Model And Main Thruster Bank

Added prototype-only data models and the first aggregate path for future ship variants:

- `PrototypeShipVariant` as a runtime built-in variant wrapper.
- `PrototypeShipLayout` with inline serializable module, main-thruster, RCS-block, and gun layout entries.
- `MainThrusterBank` as an aggregate over one or more `MainThrusterModule` instances.
- `ApplySettings` helpers for ship stats, main thruster, RCS, gun, and RCS block code paths so future generated variants do not need to pass a full `PrototypeShipConfig` object everywhere.

Validation:

- `validate_script Assets/Scripts/Prototype/PrototypeShipVariant.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PrototypeShipLayout.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/MainThrusterBank.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/GunModule.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/RcsThrusterBlock.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing/performance warning about string concatenation in `Update`
- `read_console` with `filter_text: CS`: 0 C# compiler error entries
- Unity EditMode job `6451ca8831a44c719459cc73ad0b0c06`: 46 total, 46 passed, 0 failed, 0 skipped
- `dotnet build ".\Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP assembly conflict warnings and 0 errors

Not yet included in this slice:

- Bootstrap variant spawning.
- Concrete named variant assets or generated variant selection.
- Runtime verification of dual-engine/off-center/one-sided/no-RCS variant behavior.
- Navball HUD.

## Slice 2 Runtime Variant Wiring

Added generated runtime variants and debug-console selection without introducing a final ship editor:

- `PrototypeBootstrap` can rebuild the generated prototype from the selected `PrototypeShipLayout`.
- Built-in runtime variants are available: Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, and No-RCS.
- `PrototypeFlightDebugConsole` can cycle variants and spawn the selected variant.
- Camera, controller, debug overlay, debug console, RCS, gun, engine VFX, mass descriptors, and test target wiring are rebound after variant spawn.
- `PrototypeBootstrap.ApplyMaterialColor` now uses edit-mode-safe material assignment so EditMode variant tests do not log material leak errors.

Validation:

- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PrototypeShipLayout.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PrototypeShipVariant.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/ModuleMassDescriptor.cs`: 0 errors, 0 warnings
- `validate_script Assets/Scripts/Prototype/EngineVfxController.cs`: 0 errors, 1 existing advisory about Rigidbody operations
- `validate_script Assets/Tests/Editor/PrototypeShipVariantValidationTests.cs`: 0 errors, 0 warnings
- `read_console` with `filter_text: CS`: 0 C# compiler error entries
- Focused Unity EditMode job `03f88ace933944b88db2403b06d65bc9`: 6 total, 6 passed, 0 failed, 0 skipped
- Full Unity EditMode job `81f82a2c5fad4e489c100b6a56c54072`: 52 total, 52 passed, 0 failed, 0 skipped
- `dotnet build ".\Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP assembly conflict warnings and 0 errors

New focused regression coverage:

- Built-in variants expose the expected six prototype cases.
- Baseline variant builds a stable rig and rebinds the debug console.
- Dual Main Thruster symmetric COM-safe thrust has near-zero unintended torque.
- Off-Center Main Thruster shows fully physical offset-engine torque.
- One-Sided RCS reports allocator residuals for unsupported translation.
- No-RCS reports missing RCS authority.

Still not verified:

- Per-engine disable/single-engine failure torque behavior.
- Navball HUD behavior.

## Slice 2 Variant Bootstrap And Spawns

Finished the layout-driven spawn path for built-in prototype variants:

- `PrototypeBootstrap` now builds from the selected `PrototypeShipLayout`, clears and rebuilds generated ship children, binds the camera/debug console after each spawn, and rebinds engine VFX to the selected main thruster nozzle.
- Built-in variants now cover Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, and No-RCS.
- The debug console variant selector can cycle variants and respawn the selected generated ship.
- `PrototypeShipVariantValidationTests` covers built-in ordering, baseline spawn wiring, symmetric dual-main thrust, off-center physical torque, one-sided RCS residual diagnostics, and no-RCS authority reporting.

Validation:

- `dotnet build ".\Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP assembly conflict warnings and 0 errors.
- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/EngineVfxController.cs`: 0 errors, 1 Rigidbody/FixedUpdate guidance warning.
- `validate_script Assets/Scripts/Prototype/ModuleMassDescriptor.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PrototypeShipVariant.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Tests/Editor/PrototypeShipVariantValidationTests.cs`: 0 errors, 0 warnings.
- `read_console` for Unity errors after forced script refresh: 0 entries.
- Unity EditMode job `2a1e13c5f79945a7ab8a71db2f87e141`: 52 total, 52 passed, 0 failed, 0 skipped.
- `dotnet test ".\Weltraum Spiel.sln" --no-build`: exited successfully.

DevToolbox verification:

- `verify_run` passed the specs step.
- `verify_run` still failed its generic Build/Test/Lint steps because it invokes `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` from the Unity project root without specifying the solution. MSBuild reports MSB1011 because multiple project/solution files exist. Explicit solution-scoped build/test commands above passed.

Still not included:

- Navball HUD.
- Runtime browser-style clicking of every IMGUI debug button.
- README and physics-doc updates for the completed variant selector.

## Slice 3 Navball-Light HUD

Added the first temporary flight HUD without adding final HUD art or a full 3D navball:

- `PrototypeFlightHud` is created on the main camera and rebound by `PrototypeBootstrap.SetupMainCamera` after every generated ship or variant spawn.
- The HUD draws a lightweight IMGUI navball circle with center forward/crosshair marker, velocity prograde/retrograde markers, SAS hold marker, optional target marker, and optional desired/actual/residual RCS force markers for debug vector mode.
- Mode label structure is present for `WORLD`, `VELOCITY`, `TARGET`, `DOCKING`, and `ORBIT/GRAVITY`.
- README now documents the temporary HUD and marks debug console actions as debug-only.
- `docs/physics-flight-model.md` documents variant-test purpose, residual RCS diagnostics, and the HUD vector projection formula.

Focused validation:

- `validate_script Assets/Scripts/Prototype/PrototypeFlightHud.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Tests/Editor/PrototypeFlightHudValidationTests.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings.
- Unity EditMode job `a8b9cec58092453db089da9f697e8bc2`: 3 total, 3 passed, 0 failed, 0 skipped.
- Unity console query for C# compiler errors: 0 entries.
- Full Unity EditMode job `7f16fcc7389d4c488265f5acd5eeeedc`: 55 total, 55 passed, 0 failed, 0 skipped.
- `dotnet build ".\Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP assembly conflict warnings and existing serialized-field warnings, 0 errors.
- `dotnet test ".\Weltraum Spiel.sln" --no-build`: exited successfully.
- `specs_validate prototype-debug-console-navball-ship-variants`: passed.

DevToolbox verification:

- `verify_run` passed the specs step.
- `verify_run` still failed its generic Build/Test/Lint steps because it invokes `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` from the Unity project root without specifying the solution. MSBuild reports MSB1011 because multiple project/solution files exist. Explicit solution-scoped build/test commands above passed.

New focused regression coverage:

- `HudComputesProgradeAndRetrogradeMarkersFromShipLocalVelocity` confirms velocity markers move to opposite ship-local sides and switch the HUD mode label to `VELOCITY`.
- `HudShowsSasHoldAndTargetMarkersWhenAvailable` confirms SAS and target markers are available when a controller hold attitude and target dummy exist.
- `BootstrapBindsHudAfterVariantSpawn` confirms `PrototypeBootstrap` binds `PrototypeFlightHud` after baseline and one-sided variant spawns and keeps the controller reference connected.

## Slice 4 Remaining Verification Closeout

Added focused verification for the three remaining open checks:

- `DebugConsoleBackedActionsMirrorRuntimeControllerState` verifies the runtime methods used by the debug console for RCS, SAS, precision controls, cut/full throttle, refuel, reset velocity, and reset angular velocity produce the same controller state changes used by the keyboard-driven systems.
- `DebugVectorTogglesUpdateRuntimeOverlayState` verifies runtime debug vector and gizmo toggles mutate `PrototypeDebugOverlay` state.
- `DualMainThrusterSingleEngineFailureCreatesExpectedPhysicalTorque` verifies a Dual Main Thruster variant with one engine disabled by the existing thermal shutdown path produces one-engine thrust and the expected fully physical off-center torque.

Focused validation:

- `manage_script validate Assets/Tests/Editor/PrototypeShipVariantValidationTests.cs`: 0 diagnostics.
- Unity console query for C# compiler errors: 0 entries.
- Unity EditMode job `e8f0f238b88542a9ab4de4cefba0e6a6`: 58 total, 58 passed, 0 failed, 0 skipped.
- `dotnet build ".\Weltraum Spiel.sln" --no-restore`: passed with existing Unity/MCP assembly conflict warnings, 0 errors.
- `dotnet test ".\Weltraum Spiel.sln" --no-build`: exited successfully.

DevToolbox verification:

- `specs_validate prototype-debug-console-navball-ship-variants`: passed.
- `verify_run` passed the specs step.
- `verify_run` still failed generic Build/Test/Lint steps because it invokes `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` from the Unity project root without specifying `Weltraum Spiel.sln`. MSBuild reports MSB1011 because multiple project/solution files exist. Explicit solution-scoped build/test commands above passed.
