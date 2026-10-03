# RD-10 renderer shortlist — Phase 1, no engine ranking

**Keep Three 0.185.1 for the controlled comparison.** This is a bounded port
decision, not a speed, target-GPU, art or product acceptance result.
ProductIntegrated=false. Historical engine bake-off R03 is unavailable and
unresolved; it is neither Reddit RR03 nor the present RD03 fixture runner.

## Verified APIs and port boundaries

| Candidate | Verified interface | Concrete port cost / barrier | Current availability |
|---|---|---|---|
| C0 Three 0.185.1 MIT | `WebGLRenderer`; existing RD03 uses `MeshLambertMaterial`, canonical geometry and material slots | Lowest incremental integration cost; retain existing control. Product PCF shadows, procedural sky and GLSL water hooks are **not** reproduced by C0 | Existing RD03 host; no optimized RD10/profile evidence |
| C1 same Three version | `three/webgpu` `WebGPURenderer({forceWebGL:true})`, `three/tsl`; **await `init()`** | Node/TSL material port is required even with WebGL backend. `onBeforeCompile` and `customProgramCacheKey` are WebGLRenderer-only; not a renderer-constructor swap | NOT_IMPLEMENTED |
| C2 same Three version | `WebGPURenderer`, await `init()`, then inspect actual `renderer.backend` | Reuse exactly C1's geometry and TSL materials. Default renderer can fall back to WebGL; inspect backend, surface absence/failure, never relabel fallback as WebGPU | NOT_IMPLEMENTED |
| Babylon 9.29.0 Apache-2.0, research only | `WebGPUEngine.initAsync()` returns adapter/device initialization promise; await it, not just constructor/`IsSupportedAsync` | Separate mesh/material/lighting ownership port. GLSL translation paths may load glslang/twgsl; no CDN/loader request is authorized here. HEAD must freeze the exact package/lock and offline shader policy with RD12 before any B profile | NOT_INSTALLED; no B profile authorized |
| PlayCanvas 2.23.0 MIT, research only | Await `createGraphicsDevice`; it appends WebGL2 fallback. Actual backend is `device.deviceType` at this pinned commit | Full application/material/resource ownership port has no named RD10 need; do not propose it. GLSL chunk translation requires explicit loader policy | NOT_INSTALLED; no full port proposed |

The request's “actualType” requirement means inspecting the **actual selected
backend**, not trusting requested device types. The pinned PlayCanvas public
getter is `deviceType`, not an invented `actualType` property. Registry version,
license, source commit, exact official source hashes/excerpts and installed
Three-byte equality are retained in [source-evidence.json](source-evidence.json).
No physics engine/solver change or Rapier import/initialization occurred.

## Frozen comparison axes

[comparison-freeze.json](comparison-freeze.json) binds actual F01/F04/F06
inventory entries, every snapshot manifest/payload hash, revision, source refs,
material descriptors, cameras and scenario/weather/keyframes. Unit imports
validate canonical digests and private payload ownership, not just JSON fields.

F01 retains readable-coast-v6, linear-sRGB material inputs, SRGB output, ACES
exposure1.05, fog48–170m and prescribed lights/water descriptors. F04/F06 retain
the **synthetic** RD03 NoToneMapping/exposure1/no-fog look, not coast styling.
No dependency upgrade, geometry reduction or asymmetric quality is an axis.

C0→C1 includes a material/pipeline port and potentially output-buffer quality;
it is **not** a pure backend comparison. C1→C2 is cleaner **only after** feature
and visual parity, actual backend, effective samples and output format are
proved. Request the same sample/output-buffer policy for C1/C2. The pinned
Three WebGPU compatibility path can set samples to0; the renderer default
HalfFloat output-buffer type versus SDR/UnsignedByte is a quality/bandwidth
axis, not free performance. Effective values remain NOT_RUN in these profiles.

## Bundle/file cost evidence, not runtime timings

[bundle-costs.json](bundle-costs.json) records exact file hashes/bytes and Node
gzip bytes. Existing RD03 output contains a 549,551-byte shared Three/control
chunk (139,751 gzip bytes) and an 8,480-byte runner chunk (3,589 gzip bytes).
Those are measured **file** costs, not isolated engine or RD10 bundles. Vite's
reported gzip defaults differ from this explicit Node gzip calculation.

Installed minified input files: Three module365,552, core385,386, WebGPU667,861,
TSL23,676 bytes. These are input-file proxies, **not** complete tree-shaken
C1/C2 transfer sizes; do not add or compare them as optimized profile bundles.
Registry unpacked sizes (Three23,172,772, Babylon UMD113,487,308,
PlayCanvas90,083,507 bytes) are declared archives, not runtime allocations or
bundle measurements. Babylon UMD size does not estimate a modular core build.
Optimized C1/C2/Babylon/PlayCanvas bundle sizes are NOT_RUN without values.
Port-cost statements above are qualitative estimates, not measured timings.

## Capability evidence and decision gate

The real native probe initializes separate fresh canvases and submits a triangle
for WebGL2 and WebGPU. It implements **none** of C0/C1/C2 or canonical fixture
rendering. [capability-report.json](capability-report.json) separates measured
logical counts, reported device caps/configuration, unsupported native GPU
bytes and not-run timings. WebGPU's renderer identity stays unknown even when
its vendor is reported. Software/fallback/headless/unknown is never qualified.

Final DEV run:4/4 browser tests;2/2 modes initialized/submitted;10 owned
open/close cycles,0 failures,0 skipped. Both screenshots were inspected.
WebGL2 effective samples4; WebGPU1, canvas formatbgra8unorm. This asymmetric
triangle smoke is **not a benchmark**. No GPU-ms, rAF-time-as-GPU-ms or native
allocation estimate is claimed. Root build builds RD00/RD03 only.

Optimized RD10 browser dimension: **NOT_RUN_PENDING_WIRING**. HEAD must review
and integrate this code, import the actual factory and add the actual HTML
input, then supply this same leaf a new START/freeze for Phase2. Target-GPU,
performance lease, art and product acceptance remain separate, ungranted gates.
