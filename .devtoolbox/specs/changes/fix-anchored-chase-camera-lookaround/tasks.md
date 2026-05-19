# Tasks: fix-anchored-chase-camera-lookaround

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Investigation
- [x] Inspect current mode 0 mouse-look offset behavior
- [x] Confirm current look offsets rotate the camera anchor
- [x] Confirm debug camera mode behavior to preserve

## Implementation
- [x] Keep mode 0 camera position fixed at the ship-local rear anchor
- [x] Make mouse look adjust only look direction or look target in mode 0
- [x] Keep ship centered or nearly centered in default chase view
- [x] Preserve V camera perspective cycling for debug modes
- [x] Preserve reset behavior and snap-to-chase
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh or compile scripts with Unity MCP and check console errors
- [x] Verify mode 0 anchor follows ship yaw, pitch, and roll
- [x] Verify mouse look does not move the mode 0 anchor
- [x] Verify mouse look changes view direction
- [x] Verify reset returns to anchored mode 0 chase
- [x] Confirm DevToolbox spec validation passes
- [x] Confirm git working tree only contains this spec slice before commit
- [x] Commit with spec title and meaningful changelog
