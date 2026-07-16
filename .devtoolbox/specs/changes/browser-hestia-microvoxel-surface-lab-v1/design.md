# Design: Browser Hestia Microvoxel Surface Lab V1

## Baseline
The feature branch starts at origin/main 5ff47aeef3c42c0b933e8480dafa5680759a40df, which already contains the mesh artifact snapshot/adoption fix. Presentation and backend contracts are consumed, not modified. docs/current-prototype-state.md is absent; docs/current-mainline-state.md is the current status document. The fifth requested concept file exists as docs/UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png.

## End-to-End Data Flow
Hestia starter catalog -> deterministic UniverseTime -> ephemeris -> BodyInertial -> BodyFixed -> fixed SurfaceLocalFrame -> global integer sample coordinates -> Hestia density/material generator -> VoxelBrick -> existing WorkerPool job -> Surface Nets -> transferable VoxelMeshProduct -> meshArtifactAdapter -> MeshArtifact -> ThreeRenderBackend.

## VoxelBrick V1
Fields: bodyId, surfaceFrameId, regionId, brickCoordinate, voxelSizeMeters, cellDimensions, sampleDimensions, apronWidth, generatorVersion, materialRegistryVersion, sourceRevision, editRevision, densityBuffer, materialBuffer, contentHash.

- cellDimensions is 32 x 64 x 32.
- Density is Float32Array; density <= 0 is solid and > 0 is air.
- Material is Uint8Array with the same sample dimensions and index order as density.
- X is fastest: x + sizeX * (y + sizeY * z).
- The core corner lattice is cellDimensions + 1.
- apronWidth is one sample on both sides of each axis, so sampleDimensions is cellDimensions + 3 and stored local samples represent core coordinates -1 through cellDimension + 1.
- Global sample coordinate equals brickCoordinate * cellDimensions + storedLocalSample - apronWidth.
- Position in the SurfaceLocalFrame equals global sample coordinate * voxelSizeMeters.
- Owned cells are local 0 through dimension-1. Apron-derived ghost cells are never authoritative.
- editRevision is zero in V1.

Default region is 4 x 1 x 4 chunks. At 0.50 m it is 64 x 32 x 64 m. At 0.25 m it remains 16 chunks but honestly reports 32 x 16 x 32 m.

## Deterministic Hestia Generator
Preset is hestia.nebelwald-archipelago.preview.v1. The frame is built from the real Hestia body and a fixed explicit UniverseTime and surface anchor. The root seed is canonically mixed with generator version, body ID, frame ID, preset, voxel size, and global integer sample coordinate. Labelled sub-seeds drive macro elevation, island/ridge field, rock breakup, domain-warp/erosion-like detail, wet depressions, material classification, and scatter. The generator has no Math.random, wall-clock, camera, Three.js, or load-order input.

Material registry V1 uses stable byte IDs for dark_rock, wet_soil, moss, dense_biological_surface, and shallow_water_boundary. Water is a separate non-simulated presentation plane. Scatter is deterministic reconstructable presentation only.

## Surface Nets V1
Each sign-changing owned cell receives a vertex at the deterministic mean of its finite edge intersections. The one-sample apron supports ghost-cell vertices needed by border faces. Primal edge/face ownership is globally ordered so one chunk emits each border face. Ghost-derived vertex positions may be duplicated across derived meshes but must be numerically equal. Quads use a fixed diagonal. Triangles are emitted in stable material order with duplicated vertices and face normals for a visibly faceted result. Material ranges cover every index exactly once. Empty and fully solid bricks yield a valid empty product and never infer missing neighbors as air.

## Worker and Cache
The existing protocol gains exactly one job kind, GenerateHestiaVoxelBrickMesh. Metadata includes all identity, preset, coordinate, resolution, revision, epoch, algorithm, priority, estimate, and output-budget fields. Generation and meshing execute in the real module worker. Cancellation checkpoints occur before work, between bounded slices, between generation and meshing, and before publish.

Outputs use separate transferable buffers for density, material, positions, normals, and indices. Small immutable metadata carries material ranges, bounds, hashes, timings, and layout. ResultGate validates identity, planning epoch, worker epoch, source/output revision, algorithm, ownership, byte totals, layout, hash, and budget before cache or rendering.

