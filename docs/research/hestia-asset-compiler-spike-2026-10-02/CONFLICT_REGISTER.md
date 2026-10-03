# Hestia asset compiler spike — C1 conflict register

Initial2026-10-02, C8 closure2026-10-03; base `25bc7f5bbd2db6317c42193873eadeaf10a092c5`. Historical decisions retained; ALL findings/final scoped endreviews externally CLOSED at unchanged c8e451... code freeze. META SPIKE_ACCEPTED_WITH_NOTES; exact final research commit authorized, STOP afterward/no push here. Upstream unchanged. `PRODUCT_INTEGRATED = NO`.

No unresolved pair of current, same-boundary contradictory MUST rules was found. A later explicit conflict still triggers STOP with both quotations; scoped research decisions do not override public authoring contracts. C1 `RESOLVED_*` labels are interpretation/design decisions; implemented evidence is specifically updated here and in EXECPLAN/PACKAGE_FORMAT, never inferred from that label alone.

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

Exact C6 preimages/projection are in [PACKAGE_FORMAT.md](PACKAGE_FORMAT.md); only sources/provenanceSha256/manifestTreeSha256 excluded, no fake provenance/public schema change. C8 complete native expected-outcome ten repeats and scoped external reviews PASS; META accepts with notes. Immutable capture pending fields are historical, not current acceptance. A new contrary current MUST still triggers STOP with quotation.

## CR06 — flood-only cavity/tunnel design gap

**Status: RESOLVED_DESIGN_GATE.**

Exterior flood alone labels every enclosed non-surface region as material, falsely filling G13's cavity. R1-A2 reviewer **`731643b5-d353-4147-82e7-6d6d4eab31fb`** approved retaining flood plus cavity-aware geometric parity and stable ambiguous-case rejection as a design resolution. R2-A **`a9f5de5b-43db-4fbc-bb1b-625a06dfa53d`** refined the minimum reference:

1. Conservative closed-contact surface cells.
2. Full surface-cell bounds plus a free padding layer; 6-neighbor exterior flood.
3. Remaining non-surface connected components; deterministic cell-center representative with geometry ray parity, even/odd **per Solid part**.
4. Material labels fill, cavity labels stay Air; grazing/edge/vertex/uncertain labels reject stably.

No GWN dependency and no relabelling G13 to Shell. C5 implementation and own independent interval/tunnel tests passed, with user-relayed R2-C scoped closure described in EXECPLAN. C6 full packages preserve both-profile G13 and both inner windings. G14 coarse sealing rejects; wide/phase controls have actual through-body Air paths. Narrow orthogonal PL-boundary-disk inclusion plus induced component mapping is documented in PACKAGE_FORMAT; no Euler/counts-only shortcut or universal geometry support is claimed.

## CR07 — joint transform proof missing upstream

**Status: UPSTREAM_GAP; DOWNSTREAM_REQUIREMENT_FROZEN.** R1-A finding: `blender_adapter.py:792-811`, `model.py:323-332`, `validation.py:579-595` do not provide joint transform inventory validation. Joint/marker placement is contractually carried by GLB nodes, not the canonical semantic record. Compiler independently finite/nonsingular-validates all relevant nodes and ancestors, keeps composed world placement and shear, and rejects unsafe transforms regardless of report claims. Existing Blender code stays read-only. Describe the minimal upstream followpatch in later INTEGRATION_HANDOFF; no implementation proof at C1.

## CR08 — unannotated scene geometry can escape semantic extraction

**Status: UPSTREAM_GAP; DOWNSTREAM_REJECTION_FROZEN.** R3-A **`23ac2427-9a49-4c2e-a3da-7996b5affb7e`** confirms `blender_adapter.py:699-705` skips unannotated objects but `:1066-1081` exports all Scene/Collection objects. Reject reachable meshes without exact authored Part bindings and validate used extras/ancestor ownership. No guessed Decorative, RGB material, or report-as-security-truth shortcut. Existing exporter unchanged; later handoff only.

## CR09 — true thickness and replacement geometry not generally proved

