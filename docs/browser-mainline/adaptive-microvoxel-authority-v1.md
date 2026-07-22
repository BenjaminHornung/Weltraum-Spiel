# Browser Adaptive Microvoxel Authority V1

This is the first-publish V1 contract reconstructed as the Adaptive stage of
`feature/browser-structural-microvoxel-destruction-core-v1-continuation`.
Current Main is `f6d3fe69175b168ddea5e385c6d7b3452e6cba16`; the source baseline is
`4c1449e2bb0486fe59ee6b68da495c27abee21b5`, the source head is
`5fb372bdba677e43e71566121c53efb5e244b93a`, and only
`4c1449e2bb0486fe59ee6b68da495c27abee21b5..5fb372bdba677e43e71566121c53efb5e244b93a`
is reconstructed. The old head is not a merge target or complete tree overlay.
This document defines the intended boundary; historical proof or evidence is
not current Continuation verification.

## Scope and authority boundary

This document defines the renderer-independent authority foundation for an
adaptive microvoxel field in the Browser codebase. The
authority is the combination of stable spatial identity, a deterministic base
field, an ordered immutable edit journal, deterministic materialization, and
the planner/residency contracts described below.

The implementation is isolated under
`apps/weltraum-browser/src/voxel/adaptive`. It does not make Three.js, a
renderer, CSS, HUD, worker, streaming system, flight system, navigation,
persistence, or gameplay authoritative. A rendered object or operational
request is never a substitute for the contracts in this document.

Surface-Lab-/Voxel-Authority und Adaptive-Microvoxel-Authority
sind getrennte Domänen.

Keine von beiden darf ohne späteren Adaptervertrag
gleichzeitig World-Truth publizieren.

The Adaptive core produces pure results only. It does not add runtime wiring,
replace Surface Lab, treat renderer meshes as truth, mutate an existing
voxel-state owner, or publish product World-Truth.

Implemented and deferred work are deliberately separated. This is a contract
and foundation, not a claim that the Browser product has a voxel terrain
runtime or a global dense world.

## Stable spatial contract

The authority has one fixed base quantum:

- `MICROVOXEL_BASE_QUANTUM_METERS = 0.125` metres.
- Levels are exactly `0`, `1`, `2`, `3`, and `4`.
- Every brick contains exactly `16 * 16 * 16 = 4,096` cells.
- Level `L` cell size is `2^(4-L)` base quanta, or
  `0.125 * 2^(4-L)` metres.
- A level `L` brick spans `16 * 2^(4-L)` base quanta on every axis, or
  `2 * 2^(4-L)` metres.
- Brick bounds are integer, aligned, half-open bounds: `[min, max)`.

The complete level table is:

| Level `L` | Cell size (base quanta) | Cell size (metres) | Brick span (base quanta) | Brick extent (metres) |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 16 | 2 | 256 | 32 |
| 1 | 8 | 1 | 128 | 16 |
| 2 | 4 | 0.5 | 64 | 8 |
| 3 | 2 | 0.25 | 32 | 4 |
| 4 | 1 | 0.125 | 16 | 2 |

The alignment span is exactly `16 * 2^(4-L)` base quanta. A brick origin
must be a safe `Number` integer multiple of that span on each axis. Global
coordinates are base-quantum integer coordinates; negative coordinates use
mathematical floor-to-multiple behavior. A key is accepted only when its
candidate origin, every ancestor origin, and every ancestor exclusive maximum
remain safe integers through L0. The validation boundary rejects an unsafe
domain; it never clamps, wraps, coerces, or substitutes a wider coordinate
representation. Coordinate, key, gameplay, sphere, and materialization
geometry values are never represented as `BigInt`; bounded safe `number`
arithmetic rejects unsafe intermediates. Internal `BigInt` use is allowed only
inside the unchanged FNV-1a64/canonical hashing implementation. That allowance
does not widen the coordinate domain or change hash semantics. The maximum
bound is excluded, so a coordinate on one brick's maximum
belongs to the adjacent brick, not to both.

The hierarchy is integer and spatially complete:

- A level-`L` brick for `L > 0` has one parent at `L - 1`.
- A non-leaf brick has exactly eight children at `L + 1`.
- The eight child bounds partition the parent bounds exactly, without overlap
  or gaps.
- Level `0` has no parent; level `4` has no children.

