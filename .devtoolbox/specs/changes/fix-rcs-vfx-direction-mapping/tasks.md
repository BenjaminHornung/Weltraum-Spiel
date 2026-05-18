# Tasks: fix-rcs-vfx-direction-mapping

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [ ] Inspect RCS nozzle creation and VFX parenting in PrototypeBootstrap
- [ ] Inspect RCS force/torque selection and VFX activation in RcsThrusterController
- [ ] Determine the force-direction vs exhaust-direction convention
- [ ] Reproduce or simulate mismatched VFX for translation, manual attitude, or SAS
- [ ] Identify whether the bug is VFX-only or vector/selection logic

## Implementation
- [ ] Fix the smallest root cause while preserving current controls
- [ ] Ensure selected nozzles and active VFX share one source of truth
- [ ] Ensure VFX orientation follows the documented exhaust convention
- [ ] Update physics documentation with the RCS direction convention
- [ ] Add or update test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Refresh/compile scripts with Unity MCP and check console errors
- [ ] Verify translation command nozzle/VFX mapping
- [ ] Verify manual attitude command nozzle/VFX mapping
- [ ] Verify SAS command nozzle/VFX mapping
- [ ] Confirm DevToolbox spec validation passes
- [ ] Confirm git working tree only contains this spec slice before commit
- [ ] Commit with spec title and meaningful changelog
