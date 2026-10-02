# Hestia asset compiler spike — C1 contract audit

Audit date: 2026-10-02. Source pin: `25bc7f5bbd2db6317c42193873eadeaf10a092c5`. This freezes an **isolated research interpretation**, not a change to a public authoring schema or an accepted runtime manifest. Current authorization ends after C1; **STOP before C2**. No compiler implementation or goldens have run. `PRODUCT_INTEGRATED = NO`.

## Evidence and source precedence

Current committed authoring contracts/schema/exporter code outrank historical research proposals. Distinguish normative contract, observed implementation, and deliberately narrower spike boundary; do not resolve two genuinely current contradictory MUSTs by picking one. No such unresolved same-boundary contradiction was found in the audited sources; known gaps and scoped distinctions are enumerated in [CONFLICT_REGISTER.md](CONFLICT_REGISTER.md).

### Completely read primary sources

| Source | Audit scope / useful anchors |
| --- | --- |
| `docs/architecture/voxel-asset-authoring-and-compilation.md` (308 lines) | Binding target architecture, docs-only implementation status; frame/units §5, topology §6, semantics §7, thin/material/canonicalization §8, artifacts §9, authority §13 |
| `docs/tools/hestia-asset-authoring-contract-v1.md` (55 lines) | Entire current canonical semantic and GLB handoff contract; transport 15-23, IDs 25-27, frame 29-31, thin 37-39, placement 41-43, hashing 49-51, target manifest 53-55 |
| `docs/tools/blender-hestia-asset-authoring-exporter-v1.md` (320 lines) | Current authoring property map, validation, canonical extras, exact delivered-byte/payload digest rules, failure/rollback boundary, existing NOT RUN smoke status |
| `schemas/hestia-asset-authoring-v1.schema.json` (480 lines) | Complete closed root/definitions/enums/ranges/conditionals; schema is `hestia.asset-authoring.v1` |
| `tools/blender/hestia_asset_authoring/__init__.py` (134 lines) | Pure contract/helper exports; does not require Blender merely to use canonical JSON |
| `tools/blender/hestia_asset_authoring/canonical.py` (167 lines) | Exact canonical payload algorithm, finite numbers/-0, identity-ordered collections, SHA-256 |
| `tools/blender/hestia_asset_authoring/model.py` (715 lines) | Actual canonical model serialization, inventory vs semantic fields, absent joint transform model |
| `tools/blender/hestia_asset_authoring/schema.py` (192 lines) | IDs/frame/schema/enums and strict shape validation |
| `tools/blender/hestia_asset_authoring/validation.py` (776 lines) | Semantic references, negative determinant rejection, inventory-based topology, part/marker but not joint transforms |
| `tools/blender/hestia_asset_authoring/report.py` (155 lines) | Payload inventory/options/semantics/diagnostics, exact non-self-referential report digest |
| `tools/blender/hestia_asset_authoring/blender_adapter.py` (1138 lines) | Extraction/evaluated inventory, role/property restrictions, semantic projection, node/material attachment, export scope/options |
| `tools/blender/hestia_asset_authoring/export_hestia_glb.py` (482 lines) | JSON transport postprocessing, exact delivered GLB hashing, error report/stale GLB behavior, pair rollback |
| `tools/blender/tests/test_hestia_asset_authoring.py` (585 lines) | Entire pure canonical/validation/report baseline |
| `tools/blender/tests/test_blender_boundary.py` (1525 lines) | Entire fake-Blender adapter/CLI/export/rollback baseline; not real Blender E2E |

### Read-only runtime/context cross-checks

Completely read: `docs/architecture/world-runtime-render-backend-boundary.md`, `docs/architecture/voxel-world-decision-and-supersession-index.md`; `apps/weltraum-browser/src/voxel/{types.ts,brick.ts,channels.ts,materials.ts,ids.ts}`, `adaptive/{types.ts,coordinates.ts}`, `structural/{types.ts,coordinates.ts}`; and `apps/weltraum-browser/src/hestia-prototype/terrain/structuralIngest.ts`. Required root/readme/status/plan/master-plan reading is recorded in [EXECPLAN.md](EXECPLAN.md). This is a targeted boundary audit, not a claim to have audited all runtime code.

No accepted HVOX or compiled Hestia manifest serializer/schema was located in the inspected `schemas`, `tools`, or application source paths. The target name exists in the authoring contract, not as an adopted wire container. Older status/decision-index pins are contextual; actual source at the pin above controls this audit.

