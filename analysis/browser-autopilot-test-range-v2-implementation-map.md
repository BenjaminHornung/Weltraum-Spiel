# Browser Autopilot Test Range v2 Implementation Map

This map is for a later implementation agent. This planning branch must not edit Browser source/tests/evidence JSON/PNG, package files, or `Assets/**`.

## Current main reality

Current `main` already contains a partial Browser-native v2 implementation:

- `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts` with 11 courses.
- `apps/weltraum-browser/src/test-harness/scenarioRunner.ts` with v2 runner/evaluator metrics.
- `apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts` with v2 catalog/profile tests.
- `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts` with selected E2E evidence generation.

The later implementation should extend/refactor this carefully instead of deleting it.

## Files a later implementation agent would likely change

| File | Purpose | Risk |
| --- | --- | --- |
| `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts` | Course definitions and scenario catalog. | High conflict risk with ongoing Autopilot lifecycle/Jitter work because course IDs and acceptance values may already be touched. |
| `apps/weltraum-browser/src/test-harness/autopilotCourseRunner.ts` | New focused runner for the v2 course matrix. | Prefer new file to reduce churn in `scenarioRunner.ts`. |
| `apps/weltraum-browser/src/test-harness/scenarioMetrics.ts` | New reusable metric helpers for final distance/speed, peak speed, clearance, fuel, and profile comparisons. | Low conflict if added as new module. |
| `apps/weltraum-browser/src/test-harness/scenarioRunner.ts` | Existing scenario runner bridge. | Conflict-prone; use only for backwards-compatible exports or transition glue. |
| `apps/weltraum-browser/src/core/types.ts` | Existing speed profile/course contracts. | Conflict-prone; avoid broad contract churn unless required by matrix fields. |
| `apps/weltraum-browser/src/navigation/planners.ts` | Desired speeds, brake margin, obstacle-route behavior. | High risk; do not broaden planner scope accidentally. |
| `apps/weltraum-browser/src/navigation/validation.ts` | Target/obstacle validation and scoring. | Medium risk; preserve fail-closed validation. |
| `apps/weltraum-browser/src/flight/executor.ts` | Terminal capture/no-snap/no-silent-replan invariants. | Very high risk; only touch if a focused terminal-capture bug is proven. |
| `apps/weltraum-browser/src/flight/flightController.ts` | Authority/control integration. | High conflict risk with lifecycle/jitter and UI/flight-control work. |
| TestBridge/runtime files under `apps/weltraum-browser/src/**` | Expose catalog/matrix to E2E behind `?testBridge=1`. | Conflict-prone with UI branches; keep product bootstrap hidden by default. |

## Better new files than enlarging existing files

Create small focused files where possible:

- `apps/weltraum-browser/src/test-harness/autopilotCourseRunner.ts`
- `apps/weltraum-browser/src/test-harness/scenarioMetrics.ts`
- `apps/weltraum-browser/tests/unit/autopilotProvingGroundCourses.test.ts`
- `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`

Keep `scenarioRunner.ts` as compatibility/export glue if existing tests depend on it.

## Unit tests should go here

- `apps/weltraum-browser/tests/unit/autopilotProvingGroundCourses.test.ts`
  - validates all 25 scenario IDs from `analysis/browser-autopilot-test-range-v2-scenario-matrix.json` are represented;
  - validates required fields: initial ship, target envelope, obstacles, profile, expected outcome, acceptance, evidence fields;
  - checks `KnownStress`/`ExpectedFail` courses still enforce hard invariants.
- `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`
  - asserts Safe/Balanced/Fast speed-profile values and boundaries;
  - asserts `Balanced` is faster than `Safe` on direct-long while terminal gates pass;
  - asserts `Fast` cannot weaken terminal capture/no-silent-replan.
- Existing `apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts`
  - should keep current 9 deterministic scenarios green;
  - may import/bridge new runner only if old assertions remain intact.

## E2E tests should go here

- `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`
  - run the full or representative v2 matrix through `TestBridge` under `?testBridge=1`;
  - assert default `/` bootstrap still hides `TestBridge`;
  - record summary JSON and screenshots for direct-long, corridor/stress, and speed-profile comparison.

## Evidence files should be generated here

- `apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md`
- `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-summary.json`
- Optional screenshots:
  - `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-direct-long.png`
  - `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-corridor.png`
  - `apps/weltraum-browser/evidence/autopilot-proving-ground-v2-speed-profile.png`

Evidence summary should include:

- scenario count and category counts;
- per-scenario `classification`, `status`, `ticksToArrival`, `peakSpeed`, `finalSpeed`, `finalDistance`, `minObstacleClearance`, `fuelUsed`, `arrivalPhase`, `replanRequired`, `failureReasonCodes`, `invalidationReasons`, `planHashBefore`, `planHashAfter`;
- Safe vs Balanced direct-long comparison;
- KnownStress notes for multi-obstacle/corridor planner limits;
- ExpectedFail reason-code checks.

## Existing tests that must not be weakened

- Existing 9-scenario deterministic matrix in `apps/weltraum-browser/tests/unit/provingGroundScenarios.test.ts`.
- Existing terminal-capture unit/E2E coverage around no snap, no velocity zero, terminal brake/capture/holding, and locked plan hash.
- Existing authority/fuel/brake reserve fail-closed tests (`insufficient-fuel`, `no-authority`, `no-main-thrusters`, `brake-reserve-insufficient`).
- Existing default bootstrap E2E assertion that `TestBridge` is hidden without `?testBridge=1`.
- Existing route validation tests for invalid/unsupported target, unsafe obstacle, terminal route end alignment, and structured rejection reasons.

## Conflict risks with parallel work

- Autopilot lifecycle/jitter branches may touch `executor.ts`, terminal capture, holding integration, and plan lifecycle telemetry.
- UI branches may touch TestBridge exposure, HUD runtime snapshots, and player/default bootstrap assertions.
- Current `main` already has v2 source/test files; after other branches merge, line-level conflicts are likely in catalog IDs, runner result shape, and E2E evidence names.
- Avoid changing `package.json`/`package-lock.json`; use existing Vitest/Playwright setup.
- Do not update `Assets/**`; Unity remains reference-only.
