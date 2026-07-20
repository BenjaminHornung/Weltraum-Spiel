# Design

## Terminal transition precedence

At command time, collect due `UniverseTickReached` failures and the due expiry. For Accepted and Active missions, the required terminal transition is determined by the earliest trigger tick. Expiry wins when its tick is earlier than or equal to the earliest due failure tick; otherwise failure wins. This preserves the documented same-tick expiry precedence without allowing an older failure to be bypassed.

Offered missions do not participate in failure-transition precedence because `failMission` is intentionally unavailable before acceptance. Their absolute expiry remains authoritative, preventing an offer from becoming stuck when a failure tick predates its expiry.

## Fail-closed command fingerprinting

Persistence fingerprints remain computed before state mutation and replay checks. Any canonicalization failure, including non-finite numeric payloads, is converted to a typed `INVALID_COMMAND` rejection at `/command`; no exception escapes and no state changes.

## Sequential objective availability

A failed objective that does not fail the mission is terminal for that objective but not for the graph. Availability is recalculated from the updated objective states so the next sequential objective can become active. Explicit prerequisite edges treat `Failed` as a terminally processed predecessor, alongside `Completed` and `Skipped`; otherwise a non-terminal optional failure could leave the mission Active with no activatable successor.

## CI group ownership

The existing focused mission Playwright spec is added to `test:e2e:core`. No new dependency or Playwright configuration is introduced.
