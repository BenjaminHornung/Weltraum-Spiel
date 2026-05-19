# Design: RCS Spool, Allocator Status, and VelocityChange Diagnostics

## Context

The existing prototype already has the right core pieces for this fix: `ShipPhysicsCore` centralizes force/impulse diagnostics, and `RcsThrusterController` builds per-nozzle allocation data with actual nozzle throttle state. This change reuses those systems instead of adding a second physics path.

## RCS Spool-Down

When a command drops to zero, each nozzle should move its actual throttle toward zero using `nozzleSpoolDownRate`. If the actual throttle remains above zero for the frame, the nozzle still applies `forceAtFull * actualThrottle` at its position. This makes spool-down physical instead of only diagnostic.

The same behavior should be used when a request cannot produce a new allocation but previous nozzle throttle is still decaying. The controller should avoid creating hidden damping; it only applies remaining nozzle thrust that was already active.

## Allocator Status

The allocator status should describe the real result of the frame:

- `idle`: no request and no residual nozzle thrust.
- `spooling-down`: no active request, but decaying nozzle thrust was physically applied.
- `ok`: residual force and torque are within tolerance.
- `residual`: residual force or torque is above tolerance without saturation.
- `limited`: at least one nozzle saturated, but residuals are within tolerance.
- `limited-residual`: saturation and residual error are both present.
- existing failure statuses such as `no nozzles`, `no solution`, and `no fuel` remain available.

Residual checks should use both absolute tolerance and a ratio of the requested magnitude so tiny numeric noise does not mark healthy default maneuvers as failed.

## VelocityChange Diagnostics

Unity `ForceMode.VelocityChange` represents a requested velocity delta, not a Newton-second impulse value. For `ShipPhysicsCore` diagnostics, the recorded impulse should therefore be mass-scaled:

`diagnosticImpulse = velocityChange * rigidbody.mass`

For force-at-position calls, angular impulse diagnostics should be scaled the same way. Continuous force diagnostics must remain unchanged for `VelocityChange`.

## Tests

Regression tests should cover:

- RCS spool-down applies decaying actual force after the command is released.
- RCS with no prior throttle remains idle.
- A large unsatisfied RCS request reports residual/limited-residual instead of `ok`.
- `VelocityChange` records mass-scaled impulse diagnostics and does not inflate continuous force diagnostics.

## Risks

Physical spool-down can intentionally add a small amount of drift after input release. That is correct for finite response time, but the behavior must be visible in diagnostics so tuning can decide whether prototype defaults should use fast spool-down.
