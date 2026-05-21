# Tasks

## Spec And Setup
- [x] Create v2 proposal/design/spec/tasks/test protocol and validate the change.
- [x] Create implementation execution records for detector/planner/autopilot/UI/tests/docs slices.

## Implementation
- [x] Upgrade obstacle detection with start-overlap checks, nearest blocking obstacle selection, trigger support, non-blocking filtering, and cached registry behavior.
- [x] Upgrade trajectory planning with scored candidates, burn/trajectory prediction, segment diagnostics, fuel/delta-v estimates, braking feasibility, and RCS authority margins.
- [x] Upgrade waypoint autopilot with persistent v2 phases, stable avoidance waypoint, reacquire/brake/final/hold transitions, honest fuel/RCS/no-authority statuses, and physical-only actuator requests.
- [x] Upgrade Navigation Computer HUD/debug console/minimap diagnostics with structured panel, candidate/segment sections, predicted route, avoidance waypoint, and status chips.

## Tests And Evidence
- [x] Add/extend EditMode tests for detector overlap/multiple/non-blocking/trigger cases, planner candidates/scores/burn estimates/authority, autopilot hold/avoidance/fuel/no-authority/Rigidbody guards, and headless GUI view-model evidence.
- [x] Add PlayMode tests for direct route, obstacle avoidance/reacquire/hold, lateral start velocity, heavy cargo, no-RCS precision failure, and manual override.
- [x] Run Unity MCP or batchmode EditMode and PlayMode tests, parse XML totals/failures, capture console status, collect screenshots/evidence, and iterate until green or explicitly blocked.

## Documentation And Closeout
- [x] Update README and physics/performance docs with v2 phases, planner, burn segments, overlap detection, verification, and known limits.
- [x] Complete `tests/test-protocol.md`, run `specs_validate`, toggle verified tasks only after evidence, and commit the finished branch.
