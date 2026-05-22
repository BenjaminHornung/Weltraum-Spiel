# Tasks

## Phase 1
- [x] Review `proposal.md`, `design.md`, and `specs/default/spec.md` for `trajectory-preview-nav-map-v1`.
- [x] Refine the task plan into concrete implementation, test, documentation, and validation checkpoints.
- [x] Add a bounded trajectory preview source/status layer that reuses existing predictor, gravity, burn-plan, and autopilot route data and fails safely on non-finite states.
- [x] Add deterministic toggle and UI exposure through existing player HUD/minimap route surfaces without full N-body, maneuver nodes, patched conics, or unbounded prediction.
- [x] Add deterministic tests for capped prediction, finite guards, disabled/unavailable status, route exposure, and reuse of existing trajectory infrastructure.
- [x] Update docs and keep DevToolbox test evidence under `tests/`.
- [x] Run DevToolbox validation, Unity script validation/tests where available, focused build/test verification, task completion preflights, and archive preflight.