The reconstructable cache stores validated canonical density/material snapshots. A normal revisit may send exclusive cache copies to the same worker job for meshing; explicit Regenerate bypasses cache to prove deterministic regeneration. Meshes remain derived and disposable.

## Neutral Mesh and Presentation Boundary
VoxelMeshProduct contains representationKey, sourceRevision, artifactRevision, algorithmVersion, frameId, positions, normals, indices, materialRanges, bounds, contentHash and no Three.js/Presentation types. Only src/voxel/meshArtifactAdapter.ts imports Presentation. It supports a safe createMeshArtifact snapshot for shared/cached data and validated adoption for exclusively owned direct worker buffers. Strategy changes cannot alter voxel or mesh topology/hashes. No permanent zero-copy claim is made.

## Surface Lab
main.ts selects the lab only when surfaceLab equals exactly 1. The lab owns a full-screen canvas and ThreeRenderBackend. Terrain is submitted only via UpsertMeshArtifact. Separate scene children under surface-lab provide lights, fog, water, vegetation, and chunk-boundary presentation. Camera controls use backend.camera and never affect canonical data.

Lifecycle: idle -> requesting -> partial/ready or failed -> regenerating -> disposed. Seed or resolution changes increment planning epoch, cancel prior work, reject stale results, and revision-safely replace artifacts.

The visible DOM HUD is normal product/proving-ground presentation, not TestBridge. It exposes title, warning, seed, preset, resolution, physical extent, chunk state, worker/cache/stale counts, geometry totals, timings, frame time, hashes, and controls through visible text and read-only data attributes.

## Visual Direction
Image 38 is the primary dark green/petrol fog reference; image 36 supplies archipelago, shoreline, water, and faceted landform guidance. Images 23 and 40 guide wet rock/soil, grouped vegetation and restrained cyan accents. Image 30 guides biome palette breadth. Ships, weapons, scanner, missions, player status, outposts, megacities and creatures are excluded. HUD remains edge-bound and keeps the central landscape clear.

## Budgets and Evidence
- Worker output <= 16 MiB per chunk.
- Region mesh buffers <= 128 MiB.
- 16 requested and 16 ready default chunks; failed 0; settled queue/running 0.
- Functional E2E readiness timeout 120 seconds.
- Capture generation, meshing, upload, vertices, triangles, bytes, and a 300-frame steady-state timing sample. Claims report measured values only.
- Evidence screenshots are 1920 x 1080 for default, wireframe, and quarter-meter modes.

## Risks and Mitigations
- Seam holes: explicit apron, cell/face ownership, and neighbor tests.
- Worker memory: output budget, transfer lists, cancellation slices, and bounded region.
- Ownership mutation: adapter-only strategy and snapshot/adoption equivalence tests.
- Flight regression: exact query gate and full core/UI/live E2E groups.
- Visual overreach: concept audit and explicit gameplay exclusions.

## Pipeline-Baseline Closure
The first delivery closes the deterministic pipeline before visual-fidelity work. Camera, lights, fog, water, scatter and overlays remain non-authoritative scene projections. Browser screenshots are retained to prove a live non-empty render, control states, resolution changes and telemetry correlation, but they do not prove concept parity or acceptable final art direction. Independent review found the current scene too dark to establish the intended landform, material, waterline and quarter-meter readability. That result is preserved as a known failing visual finding rather than normalized into this baseline. The separate `browser-hestia-surface-lab-visual-fidelity-v1` change owns any later lighting, palette, fog, water, vegetation, typography, focus-appearance or composition changes.

## Task 2.2 deterministic Hestia generator contract

This section is the approved-plan execution refinement for Task 2.2. It fixes the algorithmic choices that must be stable before implementation; changing them later requires a new generator version and new golden vectors.

### Canonical API and versions

