# Hestia Browser Rendering and Physics Options — 2026-07-29

Status: research decision draft; no dependency or runtime adoption is approved

## Short decision

Do not buy or integrate Shade. Study the architectural ideas that address
Hestia's likely long-term scene scale:

- GPU-resident instance data;
- compute-driven frustum and occlusion culling;
- indirect drawing;
- a frame graph with resource reuse;
- visibility/deferred shading;
- temporal antialiasing and measured dynamic resolution; and
- hierarchical spatial data shared by rendering jobs.

These ideas are relevant, but they are not a fix for the current cutter stalls.
The current P0 is CPU authority/physics work on the main thread. The approved
worker, registry, residency and island-scheduler work remains first.

Three.js `0.185.1` already exposes a credible path to prototype several Shade
ideas through `WebGPURenderer`, TSL compute and indirect storage buffers. A
renderer migration is nevertheless non-trivial in this repository:

- the backend contract constructs and types `THREE.WebGLRenderer`;
- Hestia's current sky uses `THREE.ShaderMaterial`;
- `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile()` customizations
  are not supported by `WebGPURenderer`;
- WebGPU initialization is asynchronous; and
- Three.js still calls `WebGPURenderer` experimental and notes that WebGL may
  remain faster for some scenes.

Therefore the next renderer step is a measured secondary-backend prototype,
not a mainline rewrite.

Rapier is the strongest physics comparison candidate. It should be benchmarked
behind a private adapter after the current deterministic worker/island model is
green. It must not silently replace Structural/Voxel Authority, body identity,
revision/hash binding or editable detached-body behavior.

`cannon-es` is not recommended for the core Hestia physics direction. It remains
useful as a readable JavaScript reference, but its latest visible release is
from 2022 and no evidence was found for the cross-platform deterministic,
worker-owned, large-scene contract required here.

ambientCG is suitable as an external CC0 source for selected PBR textures,
HDRIs and authored models. Assets must still pass a provenance manifest,
technical conversion, palette/style review and performance budget. It is not a
replacement for the voxel authority or for matching the Hestia concept art.

The Awesome Three.js and GEXP lists are discovery indexes only. Their entries
must be assessed individually; inclusion in a list is not adoption evidence.

Inigo Quilez's distance-function material is a valuable algorithm reference for
analytic terrain masks, procedural look development, conservative distance
bounds and selected GPU effects. SDFs may become an input or derived
representation, but they do not replace exact mutable Structural voxels.

## Evidence boundary

The current conclusions use:

- current repository code and package versions;
- official Three.js documentation;
- official Rapier documentation;
- project repositories for `cannon-es` and Awesome Three.js;
- ambientCG's license statement; and
- the linked Shade/temporal-upscaling forum reports as author claims and
  observed demonstrations, not as independent Hestia benchmarks.

No new package was installed. No external source code was copied. No benchmark
claim from another project is treated as a Hestia performance result.

## Current repository fit

Current browser package:

- Three.js `0.185.1`;
- no Rapier, Cannon, postprocessing or mesh-BVH production dependency;
- WebGL renderer ownership in `render/three/backend/threeRenderBackend.ts`;
- Hestia sky `ShaderMaterial` in
  `surface-play/environment/hestiaSurfaceEnvironment.ts`;
- existing `InstancedMesh` use for vegetation and water presentation; and
- an explicit worker protocol, scheduler, revision gate and transferable-buffer
  path already present in the project.

This means CPU authority work and renderer evolution can remain separate:

```text
Structural / World / Combat Authority
  -> immutable revision-bound presentation facts
  -> renderer adapter
       -> current WebGL backend
       -> later experimental WebGPU/TSL backend
```

No render backend may become gameplay or world truth.

## Option matrix

