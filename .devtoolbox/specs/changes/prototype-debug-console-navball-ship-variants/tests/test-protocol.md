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

- `PrototypeShipVariant` as a `ScriptableObject` variant wrapper.
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
