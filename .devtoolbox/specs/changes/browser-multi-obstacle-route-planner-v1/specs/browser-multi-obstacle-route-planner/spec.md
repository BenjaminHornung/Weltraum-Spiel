# Capability: Browser Multi-Obstacle Route Planner

## Requirements

1. The planner must consider more than one blocking obstacle when a route crosses an obstacle field or corridor.
2. The planner must generate deterministic `RouteSegment` sequences for the same input.
3. Waypoint / iteration work must be bounded; the planner must stop at a fixed limit instead of looping.
4. If the planner cannot find a safe route within budget, it must fail closed with a structured reject or unsolvable result.
5. The locked plan must not be changed during execution; no executor-side silent replan is allowed.
6. `planHash` must remain stable for the same input and planner state.
7. `SpeedProfile` may influence desired route speed and non-terminal brake margins only; it must not weaken terminal capture.
8. The terminal segment must remain safe for `StopWithinEnvelope` targets.
9. Route scoring must surface reasons for segment count, distance, clearance risk, planner complexity, and optionally rejected candidates.

## Expected Behavior

- A direct route may be accepted when no obstacles block any segment.
- When one obstacle is not enough to clear the route, the planner must chain additional deterministic detours.
- Every accepted segment must be validated against all relevant obstacles.
- The terminal segment must still end at the locked target envelope.
- Identical inputs must produce identical route shape, score ordering, and `planHash`.

## Important Scenarios

- `s-curve-obstacles`: solvable with chained detours.
- `narrow-corridor`: solvable only if both corridor sides and the downstream blocker are considered.
- `offset-gates`: remains deterministic and does not overreact to the first blocker.
- `target-near-obstacle-long`: fails closed if the target envelope cannot stay safely outside obstacle padding.
- `multi-rock-field-1000m` and `multi-rock-field-2500m`: solvable dense-field stress cases.
- `unsolvable-blocked-corridor-negative`: explicit reject / unsolvable result, no route synthesis.

## Constraints

- No random search.
- No silent plan replacement.
- No snap-to-target or zero-velocity shortcut.
- No weakening of terminal capture or `StopWithinEnvelope`.
- Same input must keep the same planHash.
