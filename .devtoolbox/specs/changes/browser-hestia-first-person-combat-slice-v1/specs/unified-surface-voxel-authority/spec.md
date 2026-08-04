# Capability: Unified Adaptive Brick Authority and Terrain/Tree Fracture (Future)

## Status and gate

This is a future capability package, decision-complete only through Phase 2. It does not authorize
production edits now. Implementation starts only after the focused PrepareSeed
Node22 tests and a fresh real-Chrome trace prove worker-start-before-packaging
with no Main long task over 100 ms, Coast/Lush identity and vertical-band
corrections plus R09-R13 scope/host-cap baseline are approved, and the
blocky Coast/Lush world is manually visible and accepted. Existing V1
Terrain/Structural behavior remains the compatibility baseline until adoption.
The first implementation slice is isolated and production-unwired. The
approved revision explicitly adds local hierarchical LOD and dirty-brick
streaming where required by this authority; it does not add planet-scale
streaming, a full SVO rewrite or mandatory WebGPU.

## Approved material-policy binding

The common terrain/tree authority material policy is approved 2026-08-03 in
[`docs/browser-mainline/hestia-unified-surface-material-rules-v1.md`](../../../../../../docs/browser-mainline/hestia-unified-surface-material-rules-v1.md).
Its record SHA-256 is
`900AC600C769C7B0A4312BBD00642230124E842C3C999077141DAB344A531C33` and its
`materialTableVersion` is `hestia.unified-surface-material-rules.v1`. The
record is the authority for the exact V1 density, support-contact capacity,
span, anchor, overload and fracture table. This is a common policy contract
only; no runtime implementation exists yet or is authorized by this document.

## Goal and scope

Use one revisioned Surface-Voxel Authority for procedural terrain, authored
destructible trees and vegetation so cells, material, ordered edits,
provenance, authority ID, revision and content hash define one canonical set.
Support roots/evidence, fracture/components, mass and physics are deterministic
derived products of that revision/hash. Bind every snapshot to an authority ID,
revision and content hash. Keep
the bounded world, existing Adaptive hierarchy and measured representation
budget.

In scope: procedural terrain and authored Tree/vegetation inputs; one immutable
authority snapshot with revision/CAS and content hash; common symmetric
half-even 0.125 m global-quantum SurfaceEditCommand; versioned material classes
for density, support-contact capacity, span, anchors, overload and fracture
policy; deterministic six-neighbor connectivity
and support roots; revision-bound mesh/collision/beam/mass/rigid-body products;
existing `16^3` Adaptive bricks with local hierarchical LOD and dirty-brick
streaming; worker derivation and atomic Main adoption; later
undercut/disconnected/overload fracture into falling rigid bodies.

Out of scope: a global 0.125 m rewrite or dense global leaf volume; planet-scale
streaming, a full SVO rewrite, mandatory WebGPU or persistence; a second
terrain-only/tree-only truth; unapproved public contracts; any
Presentation-authored placement, floating-block correction, hidden teleport or
camera collision; new species, city, swimming or Coast scope expansion; fracture
before Coast/Lush blocky-world acceptance.

## Requirement: one revisioned authority

The system SHALL publish exactly one immutable Surface-Voxel Authority snapshot
per adopted edit. Its canonical fields are cells (including occupancy/density),
material, ordered edits and edit boundary/result, provenance, authority ID,
revision and content hash. Source-layer identity and the derivation/material
table commitments are bound inputs. Support roots/evidence, fracture/components,
mass and physics are deterministic derived products of that revision/hash, not
additional authority fields. Procedural
terrain, authored Tree graphs and vegetation are inputs to this namespace only;
after compilation their graphs/generators cannot independently create collision,
support, material or physics truth.

### Scenario: source-layer compilation

- GIVEN deterministic terrain samples and an authored Tree graph
- WHEN equal identity and source revisions are compiled
- THEN both become canonical cells in one authority namespace
- AND the Tree graph and generator identity are provenance/authoring evidence
  only after compilation
- AND no graph node or generator can create a collision, support, material or
  physics fact outside the authority snapshot.

### Scenario: revision/CAS

- GIVEN authority revision R and a quantized command
- WHEN the command expects R and the source hash
- THEN it applies once and publishes R+1 with one deterministic hash
- AND stale, duplicate or mixed-source commands publish no partial result.

## Requirement: common edit and material semantics

