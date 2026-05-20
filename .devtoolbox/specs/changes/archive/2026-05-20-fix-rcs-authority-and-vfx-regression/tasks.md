# Tasks: fix-rcs-authority-and-vfx-regression

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [x] Reproduce or measure manual attitude authority with SAS on vs off
- [x] Reproduce or measure manual RCS translation authority with SAS on vs off
- [x] Inspect SAS/manual input blending and settle logic
- [x] Inspect current RCS thrust source and nozzle thrust application
- [x] Inspect generated RCS block, nozzle, and VFX placement
- [x] Identify why RCS VFX is invisible in play mode

## Implementation
- [x] Prevent SAS from counter-commanding axes with active manual attitude input
- [x] Preserve SAS residual damping after input release
- [x] Add per-RCS-block thrust values for the four generated RCS blocks
- [x] Use parent RCS block thrust for selected nozzles
- [x] Restore visible RCS exhaust while preserving exhaust-opposite-force convention
- [x] Update debug overlay if needed for RCS thrust and VFX diagnostics
- [x] Update physics documentation
- [x] Add or update test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh or compile scripts with Unity MCP and check console errors
- [x] Verify manual yaw authority with SAS on/off is comparable
- [x] Verify manual translation authority with SAS on/off is comparable
- [x] Verify SAS still damps released yaw to near zero
- [x] Verify four RCS blocks expose and use thrust values
- [x] Verify selected RCS nozzles show visible VFX
- [x] Verify exhaust direction remains opposite force direction
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
