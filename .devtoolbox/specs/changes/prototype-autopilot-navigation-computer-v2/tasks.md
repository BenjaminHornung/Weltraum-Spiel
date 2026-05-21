# Tasks

## Spec And Setup
- [ ] Create v2 proposal/design/spec/tasks/test protocol and validate the change.
- [ ] Create implementation execution records for detector/planner/autopilot/UI/tests/docs slices.

## Implementation
- [ ] Upgrade obstacle detection with start-overlap checks, nearest blocking obstacle selection, trigger support, non-blocking filtering, and cached registry behavior.
- [ ] Upgrade trajectory planning with scored candidates, burn/trajectory prediction, segment diagnostics, fuel/delta-v estimates, braking feasibility, and RCS authority margins.
- [ ] Upgrade waypoint autopilot with persistent v2 phases, stable avoidance waypoint, reacquire/brake/final/hold transitions, honest fuel/RCS/no-authority statuses, and physical-only actuator requests.
- [ ] Upgrade Navigation Computer HUD/debug console/minimap diagnostics with structured panel, candidate/segment sections, predicted route, avoidance waypoint, and status chips.

## Tests And Evidence
- [ ] Add/extend EditMode tests for detector overlap/multiple/non-blocking/trigger cases, planner candidates/scores/burn estimates/authority, autopilot hold/avoidance/fuel/no-authority/Rigidbody guards, and headless GUI view-model evidence.
- [ ] Add PlayMode tests for direct route, obstacle avoidance/reacquire/hold, lateral start velocity, heavy cargo, no-RCS precision failure, and manual override.
- [ ] Run Unity MCP or batchmode EditMode and PlayMode tests, parse XML totals/failures, capture console status, collect screenshots/evidence, and iterate until green or explicitly blocked.

## Documentation And Closeout
- [ ] Update README and physics/performance docs with v2 phases, planner, burn segments, overlap detection, verification, and known limits.
- [ ] Complete `tests/test-protocol.md`, run `specs_validate`, toggle verified tasks only after evidence, and commit the finished branch.
