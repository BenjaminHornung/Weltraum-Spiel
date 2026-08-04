# ExecPlan: Hestia V3.4 async Structural preparation and unbounded-piece runtime

## Status and approval boundary

This is the self-contained V3.4 delta plan for the currently approved V3.1
Hestia Surface Play recovery. The user has explicitly approved the product
direction on 2026-07-29:

- Structural and Physics preparation may run asynchronously and on multiple
  workers;
- valid destruction must not terminate at a fixed body, collider, contact or
  motion-count rejection;
- logical fallen pieces are not limited by a gameplay constant;
- deterministic coarser Physics representations are allowed when exact
  fine-cell work cannot complete responsively, while Structural/Voxel Authority
  remains exact;
- available CPU and GPU resources should be used purposefully; and
- any loading bar must show measured completed/total work, never a decorative
  animation or invented phase percentage.

Those decisions authorize the private, contract-neutral foundations in Phases
1 through 4. They do not by themselves authorize a silent public-contract
mutation. The fixed count of eight is present in both Structural Transfer V1
and the current Surface Presentation contract, so unbounded logical pieces
cannot be delivered by private worker continuations alone. Every public
Structural command/evidence/persistence migration, every
`surface-play/contracts/index.ts` mutation and the live Runtime switch is
therefore deferred to Phase 5.

Phase 5 starts only after the user approves this exact reconciled plan with:

```text
V3.4 genehmigt: Structural Transfer V2, unbounded logical registry/paged Surface projections, Structural Evidence Archive V2 und Async-Runtime-Switch gemäß diesem ExecPlan.
```

This one phrase approves the reconciled Transfer, Surface, Structural Evidence
Archive and Runtime migration below. Until it is received, all private,
contract-neutral work in Phases 1 through 4 may continue, but no Phase 5
public contract, persistence namespace or live Runtime mutation may start.

Any materially different command shape, compatibility rule, projection model
or evidence-retention decision requires a new explicit reconciliation and
approval before product mutation.

V3.4 supersedes only the V3.1 rules that make resource budgets fatal gameplay
outcomes. It does not weaken authority, hash, revision, failure-atomicity or
determinism rules. `NonFiniteState` remains an integrity failure, not a resource
budget.

## Goal

After V3.4, a real click on valid attached Structural material gives immediate
responsive feedback, prepares the complete revision-bound cut off the main
thread, and atomically publishes the accepted result without a main-thread long
task. Any number of logical fallen pieces can remain represented; only bounded
work is scheduled per frame/worker slice. Large or complex bodies continue on a
deterministic adaptive Physics representation instead of returning
`BodyCapacityExceeded`, `ColliderBudgetExceeded`, `ContactBudgetExceeded` or
`MotionBudgetExceeded` as a normal valid-cut result.

The synchronous implementation remains only as a separate legacy V1
persistence namespace and launch profile selected before a world is loaded or
migrated. It is not a rollback path for a world whose V2 manifest commit has
completed: a migrated V2 world never reopens through the V1 decoder/Runtime,
and migration failure leaves the V1 source manifest authoritative without
publishing a partial V2 destination. The async V2 profile becomes the default
for new or migrated worlds only after focused Units, full build, real
installed-Chrome E2E, independent verification and the user's manual
playtest. There is no same-world hot toggle between V1 and V2.

The unbounded-history claim in V3.4 is limited to Structural tree/body
destruction. `ADAPTIVE_MAX_JOURNAL_RECORDS = 4_096` remains a separate Adaptive
edit-journal boundary. Terrain/Adaptive history beyond that boundary is not
claimed until a separate migration is planned and explicitly approved.

## Context

Repository and worktree:

- protected root: `C:\IFI_SourceCode\Temp\WeltraumSpiel` — never mutate;
- active worktree:
  `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-hestia-first-person-combat-integration-v1`;
- branch: `feature/browser-hestia-first-person-combat-integration-v1`;
- one DevToolbox execution: `c757ca664e5a4060b90a5ca665380bb6`;
- Node 22 binary:
  `C:\IFI_SourceCode\Utils\npm-tmp\opencode\node22-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe`;
- installed Chrome:
  `C:\Program Files\Google\Chrome\Application\chrome.exe`;
- scratch root only:
  `C:\IFI_SourceCode\Temp\WeltraumSpiel-AgentScratch`.

Current synchronous flow:

```text
real click
  -> SurfacePlayRuntime.#createCombatRaycast
  -> attached Tree raycast
  -> preflightSurfaceTreeFire synchronously
       -> damage preview / connectivity / hashes
       -> detached facts / mass / collider
       -> transfer / final authority
       -> body admission / prepared Physics tick
       -> collision snapshot
  -> executeSurfaceCombatFire
  -> cost/events and atomic Runtime adoption
```

This flow keeps authority atomic but performs practically all Structural work
inside the input task. Preserved Chrome evidence includes `266.70 ms` frame
spikes and older `442 ms` click-to-publication / `237 ms` long-task failures.
The current live page loads no `preparedStructuralFire` worker resource and
still exposes the old fixed-cap behavior.

Current source evidence also fixes the public migration boundary:

- `voxel/structural/types.ts` declares
  `STRUCTURAL_MAX_TRANSFER_SOURCE_FRAGMENTS = 8` and Transfer V1 carries the
  complete ordered `sourceFragmentIds` array;
- `voxel/structural/validation.ts` validates that V1 array at the same cap;
- `voxel/structural/transfer.ts` requires the array to equal the complete
  detached Fragment set and rejects a classification with more than eight
  Fragments before mutation;
- `surface-play/contracts/index.ts` caps the transfer summary,
  `detachedComponentIds`, `bodySources` and `dynamicBodies` at eight and
  requires one transferred Fragment per detached Component; and
- Structural `NoChange` is already an accepted authority result: it advances
  `objectRevision` exactly once and appends new command evidence/evidence hash,
  while `editRevision`, bricks, content hash, changed keys and invalidations
  remain unchanged; and
- `voxel/adaptive/edits.ts` independently caps the Adaptive edit journal at
  4,096 records; that is not the Structural evidence archive addressed here.

Consequently, splitting a 9+ Fragment transfer into private chunks cannot call
Transfer V1 repeatedly without inventing extra public revisions/evidence or
violating its complete-set rule. The private job may calculate the complete
set through bounded continuations, but Phase 5 must publish it as one Transfer
V2 authority transition.

Private foundations present in the dirty worktree, but not yet live:

- `preparedStructuralFireProtocol.ts`, codec, scheduler, worker and client;
- adaptive exact/coarse collider derivation in `surfaceRigidBody.ts`;
- `surfaceRigidBodyRegistry.ts`;
- `surfaceRigidBodySpatialIndex.ts`;
- `surfaceRigidBodyResidencyIndex.ts`;
- `surfaceRigidBodyIslandScheduler.ts`.

The foundations are not acceptance evidence. Each remains behind independent
review and Runtime integration.

## Non-goals

- No GPU ownership of connectivity, canonical hashing, damage, authority or
  deterministic Physics.
- No increase of the old `8 bodies`, `64 boxes`, `256 contacts` or `4 motion
  substeps` constants as the fix.
- No silent deletion, merging, render-only substitution or permanent freezing
  of logical pieces.
- No full Structural object clone on every worker job.
- No synchronous main-thread fallback that recreates the original long task.
- No `window.TestBridge` on Surface Play.
- No package or lockfile change in this slice.
- No Adaptive journal migration or claim of unlimited Terrain-edit history;
  V3.4 removes the Structural tree/body evidence dead end only.
- No city/editor implementation.
- V3.2 body-local editing and V3.3 terrain-support invalidation remain later
  ordered slices. V3.4 must preserve seams for them but does not claim them
  complete.
- The Coast/Lush biome may proceed in versioned, disjoint generator files, but
  it must not be used to claim this Core slice green.

## Architecture decision

### 1. One complete immutable PreparedStructuralFire worker job

One worker job owns all pure work for a single attached-object cut:

