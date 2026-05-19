# Tasks: architecture-thruster-response-model

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect current throttle and gimbal command path through Unity MCP
- [ ] Add target vs actual throttle fields
- [ ] Add spool-up and spool-down rates
- [ ] Add target vs actual gimbal yaw/pitch
- [ ] Add gimbal slew rate
- [ ] Optionally prepare RCS response fields without changing defaults
- [ ] Update overlay/docs with target vs actual output

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify actual throttle ramps with finite rate
- [ ] Verify actual gimbal angle respects slew rate and max angle
- [ ] Verify default prototype remains responsive
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
