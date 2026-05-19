# Tasks: fix-rcs-spool-status-velocitychange

## Spec

- [x] Create and validate the spec change artifacts.
- [x] Commit the spec artifacts.

## Implementation

- [ ] Update `RcsThrusterController` so spool-down applies decaying physical nozzle thrust.
- [ ] Update `RcsThrusterController` allocator status to account for residual force/torque.
- [ ] Update `ShipPhysicsCore` `ForceMode.VelocityChange` diagnostics to use mass-scaled impulse units.
- [ ] Update physics docs and debug evidence for the changed behavior.

## Tests

- [ ] Add or update regression coverage for RCS spool-down force application.
- [ ] Add or update regression coverage for residual-aware allocator status.
- [ ] Add or update regression coverage for mass-scaled `VelocityChange` impulse diagnostics.
- [ ] Run Unity MCP script validation and EditMode tests.
- [ ] Run dotnet build/test verification where applicable.

## Closeout

- [ ] Commit the implementation with an IFI-style message.
- [ ] Push the branch.