Terrain and trees SHALL use the same command quantization, CAS, changed-cell
ordering, revision and stale-refusal semantics. Each V1 material class SHALL
bind the finite, versioned density, support-contact capacity, maximum
unsupported span, anchor eligibility and overload/fracture behavior specified
by the approved `Hestia Unified Surface Material Rules V1` record. Class ID,
table version, values and the material-table content hash are authority
commitments; renderer colors never define material physics. The Phase 3 gate
requires only the current material properties: density, support-contact capacity,
maximum span, explicit anchors, overload policy and fracture policy. Cohesion and
strength are not V1 material properties; with stress, they are explicitly deferred
and are not Phase 3 requirements. Phase 3 is unblocked by the exact
approved-record path and SHA above, but remains open pending implementation and
evidence.

The policy preserves raw registries and uses one mapping for both terrain and
trees: Voxel byte `0` (`SolidRock`) maps to `Rock`; Structural uint16 `0`
(`Air`) remains distinct; Structural uint16 `1`, `2` and `3` are the existing
`Root`, `Wood` and `Canopy` raw IDs and map to their corresponding groups.
Structural IDs are never equated with Voxel IDs. Voxel `WetSoil`/`MossCover`/
`DenseBiologicalSurface` map to `Ground`. `ShallowWaterBoundary` and decorative
sprouts/caps remain non-solid and have no collision, mass, support or fracture
participation. There is no `Sand` group. Water and decorative material cannot
anchor, and no raw registry IDs may be conflated.

The existing `0.125 m` linear cell edge and quantization quantum, with
corresponding cell volume exactly `0.001953125 m^3`, and existing tree densities
remain source facts; Rock and Ground density values are approved gameplay
tuning, not discovered physical truth. A support contact is an orthogonal
frontier contact
from a detached-side component into an anchored/support-connected component,
and its capacity comes from the supporting-side frontier. Anchors and anchor paths are
explicit, revision-bound authority facts; they are not inferred from a mesh,
camera or colour. Support requires an explicit anchor path, component mass `<=`
the sum of its support-contact capacities, and a local lateral/cantilever run
from the latest downward (`-Y`) support `<=` the effective span. For each local
cantilever run, effective span is the minimum approved span among all occupied
and supporting material groups participating in that run. Span is not a whole
AABB or root-to-tip distance.

### Scenario: equal edits

Equivalent quantized commands against terrain and tree cells produce equal
CAS/hash/refusal behavior; only source provenance and material class differ.

### Scenario: material support

Equal geometry with different approved classes produces mass/support outcomes
only from the versioned class table, deterministically across repeats.

## Requirement: support, connectivity and fracture

After an accepted edit the authority SHALL recompute only the affected brick
neighborhood and local deterministic support frontier, connected components,
explicit support anchors and support-contact capacity in canonical (z,y,x)
order using six-neighbor components. Components remain attached only when an
explicit anchor path exists and the component mass, summed supporting-side
capacity and applicable local span condition all hold. The expected revision
and source hash are checked by the same CAS boundary before adoption. An
unsupported or overloaded candidate is a complete fragment body source, or a
typed whole-batch refusal. The staged budgets are 8 dynamic bodies total, 64
colliders per body at admission, and 256 contacts per outer simulation tick at
the solver stage. Adaptive continuation/refinement is attempted before final
typed whole-result refusal where existing policy allows; no partial result is
published. There is no continuous stress solver.

### Scenarios

- Supported components retain the revision-bound mesh/collision projections.
- Removing the last support path creates a complete hash-bound detached fragment
  in the same atomic result; no floating current collision or presentation mesh
  remains.
- Capacity overload creates canonical fragments, or one typed whole-batch refusal;
  partial publication and collider clipping are forbidden.
- Mesh, collision, mass and body state all bind one authority revision/hash;
  CSS/Three.js repositioning and blanket velocity zeroing cannot repair support.

## Requirement: projections and adaptive representation

Mesh, static collision, beam query, mass/COM/inertia and dynamic-body
projections SHALL derive from one complete authority snapshot and carry its
revision/hash. They fail closed when stale. Exact compact boxes, sparse
occupancy or hierarchical/coarse collision MAY be selected per brick or local
contact zone; coarse representation never changes support, material, edit or
hash truth and no global fine-grid rewrite is allowed. Far products are never
gameplay truth. Initial render projection is Three.js WebGL BufferGeometry and
batching. Exact physics uses the existing `32 m` tier and the existing
sleeping/exact `96 m` policy, both bound to the same authority revision/hash.

