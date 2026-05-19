# Tasks: prototype-flight-tuning-diagnostics

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Implementation
- [ ] Audit existing debug values and overlay fields
- [ ] Add missing main thrust/gimbal diagnostics
- [ ] Add missing RCS/SAS diagnostics
- [ ] Add optional debug visualization for force/torque directions
- [ ] Keep diagnostic visuals disabled or unobtrusive by default
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify overlay updates during main thrust
- [ ] Verify overlay updates during RCS translation and attitude commands
- [ ] Verify SAS diagnostics show active and released-axis behavior
- [ ] Verify debug visuals do not affect physics
- [ ] Commit implementation with spec title and changelog
