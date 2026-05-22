# Camera UI Docs

## Requirements

### Requirement: Keybind Overlay Documents Camera Controls

The in-game keybind overlay SHALL document:

- `V` cycle camera mode,
- right mouse orbit/look,
- mouse wheel zoom,
- backquote/reset or refocus camera,
- FreeInspect controls when implemented, including right mouse + WASD and vertical movement keys.

### Requirement: Debug Console Exposes Camera Controls

The prototype debug console SHALL include a camera section that shows the current mode, effective distance, zoom component, and visual bounds radius where available. It SHALL provide controls for previous/next camera mode, reset camera, reframe to ship, zoom in, and zoom out.

### Requirement: Flight Diagnostics Include Compact Camera State

The HUD or diagnostics UI SHALL expose a compact camera line or advanced camera section with camera mode, effective distance, visual bounds radius, and anchor/focus error where available.

### Requirement: README Documents Camera And F6 Interplay

README SHALL document the camera modes, mouse wheel zoom, FreeInspect behavior, reset/refocus behavior, and how F6 visual switching interacts with visual-bounds framing.

### Requirement: Tests Cover Camera Behavior

Automated tests SHALL cover camera mode count/cycle, scroll or programmatic zoom changing effective distance, reframe increasing distance for larger bounds, reframe decreasing distance for smaller bounds within clamps, and reset restoring expected defaults.

### Requirement: Manual Test Protocol Captures Runtime Acceptance

The change SHALL include `.devtoolbox/specs/changes/prototype-camera-control-framing-v0/tests/test-protocol.md` with manual PlayMode checks for generated primitives, imported scout, imported cargo, zoom in each mode, FreeInspect movement, and reset/refocus.