1. validate source object/revision/edit revision/content hash and hit;
2. derive the damage candidate and connectivity/classification;
3. derive mass and detached-component facts;
4. build deterministic adaptive collider/body candidates;
5. derive transfer and final attached-only authority;
6. derive the revision-bound collision delta/snapshot;
7. derive a registry mutation plan and prepared next-Physics work; and
8. return canonical deltas, receipts, work counters and result hash.

Splitting these phases into unrelated workers is forbidden because it creates
duplicate transfers and cross-worker authority races. Internal continuations
may yield between bounded work units but remain one logical job.

The worker holds a private replica keyed by
`objectId/objectRevision/editRevision/contentHash/algorithmVersion`. The first
job transfers a packed seed once; later jobs transfer commands and changed
brick/cell deltas. Authority-owned buffers are never detached.

### 2. Main Thread owns validation and atomic adoption

The Main Thread retains:

- real input order and current tick;
- current source/registry predecessor identity;
- worker result-gate validation;
- Combat cost/events;
- atomic adoption of Structural Authority, collision, body registry, Physics
  scheduling and immutable Presentation snapshots;
- DOM, Pointer Lock, HUD and Three.js scene mutation.

Main validation must not parse/materialize the full source object or rerun
classification, mass, collider, transfer or collision derivation. It validates
the bounded manifest, byte/view receipt, source identity, changed keys/counts,
result hash and predecessor hashes. Validation plus commit has p95 `<=4 ms`
and hard max `<=8 ms`.

The worker replica advances only after an explicit adoption acknowledgement.
Stale, cancelled, rejected or timed-out results trigger deterministic resync;
they never advance the private replica silently.

The complete worker result is one versioned, canonical transaction package.
It contains no lazy resolver or worker-local `WeakMap` identity. Its bounded
manifest must bind all of the following:

- source object/edit revision and content hash, fire/Structural command IDs,
  ordered input views and exact transferred bytes;
- damage command/result hash, changed-brick commitments and resulting
  classification/mass hashes;
- complete-set count/root commitments plus bounded canonical chunk receipts
  for detached Component/Fragment membership, source revision/hash, fragment
  content hashes, mass-property hashes and work counters;
- the Damage-to-Transfer V2 command/result chain, `sourceFragmentSet`,
  transferred-cell/brick commitments and final attached-only object/edit
  revision, content hash, classification hash and mass hash;
- a complete registry mutation root plus bounded canonical BodySource/body
  descriptor chunks, including logical body ID, activation tick, release hit,
  gravity-derived initial velocities, mass/inertia, exact/adaptive collider
  representation, representation hash and derivation counters;
- the predecessor Collision hash, changed-brick collision cell groups,
  per-brick commitments, reused keys, final collision binding/hash and
  derivation statistics;
- the predecessor registry hash, ordered registry mutation plan, prepared
  Physics continuation identity and all real work totals/counters; and
- a final transaction hash and adoption receipt covering Authority, Collision,
  Body Sources, registry and prepared Physics state together.

Body insertion is a versioned bulk transaction, not a loop over the current
single-record mutators. `PreparedSurfaceBodyImportV1` contains canonical
body-ID-sorted insert/update/remove operations plus the expected and resulting
root commitments for the registry, spatial index and residency index. For one
accepted Fire, each of those three domains advances exactly one revision,
whether the transaction adds 1, 9, 64, 256 or 1,024 bodies.

Main consumes the import through bounded continuation builders owned by
`surfaceRigidBodyBulkImport.ts`. The builders validate operation ranges and
construct unpublished persistent registry/spatial/residency roots in scratch;
no continuation may expose an intermediate root or increment a public
revision. The final step verifies operation count/order, predecessor hashes,
all three resulting root hashes and cross-root body-ID equality, then performs
an O(1)-like atomic replacement of the three accepted root references together
with the Structural/Collision/Physics transaction. Abort, stale identity,
cancel, worker failure or any root mismatch discards the scratch builders and
leaves all accepted roots and revisions reference-identical. Main may never
materialize the complete registry as a flat array or call the one-record APIs
1,024 times during adoption.

Main validates this package using bounded descriptor, hash, count, byte and
predecessor checks. It must not rebuild detached membership, mass,
classification, colliders or collision-cell hashes merely to trust the worker.
If any required commitment would force an unbounded Main re-derivation, Phase 4
stops and the result format is redesigned before Runtime wiring.

Transport lifecycle is part of the same gate:

- overlapping jobs for different objects may not invalidate one another via a
  process-global planning epoch;
- stale/cancelled/rejected intermediate continuations explicitly and
  idempotently discard their worker root;
- a Worker restart invalidates all replica/adoption assumptions and requires a
  current packed seed before another command; and
- dispose/late-message paths cannot adopt, retain or resurrect a result.

### 3. Accepted NoChange is still an authority transition

Structural `NoChange` is not an instruction to reuse the old object identity.
The prepared job returns the real accepted result and Main adopts it atomically:

- `objectRevision` advances by exactly one;
- one new evidence receipt is appended; in V2 the verified Segment head,
  receipt count and archive/evidence hash change without an inline history scan;
- `editRevision`, bricks, content hash, changed-brick keys and invalidations
  remain unchanged;
- collision, Body Sources, logical registry and Physics state remain unchanged;
  and
- no `FireAccepted`, Energy debit or Heat is published before adoption. At the
  adoption tick the existing Combat policy runs exactly once against the
  accepted result.

The worker replica advances to this new object/evidence revision only after
the Main adoption acknowledgement. A stale or rejected NoChange result is
discarded exactly like an Applied result and cannot consume a revision or
cost. Tests must issue the next command against the adopted NoChange object,
not against the pre-command source.

### 4. Structural Transfer V2 publishes one complete-set commitment

Phase 5 introduces a versioned
`StructuralTransferDetachedComponentsCommandV2`. Its serialized
`sourceFragmentSet` is exactly:

```text
sourceFragmentSet = {
  count,
  orderedFragmentIdsHash,
  classificationHash
}
```

`count` is the complete detached Fragment count for the source classification.
`orderedFragmentIdsHash` commits to every Fragment ID in canonical order.
`classificationHash` binds that ordered set to the exact revision-bound
classification from which membership and transfer cells were derived. The
command remains bound to target object, expected/resulting object revision,
Adaptive source, actor/source, order and budgets.

Private worker continuations may enumerate, validate, hash and transfer this
complete set in bounded chunks. Chunk size and worker completion order are not
public semantics: every chunk binds its canonical range and predecessor root,
and the final prepared receipt must reproduce the same count, ordered-ID hash,
classification hash, changed-brick commitment and result hash for any legal
chunk size or independent-worker completion order.

Adoption applies the complete set once and publishes exactly one public object
revision, one edit revision, one result and one evidence record. It is forbidden
to expose intermediate chunk revisions/evidence or to call Transfer V1 once per
chunk. V2 is used for all newly created transfers, including counts one through
eight, so new behavior does not branch at the former cap.

Transfer V1 remains a distinct supported schema. Existing V1 commands,
objects, evidence, persisted JSON bytes and their hashes must deserialize and
round-trip byte/hash-identically. V2 validators, canonical projections,
hashing and persistence dispatch by explicit schema version; they do not
reinterpret or rewrite V1 bytes.

### 5. Structural Evidence Archive V2

Phase 5 also introduces four explicit versioned contracts:

- `StructuralObjectV2`, which replaces the inline `commandEvidence[]` truth
  with an Evidence Origin, head Segment hash, total receipt count and archive
  hash;
- `StructuralResultV2`, whose canonical hash binds the V2 object/archive
  summary and accepted or rejected result fields without serializing all prior
  receipts;
- `StructuralEvidenceOriginV2`, the content-addressed root for either a fresh
  V2 object or an exact V1 migration origin; and
- `StructuralEvidenceSegmentV2`, a content-addressed append segment containing
  at most 64 canonical receipts plus its predecessor Segment hash and canonical
  receipt-ordinal range.

