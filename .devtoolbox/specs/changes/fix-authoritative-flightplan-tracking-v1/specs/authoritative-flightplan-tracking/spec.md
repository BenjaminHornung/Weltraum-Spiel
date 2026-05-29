# Authoritative FlightPlan Tracking Specification

## Capability

Waypoint autopilot shall execute the same precomputed flight plan that the player sees, using closed-loop tracking against predicted samples.

## Requirements

### Requirement: Strict FlightPlan Authority

The system SHALL keep `useFlightPlanExecutor` enabled as the normal waypoint-autopilot architecture.

The system SHALL expose `strictFlightPlanExecution`, default enabled.

When strict execution is enabled, the system SHALL NOT use the legacy live accelerate/brake/flip/final/hold gates as normal navigation while a flight plan is executable or being replanned.

When strict execution cannot safely continue, the system SHALL clear unsafe thrust and request a visible replan/abort reason.

### Requirement: Predicted Sample Tracking

The executor SHALL track `PrototypeFlightPlan.predictedSamples` for the active plan revision.

The tracker SHALL interpolate the reference sample for executor elapsed time and compute position, velocity, cross-track, along-track, attitude, angular velocity, speed and fuel errors from the real Rigidbody state.

The tracker SHALL produce a bounded desired acceleration from planned feedforward plus feedback correction.

The tracker SHALL split command intent into main-throttle and RCS correction without directly writing Rigidbody position, velocity, rotation, or angular velocity.

### Requirement: Geometric Safety Guards

For ProgradeBurn and ReacquireRoute, the desired acceleration SHALL align with the planned path tangent and SHALL NOT sustain acceleration away from the direct target route unless the active segment is Avoidance or Brake.

For AvoidanceBurn, the command SHALL either move toward the planned avoidance waypoint or reduce collision risk.

For RetrogradeBurn, main-thrust command SHALL oppose current velocity or closing velocity.

For FinalApproach and Hold, main throttle SHALL be suppressed for small corrections; RCS SHALL handle terminal drift when authority exists.

If any guard fails, the system SHALL set main throttle to zero, mark the plan for replan, and surface an invalid-plan-direction style status.

### Requirement: Replan From Actual State

A replan SHALL use the current Rigidbody state and replace both displayed preview route and executor route together.

Plan preservation SHALL only happen while target, initial-state tolerance, tracking error, obstacle state and segment geometry remain valid.

Repeated replans in a short window SHALL become a visible unstable-plan/fail status instead of blind burn continuation.

### Requirement: Player Diagnostics

The HUD/debug diagnostics SHALL expose plan id, revision, active segment, active sample, tracking error, cross-track error, velocity error, desired acceleration, main/RCS split and replan reason.

The displayed route SHALL derive from the active flight plan samples and tests SHALL be able to compare displayed/current plan identity with executor plan identity.

## Scenarios

- Given a direct route plan, when autopilot engages, then the ship tracks predicted samples and makes positive along-track progress.
- Given actual motion diverging from the predicted path, when error exceeds tolerance for a short confirmation window, then a new plan revision is created from actual state.
- Given a segment direction inconsistent with the planned path, when the executor reaches that segment, then main throttle remains zero and a replan reason is visible.
- Given an imported functional ship, when the executor is active, then the ship does not sustain acceleration away from the selected waypoint or planned tangent.
