# Test Protocol: player-autopilot-authoritative-flight-plan-v1

Date: 2026-05-27

## Scope

Task 1 checkpoint for the authoritative autopilot route rewrite:

- Added pure route contract types in `Assets/Scripts/Prototype/PrototypeFlightPlan.cs`.
- Added EditMode validation coverage in `Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs`.
- Kept runtime autopilot behavior unchanged for this checkpoint.

This slice intentionally does not claim the imported Blender/GLB early flip/brake bug is fixed yet. It establishes the model that later planner, HUD, and executor tasks will use as the single route authority.

## Ask-Pro Architecture Review

Ask-Pro review session:

- `2026-05-27T120732-return-final-markdown-only-do-not-answer-with-a-`

Key conclusion:

- The current defect is caused by two competing authorities: the diagnostic `PrototypeTrajectoryPlanner` preview and the runtime `PrototypeWaypointAutopilot.RunAutopilotStep()` live decision gates.
- The recommended repair is an authoritative `PrototypeFlightPlan` built before execution, displayed in the HUD, and consumed by a later executor.
- Live runtime logic should remain for safety abort/replan only, not for routine accelerate/flip/brake selection.

## Verification

DevToolbox:

- `specs_validate player-autopilot-authoritative-flight-plan-v1`: PASS.
- `verify_run 6548dbae55aa43c9bda1cd78cb54653d`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.

Unity MCP:

- Editor instance: `Weltraum Spiel@49c909b3e97ba6e8`, Unity `6000.4.7f1`.
- `mcpforunity://custom-tools`: available; includes `validate_script`, `refresh_unity`, `run_tests`, `get_test_job`, `read_console`.
- `mcpforunity://editor/state`: ready, `play_mode.is_playing=false`, `advice.ready_for_tools=true`.
- `validate_script Assets/Scripts/Prototype/PrototypeFlightPlan.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs`: PASS, 0 warnings, 0 errors.
- `refresh_unity mode=force scope=all compile=request wait_for_ready=true`: PASS; editor returned to ready state.
- Focused EditMode job `c21b125740424d46837d963f829531db` with group `PrototypeFlightPlanValidationTests`: PASS 7/7.
  - `ExecutionStateFlagsDivergenceAgainstSegmentTolerance`
  - `ExecutionStateReportsActiveSegmentProgress`
  - `FlightPlanComputesOrderedTotalsFromSegments`
  - `FlightPlanCreateInvalidPreservesReasonAndStatus`
  - `FlightPlanRejectsFuelStarvedRoute`
  - `FlightPlanRejectsOverlappingSegments`
  - `ShipPlanningSnapshotPreservesRealAuthorityFields`

.NET:

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors.
  - Existing Unity-generated assembly warnings remain for `System.Net.Http` and `System.IO.Compression` version conflicts.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.

## Notes

- The first Unity `run_tests` attempts used `test_names` and returned `total=0`; the real focused runs used `group_names=["PrototypeFlightPlanValidationTests"]` and executed all 7 tests.
- After a small `replanOn` contract follow-up, Unity test job `8ce92a0af38e403081b0240e5cdf7a8a` failed to initialize before any test started. Recovery was `manage_editor stop`, `refresh_unity scope=all compile=request`, then the final focused job `c21b125740424d46837d963f829531db` passed 7/7.
- Existing unrelated dirty files were not modified.

## Runtime Complaint Follow-up: RCS-only Terminal Corrections and Obstacle Persistence

Date: 2026-05-27

Scope:

- Added a terminal low-delta-v guard in `PrototypeWaypointAutopilot`: inside the terminal capture range, relative speed at or below `max(lateralCorrectionSpeed, completionSpeed * 3)` uses RCS velocity/position correction and gates main throttle.
- With default tuning this threshold is `max(6.0, 2.2 * 3) = 6.6 m/s`, preserving high-speed terminal overshoot main braking while preventing small terminal corrections from firing the main thruster.
- Added debug-console visibility for the current runtime truth: legacy live gates are still the executor until the authoritative `PrototypeFlightPlan` executor task lands.
- Fixed `PrototypeTestEnvironment.Rebuild()` to preserve manually authored children under `PrototypeEnvironment` and only replace generated groups; play-mode cleanup now deactivates generated groups before delayed `Destroy`.

Unity MCP:

- `validate_script Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: PASS, 0 errors, existing GC warning.
- `validate_script Assets/Scripts/Prototype/PrototypeTestEnvironment.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/PrototypeFlightDebugConsole.cs`: PASS, 0 errors, existing warnings.
- EditMode job `03cf20bfac784679953edd12ea4ecdfb`, `PrototypeTestEnvironmentValidationTests`: PASS 13/13.
- PlayMode job `359cf5bbb87f45fbae3715e2b88e53a8`, `PlayMode_Autopilot_TerminalLowDeltaVBrakeUsesRcsOnly`: PASS 1/1.
- PlayMode job `1692254c3f014a0ab1852ea47eaa2ec8`, `PrototypeAutopilotNavigationPlayModeTests`: PASS 24/24.

.NET:

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity-generated warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.

DevToolbox:

- `verify_run 63a764ac696f4d78a40832692615e970`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.

Ask-Pro:

- Session `2026-05-27T131607-return-final-markdown-only-do-not-answer-with-a-` was submitted to ChatGPT with the focused architecture question and is still `WAITING`; harvest reported `action: wait`.