## Frozen current authoring contract

### Frame, units, IDs, and document

- Canonical root has exactly `schema`, `asset`, `parts`, `joints`, `markers`, `materials`; V1 provides no aliasing/migration. Closed schema objects reject unknown fields and unknown schema values.
- Exact frame: `upAxis: "+Y"`, `forwardAxis: "+Z"`, `handedness: "RIGHT"`; `metersPerUnit: 1`. Do not swap axes from Blender coordinates or older Z-up proposals.
- IDs match `^[a-z0-9][a-z0-9._:-]{0,127}$`, case-exact, length 1..128, no trimming/reformatting. Per-category uniqueness and exactly-once references; part-parent cycles reject. Node names, array positions, object hierarchy names, and Blender slots are not business IDs.
- Asset requires ID, revision, representation, unit/frame. JSON schema revision range is integer 0..2147483647; Python `bool` does not count as integer. Optional default structural material/tags remain explicit, never invented.
- Representations are `Solid`, `Shell`, `LayeredShell`, `StructuralAssembly`, `ModularPart`, `Decorative`, `Hybrid`. The broader architecture's conceptual SemanticVolume is not a V1 enum to accept silently.

### Parts, joints, markers

- Every part declares `partId`, representation, destructible, collision policy (`None/AuthoredMesh/Compound/Voxel`), navigation policy (`None/Obstacle/Walkable/Portal`), and thin policy/positive minimum thickness. Optional parent/default render/structural material/tags are preserved. Shell/LayeredShell require a shell object; Decorative is non-destructible, with schema-constrained collision policy. Do not add an undocumented navigation default.
- Current Blender property extraction requires a default render ID even though it is optional in the canonical schema; that is an exporter-input restriction, not license to guess a missing material downstream.
- Joint fields preserve fixed/hinge/slider/breakable type, endpoints, break policy and positive threshold force/torque where required. Marker types and optional part binding are exact; CutInterface requires `interfaceId`, which other marker types do not acquire automatically.
- Joints/markers are separate nodes. Canonical authoring semantics do **not** contain their normalized placement. Actual node/ancestor transforms must independently produce finite, nonsingular world placement in the compiler.
- Confirmed upstream gap: adapter joint extraction at `blender_adapter.py:792-811`, joint model `model.py:323-332`, and validation `validation.py:579-595` provide no joint transform inventory/proof. A report passing upstream validation cannot prove joint geometry/placement safe. No upstream edit is authorized.

### Materials and thin features

- Material fields: required `renderMaterialId`, optional `structuralMaterialId`, palette index 0..65535, and tags. Physical density/strength is registry-owned; RGB, arbitrary GLB fields, and local slots never define structural identity or density.
- Upstream validation counts structural declarations through render declarations and requires referenced structural IDs to resolve exactly once (`validation.py:493-563`). Do not silently deduplicate conflicting declarations or invent a broader structural registry. Unused inventory material slots can legitimately appear in an exporter report.
- The five thin policies are `Reject`, `PreserveAsBeam`, `PreserveAsRod`, `PreserveAsShell`, `DecorativeOnly`. Authored `declaredMinimumThicknessMeters` is intent, not a measurement.
- Shell fields/layers carry positive thickness and structural IDs, but do not prove geometry, volume, or physical layer stacking. The model sorts serialized layers by structural ID; the generic canonical helper does not make all ordinary arrays unordered. Do not infer an unprovided physical layer order.
- A real geometry proof is necessary for `Voxelized` or valid replacement. `PreservedSemantic` must retain actual replacement geometry/parameters and semantic payload; policy-string-only preservation is false preservation. Tubes cannot become filled rods. Unproven thickness/replacement yields `RejectedUnprovenThickness`; proven insufficient thickness with rejecting policy yields `RejectedTooThin`. Explicit DecorativeOnly is not an inferred fallback for unannotated geometry.

## GLB/report transport and binding

### Exact semantic reconstruction

`asset.extras.hestia` is `schema` plus **flattened canonical asset fields**, not the whole root semantic document. `node.extras.hestia` has `kind: part/joint/marker` plus that canonical record; strip only transport `kind` before semantic comparison. `material.extras.hestia` contains canonical material fields. Preserve current casing/field names and reject ambiguous or unknown Hestia records; no alias-based repair.