There is no total Segment or receipt cap. Segment work is bounded, history is
not. The archive is an explicitly acyclic graph. An Evidence Origin for a V1
migration hashes only its versioned origin projection, legacy schema version,
exact legacy evidence-bytes hash and legacy receipt count. It never contains
or hashes a Segment head, archive hash or archive manifest. The first Segment
links to the Origin hash with a typed `Origin` predecessor; every later Segment
links only to the immediately preceding Segment hash with a typed `Segment`
predecessor. A Segment hash covers its versioned canonical projection,
predecessor kind/hash, ordinal range and receipts. The archive manifest hashes
exactly Origin hash, head Segment hash and total receipt count. There is no
fifth migration-root object and no edge from Origin back to head/archive. A V2
result hash covers the versioned Result V2 projection including this archive
manifest; it never falls back to V1's full-array hash. V1 evidence/result
hashes remain unchanged and are evaluated only by the V1 decoder.

The current one-command/one-receipt authority rule is explicit:
`receiptCount === objectRevision`. Migration and every V2 append validate that
invariant. Command sequencing uses `objectRevision`; archive traversal and
progress use `receiptCount`. Neither is inferred from a loaded array length.

Append is failure-atomic:

1. derive the next receipt and a replacement/new head Segment with at most 64
   receipts;
2. write the canonical Segment bytes through an idempotent
   content-addressed `putIfAbsent` store;
3. require a store receipt that binds requested hash, stored hash and exact byte
   length, and resolve/read-verify the Segment when the store did not prove an
   already identical value; and
4. only then publish the new Object V2 archive head/count/hash as part of the
   same Main adoption as the command result.

A failed/stale/cancelled append cannot move the object head. Its Segment is an
unreachable store object eligible for later reachability GC.

Duplicate-command protection remains exact. A derived exact command-ID `Set`
is hydrated from the reachable Origin/Segment chain in bounded slices. It is a
cache, not authority. A cold/restarted/migrated object is `Preparing` and cannot
accept a Structural command until hydration verifies every reachable Segment,
receipt ordinal and predecessor link. No Bloom filter or truncated tombstone
set may authorize a command. After adoption, the accepted command ID updates
the hydrated cache exactly once.

Persistence uses a bounded object manifest plus a Segment resolver/store.
Bundle export and import stream canonical Origin/Segment records instead of
materializing the full history. Every resolved record is hash- and
predecessor-verified before use. Missing or corrupt reachable records keep the
object unavailable and fail closed; they do not truncate history.

`voxel/structural/evidenceArchive.ts` owns the pure schema, canonical hashes and
resolver/store port. Browser durability is an adapter under `browser-storage`
that follows the existing IndexedDB repository lifecycle/error patterns; a
memory adapter exists only for deterministic tests. IndexedDB records are keyed
by the canonical Origin/Segment hash and never overwrite different bytes at the
same key.

V1 is read-only decodable. Before a V1 object can receive a new command, a
deterministic migration creates an Evidence Origin V2 and V2 Segments in
canonical groups of 64 receipts, preserving the existing object and edit
revisions. The shared semantic content projection must be byte-compatible with
the V1 content projection so the authority meaning/content hash is preserved;
if that cannot be proven for an input, migration stops without rewriting it.
The Origin binds the exact V1 schema/evidence bytes hash/count only; the
separate archive manifest binds the resulting Origin/head/count. Migration
therefore has one forward-only Origin -> first Segment -> later Segment chain
and no cyclic migration root.

Durable adoption uses a new explicit Structural mutation commit repository;
the existing save repository supplies lifecycle/error-handling conventions but
does not already implement this protocol. Before commit, every immutable
Origin, Segment, prepared transaction package, registry/spatial/residency root
blob and destination manifest blob is written and hash/read-back verified. A
content-addressed `PreparedStructuralMutationV2` descriptor is registered as a
pending journal record and GC root without changing the source manifest,
Combat ledger or accepted in-memory state. A per-object mutation latch then
blocks the next command until the durable outcome is known.

One final IndexedDB read-write transaction spans the Structural manifest,
mutation journal, registry/spatial/residency root records and Combat
cost/event ledger stores. It:

1. reads and CAS-validates the exact source manifest revision/hash;
2. writes the destination manifest and three accepted root commitments;
3. changes the journal outcome for the prepared package from `Prepared` to
   `Committed`; and
4. writes the exactly-once Combat debit/event ledger entry bound to the same
   transaction/adoption ID.

Any request error or transaction abort leaves the source manifest and ledger
authoritative. Only `transaction.oncomplete` authorizes Main to swap its
unpublished roots into memory, publish Combat/Presentation and release the
mutation latch. A crash after durable commit but before in-memory publication
recovers the committed destination and ledger exactly once. A prepared record
without a committed outcome recovers the source manifest; its immutable blobs
remain orphan/pending until reconciliation proves them unreachable. Pending
records remain GC roots throughout reconciliation, so GC cannot race an
in-flight or crash-recovered commit.

Reachability GC may delete only Segment/Origin records unreachable from every
live object head, persisted manifest, in-flight adoption or pending mutation
record. It may collect stale result branches and orphaned failed appends only
after journal reconciliation and a root snapshot prove them unreachable. It
never age-, count- or size-evicts a reachable predecessor.

All integrations that currently infer sequence or history from
`commandEvidence.length` move to an object-revision/receipt-count API. Collision
and Runtime validation read the accepted tail receipt through the archive API;
they do not hydrate or scan the full history on the Main Thread.

### 6. Complete logical truth and bounded Surface projections

The immutable `SurfaceRigidBodyRegistry` is the complete logical body truth.
It has no gameplay count cap and commits to every body through registry
revision, predecessor hash, total count and registry root hash.

Surface contracts do not duplicate an unbounded array into every frame. The
V2 Structural transition and Presentation snapshot expose:

- complete-set count/root summaries for detached Components, source Fragments
  and Body Sources, bound to the Transfer V2 classification and registry roots;
- the complete logical registry identity and count/root commitment;
- a bounded resident projection for bodies required by the current
  interaction/Physics/Presentation working set; and
- deterministic pages for nonresident Body Sources/bodies, each bound to the
  same registry root, canonical start/cursor, item count, total count and page
  hash.

Resident/page limits bound payload and per-frame work only. Hitting a page or
residency limit returns a continuation/page cursor; it cannot reject a valid
cut, delete a logical body or make the summary disagree with the complete
registry. Cross-checks use counts and root hashes instead of requiring all IDs
in one Surface array. No `denseArray(..., 8)`-style cap remains on logical
Fragments, Body Sources or dynamic bodies.

### 7. Pending fire is readiness, not accepted Combat

Only one Structural prepare may run per object. A click that starts preparation
does not yet publish `FireAccepted`, debit Energy, add Heat or mutate authority.
It publishes a read-only preparation status for HUD/diagnostics.

While the same object is preparing, the weapon is visibly `PREPARING`; further
fire edges are not converted into accepted Combat commands and incur no cost.
This is backpressure, not loss of an already accepted command. Target and
movement remain responsive.

On a valid current result, the durable commit completes first. On the next
eligible fixed tick, Combat acceptance/cost from the committed ledger,
authority/collision/body registry root adoption and Presentation publication
occur atomically in memory. A stale result is discarded and may be re-prepared
only against the current source identity. No partial cut or partial cost is
visible.

### 8. Real progress only

The worker protocol exposes:

```text
workProgress = Unavailable {
                 stage: Enumerating,
                 completedEnumerationUnits
               }
             | Available {
                 completedUnits,
                 totalUnits,
                 frozenWorkGraphHash
               }
```

Enumeration itself runs through bounded continuations. While the exact graph
total is unknown, progress remains `Unavailable { stage: Enumerating, ... }`;
`completedEnumerationUnits` is diagnostic real work, not a denominator or
percentage. `totalUnits` and `frozenWorkGraphHash` become immutable only after
the complete canonical graph has been enumerated. Every later increment
corresponds to completed real work such as a cell, brick, component, collider
mapping, transfer member or collision-delta unit. Continuation phase names are
not percentages, and a later continuation may not increase or replace the
frozen total.

