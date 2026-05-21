# Navigation Computer v2 Spec

## Capability
Navigation Computer v2 provides obstacle-aware, stateful waypoint autopilot with scored trajectory candidates, physical actuator requests, stable arrival/hold behavior, and verifiable GUI diagnostics.

## Requirements

### Multi-Step Navigation
- The autopilot MUST complete a direct route with no obstacle using physical main-thruster/RCS requests.
- The autopilot MUST handle a blocking obstacle on the direct route by planning avoidance, maintaining a stable avoidance waypoint, reacquiring line of sight, braking, holding, and completing only inside the arrival envelope.
- The autopilot MUST damp lateral start velocity with RCS before or during final approach.
- Heavy cargo and weak/no-RCS configurations MUST either complete within a relaxed envelope or report an explicit limited-authority status without fake completion.

### Obstacle Detection
- The detector MUST keep SphereCast/SphereCastNonAlloc path checks.
- The detector MUST detect obstacles already inside the ship safety sphere using overlap or equivalent geometry.
- The detector MUST evaluate multiple blocking obstacles and select the nearest or most constraining blocking obstacle for the path.
- The detector MUST ignore own-ship colliders.
- The detector MUST include trigger obstacles.
- Non-blocking `PrototypeNavigationObstacle` instances MUST NOT block the route.

### Stateful Avoidance
- The autopilot MUST expose a persistent phase machine with Direct, AvoidancePlanning, Avoiding, ReacquireDirectPath, Brake, FinalApproach, and Hold phases.
- The active avoidance waypoint MUST remain stable until clearance, line-of-sight, timeout, or failure conditions invalidate it.
- The autopilot MUST avoid frame-to-frame oscillation between opposite avoidance directions.
- Diagnostics MUST expose avoidance phase, waypoint, timeout/failure reason, and whether direct line of sight is currently blocked.

### Candidate Planner
- The planner MUST evaluate direct, left, right, up, down, and useful diagonal candidates when avoidance is required.
- Candidate scoring MUST include collision clearance, estimated delta-v, heading change, lateral velocity reduction, remaining fuel, brake feasibility, and RCS authority margin.
- Diagnostics MUST expose selected candidate, score, reason, and per-candidate score details.
- Direct route SHOULD win when clear and feasible.
- Avoidance candidate SHOULD win when direct route is blocked or unsafe.

### Burn And Trajectory Plan
- The planner MUST integrate `TrajectoryBurnPlan` for estimated burn duration, delta-v, and fuel.
- `TrajectoryPredictor` MUST support a simplified actuator simulation for candidates: main thrust along planned burn direction, optional RCS acceleration, fuel consumption, and optional gravity.
- Predicted paths MUST be checked against obstacle clearance samples and target stopping feasibility.
- Plans MUST expose segment diagnostics for Align, Burn, Coast, AvoidanceBurn, Brake, FinalApproach, and Hold where applicable.
- Segment diagnostics MUST include type, duration, direction, throttle, expected delta-v, expected fuel, closest obstacle distance, and predicted miss distance.

### Actuator Honesty
- Main throttle MUST be zero while the burn direction is outside the configured alignment tolerance.
- RCS force requests MUST be computed as desired acceleration multiplied by current Rigidbody mass and clamped to authority.
- Insufficient RCS authority MUST produce `LimitedRcsAuthority`, `LimitedHoldAuthority`, or `HoldNoAuthority` diagnostics.
- Insufficient fuel MUST be reported before the burn as `FuelInsufficient`.
- Runtime autopilot code MUST NOT directly write Rigidbody position, rotation, linear velocity, or angular velocity.

### Arrival And Hold
- Complete MUST require distance <= arrival radius, relative speed <= arrival speed, lateral speed <= tolerance, and stability for the hold confirmation duration.
- Hold MUST request RCS damping for remaining velocity.
- No-authority and no-fuel cases MUST remain in an explicit limited/failure state rather than reporting complete.

### GUI And Minimap
- HUD MUST render a Navigation Computer panel with Target, Distance, Relative Speed, Phase, Active Segment, Autopilot state, Obstacle state, Avoidance state, ETA, Main throttle, RCS force, and short warning chips.
- Debug console MUST group Plan Summary, Candidate Scores, Current Segment, Obstacle Detection, Actuator Requests, Fuel/Burn Estimate, and Test Scenario Controls.
- Minimap MUST render predicted route, current avoidance waypoint, obstacle clearance circle, and blocked/clear direct line styling.

### Evidence
- EditMode test XML MUST contain total > 0 and failed == 0.
- PlayMode test XML MUST contain total > 0 and failed == 0.
- Test evidence MUST include logs, XML, screenshots or clearly labelled synthetic fallbacks, and notes for failed iterations/fixes.
- The v2 test protocol MUST record branch, commit hash, Unity version, MCP status, script validation, console status, and known limits.