Reconstruct the canonical document from explicit transport records, validate its closed shape/enums/ranges/references, and compare it with `payload.semantics`. Validate used ancestors and exact primitive-to-Part/material bindings; array order is only transport lookup. A reachable mesh without an exact authored Part binding rejects, even when it looks decorative. Unused declared material slots are not by themselves errors; conflicting or unresolvable used bindings are.

Confirmed export-scope gap: `blender_adapter.py:699-705` skips unannotated objects during semantic extraction, while `:1066-1081` exports all Scene/Collection objects. Therefore a digest-valid GLB/report pair may still contain unbound reachable geometry. The compiler must detect/reject it; the exporter remains unchanged, with a later handoff recommendation.

### Exact digest rule — reuse, do not approximate

Let `G` be the exact **delivered/postprocessed** GLB bytes, `R` the exact report file bytes, and `P = report["payload"]`.

```text
sourceGlbSha256       = SHA256(G)
sourceReportSha256    = SHA256(R)                  # raw file provenance
authoringPayloadHash = SHA256(canonical_json_bytes(P))

sourceGlbSha256 == P["glbSha256"] == report["digests"]["glb_sha256"]
authoringPayloadHash == report["digests"]["report_sha256"]
```

`report.py:104-110,122-151` defines this preimage: **payload only; neither digests member participates**. Raw `sourceReportSha256` and the canonical payload digest are different classes even if a report is canonical JSON. Strict JSON ingestion rejects duplicate keys, invalid UTF-8, nonfinite numbers and malformed shapes before comparison.

Use the existing read-only pure canonical helper. Its identity-sorted semantic/inventory collections and tags, compact UTF-8, lexical object keys, finite floats and `-0 -> 0` are mandatory at this boundary (`canonical.py:18-44,86-108,125-140`). Ordinary vectors remain ordered; nonzero floats do not all become integers. Hash lowercase SHA-256.

Reject null/malformed GLB hashes, either GLB-binding mismatch, report-payload hash mismatch, Error diagnostics, or digest-valid semantic conflict. An upstream validation failure can write an error report while leaving an older GLB intact (`export_hestia_glb.py:370-466`); matching basename alone is never pair proof. The upstream pair replacement uses individual file replacement plus attempted rollback, not an atomic directory generation.

### Inventory limitations

Report inventory contains mesh/primitive/material IDs, topology counts and bounds, not authoritative decoded world geometry. Adapter mesh IDs commonly use Part IDs and primitive IDs use `<partId>:<material-slot-index>`; these are source inventory identities, not stable canonical triangle IDs. Evaluated local mesh bounds need not equal baked GLB/world bounds. Canonical semantics omit transforms. Recompute needed facts from actual GLB data.

## Narrow spike reader and geometry obligations — planned, NOT RUN

The input allowlist is GLB 2.0 with one first JSON chunk and one BIN chunk, selected unambiguous scene/node hierarchy, matrix **or** TRS, TRIANGLES, Float32 VEC3 POSITION, U8/U16/U32 indices, offset/stride, materials, mesh instances, world-reflection winding correction. Unsupported sparse, morph, skin, animation, Draco/meshopt, external/network buffers, unknown required extensions, nontriangle modes, OOB, nonfinite data, or ambiguous Hestia semantics reject; do not repair silently.

Bound GLB **and report** reads before loading; strict UTF-8/duplicate-key/finite parsing has a pre-load depth gate. Bound nodes/edges/depth, accessor bytes/counts, instance-expanded triangles, absolute safe coordinates, surface/flood padding and work, bricks, and output **before** large allocations. Numeric limits will be frozen/tested in the C2 profile implementation, not asserted implemented at C1. Finite huge values and booleans masquerading as integers are negative cases, not allocations.

Validate actual accessed range as `accessorOffset + (count - 1) * stride + elementBytes <= bufferView.byteLength` for nonempty accessors, plus view/buffer ranges, legal alignment/stride, and count cases. Check declared buffer bytes, not permission to read BIN padding; only legitimate 0..3 BIN slack is allowed. Indices are unsigned, scalar, nonnormalized, in vertex range, with glTF forbidden maximum-value sentinels rejected. Validate cycles/duplicate children/roots/multiple parents before instance expansion; mesh references may be reused.

Freeze an explicit ignore/validation allowlist for normal Blender UV/PBR/embedded image data. No external URI accepted, no image decode/network retrieval. NORMAL/TANGENT must be finite under the committed architecture. Optional geometry-altering extensions are not safe to ignore; reject unless explicitly supported. Render-only metadata does not determine voxel truth.

