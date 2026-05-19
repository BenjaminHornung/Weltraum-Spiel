# Tasks: prototype-flight-tuning-diagnostics

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Implementation
- [x] Audit existing debug values and overlay fields
- [x] Add missing main thrust/gimbal diagnostics
- [x] Add missing RCS/SAS diagnostics
- [x] Add optional debug visualization for force/torque directions
- [x] Keep diagnostic visuals disabled or unobtrusive by default
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify overlay updates during main thrust
- [x] Verify overlay updates during RCS translation and attitude commands
- [x] Verify SAS diagnostics show active and released-axis behavior
- [x] Verify debug visuals do not affect physics
- [x] Commit implementation with spec title and changelog
