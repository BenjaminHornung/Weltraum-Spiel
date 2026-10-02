# Hestia asset compiler spike — C1 conflict register

Date: 2026-10-02. Base: `25bc7f5bbd2db6317c42193873eadeaf10a092c5`. Current scope: C0/C1 ONLY; **STOP before C2**. Existing source/contracts remain unchanged. `PRODUCT_INTEGRATED = NO`.

No unresolved pair of current, same-boundary contradictory MUST rules was found. A later explicit conflict still triggers STOP with both quotations; scoped research decisions do not override public authoring contracts. `RESOLVED_*` below means an interpretation/design decision, **not implemented or tested compiler behavior**.

## CR01 — historical frame suggestions versus current authoring frame

**Status: RESOLVED_BY_CURRENT_CONTRACT.** Authoring contract `docs/tools/hestia-asset-authoring-contract-v1.md:29-31` and closed schema require `metersPerUnit=1`, `RIGHT`, `+Y` up, `+Z` forward. The input lease expressly confirms that frame. Older Z-up ideas are not current authority. Preserve current frame; verify actual GLB transforms without a second axis conversion.

## CR02 — exporter mirror rejection versus compiler reflection support

**Status: RESOLVED_BY_SCOPE.** Current exporter/validator rejects negative determinant (`validation.py:168-200`, exporter documentation validation section). The spike reader contract requires world determinant/winding correction for validated synthetic/direct inputs (`04_COMPILER_CONTRACT_OUTPUTS.md:15-43`). Different stages, not contradictory authoring MUSTs. Do not weaken the existing exporter or claim it currently emits accepted mirrored assets. The compiler still rejects an Error report; mirror geometry tests do not bypass that final admission rule.

## CR03 — target product manifest versus research schema

**Status: RESOLVED_BY_SCOPE.** Authoring contract line 55 assigns Agent G the target `hestia.asset-manifest.v1`; package 04 lines 128-164 assigns this isolated output `hestia.asset-compiler-spike.v1` unless an accepted HVOX container exists. No accepted container was located in the inspected schema/tools/application paths. Different artifacts are labelled explicitly; no current schema amendment, HVOX claim, or target-manifest adoption occurs.

## CR04 — terrain/adaptive/structural formats versus asset bytes

**Status: RESOLVED_BY_SCOPE.** Terrain is 32×64×32 cells with sample/apron channels; terrain material 0 is dark rock. Adaptive/structural addressing uses 16³ concepts and structural Air=0 but requires additional identities/proofs/registry and level-specific admission. Research bricks are 4096 slots, Air=0, x-fastest, 0.125/0.25 m explicit profiles. Keep separate; similarities are not runtime compatibility. Source table and anchors are in CONTRACT_AUDIT. Do not apply stricter runtime ID syntax/FNV hashes to public authoring IDs/SHA-256.

## CR05 — permutation equality versus truthful source-bound full tree

**Status: RESOLVED_BY_EXPLICIT_SPIKE_COMPARISON.**

Sources: `03_GOLDEN_CORPUS_MATRIX.md:35-59` says “gleicher kanonischer Output” and “Erwartung: identischer kanonischer Output.” `04_COMPILER_CONTRACT_OUTPUTS.md:145-164` requires source GLB/report SHA-256 and manifest-tree hash; lines 166 prohibit nondeterministic environmental content.

Resolution, explicitly approved in R1-A2 by reviewer **`731643b5-d353-4147-82e7-6d6d4eab31fb`**, relayed by the superorchestrator:

- Identical input bytes/profile/versions -> identical **full** deterministic output bytes/tree.
- Semantically equivalent ordering permutations -> identical normalized-geometry/semantics/voxelization hashes, brick bytes and owner/material/address associations, and canonical semantic manifest projection.
- Raw GLB/report source hashes, authoring-payload digest/source inventory and their full provenance-binding manifest/tree remain truthful and **may differ** for different bytes.

