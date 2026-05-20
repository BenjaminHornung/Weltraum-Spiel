# Tasks: fix-rcs-translation-drift

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Create execution for implementation slice
- [x] Confirm current RCS translation drift repro
- [x] Update RCS translation force application to avoid unintended torque
- [x] Preserve RCS attitude torque behavior
- [x] Preserve RCS translation VFX/nozzle diagnostics
- [x] Update diagnostics if needed for neutralized translation torque
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify pure RCS translation on all local axes leaves angular velocity near zero with SAS off
- [x] Verify pure RCS translation on all local axes leaves angular velocity near zero with SAS on
- [x] Verify RCS attitude commands still produce torque
- [x] Verify RCS translation VFX/nozzle selection still activates
- [x] Confirm Unity console has no compile errors
- [x] Commit implementation with spec title and changelog
