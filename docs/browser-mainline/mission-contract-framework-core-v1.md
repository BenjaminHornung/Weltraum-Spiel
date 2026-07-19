# Browser Mission Contract Framework Core V1

Status: implemented as a pure browser-domain contract core.

## Authority boundary

`apps/weltraum-browser/src/missions` owns validated mission definitions, immutable mission instances, deterministic objective-graph state, CAS command handling, typed progress, mission lifecycle transitions, reward/penalty descriptors, and persistent mission event intents.

The module reuses the public persistence boundary for stable mission/player/event/source/target IDs, `UniverseTime`, `MissionTime`, canonical signatures, JSON validation, deep freezing, and `DomainEvent` validation. It does not create a second clock, ID generator, event queue, or save authority. Returned event intents are not enqueued by this core.

## Public contract

The public module is `/src/missions/index.ts` and exports:

- strict definition validation and deterministic objective ordering;
- the states `Offered`, `Accepted`, `Active`, `Completed`, `Failed`, `Abandoned`, `Expired`, and `RewardClaimed`;
- objective states `Locked`, `Available`, `Active`, `Completed`, `Failed`, and `Skipped`;
- Sequential, ParallelAll, ParallelAny, prerequisite, hidden, and Optional semantics;
- typed descriptors for ReachTarget, SurveyTarget, InteractWithTarget, ExtractResource, DeliverResource, RepairTarget, RecoverItem, ProtectTarget, and WaitUntilTick;
- the full create/accept/activate/progress/complete/fail/skip/abandon/expire/reward-claim command set;
- six complete mission fixtures plus one intentionally invalid cyclic definition.

Every mutating instance command requires `expectedRevision` and a stable `commandId`. The immediate identical replay of an accepted command returns the byte-identical result. Reusing that identity with different command data is rejected as `CONFLICTING_REPLAY`; other stale revisions are rejected as `REVISION_CONFLICT`.

## Progress and outcomes

Objective progress is a discriminated union for count, measured amount, resource quantity, target, item, explicit tick, and machine facts. Resource, target, and item identities are checked against the objective descriptor. Numeric accumulation clamps to the requirement, so remaining progress never becomes negative.

Rewards and penalties remain immutable descriptors/intents for resources (including currency-like resources), items, reputation deltas, licenses/unlocks, and mission-chain unlocks. The mission core performs no resource transfer and mutates no economy, cargo, reputation, faction, license, or world authority.

## Verification evidence

Focused unit coverage is under `apps/weltraum-browser/tests/unit/missionContractCore.test.ts`.

The focused Playwright proof uses port 5233 and the normal `/` route. It confirms `window.TestBridge` is absent, dynamically imports only `/src/missions/index.ts`, loads all six fixtures, completes the geological survey and ore extraction/delivery missions, expires a mission, claims reward intents, executes the complete scenario twice byte-identically, and records browser health 0/0/0/0 without screenshots.

Evidence:

- `apps/weltraum-browser/evidence/browser-mission-contract-framework-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-mission-contract-framework-core-v1.md`

## Explicit non-goals

This slice adds no mission UI, player-facing mission text authority, runtime economy/cargo/reputation mutation, faction runtime, world-object authority, navigation or interaction execution, persistence queue writes, prototype wiring, package/config changes, or Unity changes.
