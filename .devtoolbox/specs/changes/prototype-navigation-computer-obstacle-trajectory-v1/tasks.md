# prototype-navigation-computer-obstacle-trajectory-v1

## Spec
- [ ] Create proposal, design, capability spec, task list, and test protocol.
- [ ] Validate the change with `specs_validate`.
- [ ] Create execution records for the implementation and verification slices.

## Implementation
- [ ] Add navigation obstacle and obstacle detector components.
- [ ] Add trajectory planner data structures and phase planner.
- [ ] Rework waypoint autopilot to use detector/planner output and physical requests only.
- [ ] Make test-environment asteroids detectable navigation obstacles without unwanted hard blocking.
- [ ] Extend HUD, debug console, and minimap diagnostics for the Navigation Computer.

## Tests
- [ ] Add deterministic obstacle detector and trajectory planner tests.
- [ ] Add waypoint autopilot arrival, hold, authority, fuel, and Rigidbody-write regression tests.
- [ ] Add multi-step direct-route and obstacle-route planning tests.

## Evidence
- [ ] Validate changed scripts or document why Unity MCP cannot target this clean worktree.
- [ ] Run Unity EditMode/local tests and dotnet verification where applicable.
- [ ] Capture or generate navigation screenshots/evidence under `tests/screenshots/`.
- [ ] Document commands, logs, results, known limits, and evidence paths in `tests/test-protocol.md`.

## Closeout
- [ ] Update README and physics docs for the navigation computer.
- [ ] Run task completion preflight and toggle only verified tasks.
- [ ] Commit the completed navigation change.

