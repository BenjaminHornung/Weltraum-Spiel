# Tasks: prototype-rcs-force-allocator

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Review Triage
- [ ] Record accepted external review findings in test evidence
- [ ] Confirm current RCS paths still apply command groups independently
- [ ] Confirm current axis force disparity for +X/+Y/+Z
- [ ] Confirm combined translation + attitude can select the same nozzle more than once

## Implementation
- [ ] Create execution for allocator implementation slice
- [ ] Refactor RcsThrusterController to collect desired force/torque before applying RCS forces
- [ ] Build per-nozzle allocation data from transform direction, COM lever arm, and max thrust
- [ ] Implement bounded prototype allocation with throttle values in [0, 1]
- [ ] Apply at most one AddForceAtPosition per selected nozzle
- [ ] Preserve active nozzle IDs and VFX activation
- [ ] Preserve or update debug diagnostics for total RCS force and torque
- [ ] Remove or bypass old per-axis additive force paths
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify full +X/+Y/+Z translation net force parity within tolerance
- [ ] Verify pure translation has near-zero unintended torque
- [ ] Verify pure pitch/yaw/roll have near-zero linear drift and non-zero angular velocity
- [ ] Verify combined translation + attitude does not oversubscribe any nozzle
- [ ] Verify SAS uses allocator behavior and does not add linear drift
- [ ] Verify active nozzle/VFX diagnostics remain populated
- [ ] Confirm Unity console has no compile errors
- [ ] Commit implementation with spec title and changelog
