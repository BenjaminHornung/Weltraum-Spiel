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

## Fine-Arrival RCS-only Guard Follow-up

Date: 2026-05-27

Scope:

- Tightened `PrototypeWaypointAutopilot.TerminalRcsOnlyCorrectionActive` from the previous broad `6.6 m/s` terminal envelope to the Ask-Pro-derived fine-arrival envelope.
- Default fine-arrival main-throttle suppression now requires:
  - distance within `GetArrivalCompletionDistance() + 6m`;
  - relative speed `<= min(completionSpeed, max(0.75, arrivalSpeed * 1.25))`, default `1.25 m/s`;
  - absolute closing speed `<= max(0.35, arrivalSpeed * 0.75)`, default `0.75 m/s`;
  - lateral speed within the same fine low-delta-v cap.
- The central actuator funnel still suppresses main throttle in `ApplyAutopilotRequest()` without clearing the brake latch, so a committed low-delta-v brake latch may remain stateful while publishing RCS-only output.
- Added PlayMode coverage for:
  - low-delta-v fine terminal correction uses RCS only below the threshold;
  - committed low-delta-v brake latch does not publish main throttle;
  - high-delta-v terminal brake remains outside the fine window and can still publish main throttle.

Unity MCP:

- `validate_script Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: PASS, 0 errors, existing GC warning.
- `validate_script Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: PASS, 0 warnings, 0 errors.
- Initial focused PlayMode job `63d180f1300a49c6a65a676361ea14b0`: failed to initialize before any tests started; treated as Unity runner initialization noise.
- Focused PlayMode retry `2061fd9917c14c3f95dc0b07d93e1562`: PASS 3/3.
- Full PlayMode job `2b1ef8b1fa524f7396993e64a2759d7d`: `PrototypeAutopilotNavigationPlayModeTests` PASS 26/26.

.NET:

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity-generated warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.
- `git diff --check -- Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: PASS; only expected LF-to-CRLF working-copy warnings.

DevToolbox:

- `specs_validate player-autopilot-authoritative-flight-plan-v1`: PASS.
- `verify_run 4b721d3dd5a441699c51d8b15474dfbf`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.

## Navigation Planner Maneuver Schedule and Obstacle Visibility

Date: 2026-05-27

Scope:

- Extended `PrototypePlayerNavigationSnapshot` and the Navigation Planner popup with player-facing maneuver schedule data:
  - plan authority label;
  - total planned duration and fuel;
  - active trajectory segment;
  - replan/status reason;
  - obstacle summary/count;
  - compact step rows in `T+start-end | actuator | dV | fuel` form.
- The HUD deliberately labels this as `Authority: Legacy live gates | diagnostic preview only`; it does not claim the authoritative `PrototypeFlightPlan` executor is active yet.
- The step rows are sourced from the current `PrototypeTrajectorySegment[]` diagnostic plan until the executable flight-plan tasks land.
- Added HUD validation coverage for schedule totals, fuel, active segment, compact rows, obstacle count, and no-blocking-cue fallback.

Obstacle runtime evidence:

- Loaded `Assets/Scenes/SampleScene.unity` and entered Play Mode via Unity MCP.
- `find_gameobjects by_component PrototypeNavigationObstacle`: 12 active obstacle objects after bootstrap.
- Rechecked after an additional 4 seconds in Play Mode: still 12 active obstacle objects.
- Scene hierarchy evidence:
  - `PrototypeEnvironment/Launch_Corridor_Obstacles`: 3 children.
  - `PrototypeEnvironment/Asteroid_Field_Visual`: 9 children.
- Screenshot captured at `tests/screenshots/navigation-planner-schedule-before-engage.png`; the normal HUD map showed route/preview/contact data while the popup opening itself was not forced through MCP because runtime GameObject mutation is blocked during Play Mode.

Unity MCP:

- `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, 2 existing analyzer warnings.
- `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 warnings, 0 errors.
- Focused HUD EditMode job `482d4b8b15294b6591b7ce084f37ba34`: PASS 2/2.
- Full HUD EditMode job `4a818c1387824ead95550904149b6142`: failed to initialize before tests started; treated as Unity runner initialization noise.
- Full HUD EditMode retry `63b99b9d311643d0bb09c2c4aa73bee5`: PASS 58/58.
- Environment EditMode job `b448071693864738b9d93aca5f4084a9`: PASS 2/2 for generated launch corridor and manual-child preservation.
- Launch-corridor PlayMode job `b546d411852e4e2095323aa4112175e4`: PASS 1/1.
- Unity console still reports existing AssetManager SerializeReference warnings; no script validation errors were reported.

.NET:

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity-generated warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.

DevToolbox:

- `specs_validate player-autopilot-authoritative-flight-plan-v1`: PASS.
- `verify_run a5f9d5ced4d346bea851d9866db89753`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.

## Real Ship Planning Snapshot Builder

Date: 2026-05-27

Scope:

- Added `PrototypeShipPlanningSnapshotBuilder` to capture `PrototypeShipPlanningSnapshot` from real runtime ship components:
  - `Rigidbody` pose, velocity, angular velocity, center of mass, inertia, and mass.
  - `ShipStats` current/max fuel, per-module thrust, reverse thrust multiplier, and fuel flow.
  - `MainThrusterBank`/`MainThrusterModule` count, throttle scale, spool rates, gimbal limit, gimbal slew, and physical nozzle-force mode.
  - `RcsThrusterController` force settings, nozzle count, spool rates, imported functional socket mode, and physical RCS solver mode.
  - `ShipPhysicsCore` central-gravity and active-atmosphere settings.
  - `ModuleMassDescriptor` count as imported/generated mass evidence.
- Builder supports both root-based lookup and explicit component injection, so later planner/executor slices can call it without duplicating component discovery.
- Added Editor validation for:
  - generated runtime `PrototypeScenarioBuilder` ship captures actual fuel/thrust/RCS/COM/inertia fields;
  - imported functional default scout captures imported socket evidence, imported mass descriptors, main nozzle count, RCS nozzle count, and live `Rigidbody`/`ShipStats` values.

Unity MCP:

- `validate_script Assets/Scripts/Prototype/PrototypeShipPlanningSnapshotBuilder.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Tests/Editor/PrototypeFlightPlanValidationTests.cs`: PASS, 0 warnings, 0 errors.
- Focused EditMode job `12fc8bf10adf4ba8914d4d7594b142cc`: builder generated/imported tests PASS 2/2.
- Full EditMode job `7e031513851d4936b33d34183180a2a1`: `PrototypeFlightPlanValidationTests` PASS 9/9.

.NET:

- Initial `dotnet build "Weltraum Spiel.sln" --no-restore`: failed because Unity had not regenerated project files for the new C# script yet.
- After Unity `refresh_unity scope=all mode=force compile=request`, `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity-generated warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.
- `git diff --check` for the changed builder/test files: PASS; only expected LF-to-CRLF working-copy warning for the edited test file.

