# Tasks: architecture-sas-pd-control

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect current SAS input and allocator integration through Unity MCP
- [x] Add SAS mode model for Kill Rotation and Hold Attitude
- [ ] Convert SAS to desired torque generation
- [ ] Route SAS torque through RCS allocator
- [ ] Add per-axis manual override/masking diagnostics
- [ ] Add PD gain inspector fields
- [ ] Update debug overlay, README, and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify yaw, pitch, and roll stop to tolerance
- [ ] Verify SAS cannot stabilize without available thruster authority
- [ ] Verify manual axes remain responsive while SAS is on
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
