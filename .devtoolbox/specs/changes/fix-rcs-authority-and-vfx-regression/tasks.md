# Tasks: fix-rcs-authority-and-vfx-regression

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [ ] Reproduce or measure manual attitude authority with SAS on vs off
- [ ] Reproduce or measure manual RCS translation authority with SAS on vs off
- [ ] Inspect SAS/manual input blending and settle logic
- [ ] Inspect current RCS thrust source and nozzle thrust application
- [ ] Inspect generated RCS block, nozzle, and VFX placement
- [ ] Identify why RCS VFX is invisible in play mode

## Implementation
- [ ] Prevent SAS from counter-commanding axes with active manual attitude input
- [ ] Preserve SAS residual damping after input release
- [ ] Add per-RCS-block thrust values for the four generated RCS blocks
- [ ] Use parent RCS block thrust for selected nozzles
- [ ] Restore visible RCS exhaust while preserving exhaust-opposite-force convention
- [ ] Update debug overlay if needed for RCS thrust and VFX diagnostics
- [ ] Update physics documentation
- [ ] Add or update test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Refresh or compile scripts with Unity MCP and check console errors
- [ ] Verify manual yaw authority with SAS on/off is comparable
- [ ] Verify manual translation authority with SAS on/off is comparable
- [ ] Verify SAS still damps released yaw to near zero
- [ ] Verify four RCS blocks expose and use thrust values
- [ ] Verify selected RCS nozzles show visible VFX
- [ ] Verify exhaust direction remains opposite force direction
- [ ] Confirm DevToolbox spec validation passes
- [ ] Confirm git working tree only contains this spec slice before commit
- [ ] Commit with spec title and meaningful changelog
