# RD-00 v1 candidate freeze — lab only

This is the implemented RD-00 candidate, not HEAD acceptance, F01 export, an art
gate or product integration. `ProductIntegrated=false`. Original coordination
`EXECPLAN.md`, `RUN.json` and `input-package/**` are unchanged. Their Markdown
hardbreaks are original bytes, not authored whitespace defects.

## Frozen exports

| File under the lab | Public boundary |
|---|---|
| `src/contracts/fixture.ts` | `LabFixtureV1`, `LabFrame`, `SourceRef`, `LabPresentationProfile`, `LabObject`, `LabVoxelRegion`, `LabPayload`, `PayloadElementType`, `LabTypedPayload`, `Vec3`; `importFixture`, `getFixtureDigest`, `fixtureRevision`, `copyFixturePayload`, `readVoxel`, `validateSourceRefs` |
| `src/contracts/experiment.ts` | `LabFrameInput`, `LabWeatherSample`, `LabExperimentHandle`, `LabExperimentFacts`, `LabExperimentContext`, `LabExperimentFactory`, `LabPreset`; `createFrameInput`, `validateWeather`, `validateFacts`, `mountExperiment`, `registeredMountCount` |
| `src/contracts/scenario.ts` | `LabScenarioV1`, `LabKeyframe`; `createScenario`, `importScenario`, `sampleScenario`, `getScenarioDigest`, `createControlledClock` |
| `src/contracts/result.ts` | `LabMetric`, `LabRunResultV1`; `validateMetric`, `createRunResult`, `importRunResult` |
| `src/contracts/controlFixture.ts` | Diagnostic-only `controlManifest`, `createControlScenario`; not the RD-02 F00/F01 generator |
| `src/registration.ts` | `LabRegistration`, static `LAB_REGISTRATIONS`, `startControlPage` |

`validation.ts` is the shared bounded JSON implementation. No renderer objects,
product World/Save handles, dynamic module loader or executable scenario content
cross these boundaries. All V1 field lists are strict; there is no unknown-field
extension bag. HEAD alone owns contracts, registration, package/lock/config after
terminal handoff. Leaves request exact deltas rather than editing shared files.

## 1. Occupancy, known coverage and presentation halo

UTF-8 manifest bytes are limited to 1 MiB before decode. Aggregate advertised
binary bytes are limited to 128 MiB before payload access/copy/hash/numeric decode;
all actual byte lengths are checked before any private payload copy. No GPU work
is done at import. Each descriptor binds element type, endian order, element and
byte counts, relative path and full SHA-256. Private buffers live in a WeakMap;
`copyFixturePayload` returns a defensive typed copy. Freezing JSON metadata does
not pretend to freeze TypedArrays. Caller mutation during async SHA and mutation
of a returned payload copy are tested without changing the imported snapshot.

Voxel arrays are separate UInt8 binary masks in X-fast order:
`x + sizeX * (y + sizeY * z)`. Coverage=0 is unknown regardless of occupancy=0;
coverage=1 with occupancy=0 is air, and occupancy=1 requires coverage=1. Outside
the region is unknown. `readVoxel` never consults render meshes, shadows or halos.

Verified b3 coast source is v5, seed `hestia-hvp-lagoon-001`, quantum 0.125 m,
256x128x256, origin (-16,-8,-16), 8,388,608 slot bytes. Native slot **0 is known
air only inside successfully validated materialized coverage**; slots 1..4 are
material, not a preexisting Boolean occupancy mask. RD-02 must explicitly adapt
these slots and retain the native byte/hash binding, not import slot 4 as a
Boolean. `meshHvpCoastSource` defaults to a 4 m analytic ghost/join context. That
context is presentation-only, never expanded known coverage. Exported join/far
mesh descriptors set `presentationOnly: true`; absence of a voxel region does
not become air. Mesh bounds refer to actual positions in the object's frame,
including render-only geometry where present.

