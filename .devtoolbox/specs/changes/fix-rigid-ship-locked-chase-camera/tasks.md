# Tasks: fix-rigid-ship-locked-chase-camera

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [ ] Inspect current camera smoothing and lag behavior
- [ ] Create DevToolbox execution for implementation slice
- [ ] Update SimpleFollowCamera Mode 0 to exact ship-locked pose
- [ ] Make Mode 0 mouse look momentary and anchor-safe
- [ ] Preserve V debug camera modes and reset behavior
- [ ] Add camera diagnostics to PrototypeDebugOverlay
- [ ] Add test evidence under this spec change

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Refresh/compile scripts and check Unity console errors
- [ ] Run deterministic anchor/no-lag probe through Unity MCP
- [ ] Verify Rigidbody interpolation remains enabled for the player ship
- [ ] Confirm DevToolbox spec validation passes
- [ ] Commit implementation with spec title and changelog
