# Capability: Hestia Voxel Runtime V2 Spike

## Requirement: Isolated Exact Query Runtime

When and only when one query value is exactly `voxelV2=1`, the browser shall
dynamically start V2. Without that value, `/` and `/?surfaceLab=1` shall retain
their existing runtimes. If V2 and Surface Lab are both exact, V2 shall have
documented precedence. V2 shall expose no TestBridge or mutating test API.

### Scenario: Normal route isolation

Given no exact V2 query, when the browser loads, then no V2 worker, DOM, CSS
mode, authority or Three projection exists and the established route starts.

### Scenario: Exact V2 route

Given exactly `voxelV2=1`, when the browser loads, then one V2 authority starts
and reaches a visible Ready state through a dynamic V2 import.

## Requirement: Single Canonical Voxel Authority

The sole world authority shall own a deterministic versioned 256 × 128 × 256
cell space at 0.25 m resolution, sparse 32³ chunks, stable signed keys, seed,
palette, edit ordering and world revision. Material zero shall be Air. Chunk
records shall include coordinate/key, source revision, authority revision,
private `Uint8Array` cells, dirty local AABB and deterministic byte signature.
No API shall expose mutable authority cells.

### Scenario: Derived snapshot isolation

Given an authority chunk, when a mesh or worker snapshot is requested, then the
receiver gets copied cells plus requested revision and mutating that copy cannot
change authority content or signature.

## Requirement: Stable Hestia Palette

The palette shall contain Air, grass/moss, soil, light rock, wet/dark rock,
sand, wet shoreline boundary, wood, leaves and two to four flora colours. Each
entry shall own stable ID/name/base colour/roughness/emissive/physical class and
destructibility metadata.

## Requirement: Deterministic Composed Coast World

Pure generation shall produce at least 64 × 32 × 64 metres of visible/walkable
coast, lagoon, connected river/valley, terraces, block cliffs, visible strata,
clearings, deliberately spaced voxel trees, flora accents and a dry spawn.
Same seed/version/chunk input shall be byte-identical and a changed seed shall
change valid content. Camera, load order, wall clock and `Math.random` shall not
affect output.

### Scenario: Water topology

Given the generated world and fixed static water level, then water is visible
at coast/lagoon/connected river, does not run uphill and does not intersect the
dry player spawn.

## Requirement: Deterministic Greedy Block Mesh

Near-field terrain shall use exposed axis-face greedy meshing, flat normals and
material boundaries. A copied one-cell neighbour halo shall eliminate internal
chunk-seam faces independent of job order. Merge compatibility shall include
material and block-corner AO. Identical input shall produce byte-identical typed
positions, normals, indices, material IDs, AO and material ranges. No Surface
Nets, Marching Cubes, Dual Contouring, SDF or object-per-voxel path is allowed.

### Scenario: Material boundary

Given adjacent coplanar visible faces with different palette IDs, when meshed,
then they remain separate greedy quads and their material ranges are stable.

## Requirement: V2-Owned Revisioned Worker Scheduler

A V2-specific bounded module-worker scheduler shall run generation and meshing.
Jobs carry operation, chunk key and requested revision; newest queued work wins,
older queued work coalesces and stale in-flight terminals cannot adopt. Buffers
shall use transferables. Disposal is terminal. Read-only telemetry shall expose
pending/running/coalesced/stale, queue wait, generation, meshing and transfer
bytes. The existing WorkerPool shall not be imported or adapted.

### Scenario: Superseded local mesh

Given mesh revision N is in flight and authority advances that chunk to N+1,
when N completes, then N is counted stale, cannot replace the visible mesh and
N+1 eventually becomes current.

## Requirement: Authority-Backed First-Person Movement

The V2 route shall provide pointer lock, WASD, sprint, jump, mouse look and a
reticle. Simulation shall use a 60 Hz fixed step. Bounded per-frame processing
may retain backlog but shall never silently discard accumulated time. A robust
authority-backed AABB/capsule-style collision query with bounded substeps and
at most 0.5 m stepping shall operate independently of renderer mesh state.
Velocity shall be zeroed only for proven blocking contact or stable rest.

### Scenario: Remesh-independent collision

Given an authority edit is accepted while its replacement mesh is pending,
then player collision follows the new authority occupancy immediately and
movement does not pause for rendering.

## Requirement: Ordered Local Cutter

Visible fire input shall run authority DDA, publish a hit/miss marker within one
displayed frame and submit a quantized small `SubtractSphere` command containing
edit ID, monotonic sequence and expected world revision. Duplicate ID/sequence,
stale revision, miss and out-of-range commands shall fail closed. Accepted
commands shall return dirty bounds and exact affected chunks, advance authority
synchronously and schedule only changed chunks plus necessary boundary
neighbours for asynchronous remesh.

### Scenario: Local-only remesh

Given an accepted cut that does not touch a chunk boundary, then only its chunk
is remeshed; a boundary cut additionally remeshes only touched face-neighbours,
never every resident chunk.

## Requirement: Three-Only Projection Boundary

No V2 domain/runtime/worker module shall import `three`. Only
`voxel-v2/render-three/**` may project neutral mesh products. The projection
shall use one or few BufferGeometry products per chunk/band, palette-derived
vertex/material presentation and a separate transparent static water pass.
Renderer geometry shall not define occupancy, edits or collision.

## Requirement: Read-Only Measurable Runtime

Normal DOM diagnostics may expose readiness, player pose, revisions, hit/edit
state, queue work, generation/meshing/transfer/upload/adoption, frame and Long
Task distributions, resident/visible chunks, triangles/vertices/draw calls and
input-to-hit/authority/visible latencies. Diagnostics shall not mutate runtime
state or influence scheduling decisions.

## Requirement: Real Chromium Acceptance Evidence

One exactly-assigned E2E spec shall use visible real controls/events without
TestBridge to prove Ready/no browser errors, authoritative movement, real fire
feedback, one focused accepted edit, revision advance, stale-mesh exclusion,
visible mesh convergence, authority collision and 100-cut liveness. It shall
capture 1920×1080 Coast/Lagoon, Inland River/Valley, First-Person Spawn, Before
Terrain Cut and After Terrain Cut images; beauty captures contain no debug HUD.

## Requirement: Preliminary Performance Decision

A production build in real Chromium at 1920×1080 after warm-up shall measure
current/p50/p95/max frame time, Long Tasks ≥50 ms, authority edit, queue wait,
generation, meshing, transfer, upload/adoption, input-to-hit, input-to-authority,
input-to-visible, resident/visible chunks, geometry/draw counts and scheduler
counters. Preliminary PASS requires frame p95 ≤16.7 ms, no warm local-cut Long
Task ≥50 ms, hit feedback within one displayed frame, authority command ≤16 ms,
local current-visible mesh p95 ≤100 ms, no full-world remesh and 100 consecutive
local cuts without freeze/crash/pause/unbounded queue. Failed or unavailable
targets shall produce an honest `CONDITIONAL GO` or `NO-GO`, never an implicit
waiver.

## Requirement: Static Scope and License Guard

Automated recursive guards shall fail on imports from `surface-play`,
`surface-lab`, `voxel/adaptive`, `voxel/structural`, old Surface Nets or existing
WorkerPool, on `three` outside `render-three/**`, on runtime TestBridge mutation,
or on package-lock/Unity Assets drift. No GPL-3.0 re-flora source or assets shall
be copied or adapted; separate asset terms remain an explicit caveat.
