# Tasks: Browser Autopilot Test Range v2

> Planning note: these tasks are for the future implementation branch after the parallel Autopilot lifecycle/jitter and UI branches merge. This planning branch only creates analysis/spec artifacts.

## Phase 1: Reconcile current catalog with the 25-scenario matrix

- [ ] Objective: Normalize the current Browser v2 course catalog to the IDs and categories in `analysis/browser-autopilot-test-range-v2-scenario-matrix.json`.
  - Files/search targets: `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts`, `apps/weltraum-browser/src/core/types.ts`, `analysis/browser-autopilot-test-range-v2-scenario-matrix.json`.
  - Acceptance criteria: all 25 scenario IDs exist; every course has initial ship, target envelope, obstacles, profile, expected outcome, acceptance, and evidence metadata or equivalent runtime mapping.
  - Implementation guidance: preserve the existing 11-course seed where useful; add missing Basic, Authority/Fuel, Disturbance, and SpeedProfile entries; do not delete old harness scenarios.
  - Required skills/MCPs: repo `AGENTS.md`, `subagent-driven-development`, `verification-before-completion`.
  - Verification: focused unit test for course IDs/schema.
  - Report back: changed files, scenario counts by category, any matrix deviations.
  - Stopping rule: stop if current source after merge already diverges from the planning matrix enough to require replanning.

## Phase 2: Extract/extend v2 runner and metrics

- [ ] Objective: Provide reusable course execution and metrics for final distance/speed, peak speed, obstacle clearance, fuel, profile comparison, terminal telemetry, and classification.
  - Files/search targets: `apps/weltraum-browser/src/test-harness/autopilotCourseRunner.ts`, `apps/weltraum-browser/src/test-harness/scenarioMetrics.ts`, existing `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`.
  - Acceptance criteria: runner reports all required scenario JSON fields; old `runScenarioMatrix()` remains compatible; `KnownStress` and `ExpectedFail` enforce hard invariants.
  - Implementation guidance: prefer new files over expanding `scenarioRunner.ts`; keep old exports stable if tests import them.
  - Verification: unit tests for metric helpers and classification behavior.
  - Report back: new/changed files, result-shape changes, compatibility notes.
  - Stopping rule: stop if metrics require executor behavior changes beyond telemetry reads.

## Phase 3: Implement Safe/Balanced/Fast profile assertions

- [ ] Objective: Add profile tests proving Balanced is faster than Safe without terminal-capture regression and Fast remains bounded/KnownStress where appropriate.
  - Files/search targets: `apps/weltraum-browser/src/core/types.ts`, `apps/weltraum-browser/src/navigation/planners.ts`, `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`.
  - Acceptance criteria: profile values only influence desired route speed and non-terminal brake margin; no global `maxAcceleration` increase; terminal speed/final distance gates still pass for Safe and Balanced.
  - Implementation guidance: do not weaken executor terminal capture; do not accept overspeed arrival.
  - Verification: `npm run test -- tests/unit/autopilotSpeedProfiles.test.ts` plus existing proving-ground tests.
  - Report back: Safe/Balanced tick and peak-speed comparison, Fast classification notes.
  - Stopping rule: stop if profile goals require changing terminal-capture hard invariants.

## Phase 4: Add unit test coverage for the full matrix

- [ ] Objective: Cover all course categories and old harness compatibility in unit tests.
  - Files/search targets: `apps/weltraum-browser/tests/unit/autopilotProvingGroundCourses.test.ts`, `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`, `apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts`.
  - Acceptance criteria: all old 9 deterministic scenarios still pass; all 25 v2 courses classify as Pass/KnownStress/ExpectedFail as expected; accidental ExpectedFail success is caught; KnownStress hard-invariant violations are caught.
  - Verification: `npm run test -- tests/unit/provingGroundScenarios.test.ts tests/unit/autopilotProvingGroundCourses.test.ts tests/unit/autopilotSpeedProfiles.test.ts`.
  - Report back: tests added, tests run, pass/fail summary.
  - Stopping rule: stop if old tests need weakening to pass.

## Phase 5: Add E2E evidence and generated summaries

- [ ] Objective: Run the v2 catalog through Browser TestBridge and record Markdown/JSON/screenshot evidence.
  - Files/search targets: `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`, `apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md`, `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-summary.json`.
  - Acceptance criteria: TestBridge is only available under `?testBridge=1`; default product route hides TestBridge; evidence JSON parses; screenshots cover direct-long, corridor/stress, and speed-profile comparison.
  - Verification: `npm run test:e2e -- tests/e2e/autopilot-proving-ground-v2.spec.ts`; JSON parse evidence summary.
  - Report back: evidence files, screenshots, browser/runtime caveats.
  - Stopping rule: stop if E2E requires package/config changes or conflicts with UI branch bootstrap behavior.

## Phase 6: Final verification and review

- [ ] Objective: Verify the implementation is complete and safe to merge.
  - Verification commands: unit tests above, `npm run build`, E2E above, JSON parse generated evidence.
  - Review focus: correctness, no weakened old tests, no silent replans, no terminal-capture shortcuts, no source-of-truth drift between UI/TestBridge/executor telemetry.
  - Report back: changed files, scenario count/categories, classification counts, speed-profile evidence, KnownStress risks, unverified items.
  - Stopping rule: do not mark done if required verification was skipped without explicit accepted risk.
