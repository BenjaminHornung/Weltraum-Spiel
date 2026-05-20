# prototype-camera-anchor-framing-v1

## Spec
- [ ] Create proposal, design, capability spec, task list, and test protocol.
- [ ] Validate the change with `specs_validate`.
- [ ] Create execution records for the implementation and verification slices.

## Implementation
- [ ] Add `PrototypeCameraAnchor`.
- [ ] Rework `SimpleFollowCamera` focus, zoom, reframe, and diagnostics.
- [ ] Ensure bootstrap creates one Main Camera and adds/binds the camera anchor.
- [ ] Ensure visual switcher manager is render/physics-free and imported visuals stay under the ship.
- [ ] Extend HUD/debug camera diagnostics and controls.

## Tests
- [ ] Add camera anchor, center-of-mass, visual-bounds-distance, and zoom focus tests.
- [ ] Add bootstrap single-Main-Camera and visual switch binding tests.
- [ ] Add manager object and diagnostics tests.

## Evidence
- [ ] Validate changed scripts or document why Unity MCP cannot target this clean worktree.
- [ ] Run Unity EditMode/local tests and dotnet verification where applicable.
- [ ] Capture or generate camera screenshots/evidence under `tests/screenshots/`.
- [ ] Document commands, logs, results, known limits, and evidence paths in `tests/test-protocol.md`.

## Closeout
- [ ] Update README and physics docs for camera anchor/framing behavior.
- [ ] Run task completion preflight and toggle only verified tasks.
- [ ] Commit the completed camera change.

