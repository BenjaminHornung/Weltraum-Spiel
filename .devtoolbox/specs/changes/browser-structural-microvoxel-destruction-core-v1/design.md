# Design: Structural Microvoxel Destruction Core V1

## Change and immutable dependency

`browser-structural-microvoxel-destruction-core-v1` is implemented only from
the approved plan and the published Adaptive Authority dependency:

- source restdiff: `5fb372bdba677e43e71566121c53efb5e244b93a..67daf4f532873214b506967af46dd90d85b45986`;
- separately verified Adaptive integration commit: `9a94edca28bf46e4fb44ff7fee0d0bb89ab642c5`;
- direct public reuse is mandatory through
  `apps/weltraum-browser/src/voxel/adaptive/index.ts`;
- no changes under `apps/weltraum-browser/src/voxel/adaptive/**`;
- inherited Adaptive default-parallel timeout/contention is retained as a
  reported risk, while the controlled serial suite remains the gate.

The exclusive write allowlist is exactly:

```text
.devtoolbox/specs/changes/browser-structural-microvoxel-destruction-core-v1/**
apps/weltraum-browser/src/voxel/structural/**
apps/weltraum-browser/tests/unit/structuralMicrovoxel*.test.ts
apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts
apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1*
docs/browser-mainline/structural-microvoxel-destruction-core-v1.md
apps/weltraum-browser/package.json (only exact test:e2e:core membership)
```

Forbidden paths include every other path, in particular Adaptive Core,
`src/voxel/index.ts`, `main.ts`, styles, workers, streaming, Surface Lab,
World Generation, package-lock/Vite/Playwright configuration and every other
`package.json` change, `.github/**`, `infra/**`, and foreign agent changes.
The Structural E2E is appended exactly once to the current `test:e2e:core`
group without removing or duplicating Main or Adaptive entries.

## Authority separation

The design has five explicit layers. A layer may consume the preceding
contract only through its public boundary and may not promote a derived value
to authority.

### 1. Adaptive source/proof binding

Adaptive is the sole source of spatial identity, Level-4 brick keys, global
quantum coordinates, the `0.125` m base quantum, `16^3` brick semantics,
canonical serialization/hashing, validation, deep-freeze, retained
Descriptor/Journal authority, Planning Epoch, and constructor-issued resident
proofs. Structural ingest accepts only validated, ready, Level-4 materialized
bricks with real retained Adaptive authority. It validates the complete
Descriptor, `AdaptiveEditJournal`, Planning Epoch, snapshot semantics, and
resident proof bindings with Adaptive's public helpers. Digests are bindings,
not proof substitutes. Fractional Adaptive occupancy is rejected; Adaptive
`density` is not Structural density. A new Adaptive revision/epoch requires an
explicit new Structural reconstruction; no silent replan or rebind occurs.

Structural code must import these contracts from the Adaptive barrel rather
than defining another key, level, quantum, canonical encoder, hash, or edit
journal. A defensive Structural snapshot remains its own authority after
Adaptive collapse/eviction, but rehydration from Adaptive requires retained
Descriptor/Journal authority and never reconstructs authority from a mesh or
float transform.

### 2. Structural authority

The Structural model owns an immutable `StructuralObject`, its material table,
sparse Level-4 bricks, binary voxel states, anchors, joints, revisions,
content hash, and persistent command evidence. A valid brick is `16 x 16 x 16`
cells with `0.125` m cells. A present brick enumerates all 4096 local cells;
unlisted local cells are known Air. A missing brick is unknown, never implicit
Air. Only nonzero cells are sparse-stored.

Material `0` is reserved Air and has no definition. Defined materials are
exact Uint16 IDs `1..65535`, finite positive density, canonical structural
class, destructibility, and either `null` or a sorted unique canonical tag
list. A voxel also carries explicit `partId`, `semanticKey`, and `damageKey`
or `null`. `StructuralFrameBinding` carries the Adaptive body/frame/region/
generator IDs and `objectOriginQuantum`; every brick must match the binding.

All inputs are defensively copied. Published objects, arrays, results, and
plain-object projections are recursively deep-frozen; mutable Maps and
TypedArrays never escape as authority. Exact V1 schema/version keys are
validated with no unknown fields, defaults, clamping, coercion, or migration.

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

### 3. Command transaction

The public command union has exactly four kinds:
`SubtractSphere`, `SubtractBox`, `SetMaterialSphere`, and `SetMaterialBox`.
Commands contain the target, command ID, expected/resulting object revisions,
the complete expected Adaptive source/revision/epoch/digest binding,
quantized global or object-local shape, optional canonical material filter,
actor, source, exactly one sequence/tick, and explicit deterministic work
budgets. Boxes use half-open integer Level-4 bounds. Spheres select cell
centers using an exact doubled-integer squared-distance comparison, with
overflow rejection and no root or float transform. Object-local shapes use
only integer translation by `objectOriginQuantum`.

The transaction is ordered: exact schema/ID/material/shape/budget validation;
target and exact CAS (`resultingObjectRevision === expectedObjectRevision +
1`); duplicate-ID rejection against persistent evidence; canonical selection
and complete known-brick coverage/budget check; temporary candidate copies;
synchronous connectivity and mass calculation; then hash, freeze, and
publication. A selected missing or unknown brick fails closed. There is no
clipping, missing-as-Air, retry, partial write, or silent fallback.

`Subtract*` changes only destructible, filter-passing occupied cells to Air.
`SetMaterial*` changes only already occupied, filter-passing cells and accepts
only a defined nonzero target material; it never creates occupancy and
preserves part/semantic/damage metadata. A no-effect operation is valid
`NoChange`.

