# Exact G01–G30 corpus — frozen C7 inputs and actual C8 ten-repeat evidence

Gate/package/path date **2026-10-02**, execution/closure2026-10-03. Original C7 parent1b652...; unchanged code/review freeze `c8e451a3e52fc8da743df011debae682f93c89a3`. All3 external scoped endreviews PASS_WITH_NOTES/no open findings; META accepts SPIKE_ACCEPTED_WITH_NOTES and authorizes exact final research commit, writer STOPS after commit. `PRODUCT_INTEGRATED = NO`; no runtime/HVP/renderer/product-format adoption.

## Actual commands, not a placeholder CLI

All commands run from the pinned worktree with the explicit Ctree Python 3.12.13 executable and `-B -X utf8`. Module arguments below follow that executable prefix:

```powershell
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' -B -X utf8 -m tools.hestia_asset_compiler --help
```

| Subcommand | Arguments / owning behavior |
| --- | --- |
| `compile` | `--glb INPUT.glb --report INPUT.report.json --profile micro-0125-research-v1 --output NEW_DIRECTORY`; all four required. The standard profile is `standard-025-v1`, never a silent compile default. Actual C6 report/core/verified atomic local-Windows no-replace publication. |
| `validate` | `DIRECTORY`; actual file inventory, canonical records, brick bytes, semantic/provenance/projection/tree bindings. |
| `inspect` | `DIRECTORY [--json]`; validates FIRST, then concise human output or machine-readable identity/profile/counts/content/source/tree information. |
| `golden` | `[--case G01 ...] [--profile PROFILE ...] [--repeats 1..10] [--output NEW_DIRECTORY]`; default is the explicit two-profile matrix, exact G01–G30, ordering matrix and one smoke repeat. |
| `benchmark` | `[--population small\|medium\|large] [--profile PROFILE ...] [--output NEW_DIRECTORY]`; real bounded diagnostics, never qualified performance. |

Exit codes: **0** successful operation/passing corpus or reported benchmark exclusion; **2** missing/invalid arguments; **1** expected input/package/publication I/O or compiler rejection; **3** corpus oracle/pin failure. Expected errors emit stable diagnostic codes on stderr with no traceback, source paths or untrusted source diagnostic text. Inspect emits no claims for invalid packages. C7 research output publication uses a verified owned sibling generation and the same admitted local-Windows no-replace directory rule; it is NOT an asset package. Existing outputs/foreign stale siblings stay untouched.

C7 review correction at freeze `bc83267745906c956c69815e91db64766ea5d676`: the shared research publisher rejects ALL anchored/rooted/drive-relative names using `Path.anchor`, retaining parent-traversal/backslash/colon checks before destination parent creation or writing. Benchmark BLOCKED/compiler rejection now uses the existing error path **before publication**: exit 1, stable diagnostic stderr, no stdout or research output. The detailed BLOCKED API record is retained; Medium/Large explicit budget exclusions remain exit 0.

Native tests actually compiled, validated and inspected both profiles under owned Ctree TEMP, preserving exact GLB/report bytes. They exercised missing EACH required compile option, bad profiles/G31/repeats 11, mismatched report, existing output, corrupt brick, private missing paths, corpus pin exit 3 and research staging-write cleanup. No services, dependencies or browser are required.

## Frozen inputs, expectations and actual evidence

`tools/hestia_asset_compiler/golden.py` generates **actual deterministic GLB/report bytes**, not labels. Negative GLBs get matching synthetic external hash reports from canonical transport semantics without decoding bad geometry to bless it. Synthetic inventory zero counts are expressly not source geometry proof. Actual core admission/baking/compilation still runs for EVERY case/profile, including expected rejection and BLOCKED support cases.

`tests/golden_hashes.json` was frozen only after the generated inputs passed the independent oracles. There is **no update-goldens CLI or automatic expected-hash rewrite**. Final runner checks/replay did not change inputs, valid compiler outputs or pins. A mismatch fails with `golden.pin-mismatch`; do not change expectations to fix a bug.

| Artifact | Actual bytes / SHA-256 |
| --- | --- |
| `tools/hestia_asset_compiler/tests/golden_hashes.json` | 958,962 / `bb803dbfd408f075453f340d7a69a34f24b732debbbb318f04f02995fd073aa6` |
| `C7_GOLDEN_SMOKE.json` | 2,370,698 / `f377ecb149fecb784ac146bdc5932999998c635bfb9d4cc2e81924c3ced173a6` |

