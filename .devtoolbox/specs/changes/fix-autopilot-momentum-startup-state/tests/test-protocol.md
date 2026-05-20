# Test Protocol: fix-autopilot-momentum-startup-state

Date: 2026-05-20

## Spec Validation

- DevToolbox `specs_validate`
  - Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
  - Change: `fix-autopilot-momentum-startup-state`
  - Result: Passed
  - Evidence: proposal, design, tasks, 6 spec files, 29 parsed tasks.

## Unity MCP Validation

- `refresh_unity(scope=scripts, compile=request, wait_for_ready=true)`
  - Result: Ready after script compile/domain reload.
- `read_console(types=error)`
  - Result: 0 compiler errors after refresh.
- `validate_script`
  - `Assets/Scripts/Prototype/PlayerShipController.cs`: Passed, 0 errors.
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: Passed, 0 errors.
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: Passed, 0 errors.
  - `Assets/Scripts/Prototype/PrototypeMomentumAssist.cs`: Passed, 0 errors.
  - `Assets/Scripts/Prototype/FlightAssistRequest.cs`: Passed, 0 errors.
  - `Assets/Tests/Editor/PrototypeAutopilotMomentumStartupStateTests.cs`: Passed, 0 errors.

## Unity EditMode Tests

- Focused run: `PrototypeAutopilotMomentumStartupStateTests`
  - Job: `248fc52c0a5f450b8cad750ab2173bac`
  - Result: 7/7 passed.
- Full EditMode run
  - Job: `6dd83ace343d40119ac57042d13a27a9`
  - Result: 85/85 passed.
- Console after test runs
  - Unity MCP returned two `Saving results to ... TestResults.xml` entries typed as `Exception` without stack traces.
  - No C# compile errors were present.

## CLI Verification

- `dotnet build ".\Weltraum Spiel.sln" --no-restore`
  - Result: Passed.
  - Notes: Existing Unity/MCP assembly conflict warnings and existing/unrelated inspector-assignment warnings remain.
- `dotnet test ".\Weltraum Spiel.sln" --no-build`
  - Result: Passed.

## Review Follow-Up

- Reviewer found that final-approach lateral correction could be overwritten by the burn request.
- Fixed by aggregating waypoint lateral force, attitude torque, and main-throttle intent into one `WaypointAutopilot` `FlightAssistRequest`.
- Added regression coverage proving final-approach lateral velocity creates a nonzero external `forceWorld`.
- Removed duplicate control-mode label mapping from debug UI by using the controller diagnostics label.
