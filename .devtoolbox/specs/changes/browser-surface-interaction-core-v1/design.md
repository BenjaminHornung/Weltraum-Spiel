# Design

## Module boundary
All implementation lives under `apps/weltraum-browser/src/interaction/**` and is exported from that module boundary. The core is pure TypeScript and imports no Three.js, DOM, UI, renderer, world mutation, Cargo, Persistence, Combat, Ship Builder, Surface Lab, voxel, or worker authority. World/physics adapters supply already evaluated distance, line-of-sight, reachability, and focus rank; positions and raycasts never enter the contract.

## Contracts and closed vocabularies
Use branded stable string identities for `InteractionActorId`, `InteractionTargetId`, `InteractionCapabilityId`, and `InteractionToolId`, plus an integer `InteractionRevision`. `InteractionVerb` is a closed union containing exactly the eleven specified verbs. The public data model includes `InteractionTargetSnapshot`, `InteractionActorContext`, `InteractionCandidate`, `InteractionDecision`, `InteractionBlockReason`, `InteractionSession`, `InteractionProgress`, `InteractionCompletionRequest`, `InteractionResult`, and `InteractionEvent`.

Snapshots carry only stable target identity/revision, owner/claim, legal state, hazard summary, supported verbs, and required capabilities. Actor context carries explicit revisions, capabilities, tools, finite canonical energy/resources, permissions/override state, incapacity/mode state, and hazard tolerance needed for admission. Unknown verbs, capabilities, malformed values, and missing authority fail closed rather than being ignored.

## Evaluation and ordering
`evaluateInteraction(candidate, context)` returns exactly `Allowed`, `Blocked`, or `Unavailable`. Validation is a pure ordered pipeline:

1. target identity and revision availability;
2. actor identity, revision, and capacity to act;
3. range, line of sight, and reachability;
4. required capabilities and tools;
5. energy and resource sufficiency;
6. hazard, permission, and legality;
7. verb-specific availability and rules.

The closed block-reason order follows that pipeline: `OutOfRange`, `NoLineOfSight`, `NotReachable`, `MissingCapability`, `MissingTool`, `InsufficientEnergy`, `InsufficientResource`, `HazardTooHigh`, `PermissionDenied`, `IllegalWithoutOverride`, `TargetBusy`, `TargetStale`, `ActorIncapacitated`, and `ModeConflict`. Candidate selection uses deterministic decision ordering and stable `InteractionTargetId` as the final tie-break after focus rank and other explicit evaluation fields. The target/revision and actor checks remain higher precedence than spatial, equipment, cost, risk, permission/legal, and verb-specific checks.

## Sessions and ticks
Time is represented only by integer `InteractionTick`. An allowed decision carries `requiredHoldTicks`, `interruptPolicy`, `movementToleranceClass`, `damageInterrupts`, and `focusLossInterrupts`. Pure `start`, `advance`, `cancel`, and `complete` functions create frozen outputs without hidden progress, wall-clock reads, or mutation. Hold tick zero is immediately eligible for completion, but completion still requires an explicit request. Progress is integer and monotonic, cannot exceed the required hold, and cannot complete early.

The session locks actor ID/revision, target ID/revision, verb, decision parameters, start tick, and progress. Completion requests must present the exact locked actor and target revisions. Any stale actor or target fails closed and yields no mutation intent.

## Mutation boundary
Completion produces a deterministic atomic mutation intent/result, never applies world or inventory changes. The intent includes expected actor/target revisions, consumed canonical energy/resources, generated capability/discovery facts, semantic events, result code, and next action. Costs must be finite, nonnegative, canonically ordered, and consumed only by a successful completion. External owners validate and apply the intent atomically. Cancellation, rejection, stale authority, and other no-op results contain no mutation.

## Canonicalization and immutability
A local canonical serializer recursively orders object keys and semantically unordered collections, preserves ordered event sequences, and rejects unsupported or non-finite values. Hashing is synchronous and deterministic over canonical bytes. Inputs are cloned rather than mutated; returned public values are deeply frozen. No `Date`, `Math.random`, ambient clock, random source, DOM, or global registry is permitted.

## Browser proof and evidence
The Playwright fixture loads the normal route, verifies TestBridge has no authority, then dynamically imports the interaction module. It evaluates a locked cargo door, resource node, repair terminal, and an actor with scanner and cutter: Scan is allowed, Extract is blocked for insufficient energy, Open progresses by hold ticks, and stale completion is rejected. Evidence is timestamp-free JSON and Markdown with no screenshot because the slice has no presentation change. The focused E2E remains outside existing CI groups.

## Ownership and delivery
Exclusive implementation writes are limited to the change folder, `apps/weltraum-browser/src/interaction/**`, `tests/unit/interaction*.test.ts`, `tests/e2e/surface-interaction-core.spec.ts`, task-prefixed evidence, and the focused documentation file. Configuration, main/style, Surface Lab, voxel, workers, Ship Builder, Combat, Cargo, Persistence, UI, `.github`, infrastructure, Unity, and E2E CI-group files are forbidden. Delivery uses Node 22, complete verification and two independent reviews, then commit `#WELTRAUM-000 Add surface interaction core` and a non-force push to the same branch; no PR, merge, or archive.
