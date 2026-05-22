# prototype-navigation-computer-obstacle-trajectory-v1

## Spec
- [x] Create proposal, design, capability spec, task list, and test protocol.
- [x] Validate the change with `specs_validate`.
- [x] Create execution records for the implementation and verification slices.

## Implementation
- [x] Add navigation obstacle and obstacle detector components.
- [x] Add trajectory planner data structures and phase planner.
- [x] Rework waypoint autopilot to use detector/planner output and physical requests only.
- [x] Make test-environment asteroids detectable navigation obstacles without unwanted hard blocking.
- [x] Extend HUD, debug console, and minimap diagnostics for the Navigation Computer.

## Tests
- [x] Add deterministic obstacle detector and trajectory planner tests.
- [x] Add waypoint autopilot arrival, hold, authority, fuel, and Rigidbody-write regression tests.
- [x] Add multi-step direct-route and obstacle-route planning tests.

## Evidence
- [x] Validate changed scripts or document why Unity MCP cannot target this clean worktree.
- [x] Run Unity EditMode/local tests and dotnet verification where applicable.
- [x] Capture or generate navigation screenshots/evidence under `tests/screenshots/`.
- [x] Document commands, logs, results, known limits, and evidence paths in `tests/test-protocol.md`.

## Closeout
- [x] Update README and physics docs for the navigation computer.
- [x] Run task completion preflight and toggle only verified tasks.
- [x] Commit the completed navigation change.

