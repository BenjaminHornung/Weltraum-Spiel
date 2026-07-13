# Design: Autopilot V2 Core Planner Executor v1

## Source Draft

Ausgangspunkt ist `weltraum_refactor_strategy_package/spec_drafts/autopilot-v2-core-planner-executor-v1.md`.

## Planned Shape

Autopilot V2 should be split into:

- planner input contracts (`TargetDescriptor`, `ArrivalEnvelope`)
- deterministic plan output (`RoutePlan`, `RouteSegment`, plan hash)
- candidate evaluation and rejection diagnostics
- executor state that follows a locked plan
- explicit `PlanInvalidated` behavior when assumptions break

## Key Decision

The executor must not silently replan. Replanning is a planner-level decision and
needs a visible diagnostic boundary so player UI, tests and future AI agents can
understand what happened.

## This Setup Slice

Only planning artifacts are created here. The existing prototype autopilot,
arrival tests, proving-ground harness and `Assets/Scripts/Prototype` are left
untouched.
