# Design

## Change
`fix-autopilot-exact-point-arrival-v1`

## Existing Architecture
`PrototypeWaypointAutopilot` owns waypoint execution, public diagnostics, phase/profile reporting, throttle requests, and RCS requests. `PrototypeTrajectoryPlanner` and `PrototypeFlightPlan` provide route and planner-profile inputs, including obstacle avoidance segments and reacquire phases. The Proving Ground harness observes runtime diagnostics rather than replacing the controller.

## Approach
- Keep the current local-space trajectory planner and obstacle route model.
- Add the smallest explicit terminal point-capture path inside the waypoint autopilot execution layer, because the bug is in executor ownership and completion semantics rather than the high-level route shape.
- Complete only when distance, relative speed, and angular speed are all within the exact point-arrival envelope.
- After final brake ownership or terminal capture begins, treat nominal `Accelerate` and positive prograde reacquire throttle as invalid for local waypoint routes. If later recovery needs main thrust, expose it as a distinct emergency/authority state.
- Keep terminal correction physical by routing translation and damping through existing RCS request paths. Do not assign rigidbody velocity.
- Restrict `Reacquire` profile reporting to actual avoidance route loss, post-avoidance reacquisition, or explicit terminal recovery conditions. Lateral velocity and off-axis attitude alone are not route-loss signals.
- Preserve the obstacle planner but fix execution gates so corridor clearance does not go negative and post-avoidance route reacquisition can still exact-arrive.

## Tests and Evidence
- Add focused EditMode tests for exact Complete gating, post-brake Accelerate blocking, terminal capture retention, and no-obstacle profile classification where test seams exist.
- Run the Proving Ground evidence generator and acceptance gates.
- Refresh `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/autopilot-proving-ground-summary.json`, affected `tests/performance/*.csv`, and `test-protocol.md`.
- Add this change's evidence under `.devtoolbox/specs/changes/fix-autopilot-exact-point-arrival-v1/tests/`.

## Risks
- Tightening completion may reveal slow terminal convergence in low-RCS cases. The expected safe outcome is explicit `LimitedRcsAuthority`, not false Complete.
- Blocking nominal acceleration after brake could reduce recovery flexibility if the ship enters an impossible state. Current Proving Ground v1 scenarios do not allow emergency recovery, so any such behavior must remain explicit and measurable.
- Obstacle clearance fixes must not regress direct no-obstacle routes or reintroduce safety replan chatter.
