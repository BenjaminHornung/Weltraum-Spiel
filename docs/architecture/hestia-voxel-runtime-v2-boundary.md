# Hestia Voxel Runtime V2 Boundary

## Status and scope

This is the binding architecture boundary for the isolated query-gated spike
`browser-hestia-voxel-runtime-v2-spike-v1`. It defines one bounded local world,
not a planet streaming framework. The implementation lives under
`apps/weltraum-browser/src/voxel-v2/`; the only integration edit is an exact
dynamic route in `apps/weltraum-browser/src/main.ts`.

## Ownership graph

```text
deterministic worker generation result
                |
                | transferred cells + source revision
                v
        +------------------+
        | VoxelAuthority   |  sole mutable cells, palette, edit order,
        | (main CPU)       |  chunk/world revisions, signatures
        +------------------+
          |       |       |
   copied |       | query | synchronous occupancy
   halo   |       |       +--------------------+
          v       v                            v
   worker greedy  authority DDA          player AABB collision
   mesh product   + ordered cutter       (never renderer mesh)
          |
          | transferred neutral buffers + requested revision
          v
  current-revision adoption gate
          |
          v
  render-three BufferGeometry + static water
  (disposable projection; never truth)
```

Only `VoxelAuthority` mutates canonical cell arrays. Worker, mesher, collision,
DDA, telemetry and renderer products cannot become alternate owners.

## Spatial contract

| Property | V2 value |
|---|---:|
| voxel edge | 0.25 m |
| chunk edge | 32 cells / 8 m |
| world cells | 256 × 128 × 256 |
| world metres | 64 × 32 × 64 |
| candidate chunks | 8 × 4 × 8 |
| global X/Z range | `[-128, 127]` cells |
| global Y range | `[0, 127]` cells |
| material zero | Air |
| halo | one cell on every face (34³ snapshot) |

Signed chunk mapping uses mathematical floor division. For any signed global
cell coordinate `g`, chunk `c = floor(g / 32)` and local
`l = g - c * 32`, where `0 <= l < 32`. String chunk keys encode all three
signed coordinates without aliases.

Coordinates are authority/world logical units. The Three adapter alone scales
cells by 0.25 m and chooses scene/camera values.

## Canonical records

The authority contract owns the conceptual records below; exact TypeScript
syntax may remain minimal.

```text
PaletteRecord
  id, name, baseColor, roughness, emissive, physicalClass, destructible

AuthorityChunk
  key, coord, sourceRevision, authorityRevision,
  private Uint8Array cells, dirtyLocalAabb, contentSignature

AuthoritySnapshot
  key, coord, requestedRevision, copied cells or copied 34^3 halo

SubtractSphereCommand
  editId, sequence, expectedWorldRevision, centerCell, radiusCells

EditResult
  Accepted | NoChange | Duplicate | Stale | Miss | OutOfRange,
  worldRevision, dirty bounds, changed chunks, remesh chunks
```

Palette records and returned chunk metadata are immutable snapshots. Cell
access is through bounded read methods or copies. The byte signature is
FNV-1a-64 over authoritative cell bytes at the authority boundary; no generic
value normalizer or JSON conversion is introduced.

## Revision and ordering rules

1. Generation products carry deterministic source revision and content.
2. Authority adoption creates/updates sparse chunks before derived work starts.
3. Every edit carries unique ID, strictly monotonic sequence and compare-and-
   swap expected world revision.
4. Duplicate ID/sequence or stale expected revision rejects without mutation,
   signature change, dirty bounds or remesh work.
5. An accepted mutating edit increments world revision exactly once and each
   changed chunk authority revision exactly once, then recomputes signatures.
6. Mesh requests carry the exact chunk authority revision represented by their
   copied halo.
7. Scheduler coalescing may discard older queued work. Completed results pass
   scheduler stale gates and a final authority/current-revision adoption gate.
8. A rejected terminal may increment read-only rejection telemetry only; it
   cannot publish geometry or change collision.

## Generation boundary

Generation is a pure function of explicit world version, seed and chunk
coordinate. It composes coast/lagoon, connected river/valley, broad macro
height, terraces, stepped cliffs, strata, clearings, fixed tree templates and
sparse flora. It uses stable integer hashing only for bounded placement
variation. It has no camera, renderer, wall-clock, `Math.random`, load-order,
network or persistence input.

Candidate chunks generate off the main thread. The authority adopts transferred
non-empty cells; empty candidates remain absent. All candidate generation
settles before initial mesh snapshots are created so a halo always represents
complete current neighbours.

Static water has a fixed world-logical sea level used by generation to shape
coast/river banks and by `render-three` to place one transparent plane. Water
does not occupy or mutate authority cells and cannot be cut.

## Mesh product boundary

The greedy mesher is domain code and imports no Three.js type. It consumes only
copied halo bytes, chunk identity/revision and immutable palette metadata. It
emits exposed axis faces with deterministic traversal, winding and typed buffer
layout. Greedy compatibility is the tuple `(axis, direction, materialId,
cornerAoSignature)`. This preserves material bands and AO while eliminating
internal/coplanar work.

Neighbour samples at the 32-cell boundary come from the halo. Missing or wrong-
revision halo data fails closed rather than treating unknown neighbours as air.
Identical request bytes and mesher version produce byte-identical buffers.

