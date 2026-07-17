# Browser Structural Microvoxel Destruction Core V1

This document publishes the V1 contract for the pure Structural Microvoxel
Destruction Core under `apps/weltraum-browser/src/voxel/structural`. It records
an implemented, deterministic authority foundation and its normal-route browser
proof. It does not claim application-runtime, renderer, or physics wiring.

## Scope and Adaptive authority binding

Structural V1 is a renderer- and physics-independent state-transition core. It
uses the public Adaptive Microvoxel Authority V1 barrel as the sole authority
for Level-4 `AdaptiveBrickKey` values, global quantum coordinates, the
`0.125 m` base quantum, `16^3` brick dimensions, canonical JSON/hashing,
validation, deep-freeze behavior, materialized-source provenance, planning
epochs, resident proofs, and retained Descriptor/Edit-Journal authority.

Structural does not define a second Adaptive key, level ladder, coordinate
system, canonical encoder/hash, edit journal, proof issuer, or base field.
Adaptive command records remain the source-field history. Structural command
evidence is only append-only audit and duplicate-prevention evidence bound to
the real Adaptive journal digest. Reconstructing from Adaptive data requires
validated ready Level-4 bricks, retained Descriptor/Journal authority, and
constructor-issued snapshot-bound proofs; digests alone are not proofs. A new
Adaptive revision or planning epoch requires explicit reconstruction, never a
silent rebind.

## Binary occupancy, materials, and Air

- Every present Structural brick is one Adaptive Level-4 brick with 4,096
  addressable cells and a `0.125 m` cell edge.
- Occupancy is binary. Material `0` is Air and has no material definition;
  material IDs `1..65535` are fully occupied Uint16-compatible cells.
- Sparse storage lists occupied cells only. An unlisted cell in a present brick
  is known Air; a missing brick is unknown and is never treated as Air.
- Fractional occupancy, implicit density occupancy, clamping, and defaults are
  rejected.
- A material definition requires finite positive density, canonical structural
  class, destructibility, and either `null` or sorted unique tags.
- Occupied cells retain explicit material, `partId`, `semanticKey`, and
  `damageKey` values (nullable where specified). `SetMaterial*` changes only
  occupied filter-passing cells and never creates occupancy. `Subtract*`
  respects destructibility and material filters.

All caller inputs are copied. Published objects, arrays, components, mass
properties, command results, evidence, and mesh products are recursively
frozen plain data; mutable Maps and TypedArrays do not escape as authority.

## Frames and integer geometry

`StructuralFrameBinding` reuses Adaptive `bodyId`, `surfaceFrameId`,
`regionId`, and `generatorVersion` and adds only `objectOriginQuantum`. Every
brick and Anchor/Joint endpoint must match that frame. Object-local shapes map
to global cells only by safe-integer translation through that origin. V1 has no
rotation, scale, floating transform, or parallel coordinate authority.

Boxes use half-open integer bounds `[min,max)`. Spheres select cell centers by
exact doubled-integer squared-distance comparison. The implementation uses no
square root or float transform and rejects arithmetic overflow.

## Commands, budgets, and atomicity

The closed command union is exactly `SubtractSphere`, `SubtractBox`,
`SetMaterialSphere`, and `SetMaterialBox`. Every command binds a stable command
ID and target object, expected/resulting object revision, global or object-local
quantized shape, optional sorted material filter, actor, source, exactly one
sequence or tick, and all deterministic count budgets. There are no time-based
budgets or implicit defaults.

Transactions validate schema, target, exact CAS, command-ID uniqueness and
append order, shape/materials, complete known-brick coverage, count budgets,
candidate connectivity, candidate mass, hashes, and recursive freeze before
publication. Work occurs against temporary candidate data. Missing coverage,
overflow, stale authority, invalid contracts, or exhausted budgets reject with
the exact old frozen state and no partial brick, Anchor, Joint, evidence, mass,
component, or mesh write. There is no clipping, retry, missing-as-Air fallback,
or silent replan.

| Status | Revisions and hashes | Published state |
| --- | --- | --- |
| `Applied` | object and edit revisions increment; content/evidence change | complete new frozen state and deterministic invalidations |
| `NoChange` | command ID consumed; object revision increments; edit revision and content hash stay equal; evidence changes | new frozen envelope with no voxel mutation |
| `Rejected` | revisions, hashes, and evidence unchanged | exact prior state |

## Six-neighbor components, Anchors, and Joints

Connectivity uses only the six axis-aligned neighbors in canonical order.
Joints are persistent metadata and never add connectivity edges in V1. Anchor
and Joint endpoints remain stored when their cell becomes Air; such endpoints
are inactive and deterministically reactivate if that cell is occupied again.
A component is anchored exactly when it contains an occupied active Anchor
endpoint; every other component is detached.

Component content hashes bind canonical occupied-cell state plus active
Anchor/Joint facts. A component ID binds object ID, object revision, the
lexicographically smallest occupied-cell key, and component content hash using
Adaptive canonical hashing. Traversal or input-array order is not identity.
A-B-A means rehydrating the same persisted A revision; later equal geometry at
a newer revision may have different component IDs.

