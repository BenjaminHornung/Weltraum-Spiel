# Test Protocol

## Evidence Log

- ServiceRunner/DevToolbox MCP status:
  - `specs_get_status`, `tasks_load`, `execution_create`, `specs_validate`, `mcp_self_check`, `mcp_transport_session_status`, and `verify_run` were attempted from the Codex tool surface.
  - All returned `Transport closed`; no DevToolbox execution id could be created. Verification therefore uses Unity MCP plus local .NET evidence below.
- Unity MCP `validate_script`:
  - Log: `tests/logs/unity-validate-scripts-rerun2.json`
  - Validated changed runtime/test scripts: `PrototypeFlightPlan`, `PrototypeWaypointAutopilot`, `PrototypeTrajectoryPlanner`, `PrototypePlayerHud`, `PrototypeFlightDebugConsole`, `PrototypeMinimapOverlay`, `PrototypeFlightPlanValidationTests`, `PrototypeAutopilotNavigationComputerV2ValidationTests`, `PrototypePlayerHudValidationTests`, `PrototypeAutopilotNavigationPlayModeTests`.
  - Result: all `success=True`, `0` errors. Existing warnings remain in Autopilot/HUD/DebugConsole.
- Unity MCP EditMode:
  - Log: `tests/logs/unity-editmode-authoritative-tracking-rerun4.json`
  - Scope: `PrototypeFlightPlanValidationTests`, `PrototypeAutopilotNavigationComputerV2ValidationTests`, `PrototypePlayerHudValidationTests`.
  - Result: `107/107` passed, `0` failed, `0` skipped.
- Unity MCP PlayMode:
  - Log: `tests/logs/unity-playmode-autopilot-navigation-full-rerun4.json`
  - Scope: `PrototypeAutopilotNavigationPlayModeTests`.
  - Result: `29/29` passed, `0` failed, `0` skipped.
- Focused Launch Corridor / terminal brake evidence:
  - Passing log: `tests/logs/unity-playmode-launch-terminal-1200-rerun.json`
  - Result: Launch corridor reaches final hold/complete with the strict tracker, and `PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap` remains green.
  - Diagnostic finding before the final fix: the strict brake segment had `cmdMain=1.00` and retrograde alignment around `16-21 deg`, but the actuator gate held main throttle at `0` due a too-tight `24 deg/s` angular-rate release. The fix raises only the brake main-throttle angular release gate and keeps flip main-throttle suppressed.
- Local .NET:
  - `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Log: `tests/logs/dotnet-build.log`
  - Result: exit code `0`, `0` errors, `22` known warnings.
  - `dotnet test "Weltraum Spiel.sln" --no-build`
  - Log: `tests/logs/dotnet-test.log`
  - Result: exit code `0`; Unity solution emitted no additional dotnet test output.

## Implementation Notes

- The FlightPlan executor remains enabled and strict by default.
- Retrograde tracking now follows the actual Rigidbody velocity for Brake/Flip instead of waiting on a stale planned brake vector.
- RetrogradeBurn gets a segment-throttle floor after direction validation, so a planned brake segment cannot collapse to zero main throttle while the ship is still above arrival speed.
- Planner brake feasibility includes an attitude-alignment lead distance.
- The player-facing navigation snapshot and planner body now report strict flight-plan authority and scheduled maneuver rows from the plan instead of legacy live-gate wording.
