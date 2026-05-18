# Tasks: fix-sas-toggle-yaw-stop

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [x] Reproduce the SAS-off `A`, release, SAS-on yaw-stop scenario
- [x] Inspect current SAS convergence control law and thresholds
- [x] Identify why yaw does not settle below `0.005 rad/s`

## Implementation
- [x] Fix the smallest SAS convergence root cause
- [x] Preserve SAS-off vacuum inertia
- [x] Preserve pitch and roll SAS behavior
- [x] Update physics documentation if convergence semantics change
- [x] Add or update test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh/compile scripts with Unity MCP and check console errors
- [x] Verify exact SAS-off `A`, release, SAS-on scenario reaches yaw `< 0.005 rad/s`
- [x] Verify SAS-off yaw inertia remains without enabling SAS
- [x] Verify pitch and roll convergence remain below `0.005 rad/s`
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