`Applied` increments both object and edit revisions and changes content hash.
`NoChange` consumes the command ID, increments only object revision, leaves
edit revision and voxel content hash unchanged, and appends evidence. Its
component IDs still change because object revision is part of the ID.
`Rejected` leaves the exact old frozen state, all revisions, hashes, bricks,
components, and evidence unchanged. Every failure is all-or-nothing.

### 4. Connectivity and mass

Connectivity uses only the six axis-aligned neighbors and canonical traversal.
Joints remain persistent metadata and never add graph edges. Anchor and Joint
endpoints remain stored when their cell is Air, but are inactive until that
cell is occupied again. An active anchor makes a component anchored; otherwise
it is detached. Component content hashes bind sorted occupied global cell
keys, material/part/semantic/damage data, and active anchor/joint facts.
`StructuralComponentId` is the Adaptive canonical hash of object ID, object
revision, Structural content hash, complete Adaptive authority digest, the
smallest canonical global occupied-cell key, and component content hash.
Detached components additionally publish versioned, canonically sorted
`StructuralFragment` records whose IDs bind the component, revision, authority,
and fragment content. Anchor and Joint endpoints are indexed once under the
explicit `maxIndexedFacts` cap; cell traversal and component count have their
own named caps. Identity is not traversal- or array-order identity; A-B-A means
rehydrating the same stored A revision, not reversing a monotone revision.

Mass is computed from cells, never from mesh output. Component mass first
rederives the canonical component and rejects mismatched identity, membership,
content, revision, object, or Adaptive authority binding. Each cell has
`density * 0.125^3` kg. A canonical two-pass calculation obtains total mass
and COM, then the full symmetric tensor about COM using cube diagonal
`m * side^2 / 6` and the complete parallel-axis theorem, including signed
`xy`, `xz`, and `yz` terms. Empty state is zero mass, null COM/AABB, zero
tensor, and zero cells. Non-finite, negative, asymmetric, or out-of-bounds
results fail closed. Object-mass address collection checks
`maxVisitedCells` before reading the next cell. Component-mass input is first
projected through exact descriptor-safe records; `occupiedCells` is guarded
by `maxConnectivityCells`, active facts by `maxConnectivityFacts`, and the
derived address list by `maxVisitedCells`, all before element mapping,
sorting, or canonical comparison.

### 5. Derived mesh

The neutral axis-aligned greedy mesher uses six directional masks and a fixed
axis/slice/row/column order. Its merge key is material, normal, part,
semantic, and damage. Inner faces are suppressed. A brick-edge face requires
an explicitly present neighbor brick, even if empty; a missing neighbor
produces typed `MissingNeighborCoverage` and no mesh product. Explicit mesh
budgets (`maxVisitedCells`, `maxQuads`, `maxVertices`, `maxIndices`) reject
without partial output. Mesh output is frozen plain number arrays with
canonical material ranges, bounds, content hash, source revision/content
hash, and fixed algorithm version. Positions derive from integer quantum
vertices in object-local metres; normals are exact axis normals. No Three.js
types or runtime authority are involved.

## Persistence, evidence, and versioning

Structural Object, Result, Command Evidence, Component ID, mass algorithm,
and greedy-mesh algorithm each use explicit exact V1 versions. Canonical
Structural serialization uses Adaptive `canonicalAdaptiveJson`,
`hashAdaptiveCanonical`, and `serializeAdaptiveKey`. Rehydration revalidates
all exact keys, revisions, hashes, material references, Adaptive provenance,
evidence bindings, and freeze invariants.

`contentHash` binds frame/Adaptive provenance, material table, voxel content,
anchors, and joints, but not object revision or command evidence. A separate
timestamp-free `evidenceHash` binds sorted append-only evidence including
command hash, status, old/new revisions, old/new content hashes, changed keys,
and counts. Evidence is operational duplicate/audit material, references the
real Adaptive Journal digest, and can neither replace, compact, reorder, nor
issue Adaptive proof. It is not a second Adaptive edit journal.

There is no existing Structural persistence and therefore no database,
savegame, or in-place migration. V1 has no compatibility adapter or loose
reader. Future V2 data requires a separately approved migrator. Derived mesh
failure never mutates Structural authority, and rejected commands never
mutate state or evidence.

## Failure, rollback, and no-migration semantics

All operations are pure state transitions from the prior frozen object. The
old state remains untouched while validation, CAS, duplicate, coverage,
budget, connectivity, mass, hash, and freeze gates execute. Any gate failure
returns typed rejection with the exact old state and no side effects. A
`NoChange` is the explicitly valid exception to rejection semantics and
creates a new frozen envelope under its specified revision/evidence rules.
Mesh derivation is a separate revision-bound derived step; a missing neighbor
or budget failure yields no partial mesh and does not roll back or alter an
accepted Structural object.

No database/savegame/in-place migration, package integration, runtime wiring,
renderer integration, physics integration, or authority recovery from derived
outputs is part of this design. If a required public Adaptive field or any
other contract is unavailable, implementation stops and reports the exact
field/type/semantics; it does not invent a local replacement.

## Planned file boundaries

The approved slices map to `types.ts`, `validation.ts`, `coordinates.ts`,
`canonical.ts`, `model.ts`, `commands.ts`, `connectivity.ts`,
`massProperties.ts`, `greedyMesher.ts`, `persistence.ts`, and the sole
Structural `index.ts` barrel, plus the six focused unit files, one normal-route
E2E proof, two timestamp-free evidence files, and the public Structural
document. No Structural symbol is re-exported from `src/voxel/index.ts`.