The player HUD hides the determinate bar and all percentage text for
`Unavailable`; it shows only `PREPARING` plus the non-percent enumeration
stage. For `Available`, it shows a left-to-right determinate bar computed as
`completedUnits / totalUnits`. The value is monotone and reaches 100% only when
all work committed by `frozenWorkGraphHash` is complete. Acceptance requires
the complete live attached-cut path to reach `Available` before its first
costly post-enumeration phase.

### 9. No fixed logical body count

`SurfaceRigidBodyRegistry` owns every logical piece and is immutable,
revision-bound, predecessor-hash-bound and content-addressed. Insert, update and
remove operations must use canonical frozen inputs. A fixed Gameplay body cap
does not exist.

Residency is a work/presentation decision:

- `ActiveContact`: exact/adaptive colliders participate in near interaction;
- `SleepingExact`: exact body-local authority remains targetable and wakes on
  relevant contact/edit/support invalidation;
- `FarProxy`: logical identity, exact archive and accumulated time remain;
  deterministic coarse simulation/refinement is scheduled before near use.

Moving between tiers never changes logical body ID, source provenance or
body-local voxel content.

### 10. Spatial index and contact islands bound work, not gameplay

The spatial index is immutable and incrementally/worker updated. General
queries expose a deterministic continuation cursor; they never claim universal
`O(log N + hits)` when overlapping AABBs require more work.

The island scheduler uses predictive swept bounds, deterministic
sweep-and-prune and canonical union-find. Work slices bound:

- body integrations;
- candidate contact pairs;
- solver/contact iterations; and
- committed substeps.

Exhausting a slice returns a continuation. It does not reject or delete a body.
Every declared slice budget is cumulative across all phases and substeps in
that slice; resetting a local loop counter must not exceed the advertised
body, pair, contact, iteration or substep limit.

Dependent work for one island is state-chain bound. Each issued slice binds
the exact predecessor Physics-state hash and its accepted receipt binds the
resulting immutable state/hash. The next dependent slice for that island is
not issued until the predecessor receipt is validated. Results may complete
out of order only across independent islands; they are canonically reconciled
without accepting a disconnected or invented state hash. Cancellation or
retry resumes from the same accepted predecessor and cannot skip work.

Completed islands publish in canonical order independent of worker finish
order. The final completion receipt covers every island's terminal state and
the prepared Physics-world hash, not merely a set of work IDs. Falling far
pieces continue accumulating/simulating time; they are not frozen merely
because they left the near set.

### 11. Adaptive Physics representation ladder

Structural/Voxel Authority always retains exact occupied `0.125 m` cells.
Physics may choose a deterministic representation per body/island:

1. exact compact boxes;
2. alternative exact axis partitions;
3. conservative coarse broadphase boxes with exact occupied-cell narrowphase
   mapping;
4. far/sleeping proxy plus exact archived refinement source.

The choice is revision/hash-bound and driven by measured work, not camera
pixels or nondeterministic timing. A coarser representation may create
conservative candidate pairs but must not remove exact occupied material or
invent authority. Near ray hits and edits refine before acceptance.

### 12. Replace fatal resource budgets with continuations

The live Runtime removes normal valid-cut paths to:

- `BodyCapacityExceeded`;
- `ColliderBudgetExceeded`;
- `ContactBudgetExceeded`; and
- `MotionBudgetExceeded`.

Collider derivation selects the adaptive ladder. Contact and motion work resume
through island continuations. Work that spans frames keeps the last complete
immutable state published; Presentation may interpolate but may not invent
World truth.

`NonFiniteState`, invalid hashes, malformed deltas, unsupported algorithm
versions and stale source identities remain fail-closed integrity errors.

## Contract delta requiring explicit V3.4 approval

No file in this section changes before the exact approval text in **Status and
approval boundary** is received. Phase 4 remains private and contract-neutral.
Phase 5 then applies the following single reviewed public migration.

Structural Core changes in
`voxel/structural/{types,model,commands,validation,canonical,persistence,transfer,index}.ts`,
new `voxel/structural/evidenceArchive.ts` and their contract/persistence tests:

- add the explicitly versioned Transfer V2 command with
  `sourceFragmentSet { count, orderedFragmentIdsHash, classificationHash }`;
- derive and validate that commitment from the complete current detached
  classification while performing CPU work through private continuations;
- publish one object/edit revision, one accepted result and one Evidence Archive
  receipt for the complete transfer;
- use V2 for every new transfer count, including one through eight; and
- preserve V1 validators, canonical projection, hash and persistence dispatch
  so existing V1 serialized bytes and hashes remain readable and unchanged.

Structural Evidence Archive changes in the same Phase 5 migration:

- add Object V2, Result V2, Evidence Origin V2 and Evidence Segment V2;
- make the migration DAG acyclic: a migration Origin hashes only legacy schema,
  exact evidence bytes hash and receipt count; the first Segment links to that
  Origin, later Segments link to one predecessor Segment, and the archive
  manifest alone hashes Origin/head/count;
- do not create a separate migration-root contract or let Origin bind a future
  Segment/archive hash;
- cap each Segment at 64 receipts while leaving total Segments/receipts
  unbounded;
- require idempotent content-addressed Segment storage and a verified store
  receipt before object-head adoption;
- expose bounded resolve, head/tail, receipt-count, command-ID hydration and
  streaming bundle APIs instead of inline evidence-array access;
- keep an object `Preparing` until exact command-ID hydration completes;
- migrate V1 histories deterministically in 64-receipt groups without changing
  object/edit revisions and stop if semantic content projection compatibility
  cannot be proven; and
- permit GC only after reachability proves an Origin/Segment is absent from all
  live, persisted, in-flight and pending-mutation roots.

Bulk root adoption changes in
`surface-play/physics/{surfaceRigidBodyBulkImport,surfaceRigidBodyRegistry,surfaceRigidBodySpatialIndex,surfaceRigidBodyResidencyIndex}.ts`
and their Unit tests:

- add the versioned `PreparedSurfaceBodyImportV1` operation/root commitment;
- build unpublished persistent registry, spatial and residency roots through
  bounded Main continuations without invoking per-record public mutators;
- advance each domain revision exactly once per accepted Fire, including 9 to
  1,024 additions; and
- verify all three roots and atomically replace their accepted references only
  after the complete transaction passes.

Crash-consistent durability changes are new owners under `browser-storage`:

- `structuralMutationCommitRepository.ts` defines the CAS/journal/root/Combat
  ledger port;
- `memoryStructuralMutationCommitRepository.ts` supplies deterministic crash
  and boundary-injection tests only;
- `indexedDbStructuralMutationCommitRepository.ts` owns the multi-store
  read-write transaction and reuses only the existing IndexedDB repository
  lifecycle/error conventions; and
- immutable archive/root blobs are stored before the commit transaction, while
  the final transaction CASes source manifest, commits destination manifest,
  roots, journal outcome and exactly-once Combat ledger together. Main adopts
  memory only after durable completion.

Surface changes in `surface-play/contracts/index.ts` and their contract tests:

- replace complete ID arrays in V2 transition cross-checks with Fragment,
  Component and BodySource count/root summaries bound to the same
  classification/registry root;
- replace the frame-global eight-item body/source arrays with the complete
  logical registry commitment plus bounded resident and deterministic paged
  projections;
- add a nullable `structuralPreparation` snapshot containing job ID, object ID,
  source revision/hash, lifecycle `Queued|Running|ReadyToAdopt`, progress union
  and queue/worker latency facts;
- add a weapon/HUD readiness projection for `Preparing` without creating a
  Combat acceptance/rejection event;
- keep `latestTransition`, V3.2 `latestBodyTransition` and V3.3
  `latestSupportTransition` separate; and
- retain legacy failure-code parsing only for persisted V3.1 evidence, while
  new valid Runtime work no longer emits the four resource-budget failures.

Runtime owns the full registry and produces bounded Surface projections;
Presentation and Three.js never become registry or authority owners. Worker,
queue, DOM, `Worker` and TestBridge types remain outside public gameplay
contracts.

V1 remains read-only decodable in a separate legacy persistence namespace and
launch profile and retains its exact 4,096-array validation; the cap is not
raised or reinterpreted. Profile/namespace selection happens before opening a
world. New V2 mutation never appends to the V1 array and has no total receipt
cap. A committed V2 manifest cannot reopen through V1 as a rollback. Existing
source integrations that use `commandEvidence.length` or `.at(-1)` must use
the V2 object-revision, receipt-count and tail-receipt APIs after migration.

