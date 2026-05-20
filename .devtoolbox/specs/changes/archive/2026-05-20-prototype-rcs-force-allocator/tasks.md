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
- [x] Record accepted external review findings in test evidence
- [x] Confirm current RCS paths still apply command groups independently
- [x] Confirm current axis force disparity for +X/+Y/+Z
- [x] Confirm combined translation + attitude can select the same nozzle more than once

## Implementation
- [x] Create execution for allocator implementation slice
- [x] Refactor RcsThrusterController to collect desired force/torque before applying RCS forces
- [x] Build per-nozzle allocation data from transform direction, COM lever arm, and max thrust
- [x] Implement bounded prototype allocation with throttle values in [0, 1]
- [x] Apply at most one AddForceAtPosition per selected nozzle
- [x] Preserve active nozzle IDs and VFX activation
- [x] Preserve or update debug diagnostics for total RCS force and torque
- [x] Remove or bypass old per-axis additive force paths
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify full +X/+Y/+Z translation net force parity within tolerance
- [x] Verify pure translation has near-zero unintended torque
- [x] Verify pure pitch/yaw/roll have near-zero linear drift and non-zero angular velocity
- [x] Verify combined translation + attitude does not oversubscribe any nozzle
- [x] Verify SAS uses allocator behavior and does not add linear drift
- [x] Verify active nozzle/VFX diagnostics remain populated
- [x] Confirm Unity console has no compile errors
- [x] Commit implementation with spec title and changelog