| Option | Classification | Near-term use | Hard boundary |
| --- | --- | --- | --- |
| Shade product | Do not adopt | None | Proprietary external engine; no purchase |
| Shade architecture ideas | Study concepts | Renderer roadmap and benchmarks | Reimplement from public concepts; no source copying |
| Three.js WebGPURenderer/TSL | Prototype behind adapter | Secondary renderer after P0 and Coast/Lush baseline | Keep WebGL fallback; port materials deliberately |
| Temporal upscaling | Revisit after WebGPU baseline | Dynamic-resolution experiment | Requires motion/history correctness and GPU timings |
| Rapier JS/WASM | Prototype behind physics adapter | Deterministic parity/performance spike | No authority takeover; no dependency before benchmark |
| cannon-es | Revisit only as reference | Small isolated comparison if needed | Not the main physics runtime |
| ambientCG | Adopt as external authoring source | Selected textures/HDRIs/models | Provenance, conversion, style and budget manifest |
| Awesome Three.js | Discovery index | Candidate discovery | Every candidate needs its own audit |
| GEXP list | Discovery index | Candidate discovery | Marketing/curation is not code evidence |
| IQ distance functions | Study concepts | SDF masks, bounds and shader research | Exact mutable voxel truth remains authoritative |

## Shade ideas worth reproducing independently

### GPU scene residency and indirect drawing

The useful principle is to keep stable instance/mesh/material records resident
on the GPU and let compute work produce visible draw commands. Three.js now
documents indirect storage buffer attributes for `WebGPURenderer`, so a narrow
experiment is possible without replacing Three.js.

The prototype must use a representative Hestia scene:

- terrain chunks;
- 1,000+ vegetation/prop instances;
- several material groups;
- changing visibility and origin-relative transforms; and
- frequent revision-bound replacement of a small subset.

Required measurements:

- main-thread render preparation p50/p95/p99;
- draw count and visible instance count;
- GPU render/compute time when supported;
- uploaded and resident buffer bytes;
- replacement/disposal stability; and
- WebGPU versus forced-WebGL output and performance.

### Hierarchical culling

Hestia should combine:

- world-owned spatial/residency facts;
- renderer-owned frustum and occlusion projections;
- conservative parent/fallback visibility; and
- newest-revision-wins buffer updates.

GPU culling is allowed to omit only presentation work. It must never determine
whether a world object exists, is damaged, collides or persists.

### Frame graph

A frame graph is relevant once Hestia has multiple postprocess, shadow,
atmosphere, water and temporal-history passes. It should own transient GPU
resource lifetime and aliasing, not gameplay scheduling.

Do not build a general frame graph before a measured pass inventory proves the
need. Three.js's WebGPU postprocessing stack should be evaluated first.

### Visibility/deferred shading

This may benefit a later dense city or forest with many materials and lights.
It is not required for the first Coast/Lush biome. The first biome should reach
the concept-art look with a small, controlled material set before a deferred
pipeline is justified.

### Temporal antialiasing and dynamic resolution

The linked temporal-upscaling report demonstrates the general value of:

- separate internal and output resolution;
- jitter-aware reconstruction;
- history rectification;
- longer jitter sequences at larger upscale ratios;
- mip bias during upscaling; and
- dynamic resolution driven by measured GPU/frame pressure.

For Hestia, this is a later quality profile. It requires:

- correct per-frame camera and object motion;
- history invalidation on teleport, origin shift and topology replacement;
- transparent/water handling;
- a stable non-temporal reference capture;
- no use of the current FPS counter as the only control signal; and
- hysteresis so resolution does not oscillate.

Start with a conservative 1.0 to 0.67 internal-resolution range. Extreme demo
scales are not an acceptance target.

## Rapier evaluation

Rapier's official JavaScript documentation states that the WASM/JavaScript
build is cross-platform deterministic when initial values and insertion/removal
order are identical. It supports snapshots, scene queries, rigid bodies,
colliders, joints and island management.

Those properties fit several Hestia needs, but the comparison must answer:

1. Can exact and adaptive voxel-derived compound colliders be updated without
   reintroducing long tasks or identity loss?
2. Can a worker own the entire physics world while Main receives bounded,
   revision-bound snapshots?
3. Are repeated runs byte-identical with the project's exact command ordering?
4. What are step, query, collider-update, snapshot and transfer costs for
   1/8/64/256/1,024 active logical pieces?