- Preset ID: `hestia.nebelwald-archipelago.preview.v1`.
- Generator version: `hestia.microvoxel.generator.v1`.
- Root seed is a required 1-128 character ASCII token matching `[A-Za-z0-9._:-]+`; there is no default, clock-derived, random, or load-order-derived seed.
- The generation input is exactly root seed, branded body/surface-frame/region IDs, integer brick coordinate, and voxel size. V1 accepts only `0.25` or `0.50` metres.
- Generated bricks use the neutral VoxelBrick V1 constants, the exact V1 material-registry version, `sourceRevision = 0`, and `editRevision = 0`. The generator returns a validated `VoxelBrick` through `createVoxelBrick`, not raw unvalidated channels.
- Domain-separated seed labels are literal versioned strings for `macro-elevation`, `island-ridge`, `rock-breakup`, `domain-warp-x`, `domain-warp-z`, `wet-depressions`, `material-biological`, `scatter-accept`, `scatter-kind`, `scatter-yaw`, `scatter-scale`, and `scatter-jitter`.
- Seed derivation uses FNV-1a32 over the ASCII tuple `hestia.seed.v1\0<root>\0<body>\0<surface-frame>\0<preset>\0<domain>`. Lattice hashing mixes both low and high 32-bit words of every safe-integer lattice coordinate with explicit `Math.imul` 32-bit wrap. This avoids accidental 2^32 coordinate aliasing while remaining dependency-free.

### Noise and density field

- `noise.ts` implements dependency-free seeded lattice value noise in 2D/3D with quintic interpolation, plus normalized fBm and ridged helpers. Noise is pure and has no mutable global cache.
- fBm uses lacunarity `2`, persistence `0.5`, and normalized amplitude sums. All lattice coordinates and all results are required to be finite; invalid inputs fail closed.
- Coordinates are surface-local metres with +Y up. For each global integer sample coordinate, compute metres as `global * voxelSizeMeters`.
- Sea level is `0 m`.
- Domain warp is `18 m * fbm2(x * 0.0075, z * 0.0075, 3 octaves)`, using distinct X and Z domain seeds. The remaining 2D fields use warped X/Z.
- Macro elevation is 4-octave fBm at frequency `0.010`.
- Island mask is `smoothstep(0.38, 0.72, 0.5 + 0.5 * fbm2(frequency 0.0065, 3 octaves))`.
- Ridge is the square of `1 - abs(noise2(frequency 0.014))`.
- Erosion-like detail is 3-octave fBm at frequency `0.030`.
- Wet depression is `smoothstep(0.58, 0.82, 0.5 + 0.5 * noise2(frequency 0.018))`.
- Surface height is `-5 + 14*islandMask + 4*macro + 3*ridge + 1.5*erosion - 2.5*wetDepression` metres.
- Rock breakup is `1.4 * fbm3(x * 0.055, y * 0.055, z * 0.055, 3 octaves)` using warped X/Z.
- Density is `Math.fround(y - surfaceHeight + rockBreakup)`; therefore `density <= 0` is solid and `density > 0` is air. Channel assignment remains Float32 and must never silently normalize invalid metadata.

### Material classification

Every sample receives one of the exact five V1 material IDs. The following priority is normative and uses finite field values only:

1. `ShallowWaterBoundary` when the sample is within `0.75 m` of sea level and `abs(density) <= 1.5`.
2. `SolidRock` when depth below the procedural surface exceeds `2.25 m` or `abs(rockBreakup) >= 0.72`.
3. `WetSoil` when wet depression is at least `0.58` or surface height is at most `seaLevel + 1.0 m`.
4. `DenseBiologicalSurface` when `abs(density) <= 1.25` and a separate 3-octave biological fBm at frequency `0.080`, remapped to `[0,1]`, is at least `0.58`.
5. `MossCover` otherwise.

The water-boundary ID is only a shoreline/surface classification hint. It never creates an authoritative water volume; water remains a separate non-simulated presentation plane.

### Reconstructable scatter contract