DevToolbox:

- `specs_validate player-autopilot-authoritative-flight-plan-v1`: PASS.
- `verify_run 2c62d8272f6f4eb0afd04a9691bb8289`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.

## Executable Flight Plan Emission

Date: 2026-05-27

Scope:

- Extended `PrototypeTrajectoryPlan` with an embedded `PrototypeFlightPlan` while preserving legacy diagnostic fields (`segments`, `predictedPath`, candidate scores, requested throttle/RCS, ETA/status labels).
- Extended `PrototypeTrajectoryPlanner.Plan(...)` overloads so existing callers still work and runtime callers can pass a real `PrototypeShipPlanningSnapshot`.
- Added conversion from legacy trajectory segments to executable maneuver segments:
  - explicit burn alignment when needed;
  - main burn, avoidance burn, coast, flip-to-retrograde, retrograde brake burn, final approach, and hold phases;
  - predicted samples generated from `TrajectoryPredictor` using fixed-step physics, real mass, thrust, fuel rate, RCS force, current fuel, and captured pose/velocity from the planning snapshot;
  - no-op zero-duration brake segments are skipped so a plan does not display an unnecessary flip when there is no brake burn.
- `PrototypeWaypointAutopilot.RefreshNavigationPlan()` now builds a real ship planning snapshot from the active ship and passes it into the planner.
- Navigation Planner HUD rows now prefer the emitted `PrototypeFlightPlan` when present:
  - route points come from predicted flight-plan samples;
  - rows show flight-plan segment labels/timing/actuator/fuel;
  - authority label says `Flight plan emitted | executor pending`, so the UI does not claim the runtime executor is active yet.

Unity MCP:

- `validate_script Assets/Scripts/Prototype/PrototypeTrajectoryPlanner.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: PASS, 0 errors, 1 existing analyzer warning.
- `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, 2 existing analyzer warnings.
- `validate_script Assets/Tests/Editor/PrototypeAutopilotNavigationComputerV2ValidationTests.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 warnings, 0 errors.
- EditMode job `231374e18e7346ba890f8b402d918a39`: `PrototypeAutopilotNavigationComputerV2ValidationTests` PASS 21/21.
- EditMode job `a0289a3fc70f47bc86a7bbf17bbd833c`: `PrototypePlayerHudValidationTests` PASS 59/59.
- PlayMode job `895b3659e84d4e778789af608418e9d1`: `PrototypeAutopilotNavigationPlayModeTests` PASS 26/26.

.NET:

- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity-generated warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: PASS, no output.
- `git diff --check` for changed line-5 files: PASS; only expected LF-to-CRLF working-copy warnings.

DevToolbox:

- `specs_validate player-autopilot-authoritative-flight-plan-v1`: PASS.
- `verify_run cb800ce3bfc14f2facb801fc26801928`: MIXED/EXPECTED.
  - Specs step passed.
  - Bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple-workspace selection, matching the known generic DevToolbox limitation in this Unity repository.
