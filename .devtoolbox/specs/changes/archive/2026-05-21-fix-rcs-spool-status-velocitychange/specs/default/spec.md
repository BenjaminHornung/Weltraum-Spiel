# Specification: RCS Response and Physics Diagnostics Consistency

## Capability

The prototype physics layer shall keep RCS response and diagnostic units consistent when nozzle throttle decays, allocator residuals are large, or `ForceMode.VelocityChange` is used.

## Requirements

### RCS Spool-Down

- The RCS controller SHALL retain per-nozzle actual throttle state across physics frames.
- When a nozzle's target throttle becomes zero and its actual throttle is still above zero, the controller SHALL move the actual throttle toward zero using the configured spool-down rate.
- While the decaying actual throttle remains above zero, the controller SHALL apply exactly one force at that nozzle for the frame.
- Spool-down forces SHALL use the existing nozzle position, nozzle direction, block thrust, fuel availability, and `ShipPhysicsCore` force-at-position path.
- If no request exists and no nozzle has residual actual throttle, the allocator status SHALL be `idle` and no RCS force SHALL be applied.

### Allocator Status and Residuals

- The RCS controller SHALL expose desired, actual, and residual force/torque diagnostics for each allocation frame.
- The allocator status SHALL report `ok` only when force and torque residuals are within tolerance.
- If residuals exceed tolerance without saturated nozzles, the allocator status SHALL report `residual`.
- If nozzles saturate and residuals remain above tolerance, the allocator status SHALL report `limited-residual`.
- If nozzles saturate but residuals remain within tolerance, the allocator status SHALL report `limited`.
- Existing failure statuses such as `no nozzles`, `no solution`, and `no fuel` SHALL remain meaningful.

### VelocityChange Diagnostics

- `ShipPhysicsCore` SHALL keep continuous force/torque diagnostics separate from impulse/angular impulse diagnostics.
- `ForceMode.VelocityChange` SHALL NOT increment continuous force/torque diagnostics.
- For diagnostics, `ForceMode.VelocityChange` SHALL be recorded as a mass-scaled impulse using the current Rigidbody mass.
- For force-at-position diagnostics, the angular impulse for `VelocityChange` SHALL be equivalent to `cross(position - centerOfMass, velocityChange * mass)`.

## Acceptance Criteria

- A regression test proves RCS spool-down applies nonzero actual force after command release when the spool-down rate is finite.
- A regression test proves idle RCS applies no force and reports `idle` when no residual actual throttle exists.
- A regression test proves an unsatisfied request does not report `ok` while residuals are above tolerance.
- A regression test proves `VelocityChange` records mass-scaled impulse diagnostics without changing continuous force diagnostics.
- Unity script validation and EditMode tests pass.