- Scatter is returned as readonly presentation records and is not embedded in VoxelBrick canonical bytes or treated as gameplay/simulation state.
- One deterministic candidate lattice is anchored to global X/Z core-cell coordinates at a fixed `2 m` spacing: stride 8 cells at 0.25 m and stride 4 cells at 0.50 m. A candidate belongs to the brick whose half-open core X/Z range contains its unjittered anchor, preventing duplicate ownership across neighbors.
- Jitter is deterministic and bounded to plus/minus `0.35 * spacing`; ownership remains with the unjittered anchor even if the rendered point crosses a brick edge.
- Surface Y is found with four fixed-point iterations of `y = surfaceHeight(x,z) - rockBreakup(x,y,z)` starting at surface height.
- Candidates on `SolidRock` or `ShallowWaterBoundary` are rejected. Acceptance thresholds are `0.18` for `WetSoil`, `0.28` for `MossCover`, and `0.42` for `DenseBiologicalSurface`, compared with a deterministic `[0,1)` value from `scatter-accept`.
- Record schema is exactly: stable ID, kind, surface-local `positionMeters {x,y,z}`, `yawRadians`, `uniformScale`, `surfaceMaterialId`, and integer `sourceAnchorGlobal {x,z}`. Kinds are `black_trunk`, `cyan_luminous_sprout`, and `cyan_luminous_cap`; deterministic selector intervals are `[0,0.55)`, `[0.55,0.85)`, and `[0.85,1)`.
- Stable ID is `hestia.scatter.v1:<domain-seed-hex>:<anchor-x>:<anchor-z>`. Yaw is `2*pi*u`; scale is `0.80 + 0.55*u`, each from its own domain seed. Records sort by anchor Z, then anchor X, then stable ID.
- Scatter generation consumes only the same canonical input and pure field queries. It does not consume a camera, floating-origin state, prior generation order, wall clock, mutable cache, mesh, renderer, or worker lifecycle.

### Task 2.2 proof obligations

Focused tests must prove exact dimensions and finite valid channels; same-input byte/hash equality; changed-seed inequality; distinct 0.25/0.50 keys and hashes; density-sign and all five-material validity; stable scatter equality/order/schema; changed-seed scatter inequality; adjacent-brick candidate ownership without duplicate stable IDs; and at least one pinned generator hash plus one pinned scatter-record fixture. A scoped scan must reject Three.js/Presentation imports, external noise packages, `Math.random`, `Date.now`, camera state, and load-order input. Repository-native Vitest and TypeScript remain preferred; if local dependencies are absent, use only already-cached tooling and report the limitation without installing.

## Task 2.3 Surface Nets V1 contract

This section is the approved-plan execution refinement for Task 2.3. It fixes topology, ownership, ordering, neutral output, and canonical hash choices before implementation. Any incompatible change requires a new mesh schema/algorithm version and new golden vectors.

### Versions and neutral output

- Export `VOXEL_MESH_SCHEMA_VERSION = 1` and `VOXEL_MESH_ALGORITHM_VERSION = "surface_nets_v1"` from the renderer-neutral voxel module.
- `VoxelMeshProduct` contains schemaVersion, representationKey, sourceRevision, artifactRevision, algorithmVersion, frameId, materialRegistryVersion, positions, normals, indices, materialRanges, bounds, and contentHash. It imports no Presentation or Three.js type.
- sourceRevision is copied from the brick; artifactRevision is the brick editRevision (zero in V1); frameId is the brick surfaceFrameId.
- A neutral material range contains materialId, materialKey, startIndex, and indexCount. The later adapter alone maps materialKey to a Presentation materialProfileId.
- representationKey is `voxel_mesh:<16 lowercase hex>`: FNV-1a-64 over ASCII prefix `weltraum-voxel-mesh-identity-v2\n` followed by canonical JSON `[bodyId,surfaceFrameId,regionId,[brickX,brickY,brickZ]]`. It is stable across remeshing and content revisions.

### Cell vertex convention

- Corner order is `0:(0,0,0), 1:(1,0,0), 2:(0,1,0), 3:(1,1,0), 4:(0,0,1), 5:(1,0,1), 6:(0,1,1), 7:(1,1,1)`.
- Edge order is X `01,23,45,67`, then Y `02,13,46,57`, then Z `04,15,26,37`.
- A sample is solid exactly when density is `<= 0`. A cell receives one dual vertex iff its eight corners contain both solid and air.
- For every sign-changing edge in the fixed order, compute `t = clamp(d0 / (d0 - d1), 0, 1)` in JavaScript number precision and the global SurfaceLocalFrame intersection from the two global integer sample coordinates multiplied by voxelSizeMeters. Average intersections in that same order, then round each final coordinate once through Float32 before any triangle or normal calculation.
- The mesher computes vertices for core-cell coordinates `[-1..dimension-1]` on each axis. The negative layer is ghost data from the brick apron; it is never an owned cell. No density, material, or vertex is inferred from an absent neighbor.

