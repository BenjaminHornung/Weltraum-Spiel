# Tasks: fix-wasd-sas-residual-momentum

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [x] Inspect current SAS command calculation
- [x] Inspect RCS torque/nozzle selection for pitch, yaw, and roll
- [x] Reproduce or simulate residual angular velocity with SAS on/off
- [x] Identify why pitch/yaw braking stops before near-zero angular velocity

## Implementation
- [x] Fix the smallest root cause in existing controller path
- [x] Preserve SAS-off vacuum inertia
- [x] Preserve Q/E roll stabilization
- [x] Keep overlay diagnostics useful for SAS/RCS braking
- [x] Update physics documentation if thresholds or control semantics change
- [x] Add or update test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh/compile scripts with Unity MCP and check console errors
- [x] Verify SAS-off inertia remains
- [x] Verify SAS-on pitch residual braking
- [x] Verify SAS-on yaw residual braking
- [x] Verify SAS-on roll residual braking
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
