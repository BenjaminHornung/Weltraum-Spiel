# Tasks: fix-rcs-vfx-direction-mapping

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add tasks.md
- [x] Add behavioral spec requirements
- [x] Validate spec with DevToolbox

## Investigation
- [x] Inspect RCS nozzle creation and VFX parenting in PrototypeBootstrap
- [x] Inspect RCS force/torque selection and VFX activation in RcsThrusterController
- [x] Determine the force-direction vs exhaust-direction convention
- [x] Reproduce or simulate mismatched VFX for translation, manual attitude, or SAS
- [x] Identify whether the bug is VFX-only or vector/selection logic

## Implementation
- [x] Fix the smallest root cause while preserving current controls
- [x] Ensure selected nozzles and active VFX share one source of truth
- [x] Ensure VFX orientation follows the documented exhaust convention
- [x] Update physics documentation with the RCS direction convention
- [x] Add or update test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh/compile scripts with Unity MCP and check console errors
- [x] Verify translation command nozzle/VFX mapping
- [x] Verify manual attitude command nozzle/VFX mapping
- [x] Verify SAS command nozzle/VFX mapping
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
