# Spec Draft: autopilot-v2-core-planner-executor-v1

## Proposal

Build Autopilot V2 as a deterministic planner/executor core that plans a route
first, locks it, and executes without silent replanning.

## Scope

- TargetDescriptor
- ArrivalEnvelope
- RoutePlan/RouteSegment
- RouteCandidate scoring
- DirectLocal and simple ObstacleAvoidanceLocal
- Fuel/Authority checks
- Executor with PlanInvalidated instead of silent replan
- Pure EditMode tests

## Non-goals

- Gravity-assist production planner
- Surface landing
- Docking lock
- Full timewarp integration
- Replacing legacy runtime in first pass

## Acceptance

- Same input -> same PlanHash.
- Direct/obstacle/fuel/no-authority/invalid target tests pass.
- Executor never silently replans.
