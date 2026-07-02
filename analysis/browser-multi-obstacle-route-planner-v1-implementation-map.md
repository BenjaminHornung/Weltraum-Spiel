# Browser Multi-Obstacle Route Planner v1 Implementation Map

Branch: `analysis/browser-multi-obstacle-route-planner-v1-plan`
Change: `browser-multi-obstacle-route-planner-v1`

## Purpose

Map the future implementation branch for a deterministic multi-obstacle planner. This planning branch only records the intended change surface; it does not modify Browser source.

## Preferred New Files

- `apps/weltraum-browser/src/navigation/multiObstaclePlanner.ts`
- `apps/weltraum-browser/src/navigation/routeCandidateGraph.ts` (optional helper/fallback)
- `apps/weltraum-browser/tests/unit/multiObstaclePlanner.test.ts`
- `apps/weltraum-browser/tests/e2e/multi-obstacle-planner.spec.ts`

## Minimal Existing Files To Touch

- `apps/weltraum-browser/src/navigation/planners.ts`
- `apps/weltraum-browser/src/navigation/validation.ts`
- `apps/weltraum-browser/src/core/types.ts`
- `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`

## Change Shape

1. Add deterministic candidate and waypoint generation in the navigation layer.
2. Route `ObstacleAvoidanceLocalPlanner` through a multi-obstacle planner helper once the current direct-path validation fails.
3. Validate every accepted segment against every relevant obstacle before building the final `RoutePlan`.
4. Keep `planHash` deterministic and stable for identical inputs.
5. Preserve terminal capture safety and the executor no-silent-replan contract.

## Conflict Risks With `browser-autopilot-long-range-testfield-v1`

- That branch may change course IDs, long-route geometry, acceptance thresholds, evidence filenames, and route validation assertions.
- The new planner must be revalidated against the merged long-range course catalog before final thresholds are locked.
- `scenarioRunner.ts` and `autopilotProvingGroundCourses.ts` are likely to move first in the long-range branch; do not assume this plan’s scenario notes remain correct after merge.
- If the long-range branch introduces new score or validation metadata, reuse it instead of duplicating route-scoring logic here.

## Future Evidence Files

- `apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1.md`
- `apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1/*.png` screenshots only if the implementation branch adds browser-visible evidence

## Notes For The Implementer

- Keep this planner deterministic: fixed obstacle ordering, fixed waypoint ordering, fixed rejection ordering.
- Reject instead of looping when waypoint or candidate budgets are exceeded.
- Do not weaken terminal capture, lock-step plan behavior, or the executor ownership boundary.
