# Design: Browser Multi-Obstacle Route Planner v1

## Architecture Choice

Use a deterministic Iterative Detour Planner as the primary mechanism. The planner should generate a small, ordered set of waypoint candidates, validate each candidate against all relevant obstacles, and accept the first fully valid route. If no route is found within budget, return a structured reject instead of looping.

## Strategy Comparison

### Iterative Detour Planner

Best fit for this Browser step because it:

- preserves the current `DirectLocal` / `ObstacleAvoidanceLocal` route model,
- keeps `RoutePlan` hashing stable,
- remains easy to validate and explain in tests/evidence,
- is naturally bounded and fail-closed.

### Visibility Graph / Gate Planner

Useful fallback for narrow corridors if the iterative detour pass cannot find a safe chain. It is deterministic when node ordering is fixed, but it adds more topology bookkeeping.

### Grid / A* Local Planner

Too discretized for stable Browser route hashes and too easy to make noisy. It also obscures why a candidate was rejected.

### RRT / RRT*

Rejected for v1. The nondeterminism and candidate explosion make it a poor fit for stable plan hashes and fail-closed evidence.

## Deterministic Rules

- Fixed obstacle ordering
- Fixed waypoint ordering
- Fixed candidate scoring order
- Fixed maximum waypoint / iteration budget
- Fixed reject ordering and reason codes

## Validation And Scoring

Validation must reject a candidate when:

- any segment intersects a relevant obstacle envelope,
- the terminal segment no longer ends inside the locked target envelope,
- the route violates the stop/terminal-speed contract,
- the candidate exceeds waypoint/iteration budget.

Scoring should remain small and explainable. RouteScore reasons should include:

- segment count,
- distance,
- clearance risk,
- planner complexity,
- rejected candidates (optional, debug-only).

## SpeedProfile Compatibility

Safe/Balanced/Fast may tune desired route speeds and non-terminal brake margin only. They must not:

- raise executor acceleration globally,
- weaken terminal capture,
- weaken `StopWithinEnvelope`,
- alter route hash stability for identical input.

## Evidence Plan

Unit tests should cover deterministic route construction and reject paths. E2E evidence should cover at least:

- S-curve solvable case,
- corridor solvable case,
- unsolvable negative case.

## Risks

- Long-range branch changes may shift acceptance thresholds or course geometry.
- A visibility-graph fallback can accidentally become the primary path if not kept tiny and deterministic.
- Segment validation must stay fail-closed; otherwise the planner can appear to work while still crossing a later obstacle.