The authority SHALL reuse `16^3` Adaptive bricks and preserve byte-valid
existing `L0`-`L4` keys and hashes. Their cell sizes remain `L4=.125 m`,
`L3=.25 m`, `L2=.5 m`, `L1=1 m`, and `L0=2 m`. The typical policy is ground
`L2/L3`, rock/fracture/trunk `L4`, and distant products `L1/L0`. There is no
global dense leaf volume. A local `L5=.0625 m` is permitted only as a measured
same-camera A/B experiment for fine vegetation; it is not a production
contract and cannot invalidate existing L0-L4 bytes.

Only uniform `2x2x2` children matching density/occupancy, material, edit
boundary/result, source/provenance and required structural class MAY coalesce,
and only when no edit or fracture boundary is lost. Parent cells/bricks remain
derived. Neighboring levels SHALL differ by at most one. Brick bounds SHALL be
half-open; the coarse face owns a deterministic, blocky 2:1 transition strip,
the fine face is suppressed, and edge/corner ownership SHALL use a lexicographic
tie-break. Neither side may infer the strip from a render mesh. These ownership
and coalescing rules require deterministic byte-for-byte tests.

## Requirement: async worker derivation and atomic adoption

The Main Thread SHALL capture and own the immutable authority snapshot and
quantized command initially, transfer the seed once, and then dispatch
typed-array dirty-brick deltas. Workers SHALL derive support, fracture and
projections only into a private candidate without becoming authority owners.
Source/runtime Phase 3 work SHALL derive one immutable material table with the
exact raw mappings above and approved
`materialTableVersion: hestia.unified-surface-material-rules.v1`, plus its
`materialTableContentHash`, once at the existing canonical value/hashing
boundary. It SHALL reuse the existing canonical owner/`hashAdaptiveCanonical`
hasher and add no duplicate hasher or value normalizer. The material-table version and hash SHALL
be bound into snapshot, command and result commitments. The current adaptive
table version SHALL be bridged through that owner, and Phase 2 parity SHALL be
rerun before adoption.
Every seed, delta and result binds protocol/schema versions, the authority ID,
predecessor/result revision and content hash, authority-derivation-algorithm
version, material-table version/hash, worker epoch and cancellation identity.
Main SHALL reject any mismatch before adoption, validate the commitments and
adopt one complete result atomically to create the next authority, or keep the
prior snapshot unchanged. This is
not fake async: large authority work must not be packaged or re-derived on Main
before the worker starts.

The implementation SHALL reuse the existing `16 MiB` batch, queue and gate
patterns. The first proof SHALL measure actual bytes per dirty brick; it must
not assert `64 KiB` when the current materialized planner estimate is `128
KiB`. SAB/COOP/COEP, OffscreenCanvas, WebGPU and worker-owned authority are
explicitly not required or authorized by this contract.

### Scenarios

- Valid click: action acknowledgement within 100 ms, worker starts before
  packaging and no Main long task exceeds 100 ms.
- New revision, cancellation or worker restart: old result is rejected without
  authority/collision/mesh/physics/presentation mutation.
- Complete matching result: Main publishes exactly one complete snapshot, or a
  typed refusal keeps the previous snapshot unchanged.
- Adoption is p95 `<=4 ms` and hard max `<=8 ms`; authoritative publication is
  p95 `<=250 ms` for the measured route.

## Requirement: migration and compatibility boundary

The current Coast route and adapters SHALL remain active until shadow parity is
proven for identity, vertical band, authority hash, LOD products, render,
collision and physics. The old PreparedFire full-state path is removed last,
after the delta path has passed parity and the route has adopted it. The first
code slice is an isolated, production-unwired authority fixture; no phase may
silently switch the live route.

## Requirement: phase gates and evidence

The proof slices are sequential and each stops on a failed gate:

1. **Spec/baseline:** record the current V1 Terrain/Tree parity, existing
   Adaptive L0-L4 key/hash bytes, PrepareSeed worker-start trace and Coast
   identity/vertical-band/R09-R13 host baseline.
2. **Isolated authority:** compile a deterministic L0-L4 fixture containing
   ground, trunk, vegetation and fracture into one immutable authority with
   identity, ordered provenance, revision and hash; the old non-tree vegetation
   exclusion is pre-Task22 history. No production wiring or Coast visual change.
