# Design

## Reuse Strategy
Navigation Computer v2 reuses the v1 components instead of introducing a parallel autopilot stack. `PrototypeWaypointAutopilot` remains the integration point for waypoint state and physical requests. `PrototypeObstacleDetector` owns path blocking queries. `PrototypeTrajectoryPlanner` owns candidate scoring and plan diagnostics. `TrajectoryPredictor` and `TrajectoryBurnPlan` become planning inputs rather than separate preview-only utilities. HUD, debug console, and minimap continue to use IMGUI and existing prototype view conventions.

New code is justified only where v1 has a missing concept: start-overlap obstacle queries, candidate score diagnostics, stable avoidance state, segment diagnostics, and PlayMode scenario evidence.

## Technical Choices

### Obstacle Detection
Keep the existing SphereCast/SphereCastNonAlloc path detection, but run an overlap check at the ship/cast start before the sweep. Unity's local `Physics.OverlapSphere`/`OverlapSphereNonAlloc` API is the right fit for already-inside colliders, while the existing registry fallback covers colliderless `PrototypeNavigationObstacle` instances. The detector should keep ignoring own-ship colliders, include trigger obstacles, and ignore `BlocksAutopilot == false` obstacles.

### Obstacle Registry And Hot Paths
`PrototypeNavigationObstacleRegistry` already exists in the dirty v1 workspace and should be used for deterministic fallback scans. v2 should avoid `FindObjectsByType` in per-frame autopilot work. Any expensive bounds fallback should be cached by obstacle lifecycle or refreshed deterministically in tests.

### Candidate Planner
`PrototypeTrajectoryPlanner` should produce candidates for direct, left, right, up, down, and useful diagonals. Each candidate receives diagnostics: clearance, collision penalty, heading change, delta-v estimate, brake feasibility, fuel estimate, RCS authority margin, and a final score. The selected plan should expose the reason and a compact candidate-score list for tests/debug UI.

### Burn And Prediction
`TrajectoryBurnPlan` estimates main-burn duration, fuel, and delta-v. `TrajectoryPredictor` should support a lightweight actuator simulation for planner candidates: main acceleration along a chosen burn direction, optional RCS acceleration for lateral correction, gravity when provided by the existing physics model, and obstacle intersection samples along the predicted path. This is not a high-fidelity orbital solver; it is a deterministic prototype planner that verifies obvious collision and stopping cases.

### Autopilot State
`PrototypeWaypointAutopilot` should add a persistent navigation phase machine: Direct, AvoidancePlanning, Avoiding, ReacquireDirectPath, Brake, FinalApproach, Hold. The avoidance waypoint stays stable until clearance, line of sight, timeout, or failure. The autopilot must avoid left/right oscillation by remembering the selected side and only replanning on meaningful invalidation.

### Actuator Requests
Main thrust handles large delta-v when aligned. RCS handles lateral correction, avoidance sidestep, final approach, and hold damping. RCS force requests are mass-scaled (`desiredAcceleration * rb.mass`) and clamped to installed authority. When authority/fuel is insufficient, diagnostics must report `LimitedRcsAuthority`, `HoldNoAuthority`, `LimitedHoldAuthority`, or `FuelInsufficient` instead of completing falsely.

### Arrival And Hold
Completion requires distance, relative speed, lateral speed, and a stable hold-confirmation window. Hold uses physical RCS damping requests. Runtime autopilot code must not directly write Rigidbody position, rotation, linear velocity, or angular velocity.

### GUI Evidence
The HUD should show a compact Navigation Computer panel with labelled fields and short warning chips instead of one long line. The debug console can remain verbose but should group plan summary, candidate scores, segment, obstacle detection, actuator requests, fuel/burn estimate, and test scenario controls. The minimap should show the direct line, predicted route, avoidance waypoint, and obstacle clearance state.

## Verification Plan
- EditMode tests cover detector, planner, authority/fuel, persistent avoidance, hold gate, and Rigidbody-write guard.
- PlayMode tests simulate hundreds of FixedUpdate steps for direct, obstacle, lateral velocity, heavy cargo, no-RCS, and manual override scenarios.
- Unity MCP validates changed scripts, runs EditMode/PlayMode where possible, checks console, and captures GameView/SceneView screenshots.
- Batchmode writes EditMode and PlayMode XML/logs with `total > 0`, `failed == 0`, and PlayMode no longer empty.
- If generic DevToolbox `verify_run` fails for known workspace preflight reasons, the test protocol must document the blocker and replacement evidence.

## Known Risks
- The prototype controller may need modest tuning rather than a perfect trajectory optimizer to pass PlayMode reliably.
- Unity MCP screenshots can be blocked by editor readiness or focus; synthetic headless evidence remains a labelled fallback, not the primary proof.
- Existing dirty changes in Autopilot/RCS/Obstacle files must be preserved and integrated, not reverted.
