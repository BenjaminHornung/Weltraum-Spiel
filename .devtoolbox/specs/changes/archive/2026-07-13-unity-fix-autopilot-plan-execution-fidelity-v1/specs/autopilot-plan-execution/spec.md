# Spec: Autopilot Plan Execution Fidelity

## Capability

Waypoint autopilot direct fast transfer execution fidelity.

## Requirements

### Requirement: Nominal direct fast transfer follows one computed plan
The waypoint autopilot MUST execute a valid direct fast transfer flight plan in plan time without manipulating the flight-plan clock during nominal execution.

#### Scenario: Distant waypoint transfer
- Given a ship is engaged on a distant waypoint with a valid direct fast transfer plan
- When the autopilot executes the plan nominally
- Then the execution uses exactly one align, one burn, one flip, one brake, and final hold/capture
- And the transfer completes inside the arrival radius and arrival speed limits
- And no forced safety replan occurs during the nominal transfer
- And the elapsed runtime stays within 15 percent of the plan duration

### Requirement: Planner physics matches executor limits
The trajectory planner MUST model the same turn, throttle-spool, burn, and brake constraints that the executor applies.

#### Scenario: Attitude segment duration
- Given an attitude change angle and the shared brake-flip turn limits
- When the planner estimates attitude segment duration
- Then the estimate uses a trapezoid/triangle profile with the shared max turn rate, max angular acceleration, damping time, and latch margin
- And the maximum attitude segment duration permits realistic 180 degree flips.

#### Scenario: Burn and brake segments include throttle spool
- Given a direct fast transfer burn or brake segment
- When the planner solves segment timing and predicts maneuver samples
- Then throttle spool-up and spool-down rates from the ship planning snapshot are included
- And both burn and brake use the same spool-aware prediction model.

#### Scenario: Brake end target
- Given a direct fast transfer approaches the target
- When the brake segment is planned
- Then the brake is sized for arrival speed at the arrival radius instead of zero velocity before the target.

### Requirement: Executor clock is authoritative
The direct fast transfer executor MUST keep the plan clock moving with fixed physics time during nominal execution.

#### Scenario: Early attitude alignment
- Given the ship aligns before an attitude-only segment ends
- When the executor remains inside that segment
- Then the executor holds attitude until the planned segment end instead of skipping the clock forward.

#### Scenario: Slow attitude alignment
- Given the ship is still aligning during an attitude segment
- When the segment is executing
- Then the flight-plan clock continues to advance
- And throttle latches may gate actuators without freezing the plan clock.

### Requirement: Divergence and braking diagnostics are truthful
Autopilot diagnostics MUST distinguish tracking correction from real forced replans and MUST use the effective brake authority for the active plan.

#### Scenario: Flip-brake plan is active
- Given a valid direct fast transfer flip-brake plan is active
- When diagnostics calculate stopping distance and brake readiness
- Then the effective brake deceleration uses full main-thrust braking for flip-brake plans
- And reverse-thrust multiplier remains reserved for reverse-thrust braking scenarios.

#### Scenario: Nominal plan execution
- Given the flight plan is active and not divergent
- When hold, terminal, or conservative brake gates are evaluated
- Then those gates do not preempt the nominal plan executor.

### Requirement: Replan hygiene prevents oscillation
Forced replans MUST be rare, confirmed for soft divergence reasons, and must not reintroduce redundant align/flip segments after brake commitment.

#### Scenario: Soft divergence
- Given only soft divergence reasons are present
- When the divergence monitor evaluates replan timing
- Then the soft divergence is confirmed for at least 0.5 seconds
- And forced replans respect a 2.0 second cooldown.

#### Scenario: Brake-committed replan
- Given a direct fast transfer has committed to braking
- When a replan is required
- Then the planner produces only brake/hold recovery when applicable
- And skips redundant align/flip segments if the current rotation already satisfies the brake alignment latch.

### Requirement: Plan preview can become the executed plan
A fresh, valid plan created by the plan button MUST be reused when engaging autopilot if the target and freshness constraints still match.

#### Scenario: Engage after plan preview
- Given the user generated a fresh valid plan for the current target
- When the user engages autopilot before the plan expires
- Then the existing plan is adopted for execution instead of being discarded by a forced replan.

### Requirement: UI status reflects actual replans
Navigation warning chips MUST show REPLAN only for actual forced replans, and tracking correction MUST be represented separately.

#### Scenario: Tracking correction without forced replan
- Given tracking correction is active but no forced replan occurred recently
- When navigation warning chips are built
- Then the UI shows a tracking status rather than REPLAN.

## Constraints

- Keep the change scoped to prototype autopilot planning, execution, diagnostics, status, and focused tests/evidence.
- Do not introduce orbital or gravitational planning.
- Do not implement the optional executor extraction as part of this change.
- Preserve strict direct fast transfer execution semantics unless a task explicitly changes them.
