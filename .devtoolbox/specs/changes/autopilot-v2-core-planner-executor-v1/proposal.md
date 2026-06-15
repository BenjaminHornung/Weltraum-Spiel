# Proposal: Autopilot V2 Core Planner Executor v1

## Problem

Existing autopilot work has proven important arrival and stability behavior, but
future route planning needs a cleaner Planner/Plan/Executor split. Silent
replanning, unclear target semantics or mixed diagnostics would make landing,
pickup, docking and obstacle handling hard to reason about.

## Outcome

This change plans an Autopilot V2 core where the planner creates deterministic
route plans, the executor follows a locked plan, and invalidation is explicit
instead of silently replanning.

## Scope

In scope for future implementation:

- `TargetDescriptor`
- `ArrivalEnvelope`
- `RoutePlan` and `RouteSegment`
- `RouteCandidate` scoring
- direct local route planning
- simple local obstacle avoidance planning
- fuel and authority checks
- executor invalidation behavior
- pure EditMode tests

Out of scope for this setup task:

- Runtime implementation
- Autopilot replacement
- Scene, prefab or harness changes
- Gravity-assist production planner
- Surface landing, docking lock and full timewarp integration

## Success Criteria

- The DevToolbox change scaffold exists and is discoverable.
- The spec states deterministic planner/executor requirements.
- Runtime implementation tasks remain open.
- No existing autopilot runtime or test files are changed by this setup slice.
