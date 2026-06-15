# Capability: Autopilot V2 Core Planner Executor

## Summary

Autopilot V2 shall provide deterministic local route planning and locked-plan
execution with explicit invalidation instead of silent replanning.

This spec is planning-only for the current setup task and does not modify the
legacy autopilot runtime.

## ADDED Requirements

### Requirement: Deterministic planning

The planner shall return the same plan identity for the same input state,
constraints and environment snapshot.

#### Scenario: Same input is planned twice

- GIVEN identical target, arrival envelope, ship authority, fuel state and
  obstacle snapshot
- WHEN the planner runs twice
- THEN the resulting route plan identity or plan hash is the same.

### Requirement: Explicit target descriptor

Planner input shall include an explicit target descriptor and arrival envelope.

#### Scenario: Target is invalid

- GIVEN a target descriptor is missing required frame, point or arrival data
- WHEN planning is requested
- THEN the planner rejects the target with diagnostics
- AND does not create an ambiguous fallback route.

### Requirement: Candidate diagnostics

Route candidate selection shall preserve diagnostics for accepted and rejected
candidates.

#### Scenario: Candidate lacks authority

- GIVEN a candidate route requires unavailable thrust or RCS authority
- WHEN candidate scoring runs
- THEN the candidate is rejected with an authority diagnostic
- AND another candidate may only be selected if it satisfies constraints.

### Requirement: Executor follows a locked plan

The executor shall follow a selected plan and shall not silently replace it with
a newly planned route.

#### Scenario: Plan assumptions break

- GIVEN the executor is following a route plan
- WHEN the route becomes invalid because target, obstacle, authority or fuel
  assumptions changed
- THEN the executor reports `PlanInvalidated`
- AND does not silently replan.

### Requirement: Pure tests precede runtime replacement

Planner and executor core behavior shall be covered by focused tests before any
legacy runtime replacement is attempted.

#### Scenario: Implementation begins later

- GIVEN a later task implements Autopilot V2 core behavior
- WHEN verification runs
- THEN deterministic planning, rejection diagnostics and no-silent-replan tests
  pass before integration work claims completion.
