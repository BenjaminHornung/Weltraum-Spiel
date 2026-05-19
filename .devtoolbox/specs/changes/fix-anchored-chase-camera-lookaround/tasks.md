# Tasks: fix-anchored-chase-camera-lookaround

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox

## Investigation
- [ ] Inspect current mode 0 mouse-look offset behavior
- [ ] Confirm current look offsets rotate the camera anchor
- [ ] Confirm debug camera mode behavior to preserve

## Implementation
- [ ] Keep mode 0 camera position fixed at the ship-local rear anchor
- [ ] Make mouse look adjust only look direction or look target in mode 0
- [ ] Keep ship centered or nearly centered in default chase view
- [ ] Preserve V camera perspective cycling for debug modes
- [ ] Preserve reset behavior and snap-to-chase
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Refresh or compile scripts with Unity MCP and check console errors
- [ ] Verify mode 0 anchor follows ship yaw, pitch, and roll
- [ ] Verify mouse look does not move the mode 0 anchor
- [ ] Verify mouse look changes view direction
- [ ] Verify reset returns to anchored mode 0 chase
- [ ] Confirm DevToolbox spec validation passes
- [ ] Confirm git working tree only contains this spec slice before commit
- [ ] Commit with spec title and meaningful changelog
