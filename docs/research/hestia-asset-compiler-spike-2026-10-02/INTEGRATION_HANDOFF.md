# Integration handoff — isolated compiler, no product adoption

Package/path date **2026-10-02**; C8 closure2026-10-03. Base `25bc7f5bbd2db6317c42193873eadeaf10a092c5`; branch `agent/hestia-asset-compiler-spike-2026-10-02`; implementation/review freeze **`c8e451a3e52fc8da743df011debae682f93c89a3`**. META accepts SPIKE_ACCEPTED_WITH_NOTES after all3 external scoped endreviews PASS_WITH_NOTES/no open findings (not human review). This handoff proposes later work only. `PRODUCT_INTEGRATED = NO`; exact closeout commit authorized, dedicated push remains META-owned.

## What can be handed off

The stdlib offline compiler, actual five-command CLI, deterministic synthetic GLB/report generator, independent reference/oracle runner and actual-byte package verifier exist. Supported packages use the unchanged research schema `hestia.asset-compiler-spike.v1` and compiler `hestia-asset-compiler-spike-c6-v1`; this is NOT HVOX or adopted `hestia.asset-manifest.v1`.

Stable comparison contracts are explicit, not an open-format promise:

* Same delivered GLB/report bytes + explicit profile + versions: every deterministic output file/diagnostic/brick byte and full tree agrees. Source provenance is not removed to obtain agreement.
* Correctly remapped ordering transports: the three content hashes, EXACT semantic projection and Part/material/address-bound brick bytes agree; honest source/payload/provenance/full-tree bindings may change.
* Reversed inner winding is a different oriented geometry; only expected even/odd Hollow occupancy/owned bytes agree across those variants.

Four JSON records plus sparse 16³ byte bricks carry stable IDs, actual baked placements, active local selectors, measured/replacement thin decisions, scoped classification proofs, owned grid bounds and geometric inputs. Canonical preimages and support limits are in [PACKAGE_FORMAT.md](PACKAGE_FORMAT.md), current verification/review boundaries in [REPORT.md](REPORT.md). Hash-tree verification proves format/integrity/self-consistency, **not source authentication against wholesale coherent replacement**. Original report/source admission remains `compile_core`-owned.

## Missing runtime contract — similarity is not compatibility

Runtime `src/...` paths below are relative to `apps/weltraum-browser/`; authoring Python anchors are relative to `tools/blender/hestia_asset_authoring/`. These are read-only current-source anchors, not changed integration files.

| Existing boundary (read-only at the base) | Matches / mismatch / required future decision |
| --- | --- |
| `src/voxel/adaptive` | 16³, x-fastest and a 0.125-m quantum are useful concepts. A compiled asset lacks adopted frame/body/region/generator identities, levels and residency/authority proofs. No automatic ingest. |
| `src/voxel/structural/coordinates.ts:75-78` | Structural address admission requires Adaptive level 4. Standard 0.25 m cannot be treated as an already admitted level-4 asset. |
| `src/voxel/{channels,types,brick}.ts` | Terrain uses 32×64×32 cells plus 35×67×35 apron samples/Float32 density channels; research bricks are 4096 local selector bytes, not density samples. |
| `src/voxel/materials.ts:29-35` | Terrain ID 0 is dark rock. Research byte 0 is Air. Do NOT reinterpret bytes as that registry. |
| Structural material inputs | An asset-local slot is not a runtime registry ID. A later adopter must explicitly resolve every render/structural ID against a versioned accepted registry or reject. RGB, palette index or slot number is not that mapping. |
| `src/hestia-prototype/terrain/structuralIngest.ts` | Existing terrain/AddBox/proof ingestion is not a GLB or this research manifest loader. HVP tree/rock/bootstrap and terrain are untouched. |
| Runtime authority / Three.js | A later loader must define immutable accepted asset state and admission; a renderer consumes projections and cannot generate gameplay/world truth from a manifest or mesh. |

Still missing: approved wire/schema/version migration contract; trusted source/package provenance policy; local/world pose convention for authored baked placement; registry translation; explicit runtime asset/body/address identity; bounded loader admission and lifetime/ownership; approved profile-to-runtime-level policy; and separate collision/navigation/save/destruction authority. Geometry counts/center sums describe **owned raster contributions**, not net overlapping volume, density, kg, strength or inertia. There is no product default profile, physical registry or second-moment data to invent.

