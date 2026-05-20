# Test Protocol: prototype-autopilot-arrival-tuning-v1

Date: 2026-05-20

## Prerequisite

- Verified prerequisite `fix-autopilot-momentum-startup-state` is completed in DevToolbox with 29/29 tasks.
- Current `main` and `origin/main` are at commit `a33d20a`.

## Spec Validation

- DevToolbox `specs_validate`
  - Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
  - Change: `prototype-autopilot-arrival-tuning-v1`
  - Result: Passed
  - Evidence: proposal, design, tasks, 3 spec files, 13 parsed tasks.

## Unity API Verification

- Local Unity 6.4 docs checked:
  - `E:\Unity\Documentation\en\ScriptReference\Rigidbody-linearVelocity.html`
  - `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`
- Relevant finding: `linearVelocity` is world-space velocity and should not be modified directly for ordinary physics control; `AddForce` accumulates force for the next physics simulation step.
- Implementation preserves the existing `FlightAssistRequest`/physical-control route and keeps the source-level no-direct-Rigidbody-write guard.

## Unity MCP Script Validation

- `refresh_unity(scope=scripts, compile=request, wait_for_ready=true)`
  - Result: Passed after script compile/domain reload.
- `validate_script`
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: Passed, 0 errors, 1 existing warning about string concatenation in `Update()`.
  - `Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: Passed, 0 errors, 2 analyzer warnings.
  - `Assets/Scripts/Prototype/PrototypeFlightHud.cs`: Passed, 0 errors.
  - `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`: Passed, 0 errors.
- `read_console(types=error,warning)` after final full test run
  - Result: 0 entries.

## Unity EditMode Tests

- Initial full EditMode run exposed real regressions after the first implementation pass:
  - `FinalApproachLateralSpeedCreatesExternalForceRequest` regressed from `FinalApproach` to `Accelerate`.
  - New autopilot tests had fixture null references.
  - Low fuel reported `Failed` instead of `FuelInsufficient`.
  - Waypoint target cleanup allowed rendererless target contamination.
- Fix passes restored compatibility and hardened the fixture.

- Focused run: `PrototypeWaypointAutopilotValidationTests`, `PrototypeAutopilotMomentumStartupStateTests`
  - Job: `f066e619399f42c1bf5ad4444beeb012`
  - Result: 21/21 passed.

- Full EditMode run
  - Job: `4fa0f253bf954f6181cc62f5d3b6dd72`
  - Result: 108/108 passed.
  - Note: Earlier full-suite attempts failed to initialize when Unity was in or entering Play Mode; rerun from idle state passed.

## CLI Verification

- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: Passed.
  - Notes: Existing Unity/MCP assembly version warnings and unrelated serialized-field warnings remain.
- `dotnet test "Weltraum Spiel.sln" --no-build`
  - Result: Passed, exit code 0.

## Regression Coverage Added

- Start at rest, target ahead, enough fuel requests `LongRangeBurn`.
- Forward velocity triggers earlier `Brake`.
- Lateral velocity requests RCS correction opposing lateral drift.
- Too close and too fast brakes instead of completing.
- Low fuel reports `FuelInsufficient`.
- No usable RCS translation still allows coarse burn/brake and reports limited final approach near target.
- Manual input aborts after grace and clears autopilot request.
- Source guard keeps `PrototypeWaypointAutopilot.cs` free of direct Rigidbody position/rotation/velocity writes.

## Manual PlayMode Protocol

- Manual PlayMode was not used as acceptance evidence for this pass because the requested scenarios are covered by deterministic EditMode probes.
- Suggested spot check before user playtest:
  - Start `PrototypeBootstrapHost`.
  - Select a waypoint with `Tab`/`B`, toggle autopilot with `G`.
  - Confirm HUD remains compact and Debug Console Autopilot panel shows phase, burn direction, requested throttle, requested RCS translation, and any limitation reason.
  - Test No-RCS variant from the debug console and confirm reduced final-approach capability is visible.