This migration does not change `ADAPTIVE_MAX_JOURNAL_RECORDS = 4_096`.
Structural tree/body destruction is in scope; unbounded Terrain/Adaptive edit
history requires a separate approved Adaptive journal design.

## Implementation phases

### Phase 0 — Freeze evidence and approval

Files:

- this ExecPlan;
- `manual-play-rejection-analysis-2026-07-27.md`;
- existing failed screenshots/JSON.

Actions:

1. Record current status/diff and the old synchronous live-resource inventory.
2. Preserve the failed `266.70 ms`, `MotionBudgetExceeded`, complex-cut and
   too-many-pieces evidence as rejection evidence.
3. Record the current V1 Structural evidence bytes/hash fixtures and Adaptive
   journal boundary separately.
4. Obtain the exact V3.4 approval text, including Structural Evidence Archive
   V2, before any Phase 5 public command/persistence/Surface-contract or live
   Runtime mutation.

Verification: `git diff --check`; old contract baseline recorded.

### Phase 1 — Worker transport correctness

Files:

- `surface-play/workers/preparedStructuralFireProtocol.ts`;
- `preparedStructuralFireCodec.ts`;
- `preparedStructuralFireScheduler.ts`;
- `preparedStructuralFireWorker.ts`;
- `preparedStructuralFireWorkerClient.ts`;
- matching Unit tests.

Actions:

1. Support `Applied` and accepted `NoChange` end-to-end. `NoChange` must adopt
   `objectRevision + 1` and new evidence/evidence hash while preserving edit
   revision, bricks, content hash, collision, bodies and Physics state.
2. Use a client-owned monotonic dispatch epoch independent of object revision.
3. Require adoption acknowledgement before replica advancement.
4. Add stale-after-compute resync and byte/view receipt tests.
5. Publish honest `workProgress`; bounded graph enumeration uses
   `Unavailable { stage: Enumerating, completedEnumerationUnits }` and exposes
   no determinate bar or percentage before the exact graph total is frozen.
6. Prove the next command binds the adopted NoChange revision and that no
   Combat cost/event occurs before adoption.

Stop if a worker can diverge from Main after stale/rejected adoption.

### Phase 2 — Scalable registry, residency and spatial queries

Files:

- `physics/surfaceRigidBodyRegistry.ts`;
- `physics/surfaceRigidBodySpatialIndex.ts`;
- `physics/surfaceRigidBodyResidencyIndex.ts`;
- matching Unit tests.

Actions:

1. Deep-canonicalize/freeze all external inputs and consume the validated
   return value.
2. Bind updates to predecessor content hash.
3. Replace synchronous full rebuilds with incremental or worker-owned plans.
4. Add continuation-based general spatial queries.
5. Fail closed before Safe-Integer cursor exhaustion.
6. Prove 1/8/64/256/1,024 logical bodies without loss or long task.

### Phase 3 — Contact-island and adaptive-collider foundations

Files:

- `physics/surfaceRigidBody.ts`;
- `physics/surfaceRigidBodyIslandScheduler.ts`;
- matching Unit tests.

Actions:

1. Independently review metric reconstruction, large-coordinate precision,
   exact coverage and adaptive mapping work counters.
2. Include gravity and bounded angular sweep in predictive island bounds.
3. Prove SleepingExact wake and FarProxy accumulated-time refinement.
4. Prove each per-slice counter remains within its cumulative limit across
   multiple phases and substeps.
5. Bind each dependent slice and receipt to predecessor/result Physics-state
   hashes; permit out-of-order completion only for independent islands.
6. Prove retry/cancel resumes from the same accepted predecessor and final
   completion covers the real prepared Physics-world state.

Stop on any lost/duplicated ID, non-conservative sweep or authority mutation.

### Phase 4 — Complete worker derivation and measured progress

Private write scope:

- new `vegetation/surfaceTreePreparedFire.ts`;
- worker protocol/codec/worker/client and private prepared-result types;
- focused private parity, continuation and performance tests.

Read-only reference implementations in this phase:

- `vegetation/surfaceTreeAuthority.ts` and `surfaceTreeCollision.ts`;
- `voxel/structural/{commands,connectivity,massProperties,transfer}.ts`;
- current Surface contracts and Runtime.

`voxel/structural/{types,validation,canonical,persistence,transfer,index}.ts`,
`surface-play/contracts/index.ts`, `surfacePlayRuntime.ts` and migration code
are not mutated in Phase 4.

Actions:

1. Compose the entire pure attached-cut derivation inside the single private
   prepared job without making its result authoritative or live.
2. Calculate the complete V2 Fragment-set count/hashes and registry/body plans
   through bounded private continuations; do not call Transfer V1 per chunk.
3. Transfer only seed-once plus deltas/receipts.
4. Add real per-phase work totals/counters.
5. Prove private prepared output versus the current synchronous reference for
   counts one and eight, plus exact fresh-classification/transfer oracles for
   counts nine and above.
6. Prove candidate Main validation/commit remains within `<=8 ms` without
   adopting or exposing it through the live Runtime.

Stop if Main must rerun full derivation or a job transfers the full object after
the initial seed. Also stop if private preparation requires a public schema,
Runtime or persistence mutation; that work belongs only to approved Phase 5.

### Phase 5 — Approved Transfer/Evidence V2 migration and live Runtime adoption

Files:

- `voxel/structural/types.ts`;
- `voxel/structural/model.ts` and `voxel/structural/commands.ts`;
- `voxel/structural/validation.ts`;
- `voxel/structural/canonical.ts`;
- `voxel/structural/persistence.ts`;
- new `voxel/structural/evidenceArchive.ts`;
- new `browser-storage/structuralEvidenceStore.ts`,
  `memoryStructuralEvidenceStore.ts` and
  `indexedDbStructuralEvidenceStore.ts`, reusing the existing repository
  lifecycle/error conventions;
- new `browser-storage/structuralMutationCommitRepository.ts`,
  `memoryStructuralMutationCommitRepository.ts` and
  `indexedDbStructuralMutationCommitRepository.ts`;
- `voxel/structural/transfer.ts` and `voxel/structural/index.ts`;
- Structural contract, transfer and persistence tests;
- `surface-play/contracts/index.ts` and Surface contract tests;
- `vegetation/surfaceTreeAuthority.ts`, `surfaceTreeRuntime.ts` and
  `surfaceTreeCollision.ts`;
- worker protocol/codec/worker/client archive-manifest integration;
- `surfacePlayRuntime.ts`;
- `combat/surfaceCombatRuntime.ts` only if an internal prepared-candidate seam
  is required;
- `surfacePlayBootstrap.ts`;
- `ui/surfacePlayHud.ts` and `ui/surfacePlayDebugOverlay.ts`;
- new `physics/surfaceRigidBodyBulkImport.ts` plus
  `physics/surfaceRigidBodyRegistry.ts`,
  `physics/surfaceRigidBodySpatialIndex.ts` and
  `physics/surfaceRigidBodyResidencyIndex.ts`;
- `physics/surfaceRigidBodyWorld.ts` and `physics/index.ts`;
- Runtime/Combat/HUD/Bootstrap integration tests.

Actions:

1. Verify the exact approval text, including Structural Evidence Archive V2,
   before the first mutation in this phase.
2. Add Transfer V2, schema-version dispatch and V1 byte/hash/persistence
   compatibility; every new transfer uses V2 and publishes one public
   object/edit revision and Evidence Archive receipt.
3. Add Object/Result/Origin/Segment V2, 64-receipt content-addressed Segments,
   the acyclic Origin -> Segment chain, idempotent verified store-before-adopt
   and the versioned archive/result hash semantics defined above. Do not add a
   migration-root object.
4. Add bounded exact command-ID hydration with object `Preparing`, bounded
   manifest/Segment resolver-store APIs and streaming bundle export/import.