## Smallest later slice — a proposal, not implemented

`ONE trusted static authored asset → original GLB/report compiler admission → verified research package → explicit read-only adapter → render projection`

1. Write/approve a separate adapter spec and trust/registry/profile/address contract. Keep the first asset within existing exact orthogonal support; do not disguise ordinary quaternion residuals as exact matrices by snapping.
2. Obtain a permitted-root Blender/glTF exporter environment and pin actual versions/options. Run actual asset export/parity evidence before claiming normal authoring interoperability.
3. Load one trusted admitted asset with bounded reads, verify actual package files, translate ALL semantic material IDs explicitly and preserve immutable Part/placement identity. Reject unsupported records/levels/mappings; do not make a second compiler or infer missing authority.
4. Expose a read-only presentation snapshot. Render it without replacing HVP assets or changing gameplay, collider, planner, save or structural edit state. Test visible output only in that separately authorized slice.

No Destruction, Cut execution, Save, Physics/collider injection, renderer replacement, HVP bootstrap modification, terrain baking or A+B integration is included now. CutInterface and joints remain semantic/placement data, not executable gameplay. A+B+C must be evaluated together later before a shared format/authority or product claim; the present output is only candidate research input.

## Exporter followpatch proposals — upstream remains untouched

| Confirmed gap / evidence | Minimal future proposal, subject to its own ownership/scope review |
| --- | --- |
| Joint extraction `blender_adapter.py:792-811`, model/validation omit joint transform inventory/proof | Extend source validation to all relevant joint/marker nodes AND used ancestors, checking finite/nonsingular composed transforms. Keep compiler independent downstream checks. |
| Semantic extraction skips unannotated objects `:699-705`, while scene/collection export includes them `:1066-1081` | Prove export membership equals explicit authored bindings, or fail on reachable unannotated mesh. Never guess Decorative or prune business geometry silently. |
| Evaluated inventory versus actually delivered/postprocessed GLB | Add real exporter round-trip parity checks on actual decoded geometry/semantics/placement, not count equality against local inventory. Source counts/bounds remain provenance only. |
| Actual Blender/glTF exporter version/options not pinned (`:1052-1114`) | Record actual source-tool provenance and make required unit/axis/transform options explicit under the owning authoring contract. Version is currently UNRECORDED, not an invented default. |
| Ordinary 90° quaternion/TRS bakes valid C3 geometry but exact orthogonal proof fails | Reconcile an explicitly approved authoring/proof interoperability policy. Current code emits `thin.unproven`, not invalid rotation. No snap, repair or Shell relabel. |
| Rod/tube and multilayer physical stacking | Separate actual reconstructable shape/layer proof specification; current tube cannot become a filled rod and authored layer sorting cannot imply physical stacking. |

## Residual risks and next owner

General nonorthogonal SolidFill/thickness, rods/tubes/multilayer support remain reasoned BLOCKED. G16 has no authored multi-material volume selector and rejects `material.ambiguity`. Contact-inclusive raster occupancy is not analytic volume. Budget exclusions are not performance failures: Medium/Large exceed the frozen 20k expanded limit before input allocation. Current timings are CONTAMINATED_DIAGNOSTIC/memory UNSUPPORTED; GWN_NO_ADOPTION is REASONED_NOT_IMPLEMENTED.

Real Blender E2E is **NOT RUN — EXECUTION_ROOT_BLOCKER**: only confirmed executable is `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, outside allowed Ctree. Host mocks/pure tests are not exporter E2E. Native symlink/broken-symlink evidence is NOT RUN after WinError 1314; actual junction/broken-junction/collision tests are separate. One earlier native `publication.io` was not reproducible; underlying cause remains UNKNOWN, no AV guess or core patch.

Next: bounded endreviews are externally CLOSED; META authorizes the exact final15-path research commit. Writer reports actual SHA/sole parent/files/status externally afterward and STOPS; no amend/push/PR/merge/bundle/archive. META independently validates then owns normal dedicated push after fresh identity/base checks. Original immutable machine PENDING fields describe PRE-COMMIT capture, not current acceptance. Future adapter/proof/Blender/registry work still needs its own scope; accepted spike is not product readiness.