The exact projection fields/exclusions are in CONTRACT_AUDIT. This is an explicit comparison definition, not removing/faking published provenance or changing public authoring schema. No reviewed MUST requires sourcehash-bearing full manifest/tree byte identity for different input bytes. If such an explicit current MUST is newly found, STOP and quote it. Executable permutation/ten-run tests remain **NOT RUN**.

## CR06 — flood-only cavity/tunnel design gap

**Status: RESOLVED_DESIGN_GATE.**

Exterior flood alone labels every enclosed non-surface region as material, falsely filling G13's cavity. R1-A2 reviewer **`731643b5-d353-4147-82e7-6d6d4eab31fb`** approved retaining flood plus cavity-aware geometric parity and stable ambiguous-case rejection as a design resolution. R2-A **`a9f5de5b-43db-4fbc-bb1b-625a06dfa53d`** refined the minimum reference:

1. Conservative closed-contact surface cells.
2. Full surface-cell bounds plus a free padding layer; 6-neighbor exterior flood.
3. Remaining non-surface connected components; deterministic cell-center representative with geometry ray parity, even/odd **per Solid part**.
4. Material labels fill, cavity labels stay Air; grazing/edge/vertex/uncertain labels reject stably.

No GWN dependency and no relabelling G13 to Shell. Mandatory G13 runs at both profiles against independent interval oracles in EXECPLAN. G14's under-resolved contact-A tunnel can seal at 0.25 m; use both-profile resolvable control and explicit phase/diagonal/under-resolved topology-loss rejection. Parity-empty enclosed air does not prove raster exterior connectivity. **Implementation and independent hollow/tunnel oracle remain NOT RUN.**

## CR07 — joint transform proof missing upstream

**Status: UPSTREAM_GAP; DOWNSTREAM_REQUIREMENT_FROZEN.** R1-A finding: `blender_adapter.py:792-811`, `model.py:323-332`, `validation.py:579-595` do not provide joint transform inventory validation. Joint/marker placement is contractually carried by GLB nodes, not the canonical semantic record. Compiler independently finite/nonsingular-validates all relevant nodes and ancestors, keeps composed world placement and shear, and rejects unsafe transforms regardless of report claims. Existing Blender code stays read-only. Describe the minimal upstream followpatch in later INTEGRATION_HANDOFF; no implementation proof at C1.

## CR08 — unannotated scene geometry can escape semantic extraction

**Status: UPSTREAM_GAP; DOWNSTREAM_REJECTION_FROZEN.** R3-A **`23ac2427-9a49-4c2e-a3da-7996b5affb7e`** confirms `blender_adapter.py:699-705` skips unannotated objects but `:1066-1081` exports all Scene/Collection objects. Reject reachable meshes without exact authored Part bindings and validate used extras/ancestor ownership. No guessed Decorative, RGB material, or report-as-security-truth shortcut. Existing exporter unchanged; later handoff only.

## CR09 — true thickness and replacement geometry not generally proved

**Status: OPEN_RESEARCH_LIMIT; FAIL-CLOSED_RULE_FROZEN.** Current contract line 39 requires geometry measurement; metadata/AABB is not proof. Beam/Rod policy alone cannot justify `PreservedSemantic`; retain genuine replacement geometry/parameters and payload. Tube must not turn into filled rod. Overdeclared thickness gets negative fixtures. Use `RejectedUnprovenThickness` for unsupported/unproved geometry, rather than silently erasing it or claiming general measurement solved. Exact proof implementation/outcomes belong to C6 and remain NOT RUN.

## CR10 — material/Part interior precedence unspecified

