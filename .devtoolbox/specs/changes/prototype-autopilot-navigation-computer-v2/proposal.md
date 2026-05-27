# Proposal

## Goal
Add deterministic obstacles to the runtime map and prove that the autopilot precomputes an obstacle-aware route before flight.

## Motivation
The current obstacle avoidance behavior is mostly verified with synthetic test rigs. We need a real map obstacle course in the bootstrap-built scene so the navigation computer, route preview, and autopilot can be verified against the live environment.

## Scope
- Extend the runtime test environment with a small route-aligned obstacle course near the ship/target corridor.
- Reuse the existing `PrototypeTrajectoryPlanner`, `PrototypeObstacleDetector`, and `PrototypeWaypointAutopilot` logic.
- Add live verification in PlayMode and update evidence artifacts.

## Non-goals
- Do not replace the current planner with a new navmesh or graph-search system.
- Do not change unrelated flight controls or HUD layout.
- Do not introduce permanent gameplay map changes outside the prototype test environment.