# Proposal: Browser Multi-Obstacle Route Planner v1

## Motivation

The current Browser obstacle planner only detours the first blocking obstacle on the original ship-to-target line. That is enough for simple cases, but it hides the real failure mode in S-curves, narrow corridors, and denser obstacle fields: the generated route is not revalidated against later obstacles.

## Outcome

Add a deterministic multi-obstacle planner step that can reason beyond the first blocker, preserve stable `planHash`, and fail closed when no safe route exists.

## Scope

- Planner behavior for multi-obstacle local routes
- Deterministic candidate generation and route scoring
- Fail-closed validation and reject reasons
- SpeedProfile compatibility with terminal capture
- Tests and evidence for solvable, stress, and unsolvable cases

## Non-Goals

- No Browser UI redesign
- No executor rewrite
- No physics or ship-model changes
- No silent replans
- No snap/teleport shortcuts

## Planning Artifacts

- `docs/browser-mainline/implementation-analysis/browser-multi-obstacle-route-planner-v1-plan.md`
- `docs/browser-mainline/implementation-analysis/browser-multi-obstacle-route-planner-v1-scenario-requirements.json`
- `docs/browser-mainline/implementation-analysis/browser-multi-obstacle-route-planner-v1-implementation-map.md`
- `specs/browser-multi-obstacle-route-planner/spec.md`
- `design.md`
- `tasks.md`
