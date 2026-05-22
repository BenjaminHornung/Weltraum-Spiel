# Tasks: fix-rcs-spool-status-velocitychange

## Spec

- [x] Create and validate the spec change artifacts.
- [x] Commit the spec artifacts.

## Implementation

- [x] Update `RcsThrusterController` so spool-down applies decaying physical nozzle thrust.
- [x] Update `RcsThrusterController` allocator status to account for residual force/torque.
- [x] Update `ShipPhysicsCore` `ForceMode.VelocityChange` diagnostics to use mass-scaled impulse units.
- [x] Update physics docs and debug evidence for the changed behavior.

## Tests

- [x] Add or update regression coverage for RCS spool-down force application.
- [x] Add or update regression coverage for residual-aware allocator status.
- [x] Add or update regression coverage for mass-scaled `VelocityChange` impulse diagnostics.
- [x] Run Unity MCP script validation and EditMode tests.
- [x] Run dotnet build/test verification where applicable.

## Closeout

- [x] Commit the implementation with an IFI-style message.
- [x] Push the branch.
