# Mission Contract Framework Core V1 Specification

## Mission definitions

The core MUST validate versioned mission definitions containing stable definition ID, schema/version, mission kind, issuer ID, content key, eligibility requirements, objective graph, failure conditions, expiry policy, reward descriptors, penalty descriptors, legality tags, and definitions version. Unknown fields MUST be rejected.

## Mission instances

The core MUST create immutable, revisioned mission instances containing a stable mission ID, definition reference, owner ID, issuer ID, explicit state, accepted UniverseTime, optional activated MissionTime, objective states, expiry, machine facts, reward claim state, failure or abandon reason, replay records, and a canonical signature.

## State transitions

The states MUST include Offered, Accepted, Active, Completed, Failed, Abandoned, Expired, and RewardClaimed. Only documented command transitions are allowed. Terminal states MUST reject later progress or invalid transitions.

## Objective graph

The core MUST support Sequential, ParallelAll, ParallelAny, and Optional semantics, hidden-until-prerequisite behavior, explicit prerequisite IDs, deterministic topological validation, cycle rejection, and stable objective IDs. Objective states MUST include Locked, Available, Active, Completed, Failed, and Skipped.

## Objective descriptors

V1 MUST provide strict descriptors for ReachTarget, SurveyTarget, InteractWithTarget, ExtractResource, DeliverResource, RepairTarget, RecoverItem, ProtectTarget, and WaitUntilTick. Descriptors describe requirements only and MUST NOT execute external operations.

## Commands

The public API MUST include createMissionOffer, acceptMission, activateMission, applyObjectiveProgress, completeObjective, failObjective, skipOptionalObjective, completeMission, failMission, abandonMission, expireMission, and claimMissionReward. Mutating commands MUST use expectedRevision CAS, preserve inputs, return immutable results, use typed rejections, accept identical replay idempotently, and reject conflicting replay.

## Progress

Progress MUST be a discriminated union covering count, measured amount, resource quantity, target, item, explicit tick, and machine facts. Mismatched identities MUST be rejected. Over-completion MUST clamp remaining work at zero.

## Rewards and penalties

The core MUST expose descriptors/intents for resources (including currency-like resource IDs), item definitions, reputation deltas, license/unlock intents, and mission-chain unlock intents. It MUST NOT mutate external authorities.

## Events

Successful commands MUST return persistable mission event intents using public persistence contracts. The mission core MUST NOT write to a global queue.

## Fixtures

The module MUST export complete fixtures for Hestia Geological Survey, Ore Extraction and Delivery, damaged surface relay repair, black-box recovery, hazard-zone atmospheric sampling, and cargo courier to an outpost. The fixtures collectively MUST include ParallelAll, ParallelAny, optional objectives, expiry, and a fail-closed cyclic invalid definition.

## Verification

Unit coverage MUST exercise validation, graph ordering/cycles, all group semantics, optional skip, eligibility, expiry, typed progress and mismatches, CAS/replay, terminal transitions, event intents, signature equality, immutability, unknown fields, and forbidden ambient dependencies. Browser evidence MUST use port 5233, normal `/`, no TestBridge, one dynamic import of `/src/missions/index.ts`, the required fixture/scenario runs, twice-byte-identical output, health 0/0/0/0, and no screenshots.
