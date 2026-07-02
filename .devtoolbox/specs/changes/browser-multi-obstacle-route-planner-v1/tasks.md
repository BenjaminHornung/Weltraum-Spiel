# Tasks: Browser Multi-Obstacle Route Planner v1

> Planning note: these tasks are for the future implementation branch after `browser-autopilot-long-range-testfield-v1` merges. This planning branch only creates analysis/spec artifacts.

## Phase 1: Add deterministic candidate and waypoint generation

- [ ] Objective: Generate ordered waypoint candidates deterministically for multi-obstacle route planning.
  - Files/search targets: `apps/weltraum-browser/src/navigation/multiObstaclePlanner.ts`, `apps/weltraum-browser/src/navigation/planners.ts`.
  - Acceptance criteria: same input yields the same candidate order and the same planHash; no random sampling.
  - Implementation guidance: reuse existing obstacle geometry and route-segment types; keep waypoint ordering fixed.
  - Required skills/MCPs: repo `AGENTS.md`, `subagent-driven-development`, `verification-before-completion`.
  - Verification: unit test for deterministic candidate ordering.
  - Report back: candidate generation rules, number of generated candidates, any bounded-limit decisions.
  - Stopping rule: stop if candidate determinism depends on non-local state.

## Phase 2: Add iterative multi-obstacle route construction

- [ ] Objective: Build a route that can chain around more than the first blocking obstacle.
  - Files/search targets: `apps/weltraum-browser/src/navigation/multiObstaclePlanner.ts`, `apps/weltraum-browser/src/navigation/planners.ts`.
  - Acceptance criteria: solvable multi-obstacle and corridor scenarios produce deterministic multi-segment routes; no silent replan.
  - Implementation guidance: bound waypoint depth and candidate count; prefer the first fully valid route.
  - Verification: unit tests for S-curve and corridor route construction.
  - Report back: route shape, segment count, reject cases encountered.
  - Stopping rule: stop if the route builder needs a grid search or nondeterministic sampling.

## Phase 3: Add route validation and reject reasons

- [ ] Objective: Validate every segment against every relevant obstacle and reject impossible routes.
  - Files/search targets: `apps/weltraum-browser/src/navigation/validation.ts`, `apps/weltraum-browser/src/navigation/planners.ts`, `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: intersecting or unsafe routes are rejected closed; terminal segment still obeys `StopWithinEnvelope`.
  - Implementation guidance: preserve existing target and terminal validation; add explicit reject reasons for budget and geometry failures.
  - Verification: unit test for unsafe candidate rejection and unsolvable corridor rejection.
  - Report back: reject reason list, validation coverage, any type changes.
  - Stopping rule: stop if validation changes require executor-side replanning.

## Phase 4: Add scoring and SpeedProfile compatibility

- [ ] Objective: Keep scoring deterministic while allowing Safe/Balanced/Fast to change only route intent metadata.
  - Files/search targets: `apps/weltraum-browser/src/navigation/planners.ts`, `apps/weltraum-browser/src/core/types.ts`, `apps/weltraum-browser/src/navigation/validation.ts`.
  - Acceptance criteria: score reasons include segment count, distance, clearance risk, planner complexity, and optional rejected-candidate metadata; terminal capture remains unchanged.
  - Implementation guidance: do not raise executor acceleration or weaken terminal-speed rules.
  - Verification: unit tests comparing Safe/Balanced/Fast on identical geometry.
  - Report back: scoring changes, profile compatibility notes, any unchanged contracts.
  - Stopping rule: stop if profile handling requires a physics or executor change.

## Phase 5: Add unit tests

- [ ] Objective: Cover deterministic routing, budget limits, safe rejection, and planHash stability.
  - Files/search targets: `apps/weltraum-browser/tests/unit/multiObstaclePlanner.test.ts`, `apps/weltraum-browser/tests/unit/planner.test.ts`.
  - Acceptance criteria: identical input yields identical route and hash; invalid geometry is rejected; bounded iteration stops loops.
  - Verification: targeted unit tests for solvable, stress, and unsolvable cases.
  - Report back: tests added, pass/fail summary, any missing edge cases.
  - Stopping rule: stop if tests require weakening existing planner invariants.

## Phase 6: Add E2E evidence for S-curve, corridor, and negative cases

- [ ] Objective: Record browser evidence for the new planner step.
  - Files/search targets: `apps/weltraum-browser/tests/e2e/multi-obstacle-planner.spec.ts`, `apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1.md`, `apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1-summary.json`.
  - Acceptance criteria: evidence shows deterministic solvable routes, visible failure for the negative case, and no silent replan.
  - Verification: E2E spec plus evidence JSON parse.
  - Report back: screenshots, scenario names, and any browser/runtime caveats.
  - Stopping rule: stop if E2E requires forbidden package/config changes.

## Phase 7: Update KnownStress classifications

- [ ] Objective: Reclassify the scenario catalog so current stress cases are explicit and the new planner target is clear.
  - Files/search targets: `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts`, `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`, `analysis/browser-multi-obstacle-route-planner-v1-scenario-requirements.json`.
  - Acceptance criteria: multi-obstacle stress cases are labeled intentionally; no hard invariant is hidden as a generic pass.
  - Verification: unit or scenario-matrix check for expected states.
  - Report back: scenario counts, updated labels, remaining KnownStress risks.
  - Stopping rule: stop if classification changes would weaken old tests or hide a real failure.