The native command `golden --repeats 1 --output <new invocation-owned Ctree TEMP generation>` exited **0**. It generated **185 variant-addressed GLB/report pairs, 179 different GLB/report SHA byte-pairs**, and 370 case/profile records under EXACTLY G01–G30. Six normal identity transports duplicate their base bytes, legitimately; no input/address/pin deduplication is performed. Every actual emitted pair was independently rehashed against raw GLB/raw report/canonical payload bindings. The final native replay after the same-source full-byte guard passed again and its captured machine evidence was **byte-identical** to the existing artifact; no evidence/expected file was overwritten. These are the initial C7 smoke runs, not a new corpus resweep during the correction.

Result: **285 SUCCESS / 77 EXPECTED_REJECTION / 8 BLOCKED**. Without ordering expansions: 41 variants × two profiles = **82 records: 45 SUCCESS / 29 EXPECTED_REJECTION / 8 BLOCKED**. `C7_SMOKE_PASS` is NOT C8 final acceptance or ten-repeat certification.

Records contain actual input sizes/three source hashes; stage-specific decoded local bounds and valid baked world bounds/counts, or explicit stage rejection/NOT_RUN; expected and actual stable diagnostics; independent ownership/material/occupancy/connectivity invariants; and, for successful packages, three content hashes, exact-projection SHA, full tree, all file/brick hashes/addresses and output bytes. There are no enormous serialized cell sets, fake bounds for invalid stages, host paths, timestamps or benchmark durations in package content.

## Main inventory — exactly G01–G30

S/R/B counts include both profiles and the designated 24-transport expansions. Variants remain INSIDE their IDs; there is no G31+.

| ID | S / R / B | Actual case/variant and result |
| --- | --- | --- |
| G01 | 50 / 0 / 0 | Unit cube; independent full occupied sets/decoded bytes, 1000 / 216 cells. |
| G02 | 2 / 0 / 0 | 1 × 1.5 × 0.5 box; full intervals, 840 / 192 cells. |
| G03 | 2 / 0 / 0 | Negative-coordinate box; signed address/bounds/full owned intervals. |
| G04 | 2 / 0 / 0 | Origin-crossing box; full signed intervals. |
| G05 | 2 / 0 / 2 | Exact 90° MATRIX compiles; ordinary 90° quaternion/TRS has VALID C3 geometry but compile `thin.unproven` / BLOCKED. |
| G06 | 0 / 0 / 2 | Finite translated/scaled/45° TRS bakes correctly against independent bounds; narrow nonorthogonal proof remains `thin.unproven`, NOT VOXELIZED. |
| G07 | 4 / 0 / 0 | Actual single and parent/child double mirror; baked winding/world ownership. Not authorization to consume Error exporter reports. |
| G08 | 2 / 0 / 0 | Reused mesh at two real Part placements; separate owned contributions. |
| G09 | 0 / 2 / 0 | 0.0625-m plate with declared minimum 100; actual witness `thin.too-thin`. |
| G10 | 2 / 2 / 0 | Measured box-beam parameters preserved without voxel pseudo mass; same beam Reject policy `thin.too-thin`. |
| G11 | 0 / 2 / 2 | Actual hollow tube: PreserveAsRod BLOCKED `thin.unproven`; Reject `thin.too-thin`. Never a filled rod. |
| G12 | 2 / 0 / 2 | Proven one-layer rectangular midplane shell preserved; multilayer replacement BLOCKED `thin.unproven`. Layer intent unchanged. |
| G13 | 100 / 0 / 0 | Mandatory hollow Solid, BOTH inner windings, full intervals/brick bytes: 5616 / 992 cells, cavity Air 216 / 8. |
| G14 | 5 / 1 / 0 | Narrow micro succeeds/coarse `classification.topology-loss`; resolvable and phase controls succeed BOTH profiles with decoded through-body six-neighbor Air paths/source–raster component correspondence. |
| G15 | 2 / 0 / 0 | Two disconnected regions in one Part; full union and two material components retained. |
| G16 | 0 / 50 / 0 | Real two-material closed wedge; order-independent `material.ambiguity`, permitted fail-closed outcome. No selector guessed. |
| G17 | 2 / 0 / 0 | Real parent/child Part relationship, reachable geometry, world placements/ownership. |
| G18 | 2 / 0 / 0 | Fixed Joint/geometryless assembly; composed joint origin (11,2,3). |
| G19 | 2 / 0 / 0 | CutInterface identity/Part binding; composed marker origin (9,0,2). |
| G20 | 0 / 2 / 0 | Actual open Solid → `geometry.open-solid`. |
| G21 | 0 / 2 / 0 | Actual nonmanifold geometry → `geometry.nonmanifold`. |
| G22 | 0 / 2 / 0 | Actual collinear triangle → `geometry.degenerate`. |
| G23 | 0 / 4 / 0 | Actual Float32 NaN and Infinity POSITION variants → `glb.nonfinite`. |
| G24 | 0 / 2 / 0 | Unknown required extension → `glb.unsupported`. |
| G25 | 0 / 2 / 0 | Accessor count exceeds actual bytes → `glb.accessor`. |
| G26 | 0 / 2 / 0 | Sparse accessor variant → `glb.unsupported`. |
| G27 | 50 / 0 / 0 | L-union, full intervals: 504 / 128 cells; independent signed source volume 3/8 and COM (5/12,5/12,1/4), separate from raster truth. |
| G28 | 50 / 0 / 0 | Reversed TRIANGLE LIST plus matrix variants, not face-winding reversal. |
| G29 | 4 / 0 / 0 | Base and actually reindexed node/material/primitive/seeded triangle transport; content/exact projection/owned bytes match. |
| G30 | 0 / 4 / 0 | Huge domain → micro `budget.candidate_work` / standard `budget.grid_cells`; padded max coordinate → micro `budget.grid_coordinate`; tiny standard feature rejects earlier `thin.too-thin`. Honest stage-specific failure, no cap raise. |