5. Migrate V1 histories in deterministic 64-receipt groups while preserving
   object/edit revisions and byte-compatible semantic content projection; stop
   without mutation on incompatibility, missing or corrupt history.
6. Replace every `commandEvidence.length`, full-array duplicate scan and tail
   lookup integration with object-revision/receipt-count/archive APIs.
7. Add reachability-root snapshots and GC only for proven unreachable stale,
   failed or orphaned branches.
8. Add `PreparedSurfaceBodyImportV1` and bounded scratch-root builders for
   registry, spatial and residency indices. One accepted Fire increments each
   affected domain revision exactly once and exposes no intermediate roots.
9. Write and verify immutable archive, transaction and root blobs; register the
   prepared mutation as a pending GC root; acquire the per-object mutation
   latch; then execute one IndexedDB transaction that CASes the source manifest
   and commits destination manifest, Prepared->Committed journal outcome,
   registry/spatial/residency roots and Combat cost/event ledger together.
10. Reconcile restart states exactly once: committed journal means destination
    plus its ledger; prepared/uncommitted means source plus orphan/pending blobs.
    Adopt memory and publish only after durable transaction completion.
11. Migrate Surface transition/Presentation validation to count/root summaries,
   complete registry identity and bounded resident/paged projections with no
   logical count cap.
12. Keep V1 and V2 in separate persistence namespaces/profiles selected before
    world load. Never use V1 as rollback for a committed V2 world; enable async
    V2 as the default only after all technical, browser and manual gates pass.
13. Queue the worker job from the real attached Tree hit without synchronous
   preflight.
14. Keep movement, Pointer Lock, targeting and rendering responsive.
15. Adopt only a current validated and durably committed result on a fixed
    tick, including accepted
   NoChange identity/evidence advancement.
16. Charge Energy/Heat and publish Combat acceptance exactly once from the
    committed ledger at adoption, never before durable commit.
17. Replace the fixed body array/cap with registry, residency and island work.
18. Replace contact/motion fatal budgets with continuations.
19. Render `Enumerating` without a percentage; after the exact work graph is
    frozen, render monotone real preparation progress and F1
    queue/latency/work facts.
20. Dispose workers, listeners, pending jobs and transferred buffers
    idempotently.

### Phase 6 — Regression matrix and performance harness

Required Units:

- worker accepted `NoChange` advances object/evidence identity exactly once,
  leaves edit/bricks/content/collision/registry/Physics unchanged, waits for
  adoption acknowledgement and binds the next command to the adopted revision;
- worker stale, cancel, resync, synchronous continuation-transfer failure,
  retained-root release and two-object epoch order;
- worker/full-preflight parity for anchored, detached and empty results;
- Transfer V2 complete-set RED→GREEN fixtures at exactly
  `1 / 8 / 9 / 64 / 256 / 1,024` detached Fragments, with no rejection or
  logical loss at the former 8-item boundary;
- the same V2 fixture under multiple legal private chunk sizes and reversed
  independent-worker completion order produces byte-identical
  `count`, `orderedFragmentIdsHash`, `classificationHash`, command/result hash,
  final authority, registry root and evidence hash;
- forged count, ordered-ID hash, classification hash, missing/duplicate chunk,
  predecessor, page root or registry root fails atomically before Combat cost,
  authority, collision, registry, Physics or Presentation mutation;
- bulk import at `1 / 8 / 9 / 64 / 256 / 1,024` operations advances registry,
  spatial and residency revisions once per accepted Fire, produces the same
  roots for every legal continuation size and never publishes an intermediate
  root;
- abort/stale/cancel at every bulk-builder continuation leaves all three source
  roots and revisions reference-identical; forged order, duplicate body ID or
  one mismatched root commitment rejects the complete import;
- a Main-thread work probe proves each scratch-root continuation is bounded and
  final validation/root replacement stays within the existing `<=8 ms` hard
  maximum without a flat full-registry materialization or per-record public
  mutation loop;
- persisted Transfer V1 commands, evidence, objects and results deserialize and
  reserialize to the exact old bytes/hashes; new transfers of counts one and
  eight use V2 without changing V1 fixtures;
- Evidence Archive boundary fixtures at `63 / 64 / 65` receipts prove canonical
  Segment rollover, predecessor links and identical reconstructed order;
- 4,097 accepted Structural receipts cross the old terminal boundary without a
  rejection or full-history Main scan;
- 10,000 mixed Applied, NoChange and Transfer V2 receipts preserve exact
  object/edit revision, receipt count, command-ID uniqueness, archive head/hash
  and deterministic repeated-run bytes;
- a cold restart leaves the object `Preparing`; an old duplicate command is
  rejected only after bounded exact command-ID hydration completes, while a
  fresh command cannot bypass incomplete hydration;
- missing/corrupt Segment bytes, wrong predecessor/ordinal/hash, forged store
  receipt and partial streaming bundle fail closed without moving the object
  head or charging Combat;
- deterministic V1-to-V2 migration groups receipts as `64 + remainder`,
  preserves object/edit revisions, V1 bytes/hashes and the byte-compatible
  semantic content projection, and stops atomically on incompatibility;
- migration Origin bytes/hash bind only legacy schema, exact V1 evidence bytes
  hash and count; first/later Segment predecessor kinds are `Origin`/`Segment`,
  archive manifest alone binds Origin/head/count, and a graph-walk proves the
  persisted archive contains no cycle or fifth migration root;
- restart/reload reconstructs the same archive/cache; stale results and failed
  appends leave orphan Segments that GC removes only after a reachability-root
  snapshot, while every reachable predecessor survives;
- crash/fault injection at every durability boundary is RED then GREEN: before
  immutable blobs, after each immutable blob, after pending-Prepared journal
  registration, before source CAS, after CAS read, after every manifest/root/
  journal/Combat-ledger request inside the final transaction, after transaction
  completion but before in-memory adoption, after in-memory adoption and before
  Presentation publication;
- every pre-commit/aborted crash recovers the source manifest with no Combat
  debit/event; every post-commit crash recovers the destination and the same
  exactly-once Combat ledger entry; a pending record remains a GC root until
  reconciliation and can never be collected mid-commit;
- bundle export/import is streaming and bounded, resolves all reachable
  Segments exactly once and reconstructs the same archive/result hashes;
- Surface count/root summaries and resident/page traversal reconstruct the
  complete 1/8/9/64/256/1,024 logical registry exactly once, independent of
  page size, without an eight-item validator cap;
- adaptive collider exact/coarse coverage and large coordinates;
- mutable-registry attack and predecessor-branch rejection;
- spatial-query continuation completeness;
- island 1/8/64/256/1,024 fairness and no-loss;
- contact 256/257 changes from fatal rejection to continuation;
- motion 4/5+ changes from fatal rejection to continuation;
- failed result leaves Combat, Energy, Authority, Collision, Registry and
  Presentation byte/reference-stable;
- deterministic repeated runs and worker completion reorder;
- enumeration publishes only
  `Unavailable { stage: Enumerating, completedEnumerationUnits }`, with no
  determinate bar, denominator or percentage; after the exact total and graph
  hash freeze, real progress is monotone `0 <= completed <= total` and reaches
  `100%` only after all declared work completes;
- V1 and V2 namespace/profile selection occurs before world open; failed
  migration leaves V1 current, committed V2 cannot reopen through V1, and async
  becomes the default only after the complete V3.4 gate;
- the Adaptive journal still rejects/continues according to its separately
  existing 4,096-record contract; no test may present it as migrated by V3.4.

Performance gates on Node 22 and installed Chrome:

- click to immediate preparing feedback p95 `<=50 ms`;
- worker authority result p95 `<=150 ms` for the stock Tree fixtures;
- click to visible adopted result p95 `<=250 ms`;
- Main validation/commit p95 `<=4 ms`, max `<=8 ms`;
- Evidence head append/store-receipt validation plus atomic Main adoption at
  receipt 10,000 is included in that same `<=8 ms` maximum and may not scan
  prior Segments;
- no main long task `>100 ms`, target none `>50 ms`;
- frame p50/p95/p99 `<=16.7/22/33.3 ms` in the accepted test profile;
- zero stale/cancelled result adoption;
- no monotonically growing transferred bytes or retained worker replica chain.

