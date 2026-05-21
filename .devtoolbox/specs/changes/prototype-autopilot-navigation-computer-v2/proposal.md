# Proposal

## Change
`prototype-autopilot-navigation-computer-v2`

## Problem
Navigation Computer v1 added obstacle-aware waypoint navigation, but the evidence is still mostly EditMode and synthetic. PlayMode coverage is effectively missing, avoidance planning is heuristic, start-overlap obstacle detection is not proven, and the HUD exposes the navigation computer as a long text line rather than an operator-readable status panel. The autopilot also needs stronger proof that it uses physical main-thruster/RCS requests without directly writing Rigidbody state.

## Goal
Upgrade the prototype navigation computer into a v2 autopilot that can fly multi-step waypoint scenarios, detect already-overlapping and trigger obstacles, choose stable avoidance trajectories from scored candidates, combine main-thrust and RCS authority honestly, brake and hold inside an arrival envelope, and produce headless plus PlayMode/GUI evidence.

## Scope
- Build on `prototype-navigation-computer-obstacle-trajectory-v1` without modifying or overwriting that change.
- Extend the existing `PrototypeNavigationObstacle`, `PrototypeObstacleDetector`, `PrototypeTrajectoryPlanner`, `PrototypeWaypointAutopilot`, `TrajectoryPredictor`, `TrajectoryBurnPlan`, HUD, debug console, and minimap surfaces.
- Add EditMode and PlayMode tests for detector, planner, actuator limits, hold behavior, persistent avoidance, and multi-step flight.
- Store evidence under `.devtoolbox/specs/changes/prototype-autopilot-navigation-computer-v2/tests/`.
- Update user-facing docs for the new phases, planner, burn segments, and validation status.

## Non-Goals
- No production-grade orbital optimizer or full navmesh/pathfinding system.
- No direct Rigidbody position, rotation, velocity, or angular velocity writes in the runtime autopilot.
- No replacement of the existing prototype flight controller, RCS controller, runtime job systems, or v1 evidence.
- No hidden pass by synthetic screenshots alone when PlayMode tests or Unity MCP evidence can run.
