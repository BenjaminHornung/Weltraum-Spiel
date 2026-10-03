# Integration handoff — isolated compiler, no product adoption

Package/path date **2026-10-02**; C8 closure2026-10-03. Base `25bc7f5bbd2db6317c42193873eadeaf10a092c5`; branch `agent/hestia-asset-compiler-spike-2026-10-02`; implementation/review freeze **`c8e451a3e52fc8da743df011debae682f93c89a3`**. META accepts SPIKE_ACCEPTED_WITH_NOTES after all3 external scoped endreviews PASS_WITH_NOTES/no open findings (not human review). This handoff proposes later work only. `PRODUCT_INTEGRATED = NO`; exact closeout commit authorized, dedicated push remains META-owned.

**Current additive followup: ACCEPTED_WITH_NOTES by external user-relayed META.** Closeout commit `de0f405f2d0e1084d0fa7f993d3cf74761b66dca` is the authorized additive parent; previous push META-owned. [BLENDER_E2E.md](BLENDER_E2E.md) records actual plain-cube E2E/both profiles plus META's independent four-input-pin/in-memory compile_core→verify_files replay (1,000/216 cells and exact trees PASS, actual90°TRS both `thin.unproven`), execution/cleanup hashes and review-program Exit0/no Blender or TEMP/native publication writes. One focused META review, not another3-agent/human review. Seven generated caches/removal explicitly accepted NOTE, not zero writes. Exact11-path additive commit authorized, not a runtime adapter; actual SHA reported externally afterward.

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
2. The followup now has permitted-root Blender5.2.0LTS/buildfbe6228777e7/glTF5.2.39, available options/defaults and real plain-cube/both-profile E2E evidence. This closes environment availability and that fixture only. Run scoped parity/admission for the actual future asset before claiming ordinary authoring interoperability; real90°TRS still fails exact proof. Future Blender exporter process needs explicit no-bytecode setup; environment alone generated seven own caches, subsequently cleaned.
3. Load one trusted admitted asset with bounded reads, verify actual package files, translate ALL semantic material IDs explicitly and preserve immutable Part/placement identity. Reject unsupported records/levels/mappings; do not make a second compiler or infer missing authority.
4. Expose a read-only presentation snapshot. Render it without replacing HVP assets or changing gameplay, collider, planner, save or structural edit state. Test visible output only in that separately authorized slice.

No Destruction, Cut execution, Save, Physics/collider injection, renderer replacement, HVP bootstrap modification, terrain baking or A+B integration is included now. CutInterface and joints remain semantic/placement data, not executable gameplay. A+B+C must be evaluated together later before a shared format/authority or product claim; the present output is only candidate research input.

## Exporter followpatch proposals — upstream remains untouched

| Confirmed gap / evidence | Minimal future proposal, subject to its own ownership/scope review |
| --- | --- |
| Joint extraction `blender_adapter.py:792-811`, model/validation omit joint transform inventory/proof | Extend source validation to all relevant joint/marker nodes AND used ancestors, checking finite/nonsingular composed transforms. Keep compiler independent downstream checks. |
| Semantic extraction skips unannotated objects `:699-705`, while scene/collection export includes them `:1066-1081` | Prove export membership equals explicit authored bindings, or fail on reachable unannotated mesh. Never guess Decorative or prune business geometry silently. |
| Evaluated inventory versus actually delivered/postprocessed GLB | Add real exporter round-trip parity checks on actual decoded geometry/semantics/placement, not count equality against local inventory. Source counts/bounds remain provenance only. |
| Source-tool version/options absent from existing public report/compiled provenance (`:1052-1114`) | Focused followup externally pins actual Blender5.2.0LTS/glTF5.2.39/defaults/GLB generator; the unchanged package still says authoringToolVersion=UNRECORDED. Wire-level provenance/required unit-axis-transform policy remains an owning-contract proposal, not silently patched by a research log. |
| Ordinary 90° quaternion/TRS bakes valid C3 geometry but exact orthogonal proof fails | Reconcile an explicitly approved authoring/proof interoperability policy. Current code emits `thin.unproven`, not invalid rotation. No snap, repair or Shell relabel. |
| Rod/tube and multilayer physical stacking | Separate actual reconstructable shape/layer proof specification; current tube cannot become a filled rod and authored layer sorting cannot imply physical stacking. |

## Residual risks and next owner

General nonorthogonal SolidFill/thickness, rods/tubes/multilayer support remain reasoned BLOCKED. G16 has no authored multi-material volume selector and rejects `material.ambiguity`. Contact-inclusive raster occupancy is not analytic volume. Budget exclusions are not performance failures: Medium/Large exceed the frozen 20k expanded limit before input allocation. Current timings are CONTAMINATED_DIAGNOSTIC/memory UNSUPPORTED; GWN_NO_ADOPTION is REASONED_NOT_IMPLEMENTED.

The previous real-Blender execution-root blocker is **resolved** by user-provided `C:\IFI_SourceCode\Utils\Blender 5.2\blender.exe`; historical C7/C8 NOT RUN captures remain intact. Plain closed cube actual exporter→compile→validate/inspect PASS/both profiles; real90°TRS valid closed geometry/compile `thin.unproven`, no blanket E2E or all-assets support claim. Seven new CPython313 source caches occurred despite the environment and were exclusively inventoried/cleaned; no tracked exporter edit. Native symlinks NOT RUN/1314, support BLOCKED limits, contaminated timings/unsupported memory and earlier once-UNKNOWN non-reproduced publication.io remain separate notes.

Next: bounded endreviews are externally CLOSED; META authorizes the exact final15-path research commit. Writer reports actual SHA/sole parent/files/status externally afterward and STOPS; no amend/push/PR/merge/bundle/archive. META independently validates then owns normal dedicated push after fresh identity/base checks. Original immutable machine PENDING fields describe PRE-COMMIT capture, not current acceptance. Future adapter/proof/Blender/registry work still needs its own scope; accepted spike is not product readiness.

That C8 closeout is historical and complete. **Current focused followup externally accepted with notes; exact normal additive commit `test(asset-compiler): record real Blender exporter E2E evidence` is authorized, STOP afterward/no writer push/amend/merge.** Captured PENDING_META and historical C7/C8 PENDING/NOT RUN fields remain unchanged as capture-time truth; current acceptance lives in these docs. Original helper is frozen exactly as executed, never replayed/rewritten to hide cache prevention failure. Fresh diff/lease/hash/source-freeze/staging/cleanup checks precede commit, actual SHA/parent/files/status reported externally afterward. META validates then owns normal same-branch push. No tests/corpus/benchmark/Blender reruns, source/runtime fixes, tracking, agents, services or dependencies. Future adapter/proof/registry changes require separate scope; PRODUCT_INTEGRATED=NO.