5. Can sleeping, wake, terrain replacement, tree fall and editable detached
   bodies preserve the current contracts?
6. Does a full-world snapshot become too large for routine transfer or
   persistence?

Prototype constraints:

- private adapter and isolated benchmark only;
- one pinned Rapier version;
- no package adoption until license, bundle, initialization and parity gates
  are documented;
- worker-owned world, not per-frame world cloning;
- deterministic canonical insertion/removal ordering; and
- no use of GPU compute for authoritative physics.

Rapier documentation warns that native Rust `parallel` and enhanced
determinism features are mutually exclusive. The JavaScript/WASM package's
documented deterministic behavior must be tested directly; native feature
claims must not be assumed to apply to the browser package.

## Asset and biome implications

ambientCG can accelerate ground, rock, bark and sky look development, but the
Hestia screenshots use a stylized, controlled palette. Selected assets should
be treated as source material:

1. record asset ID, source URL, acquisition date, license and source hash;
2. convert outside runtime into pinned project artifacts;
3. author color/roughness/normal intensity to the Hestia palette;
4. generate and budget texture variants and mip levels;
5. verify seams and repetition in the actual biome; and
6. keep voxel materials and collision independent from the texture source.

The Coast/Lush slice should first establish terrain forms, water placement,
atmosphere, silhouette and vegetation density. Texture detail cannot compensate
for wrong world composition.

## Ordered roadmap

1. Finish the current async Structural preparation, unbounded logical-piece
   registry/residency and continuation-based island physics.
2. Build and manually accept the Coast/Lush visual baseline on the current
   renderer.
3. Capture real scene budgets: draw calls, object/material counts, CPU frame
   preparation, GPU time, upload bytes and memory lifetime.
4. Run a secondary `WebGPURenderer`/TSL prototype behind the existing renderer
   boundary. Port only the minimum Hestia material set.
5. Compare GPU-driven culling/indirect draw against the accepted WebGL
   baseline.
6. Run an isolated Rapier parity/performance prototype against the current
   island scheduler.
7. Decide from Hestia measurements whether to migrate, combine approaches or
   retain the current engines.
8. Evaluate temporal upscaling only after motion/history data and a WebGPU
   baseline are trustworthy.

## Stop rules

- No Shade purchase or proprietary source dependency.
- No renderer rewrite to solve a CPU authority stall.
- No Three.js removal without a representative migration benchmark.
- No Rapier/Cannon dependency before deterministic parity and browser
  performance evidence.
- No GPU ownership of World, Combat, Structural or Physics truth.
- No temporal effect accepted from still screenshots alone.
- No external asset without provenance and technical conversion evidence.
- No benchmark claim copied from another machine/project as Hestia evidence.

## Sources

- Shade feature summary:
  <https://shade.company-named.com/features>
- Shade architecture discussion:
  <https://discourse.threejs.org/t/shade-webgpu-graphics/66969>
- Temporal upscaling discussion:
  <https://discourse.threejs.org/t/temporal-upscaling-webgpu/89989>
- Three.js WebGPU guide:
  <https://threejs.org/manual/en/webgpurenderer>
- Three.js TSL specification:
  <https://threejs.org/docs/TSL.html>
- Three.js indirect storage buffer:
  <https://threejs.org/docs/pages/IndirectStorageBufferAttribute.html>
- Rapier documentation:
  <https://rapier.rs/docs/>
- Rapier JavaScript determinism:
  <https://rapier.rs/docs/user_guides/javascript/determinism/>
- Rapier JavaScript initialization:
  <https://rapier.rs/docs/user_guides/javascript/getting_started/>
- cannon-es:
  <https://github.com/pmndrs/cannon-es>
- Awesome Three.js:
  <https://github.com/AxiomeCG/awesome-threejs>
- ambientCG:
  <https://ambientcg.com/>
- GEXP Three.js library list:
  <https://gexpsoftware.com/resources/best-libraries-for-threejs>
- Inigo Quilez distance functions:
  <https://iquilezles.org/articles/distfunctions/>
