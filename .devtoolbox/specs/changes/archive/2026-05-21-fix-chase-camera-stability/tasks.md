# Tasks: fix-chase-camera-stability

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Investigation
- [x] Inspect current SimpleFollowCamera behavior
- [x] Confirm default mode uses world-space orbit instead of ship-relative chase offset
- [x] Identify bootstrap/camera binding compatibility requirements

## Implementation
- [x] Make mode 0 a ship-relative chase camera
- [x] Keep mouse look camera-only and preserve reset behavior
- [x] Keep V camera mode cycling functional
- [x] Tune default smoothing for stable RCS maneuvers
- [x] Update README or camera documentation if needed
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh or compile scripts with Unity MCP and check console errors
- [x] Verify default chase offset follows yaw, pitch, and roll changes
- [x] Verify mouse look does not alter ship input state
- [x] Verify reset returns to mode 0 chase
- [x] Verify bootstrap still binds the camera
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