The public coordinate contracts are `AdaptiveBrickKey`,
`AdaptiveBrickCoordinate`, `QuantumPoint`, `QuantumBounds`,
`QuantumSphere`, `AdaptiveLevel`, and the functions
`createAdaptiveBrickKey`, `validateAdaptiveBrickKey`,
`keyFromGlobalQuantum`, `quantumBoundsForKey`, `meterBoundsForKey`,
`containsQuantumCoordinate`, `parentOf`, `childrenOf`, and `ancestorsOf`.

## Identity and metadata split

`AdaptiveBrickKey` is the stable spatial/content identity. Its exact fields
are:

```text
schemaVersion
bodyId
surfaceFrameId
regionId
generatorVersion
level
originQuantum { x, y, z }
```

`bodyId`, `surfaceFrameId`, `regionId`, and `generatorVersion` are stable
authority IDs. `level` and `originQuantum` identify the aligned hierarchy
location. The schema version is part of the canonical key contract.

Operational metadata is intentionally outside the key and its identity hash.
Examples include request IDs, worker epochs, renderer/cache state, camera
state, telemetry, timing, load order, and cancellation bookkeeping. Such
metadata may describe a request or resident product, but cannot change which
brick is authoritative.

The other named identity/revision contracts are `StableAuthorityId`,
`AdaptiveRegionId`, `AdaptiveEditId`, `AuthorityRevision`,
`AdaptiveBrickRevision`, `AdaptiveEditRevision`, and
`AdaptivePlanningEpoch`. Stable IDs are non-empty, trimmed strings with a
maximum length of 256 characters. Revisions, sequences, planning epochs, and
coordinates are safe integers; edit sequences start at one.

## Base Field and ordered immutable journal

### Base Field

`AdaptiveBaseFieldDescriptor` is the authority for unedited content. V1 is a
closed, immutable `constant-v1` descriptor with exactly this shape:

```text
identity
version
sourceRevision
sample { density, occupancy, materialId, semanticId? }
```

The descriptor and sample are deeply frozen at construction/validation. The
sample contains finite `density` and `occupancy` values, with occupancy in
`[0, 1]`, plus a material ID or `null` and an optional semantic ID or `null`.
Missing, unsupported, malformed, executable, or non-finite base-field content
is rejected. There is no callable provider, registry form, alternate
descriptor compatibility, or second base-field provider in V1. The
implementation never infers air or an implicit base field.

### Edit journal

`AdaptiveEditRecord` is immutable and carries schema version, edit ID,
sequence, expected and result region revisions, actor ID, source ID, one
operation, and only the shape/assignments valid for that operation.

The supported edit operations are exactly:

1. `SubtractSphere` - positive-radius integer-quantum sphere.
2. `AddSphere` - positive-radius integer-quantum sphere.
3. `SubtractBox` - non-empty half-open quantum bounds.
4. `AddBox` - non-empty half-open quantum bounds.
5. `SetMaterialBox` - non-empty half-open quantum bounds and a required
   material ID.

Sphere edits contain `center` and `radiusQuantum`; box edits contain `min` and
`max`. Subtract edits cannot carry material or semantic assignments. Optional
fields cannot be present with `undefined` values.

`AdaptiveEditJournal` is created and validated by
`createAdaptiveEditJournal`, `appendAdaptiveEdit`, and
`validateAdaptiveEditJournal`. Journal rules are:

- records are ordered by declared sequence, then canonical tie breaking is
  applied while constructing the immutable snapshot;
- sequences are unique and contiguous from one;
- edit IDs are unique;
- each record's expected region revision must equal the preceding revision;
- each result revision advances exactly once;
- the schema, final revision, and digest must match the records;
- the complete record set remains available; no lossy compaction or implicit
  edit is introduced;
- a named finite record cap is checked before copy, sort, hash, or
  materialization; over-cap input fails closed without mutation or partial
  output. Its concrete value is selected and reviewed during implementation.

Materialization applies each validated record once, in that canonical sequence,
over the Base Field sample. A different edit order is different authority and
therefore may produce different content. A malformed, ambiguous, conflicting,
or tampered journal fails closed before publication.

## Canonical values, hashes, and provenance

The canonical contract is implemented by `canonicalAdaptiveJson`,
`hashAdaptiveCanonical`, and the typed serializers for keys, journals,
materialized bricks, and plans.

Canonical inputs must be plain objects with enumerable data fields, exact
contract fields, dense arrays, finite numbers, valid strings, and no cycles.
Unknown fields, sparse arrays, functions, symbols, bigint values, `undefined`,
exotic object instances, unpaired UTF-16 surrogates, and non-finite numbers
are rejected. Canonical object fields and collections use explicit code-unit
ordering; `localeCompare`, host locale, and ICU behavior cannot affect bytes or
signatures. Canonical numeric `-0` is
serialized as `0`; authority coordinates, levels, revisions, and sequences
also reject negative zero at their typed validation boundary.

