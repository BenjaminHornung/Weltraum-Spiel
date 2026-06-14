# Obstacle Replan Chatter Verification

Change: `stabilize-autopilot-obstacle-replan-chatter-v1`

## Implementation Evidence

- `PrototypeWaypointAutopilot` now keeps stable avoidance through a clear debounce window instead of releasing on one clear tick.
- Covered avoidance/reacquire windows suppress only non-urgent repeated plan divergence for the same covered corridor.
- Immediate `ObstacleDetected` and `CollisionPredicted` semantics remain in the global immediate-divergence path.
- Covered avoidance suppression has a large-error escape for actionable position/velocity divergence.
- Covered expired/Hold avoidance routes refresh into reacquire without incrementing the safety replan counter.

## Baseline

- File: `tests/performance/launch-corridor-replan-chatter-baseline.csv`
- Rows: 1600
- Max `flightPlanSafetyReplanCount`: 484
- Final state/phase: `AlignForBurn` / `ReacquireDirectPath`
- Final distance: 46.80953 m

## Stabilized Run

- File: `tests/performance/launch-corridor-replan-chatter-stabilized.csv`
- Rows: 3162
- Max `flightPlanSafetyReplanCount`: 0
- Saw avoidance: yes
- Saw reacquire: yes
- Divergence rows: 0
- Final state/phase: `Complete` / `Hold`
- Final distance: 11.4997 m
- Final relative speed: 0.009916 m/s

## Final Validation

- `dotnet build "Weltraum Spiel.sln" --no-restore`: passed, 0 errors, known Unity/MSBuild warnings.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: 0 errors, 1 known GC warning.
  - `Assets/Tests/Editor/PrototypeWaypointAutopilotObstacleReplanStabilityTests.cs`: 0 errors, 0 warnings.
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`: 0 errors, 0 warnings.
- Unity MCP EditMode job `5a2ffa6a91354b7ab7477c37c6bfb22e`: passed 13/13 for obstacle + arrival terminal tests.
- Unity MCP PlayMode job `ddaaa1a28fb743699fcb8d4a3d288575`: passed 2/2 launch-corridor obstacle tests.
- DevToolbox `specs_validate` for this change: passed.
