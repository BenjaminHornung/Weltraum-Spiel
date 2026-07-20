# Requirements

## Requirement: Mission proof belongs to a serial E2E group

`tests/e2e/mission-contract-framework-core.spec.ts` MUST be owned by `test:e2e:core` so the mainline workflow's unassigned-spec guard passes and the proof runs in a relevant serial group.

## Requirement: Earliest terminal trigger controls transition

When failure and expiry triggers are both due, the core MUST require the transition whose trigger tick occurred first. Expiry MUST take precedence only when its trigger is earlier than or equal to the earliest due failure trigger.

### Scenario: Failure predates expiry

Given a mission failure condition due before expiry, attempting expiry after both ticks are due MUST return `FAILURE_CONDITION_REACHED`, and `failMission` MUST remain valid.

### Scenario: Failure and expiry share a tick

Given both triggers share a tick, expiry MUST remain the required transition.

## Requirement: Invalid numeric payloads reject deterministically

A command whose fingerprint cannot be canonicalized, including non-finite progress numbers, MUST return a typed `INVALID_COMMAND` rejection and MUST NOT throw or mutate state.

## Requirement: Non-terminal objective failure advances availability

When an objective with `failsMission: false` fails, the mission MUST remain non-terminal and sequential objective availability MUST be refreshed from the updated graph.