**Status: IMPLEMENTED_NARROW_PROOF; GENERAL_THICKNESS_OPEN.** C6 exact orthogonal material-axis sections use spike-local 2*h margin, real dyadic witnesses and fully specified exact ratio endpoints, not metadata/AABB. Proven box beam/single-layer rectangular shell replacements carry usable parameters. Overdeclared/thin and rounded-under-threshold cases reject. Unsupported rods/tubes/layer stacking/arbitrary nonorthogonal proof is RejectedUnprovenThickness; no tube becomes a rod and no structural part silently disappears. General thickness remains unsolved; actual support/outcomes are in PACKAGE_FORMAT.

## CR10 — material/Part interior precedence unspecified

**Status: IMPLEMENTED_UNANIMOUS_BINDING; GENERAL_SELECTOR_OPEN.** Current schema still does not define a multimaterial volume selector. The spike requires homogeneous geometry-bound material and agreement with any explicit Part/asset-default structural IDs; conflicts reject without precedence. Per-Part brick ownership/overlapping geometric contributions remain explicit, not global XOR/net volume. Only active voxelized bindings consume 255 slots; unused declarations and paletteIndex do not. G16 ambiguity rejection remains allowed and no general selector is claimed.

## CR11 — report inventory versus baked geometry/provenance

**Status: OBSERVED_BOUNDARY_AND_UPSTREAM_GAP.** Inventory topology counts/local bounds/slot-derived primitive IDs are not baked transform, manifoldness, orientation, thickness, or stable triangle proof. Geometry validation uses actual world triangles across all primitives and exact positional seams, including duplicates across materials, opposite edge incidences, vertex fans and self-intersection. Export options/frame constants do not pin actual Blender/glTF exporter versions or prove axis/unit behavior. Keep source provenance truthful; no fabricated version or E2E claim. Later handoff records missing source-tool provenance and real export verification needs.

## CR12 — nonempty status from session instrumentation

**Status: RESOLVED_PREFLIGHT_INSTRUMENTATION_EXCEPTION.** Fresh meta prelaunch worktree was pristine, per superorchestrator. Current agent and R3/meta checks found only `.opencode/throughput.jsonl` and `.opencode/throughput.md`, harness-generated since session creation; tracked diff empty. The superorchestrator explicitly directed preserving them and recording this exception. C0 qualifies cleanliness as tracked/task-source clean **with accepted instrumentation exception**; never claim empty porcelain. Do not stage/delete/ignore/reconfigure logs/config. The C1 commit contains only the three leased new Markdown files.

## CR13 — Blender installed outside allowed executable root

**Status: NOT_RUN_ENVIRONMENT_LIMIT.** Read-only metadata found `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`, version 5.2. Execution is restricted to `C:\IFI_SourceCode`; this binary was not run and Blender must not be installed by this task. Real E2E is **NOT RUN — EXECUTION_ROOT_BLOCKER**, not “Blender globally unavailable.” This does not invalidate the 58 passing Python host tests. The superorchestrator would need to provide an allowed-root executable/environment for later actual E2E.

## CR14 — budgets, render allowlist and whole-output atomicity

**Status: IMPLEMENTED_SCOPED_REFERENCE; NATIVE_LINK_EVIDENCE_LIMIT.** Reader/admission/global geometry/grid/work/owned-brick caps remain unchanged; C6 adds bounded JSON/metadata+binary output preflight before payload packing, exact report binding and actual-byte verifier. Whole owned sibling staging and one local Windows no-replace directory rename are fault-tested, including late empty/nonempty collisions and real junction/broken-junction prechecks. POSIX/UNC/mapped network publication rejects. Native symlink creation failed WinError 1314, so native symlink/broken-symlink cases remain NOT RUN; labelled lexical mocks are not that evidence. No ACL/privilege/upstream/dependency changes.

## CR15 — valid 90-degree TRS baking versus exact orthogonal fill scope

**Status: OPEN_SCOPED_SUPPORT_LIMIT; R1-C INTERPRETATION RELAYED.** Exact quarter-turn MATRIX compiles. Common quaternion [0,0,sin(pi/4),cos(pi/4)] bakes 12 valid C3 triangles but Float64 residuals are nonorthogonal for the exact C5/C6 proof, producing NOT VOXELIZED / thin.unproven. Arbitrary rotation/shear has the same scoped proof limitation. This is not invalid geometry, a universal rotated-fill obligation, or license to snap/repair/relabel. G05/G06 variants remain inside those exact IDs; reasoned BLOCKED must be recorded in future corpus/handoff. Default Blender 90-degree TRS interop remains an actual E2E risk.