The deterministic hash is `fnv1a64-v1` over UTF-8 bytes of the canonical JSON
representation. It is not based on timing, randomness, worker completion
order, cache order, renderer state, or request metadata.

`materializeAdaptiveBrick` produces `MaterializedAdaptiveBrick` with:

- the validated key, level, origin, cell sizes, and cell count;
- dense `density`, `occupancy`, `material`, and `semantic` channels, each of
  exactly 4,096 cells;
- `sourceRevision` and the journal's `editRevision`;
- a deterministic `contentHash`;
- an `AdaptiveBrickProvenance` record.

Cell index order is `x + 16 * (y + 16 * z)`. The content hash covers the
materialization version, key, cell sizes, cell count, all materialized
channels, and source/edit revisions. `validateMaterializedAdaptiveBrick`
recomputes and rejects a mismatch.

Provenance records the complete reconstruction inputs:

```text
schemaVersion
baseFieldIdentity
baseFieldVersion
baseFieldDescriptorDigest
sourceRevision
editRevision
journalDigest
hierarchyKeyHash
materializationVersion
parentProvenanceHash
provenanceHash
```

`provenanceHash` is the canonical hash of those provenance inputs.
`parentProvenanceHash` is deterministic for non-root bricks and binds the
parent key and the same Base Field/journal authority. Thus a repeated
materialization with the same key, Base Field, and journal is byte/hash
identical, while changed authoritative inputs either produce changed
versioned content/provenance or a typed rejection.

All authority values and materialized products are deeply immutable. Consumers
cannot mutate a prior journal, sample, channel, hash, or provenance record.

## Fail-closed behavior

`AdaptiveAuthorityError` carries a typed code and path. The implemented
validation boundary rejects at least these categories before an invalid value
can become authority: `InvalidCanonicalValue`, `InvalidCoordinate`,
`InvalidIdentity`, `InvalidLevel`, `InvalidQuantum`, `InvalidRevision`,
`InvalidBounds`, `InvalidKey`, `InvalidBaseField`,
`InvalidEditJournal`, and `InvalidPlannerInput`.

Planner budget exhaustion is not a partial success. It returns a typed
`AdaptivePlanRejection` with `status: "rejected"`, `code: "BudgetExceeded"`,
the budget kind/required amount/limit, empty plan collections and a stable
plan hash. Invalid input throws the typed authority error. No rejected,
stale, incomplete, cancelled, over-budget, or malformed result is promoted to
settled coverage.

## Multi-request planner

`AdaptiveRefinementRequest` is the request contract. It contains a stable
request ID, an aligned AABB or a positive-radius sphere, target level, reason,
coverage requirement, optional planning deadline, and finite priority.

The complete supported reason set is:

- `Inspection`
- `PlayerProximity`
- `CollisionRequired`
- `ToolInteraction`
- `Explosion`
- `ProjectileImpact`
- `MeteorImpact`
- `StructuralFracture`

`AdaptivePlannerSnapshot` supplies the body/frame/region/generator identity,
planning epoch, resident products, active coverage, all refinement requests,
and the explicit `AdaptivePlannerBudgets`:

```text
maxBricks
maxBytes
maxWork
maxCoverageQuantum
```

Named finite limits also cap resident summaries, active coverage, refinement
requests, and aggregate derived planning work before copying, sorting, hashing,
or enumeration. Over-cap input fails closed without a partial projection or
plan. Concrete values require implementation review and are not guessed here.

All budget values are non-negative safe integers. The planner is deterministic
for equal canonical inputs: requests are deduplicated by stable brick key and
ordered by descending priority, canonical key, and request ID. AABB coverage
must align to the target brick span. Sphere bounds are conservatively rounded
outward to that span.

The hard desired-brick ceiling is `ADAPTIVE_MAX_DESIRED_BRICKS = 4,096`.
The fixed estimates are `ADAPTIVE_BRICK_ESTIMATED_WORK = 4,096` and
`ADAPTIVE_BRICK_ESTIMATED_BYTES = 131,072` per brick. Brick-count, byte, work,
and requested coverage-volume budgets are checked before a plan is returned.
The planner returns no partial plan when any check fails.

### Accepted plan output

`AdaptivePlan` has `status: "accepted"` and returns the complete deterministic
decision, including:

- `desired` / `desiredKeys`: all requested unique target bricks;
- `keep` / `keepKeys`: ready target bricks and active validated fallback
  ancestors;