## 2. Concrete product presentation, not a style framework

Product-derived manifests require `presentation: LabPresentationProfile` with
bound `sourcePaths`, linear-sRGB material components, sRGB output, concrete
tone mapper/exposure, ambient/key/fill light colors/intensities/positions and
background/fog range. Referenced paths must occur in the source references.
Product material entries explicitly include opacity, depthWrite and doubleSided.
Optional per-mesh normals/colors are endian+SHA-bound numeric payload IDs with
exactly the position element count; colors require `colorSpace: linear-srgb`.
Missing colors mean no exported vertex colors, not invented white/AO evidence.

Read-only b3 evidence: `look.ts` defines readable-coast-v6, ambient 0xbfd9e8 /
ground 0x8c9376 at 0.85, key 0xffe2b0 at 2.3 and (-28,42,-18), fill 0x6fa8d8 at
0.9 and (30,18,26), background 0x87b5d9 and fog 48..170 m. Native
`visualEffects.ts` binds ACESFilmic and exposure 1.05; pinned Three 0.185.1's
WebGLRenderer defaults to sRGB output. The source's normals/vertex-color payloads
must be preserved, including vegetation palette/AO colors. Declaring these data
does not implement native shader hooks, PCF shadows, water glint or the sky.
Those render/material operations are outside RD-00. A product-derived visual
control remains unqualified until RD-02 export and RD-03 projection are verified.

## 3. Digests, revisions and namespaces

Product `SourceRef.sourceDigest` is a bounded semantic identity, not a SHA-256.
b3 coast currently emits eight lowercase hex FNV characters. Concrete source
files separately bind `sha256` and optional full 40-character `blobSha`; payloads
always bind full byte SHA-256. `LabRunResultV1` separately names semantic
`sourceDigest` and full `sourceBytesDigest`; fixture/scenario/build/lock digests
are SHA-256. Raw logs/media are not part of fixture identity.

Fixture `sourceRevision` is the explicit snapshot/frame revision, NOT max(owner
revision). Each object has its own `sourceRevision`, stable `ownerId` and
`sourceNamespace`. Source IDs are scoped by (ownerId, sourceNamespace, sourceId).
An attachment's sourceIds resolve in ownerId; supportIds resolve in its explicit
supportOwnerId and that owner's namespace. Cross-owner terrain support is valid;
using an instance index or finding an ID only on the wrong owner is not.

Source reference validators validate the pinned declaration/binding shape; they
do not authenticate Git history in a browser. RD-02 must actually resolve pinned
blobs, verify byte hashes and native semantic digest and record exporter inputs
before any F01 product-derived claim. The unit product-binding control deliberately
uses test geometry and is not an F01 export. RD-00 only read and hashed the six
named b3 files; it did not run product code or produce a product fixture.

## 4. Lifecycle and deterministic replay

Handle methods remain exactly setFrame / replaceFixture / readFacts / dispose.
A canvas slot is reserved before async init; duplicate mounts and pre-init abort
fail without another factory. Init-abort disposes a late returned handle.
Disposal is idempotent, aborts the factory's lifecycle signal, waits for pending
replacement, disposes once and releases the registry slot even if cleanup throws
(the explicit caller receives that error). Factories own their native cleanup.

Replacement is serialized. Frames/facts are blocked while replacing/disposed;
after abort a late build cannot publish through the wrapper. Factory candidates
must be private/transactional and check their lifecycle signal/build generation
before native adoption: the wrapper cannot revoke a factory's leaked resources.
Facts must match the exact adopted fixture digest/revision. Stale facts and stale
frames fail. Backward seek may deliberately replace revision 3 with revision 0;
revision numbers are snapshot identities, not a monotonic execution counter.

Time is tick/60, never Date.now/rAF time. Pause stops advance; seek derives the
selected full snapshot, camera, weather and last ResetLab tick from frozen replay
data. ResetLab is a reset marker, not a native Cut/Detach/solver action. A stateful
effect must reconstruct from these canonical inputs and clear its private cache
on reset (or dispose/remount on the SAME host); no new reset handle method is
invented. The RD-00 Canvas2D control has no historical simulation cache.

