# Draft Spec: prototype-autopilot-arrival-tuning

Status: draft only. Promote to an active DevToolbox change after `prototype-waypoint-navigation-autopilot-v0` exists.

## Purpose

Tune the first waypoint autopilot after real play testing. The initial autopilot should prove the concept; this follow-up should make arrival behavior more reliable, readable, and less frustrating.

## In Scope

- Overshoot reduction.
- Arrival distance and velocity tolerance tuning.
- Lateral velocity cancellation tuning.
- Approach speed limiting.
- Fuel-aware conservative arrival mode.
- Debug visualization for braking point, predicted stop distance, and target-relative velocity.
- Compare different ship configs to confirm heavier or weaker ships arrive differently.

## Out of Scope

- No gravity wells.
- No route planning.
- No docking corridor.
- No full map UI.
- No mission system.

## Required Behaviors

- Slow down earlier if remaining fuel is low.
- Avoid accelerating to speeds that cannot be braked within estimated fuel and distance limits.
- If a fast arrival looks unsafe, choose a slower safe approach or report a warning state.
- Use current velocity, not just distance to target.
- Expose enough debug values to explain accelerate, coast, brake, or hold decisions.

## Acceptance Criteria

- Autopilot reaches close targets without large oscillation.
- Autopilot reaches longer targets faster than a purely conservative slow approach when fuel allows.
- Low-fuel scenarios result in warning, slower approach, or abort rather than high-speed overshoot.
- Lateral velocity is reduced near arrival when RCS exists.
- Different ship configs produce explainable changes in ETA and stopping distance.
- Debug overlay shows predicted braking threshold and current margin.

## Risks

Tuning can become open-ended. Require a small fixed set of test scenarios and accept prototype-level imperfection.