- `materialize` / `materializeRequests`: target bricks not currently ready;
- `evict` / `evictCandidates`: resident derived products no longer retained;
- `fallback` / `parentFallbackKeys`: explicit ancestor fallback groups and
  their required children/coverage;
- `coverage` and `coverageStatus`: selected/fallback half-open coverage,
  completeness, and uncovered required-key count;
- `reasons` / `deterministicReasons`: stable planner explanations;
- `planHash`: the canonical hash of the accepted decision.

The duplicated names are first-publish mirrored fields, not compatibility
aliases. Each mirrored pair must describe the same immutable collection and
satisfy field equality during construction and validation; V1 provides no
backward compatibility for divergent or omitted spellings. The plan binds
`snapshotProjectionDigest` to the exact non-circular snapshot projection used
to produce it, and `serializeAdaptivePlan` is the canonical plan serializer.

### Readiness, fallback, and atomic replacement

Only a resident product with readiness `"ready"` is eligible for keep or
coverage. `"stale"`, `"invalid"`, `"incomplete"`, and `"cancelled"` products
are isolated from authority and success coverage and remain materialization
candidates where needed.

For a finer request, the planner may use only a ready, validated coarser
ancestor as an explicitly marked `fallback`. The fallback covers the exact
requested intersection. Partial fine results do not mix with the parent
fallback. The parent remains the sole settled coverage for that range until
all required finer results are ready; then the finer selected coverages replace
that exact fallback range atomically. Coverage is integer aligned, half-open,
non-overlapping, and gap-free only when `coverageStatus.complete` is true.
No content is fabricated to close a gap.

### Snapshot-bound proof

The snapshot-bound proof is carried by a resident product with readiness
`"ready"`, not by the accepted plan itself. The exported proof constructors
`createAdaptiveResidentValidationProof` and
`createAdaptiveResidentValidationProofs` issue nominal, readonly proofs, and a
module-local `WeakSet` holds their identity. The exported membership query
`hasAdaptiveResidentValidationProofBrand`, available through the current public
adaptive index for planner verification, can verify membership but cannot issue,
brand, or forge a proof. It is a verification surface, not an authority escape.

The proof and every bound value are deeply frozen. Its exact bindings are
`key`, `contentHash`, `provenanceHash`, `baseFieldDescriptorDigest`,
`journalDigest`, `sourceRevision`, `editRevision`, `brickRevision`,
`planningEpoch`, `snapshotProjectionDigest`, and `proofDigest`. The canonical
snapshot projection excludes proof objects, proof digests, and the
final plan; it includes canonical authority data, resident metadata, active
coverage, refinement requests, and budgets. The projection and proof digest
therefore cannot become circular.

Before granting keep, coverage, or any other authority, the planner verifies
module-local membership, readonly/frozen state, the bound values, and the
digest against the expected snapshot projection. Stale, wrong-snapshot,
copied, forged, or tampered proofs fail closed. This is a nominal in-process
contract for ordinary code paths, not cryptographic integrity and not a
defense against a hostile process with the ability to alter the runtime.

## Retained authority, collapse, and eviction

`AdaptiveAuthorityRetention` retains the validated `AdaptiveBaseFieldDescriptor`
and the complete `AdaptiveEditJournal`. `AdaptiveResidencyRelease` and
`releaseAdaptiveResidency` support `"collapse"` and `"evict"`.

These operations release only derived resident products. They never discard or
rewrite the Base Field, journal, reconstruction identity, provenance inputs,
or journal digest. The release result explicitly reports
`authorityRetained: true`, remaining resident keys, and released keys.
Release is idempotent: releasing an already released key produces no second
release. Re-materializing after collapse or eviction from the retained
authority reproduces the same canonical bytes, content hash, and provenance
hash. Lossy release without retained authority is rejected.

## No global dense world

The 4,096-cell dense arrays belong to one materialized brick only. This
contract does not allocate, require, or imply a dense array for a planet,
region, or global world. Sparse request/residency decisions, aligned brick
identity, explicit fallback, and retained authority are the boundary between
the deterministic field and derived products.

## Browser proof surface

The proof contract is implemented by
`apps/weltraum-browser/tests/e2e/adaptive-microvoxel-authority.spec.ts`.
A fresh Continuation run must execute it twice without retry and regenerate
byte-identical evidence/signatures before any PASS claim is current.
It loads the normal `/` route, verifies that `window.TestBridge` is absent,
and dynamically imports the isolated adaptive module from the browser module
graph. The proof uses deterministic in-memory authority inputs and checks:

1. the browser loads the normal `/` route without a test-bridge query;
2. `window.TestBridge` is absent on that normal route;
3. the isolated adaptive module is imported through the browser module graph;
4. the proof fixture uses deterministic in-memory authority inputs;
5. independent-reference drift vectors agree with the fixed spatial contract;
6. literal contract drift vectors assert the pinned field names and values;
7. deliberate-review drift vectors exercise rejected authority paths;
8. a valid snapshot-bound proof is accepted only for its constructor-issued,
   module-local nominal object;
9. a level-2 parent can be materialized;
10. the level-2 parent can be selected as ready coverage;
11. a level-4 request over that parent is admitted;
12. that request has exactly 64 required level-4 children;
13. with zero ready children, the parent is the explicit fallback;
14. zero ready children do not promote or mix partial fine coverage;
15. with 63 ready children, the parent remains the sole fallback;
16. 63 ready children do not promote or mix the partial fine result;
17. with all 64 ready children, the fallback is removed;
18. all 64 selected child coverages replace that exact fallback range;
19. an A-B-A eviction/rematerialization retains authority, reproduces A's
    byte-identical canonical bytes and hashes, and keeps changed journal B
    distinct;
20. browser console, page, request, and HTTP-error collections remain empty,
    and repeated normal `/` evidence is byte-identical and timestamp-free.

### Pinned drift vectors

The browser proof pins three independent drift-vector classes rather than
deriving every expectation from the implementation under test:

- independent reference vectors calculate the level table, alignment, child
  count, and half-open coverage from fixed reference values;
- literal vectors assert the first-publish field names, mirrored-field equality,
  readiness states, proof bindings, and timestamp-free evidence shape exactly;
- deliberate-review vectors attempt stale, wrong, copied, forged, and tampered
  proofs plus partial fallback promotion and must fail closed.

The normal `/` evidence is serialized without timestamps or other volatile
fields. Equal runs must produce byte-identical evidence; a change in that
evidence is a pinned drift signal, not a tolerated ordering difference.

This is a pure contract proof, not a visual-render proof. It does not grant
the test harness world or renderer authority and does not claim product voxel
integration.

## Implemented versus deferred

### Implemented in this foundation

- fixed quantum, exact five-level table, aligned integer coordinates, half-open
  bounds, 16^3 bricks, and the eight-child hierarchy;
- stable key identity and the operational-metadata separation;
- immutable Base Field and five-operation ordered edit journal;
- canonical validation, deterministic serialization/hash, materialization,
  content validation, and provenance;
- typed fail-closed rejection and error paths;
- multi-request planner with all eight reasons, deterministic outputs,
  explicit fallback, atomic coverage behavior, budgets, and the 4,096 hard
  ceiling;
- retained authority with lossless collapse and eviction;
- closed immutable `constant-v1` Base Field descriptor with its canonical digest
  and evaluator;
- ancestry-closed coordinates whose candidate, ancestor, and exclusive-maximum
  safety is validated through L0;
- snapshot-bound, constructor-issued proof with planner verification of its
  module-local membership, bindings, and digest;
- independent pinned drift vectors covering reference, literal, and deliberate-
  review expectations;
- the 20-obligation browser proof on the normal `/` route;
- deterministic browser proof surface described above.

### Explicitly deferred

The following are not implemented by this foundation and must not be inferred
from it:

- package integration beyond adding the Adaptive E2E spec exactly once to the
  current `test:e2e:core` group; old package files, dependencies, and lockfiles;
- a second Base Field provider kind or a dynamic provider registry;
- cryptographic authenticity, cross-process authenticity, or authenticity
  against a hostile process;
- integration through a product `src/voxel/index` entry point or other shared
  source index;
- application `main`/bootstrap wiring and runtime composition;
- worker integration;
- streaming, chunk IO, production residency, or terrain generation;
- Three.js, renderer, presentation, HUD, CSS, or visual voxel output;
- UI integration;
- gameplay integration, including flight, navigation, collision gameplay,
  persistence, economy, multiplayer, or other product loops;
- Hestia surface-lab integration or behavior changes;
- a global dense world, planet runtime, surface transition, or playable voxel
  terrain.

Any deferred integration requires its own approved contract and change. This
document does not authorize changes to those boundaries. Execution
`bbca9639a41142918a493bee5173de45` owns fresh Adaptive verification and its
separate completion preflight. Adaptive is committed separately; Structural
does not begin before that stop-gate, and no merge to `main` is authorized.
