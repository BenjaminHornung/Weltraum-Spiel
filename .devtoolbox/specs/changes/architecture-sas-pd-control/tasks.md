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
- [x] Convert SAS to desired torque generation
- [x] Route SAS torque through RCS allocator
- [x] Add per-axis manual override/masking diagnostics
- [x] Add PD gain inspector fields
- [x] Update debug overlay, README, and physics docs

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify yaw, pitch, and roll stop to tolerance
- [ ] Verify SAS cannot stabilize without available thruster authority
- [ ] Verify manual axes remain responsive while SAS is on
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
