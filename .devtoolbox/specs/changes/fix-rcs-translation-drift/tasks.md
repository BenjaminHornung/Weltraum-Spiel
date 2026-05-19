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
- [ ] Create execution for implementation slice
- [ ] Confirm current RCS translation drift repro
- [ ] Update RCS translation force application to avoid unintended torque
- [ ] Preserve RCS attitude torque behavior
- [ ] Preserve RCS translation VFX/nozzle diagnostics
- [ ] Update diagnostics if needed for neutralized translation torque
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify pure RCS translation on all local axes leaves angular velocity near zero with SAS off
- [ ] Verify pure RCS translation on all local axes leaves angular velocity near zero with SAS on
- [ ] Verify RCS attitude commands still produce torque
- [ ] Verify RCS translation VFX/nozzle selection still activates
- [ ] Confirm Unity console has no compile errors
- [ ] Commit implementation with spec title and changelog
