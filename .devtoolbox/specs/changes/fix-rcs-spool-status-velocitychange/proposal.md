# fix-rcs-spool-status-velocitychange

## Why

The current physics prototype is close to a consistent core, but three diagnostic and response edge cases remain from review:

- RCS spool-down reduces stored nozzle throttle without applying the remaining physical thrust.
- The RCS allocator can report `ok` even when the requested force or torque has a large residual error.
- `ForceMode.VelocityChange` is recorded in impulse diagnostics with the raw delta-velocity vector instead of a mass-scaled impulse.

These issues make physics debugging less trustworthy and can hide real allocator or control-response defects.

## What

Make a narrow consistency fix for RCS response and physics diagnostics:

- RCS nozzles with nonzero actual throttle continue to apply decaying thrust while spooling down.
- RCS allocator status reflects meaningful residual force/torque errors, not only saturated nozzles.
- `ShipPhysicsCore` records `VelocityChange` diagnostics as mass-scaled impulse/angular impulse while keeping continuous force diagnostics clean.
- Add regression tests and update physics documentation/evidence.

## Out of Scope

- Replacing the greedy RCS allocator with a full bounded least-squares solver.
- Separate RCS fuel chemistry or ISP-based mass flow.
- Removing legacy RCS methods.
- Renaming `minSelectionDot` or splitting SAS config fields.
- New gameplay controls, cameras, weapons, docking, or orbital features.

## Success Criteria

- Releasing an RCS command with finite spool-down applies residual force until nozzle throttle reaches zero.
- Idle RCS with no previous throttle reports idle and applies no force.
- Impossible or underpowered RCS requests do not report `ok` when residuals are large.
- `ForceMode.VelocityChange` does not increase continuous force diagnostics and records impulse diagnostics using Rigidbody mass.
- Unity EditMode regression tests pass.
- The change remains small and uses the existing `ShipPhysicsCore` and `RcsThrusterController` patterns.