### Phase 7 — Real browser playtest

Use the normal route, installed Chrome, real Pointer Lock, mouse clicks and
keyboard input. `window.TestBridge` must be `undefined`.

This phase introduces one explicit versioned stress path because no seedable
normal-route fixture hook exists today:

- product fixture owner:
  `surface-play/fixtures/hestiaStructuralStressProfileV1.ts`;
- new launch-selection owners: `vite.config.ts`, `src/vite-env.d.ts` and
  `surface-play/surfacePlayConfig.ts`, which validate the two allowed launch
  values and expose no query or browser-global selector;
- isolated browser-launch owner:
  `tests/e2e/configs/hestia-v3.4-structural-stress.playwright.config.ts`,
  following the existing deterministic single-worker config pattern and using
  a dedicated strict-port server rather than reusing an already-running page;
- launch profile:
  `WELTRAUM_SURFACE_PLAY_PROFILE=hestia-structural-stress-v1`;
- pinned seed:
  `WELTRAUM_SURFACE_PLAY_SEED=hestia-v3.4-stress-seed-001`;
- strict URL only: `http://127.0.0.1:5234/?surfacePlay=1`, with no additional
  fixture, lab or bridge query key;
- E2E owner: new `tests/e2e/hestia-v3.4-structural-stress.spec.ts`, reusing
  `tests/e2e/support/surfacePlayDriver.ts` only for real Playwright mouse,
  keyboard, Pointer Lock, DOM and browser-performance reads; and
- canonical real-input transcripts:
  `tests/e2e/fixtures/hestia-structural-stress-v1/real-input-64.json`,
  `real-input-256.json` and `real-input-1024.json`.

The profile creates a deterministic, versioned Structural stress object within
normal walking/aiming range of the pinned spawn. Each transcript records only
real key holds, mouse deltas/clicks and expected canonical hit/revision
milestones; it cannot inject commands, authority, bodies or runtime state.
Changing fixture version, seed or a canonical hit sequence invalidates prior
performance evidence and requires a new named fixture version.

Each run writes exact evidence filenames beneath
`apps/weltraum-browser/evidence/playwright-output/hestia-v3.4-structural-stress-v1/`:

- `pieces-64-commands.json`, `pieces-64-result.json` and
  `pieces-64-{before,preparing,applied,falling,resting}.png`;
- the same `pieces-256-*` names; and
- the same `pieces-1024-*` names.

Every result JSON binds launch profile/seed, transcript hash, input receipt,
source/result Structural revisions and hashes, complete registry root/count,
progress graph hash, worker/queue/Main timing and Console/Page/Request errors.
The strict route and driver must prove both
`Object.prototype.hasOwnProperty.call(window, "TestBridge") === false` and
`"TestBridge" in window === false` before and after each transcript.

Play matrix:

1. target shot and terrain shot remain responsive;
2. attached Tree repeated local cuts, including the former complex-cut
   sequence;
3. detach and visible fall with F1 open;
4. cross the former eighth/ninth-piece boundary, then execute the pinned
   real-input transcripts for 64, 256 and 1,024 logical pieces and move,
   ray-target and wake representative near/sleeping/far pieces;
5. verify no fixed-cap message, physics stop, pointer release or HMR reload;
6. verify real preparation progress and collect queue/worker/main timings;
7. capture before, preparing, applied, falling and resting screenshots plus
   JSON evidence bound to the same revisions/hashes.

Any auto-reload, source change during the run, console/page/request failure,
stale adoption or typed integrity failure invalidates the run.

### Phase 8 — Independent verification and manual user acceptance

Run focused Units, full Unit suite, TypeScript, production build, E2E inventory,
scoped contract diff, forbidden-import/global scans and `git diff --check`.
Obtain an independent correctness/performance review. Then keep the verified
browser state open for the user's manual playtest. No task closure, final
Plannotator review, commit or push occurs before that manual acceptance.

## Tests and evidence commands

Run from `apps/weltraum-browser` with the exact Node 22 binary:

```powershell
$node22 = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node22-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe'
& $node22 'node_modules/vitest/vitest.mjs' run tests/unit/preparedStructuralFireScheduler.test.ts tests/unit/preparedStructuralFireCodec.test.ts tests/unit/preparedStructuralFireWorkerClient.test.ts tests/unit/structuralMicrovoxelContracts.test.ts tests/unit/structuralMicrovoxelDetachedTransfer.test.ts tests/unit/structuralMicrovoxelEvidenceArchive.test.ts tests/unit/structuralMicrovoxelEvidenceMigration.test.ts tests/unit/structuralMicrovoxelPersistence.test.ts tests/unit/structuralMutationCommitRepository.test.ts tests/unit/surfacePlayContracts.test.ts tests/unit/surfaceRigidBody.test.ts tests/unit/surfaceRigidBodyBulkImport.test.ts tests/unit/surfaceRigidBodyRegistry.test.ts tests/unit/surfaceRigidBodySpatialIndex.test.ts tests/unit/surfaceRigidBodyResidencyIndex.test.ts tests/unit/surfaceRigidBodyIslandScheduler.test.ts tests/unit/surfaceRigidBodyWorld.test.ts tests/unit/surfaceTreeStockCutProgression.test.ts tests/unit/surfacePlayRuntimeIntegration.test.ts --maxWorkers=1
if ($LASTEXITCODE -ne 0) { throw 'Focused V3.4 Unit gate failed.' }
& $node22 'node_modules/typescript/bin/tsc' -p tsconfig.json --noEmit
if ($LASTEXITCODE -ne 0) { throw 'V3.4 TypeScript gate failed.' }
& $node22 'node_modules/vite/bin/vite.js' build
if ($LASTEXITCODE -ne 0) { throw 'V3.4 production build failed.' }
& $node22 'node_modules/vitest/vitest.mjs' run --maxWorkers=1
if ($LASTEXITCODE -ne 0) { throw 'Full Unit gate failed.' }
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:WELTRAUM_SURFACE_PLAY_PROFILE = 'hestia-structural-stress-v1'
$env:WELTRAUM_SURFACE_PLAY_SEED = 'hestia-v3.4-stress-seed-001'
$playwright = '.\node_modules\@playwright\test\cli.js'
& $node22 $playwright test --config .\tests\e2e\configs\hestia-v3.4-structural-stress.playwright.config.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw 'V3.4 strict-route stress gate failed.' }
```

Browser evidence uses `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` set to installed
Chrome and stores new outputs under
`apps/weltraum-browser/evidence/playwright-output/`; no output uses `C:\tmp`.

## Risks

- Async preparation can make click order or Combat cost timing ambiguous unless
  pending state and adoption tick are pinned.
- A worker replica can diverge after stale/rejected results without an explicit
  adoption acknowledgement.
- Treating Structural NoChange as old identity loses an accepted revision and
  lets the next command bind the wrong predecessor.
- Transfer V2 can silently break old worlds if schema dispatch reprojects V1
  bytes through V2 or changes historical evidence/result hashes.
- Count/root summaries can conceal missing or duplicated bodies unless every
  resident/page receipt binds the same complete registry root and total count.
- Calling the current one-record registry/index mutators for a large detach
  would create 1,024 public revisions and a Main long task. V3.4 requires one
  bulk transaction, bounded unpublished root construction and one revision per
  affected domain.
- Evidence Archive adoption before a durable, hash-matching store receipt can
  publish an object whose reachable history is missing after restart.
- Separate durable writes for manifest, roots and Combat ledger can recover a
  half-accepted Fire. The final source CAS, destination manifest, three roots,
  journal outcome and Combat ledger must share one IndexedDB transaction, and
  in-memory publication must wait for its completion.
- Letting migration Origin bind the resulting head/archive while the archive
  binds Origin creates a hash cycle. Origin may bind only legacy input facts;
  the archive manifest alone binds the forward Segment chain.
- Exact command-ID hydration can make cold objects temporarily unavailable;
  bypassing `Preparing` would permit old duplicates, while doing the full scan
  synchronously would recreate a long task.