## 5. RD-00 versus RD-03

RD-00's one Canvas2D diagnostic marker is not a Three host or art baseline. RD-03
implements `src/runner/threeHost.ts` with exactly one renderer, scene, camera and
renderloop. It defines ThreeLabEffectContext with borrowed scene/camera, the
current imported read-only fixture, stable owner-pose lookup and common
frame/capabilities; effect exports are mountThreeEffect/setFrame/replaceFixture/
readFacts/dispose. Standalone wrappers reuse that host. Effect modules must not
make another renderer/rAF or own product state.

RD-03 freezes only the actual material channels needed: RD-14 solid/water owns
those materials, RD-21/22 own decoration, RD-31/33 own particles, RD-32 uses the
offered wetness/water channel, RD-15 requests a view-only occlusion pass. No
generic ECS/plugin framework or competing onBeforeCompile assignment is supplied
by RD-00. Combined depth/shadow/color behavior remains a future RD-03/RD-51 gate.

## 6. Static scenario and pinned exporter invocation

Only registration now is RD-00 / contract-control / preset diagnostic /
scenario RD00-CONTRACT-CONTROL. `createControlScenario` binds the private empty
synthetic snapshot, 60 Hz, 3600 ticks, camera diagnostic, calm weather, no scripted
commands or snapshots. Replace builds a new validated fixture AND scenario;
UI/facts expose their real digests. F00/F01..F07 and their concrete scenario files
are RD-02's work, not aliases to this marker. After handoff HEAD performs any
static imports/registration or shared script/dependency delta.

Verified native TS probe (CWD = lab):

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' --experimental-strip-types './reports/RD-00/native-ts-smoke.mts'
```

Required RD-02 invocation template, **NOT_RUN here** (CWD = lab):

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' --experimental-strip-types './exporters/export-b3.mts' --source-commit b3c6523a94cd050f5a9a22dc27f4777fcc03363e --output 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02/fixtures'
```

The exporter does not exist in this leaf's allowlist. Node stripping is not a
typecheck and does not resolve native extensionless/directory TS imports. RD-02
must stage only the required immutable dependency graph in its OWN run directory,
record original blob/byte hashes and any import-only staging rewrite, and resolve
explicit TS paths without executing the product bootstrap/solver. No live worktree
read, broad product source copy, product install or unpinned tsx/npx loader is
authorized. Additional source dependencies must be byte-bound before execution.

## Measurement and boundary status

Measured/estimated numeric metrics require finite nonnegative values; estimates
also require a reason. Unsupported/not-run must have a reason and NO value key,
including no zero, null or undefined. Sample failures remain in the denominator.
The real result record is diagnostic/process-cold, one planned/observed sample;
CPU/frame/upload/heap are not-run, native GPU memory/driver unsupported. No GPU
timing, comparison score, performance, art or Product-ACCEPT is asserted.

Boundary checks committed tree vs b3, all committed delta vs RD start, index,
working tree, untracked paths (including ignored paths outside the lab), input
bytes and symlink/junction/reparse escapes.
Rename detection is disabled for inventory so an outside source deletion cannot
hide behind an allowed destination. Own external runs/oracles are artifact state,
not product writes. User-authorized exception is ONLY untracked regular contained
`.opencode/throughput.jsonl` and `.opencode/throughput.md` in this RD-owned
worktree (synthetic tests exercise the same policy in owned oracle repositories).
Tracked/staged/committed copies, third files and link names still fail. These real
automatic logs were not edited/deleted/moved/staged/committed by RD-00. No global
config/plugin/cache change and no claim that collectors stopped. Consequently
the original all-files gate is `FAIL_ACCEPTED_NARROW_EXCEPTION`, not a clean PASS.
