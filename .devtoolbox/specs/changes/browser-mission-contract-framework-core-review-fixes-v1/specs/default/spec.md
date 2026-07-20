# Requirements

## Requirement: Mission proof belongs to a serial E2E group

`tests/e2e/mission-contract-framework-core.spec.ts` MUST be owned by `test:e2e:core` so the mainline workflow's unassigned-spec guard passes and the proof runs in a relevant serial group.

## Requirement: Earliest terminal trigger controls transition

When failure and expiry triggers are both due on an Accepted or Active mission, the core MUST require the transition whose trigger tick occurred first. Expiry MUST take precedence only when its trigger is earlier than or equal to the earliest due failure trigger.

### Scenario: Failure predates expiry

Given an Accepted or Active mission failure condition due before expiry, attempting expiry after both ticks are due MUST return `FAILURE_CONDITION_REACHED`, and `failMission` MUST remain valid.

### Scenario: Failure and expiry share a tick

Given both triggers share a tick, expiry MUST remain the required transition.

### Scenario: Offered mission has an earlier failure tick

Given an Offered mission with an absolute expiry and an earlier failure tick, the failure trigger MUST NOT require the unavailable `failMission` transition, and the offer MUST remain expirable at its absolute expiry.

## Requirement: Invalid numeric payloads reject deterministically

A command whose fingerprint cannot be canonicalized, including non-finite progress numbers, MUST return a typed `INVALID_COMMAND` rejection and MUST NOT throw or mutate state.

## Requirement: Non-terminal objective failure advances availability

When an objective with `failsMission: false` fails, the mission MUST remain non-terminal and sequential objective availability MUST be refreshed from the updated graph.

### Scenario: Failed optional prerequisite has a successor

Given a sequential successor that explicitly lists a non-terminally failed optional objective as a prerequisite, the failed predecessor MUST count as terminally processed and the successor MUST become Active.