Material ranges remain part of the neutral product even when the initial Three
adapter chooses a single vertex-colour draw per chunk. That adapter may derive
colour/roughness/emissive presentation from the palette; the palette is never
derived from renderer materials.

## Worker and queue boundary

V2 owns one module worker and does not import the existing WorkerPool. The
scheduler has a hard bounded queue representation, one running job, latest-
revision replacement for queued equal chunk/operation keys and terminal
disposal. Generation and mesh result buffers use transfer lists.

Read-only telemetry contains current pending/running depth, maximum depth,
coalesced count, stale count, queue-wait samples, generation/meshing samples and
transferred bytes. Telemetry cannot affect priority, revisions or adoption.

No local edit enqueues generation. Remesh set calculation begins with changed
chunks and adds only six-axis neighbours when the dirty AABB touches the
corresponding local boundary.

## Runtime and collision boundary

The controller advances at 60 Hz. A frame processes a bounded number of fixed
steps and retains remaining accumulated time for later frames; backlog is
observable. It never truncates elapsed time silently.

The player's authority-space AABB uses displacement substeps no larger than a
bounded fraction of a voxel to avoid tunnelling. Axis resolution and optional
step-up read only authority occupancy. A velocity component changes to zero
only when the attempted movement proves blocking contact; grounded vertical
rest is likewise based on occupancy. A pending, absent or stale Three mesh has
no collision effect and never pauses the controller.

DDA traverses authority cells from camera origin/direction to a fixed range and
returns the first occupied cell, entered face normal and distance. The cutter
publishes immediate visual/DOM hit feedback before scheduling mesh work, then
submits the ordered CAS command. Terrain, rock and wood use the same authority
path; trees may float because structural connectivity is deliberately absent.

## Three projection boundary

Only files under `apps/weltraum-browser/src/voxel-v2/render-three/**` may import
`three`. The adapter owns scene, renderer, cameras, lights/fog, chunk
BufferGeometry/material instances, hit marker and transparent water resources.
It receives neutral products and immutable palette/diagnostic values.

Renderer adoption requires the product revision to equal the current authority
chunk revision. Replacement disposes prior chunk geometry. Renderer disposal
releases geometry/materials/listeners/context ownership and has no authority
side effect.

One opaque vertex-colour material per chunk keeps draw calls bounded. Static
water uses a separate transparent pass with depth writing disabled and stable
ordering. No voxel is represented by an individual Three object.

## Route and diagnostics boundary

`src/main.ts` checks exact `voxelV2=1` before Surface Lab; V2 absent preserves
the existing Surface Lab/normal branch. V2 precedence for combined exact queries
is explicit. V2 dynamically applies `data-runtime-mode="voxel-v2"`, reuses the
existing canvas and creates/removes only its own prompt, reticle and diagnostics.

Diagnostics are normal read-only DOM text/datasets, not `window.TestBridge`.
They may expose readiness, player pose, authority/mesh revisions, edit/hit,
queue, pipeline timing, frame/Long Task and geometry counts. They expose no
functions, object references, mutable arrays or command channels.

Presentation-only fixed coast/river camera queries may support deterministic
beauty evidence. They cannot mutate the authority. First-person movement and
cut captures use real visible keyboard/mouse/pointer-lock events.

## Import whitelist and guard

V2 may import:

- other modules under `src/voxel-v2/**` according to the direction below;
- browser/Web APIs and TypeScript/JavaScript standard language features;
- `three` only from `src/voxel-v2/render-three/**`;
- a mature adjacent repository pattern only as read-only design evidence unless
  a small general utility is explicitly audited and documented.

Allowed direction:

```text
domain <- mesh <- worker protocol/worker
domain <- runtime
domain/mesh/runtime -> render-three (inputs only; never reverse truth ownership)
query -> demo bootstrap -> authority/scheduler/runtime/render-three
main.ts -> query + dynamic demo bootstrap
```

The recursive static guard rejects imports/references to:

- `src/surface-play/**`;
- `src/surface-lab/**`;
- `src/voxel/adaptive/**`;
- `src/voxel/structural/**`;
- old Surface Nets modules/names;
- existing WorkerPool/streaming worker modules;
- `three` outside V2 `render-three/**`;
- TestBridge or a V2 mutation global.

It also guards package-lock and Unity/`Assets/**` drift in final verification.

## Deliberate future adapters, not implementations

### Representation/streaming adapter

A later change may request immutable authority snapshots at three real
representation levels and produce far proxies. Its request key must include
authority chunk/region identity and revision. It owns cache/proxy products, not
cells, edits, collision or authority revisions. V2 implements no LOD selection,
streaming residency or far renderer.

### Object-local raymarch adapter

A later renderer may consume a copied bounded object/chunk volume and revision
for object-local raymarching. It remains a projection and cannot become an edit
or collision authority. V2 adds no shader/raymarch implementation.

### Structural/physics adapter

A later asynchronous subscriber may consume accepted authority deltas to
calculate connectivity and hand one detached object to a physics adapter. It
must validate source revision before adoption and feed any resulting occupancy
change back through the sole authority command contract. V2 allows floating
trees and implements no connectivity, rigid body or physics dependency.

## Stop conditions

Stop rather than alter this boundary if implementation requires a prohibited
import, second authority/journal/key/revision ladder, renderer/collider truth,
full-world remesh after local edit, package/lock/Unity/GPL change, normal route
regression, debug-only benchmark substitution or unresolved P0/P1 authority,
ordering, seam, liveness or main-thread problem.