Bake all relevant node/ancestor matrices, including joint/marker ancestors, independently finite/nonsingular in Float64 meters. Preserve parent scale/child rotation shear, and correct winding once from the composed world determinant. Canonical oriented triangle keys use only cyclic vertex rotations plus semantic owner/material IDs and coordinates, not arbitrary vertex sorting, input indices, or forced positive signed volume for cavity components. Exact-position seam merging across all primitives is for topology proof, not epsilon repair; detect geometric duplicates even with different material IDs, degeneracy, invalid edge orientation/fans, openness, and self-intersection.

## Reference voxel and material freeze — planned, NOT RUN

- Contact A is **closed/inclusive** triangle/cell-box intersection, including grid-plane touching cells on both sides. Full SAT is the narrowphase. Per-profile independent interval/count oracles in EXECPLAN are normative research tests for G01/G02/G13, not accepted global runtime rules.
- Asset brick cells: 16³, x-fastest `x + 16 * (y + 16 * z)`, mathematical negative floor division. Air=0; active local slots 1..255 map to explicit semantic materials, never directly to `paletteIndex`. More than 255 **active voxelized** slots rejects.
- Candidate owners/materials form order-independent sets. Brick entries must bind Part identity and coordinates as well as byte length/hash; stable file keys must safely encode those identities without using arbitrary raw IDs as Windows paths. Bare slot bytes plus an unrelated parts list are insufficient ownership proof.
- Multi-material surface/interior precedence is not defined by current authoring metadata. Unique geometry-bound material in a homogeneous Solid can be used; unresolved multi-material/interior ownership rejects. Do not let first primitive, nearest arbitrary traversal, default render metadata, or RGB invent volume ownership.
- Reference C5 retains exterior flood, but adds geometry classification: complete surface bounds + free padding layer; 6-neighbor exterior flood; remaining non-surface components; deterministic cell-center ray-parity representative, even/odd **per Part**; material fills, cavity stays Air; grazing/edge/vertex/uncertain classification rejects. Independent hollow/tunnel oracles remain NOT RUN. No GWN basis and no G13 Shell relabelling.
- Conservative raster sealing of a narrow tunnel requires visible topology-loss diagnosis/rejection. Both-profile resolvable control plus phase/diagonal/under-resolved cases distinguish geometry parity from actual raster exterior connectivity.
- Geometric mass inputs: occupied count, cell volume, center sums and bounds per structural material; optional explicitly defined second moments. They describe raster approximation, not source exact volume or kg/inertia. No density registry is adopted by this spike.

## Current runtime formats are not the research format

| Current source | Observed contract | Consequence |
| --- | --- | --- |
| `src/voxel/channels.ts:4-12`, `types.ts:15-17`, `brick.ts` | Terrain cells 32×64×32, 35×67×35 samples with apron, Float32 density + Uint8 material, `voxel-brick-x-fastest-v1` | Not the 16³/4096-byte asset package |
| `src/voxel/materials.ts:29-35` | `hestia.materials.v1`; material 0 is `dark_rock`, not Air | Research Air=0 cannot be loaded as this terrain registry |
| `src/voxel/ids.ts:32-34` | Runtime alpha-leading ID pattern and FNV-based hashes | Not a reason to rewrite authoring IDs or replace SHA-256 |
| `src/voxel/adaptive/types.ts:1-8`, `coordinates.ts` | 16³ adaptive bricks, base 0.125 m, levels/proofs/frame/body/region/generator identities | Some addressing concepts align; package lacks adopted adaptive authority/proofs |
| `src/voxel/structural/types.ts`, `coordinates.ts:60-78` | Structural Air=0, x-fastest 16³, stable Part refs, density registry input; address admission specifically level 4 / 0.125 m | Similarity is not loader compatibility, particularly for 0.25 m |
| `src/hestia-prototype/terrain/structuralIngest.ts` | Existing terrain/AddBox/proof/structural ingestion with supplied materials and budgets | Not a GLB/asset-manifest consumer or accepted compiler adapter |

The authoring contract's Agent-G target `hestia.asset-manifest.v1` and this task's `hestia.asset-compiler-spike.v1` are explicitly different artifacts. Research source inventory, semantics, and proof results can inform a later adopter; no runtime code, public schema, or ownership boundary changes here.

## Deterministic output and comparison classes

### Planned package content

```text
out/
  asset-manifest.json
  bricks/<stable-brick-key>.bin
  diagnostics.json
  provenance.json
  compile-report.json
```

