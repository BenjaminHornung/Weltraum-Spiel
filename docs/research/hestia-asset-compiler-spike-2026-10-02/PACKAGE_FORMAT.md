# C6 research package: executable format, support and handoff

Date: 2026-10-03. Applies only to `hestia.asset-compiler-spike.v1` and `hestia-asset-compiler-spike-c6-v1`. This is NOT `hestia.asset-manifest.v1`, HVOX, a runtime adapter, full corpus acceptance, or product integration. C7/C8 are NOT AUTHORIZED. `PRODUCT_INTEGRATED = NO`.

## Functional API and source admission

`package.compile_core(glb_bytes, report_bytes, profile_id)` requires exact delivered GLB **and** sidecar bytes. `compile_files` bounds both source files before reads; file-descriptor aliases are forbidden. `compile_to_directory` checks lexical output admission before reading inputs, then uses the same core and publisher. `verify_files` / `verify_package` inspect actual bytes rather than trusting the generated manifest. No CLI exists at this checkpoint.

Profiles are explicit: `micro-0125-research-v1` = 0.125 m, `standard-025-v1` = 0.25 m. No default. Current frame remains metersPerUnit 1, RIGHT, +Y up, +Z forward.

`admission.admit_pair` accepts the CURRENT closed `{payload,digests}` report:

- Payload: `schemaId`, `semantics`, `glbSha256`, `inventory`, `options`, `outputBasename`, `diagnostics`.
- Digests: `glb_sha256`, `report_sha256`. Both GLB fields equal SHA-256 of exact delivered bytes; null/Error reports reject.
- Options: `requireSchemaId` = current schema, `unappliedScalePolicy` exactly ignore/warning/error, finite `unappliedScaleTolerance >= 0`. Zero is valid.
- Canonical semantics root: schema/asset/parts/joints/markers/materials only. Closed records, enums, exact IDs/references/parent graph and GLB transport projections must agree, even after an attacker recomputes digests.
- Inventory validates current material/mesh/primitive fields, topology counters, nullable local bounds and references. It does NOT turn evaluated vertex counts, local bounds or slot-derived primitive IDs into baked geometry identity. UV/normal vertex splits do not require false count equality.
- Warnings are admitted after validation, but their untrusted messages/paths are NOT copied into any output. Only severity counts survive. Source inventory/options go to source-only provenance. Output paths never come from report basename or IDs.

Input byte/depth/token/shape checks and digest rejection precede world expansion, raster or output generation. Existing reader and actual C3 baked topology remain mandatory; a passing report is not geometry proof. Existing pure `tools.blender.hestia_asset_authoring.canonical` functions are reused READ ONLY with Python `-B`.

## Files and manifest

Four canonical UTF-8 JSON files (no added newline/BOM): `asset-manifest.json`, `diagnostics.json`, `provenance.json`, `compile-report.json`; plus `bricks/<stable-key>.bin`. No encoded full cell lists, geometry repair, physical registry, timestamps, host/user/locale/path/benchmark fields or source warning messages.

The manifest includes schema/profile/compiler/algorithm versions; asset ID/revision/full canonical asset; source GLB/raw report/canonical-payload hashes; frame/meters/cellMeters/16/x-fastest; actual occupied per-Part grid bounds; all canonical materials/parts/joints/markers and composed world placements; material slots; owned brick address/key/path/4096-byte length/SHA; thin decisions/replacements; classification proofs; diagnostic summary; geometric inputs; three content hashes and full tree hash.

Air is byte 0. Active slots 1..255 sort `(renderMaterialId, structuralMaterialId or "")`; optional authoring `paletteIndex` remains in original semantics, NOT a byte slot. Unused declarations/preserved nonvoxel parts consume no slots. Each brick key binds Part ID, floor-divided brick coordinate and address version; x-fastest byte index is `x + 16*y + 256*z`. All-Air bricks are omitted. Different Parts never overwrite or XOR each other.

## Exact executable hash preimages

Let `CJ` be the existing READ-ONLY `canonical_json_bytes`, and `S` lowercase SHA-256. Its semantic collection/tag sorting and negative-zero behavior remain unchanged; ordinary arrays such as shell layers retain their order. No plain-json replacement and no source rewriting.

```text
sourceGlbSha256       = S(exact delivered GLB bytes)
sourceReportSha256    = S(exact raw sidecar bytes)
authoringPayloadSha256= S(CJ(report.payload))  # neither digests member participates
```

`normalizedGeometrySha256` and `semanticsSha256` preserve the C3 owning preimages:

```text
normalizedGeometrySha256 = S(CJ({algorithm: GEOMETRY_VERSION,
  coordinateFrame: canonical asset frame, metersPerUnit: 1,
  triangles: [{partId, renderMaterialId, vertices}, ...]}))
semanticsSha256 = S(CJ({semantics: full canonical authoring root,
  placements: stable (kind,id)-sorted composed world matrices}))
```