## Review and checkpoint limits

R1-A/R1-A2, R2-A, and R3-A are user-dispatched **independent read-only prechecks**, relayed by the superorchestrator; reviewer IDs above identify attribution. This agent did not create another agent or claim fresh direct access to their entire sessions. Their design approval is not implementation PASS, independent executed golden evidence, a human final gate, or full-spike acceptance.

C1 no-implementation status is historical. C2-C6 functional core and focused own tests/self-review are recorded in EXECPLAN. Completed C6 freeze reviews were relayed by the user: R1-D `731643b5-d353-4147-82e7-6d6d4eab31fb` Contract/Authority SCOPED PASS WITH NOTES/no MUST conflict; R2-D `a9f5de5b-43db-4fbc-bb1b-625a06dfa53d` core math/oracles/hashes PASS plus two metadata P2s REQUIRES_FIX; R3-D `23ac2427-9a49-4c2e-a3da-7996b5affb7e` other scoped checks PASS plus exactly those same P2s REQUIRES_FIX. No further core/algorithm/report/atomicity/budget finding was relayed. This is external review evidence, not this writer's tests or full-spike acceptance.

## C6 corrigendum F1/F2 — existing contract validation, not a contract conflict

Freeze `e052723b913410d92e1a6d7f485de58936e7915e` accepted malformed yet correctly rehashed decision/proof/minima/beam metadata and boolean-as-number geometric inputs. Own five-case regression reproduced **5 subtest failures, exit 1**, before production edits. Shared `validate_decision` closes actual conditional record fields and checks typed numeric/display/exact-witness coherence; the full geometric-record loop types all fields before decoded-cell equality. Published correction `a73e4d9b0af672800f27b1fef354d60e10e2819b`; original two P2s **independently CLOSED** by user-relayed R2-D2/R3-D2. R2 8 Core calls/9 positive validations/34 negative probes; R3 233 correctly rehashed negatives rejected. External META parent 115 PASS in 38.509 s/diff check 0/only accepted logs; none is this writer's new run. No producer/schema/preimage/version/support/budget/authority change; 41,295-byte/tree pin unchanged.

## C6 duplicated diagnostic counts — new independent P2, narrow type guard

External META/R3 confirmed 4 false acceptances at a73e4...: both provenance/diagnostics count copies accepted False=0 and True=1 after correct bindings; 12 divergent shape/count controls already rejected. Own RED/guard/regression evidence is in EXECPLAN. Published correction 1b652... is now independently CLOSED: user-relayed R3-D3 TARGETED PASS, Exit 0, 25 negatives including four Boolean fakes rejected/six integer controls valid/independent provenance/projection/tree/pin; META 3 focused PASS in 1.882 s/diff baseline 0/only accepted logs. These are EXTERNAL, not this writer's new C7 runs. Producer/format/preimages/versions/support/caps unchanged; no open C6 findings.

## C7 research limits and actual scoped evidence

Actual five-command CLI reuses source/report/package admission and local Windows atomic no-replace ownership; validate/inspect cannot invent valid state. EXACT G01-G30/variants/actual source bytes/stable negative codes/independent full intervals and real ordering matrix are implemented; 370 single-run records (285 SUCCESS/77 expected rejects/8 reasoned BLOCKED) have frozen source/content/projection/tree/brick/file bindings. The final native replay did not alter saved evidence or expected hashes. General TRS proof, tube/rod and multilayer support remain BLOCKED, not invalid rotation or repaired/Shell geometry. GWN_NO_ADOPTION is reasoned NOT_IMPLEMENTED; no candidate numbers or authority replacement. Actual 1008-input/expanded-triangle workload is admitted BOTH profiles, all timings CONTAMINATED_DIAGNOSTIC/memory UNSUPPORTED; Medium/Large excluded BEFORE input allocation by frozen 20k expanded limit. GOLDEN_CORPUS/BENCHMARK and machine JSON contain own evidence/commands. Initial C7 reviews now complete as externally attributed below; no new agent here.

