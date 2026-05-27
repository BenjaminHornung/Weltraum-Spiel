# Proposal

## Problem

The player-facing GUI run with the imported Blender/GLB ship can still flip and brake too early even though focused PlayMode harness tests pass. The current architecture has two authorities: `PrototypeTrajectoryPlanner` produces diagnostic preview data, while `PrototypeWaypointAutopilot.RunAutopilotStep()` still decides accelerate, flip, brake, final approach, and hold live through runtime gates. That lets the HUD display a route that is not the route being executed.

## Outcome

Autopilot route preview and runtime execution must use the same precomputed maneuver plan. The player must be able to inspect exactly which maneuver will happen when, how long it lasts, total ETA, total planned fuel, and which segment is currently active. If the ship deviates, detects an obstacle, loses actuator authority, or cannot safely execute the plan, the UI must show an explicit replan or abort reason instead of hiding a live heuristic phase change.

## Scope

- Introduce an authoritative `PrototypeFlightPlan`/maneuver-segment model beside the existing diagnostic planner DTOs.
- Capture real runtime ship data from `Rigidbody`, `ShipStats`, `ShipPhysicsCore`, main thrusters, RCS, mass descriptors, and imported functional sockets.
- Add an executor path that can execute the active plan segment without ad-hoc accelerate/brake/flip phase decisions.
- Extend the navigation planner UI snapshot/panel to expose maneuver rows, durations, ETA, fuel, active segment, and replan/abort status.
- Add PlayMode/EditMode coverage for imported-functional ship planning and early flip/brake prevention.

## Non-Goals

- Do not solve this with another brake/flip threshold-only patch.
- Do not promise bit-perfect Unity/PhysX determinism. The goal is deterministic route generation from a captured planning snapshot with bounded execution tolerances and visible replan/abort reasons.
- Do not remove legacy autopilot behavior in the first slice; keep migration reviewable and reversible until the flight-plan path is proven.