Triangles are baked Float64 meters, sorted by stable Part/material IDs and cyclic oriented vertex key. List permutation is NOT winding reversal.

`voxelizationSha256 = S(CJ(V))`, where `V` contains **exactly** these manifest fields:

```text
schema, profileId, algorithmVersions, cellMeters, brickCellsPerAxis, cellOrder,
gridBounds, materialSlots, bricks, thinFeatureDecisions, classificationProofs,
geometricMassInputs
```

The canonical semantic manifest projection is **every manifest field except exactly** `sources`, `provenanceSha256`, `manifestTreeSha256`. Thus it includes compiler/algorithms/profile, asset/revision/frame, all semantics/world placements, materials/slots/ownership/addresses/brick hashes, thin/proof/geometric data, diagnostics summary and all three content hashes. It does not conceal meaningful fields. `compile-report.json.semanticProjectionSha256 = S(CJ(projection))`.

Full tree algorithm `spike-virtual-manifest-tree-v1`:

1. For actual `asset-manifest.json`, parse it and make **virtual** canonical bytes of the manifest with ONLY its own `manifestTreeSha256` field omitted.
2. For every other file, use its exact actual bytes.
3. Sort relative file paths lexically; create entries `{path, byteLength, sha256}` using those bytes (the manifest entry length/hash are explicitly virtual).
4. `manifestTreeSha256 = S(CJ({treeVersion: "spike-virtual-manifest-tree-v1", files: entries}))`.

`compile-report.json` contains content hashes/counts/projection hash but **no tree hash**. `provenance.json` is actual source-only bytes and is bound by `provenanceSha256` and the full tree. There is no self/cross hash recursion. Empty directories are not tree entries; publisher creates an empty bricks directory for no-brick packages.

Same raw inputs/profile/versions require ALL file bytes/full tree identical (two-generation C6 smoke). Correctly remapped input-order permutations require content hashes, owned-address brick bytes and semantic projection identical; raw source/payload/provenance/full-tree hashes truthfully MAY differ. Full 30-case/10-repeat determinism remains C8 NOT RUN.

The verifier recomputes canonical bytes, source-binding field shapes, semantic/placement hash, actual decoded slots/owned addresses/grid bounds/geometric inputs, brick lengths/SHA, voxel/projection/provenance/tree hashes and file inventory. It rejects links/reparse points and unexpected files. **Integrity/format verification is not a new geometric admission proof from hashes alone**: external verification without original GLB/report cannot reconstruct their triangles or authenticate an attacker who replaces every file/hash. `compile_core` does the source/math admission before generation; staged verification binds those generated bytes before publication.

### Frozen focused example, not a full corpus record

Actual `tests/package_fixtures.pair()` cube `asset.test`, Part `part.a`, micro profile: 1000 owned occupied cells, eight bricks, four JSON files, **12 files / 41,295 actual bytes**. Verified example and independently selected preimages are pinned in the focused test; no source Blender export is implied.

| Binding | SHA-256 |
| --- | --- |
| raw GLB | `56debcd38e417ac923a9d9decf9d6a050ca3497c264ab8622e06ed3b39c521c8` |
| raw report | `035a6c8b9e2366775cc5fe038422a168db0862700ee32630a3f92631c4d06c1f` |
| canonical payload | `b9d2d5ffbf8c8661571f9bc0f59e59d3f0d42fe4937317af68aca4c3406f4097` |
| normalized geometry | `ef800a811d3923679542677ce57af817810ed0639b2c41403a6150494a9a581e` |
| semantics | `f0d55d068211fef06d4b1be7928cbea36f3c9cf00495c74e2b94263bed29b8a5` |
| voxelization | `efd516378771d891b82988f36c99a7e2b6beb40fc131b36f6f0e87b6b589c78f` |
| semantic projection | `1604d8716a181d3f3c580ed31d98c9f60dc686e033fea08ea7110ab83da9bff6` |
| full tree | `d9a27b06a65a37b6c7af4c75b58ad327c1fe9c04452fcf96a03bfecc75f4494b` |

First brick owner `part.a`, coordinate `(-1,-1,-1)`, raw length 4096, key `ec48b9d0e5fc52e00e519a47be16339aa468a68219ece939e507020c752565ca`, data SHA `6c5de134c73c3dfd32c35ca90acc9ab4e4808a3af7db0f82637050b8c4510255`.

## Thin proof scope and usable preservation

`spike-orthogonal-section-two-samples-v1` uses a spike-local threshold **2*h** (one cell sample + one cell reconstruction margin): 0.25 m / 0.5 m. This is NOT a product default or general minimum-thickness theorem.

