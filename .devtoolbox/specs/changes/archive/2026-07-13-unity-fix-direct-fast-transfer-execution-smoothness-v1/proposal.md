# Proposal: DirectFastTransfer Execution Smoothness

## Problem

The DirectFastTransfer bang-bang planner now creates the intended burn, flip, brake, and hold shape, but nominal execution can still visibly pulse the main thruster. Soft tracking or velocity divergence is treated like a replan, and hard replan handling clears actuator output before a replacement command is applied. The planned full-throttle burn and brake can also be gated to zero by per-frame alignment checks.

## Outcome

Free direct waypoint flight should execute one authoritative DirectFastTransfer plan smoothly: align, full prograde burn, flip, full retrograde brake after alignment, then RCS final hold. Normal tracking corrections must not appear as `Replan` or clear main/RCS commands. Hard safety conditions must still replan or abort honestly.

## Scope

- Stabilize DirectFastTransfer execution in `PrototypeWaypointAutopilot`, `PrototypeTrajectoryPlanner`, and `PrototypeFlightPlanTracker`.
- Add focused EditMode and PlayMode coverage for soft-divergence handling, brake safety, main-throttle continuity, initial-align drift, and planned brake direction.
- Capture verification evidence under this change's `tests` folder.

## Non-Goals

- No new autopilot modes or UI migration.
- No rewrite of the bang-bang planner.
- No performance-job or large architecture migration.
