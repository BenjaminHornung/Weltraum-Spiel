# Browser Multi-Obstacle Route Planner v1 Plan

Branch: `analysis/browser-multi-obstacle-route-planner-v1-plan`
Change: `browser-multi-obstacle-route-planner-v1`
Scope: analysis/spec only; no Browser source, Browser tests, Browser evidence PNG/JSON, package files, or Unity assets were changed.

## Goal

Define the next Browser planner step after `browser-autopilot-long-range-testfield-v1`: a deterministic multi-obstacle route planner that reasons about more than the first blocking obstacle while preserving stable `planHash`, no silent replan, no snap, terminal capture safety, fail-closed route validation, and same-input/same-plan determinism.

## Current Planner Audit

Current navigation entry points:

- `apps/weltraum-browser/src/navigation/planners.ts`
- `apps/weltraum-browser/src/navigation/validation.ts`
- `apps/weltraum-browser/src/core/types.ts`
- `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts`
- `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`

What the current code does:

- `DirectLocalPlanner` validates context, builds `directSegmentsFor(context)`, validates the terminal segment endpoint, and hashes the resulting `RoutePlan`.
- `ObstacleAvoidanceLocalPlanner` calls `selectFirstBlockingObstacle(context)`, which uses `.find(...)` over obstacles intersecting the original ship-to-target line.
- If no obstacle blocks that original line, it delegates to direct segments.
- If one blocker is found, it computes one lateral `avoidanceWaypoint` and returns exactly two segments: `Avoidance` to the waypoint and `Terminal` to the target.
- It does not re-check the generated segments against all obstacles, so later segments can still cross additional obstacles or corridor geometry.
- `validateRouteSegments` currently validates target/arrival contracts and terminal alignment, but it does not validate every segment against every obstacle.
- `scoreRouteCandidate` reasons currently include segment count, distance, and clearance risk, but not richer multi-obstacle topology or rejected-candidate context.

## Current Stress / KnownStress Cases

Current Browser proofing already exposes the limits:

- `s-curve-obstacles`: multi-obstacle stress; the current local planner only detours the first blocking obstacle.
- `narrow-corridor`: current one-blocker detour is too weak for the corridor geometry.
- `offset-gates`: currently passes with forgiving geometry, but becomes a multi-obstacle stress case once the longer routes and tighter gate spacing are exercised.
- `target-near-obstacle`: current geometry is forgiving today, but the v1 planner must still fail closed when the terminal envelope is not safely separable from obstacle padding.

Current invariants to preserve:

- The executor consumes one locked route plan and does not call a planner during execution.
- Plan hashes must remain stable during execution, including `KnownStress` and `ExpectedFail` courses.
- `replanRequired=true` is a visible signal, not permission to silently replace a route.
- `StopWithinEnvelope` arrival requires both distance and terminal speed gates.
- Normal runtime must not snap the ship to the target, zero velocity, or clamp terminal velocity as a shortcut.
- Speed profiles may change route desired speeds and non-terminal brake-margin metadata, but must not raise executor acceleration or weaken terminal capture.

## Strategy Comparison

| Strategy | Strengths | Weaknesses | Fit |
| --- | --- | --- | --- |
| Iterative Detour Planner | Deterministic, small, fits existing segment model, easy to keep `planHash` stable, can revalidate after each waypoint. | Needs bounded iteration rules and explicit reject reasons. | **Recommended** |
| Visibility Graph / Gate Planner | Strong for corridor and gate geometry, deterministic if node ordering is fixed, can find cleaner paths than a simple detour chain. | More bookkeeping, more candidate edges, more risk of overfitting topology into planner internals. | Good fallback if iterative detours cannot solve a narrow corridor. |
| Grid / A* Local Planner | Broadly capable, conceptually simple on paper. | Too noisy for deterministic route hashes, can introduce discretization artifacts, heavy candidate explosion. | Poor fit. |
| RRT / RRT* | Good at awkward spaces in research settings. | Nondeterministic unless heavily constrained, hard to keep stable `planHash`, poor fit for fail-closed browser evidence. | Not a fit. |

## Recommendation

Use a deterministic Iterative Detour Planner for v1, with a tiny deterministic visibility-graph fallback only if the first pass cannot bridge a narrow corridor safely.

Why this is the right v1 step:

- It preserves the current direct/avoidance/terminal segment model.
- It can re-check every newly added segment against all obstacles before accepting the candidate.
- It keeps the candidate set small enough to hash stably and score reproducibly.
- It can fail closed with an explicit reject reason when the obstacle field is unsolvable.
- It avoids the randomness and discretization noise that would make `planHash` brittle.

## Conflict Risks With `browser-autopilot-long-range-testfield-v1`

- That branch may change course catalogs, route lengths, evidence names, and acceptance thresholds.
- This branch should not hard-code long-route numbers that depend on the parallel branch’s final geometry.
- Future implementation must rebase after `browser-autopilot-long-range-testfield-v1` merges and re-read the current scenario catalog, evidence shape, and route validation helpers.
- Shared files likely to collide are `planners.ts`, `validation.ts`, `types.ts`, `scenarioRunner.ts`, proving-ground course definitions, and any evidence summary filenames.

## Future Implementation Prompt

Use this prompt only after `browser-autopilot-long-range-testfield-v1` has merged and the implementation branch is rebased on the resulting `main`.

```text
Task: browser-multi-obstacle-route-planner-v1

Repo: BenjaminHornung/Weltraum-Spiel. Start from latest main after browser-autopilot-long-range-testfield-v1 merges. Create a dedicated implementation branch/worktree before editing.

plan_status: approved. explicit_replan: false.

Objective:
Implement a deterministic Browser multi-obstacle route planner that can reason about more than the first blocking obstacle while preserving stable planHash, no silent replan, no snap, fail-closed validation, terminal capture safety, and same-input/same-plan determinism.

Success criteria:
1. Multi-obstacle and corridor scenarios produce deterministic routes when solvable, with the same input yielding the same planHash.
2. The planner considers more than one blocking obstacle and revalidates generated segments against all relevant obstacles.
3. Bounded waypoint/iteration limits prevent loops; unsolved cases return explicit reject reasons instead of silent replans.
4. SpeedProfile only changes desired route speeds and non-terminal brake-margin metadata; terminal capture safety remains unchanged.
5. Terminal segments remain StopWithinEnvelope-safe and route validation stays fail-closed.

Likely files to change or create:
- apps/weltraum-browser/src/navigation/multiObstaclePlanner.ts
- apps/weltraum-browser/src/navigation/routeCandidateGraph.ts (optional fallback/helper)
- apps/weltraum-browser/src/navigation/planners.ts
- apps/weltraum-browser/src/navigation/validation.ts
- apps/weltraum-browser/src/core/types.ts only if route/candidate contracts need extension
- apps/weltraum-browser/src/test-harness/scenarioRunner.ts only if telemetry needs a new rejection/detail field
- apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts only if scenario labels/notes need to expose the new planner behavior
- apps/weltraum-browser/tests/unit/multiObstaclePlanner.test.ts
- apps/weltraum-browser/tests/e2e/multi-obstacle-planner.spec.ts
- apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1.md
- apps/weltraum-browser/evidence/browser-multi-obstacle-route-planner-v1-summary.json

Known context and constraints:
- DirectLocalPlanner and ObstacleAvoidanceLocalPlanner already exist; do not break their no-silent-replan or terminal-capture guarantees.
- The current obstacle planner only detours the first blocker and does not re-check all obstacles.
- Long-range scenario work may adjust route geometry and acceptance numbers; rebase before finalizing thresholds.
- Keep player UI and debug/TestBridge contracts separate.

Forbidden actions:
- Do not silently replace a locked plan during execution.
- Do not snap position to target, zero velocity, or clamp terminal velocity as a shortcut.
- Do not weaken old unit/E2E acceptance or remove existing scenarios to make the new suite pass.
- Do not run destructive Git, publish, deployment, service install, database migration, or data-generator commands.

Required skills/project instructions:
- Read repo AGENTS.md and the current analysis/spec package.
- Use subagent-driven-development, verification-before-completion, and systematic-debugging if failures occur.
- For Browser UI/E2E work, use browser-debugger/test-runner lanes rather than ad hoc foreground servers.

Implementation steps:
1. Re-read the analysis/spec package and current source after rebase.
2. Add deterministic candidate and waypoint generation with explicit bounded iteration.
3. Add iterative multi-obstacle route construction and all-obstacle segment validation.
4. Extend scoring/rejection metadata for segment count, distance, clearance risk, planner complexity, and rejected candidates.
5. Add unit tests, E2E evidence, and scenario classification updates for solvable, stress, and unsolvable cases.
6. Verify planHash stability, locked-plan immutability, and terminal capture safety before toggling tasks complete.
```
