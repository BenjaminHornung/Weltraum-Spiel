# Capability: Live Hestia Microvoxel Surface Lab

## Requirement: Query-Gated Runtime
When and only when the surfaceLab query value is exactly 1, the browser shall start the Surface Lab. Without that exact value, the existing flight runtime shall behave unchanged.

### Scenario: Normal runtime
Given no surfaceLab=1 query, when the page loads, then the established flight runtime starts and no Surface Lab canvas, worker jobs, HUD, or TestBridge side effect exists.

### Scenario: Surface Lab runtime
Given surfaceLab=1, when the page loads, then a full-screen Technical Proving Ground starts and uses ThreeRenderBackend for terrain artifacts.

## Requirement: Real Spatial Authority
The lab shall derive a fixed SurfaceLocalFrame from the real Hestia celestial definition, explicit UniverseTime, BodyFixed frame, and canonical surface anchor. Camera and floating-origin movement shall not change brick hashes.

## Requirement: Canonical VoxelBrick
Each brick shall carry the complete V1 identity, layout, revision, typed density/material buffers, and content hash. Shared global sample coordinates, including apron overlap, shall produce byte-identical density and material values.

### Scenario: Resolution separation
Given identical seed and brick identity but 0.50 m versus 0.25 m voxel size, then canonical keys/hashes differ and each reported physical extent is correct.

## Requirement: Deterministic Hestia Fields
The preset hestia.nebelwald-archipelago.preview.v1 shall combine macro elevation, island/ridge, rock breakup, erosion-like/domain-warp detail, wet depression, sea level and material classification without Math.random, wall-clock, camera, load order, external noise dependency, or Three.js core types.

### Scenario: Seed determinism
Same canonical inputs shall produce identical brick and mesh hashes. A changed seed shall produce valid but different results.

## Requirement: Surface Nets V1
Uniform-grid Surface Nets shall produce finite, deterministic, faceted, material-ranged geometry with stable chunk seams. Missing neighbors shall not be treated as air. Empty and fully solid terrain shall be handled without invalid geometry.

## Requirement: Existing Worker Pipeline
GenerateHestiaVoxelBrickMesh shall execute generation and meshing in the existing module-worker pool. Requests and results shall carry planning epoch, worker epoch, revisions, algorithm version, budgets and hashes. Buffers shall use transfer lists. Stale, over-budget, malformed or cancelled results shall not publish or enter cache/rendering.

## Requirement: Explicit Artifact Handoff
Voxel and generator core shall expose only a neutral VoxelMeshProduct. meshArtifactAdapter.ts shall be the only ownership-aware boundary and shall produce valid MeshArtifacts through safe snapshot or validated exclusive adoption without changing topology or canonical hashes.

## Requirement: Interactive Proving Ground
The lab shall provide orbit/fly camera controls, WASD/mouse, camera reset, regenerate, seed editing, 0.50/0.25 m switching, wireframe, chunk boundaries, fog, vegetation and reset. It shall visibly state SURFACE LAB, TECHNICAL PROVING GROUND and NOT GAMEPLAY.

## Requirement: Read-Only Telemetry
The visible HUD shall report seed, preset, voxel size, region extent, requested/ready/failed chunks, worker queue/running, stale rejects, cache hits/misses, vertices, triangles, mesh bytes, generation/meshing/upload times and frame time. Telemetry shall not influence decisions and shall be readable by Playwright through normal visible DOM/data attributes rather than TestBridge.

## Requirement: Technical Surface Visibility
For the pipeline baseline, the rendered region shall be visibly non-empty and shall expose the accepted MeshArtifacts without visible chunk holes, an always-on dominant debug grid, a concept-art runtime image, ship, outpost, mission or fake player. Camera, fog, water, vegetation, wireframe and boundaries remain presentation-only and shall not change canonical brick or mesh hashes.

## Requirement: Deferred Visual Fidelity
Concept-directed landform, material, waterline, vegetation, fog-depth, typography and quarter-meter detail readability are not accepted by this change. The retained screenshots are technical runtime evidence only. The current too-dark and low-contrast result shall be recorded as a known-failing visual finding and moved to `browser-hestia-surface-lab-visual-fidelity-v1`; it shall not block deterministic pipeline acceptance and shall not be described as visually complete.

