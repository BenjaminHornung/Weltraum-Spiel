# prototype-camera-anchor-framing-v1

## Spec
- [x] Create proposal, design, capability spec, task list, and test protocol.
- [x] Validate the change with `specs_validate`.
- [x] Create execution records for the implementation and verification slices.

## Implementation
- [x] Add `PrototypeCameraAnchor`.
- [x] Rework `SimpleFollowCamera` focus, zoom, reframe, and diagnostics.
- [x] Ensure bootstrap creates one Main Camera and adds/binds the camera anchor.
- [x] Ensure visual switcher manager is render/physics-free and imported visuals stay under the ship.
- [x] Extend HUD/debug camera diagnostics and controls.

## Tests
- [x] Add camera anchor, center-of-mass, visual-bounds-distance, and zoom focus tests.
- [x] Add bootstrap single-Main-Camera and visual switch binding tests.
- [x] Add manager object and diagnostics tests.

## Evidence
- [x] Validate changed scripts or document why Unity MCP cannot target this clean worktree.
- [x] Run Unity EditMode/local tests and dotnet verification where applicable.
- [x] Capture or generate camera screenshots/evidence under `tests/screenshots/`.
- [x] Document commands, logs, results, known limits, and evidence paths in `tests/test-protocol.md`.

## Closeout
- [x] Update README and physics docs for camera anchor/framing behavior.
- [x] Run task completion preflight and toggle only verified tasks.
- [x] Commit the completed camera change.
