# Test Protocol: prototype-waypoint-navigation-autopilot-v0

Date: 2026-05-20

## Scope

Implemented the validated `prototype-waypoint-navigation-autopilot-v0` change:

- Promoted draft into active DevToolbox change with `proposal.md`, `design.md`, `specs/navigation-autopilot/spec.md`, and `tasks.md`.
- Added `PrototypeNavigationTarget`, `PrototypeWaypointManager`, and `PrototypeWaypointAutopilot`.
- Wired generated waypoints/autopilot into `PrototypeBootstrap`.
- Extended `PrototypeDebugOverlay` with navigation/autopilot telemetry.
- Updated README controls and known limits.
- Added EditMode coverage for waypoint generation/selection, required states, stopping-distance math, initial velocity, fuel feasibility, and no direct Rigidbody motion writes.

## Commands And Results

### DevToolbox spec validation

Command:

```text
specs_validate prototype-waypoint-navigation-autopilot-v0
```

Result: Passed.

Evidence:

- Proposal exists.
- Tasks exists.
- 1 spec file found.
- Design exists.
- 34 task items parsed.
- Change root resolves inside `.devtoolbox/specs`.

### dotnet build

Command:

```text
dotnet build "Weltraum Spiel.sln"
```

Result: Passed.

Notes:

- Existing Unity/MCP reference warnings remain (`MSB3277` for `System.Net.Http` and `System.IO.Compression`).
- Existing serialized-field warnings remain for unrelated fields such as `DockingPort.hardLockCreatesJoint`, `PrototypeBootstrap.shipConfig`, and `PrototypeAtmosphereVolume.windVelocity`.

### dotnet test

Command:

```text
dotnet test "Weltraum Spiel.sln"
```

Result: Passed / no failing test output.

### Unity MCP custom tools check

Resource:

```text
mcpforunity://custom-tools
```

Result: Available. Tools include `validate_script`, `refresh_unity`, `run_tests`, `get_test_job`, `read_console`, and editor management tools.

### Unity MCP validate_script

Validated:

- `Assets/Scripts/Prototype/PrototypeNavigationTarget.cs`
- `Assets/Scripts/Prototype/PrototypeWaypointManager.cs`
- `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
- `Assets/Scripts/Prototype/PlayerShipController.cs`
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`
- `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`

Result: 0 errors.

Notes:

- Analyzer warnings only:
  - `PrototypeWaypointAutopilot.cs`: string concatenation/Update GC hint.
  - `PlayerShipController.cs`: existing string concatenation/Update GC hint.
  - `PrototypeDebugOverlay.cs`: existing IMGUI/Rigidbody-operation style hints.

### Unity MCP refresh_unity

Command:

```text
refresh_unity scope=scripts compile=request mode=force wait_for_ready=true
```

Result: Passed after compile/domain reload.

Console errors after refresh: 0.

### Unity MCP EditMode tests

First run:

- Job: `5d238314ae5f4418a738312c2ab26a7c`
- Result: Failed to initialize.
- Cause: Editor was stuck in playmode transition; tests did not start within timeout.

Recovery:

- Stopped play mode with Unity MCP `manage_editor stop`.
- Refreshed scripts again.
- Console errors after refresh: 0.

Second run:

- Job: `103d4ffe25b04fe49bcfaebee3bca2a9`
- Mode: EditMode
- Result: Passed
- Total: 66
- Passed: 66
- Failed: 0
- Skipped: 0
- Duration: 0.825241 seconds

### ServiceRunner verify_run

Command:

```text
verify_run eff36fbe9a414014a15ba89afa644b1f
```

Result: Mixed.

- Specs step passed.
- Generic Build/Test/Lint steps failed with `MSB1011` because ServiceRunner invoked `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` from a Unity root containing multiple project/solution files.

Interpretation:

- This is the known generic-verify limitation for this Unity workspace.
- Explicit solution-based verification above passed for build/test.
- Unity MCP compile and EditMode tests passed.

## Acceptance Notes

- Runtime autopilot code does not assign `Rigidbody.position`, `Rigidbody.rotation`, `Rigidbody.linearVelocity`, or `Rigidbody.angularVelocity`.
- Source-level guard test verifies no direct Rigidbody motion-state assignment in `PrototypeWaypointAutopilot.cs`.
- Main thrust is commanded through `PlayerShipController.SetMainThrottle`, preserving existing main-thruster/fuel behavior.
- RCS/SAS assistance uses `PlayerShipController` pulse requests, preserving the existing physical RCS allocator path.
- Low fuel enters `FuelInsufficient` before commanding a maneuver.
