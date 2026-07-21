# Capability: Browser Structural Microvoxel Destruction Core V1

## Contract boundary

The Structural core is a pure, renderer- and physics-independent authority
bound to Adaptive dependency SHA
`5fb372bdba677e43e71566121c53efb5e244b93a`. It directly imports the public
Adaptive barrel for `MICROVOXEL_BASE_QUANTUM_METERS`,
`ADAPTIVE_BRICK_CELLS_PER_AXIS`, `ADAPTIVE_LEVELS`, Level/quantum/key types,
validation, canonical JSON/hash, deep-freeze, materialization, planning
epoch, resident proofs, and retention. It defines no second Adaptive key,
level, quantum, canonical serializer/hash, or edit journal. No changes under
`apps/weltraum-browser/src/voxel/adaptive/**` are permitted.

The exclusive allowlist is:

```text
.devtoolbox/specs/changes/browser-structural-microvoxel-destruction-core-v1/**
apps/weltraum-browser/src/voxel/structural/**
apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts
apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts
apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1*
docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
apps/weltraum-browser/package.json (only exact test:e2e:core membership)
```

All other paths are forbidden, especially Adaptive Core, `src/voxel/index.ts`,
`main.ts`, styles, workers, streaming, Surface Lab, World Generation,
package-lock/Vite/Playwright files and every other `package.json` change,
`.github/**`, `infra/**`, and foreign agent changes. The E2E spec is assigned
exactly once to the current `test:e2e:core` group.

## Requirement: Binary Level-4 structural model

The Structural model shall use exactly the Adaptive Level-4 key and global
quantum contracts. A brick is exactly `16^3 = 4096` cells with cell edge
`0.125 m`. Occupancy is binary: material `0` is Air and material `1..65535`
is fully occupied. Fractional occupancy and hidden density occupancy are
invalid. A present brick describes all cells; an unlisted local cell is known
Air, while a missing brick is unknown and never implicit Air.

`StructuralMaterialDefinition` shall contain a nonzero Uint16 material ID,
finite positive density, canonical structural class, destructibility, and
explicit `null` or sorted unique canonical tags. A voxel state contains
material, `partId`, `semanticKey`, and `damageKey`; only nonzero states are
sparse-stored. `SetMaterialSphere` and `SetMaterialBox` may modify only
occupied, filter-passing cells and may not create occupancy. Subtract commands
respect destructibility and filters.

`StructuralFrameBinding` shall reuse the Adaptive body/frame/region/generator
IDs and add only integer `objectOriginQuantum`. Every object brick must match
the binding. Object-local shapes shall map to global cells by integer
translation only: no rotation, scale, float transform, or second coordinate
authority.

## Requirement: Immutable object, provenance, hashes, and budgets

`StructuralObject` shall include object ID, frame/Adaptive source binding,
material definitions, canonical sparse brick entries, anchors, joints,
`objectRevision`, `editRevision`, `contentHash`, and persistent command
evidence. Inputs shall be defensively copied; all published objects, arrays,
results, and plain-object projections shall be recursively deep-frozen, with
no mutable Map or TypedArray authority exposed.

Only validated, ready, Level-4 Adaptive materialized bricks with real retained
Descriptor/Journal authority and constructor-issued resident proofs may be
ingested. Descriptor, complete journal, planning epoch, snapshot semantics,
and proofs shall be checked using Adaptive public helpers. The Structural
provenance projection stores the existing descriptor/journal/snapshot/proof
digests and source revisions, but digests cannot replace retained authority.
Adaptive collapse/eviction does not invalidate a defensive Structural snapshot;
reconstruction from Adaptive still requires retained authority. A new Adaptive
revision/epoch requires explicit reconstruction, not silent rebind.

