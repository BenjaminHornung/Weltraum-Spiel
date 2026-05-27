# Navigation Computer Obstacle Course

## Requirements
1. When `PrototypeBootstrap` builds the prototype scene with the test environment enabled, it creates a deterministic obstacle course near the origin-to-target launch corridor.
2. Each obstacle is a registered `PrototypeNavigationObstacle` with a trigger collider, a visible mesh, and non-zero clearance.
3. The obstacle course must sit on or near the direct approach corridor so the direct route is blocked and the planner must choose an avoidance candidate before flight.
4. The autopilot must expose a precomputed plan (`CurrentPlan`, `PredictedRoute`, `PlanSegments`, `burnPlan`, `avoidanceWaypoint`) immediately after target selection or replan, before the ship physically traverses the route.
5. The plan must keep the ship clear of the obstacles, avoid repeated brake/accelerate flap, and still reacquire the direct path once the obstacle clears.
6. Direct-route behavior with no obstacles must remain unchanged.

## Scenarios
- Direct route clear: direct candidate selected, no avoidance.
- Obstacle course active: avoidance candidate selected, route preview deviates around obstacles, ship avoids collision.
- Reacquire: after leaving the obstacle corridor, planner returns to direct path or final hold.

## Constraints
- Reuse the existing `PrototypeTrajectoryPlanner`, `PrototypeObstacleDetector`, and `PrototypeWaypointAutopilot`.
- No regression in brake/decel arrival behavior.
- No new runtime pathfinding system.