- Incorrect V1 semantic-content migration can preserve revision numbers while
  silently changing authority meaning or hashes; incompatibility must stop.
- Reachability-GC mistakes can destroy audit history. Reachable predecessors
  are never evicted by age, count or size.
- Adaptive Terrain edit history still has its separate 4,096-record journal
  boundary; V3.4 must not overstate its Structural-only migration.
- Full-object transfer or Main revalidation can move rather than remove the
  long task.
- Spatial overlap can defeat optimistic BVH complexity; continuation work must
  remain measurable and complete.
- Coarse Physics may create excess candidate contacts; exact narrowphase and
  refinement are mandatory before near interaction/edit acceptance.
- Work continuations can accumulate latency when production exceeds capacity.
  Residency, sleep and far-proxy time accumulation must provide backpressure
  without deleting truth.
- A fake percentage during graph enumeration would repeat the rejected loading
  indicator behavior. Determinate progress is absent until the exact graph
  total is frozen.
- A stress route selected by query key or runtime bridge would not prove the
  strict product path. The versioned profile is selected only at launch, while
  every in-page action remains real mouse/keyboard input on `?surfacePlay=1`.
- Browser workers improve CPU concurrency but do not make Three.js scene or GPU
  uploads worker-safe.
- The dirty worktree contains concurrent changes; every phase must refresh
  status/diff and avoid overwriting unrelated work.

## Rollback / safe stop

- Keep the synchronous V1 implementation in its separate legacy persistence
  namespace/profile for worlds that have not migrated. Select V1 or V2 before
  world open; never hot-toggle a loaded world.
- Until Phase 7, independent verification and the user's manual acceptance
  pass, do not make async V2 the default for new worlds. A failed migration
  leaves the V1 source manifest current and may be retried after correction.
- Once the atomic V2 manifest transaction commits, recovery always resumes the
  V2 destination and exactly-once ledger. Opening that world through V1 is not
  a rollback option.
- Foundations remain private and unused when a later gate is red.
- Worker result failures discard unpublished scratch/results and resync the
  replica; they do not mutate Main authority.
- Registry/spatial/residency scratch roots and island candidates are adopted
  only after predecessor/hash checks and durable commit; failures discard the
  scratch roots without advancing any domain revision.
- If a phase needs an unplanned contract change, fixed gameplay rejection,
  silent approximation, full-object per-shot transfer or Main work over `8 ms`,
  stop and revise this plan before continuing.
- If V1 semantic-content compatibility, Segment-store durability, bounded exact
  hydration or reachability-root safety cannot be proven, stop Phase 5 before
  V2 adoption; retain the read-only V1 decoder/profile only for its unmigrated
  namespace and do not treat it as rollback for a committed V2 manifest.
- Never reset/clean the dirty worktree. Revert only the exact new phase through
  a reviewed patch if explicitly requested.

## Progress log

- [x] Manual evidence proves synchronous Cutter long tasks and recurring fatal
  Physics budget failures.
- [x] User approved async/multithreaded preparation, adaptive Physics and no
  fixed logical piece count as product direction.
- [x] Private worker transport/scheduler foundation created; independent review
  found two remaining P1 gaps in NoChange adoption and retained-root release
  after a synchronous continuation-transfer failure. The bounded correction is
  active.
- [x] Independent review proved Structural NoChange is an accepted
  object-revision/evidence transition, not an empty transport result; the plan
  now pins atomic adoption and next-command predecessor semantics.
- [x] Adaptive collider ladder and its independent B=2/N=192 exact-coverage
  oracle pass independent review.
- [x] Registry/residency/spatial persistent-index correction passes independent
  review, including mixed-mutation and naive-query stress.
- [x] Contact-island scheduler passes independent review with cumulative slice
  budgets, predecessor/result state chaining and 1/8/64/256/1,024 coverage.
- [x] Phase 4 mapping identified fixed caps of eight in Structural Transfer V1,
  Surface detached-transition arrays, Body Sources and dynamic bodies. Private
  chunking alone cannot satisfy V1's complete-set rule.
- [x] Reconciled decision: Phase 4 stays private/contract-neutral; approved
  Phase 5 adds Transfer V2 complete-set commitments, V1 compatibility and
  count/root plus resident/paged Surface projections.
- [x] Evidence-history analysis proved the V1 full-array cap cannot be removed
  by changing a constant. The reconciled Phase 5 migration now defines Object,
  Result, Origin and 64-receipt content-addressed Segment V2, bounded exact
  hydration, V1 migration, streaming persistence and reachability-only GC.
- [x] The separate Adaptive 4,096-record journal boundary is explicitly outside
  the V3.4 Structural tree/body history claim.
- [x] Final plan review gaps are reconciled: versioned 9–1,024 bulk-root import,
  one-revision-per-domain adoption, crash-consistent CAS/journal/root/Combat
  commit, an acyclic Origin/Segment/archive graph, explicit Enumerating
  progress, pre-open V1/V2 namespace selection and a strict-route versioned
  real-input stress profile now have exact owners and RED gates.
- [ ] User sends the exact approval text including Structural Evidence Archive
  V2 before any public Structural, persistence, Surface-contract or live
  Runtime mutation.
- [ ] Phase 1 worker transport correction passes independent review.
- [x] Phase 2 registry/spatial correction passes independent review.
- [x] Phase 3 island/collider correction passes independent review.
- [ ] Phase 4 complete worker preflight and measured progress are green.
- [ ] Phase 5 live Runtime/Combat/HUD adoption is green.
- [ ] Phase 6 fresh technical/performance gates pass.
- [ ] Phase 7 real Chrome playtest passes with screenshots/JSON.
- [ ] Phase 8 independent review and user manual acceptance pass.

## Definition of Done

V3.4 is done only when:

1. the normal live route actually creates and uses the prepared Structural
   worker; F1 no longer reports `ASYNC UNAVAILABLE`;
2. no valid attached cut returns a fixed body/collider/contact/motion budget
   rejection;
3. 1,024 logical pieces are preserved without loss, merge, freeze or a main
   long task, the 8/9 boundary is explicitly green and the architecture has no
   fixed gameplay count;
4. exact Structural/Voxel Authority remains revision/hash-bound while adaptive
   Physics representations remain deterministic and conservative;
5. stale/cancelled results, worker crashes and cleanup are failure-atomic;
6. loading progress is measured, monotonic and truthful;
7. Combat cost/events occur exactly once at atomic adoption;
8. old Transfer V1 persisted bytes/hashes remain readable and byte-identical,
   while all new transfers use V2 and one public revision/evidence transition;
9. Structural Evidence Archive V2 passes 63/64/65, 4,097 and 10,000 receipt
   gates without a total history cap or full-history Main scan, with exact cold
   duplicate detection, durable restart and reachability-safe GC;
10. Evidence Origin/Segment/archive hashing is acyclic and contains no separate
    migration root;
11. 1/8/9/64/256/1,024-body imports advance registry, spatial and residency
    revisions once per Fire and adopt all three persistent roots atomically
    without unbounded Main work;
12. every injected crash boundary recovers either the unchanged source with no
    Combat ledger entry or the complete committed destination with exactly one
    ledger entry; memory is never published before durable completion;
13. unknown graph totals expose only `Enumerating` without a percentage, and a
    determinate bar appears only after the exact total/work-graph hash freezes;
14. legacy V1 is a pre-open namespace/profile for unmigrated worlds, not a
    rollback path for committed V2 worlds, and async V2 becomes default only
    after all acceptance gates;
15. the pinned launch profile/seed and real-input 64/256/1,024 transcripts pass
    on the strict `?surfacePlay=1` route with the declared JSON/screenshot
    evidence and no TestBridge;
16. Unit, TypeScript, build, full suite, real Chrome E2E, screenshots, JSON,
    performance and forbidden-global gates are freshly green;
17. `window.TestBridge` is absent; and
18. the V3.4 unbounded-history claim remains explicitly limited to Structural
    tree/body destruction until a separate Adaptive journal migration is
    approved; and
19. the user manually accepts the live result before async V2 becomes the
    default and before any commit, push, task closure or final Plannotator
    review.