Structural hashes and IDs shall use Adaptive canonical projections and
`hashAdaptiveCanonical`; no second JSON/UTF-8/FNV implementation is allowed.
`contentHash` includes frame/provenance, materials, cell content, anchors, and
joints, but excludes object revision and evidence. `evidenceHash` covers
sorted append-only command evidence and references the actual Adaptive journal
digest; evidence is audit/duplicate material, not an Adaptive edit authority.
All schemas reject unknown fields, unknown versions, missing required fields,
non-finite values, and implicit defaults. All work budgets are explicit,
deterministic count limits; no time-based limit is permitted.

Structural V1 fixes every public array bound before element traversal:

| Array contract | Maximum entries |
| --- | ---: |
| Adaptive proof digests | 4,096 |
| material tags | 256 |
| material filter IDs | 4,096 |
| material definitions and Adaptive material bindings | 4,096 each |
| Structural bricks and occupied cells per brick | 4,096 each |
| Anchors and Joints | 4,096 each |
| command evidence history and changed-brick keys per receipt/result | 4,096 each |
| derived invalidations | 3 |

Arrays must contain only own enumerable indexed data properties plus `length`.
Accessors, extra string or symbol keys, sparse or inherited entries are rejected
without invoking caller behavior, and validation returns a fresh plain Array.
A command presented at the 4,096-entry evidence-history cap is rejected before
duplicate scanning or append; reconstruction, serialization, and hashing use
the same cap. Every Structural hash binding has the unchanged Adaptive form
`fnv1a64-v1:[0-9a-f]{16}`; length is checked before the fixed-format match.
Canonical persistence is limited to exactly 16,777,216 UTF-8 bytes (16 MiB) on
both encode and decode, with the UTF-8 byte check before `JSON.parse`. This
matches the browser core's existing 16 MiB bounded-transfer ceiling while
leaving normal multi-brick Structural fixtures well below the cap.

## Requirement: Exact four-command transaction

`StructuralDestructionCommand` shall be an exact discriminated union of only:

1. `SubtractSphere`;
2. `SubtractBox`;
3. `SetMaterialSphere`;
4. `SetMaterialBox`.

Each command contains command ID, target object ID, expected and resulting
object revisions, the complete expected Adaptive source/revision/epoch/digest
binding, quantized global or object-local shape, optional canonical
material filter, actor, source, exactly one sequence/tick, and explicit work
budgets. Boxes use half-open integer bounds `[min,max)`. Spheres select cell
centers using an exact doubled-integer squared-distance comparison with
overflow rejection and no root or float transform.

Transactions shall validate exact schema/IDs/material/shape/budgets, exact
target/CAS, duplicate ID, canonical selection, complete known-brick coverage,
candidate connectivity/mass, hashes, and freeze before publication. The
resulting revision shall equal expected revision plus one. A selected missing
or unknown brick, stale proof, wrong epoch, invalid material, overflow, or
budget excess shall fail closed with no clipping, retry, default, partial
write, or missing-as-Air fallback.

`Applied` increments object and edit revisions, changes content hash, and
adds evidence. `NoChange` consumes the command ID, increments object revision
exactly once, leaves edit revision and voxel content hash unchanged, and adds
evidence. `Rejected` leaves state, revisions, hashes, and evidence exactly
unchanged. No command may partially update bricks, joints, anchors, evidence,
components, or derived outputs.

## Requirement: Connectivity and persistent metadata

Components shall use only six axis-aligned neighbors. Joints are persistent
metadata and never graph edges. Anchor/Joint endpoints remain persisted when
their cells are Air, are inactive in that state, and reactivate deterministically
when the endpoint becomes occupied. A component is anchored iff an occupied
cell has an active anchor endpoint; otherwise it is detached.

Traversal and inputs shall be canonical-sorted. Component content hashes bind
sorted global occupied-cell keys with material/part/semantic/damage and active
anchor/joint facts. `StructuralComponentId` shall be the Adaptive canonical
hash of object ID, object revision, Structural content hash, complete Adaptive
authority digest, smallest canonical occupied-cell key, and component content
hash. Detached components shall publish versioned `StructuralFragment` records
with deterministic IDs bound to component identity, revision, authority, and
fragment content. Anchor/Joint facts shall be indexed once under an explicit
named cap; cell traversal and component count use separate explicit caps.
Array/traversal order is not identity. A-B-A means rehydrating the same
persisted A revision; a later equal geometry with a new revision may have new
IDs.