3. **Deterministic derivation:** prove edit/hash/CAS, support/fracture,
   component/body-source identity and legal parent coalescing; repeat outputs
   byte-identically and reject any lost edit/fracture boundary.
4. **Dirty-brick transfer:** seed once, transfer typed-array dirty-brick deltas
   through the existing queue/gate and `16 MiB` batch, and prove predecessor,
   result, epoch, cancellation and stale rejection without full-state transfer.
5. **Surface-Lab projection:** prove Three.js WebGL BufferGeometry/batching,
   seam and blocky 2:1 transition-strip visuals from the same revision; this is
   render evidence, not gameplay truth.
6. **Physics:** prove exact `32 m` interaction and sleeping/exact `96 m`
   policy products use the same revision/hash, including dirty updates and
   stale refusal.
7. **Coast/tree shadow migration:** keep current adapters and Coast route live,
   compare authority/delta products against the old path, and capture R09-R13
   parity before any cutover.
8. **Cutover/removal:** adopt the delta path only after shadow parity, then
   remove the old PreparedFire full-state path last; retain byte-compatible
   L0-L4 keys/hashes and a rollback-safe prior snapshot.
9. **R09-R13 parity slice:** run the fixed browser viewport/screenshot matrix,
   measured payload/latency/Long-Task gates and final authority/hash parity.

Every slice needs focused regression tests, deterministic replay and a browser
record when user-visible. Stop on source/hash drift, non-finite values,
unapproved public-contract mutation, partial publication or Main long task.

## Acceptance matrix

| Gate | Evidence |
| --- | --- |
| Authority parity | repeated terrain/tree compile: equal cells, revisions, hashes, provenance |
| Edit parity | common command: equal CAS/stale/duplicate behavior |
| Support | supported, undercut, disconnected, overload roots |
| Fracture | complete fragments/body seeds, no hover/clipping, deterministic fall/rest |
| Projection | mesh/collision/beam/mass/body hashes bind one revision |
| Async liveness | click <=100 ms, worker trace before packaging, no Main long task >100 ms |
| Stale safety | cancel/restart/new revision has no visible mutation |
| Coast safety | identity, vertical band, visual and host gates remain green |
| Browser | real Chrome repeated cuts plus supplied undercut reproduction |
| Brick compatibility | Existing L0-L4 keys/hashes remain byte-valid; no global dense leaf volume |
| Coalescing/LOD | Only uniform eligible 2x2x2 children coalesce across all canonical fields/commitments; parent remains derived; half-open seam ownership, fine suppression, lexicographic edge/corner tie-break and deterministic byte tests pass; neighbor delta <=1 |
| Transfer budget | No full-state transfer; existing 16 MiB batch/queues/gates are respected; dirty-brick bytes are measured |
| Responsiveness | action acknowledgement <100 ms; authoritative publication p95 <=250 ms; adoption p95 <=4 ms and max <=8 ms; no Main Long Task >100 ms |
| Optional L5 | Only accepted when same-camera A/B visibly improves R09-R13 parity within a 16 MiB page, 64 MiB retained memory, and at most 64 colliders/body; action acknowledgement <100 ms, publication p95 <=250 ms, no Main Long Task >100 ms; no cost improvement required |

Evidence binds HEAD, source revision/hash, algorithm/material-table versions,
command hash, worker epoch, route and viewport. Screenshots alone cannot close
authority/support/physics/async gates.

## Dependencies and blockers

Reuse existing Terrain Authority, Structural occupancy/connectivity, Surface
Rigid Body Core, Adaptive `L0-L4` keys/hashes, representation ladder, WorkerPool
queues/gates and Hestia world facts; add no duplicate domain model. Known source
areas are `src/voxel/adaptive`, `src/voxel/structural`,
`src/voxel/representation`, `src/workers`, `src/surface-play/workers`,
`src/surface-play/physics`, `src/surface-play/voxel-edit/authority`,
`src/world-generation/hestia`, and the Three.js backend. Task 19 async must be
green in Node22 and Chrome before this capability. Coast/Lush B must resolve
identity, vertical band, R09-R13 scope and host baseline before Coast shadow
migration. Existing Later Task 22 is the first execution task; this capability
is its contract and gates. The exact focused test paths, commands and evidence
matrix are maintained in the companion ExecPlan.