## Independent oracle and ordering rules

Expected cell sets derive from authored analytic intervals, NOT the production voxelizer: closed-contact box cells `ceil(lo/h)-1 .. floor(hi/h)`; cavity Air `floor(lo/h)+1 .. ceil(hi/h)-2`; unions/differences remain Part-owned. The runner decodes ALL brick bytes and compares complete sets, bindings, cell counts, h³ volume and exact rational center sums. The review correction additionally checks each owner's inclusive cell min/max, occupied meter bounds `[lo*h,(hi+1)*h]`, h³ per cell and the complete occupied `gridBounds` inventory directly from those EXISTING analytic sets, without production mass/grid/address helpers. Empty occupancy has no min/max; the frozen per-owner inventory stays `[]`, not a new nullable format. This adds assertions only, no result-record/producer/hash/evidence change. G14 checks Air along the body, not merely a route around its outside. Source-volume/COM integrals and actual baked bounds are separate checks, not raster-volume substitutes.

G01/G13/G16/G27/G28 use normal/reverse/fixed-seed-42 triangle LIST order × two node orders × two primitive orders × two material orders = **24 transports** per base variant. Children/scenes/material primitive refs are correctly remapped; primitive accessors and binary triangle streams really change. Equal meanings require geometry/semantics/voxel hashes, EXACT semantic projection and actual owned brick bytes equal. Honest source/provenance/full-tree hashes may differ. When actual source bytes match, every package output/diagnostic/tree byte is also checked. Opposite G13 inner winding is NOT oriented-geometry/projection identity; only the expected even/odd occupied sets and owned bricks are compared across those variants.

`--repeats 2..10` executes the actual pipeline again for each pinned input and compares full public evidence and EVERY successful package file byte, not just summary hashes. Expected rejection/BLOCKED diagnostic records also compare on all repeats. The complete native corpus ×10 now PASS in C8 as recorded below; it is not inferred from the tiny G02 support test or a cached replay. The C6 original cube pin remains 12 files / 41,295 bytes / tree `d9a27b06a65a37b6c7af4c75b58ad327c1fe9c04452fcf96a03bfecc75f4494b`; C7's richer fixtures retain different truthful source-bound pins.

## C8 complete native verification — own run, externally accepted with notes

Accepted implementation/review freeze `c8e451a3e52fc8da743df011debae682f93c89a3`, compiler Git tree `a458f03f2aae82846a666ce29d57ec1f6505ab94`; actual Python-source manifest SHA-256 `c2a6c63cb94f2f24d29e3a727cc1f72e88ca90e60d26a504886d291118cf7e1a` (manifest definition in C8_DETERMINISM). No source/test/producer/algorithm/version/preimage/cap/PIN changes.