## Revisions, content hashes, and evidence

Structural Object, Brick, Frame, Command, Result, Command Evidence, Component,
Component ID, Mass, and Greedy Mesh each have exact V1 schema or algorithm
versions. Unknown keys, versions, non-finite values, invalid references, and
implicit fields fail closed.

`contentHash` binds frame and Adaptive provenance, materials, voxel content,
Anchors, and Joints, but excludes object revision and command evidence. The
separate `evidenceHash` binds sorted append-only Structural command evidence:
command hash/status, prior/result revisions and content hashes, changed brick
keys, selected/changed counts, and the actual Adaptive journal digest. Evidence
contains no time or randomness and cannot replace, compact, reorder, or issue
Adaptive authority.

## Mass properties

Cell mass is
`densityKgPerCubicMeter * MICROVOXEL_BASE_QUANTUM_METERS^3`. A canonical
two-pass calculation derives total mass and center of mass, then the complete
symmetric inertia tensor about COM. The cube diagonal is `m * side^2 / 6`; the
parallel-axis term includes diagonal and signed `xy`, `xz`, and `yz` values.

Mass properties come from occupied cells, never a mesh. They include total
mass, nullable COM and bounds, six independent tensor values, occupied count,
source revision/content hash, algorithm version, and their own content hash.
An empty object has zero mass/count/tensor and null COM/bounds. Nonempty output
requires positive finite mass, finite tensor values, and COM inside its bounds.

## Deterministic greedy mesh

The neutral mesh derivation scans six axis directions and deterministic
slice/row/column order. It merges only faces with equal material, normal,
part, semantic, and damage keys. Occupied-to-occupied internal faces are never
emitted. At a brick boundary the neighboring brick must be explicitly present,
even when empty; otherwise `MissingNeighborCoverage` returns no product.

Explicit `maxVisitedCells`, `maxQuads`, `maxVertices`, and `maxIndices` budgets
are checked before publishing arrays. Success returns frozen plain finite
number arrays, canonical material ranges, bounds, source revision/content hash,
mesh content hash, and the fixed greedy algorithm version. Positions derive
from integer quantum vertices in object-local metres and normals are exact axis
normals. Mesh failure never mutates Structural authority.

## Persistence and normalized failure

Object and command-result serialization uses Adaptive canonical JSON.
Rehydration accepts exact canonical V1 bytes only and revalidates all schemas,
IDs, revisions, keys, frame/provenance bindings, material references, content
and evidence hashes, command results, and freeze invariants. Adaptive authority
errors crossing the Structural boundary are normalized to Structural typed
errors so callers do not receive an accidental mixed authority contract.

There is no existing Structural database or savegame contract, so V1 performs
no database, savegame, or in-place migration and offers no loose compatibility
reader. A future V2 migration requires a separate approved migrator.

## Normal-route browser proof and evidence

`apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts`
loads `/` with the existing Playwright/Vite setup, verifies that `TestBridge`
is absent both as an own property and through the `in` operator, and dynamically
imports the public Structural and Adaptive barrels directly through Vite. It
captures console errors, page errors, failed requests, and HTTP responses
`>=400`; all four counts must be zero before evidence is written.

The deterministic fixture has one occupied Level-4 brick: material `1` at
`512 kg/m^3` (exactly `1 kg` per cell), an anchored `8x8` base at `z=0`, a
one-cell neck at `(8,8,z=1..3)`, and a `3x3x2` upper structure at
`x/y=7..9,z=4..5`. Three adjacent empty bricks provide explicit known-Air mesh
coverage for the occupied brick's negative boundaries. A global center-tested
`SubtractSphere` at `(8,8,2)`, radius `1`, removes only neck cells `z=1,2`.
The result is 83 cells: a 64 kg anchored base and a 19 kg detached upper
component. Repeating identical inputs must preserve component IDs/content
hashes and object content/evidence/result hashes. The proof also checks finite
mass/COM/six-value tensors, COM-in-bounds, finite axis-aligned greedy arrays,
and independently verifies complete exposed-face coverage with no internal
face.

The generated evidence pair is:

- `apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-structural-microvoxel-destruction-v1.md`

Both artifacts have stable field/order/content, no timestamp, `generatedAt`,
duration, randomness, machine path, or screenshot. Equal E2E runs must produce
byte-identical files. This is a non-visual pure-core proof only.

## Integration boundary and non-goals

Implemented here: the public pure Structural core, Adaptive-bound authority,
binary sparse object model, exact commands, atomic status semantics,
six-neighbor component facts, mass properties, deterministic greedy mesh,
canonical V1 persistence, and direct-import browser proof.

Explicitly not implemented or claimed: `main`/bootstrap or runtime composition,
`src/voxel/index.ts` integration, Three.js/renderer/presentation, physics or
collision-runtime ownership, workers, streaming, terrain/world generation,
HUD/UI, gameplay, flight/navigation, persistence storage, database migration,
economy, multiplayer, package scripts, Playwright/Vite configuration, or a
second Adaptive authority. Every future integration requires its own approved
contract and change.