Each brick is exactly 4096 material-slot bytes and is bound by byte length/SHA-256, owner Part and integer coordinates. Manifest minimum: research schema/profile, asset ID/revision, raw GLB/report source hashes, compiler ID/version/algorithm version, exact frame, voxel size, 16 cells/axis, cell order, grid bounds, semantic material-slot map, parts/joints/markers and normalized placement, bricks/hashes, thin decisions, diagnostic summary, normalized geometry/semantics/voxelization/manifest-tree SHA-256. Do not claim HVOX or accepted target-manifest compliance.

Content hashes exclude wall clock, absolute paths, host, user, locale, and benchmark measurements. Deterministic count-only compile evidence can be packaged; performance measurements belong in separate research evidence. At C6 define exact canonical preimages and a sorted relative-path file inventory, with manifest-tree self-field excluded; no circular report/manifest/tree hashing. Raw source SHA values remain in provenance and the full provenance-binding manifest/tree.

### Comparison class 1 — identical inputs

For **identical GLB bytes, report bytes, explicit profile and compiler/algorithm versions**, require identical complete deterministic output file bytes, brick bytes, diagnostics ordering, and full manifest/tree hashes across ten runs. No provenance fields are removed to obtain this identity.

### Comparison class 2 — semantically equivalent ordering permutations

Rebuild GLB references correctly when permuting node/primitive/material/triangle arrays. Require identity of:

1. `normalizedGeometrySha256`;
2. `semanticsSha256`;
3. `voxelizationSha256`;
4. brick bytes and semantic owner/material/address associations;
5. **canonical semantic manifest projection**.

The projection contains research schema/profile/compiler/algorithm versions, asset identity/revision/frame, voxel size/order/grid bounds, canonical parts/joints/markers/world placements, active semantic slot mapping, owner/address/length/hash brick entries, thin decisions, diagnostic summary and the three content hashes. It excludes raw GLB/report source hashes, raw source inventory/order-specific provenance, their authoring-payload digest, provenance-file bindings, and the full `manifestTreeSha256`. Freeze its executable construction/tests at C6. It is a comparison view, not a replacement published manifest or a public schema change.

Raw source GLB/report hashes, report-payload digest and source inventory remain truthful and may differ. Consequently the **full source-binding manifest, provenance file, and full tree may differ**. Never strip/fake provenance or weaken semantic content to make them identical. Comparison class 2 does not require the complete source-bearing output bytes to match for different inputs.

R1-A2, reviewer `731643b5-d353-4147-82e7-6d6d4eab31fb`, approved this as `RESOLVED_BY_EXPLICIT_SPIKE_COMPARISON`: package 03's “gleicher kanonischer Output” / “identischer kanonischer Output” (`03_GOLDEN_CORPUS_MATRIX.md:35-59`) and package 04's source-bound manifest/tree (`04_COMPILER_CONTRACT_OUTPUTS.md:145-164`) are satisfied by the explicit classes. No reviewed MUST demands full source-bearing byte identity for different raw inputs. A newly discovered explicit conflicting MUST would still trigger STOP with quotation.

## Atomicity, unknowns, and C1 verdict

C6 publication is a whole-generation task-owned sibling staging directory, fully written/verified, published by a single atomic directory rename. Any existing target (including empty directory, file, link/junction) rejects unchanged; no delete/replace. Race/fault tests retain a publish-collision sentinel and clean only owned staging. This is a planned research package boundary, not an assertion that the upstream GLB/report pair is directory-atomic.

Not defined/adopted by current sources: HVOX container, runtime asset loader, canonical multi-material interior precedence, general thickness/replacement proof, physical density registry for arbitrary assets, collider/navigation output authority, globally selected resolution, general subvoxel tunnel preservation, qualified performance limits, actual Blender export/version/axis parity. Unsupported/unproven cases must be rejected or explicitly reported, never presented as solved.

Current exporter code supplies frame constants and export options but does not pin actual Blender/glTF exporter versions or explicitly set every axis/unit option (`blender_adapter.py:1052-1114`). Actual E2E is NOT RUN: the discovered Blender 5.2 executable lies outside the permitted execution root. Do not invent unavailable source provenance; record the upstream gap for later handoff.

C1 verdict: current contract audited; scoped research comparison and reference-design gates resolved; implementation, independent hollow/tunnel oracles, corpus, determinism, package atomicity, real Blender E2E and performance **NOT RUN**. R1-A2 resolves interpretation, not implementation acceptance. Proceed only after C1 checkpoint delivery and explicit C2 authorization.
