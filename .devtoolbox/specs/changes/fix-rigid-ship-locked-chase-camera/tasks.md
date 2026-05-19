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
- [x] Inspect current camera smoothing and lag behavior
- [x] Create DevToolbox execution for implementation slice
- [x] Update SimpleFollowCamera Mode 0 to exact ship-locked pose
- [x] Make Mode 0 mouse look momentary and anchor-safe
- [x] Preserve V debug camera modes and reset behavior
- [x] Add camera diagnostics to PrototypeDebugOverlay
- [x] Add test evidence under this spec change

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Refresh/compile scripts and check Unity console errors
- [x] Run deterministic anchor/no-lag probe through Unity MCP
- [x] Verify Rigidbody interpolation remains enabled for the player ship
- [x] Confirm DevToolbox spec validation passes
- [x] Commit implementation with spec title and changelog