## Requirement: Mass, COM, and full inertia

For each occupied cell, mass shall be
`densityKgPerCubicMeter * MICROVOXEL_BASE_QUANTUM_METERS^3`. Canonical
two-pass calculation shall compute total mass/COM and then the full symmetric
tensor about COM. Cube diagonal terms are `m * side^2 / 6`; the complete
parallel-axis theorem shall include signed `xy`, `xz`, and `yz` terms. Mass
properties shall include total mass, nullable COM and AABB, six independent
tensor values, occupied count, source revision, and content hash. Component
mass shall rederive and exactly validate canonical component identity,
membership, content, revision, object, and Adaptive authority before use. Empty state
is zero mass, null COM/AABB, zero tensor, and zero cells. NaN, Infinity,
negative mass, non-finite tensor, asymmetry, or COM outside the AABB fails
closed. Object address collection shall check `maxVisitedCells` before the
next cell access. A caller-supplied Component shall be projected through exact
descriptor-safe records before canonical comparison: `occupiedCells` is
bounded by `maxConnectivityCells`, active facts by
`maxConnectivityFacts`, and the mass address list by `maxVisitedCells`.
Mass is never derived from mesh output.

## Requirement: Fail-closed greedy mesh

The mesher shall use six directional masks and deterministic axis/slice/row/
column order. It shall merge only equal material, face-normal, part,
semantic, and damage keys and shall never emit internal faces. A brick-edge
face requires an explicitly present neighbor brick, even if empty; a missing
neighbor returns typed `MissingNeighborCoverage` and no mesh product.
Explicit `maxVisitedCells`, `maxQuads`, `maxVertices`, and `maxIndices` limits
shall reject without partial arrays. The frozen mesh is a plain-number-array
product with canonical material ranges, bounds, content hash, source revision,
source content hash, and fixed algorithm version. Positions are integer
quantum-derived object-local metres and normals are exact axis normals.

## Requirement: Persistence and no migration

Versioned Structural Object, Brick, Command, Result, Component-ID, mass, and
mesh contracts shall serialize through Adaptive canonical JSON. Rehydration
shall revalidate IDs, versions, keys, revisions, hashes, materials,
provenance, evidence, and deep-freeze invariants. Persistence may retain
command evidence but shall not become a second Adaptive edit journal or issue
proofs. There is no existing Structural persistence and therefore no database,
savegame, or in-place migration. No V1 compatibility adapter or loose V2
reader is allowed; a future V2 migrator requires a separate approved change.

## Scenarios

### Scenario 1: Single cell exposes six faces

Given one occupied cell with explicit empty neighbor-brick coverage on all six
sides, when the greedy mesher runs within explicit budgets, then exactly six
outer faces are emitted and no inner face is emitted.

### Scenario 2: Equal neighbors merge into a cuboid

Given two adjacent cells with identical material and metadata, when meshed,
then compatible coplanar faces merge deterministically into the expected
quads and the result is frozen.

### Scenario 3: Material boundary prevents merge

Given adjacent cells with different material IDs, when meshed, then the
material boundary prevents a merge and material ranges remain canonical.

### Scenario 4: Missing brick-edge neighbor fails closed

Given a face at a brick boundary and no explicit neighbor brick, when meshed,
then typed `MissingNeighborCoverage` is returned and no partial mesh product
is published.

### Scenario 5: Sphere subtract selects exact cells

Given a valid occupied fixture and a global `SubtractSphere`, when applied,
then exact doubled-integer center inclusion removes the deterministic expected
cells and no others.

### Scenario 6: Half-open box subtract is deterministic

Given a valid `SubtractBox` with integer `[min,max)` bounds, when applied,
then only cells in that half-open set are considered and repeated equal input
produces equal result hashes.

### Scenario 7: CAS conflict is side-effect free

Given a stale expected object revision, when any command is submitted, then it
is rejected with state and evidence unchanged.

