# Design: Hestia Voxel Runtime V2 Spike V1

## Change

`browser-hestia-voxel-runtime-v2-spike-v1`

The self-contained execution contract is
`docs/browser-mainline/hestia-voxel-runtime-v2-spike-v1-execplan.md`. This
design records the decisions that must survive implementation detail changes.

## Authority boundary

`VoxelAuthority` is the sole mutable owner of the bounded 256 × 128 × 256 cell
world. Chunk edge is 32, voxel edge is 0.25 m and material zero is Air. The
authority owns the seed/version, immutable palette, stable chunk map, edit
journal ordering and world revision. Each sparse non-empty chunk owns private
`Uint8Array` cells, coordinate/key, source revision, authority revision, last
dirty local AABB and FNV-1a-64 byte signature.

No caller receives a mutable authority buffer. Mesh/collision/generation
products cross explicit copy/adopt boundaries carrying requested revisions.
Renderer state and worker products are disposable projections, never truth.

## World composition

Generation uses explicit deterministic analytic macro functions rather than a
general noise framework: broad coast/lagoon mask, connected river channel,
valley floor, terraces, stepped cliffs, visible material strata and fixed
placement templates for clearings, large voxel trees and sparse flora. The
spawn is dry and walkable. Seed/version affect deterministic integer hashes,
never camera, wall clock or load order.

All 8 × 4 × 8 candidate chunks generate off the main thread. Initial meshing
waits until generation adoption is complete, so one-cell neighbour halos are
authoritative and seams do not depend on completion order.

## Meshing boundary

The pure domain mesher consumes a copied 34³ halo snapshot plus chunk key and
requested revision. It emits exposed axis faces only, material/AO-compatible
greedy quads, flat normals, typed indices, per-vertex material IDs/AO and
deterministic material ranges. Identical input bytes must produce identical
output bytes. Missing/inconsistent halo data fails closed.

The Three adapter maps palette IDs/AO to vertex colours and one opaque material
per chunk. Static sea-level water is a separate transparent pass and is not a
destructible cell material. Only `render-three/**` imports `three`.

## Scheduler boundary

One V2-owned module worker is intentionally the complete bounded pool for this
spike. Scheduler keys include operation/chunk/requested revision. A newer queued
request replaces the older queued request; an older in-flight terminal cannot
adopt after authority revision changes. Buffers are transferred, queue depth is
bounded/coalesced, disposal is terminal and telemetry is read-only.

Generation and greedy meshing are worker operations. Main-thread edit work is
limited to DDA, a small quantized authority mutation, signatures, copied local
halos and renderer adoption. Dirty boundary intersection determines the only
face-neighbour chunks remeshed; no local command may enqueue all chunks.

## Runtime boundary

An exact `voxelV2=1` query dynamically loads V2 before the existing Surface Lab
and normal fallbacks. When V2 is absent, existing behavior is byte-for-byte at
the route decision. If both V2 and Surface Lab are requested, V2 has documented
precedence. V2 uses query-gated DOM/CSS, the existing canvas and no TestBridge.

The player uses pointer lock, WASD, sprint, jump and mouse look. A 60 Hz fixed
step retains any unprocessed accumulator remainder. Authority occupancy drives
bounded-substep AABB movement and limited 0.5 m stepping. Mesh state cannot
freeze, move or support the player.

The cutter performs authority DDA and immediate hit feedback. A quantized
`SubtractSphere` command contains edit ID, monotonic sequence and expected
world revision. Duplicate/stale/miss/out-of-range commands fail closed. Accepted
commands synchronously advance authority truth and asynchronously remesh only
affected chunks. Mesh adoption repeats the current-revision check.

## Telemetry and evidence boundary

Read-only DOM diagnostics expose lifecycle, pose, occupancy/revision, edit,
queue, stale/coalesced, frame, Long Task, pipeline latency and geometry counts.
No mutation function is published. Production evidence uses a built preview,
real Chromium at 1920×1080 after warm-up, visible input events, five fixed PNGs
and parseable JSON. Unit fakes prove protocol branches but are not performance
evidence.

## Future adapter points

Later work may request immutable chunk snapshots for three real representation
levels/far proxies or object-local raymarch products. It may also subscribe to
accepted authority deltas for asynchronous structural connectivity and one
detached-object physics adapter. Neither adapter owns cells, keys, revisions or
edit ordering, and neither is implemented by this spike.

## Risks and safe stops

- Sparse authority still spans 8.4 million candidate cells; worker generation,
  bounded queueing and measured transfer/upload costs are mandatory.
- AO can reduce greedy merging; do not drop it silently if performance misses.
- Main-thread halo copies and geometry upload may dominate cut latency.
- Pointer-lock support may differ in headless Chromium; unavailable proof is a
  reported blocker, not permission for a TestBridge.
- Stop on prohibited imports, second truth, renderer/collider authority,
  full-world edit remesh, package/Unity/GPL changes, normal-route regression,
  debug-only benchmark evidence or unresolved P0/P1 authority, ordering, seam,
  liveness or main-thread findings.