### Global edge ownership, quads, and winding

- Every sign-changing primal grid edge produces one dual quad. Its global owner brick is the component-wise mathematical floor division of the edge's lower global sample coordinate by the V1 cell dimensions. Therefore this brick examines lower local sample coordinates `0..dimension-1` only; shared edges are emitted by exactly one brick, including at negative world coordinates.
- Candidate order is Z outer, Y middle, X inner (X-fastest), then edge axis X, Y, Z.
- Let `a` be the component-wise minimum incident-cell coordinate. For a positive-axis normal the four-cell ring is: X `[a,a+Y,a+Y+Z,a+Z]`; Y `[a,a+Z,a+X+Z,a+X]`; Z `[a,a+X,a+X+Y,a+Y]`.
- The outward axis is positive when the lower edge endpoint is solid and the upper endpoint is air; otherwise it is negative. Use the positive ring for a positive outward axis and `[0,3,2,1]` of that ring for a negative outward axis.
- The fixed diagonal is ring vertex 0 to 2. Emit triangles `[0,1,2]` and `[0,2,3]`. Each triangle duplicates its three positions; its normalized cross-product face normal is repeated three times. Indices are therefore sequential.
- A non-finite or exactly zero-length triangle normal is a fail-closed contract error; the mesher does not silently invent a normal, change the diagonal, or infer air.

### Material and stable emission order

- A quad's material is the material byte and registry key at its solid edge endpoint. Both triangles of the quad use that material.
- Bucket candidates by ascending material byte ID. Preserve the candidate traversal order inside each bucket. Emit one gapless material range per non-empty bucket; every index is covered exactly once and empty buckets are omitted.
- Empty and fully solid bricks return a valid empty product with zero-length Float32 positions/normals, zero-length Uint16 indices, no material ranges, and min=max at the owned brick origin in SurfaceLocalFrame meters. They are not converted to MeshArtifact until a later adapter explicitly handles the empty case.
- Non-empty bounds are the tight min/max over the emitted Float32 positions. Use Uint16 indices when vertexCount is at most 65535, otherwise Uint32.

### Canonical mesh bytes and validation

- Canonical bytes start with ASCII `weltraum-voxel-mesh-product-v1\n`, then uint32 little-endian header length, then an ASCII JSON header with fields in this exact order: schemaVersion, representationKey, sourceRevision, artifactRevision, algorithmVersion, frameId, materialRegistryVersion, positions format/count, normals format/count, indices format/count, materialRanges as `[materialId,materialKey,startIndex,indexCount]`, and bounds format/count.
- Append six Float32 little-endian bounds values in minX,minY,minZ,maxX,maxY,maxZ order, then all positions Float32LE, normals Float32LE, and indices Uint16LE or Uint32LE. contentHash is FNV-1a-64 over these bytes in `fnv1a64:<16 lowercase hex>` format.
- Entry validates the complete VoxelBrick, including apron dimensions, finite density, material registry, and brick content hash, before meshing. Output validation checks array types and complete triples, finite values, one normal per position, in-range sequential indices, gapless triangle-aligned material coverage, tight bounds, identity/version fields, and content hash. Invalid input or output throws the stable voxel contract error; no partial product is published.

### Required Task 2.3 evidence

- Focused tests cover empty, full, single-plane and curved fixtures; fixed golden content hash; deterministic rerun; negative-coordinate ownership; exact Float32 border-position equality for adjacent bricks; no duplicate owned quads; complete material ranges in ascending material order; invalid/mutated brick rejection; and degenerate-output rejection.
- The density comparison uses triangle count against a naive exposed cube-face baseline for the same fixture and must be strictly lower. Verification is focused Vitest plus strict TypeScript for all touched production modules.

## Approved Task 4.1 Contract Revision (2026-07-15)

