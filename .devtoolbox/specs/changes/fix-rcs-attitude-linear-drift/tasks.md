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
- [ ] Create execution for implementation slice
- [ ] Reproduce WASD pitch/yaw linear drift with Unity MCP
- [ ] Compare Q/E roll behavior as control case
- [ ] Identify whether drift comes from non-zero net attitude force, selected nozzle layout, or diagnostics mismatch

## Implementation
- [ ] Update RCS attitude force application to avoid linear drift
- [ ] Preserve pitch/yaw/roll torque behavior
- [ ] Preserve translation COM-neutral behavior
- [ ] Preserve selected RCS nozzle/VFX diagnostics
- [ ] Update diagnostics if needed
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify pure pitch from rest creates angular velocity and near-zero linear velocity
- [ ] Verify pure yaw from rest creates angular velocity and near-zero linear velocity
- [ ] Verify pure roll remains functional and near-zero linear velocity
- [ ] Verify pure RCS translation still has zero unintended torque
- [ ] Verify SAS attitude braking does not add linear drift
- [ ] Confirm Unity console has no compile errors
- [ ] Commit implementation with spec title and changelog