For an actual closed orthogonal Solid, all source facet planes form the bounded exact arrangement used by C5. Exact parity classifies every open region; every complete material run on every axial section is measured. This is not a declared minimum or global AABB measurement. The exact shortest run, a real section witness and fully specified decimal-ratio endpoints are recorded; Float64 display values do not decide threshold admission. A just-under-threshold dyadic witness rejects even if its rounded display equals the threshold. All arrangement/run/classification work is aggregated before source sets; caps are unchanged.

Outcomes:

- `Voxelized`: all measured axis sections meet 2*h, homogeneous explicit bindings agree, then C5 topology proof still must succeed. G01/G02/G13/G27 mandatory positive oracles are not replaced by rejection.
- `RejectedTooThin`: an exact real material-section witness is below threshold and policy Reject applies. Overstated authored minimum stays unchanged and cannot bypass it.
- `RejectedUnprovenThickness`: unsupported section/replacement proof or requested unsupported shape; whole asset rejects, no half-success publication.
- `PreservedSemantic`: real reconstructable parameters, not a policy string.
- `DecorativeOnly`: explicit nonvoxel semantics retained; no payload/pseudo mass or guessed fallback for unowned geometry.

`spike-box-beam-single-layer-shell-v1` preserves only:

- **RectangularPrismBeam**: the actual orthogonal source arrangement proves exactly one box (six measured facet planes and one complete material region), not an AABB guess. Long axis must be at least four times both transverse extents. Output includes exact baked world bounds, axis, length, cross-section and render/structural binding.
- **RectangularSingleLayerMidplaneShell**: actual nonoverlapping planar triangles prove exact rectangular coverage with consistent normal; one declared layer agrees with explicit binding/thickness. Output includes measured world rectangle/normal and explicit symmetric-about-midplane extrusion convention, thickness and untouched layer intent. This is an analytical representation, NEVER Solid fill or measured volumetric wall thickness.
- **SemanticAssemblyGraph**: geometryless StructuralAssembly keeps all original semantic/world/joint/marker data plus explicit child IDs. It does not invent physical geometry.

Generic rods/cylinders/tubes and multilayer physical stacking are not proven; a tube never becomes a filled rod. Model layer sorting is not changed; generic canonical helper does not reinterpret layer order. Material rule `spike-unanimous-explicit-binding-v1` rejects conflicts among explicit geometry/Part/asset-default structural bindings rather than inventing precedence. Missing structural ID stays unbound.

## Geometric inputs, not physical mass

`spike-owned-cell-geometric-inputs-v1` groups ADMITTED decoded cells by `(partId, structuralMaterialId or null)`: integer cell count, h³ cell volume, raster occupied volume, exact deterministic cell-center coordinate sums (meters), inclusive cell bounds and world span. Source analytic volume/COM are separate test oracles, not substitutes for raster truth. Overlapping Part contributions are explicitly **not net unique physical volume**. Unbound records say `UnboundGeometry`; no registry ID, density, kg, inertia or second moments are invented.

## Budgets and atomic publication

All `spike-budgets-v1` numbers remain unchanged. C5 was split only to expose functional `classify_cells` before packing; old `classify_geometry` behavior/tests remain. Core counts actual addresses/slots, conservatively bounds all JSON bytes/depth/tokens before canonical copies/encoding, and checks metadata + binary total before ANY 4096-byte brick payload allocation. Each JSON remains bounded by 4 MiB/250,000 tokens/depth 64; total output 64 MiB, 8192 owned bricks. Actual serialized lengths are checked again. No large cell list is serialized.

Publication supports **local fixed/removable Windows drives only**, admitted using native drive type. UNC/mapped network, POSIX and reparse parents are rejected rather than pretending portable atomic no-replace semantics. Existing lexical targets (file/empty/nonempty dir/link/broken link/junction) reject before temp creation; no `resolve()` follows away the target. Caller must own a stable regular parent; hostile concurrent parent replacement is outside this bounded local test contract. This is atomic generation visibility, not a power-loss durability/fsync promise.

Build one owned unique sibling staging generation, close each file handle, verify actual staged files, then one Windows `os.rename` no-replace directory operation. A collision after precheck preserves even an empty foreign target; no filewise publish/merge/delete/replace. Only THIS invocation's staging is cleaned. Foreign stale siblings and existing outputs remain untouched. Source IDs/basename never select file paths.

Actual fault evidence includes temp/unwritable-parent mocks (no ACL change), after first brick, before manifest, staged verification failure, corrupt brick, rename failure, and real native publish collisions with empty/nonempty targets. Actual existing file/empty/nonempty directory, junction and **broken junction** guards ran. Native symlink/broken-symlink creation was attempted but failed **WinError 1314**; these two native cases are **NOT RUN**. Separately named lexists mocks prove only unit branch behavior, NOT native symlink evidence. No privilege/ACL changes or skip concealment.

