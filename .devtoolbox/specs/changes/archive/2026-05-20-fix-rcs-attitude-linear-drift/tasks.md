# Tasks: fix-rcs-attitude-linear-drift

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Investigation
- [x] Create execution for implementation slice
- [x] Reproduce WASD pitch/yaw linear drift with Unity MCP
- [x] Compare Q/E roll behavior as control case
- [x] Identify whether drift comes from non-zero net attitude force, selected nozzle layout, or diagnostics mismatch

## Implementation
- [x] Update RCS attitude force application to avoid linear drift
- [x] Preserve pitch/yaw/roll torque behavior
- [x] Preserve translation COM-neutral behavior
- [x] Preserve selected RCS nozzle/VFX diagnostics
- [x] Update diagnostics if needed
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify pure pitch from rest creates angular velocity and near-zero linear velocity
- [x] Verify pure yaw from rest creates angular velocity and near-zero linear velocity
- [x] Verify pure roll remains functional and near-zero linear velocity
- [x] Verify pure RCS translation still has zero unintended torque
- [x] Verify SAS attitude braking does not add linear drift
- [x] Confirm Unity console has no compile errors
- [x] Commit implementation with spec title and changelog