ONE completed managed native `golden --repeats 10 --output <OWNED_CTREE_GENERATION>`: **Exit 0 / stderr 0 bytes / 1426.516652 s**. Actual frozen loop executes each logical record once plus nine fresh `run_case` calls, not cache replay. **370 logical records ×10 = 3700 actual case executions**; root compile-call count is NOT_INSTRUMENTED, not a measured 3700 claim. Outcomes per logical set remain **285 SUCCESS / 77 EXPECTED_REJECTION / 8 BLOCKED**. Repeat-expanded counts are derived ×10, not another logical inventory.

| Profile | Logical SUCCESS / EXPECTED_REJECTION / BLOCKED | Logical records / repeats |
| --- | --- | --- |
| micro-0125-research-v1 | 143 / 38 / 4 | 185 / 10 |
| standard-025-v1 | 142 / 39 / 4 | 185 / 10 |

The runner checked all pinned three-source/content/projection/tree/file/brick bindings, full independent oracles, all same-input output/diagnostic bytes and the actual 3×2×2×2 ordering classes. Actual published research generation had **401 files** (370 inputs, 30 case record files, one summary). Each of the **185 addressed / 179 different** input pairs was independently rehashed against GLB/report/canonical-payload bindings; no deduplication. ALL case records equal the previous C7 records byte-for-byte under the declared compact sorted JSON encoding. The owned generation was verified and removed; C7 artifacts/ExpectedHashes remain unchanged.

| New C8 artifact | Actual bytes / SHA-256 |
| --- | --- |
| `C8_GOLDEN_RAW.json` | 2,370,658 / `49aa818ac90c1fa157fcf0e2e63015d9d7ad36bdc4c3316117bcbb9e26b7139f` |
| `C8_DETERMINISM.json` | 62,020 / `4dfa31a6891cb46548eb44992d872e675bb8ec94733f981db84cdb4069eb8ede` |

Raw engine schema `golden.c7.v1`, C7_SMOKE_PASS/finalC8Acceptance:NOT_RUN and C8 PENDING_INDEPENDENT_END_REVIEW fields remain immutable engine/PRE-COMMIT capture labels. Current external endreview PASS_WITH_NOTES/META acceptance is documented in REPORT/REVIEW, NOT rewritten into raw records or source code. Actual phase/repeats/source freeze/raw SHA and all pins stay identical; no cosmetic schema/version/algorithm change.

## GWN decision and outstanding acceptance

**GWN_NO_ADOPTION — REASONED_NOT_IMPLEMENTED.** Equal-outward nested components give signed winding 2 in the cavity, while the accepted even/odd contract requires Air. No bounded experiment was run, no candidate numbers invented, no uncertainty band or alternate classifier was silently adopted. Reference thickness/topology/ownership and package authority remain unchanged. See [BENCHMARK.md](BENCHMARK.md) for NOT_RUN optional GWN timing.

Historical EXTERNAL initial C7 reviews: R1-E SCOPED PASS WITH NOTES (no execution), R2-E SCOPED PASS WITH NOTES (three in-memory programs Exit 0 / 35 actual core calls / 144 reference remaps / full sets and source-versus-raster bounds / G02 actual repeat 2), R3-E two P2 findings (five programs Exit 0; G02 ×10 was TEN real calls, not then a complete corpus ×10). External Small preflight was not a benchmark rerun. META 131/61.092 s belongs to bc832. Subsequently R3-E2/R2-E2 independently CLOSED ALL F1–F4 and META accepted C0–C7 at c8e451; these milestones are external in REVIEW, not own C8 execution.

C8 fresh134/58/owned compileall/complete ten repeats PASS; raw C7/C8 labels, pins and bytes unchanged. All3 external scoped endreviews PASS_WITH_NOTES/no open findings, META independently validates all370 records/401inventory/25-source manifest and accepts SPIKE_ACCEPTED_WITH_NOTES. Exact final commit authorized, STOP afterward; no resweep/push here. Diagnostic limits stay in BENCHMARK.

Ordinary quarter-turn TRS remains valid geometry/nonorthogonal proof risk, no snap/repair/invalid-rotation/Shell relabel. Eight reasoned BLOCKED records remain, including tube/rod/multilayer support. Real Blender NOT RUN—EXECUTION_ROOT_BLOCKER, source-tool version UNRECORDED; qualified performance NOT RUN. Scoped spike acceptance does not remove these notes or integrate product. Actual final Git SHA reported externally after authorized commit; dedicated push belongs to META.