## C7 review corrections F1–F4 — scoped at bc832...

User-relayed EXTERNAL evidence: META 131 PASS / Exit 0 / 61.092 s / baseline diff check 0 / only accepted logs. R1-E SCOPED PASS WITH NOTES, no execution; R2-E SCOPED PASS WITH NOTES, three in-memory programs Exit 0 / 35 actual core calls / 144 remaps checked byte/content / 185 pairs and 370 pins / independent full-set/source-versus-raster bounds / G02 repeat 2. R3-E REQUIRES_FIX two P2s, five programs Exit 0; last G02 ×10 executes TEN real compile/classification/packing/verify calls and full-byte comparison, not complete corpus ×10. Small preflight/cells/bricks counts/work (1008/672/9,424,296+4,237,128) independently checked, no benchmark rerun. GWN_NO_ADOPTION reasoned nonimplementation accepted; no P1/new MUST conflict. These are not this writer's correction tests.

| Finding | Own root fix / regression | Status |
| --- | --- | --- |
| F1 P2 (R3/META) | Shared `path.anchor` guard BEFORE mkdir/write; traversal/backslash/colon preserved, actual regression wholly RAM. No native foreign-write/injection claim. | CLOSED externally R3-E2; own fresh PASS |
| F2 P2 (R3/META) | Actual BLOCKED core code routes CLI Exit 1/stderr/empty stdout BEFORE publication; API detail and exclusion controls retained. REAL G24 with synthetic clocks is not performance measurement. | CLOSED externally R3-E2; own fresh PASS |
| F3 P3 (R2) | Independent boundsCells/boundsMeters/h³/full grid inventory from existing analytic full sets; no producer helper, empty list remains []. Four-field/empty fakes reject. | CLOSED externally R2-E2; own fresh PASS |
| F4 P3 (R1/R2) | 185 variant-addressed pairs / 179 different SHA byte-pairs; six identity duplicates intentional. No deduplication, input/record/PIN change. | CLOSED externally R2-E2; own count verified |

Own final RED: three tests, 22 subtest failures, 1.950 s, Exit 1 before root edits; GREEN three PASS / 1.461 s / Exit 0. Final focused CLI/Golden/Benchmark + existing count/pin/source-warning controls **21 PASS / 19.994 s / Exit 0**. Additional 14 scoped core compiles preserve exact saved public records/file/content/projection/tree pins. All frozen artifact SHAs/bytes unchanged. No full-suite, 1008-triangle benchmark, producer/core/cap/version/preimage or C8 change. Exact commands and the one non-reproduced native publication.io check are recorded in EXECPLAN. Targeted R3/R2 reviews remain user-dispatched/PENDING.

The previous correction-run paragraph is historical. User-relayed EXTERNAL R3-E2 (three programs Exit 0) / R2-E2 (one program Exit 0) now close ALL F1–F4, and META accepts C0–C7 at c8e451... (selected 21 PASS/19.220 s/baseline diff 0/only accepted logs). Exact scopes/counts are in REVIEW/EXECPLAN, not this writer's own new runs.

C8 own134/58/owned compileall PASS; managed native ten repeats Exit0/1426.516652s,370 logical/3700 case executions (root calls NOT_INSTRUMENTED),285S77expectedReject8reasonedBLOCKED per set,185addressed179different inputs. All records/pins/immutable C7/C8 bytes unchanged;401 published files verified/owned generation removed. One Small/profile Exit0/CONTAMINATED_DIAGNOSTIC/memory UNSUPPORTED, larger ranges before-builder excluded; GWN reasoned NOT_IMPLEMENTED. Real Blender execution-root blocker/symlink1314/qualifiedPerf remain NOT RUN; UNKNOWN once non-reproduced publication.io retained, no AV guess/fix. Launcher correction before Python was not a compiler failure. EXTERNAL all3 endreviews SCOPEDPASS_WITH_NOTES/no open findings and META independent artifact validation Exit0 accept SPIKE_ACCEPTED_WITH_NOTES. Immutable PENDING fields identify PRE-COMMIT capture; exact final commit authorized, stop after commit/no writer push. ProductNO/upstream unchanged.
