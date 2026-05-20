# prototype-navigation-computer-obstacle-trajectory-v1

## Reuse Strategy
The implementation reuses the existing waypoint manager, navigation target model, `FlightAssistRequest`, RCS controller authority path, `PrototypeTestEnvironment`, HUD/debug/minimap IMGUI surfaces, and the existing deterministic EditMode test style. New code is introduced only for the missing navigation concepts: obstacle marker, obstacle detector, and trajectory planner.

## Obstacle Model
`PrototypeNavigationObstacle` marks objects that should be considered by navigation. It derives a radius from an explicit value first, then collider bounds, then renderer bounds. `EffectiveClearanceRadius` combines the obstacle radius and clearance padding. Gizmos draw the obstacle radius and clearance ring for selected objects.

## Detection
`PrototypeObstacleDetector` evaluates a desired corridor from the ship toward the current planning target. Collider-backed obstacles are tested with `Physics.SphereCast` using `QueryTriggerInteraction.Collide` so trigger asteroids can be detected without blocking normal physics. Own ship colliders and child colliders are ignored. When obstacle components do not have colliders, the detector projects each obstacle onto the corridor segment and checks the closest point distance against ship radius plus clearance.

## Trajectory Planning
`PrototypeTrajectoryPlanner` consumes a snapshot of ship, target, propulsion, fuel, alignment, and obstacle state and returns a `PrototypeTrajectoryPlan`. The planner chooses one phase per tick: `Idle`, `AlignForBurn`, `LongRangeBurn`, `Coast`, `Avoidance`, `Brake`, `FinalApproach`, `Hold`, or `Failed`. It does not mutate the Rigidbody or scene.

## Autopilot Routing
`PrototypeWaypointAutopilot` runs the detector and planner in `FixedUpdate`, records diagnostics, and converts the plan to a physical `FlightAssistRequest`. Main throttle is permitted only when the ship is aligned with the desired burn direction. RCS translation is derived from desired acceleration times Rigidbody mass and clamped to available authority.

## Arrival and Hold
Arrival uses distance, relative speed, and lateral speed only. A small drift away from the target no longer blocks arrival when full relative velocity is within the envelope. After entering Hold, the autopilot damps residual velocity for a configurable confirmation duration before completing.

## UI Diagnostics
The HUD receives a compact Navigation Computer panel. The debug console gets a detailed foldout and test scenario controls. The minimap highlights obstacle points and renders either the direct route or ship-to-avoidance-to-target route.

## Risks
- EditMode physics queries can leak scene state if tests do not clean up objects and layers carefully.
- Unity MCP is attached to the original worktree; this change is verified primarily through the clean worktree with local Unity/batchmode alternatives if MCP cannot target it.
- The avoidance algorithm is deliberately local and heuristic; it proves robust prototype behavior without promising full pathfinding.

