# Launch Corridor Replan Chatter Baseline Evidence

Change: `stabilize-autopilot-obstacle-replan-chatter-v1`

This file documents the baseline evidence harness and run instructions for
`PlayMode_Autopilot_LaunchCorridorObstacleCourse_ReplanChatterEvidence`.
This is a pre-fix measurement harness only and does not claim fixed behavior.

## Run instructions

- In Unity, open the PlayMode test suite for
  `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`.
- Run test:
  `PlayMode_Autopilot_LaunchCorridorObstacleCourse_ReplanChatterEvidence`
- The test writes its CSV output to:
  `.devtoolbox/specs/changes/stabilize-autopilot-obstacle-replan-chatter-v1/tests/performance/launch-corridor-replan-chatter-baseline.csv`
- The CSV contains one row per simulation step with:
  `step, time, distance, relativeSpeed, currentState, navigationPhase, selectedCandidate,
  selectedCandidateReason, obstacleStatus, hasObstacle, flightPlanSafetyReplanCount,
  activeSegmentLabel, requestedMainThrottle, requestedRcsForceMagnitude`.

## Notes

- Evidence target is baseline replan chatter behavior in the launch corridor course.
- The test asserts only that baseline behavior reaches `Complete` or `HoldPosition`,
  sees avoidance, keeps clearance > 0.25m, and emits a non-empty CSV.

## Baseline run status

- Unity MCP `validate_script` passed for
  `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`.
- `dotnet build "Weltraum Spiel.sln" --no-restore` passed with 0 errors and
  23 known warnings.
- Unity MCP PlayMode attempts did not start the test before the runner init
  timeout, so no baseline CSV was produced yet:
  - `ccc06f215e3b421bb31f7161e96d5d82`
  - `89315c4219c34cf8a665d943e846404f`
