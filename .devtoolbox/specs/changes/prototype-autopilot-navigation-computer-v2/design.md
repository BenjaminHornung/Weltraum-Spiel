# Design

## Approach
Use `PrototypeTestEnvironment` as the single source of truth for the obstacle course. Build the course as a small set of primitive spheres near the ship's launch corridor so the live map and the bootstrap scenes share the same deterministic obstacle layout.

## Why this approach
- Keeps obstacle content out of ship and autopilot prefabs.
- Reuses the existing obstacle registry and physics-first detector.
- Preserves the current cached `LastTrajectoryPlan` execution model.
- Avoids introducing a second navigation system.

## Implementation notes
- Add a dedicated course builder in `PrototypeTestEnvironment`.
- Keep obstacle positions deterministic and centered on the target corridor used by `PrototypeBootstrap`.
- Use simple sphere primitives with `PrototypeNavigationObstacle` and trigger colliders.
- Add a scene-loading PlayMode regression so the live scene proves obstacle detection, avoidance planning, and eventual reacquire or hold.
- Keep the planner changes minimal; the important gap is live route content and live verification, not a new pathfinding stack.