### Scenario 8: No-op consumes ID and only object revision advances

Given a valid command whose filter/shape affects no cell, when applied, then
status is `NoChange`, the command ID is consumed, object revision advances by
one, edit revision and content hash remain equal, and evidence is appended.

### Scenario 9: Destruction splits Components

Given a connected structure with a narrow neck, when a valid subtract removes
the neck, then expected Components are produced using only six neighbors.

### Scenario 10: Anchored and detached states are correct

Given occupied and unoccupied anchor endpoints, when connectivity is derived,
then active anchors classify Components as anchored and absent active anchors
classify them as detached.

### Scenario 11: Input order does not change Component IDs

Given the same object facts in different input/traversal order, when derived,
then canonical sorting yields identical Component IDs.

### Scenario 12: Equal command sequence yields equal hashes

Given equal object and command inputs, when applied repeatedly, then content,
evidence, and result hashes are equal and timestamp-free.

### Scenario 13: Removed mass equals mass difference

Given valid material densities and a subtract command, when mass is computed,
then removed mass equals the before/after total mass difference.

### Scenario 14: COM is inside each Component AABB

Given a nonempty Component, when mass properties are derived, then finite COM
lies within that Component's AABB.

### Scenario 15: Tensor is finite, symmetric, and analytical

Given one or more occupied cells with known density, when inertia is derived,
then all six values are finite and match the analytical cube plus
parallel-axis reference.

### Scenario 16: Caller inputs remain unchanged

Given mutable caller inputs for construction, ingest, command, or derivation,
when the operation completes or rejects, then the caller-owned values are
unchanged.

### Scenario 17: Results are recursively frozen

Given any accepted object, result, evidence, component, mass, or mesh, when
published, then recursive mutation attempts fail or have no effect.

### Scenario 18: Adaptive contracts are directly reused

Given the Structural source and contract tests, when imports and Level-4
fixtures are inspected, then Adaptive quantum, 16-cubed brick, key,
canonical/hash, validation, freeze, and proof contracts are used directly.

### Scenario 19: No runtime or nondeterministic dependency exists

Given the Structural source, tests, and browser proof, when forbidden API scans
run, then there are no Three.js, renderer, physics, runtime wiring, workers,
`Date.now`, `new Date`, `Math.random`, `performance.now`, or `crypto.random`
authority dependencies.

### Scenario 20: Command and mesh budgets fail closed

Given a command or mesher whose explicit count budget is insufficient, when it
is evaluated, then it rejects with no partial state, result, or mesh product.

### Scenario 21: A-B-A rehydration preserves the same revision

Given stored Structural revision A, an independent B derivation, and the
stored A snapshot, when A is rehydrated, then A IDs/hashes reproduce exactly;
this is not an implicit revision rollback.

### Scenario 22: Evidence is not a second Adaptive authority

Given persistent command evidence and the actual Adaptive descriptor/journal,
when persistence or rehydration runs, then evidence remains audit/duplicate
material bound to the real journal digest and cannot replace, reorder,
compact, or issue Adaptive authority/proofs.

## Additional regression scenarios

Negative quantum coordinates; shapes crossing multiple present bricks; missing
brick coverage; invalid material ID/density; non-destructible filters; duplicate
after `NoChange`; Air endpoint deactivating and reactivating an Anchor/Joint;
Joints not connecting Components; stale/foreign proof; wrong Planning Epoch;
fractional occupancy; unknown schema version; empty object state; arithmetic
overflow; `SetMaterial` on Air producing `NoChange`; revision-driven new
Component IDs after `NoChange`; and material/part/semantic/damage merge
boundaries shall all be covered by focused tests.

## Acceptance boundary

The browser proof loads `/`, dynamically imports the pure Structural barrel,
proves the deterministic fixture and writes timestamp-free evidence. It must
assert browser health `console/page/request/http = 0/0/0/0` and absence of
`window.TestBridge` as both an own property and an `in` property. It proves
only browser execution of the pure core; it makes no renderer, runtime,
physics, gameplay, or product-integration claim.