**Status: OPEN_RESEARCH_LIMIT; AMBIGUITY_REJECTION_FROZEN.** Current schema maps semantic render/structural materials but does not define a multi-material volume selector. Package 04 lines 100-102 explicitly allows research decisions/ambiguity diagnosis. Unique geometry-bound material of a homogeneous Solid is usable; unresolved distinct material/interior/owner choices reject. Defaults and surface ownership are not automatic interior precedence. Use order-independent candidate sets and manifest brick owner refs; part-owned entries are the minimum ownership evidence. Count only active voxelized slots for the 255 cap; unused report slots and paletteIndex are not that cap/map. G16 must record actual success with a proven rule or honest rejection, not fabricated precedence.

## CR11 — report inventory versus baked geometry/provenance

**Status: OBSERVED_BOUNDARY_AND_UPSTREAM_GAP.** Inventory topology counts/local bounds/slot-derived primitive IDs are not baked transform, manifoldness, orientation, thickness, or stable triangle proof. Geometry validation uses actual world triangles across all primitives and exact positional seams, including duplicates across materials, opposite edge incidences, vertex fans and self-intersection. Export options/frame constants do not pin actual Blender/glTF exporter versions or prove axis/unit behavior. Keep source provenance truthful; no fabricated version or E2E claim. Later handoff records missing source-tool provenance and real export verification needs.

## CR12 — nonempty status from session instrumentation

**Status: RESOLVED_PREFLIGHT_INSTRUMENTATION_EXCEPTION.** Fresh meta prelaunch worktree was pristine, per superorchestrator. Current agent and R3/meta checks found only `.opencode/throughput.jsonl` and `.opencode/throughput.md`, harness-generated since session creation; tracked diff empty. The superorchestrator explicitly directed preserving them and recording this exception. C0 qualifies cleanliness as tracked/task-source clean **with accepted instrumentation exception**; never claim empty porcelain. Do not stage/delete/ignore/reconfigure logs/config. The C1 commit contains only the three leased new Markdown files.

## CR13 — Blender installed outside allowed executable root

**Status: NOT_RUN_ENVIRONMENT_LIMIT.** Read-only metadata found `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, version 5.2. Execution is restricted to `C:\IFI_SourceCode`; this binary was not run and Blender must not be installed by this task. Real E2E is **NOT RUN — EXECUTION_ROOT_BLOCKER**, not “Blender globally unavailable.” This does not invalidate the 58 passing Python host tests. The superorchestrator would need to provide an allowed-root executable/environment for later actual E2E.

## CR14 — budgets, render allowlist and whole-output atomicity

**Status: DOWNSTREAM_REQUIREMENTS_FROZEN; IMPLEMENTATION_NOT_RUN.** R3-A requires pre-read byte budgets, strict bounded JSON, full graph/accessor/instance expansion budgets, safe grid/padding/flood/work/output limits and boolean rejection; explicit UV/PBR/embedded-image handling without external URI/image decode; finite NORMAL/TANGENT and rejection of unsupported geometry-altering extensions. Report payload digest must use the exact existing canonical helper. C6 stages/verifies a whole sibling generation, rejects every existing target unchanged, excludes tree self-preimage, publishes by one atomic directory rename, and fault-tests collision/failures/owned cleanup. No broad upstream rewrite or dependency follows from these requirements.

## Review and checkpoint limits

R1-A/R1-A2, R2-A, and R3-A are user-dispatched **independent read-only prechecks**, relayed by the superorchestrator; reviewer IDs above identify attribution. This agent did not create another agent or claim fresh direct access to their entire sessions. Their design approval is not implementation PASS, independent executed golden evidence, a human final gate, or full-spike acceptance.

C1 self-review/fresh scoped checks and commit evidence are recorded in EXECPLAN. `IMPLEMENTED = NO`; compiler `CODE_VERIFIED`, `CORPUS_VERIFIED`, `DETERMINISM_VERIFIED`, and `BLENDER_E2E_VERIFIED` are NOT RUN; qualified performance NOT RUN; `PRODUCT_INTEGRATED = NO`. C2-C8 require further authorization, and this writer stops at the C1 checkpoint.