## Requirement: Verification and Evidence
Unit tests shall cover layout, apron, neighbor samples, materials, generator/scatter determinism, Surface Nets, worker protocol, cancellation/stale/ownership and controller lifecycle. A live Playwright spec shall be assigned exactly once to test:e2e:live, run without TestBridge, prove same/different seed hashes and interaction toggles, and create the required JSON, Markdown and 1920x1080 technical screenshots. The screenshots prove live rendering and telemetry correlation, not visual-fidelity acceptance.

## Requirement: Content-Addressed Mesh Representation Identity
A VoxelMeshProduct representation key shall combine its canonical spatial brick identity with the canonical VoxelBrick content hash and mesher algorithm/version identity. Equal canonical inputs shall preserve the key. A changed seed/content, voxel resolution, or mesher algorithm shall produce a distinct key without relaxing Surface Nets V1 artifactRevision zero or the render-backend revision ledger.

### Scenario: Content-changing regeneration
Given an already rendered 16-chunk generation, when seed or resolution changes, then the new accepted mesh products have fresh deterministic representation keys, all prior-generation artifacts are removed exactly once, and the real backend accepts the current-generation upserts.

## Requirement: Generation Isolation and Disposal
Before a superseding generation mutates controller state, seed and resolution shall be validated. The controller shall cancel outstanding tickets, advance its epochs, remove prior-generation artifacts, and publish only current-generation accepted terminals. Partial failure may leave successful current-generation chunks visible but shall never retain prior seed/resolution artifacts. Disposal racing an awaited pool start or worker replacement shall remain terminal and shall not enqueue, publish, emit, or replace settlement state afterward.

## Requirement: Canonical Cache Use and Truthful Telemetry
The Surface Lab shall reuse the existing canonical VoxelBrick cache and worker bundle APIs. Normal eligible requests shall report actual cache lookup hits/misses; explicit regenerate shall bypass cache reads and report bypass separately. Only accepted validated terminals may admit canonical density/material authority. Cached/shared authority shall not be detached and shall use snapshot artifact ownership unless exclusive accepted-worker identity is proven. Mesh artifacts shall not be cached. Telemetry shall expose actual brick and mesh hashes and shall remain read-only.

### Scenario: Rejected output isolation
Given a stale, cancelled, malformed, over-budget, wrong-version or otherwise rejected terminal, then it neither enters cache nor rendering and cannot affect current-generation telemetry except rejection/failure counters.

## Requirement: Separate Worker Target and Mesh Representation Identity
A WorkerJob target key shall remain deterministically computable from request-known spatial identity for stale and target gating. It shall not claim to be the generated mesh representation key. The VoxelMeshProduct representation key shall be computed only from a validated canonical VoxelBrick plus the explicit mesher algorithm/version. Worker output validation shall preserve existing request, epoch, revision, algorithm, transfer, ownership and budget gates, then reconstruct and validate the brick before validating the content-addressed mesh representation key.

### Scenario: Generated result validation
Given a valid Generate or Cached worker result, when the transferred density/material channels reconstruct to the declared canonical brick and the result representation key matches that brick plus mesher version, then protocol validation may continue to mesh validation. A tampered key or brick content/hash fails closed without weakening earlier stale/target/version/budget gates.


## Requirement: Monotone Presentation Publication Revision
Neutral VoxelMeshProduct source/artifact revisions and canonical identity shall remain unchanged. Surface Lab shall map each monotone plan/output revision to an optional Presentation-only artifact revision at the existing voxel-to-Presentation adapter seam. Every superseding generation shall remove all prior publications and publish accepted current results at a strictly higher Presentation artifact revision. Same-input canonical hashes/keys remain stable, while same-input regeneration, worker restart, changed configuration and revisit of an earlier configuration remain accepted by the unchanged backend revision ledger.

### Scenario: Removed-key resurrection
Given configuration A was rendered, removed while configuration B was rendered, and A is requested again, then A retains its deterministic canonical representation key but is published at a revision greater than its prior tombstone and the real backend accepts it.

## Requirement: Final Surface Lab Lifecycle Truth
CachedCanonicalBrick results shall always snapshot into MeshArtifact even when their accepted output buffers alias exactly; exclusive adoption is limited to accepted Generate results with exact identity. Requested chunk telemetry starts at zero and counts actual created tickets. Disposal racing worker replacement shall not reject the public restart call or mutate disposed state. Invalid cached input shall degrade to a measured Generate miss without aborting the generation, and controller shadow cache metadata shall remain bounded to active input.
