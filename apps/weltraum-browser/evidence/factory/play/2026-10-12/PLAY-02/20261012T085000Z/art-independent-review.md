# PLAY-02 — independent ART source and quality review

Reviewer: `/root/play_art_review`. Read-only product review; the only reviewer write is this report. No implementation, Blender, browser/GPU, build or test job, test rerun, asset regeneration, merge, push, PR or upload was performed. No subagents were used.

Reviewed ART worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-play-art-2026-10-12`.
Actual HEAD: `e752cc7fce43a50b4bcb4800d9d27584b44b6a0e`; actual parent/BASE: `96cced23cd285b57f8a557d01ac9ed8a158c927f`. Worktree clean during inspection.

## Separate verdicts

| Verdict | Result | Boundary |
|---|---|---|
| SpecCOMPLIANCE | **SUPPORTED for the exact ART grant; full PLAY-02 remains INCOMPLETE** | New source/runtime/test files meet the granted visual derivative boundary. Review §7.4 normal runtime import/movement and §7.5 integrated structural S1/World-Art acceptance are not delivered by this commit. |
| Quality | **Technical artifact quality supported; animation/reproduction gaps remain; in-game visual quality NOT_RUN** | Hard part-bound geometry, scale, palette and binary mesh data are sound in inspected artifacts. Player-height readability, real state transitions, usability and hardware decisions remain `OWNER_REVIEW_PENDING`. |
| ArtifactEvidence | **Payload/provenance evidence VERIFIED by independent byte inspection; tsc execution receipt GAP** | 22 real blend/GLB pairs, reports, source blobs, license, manifest, patch and 44 local LFS objects agree. The saved typecheck log is empty and cannot independently establish its reported exit status. |
| ReadyForIntegratorHandoff | **YES, as the sealed visual artifact candidate only** | Root may hand these immutable bytes to the sole Integrator. Admission must close the explicit definition/geometry/anchor/readview/pose/removal requirements below. This verdict grants no structural S1, Runtime, animation, gameplay, World-Art or owner acceptance. |

No blocking corruption, source-geometry escape, wrong scale/axis, external-resource inclusion or product-scope violation was found in the delivered artifacts. The findings below distinguish actual missing evidence/behavior from an artifact defect.

## Review inputs and governing scope

Three primary inputs were inspected:

1. Exact Root grant `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/play/2026-10-12/grants/play-02-art.json`, together with follow-up Review §7 (lines 169–229) and Startprompt (especially lines 23–24, 32 and 38) under `/workspace/hestia-followup-2026-10-12`.
2. Actual writer report `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-02/art-report.md`.
3. Full 162-file patch `/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-02/17-art-full.patch`, SHA256 `8b49ff8766505054be335cfe1cffcea1844882c8e70190d156218494f17a9458`.

The Root ExecPlan's Global constraints and Review focus were read. Binding constraints retain at most two implementation writers; one Integrator owns Host/Physics/Save/contracts; Root owns control documents; reviewers only read/play. Finite C01–C28, quantities/recipes/BOM/ports, 1-mg quantities, integer packaging mm³/component counts, separate 0.25-m building/0.125-m HVP grids, native budgets/colliders/movement admission and validation guards remain binding. No free material, duplicate cargo, artificial ore, ship-flight restoration, W12–W29, engine/dependency change or external publication is admitted. Human terrain/Art/usability/general hardware decisions remain `OWNER_REVIEW_PENDING`.

The diff is exclusively additions: **162 exact granted paths, 115 Art + 46 public + 1 test**. Full-patch paths, 162 `new file mode` records, actual Git changed paths, `16-changed-files.txt` and the pre-stage inventory agree. All 20 protected before-byte references match SHA256 and byte size. Existing native source scenes, factoryAssets, machinePose, installation/cargo handling, cargoSite, Host/Physics/Save/catalog/package/config/global attributes were not changed by ART. The new local public `.gitattributes` only covers its new GLBs. Scheduling history was not independently reconstructed from byte artifacts; this reviewer consumed no CPU/browser lease.

## Independently inspected artifact evidence

Checks were direct hash, binary/scope and source reads, not a rerun of the reported test suites or generator.

| Evidence | Independent observation |
|---|---|
| HEAD / parent / scope | Actual Git HEAD and parent match the seal and grant; all 162 changed paths are additions inside the exact write set. |
| Manifest | Art/public copies are byte-identical; SHA256 `b886e419673e69cb5e3200de87af06b23d2e965957ffdc5b6de61c5edcddc0d2`. All asset file references match actual hash/size. |
| Native sources | 22 materialized `.blend` files, **12,741,268 bytes**. All headers are `BLENDER-v403`; all complete block streams end in ENDB and contain DNA1. No Blender open was rerun. |
| Export chain | Generator explicitly saves then reopens the disk file before invoking the existing exporter (`build_assets.py:421–429`). Final raw log has 22 save/reopen/export markers, 22 actual `Read blend` paths and a final 22-asset manifest marker. All provenance generator/exporter/blend/GLB bindings agree with actual bytes; versions declare Blender 4.3.2 / glTF addon 4.3.47. |
| Runtime payloads | 22 real GLBs, **532,496 bytes**, valid GLB v2 header and JSON/BIN chunk streams. **91 separate neutral part mesh roots, 91 meshes, 169 primitives, 13,632 POSITION/NORMAL vertices, 6,816 indexed triangles** across the library. This is an artifact census, not measured runtime draw calls or a hardware budget result. |
| Binary geometry | Every actual POSITION float is finite and inside the union of that part's original oriented boxes, including rotated wind blades. Actual min/max agree with accessor bounds. Indices are in range; NORMAL streams have matching counts and finite unit vectors. |
| Nodes / extras | Exported scene roots cover all nodes. Exact part-ID sets, names, `extras.hestia.partId` and `extras.playBinding` agree; sourceAssetId/definitionId/source SHA agree with the declared snapshot/provenance. No nonneutral transform, matrix, child mesh hierarchy, skin or detached animation track was found. All parent mappings are null roots. |
| Palette | Actual GLB RGB factors agree with sRGB→linear conversion of the accepted five-family palette. Exported metallic/roughness values agree with .2/.86 within float tolerance. Materials are local, opaque and texture-free. |
| Authority semantics | Existing exporter reports bind the actual GLB hash, contain no diagnostics, and declare Decorative, collision/navigation None and destructible=false. These render semantics grant no native immunity, material, collider or navigation authority. |
| Source provenance | Seven unique historical owner-file references match the exact `96cced…` Git blobs and the 22 preserved source blobs. The six Cutter/Former/power-kit JSON asset snapshots are completely equal to the original parsed definitions, including parts, ports, pivots, supports, phase profiles and source-specific fields. TS-owned definitions/carrier projections were also traced in the unchanged owner source; reported focused tests cover their actual source admission. |
| License | Actual 326-byte license is byte-identical to the original power-kit license, SHA256 `bc5e00789f9e69f40bb76b0db9802fca5122dde6d37f905c700b17febccbb632`. It is project-original provenance subject to owner rights/terms and grants no new public license. No provider/remote model, texture or font is present in the generator/GLBs. |
| Targeted LFS | Exactly **44 own new payloads, 13,273,764 bytes**: all materialized worktree files, exact HEAD pointer SHA/size and corresponding real local shared LFS objects agree with `15-lfs-payload-receipts.json`. No historical/global LFS fsck or library scan was performed. |
| Sealed raw logs | All 14 log hash/size references agree with `19-final-art-seal.json`. The saved final Vitest log identifies the actual ART browser cwd and two test files and says **25 passed / 25**, 5.31 s. Source contains nine new derivative cases and sixteen existing presentation cases (one source `it` is instantiated twice). This is inspection of that recorded run, not an independent rerun. |

The genuine initial source/part/definition/scale RED and palette RED are assertion failures, not missing-import/setup failures. Earlier Blender containment/material failures remain recorded. The negative-zero repair matches existing JSON.stringify source-byte semantics and changes no native geometry. The optional Draco diagnostic does not invalidate these uncompressed GLBs: no Draco extension or compressed buffer is present. Explicit process exit metadata is not encoded in the sealed stdout logs; the final Vitest summary and artifact bytes corroborate their substantive claims, while the empty tsc log needs a separate execution receipt.

## Findings and unresolved actual gaps

### R1 — P1 acceptance blocker, expected Integrator ownership: normal-runtime and structural-S1 proof absent

Evidence: ART `README.md:15–23`; manifest `manifest.json:2150–2154`; writer report `art-report.md:48`; follow-up Review §7.4 lines 213–222 and §7.5 lines 224–229. Every manifest entry is `PENDING_INTEGRATOR`.

This commit provides no loader/receiver, actual finite readview binding, integrated GLB pose/removal implementation, normal-game import/movement/capture, or accepted Asset-to-Voxel/Structural-S1 bridge. That is consistent with the grant and correctly disclosed by the writer. It blocks declaring full PLAY-02, integrated S1 Cutter/Former or World-Art/animation/gameplay acceptance. It does **not** invalidate the sealed visual handoff or authorize another writer to modify shared native authority. Integrator must provide the missing runtime evidence; the structural bridge remains a separately explicit known gap until an accepted solution exists.

### R2 — P2 animation gap: delivered storage front cannot independently open through existing part poses

Evidence: `build_assets.py:187–205` creates both front doors as cuboids inside the `body` mesh; `build_assets.py:376–395` merges each part's details into one root. Storage's native source `storage/storage/native-source.json:16–34` identifies the single body part; the manifest storage entry starts at `manifest.json:1741`. Actual storage GLB contains body plus four support roots, no door roots, skin, clip, pivot or separate open-state variant.

The requested real-build storage opening/transfer state (Review §7.2, storage row) is not represented by separately addressable door geometry. A future loader can preserve/hide the body and display readview-owned stock, but cannot rotate only those doors using the supplied part roots. This is a concrete remaining animation asset gap, not a claim that the native collider should be opened or modified. Root should adjudicate a narrowly granted visual state variant/adapter, or an explicit accepted state contract, before claiming the opening behavior. Cargo already supplies closed/open visual variants.

### R3 — P2 evidence gap: saved typecheck log does not prove the reported execution result

Evidence: writer report `art-report.md:41` claims `tsc -p tsconfig.json`, Exit0, 2.33 s. `13-typecheck.log` is **0 bytes**. Seal `19-final-art-seal.json:62–65` records only its empty SHA256 and size; there is no saved command/cwd/start/end/exit receipt in that record.

Silent tsc output is normal, but the empty file alone cannot distinguish a successful run from a command that was never executed. This review therefore records tsc as **ACTOR_REPORTED_EXIT0; independent persisted execution receipt unavailable**, without asserting a failure or rerunning it. An existing actual tool execution receipt can close this gap without another test/CPU job. Payload and scope readiness are independently supported despite this receipt gap.

### R4 — P2 future runtime admission gap: provenance SHA is not current definition or live anchor authority

Evidence: `build_assets.py:106–128`, `142–147`, `471–477`; manifest carrier entry `manifest.json:404–412`, cable entry `manifest.json:1281–1286`, cargo entry `manifest.json:1935–1957`; tests `playAssetDerivatives.test.ts:99–116` and `171–185`; ART `README.md:25–31`, `51–61`.

Ten entries bind exact catalog/composed definition references; twelve declare visual-only anchors (three carriers, two cargo states, five materials, two cable pieces). The carrier anchors provide exact envelope sizes but no profileId/profileDigest field; cable anchors provide itemId and a paid-route declaration but no live route/endpoint/job identity. These are declared visual anchors allowed by the grant, not closed gameplay admission records. Their historical owner-file SHA and generated `visual_anchor_*` IDs cannot serve as a current native definition/anchor digest.

The Integrator must admit the three carrier silhouettes against the actual closed CargoHandlingProfile **ID + digest + revision + custody** (reported oracle pairs: heavy B07-BOM, medium B06-BOM, light RAW8). Cargo must compare owner/container identity and exact live bounds/open state; closed/open meshes are alternative depictions of the same segment, never duplicate contents. Its ground-center mount is `[-5.5,1.25,13.125]` m, while the declared box center is `[-5.5,2,13.125]` m. Material meshes must consume actual unique lot/item/catalog readviews; triangles/sheets cannot encode quantity. Cable transforms must derive only from an admitted paid route with exact integer-mm length and endpoints. Incompatible anchors must fail visibly rather than silently grant geometry/material/stock.

Root states that current Integrator V2 cargo owner code has evolved while geometry is preserved. This reviewer did not review that other worktree. The frozen `96cced…` source-file/blob SHA remains historical provenance; an unrelated TS owner-file edit is not a geometry migration. Current runtime admission must separately compare the exact definition version/digest **and** canonical geometry snapshot/sourceDigest, or the exact closed anchor geometry/identity/readview. Regenerator `check_sources` is intentionally pinned to the historical source bytes and should not be weakened to bypass a newer owner file.

### R5 — P2 visual evidence gap: no player-height ART quality or real state-transition review

Evidence: writer report `art-report.md:28`, `48`; ART `README.md:51–61`; follow-up Review §7.2 and §7.5. No new ART in-game capture/import, visibility, motion, damage or named-hardware measurement is supplied.

Source/artifact inspection supports hard functional forms, original frame/tool geometry, five distinct lot silhouettes, neutral meter coordinates and accepted palette. It does not establish player-height readability, guard/tool visibility, front access, actual loaded silhouette, empty/full storage, carried/depot load states or owner artistic approval. Wreck delivery is limited to the existing 1.5×1.5×1-m native access segment; it does not deliver a large wreck hull, free walkable ramp or visible salvaged modules tied to live stock. An exposed visual mouth/interior still has the original native solid collider; the accepted normal route must remain clear and understandable. These limits are disclosed, and Root retains the usability/Art decision. Human Art, terrain, usability and general hardware acceptance remain `OWNER_REVIEW_PENDING`.

### R6 — P2 generator reproduction risk: live catalog input is outside the early frozen-source guard

Evidence: `build_assets.py:46–55`, `71–88`, `116–138`; ART `README.md:77–78`. FROZEN protects six owner paths, but excludes the seventh actual source-file owner `apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts`. Snapshot reads the live catalog, records its material definitions/digests and copies current owner bytes while SOURCE_HEAD remains the literal historical `96cced…`.

A future catalog-only edit can therefore pass `check_sources()` and generate new material/catalog bindings labelled with the old source head. The later historical Git-blob test would reject a changed owner file, but the advertised early source guard alone does not reject it before writes. This is a code-level reproducibility risk; all seven current sealed historical source references and the current catalog read agree, so no present payload mismatch is alleged. Root may dispatch a narrowly scoped guard fix that pins this owner and the actual catalog digest before snapshot writes, or preserve the pinned checkout as an explicit reproduction prerequisite. No catalog/native definition change or broad compiler work is needed.

## Required Integrator boundary for handoff

- Load only the reviewed manifest schema/IDs and verified payloads. Keep the existing canonical source, colliders, quantity/material/energy/save truth and validation guards authoritative. Decorative GLB semantics must never be promoted to Structural S1 authority.
- Mount each node under the native **instance + partId** presentation/removal group. Detail faces share their part mesh, so removal can remove the entire root; actual removal behavior is not delivered by the artifact. Never recreate an absent part when applying a pose, reloading or switching a visual variant. Null export parent mapping is not immunity to native damage.
- Vertices are already in the complete native local XYZ frame, with neutral nodes. Apply the world instance transform once and confirmed part translations once. Read Cutter/Former pivot/axis/sweep and phase channels from preserved source; do not add the source box center again or run clips from render time. WAIT_INPUT/WAIT_POWER/WAIT_OUTPUT/RecoveryHold and damage require real readview evidence. Wind blades are separate part roots, but `joints` is empty and the source only carries hub/sweep fields; a rotor group/pivot adapter remains explicit Integrator work rather than an exported animation guarantee.
- Close R4 with exact live admission and R2 with a usable state contract before claiming the requested states. Capture the imported normal build at player height and exercise movement/WAIT/stock/removal/reload with ordinary gameplay evidence. Preserve the known S1 bridge and owner review gaps rather than promoting artifact checks into World-Art acceptance.
- Preserve the 44 real LFS payloads during local adoption; the full textual patch contains LFS pointers and is not a portable binary package by itself.

Root adjudicates the findings and dispatches any required scoped fix. The reviewer has not changed any product path, branch, grant, index contents, source artifact or acceptance status.
