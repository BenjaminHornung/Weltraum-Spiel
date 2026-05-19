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
