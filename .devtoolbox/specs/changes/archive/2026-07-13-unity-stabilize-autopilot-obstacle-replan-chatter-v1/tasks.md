# Tasks: Autopilot Obstacle Replan Stability

- [x] 1. Baseline evidence collection
  - Capture current launch-corridor obstacle flicker behavior with PlayMode CSV:
    - `SafetyReplan` count and timestamps,
    - trigger source (`ObstacleDetected`, `CollisionPredicted`),
    - host phase (`Launch`, `Burn`, etc.).
  - Store baseline logs in `tests/performance/` and `tests/`.

- [x] 2. Debounce/stable risk handling in `PrototypeWaypointAutopilot`
  - Add a small risk-state debounce state machine for launch-corridor obstacle events observed while running `PrototypeBootstrapHost`.
  - Keep immediate behavior for:
    - brand new obstacle risk,
    - near-collision urgent risk thresholds.
  - Suppress repeated replan triggers for unstable non-urgent flicker.

- [x] 3. EditMode coverage
  - Add unit tests for:
    - stable-state transition ignores, 
    - immediate replan on new/urgent risk,
    - clear-state recovery with stability window.
  - Validate no regression in explicit immediate-risk paths.

- [x] 4. PlayMode + CSV evidence
  - Run launch-corridor regression scene with obstacle flicker.
  - Verify lower `SafetyReplan` count versus baseline while preserving emergency immediate replans.
  - Store CSV and evidence notes under `tests/`.

- [x] 5. Review and verification
  - Link proposal/design/tasks/spec and evidence.
  - Run specs validation for this change folder.
  - Confirm only this change scope is impacted by code edits.
