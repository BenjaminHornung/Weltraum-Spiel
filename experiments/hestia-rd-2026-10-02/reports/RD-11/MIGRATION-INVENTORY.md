# RD11 migration inventory — partial frozen presentation, not Product

ProductIntegrated=false. C0 is unchanged RD03 WebGLRenderer/MeshLambertMaterial.
C1 is WebGPURenderer forceWebGL with Lambert node/TSL materials; C2 requires an
observed WebGPU backend using the SAME node/TSL projection. Class name is not
evidence. Phase1 observes CPU objects/doubles only: native modes 2 planned,
0 observed, 2 NOT_RUN; no current GPU identity or successful native init claim.

## Frozen inputs and port

The import boundary, payload/manifests, source revisions, owner IDs/namespaces,
frame composition, cameras and replays stay unchanged. No geometry reduction.
Reuse RD03's Float32 projection tolerance 1e-5 m and scenarioRunner ordering:
await complete replacement, then resetTick, then frame. Private node geometry
candidates also await shader compilation before adoption; no renders while
pending; failure retains the old complete projection. Reset/backseek rebuilds,
resize invalidates submitted-frame facts, terminal loss does not recover.

| Axis | Implemented declaration |
|---|---|
| Geometry | Exact private position/index/normal/color copies; optional normals computed like C0; groups and stable owners preserved |
| Material | MeshLambertNodeMaterial; TSL materialColor/materialOpacity; vertex color applied once; linear-SRGB source colors |
| Depth / sides | Declared opacity/transparent/depthWrite; depthTest=true; FrontSide/DoubleSide; water renderOrder=1 |
| Emission | Declared emission role copies linear color into emissive and uses materialEmissive |
| AO | Frozen AO remains encoded in exact vertex-color bytes; NOT new AO generation or native AO parity |
| F01 | hvp:readable-coast-v6; ACES exposure1.05; fog48–170; bound hemisphere/key/fill colors/positions/intensities; SRGB output |
| F04 / F06 | Actual synthetic NoToneMapping/exposure1/noFog; hemisphere0.85/key2/fill0.5 and frozen camera profiles, not coast style |
| C1 / C2 quality | Same requested HalfFloatType / samples4 / antialias=true; actual backend/compatibility/sample/format observations separate from requested values |

## Every known native missing feature

Immutable source audit used ONLY Git objects at product base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`, SHA-checked against F01 refs:
look.ts `1c058c73d4313b6da757b341f6dad66173d73332d169d7dbe04710b96c0219ea`,
visualEffects.ts `b02f1d1a114fd143201fd7f516c6bec52dd574d3e511fdc09aa5ffd7931ba31f`,
blockAmbientOcclusion.ts `ddfb1d22eccdcb83e48f8c21d82605339936600a6afbbc452bdcdce497ca7675`.
Full audit is retained outside Git as `native-feature-source-audit.json`.

| Native source feature | C0 / C1 / C2 limitation |
|---|---|
| PCF shadows | Disabled: no native 1024² depth map, cast/receive selection (coast/tool/salvage exclusions), shadow-side/clipping/bias/map-size fidelity |
| Shadow revision cache | No native revision capture/budget, invalidation/reuse/needsUpdate cache or shadow lifecycle; not implied by node lighting |
| Opaque onBeforeCompile hook | No world-space strata modulation (`0.96 + 0.055*strata`), varying injection or native customProgramCacheKey/surface hook tracking |
| Water shader | No stationary surface ripple normals, view Fresnel color mix or directional high-power glint; native hook does NOT displace geometry or create physical waves |
| Water pass policy | Native forceSinglePass=true is NOT ported; frozen C0/node declarations retain their normal material pass policy and declared sides/opacity/depth/order |
| Procedural sky | No camera-centered radius600 sphere, gradient/horizon sky, 256² baked repeating cloud noise texture, fog=false/toneMapped=false sky shader, or sky draw/texture lifecycle |
| AO recomputation | No live block AO/recomputation/unknown-coverage algorithm; imported vertex colors are preserved, not a full-color replacement for AO |
| Weather hooks | Weather frame metadata is replayed; no weather-driven wetness/wind/material/sky/water hooks or invented visual effect success |

These remain explicit unsupported features. Static declared background and water
material are only the frozen V1 presentation, NOT substitutes that grant native
sky/water/shadow/AO acceptance. Missing-native feature gates reject full color.

## Effective axes / evidence limits

Scene conversion target and final canvas are distinct. Read actual native texture
format/sampleCount (WebGPU) or pinned GL internal format plus native renderbuffer
RENDERBUFFER_SAMPLES with prior binding restored (WebGL). Requested samples and
final-output currentSamples are never substituted for scene MSAA. Native GL zero
means no MSAA. Compatibility can disable requested samples. Unavailable axes are
UNSUPPORTED / NOT_RUN, not invented values. Native context alpha/format differences
and framebuffer precision still require Phase2 observation.

C0→C1 includes a material/pipeline and output-buffer-quality port, not pure backend.
C1→C2 is a cleaner comparison ONLY after actual backend, effective MSAA/format
and visible parity; none of those native acceptance gates pass in Phase1.

Ready REN12 image oracle covers fixed F01 C01-EYE geometry-depth, baked-AO and
water-material ROIs; thresholds frozen before results. Other F01 cameras and
synthetic material/depth ROIs are NOT_RUN/not yet in that image matrix. REN13
ready native cases cover all F04/F06 source transitions and reset/backseek, but
GPU buffer/depth readback is NOT_RUN. Full native shadow/AO fidelity UNSUPPORTED.
All screenshots/browser/native init, optimized RD11 entry and UI validation wait
for HEAD wiring plus a new immutable snapshot. Q0 100 updates/20 cycles is CPU
controlled only; Q1/Q2, target GPU/performance, memory measurement, art and Product
acceptance are NOT_RUN. Native GPU bytes UNSUPPORTED, never zero-valued claims.
