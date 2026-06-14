# Full EditMode Triage - 2026-06-13

Source baseline: `full-editmode-baseline-2026-06-13.md`

Fresh Unity MCP full EditMode job: `a91f5fc3a23340a4b3e16c825f9eb6e5`

Result: `25` failures out of `482` tests. The expected `21` count is stale for
the current working tree.

## Classification Summary

- Real regression or still-needs-RCA: 8
- Outdated accepted-behavior expectation: 10
- Historical/state-pollution or harness oddity: 6
- Missing/moved evidence artifact: 1
- Planner UI ownership: 0 in the fresh 25-failure run

The known planner-UI expectation `PrototypePlayerHudValidationTests.NavigationSnapshotUsesEmittedFlightPlanForPlannerScheduleRows`
belongs to `player-navigation-planner-ui-overhaul-v1`, but it was not present in
the fresh 25-failure MCP list.

## Patched / Updated In This Pass

- Added current baseline evidence for the fresh MCP run.
- Updated accepted-behavior test expectations for:
  - strict executor delayed brake/hold transitions,
  - current built-in ship variant count/order,
  - current stable one-sided RCS allocator behavior,
  - headless autopilot needing multiple strict-executor ticks,
  - terminal capture allowing `FinalApproach` before `HoldPosition`,
  - no-attitude strict abort surface,
  - RCS cache refresh bound staying switch-event bounded with setup edges.
- Added RCS-only navigation fuel handling in `PrototypeWaypointAutopilot` so
  RCS-only authority is not evaluated through zero main-thruster acceleration.
- Moved autopilot actuator reassertion ahead of the FixedUpdate fuel/authority
  gates so user-disabled RCS/SAS is restored before autopilot-owned navigation
  checks.

## Verification

Build:

```text
dotnet build "Weltraum Spiel.sln" --no-restore
0 errors, 5 warnings
```

Unity script validation:

```text
PrototypeWaypointAutopilot.cs: 0 errors, 1 known warning
PrototypeWaypointAutopilotValidationTests.cs: 0 errors, 2 known warnings
```

Focused Unity MCP job: `0e145414176f4f91aeb264abf2a0190c`

Result: `17` selected tests run, `9` passed, `8` failed.

## Still Open

These failures should remain open for a follow-up RCA instead of being softened
further in this pass:

1. `PrototypeAutopilotMomentumStartupStateTests.FinalApproachLateralSpeedCreatesExternalForceRequest`
   - Current result after update: `Accelerate`, expected `FinalApproach`.
   - Needs a focused decision: update fixture geometry for actual terminal
     lateral coverage, or classify as long-range planner behavior.
2. `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_FlightPlanDivergenceNewObstacleReplansWithVisibleReason`
   - Still does not surface `FlightPlanRequiresReplan` for a late obstacle.
   - Likely real executor/divergence-monitor regression.
3. `PrototypeWaypointAutopilotValidationTests.AutopilotAlignedBrakeDampsResidualSpinBeforeMainDecelBurn`
   - Still does not command main throttle after the updated wait loop.
   - Needs brake-latch/executor timing RCA.
4. `PrototypeWaypointAutopilotValidationTests.AutopilotClosedLoopApproachBrakesWithoutManualAlignment`
   - Closed-loop simulation still does not see main thrust after alignment.
   - Needs brake-force/latch simulation RCA.
5. `PrototypeWaypointAutopilotValidationTests.AutopilotFastApproachFlipsBeforeMainDecelBurn`
   - Does not reach `Brake` within the focused wait loop.
   - Needs decision between accepted delayed executor semantics and legacy
     coverage geometry.
6. `PrototypeWaypointAutopilotValidationTests.AutopilotLateralVelocityRequestsCorrection`
   - Current result remains `LongRangeBurn`.
   - Needs fixture geometry/RCA for terminal lateral correction coverage.
7. `PrototypeWaypointAutopilotValidationTests.AutopilotNoRcsAllowsCoarseBurnAndReportsLimitedApproach`
   - Coarse burn path still requests `0` main throttle.
   - Needs no-RCS/main-throttle authority RCA.
8. `PrototypeWaypointAutopilotValidationTests.ToggleAutopilotUsesExternalAssistTorqueBeforeBrakeWhenHoldAttitudeWasActive`
   - Does not reach `Brake` within the focused wait loop.
   - Same brake-latch/legacy-coverage decision as the fast-approach tests.

## Deliberately Not Patched

- `PrototypeAutopilotNavigationComputerV2ValidationTests` obstacle detector rows
  involving `Launch_Obstacle_1`: classified as historical/state-pollution or
  fixture isolation. They need isolated cleanup, not quick-wins/autopilot
  fidelity fixes.
- `PrototypeControlModeValidationTests.SasAuthorityProperty_UsesAuthorityNotDerivativeGain`:
  classified as harness oddity because expected and actual vectors both render
  as zero.
- `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders`:
  classified as missing/moved evidence artifact, not code regression.
