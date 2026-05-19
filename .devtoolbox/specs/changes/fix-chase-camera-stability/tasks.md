# Tasks: fix-chase-camera-stability

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Investigation
- [ ] Inspect current SimpleFollowCamera behavior
- [ ] Confirm default mode uses world-space orbit instead of ship-relative chase offset
- [ ] Identify bootstrap/camera binding compatibility requirements

## Implementation
- [ ] Make mode 0 a ship-relative chase camera
- [ ] Keep mouse look camera-only and preserve reset behavior
- [ ] Keep V camera mode cycling functional
- [ ] Tune default smoothing for stable RCS maneuvers
- [ ] Update README or camera documentation if needed
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Refresh or compile scripts with Unity MCP and check console errors
- [ ] Verify default chase offset follows yaw, pitch, and roll changes
- [ ] Verify mouse look does not alter ship input state
- [ ] Verify reset returns to mode 0 chase
- [ ] Verify bootstrap still binds the camera
- [ ] Confirm DevToolbox spec validation passes
- [ ] Confirm git working tree only contains this spec slice before commit
- [ ] Commit with spec title and meaningful changelog