### Representation identity
The neutral Surface Nets V1 revision contract remains unchanged: generated Surface Nets products keep sourceRevision/editRevision-derived artifact revision zero, and ThreeRenderBackend continues to reject changed content at an equal key/revision. Instead, calculateVoxelMeshRepresentationKey becomes content-addressed over the existing body/frame/region/brick coordinate identity plus voxelBrickContentHash and mesher algorithm/version. This keeps same canonical input stable while seed, resolution/content, or mesher-version changes produce a fresh representation key.

### Generation transition and failure policy
Every requested seed/resolution is validated before mutation. A superseding generation cancels old tickets, advances planning/generation epochs, removes and forgets every prior-generation artifact exactly once, then requests 16 new chunks. Clearing first intentionally permits a transient empty surface; it prevents mixed old/new seed or resolution state. If one or more current chunks fail, successful chunks from only that current generation may remain and lifecycle is Failed. Stale/cancelled terminals never publish. start/restartWorker re-check disposal after awaited pool operations, and beginGeneration itself cannot transition away from Disposed.

### Cache and ownership flow
Surface Lab consumes the existing VoxelBrick cache and Hestia Generate/Cached worker-bundle helpers without adding a second cache or pool. Normal eligible flows perform real lookups. Explicit regenerate bypasses reads but accepted canonical outputs may still be admitted. Cache-owned channels are packaged through existing copy/ownership-safe helpers before transfer. Admission requires an accepted validated current terminal. Meshes remain derived and uncached. Direct worker output may use MeshArtifact adoption only when isWorkerPoolAcceptedCompletedTerminal and exact output buffer identity both hold; cached/shared/unproven products snapshot. Empty mesh products produce no artifact.

### Telemetry
Cache hits, misses and bypasses are counted from actual lookup decisions. Queue/running, failure/stale, timings, brickContentHash and mesh contentHash are recorded from accepted lifecycle events. Telemetry remains a read-only projection and never controls generation.

## Approved Task 4.1 Amendment 2: Worker Target vs Mesh Representation
WorkerJob targetKey is a request-known spatial job identity over body, surface frame, region and brick coordinate. It remains the authority used by WorkerPool/resultGate target and stale checks. VoxelMeshProduct representationKey is a post-generation content identity over the same spatial identity, validated brick.contentHash and mesher algorithm/version.

The protocol keeps all existing envelope, epoch, target, revision, algorithm, transfer-hash, ownership, five-buffer-layout and budget validation. It then reconstructs zero-copy typed views, creates and validates the canonical transferred VoxelBrick, and only afterward compares the declared mesh representation key with calculateVoxelMeshRepresentationKey(brick, meshAlgorithmVersion). Mesh validation follows unchanged. Surface Lab supplies the spatial job target and consumes the decoded content-addressed representation; it never predicts generated content identity from payload metadata. No WorkerPool, resultGate, streamingWorker, cache, Presentation, backend or Surface Nets revision-contract change is needed.


## Approved Task 4.1 Amendment 3: Presentation Publication Ordering
The content-addressed VoxelMeshProduct key and neutral artifactRevision zero remain canonical worker output. meshArtifactAdapter gains an optional typed Presentation ArtifactRevision override; it changes ordering metadata only and preserves representation key, source revision, content hash, topology and snapshot/adoption ownership. Surface Lab maps its monotone plan/output revision to this override for every current-generation artifact. Remove commands carry the prior publication revision, so same-key regeneration and A-to-B-to-A revisits can be accepted at a strictly higher revision without backend changes.

Every superseding generation clears and forgets all prior publications before enqueueing 16 new jobs. Same-input regeneration intentionally performs remove plus higher-revision upsert rather than a backend no-op. One failed job therefore cannot retain its old artifact. A transient empty region remains accepted while lifecycle is Requesting/Regenerating.

Adoption is restricted to accepted Generate terminals with exact output-buffer identity. Accepted CachedCanonicalBrick terminals snapshot. RequestedChunks begins at zero and increments only after ticket creation. A worker-replacement rejection is swallowed only when disposal won the race; genuine replacement failures retain normal failure behavior. Corrupt cached bundles are evicted from shadow lookup and fall back to Generate while recording a miss. Shadow hash lookup is pruned on input-signature changes.