## Partial G01-G30 main inventory and handoff

EXACTLY G01-G30 remain the main inventory; variants stay under each ID. These are focused unit/support outcomes, **not** final corpus records/source hashes/30-case acceptance. Future C8 must execute and record every case/profile or explicit reasoned BLOCKED per package checklist. No `CORPUS_VERIFIED=YES` is inferred from test count.

| ID | Current support/evidence; remaining limit |
| --- | --- |
| G01 | Full package SUCCESS, independent occupied sets/decoded bricks/geometric sums, both profiles |
| G02 | Full package SUCCESS, noncube intervals, both profiles |
| G03 | Negative coordinate geometry/surface/address tests; full corpus record NOT RUN |
| G04 | Origin crossing partial tests; full corpus record NOT RUN |
| G05 | Exact 90-degree MATRIX package SUCCESS; common 90-degree TRS quaternion bakes 12 valid triangles but NOT VOXELIZED / `thin.unproven` |
| G06 | General finite TRS/shear GEOMETRY BAKING PASS; diagonal/nonorthogonal Solid compile BLOCKED by proof scope, not invalid rotation |
| G07 | One/two mirror geometry tests; Error exporter reports still reject; full corpus record NOT RUN |
| G08 | Reused mesh Part ownership tests; full corpus record NOT RUN |
| G09 | Overdeclared thin plate correctly RejectedTooThin; exact dyadic margin regression |
| G10 | Proven box-beam PreservedSemantic with usable world parameters/no brick pseudo mass |
| G11 | Tube/unsupported rod replacement RejectedUnprovenThickness; analytical rod SUCCESS BLOCKED |
| G12 | Proven single-layer rectangular shell package preserved; unsupported multilayer replacement BLOCKED |
| G13 | Mandatory full Hollow SUCCESS sets/brick bytes/geometric sums both profiles and BOTH inner winding variants |
| G14 | Narrow micro path PASS/coarse TopologyLoss; wide/phase controls both profiles C5 PASS; full corpus record NOT RUN |
| G15 | Disconnected/merger C5 proof tests; full corpus record NOT RUN |
| G16 | Order-independent ambiguity reject allowed; no invented multimaterial selector; full corpus record NOT RUN |
| G17 | Semantic hierarchy and world ownership retained; full corpus record NOT RUN |
| G18 | Valid joint world placement package evidence; invalid ancestor negatives retained |
| G19 | CutInterface/marker world placement package evidence; full corpus record NOT RUN |
| G20 | Actual open Solid rejection tests; no report-count substitution |
| G21 | Actual nonmanifold edge/fan rejection tests |
| G22 | Degenerate/duplicate including cross-material rejection tests |
| G23 | Strict JSON/binary/world nonfinite rejection tests |
| G24 | Unknown required/geometry-changing optional extension rejection tests |
| G25 | Buffer/accessor/index OOB admission tests |
| G26 | Sparse accessor rejection tests |
| G27 | Full L-body package SUCCESS intervals/geometric center sums both profiles; source 3/8 and COM separately |
| G28 | Triangle-list permutation content/byte/projection tests; not per-triangle winding reversal |
| G29 | Correctly remapped node/material/primitive ordering tests; truthful source-bound tree may differ |
| G30 | Aggregate work/domain/refinement/bricks/output and padded absolute-coordinate negative allocation guards |

### Handoff limits, not upstream edits

Common `rotation=[0,0,sin(pi/4),cos(pi/4)]` is a valid C3 transform with 12 baked triangles, but Float64 residuals make its faces nonorthogonal for the exact C5/C6 proof. There is **no snap/repair/relabel**. Exact quarter-turn matrices work; arbitrary rotation/shear is geometry-supported but generally NOT VOXELIZED. Default Blender 90-degree TRS interoperability is a real outstanding risk; actual Blender E2E remains NOT RUN (only discovered executable lies outside allowed execution root). Do not advertise general TRS compile PASS or invalid rotations.

Existing joint-transform validation, unannotated export-scope and missing exporter-version provenance remain upstream handoff items only. The compiler handles downstream rejection/placement; source version is explicitly UNRECORDED. Later integration must define an accepted static-asset adapter/physical registry/container separately. No current schema, Blender, runtime or package/lockfile write occurs.

C7 CLI, GWN, complete G01-G30 hash inventory, ten repeats, qualified performance, real Blender export and final R1/R2/R3 acceptance remain NOT RUN. Two-generation smoke is not full determinism certification. Independent C6 review is user-dispatched after the scoped freeze; this writer claims only implementation/tests/self-review.
