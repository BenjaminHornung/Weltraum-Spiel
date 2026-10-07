# Hestia Cut Source Gates A/B/C – experiment decisions, 2026-10-07

The three finite experiments are technically executed. They do **not** complete the paused A-CUT-V3 goal or qualify all 14 populations. Keep the narrower Source mechanisms as experimental candidates; reject their adoption as a complete 250-ms solution. No renderer adoption, public Save migration, formal42 or formal1400 run follows from these results.

## Final measured result

All final comparisons run actual Vite production bytes via preview, pinned Node22/Chromium151, DPR1 and 1280x720, AC/Balanced, one test worker and ten fresh AB/BA pairs. Statistics use Input → actual first committed Three.js render submission. Sample p95 uses nearest rank; n=10 is a finite pilot, not population qualification.

| Gate and workload | Control median | Candidate median | Control / candidate p95 | Candidate <=250 ms |
|---|---:|---:|---:|---:|
| B: real Moving recut, 384 → 352 cells | 238.50 ms | **222.25 ms** | 266.30 / **233.90 ms** | **10/10** |
| C: first cold Rockarm detach, 384 cells | 501.35 ms | **457.05 ms** | 746.30 / **628.00 ms** | **0/10** |
| C: next lower-pillar Terrain cut on the same Source, 32-cell fragment | 167.20 ms | **154.40 ms** | 212.90 / **185.10 ms** | **10/10** |

The final Moving gain is 6.8%, cold Terrain 8.8%, warm Terrain 7.7% against their own matched controls. The earlier 13.5% Moving median belongs to a pre-review snapshot and is superseded. The historical 1261-ms value is not a causal baseline for these builds.

## A: concrete attribution and decision

A's built baseline completes 20/20 sequences. Reference Moving median314.55 ms versus old direct-v1 245.80 ms; direct sample p95281.80 ms and8/10<=250. Reference cold Terrain553.70 ms versus direct533.60 ms; neither passes250.

The exact historical 741-ms record is old Spec tests/e1-e2-paired-clean-r05/direct-draw-on-repeat-4.json, second Cut. Its OwnerPlan667.8 ms was not accompanied by per-phase diagnostics. This extreme was not reproduced in A, so attributing it retrospectively to GC, scheduling or a specific synchronous function would be false.

New observations separate every plan next()-work-wall label, explicit task-yield wait, mesh quote and Native receive/reply timing. Work-wall includes descheduling/GC during a call and is not an exact CPU clock. Main OwnerPlan additionally includes transport and reply validation; its residual is not automatically queue time. Cold Compute-pool startup is separately recorded in facts.poolStartup: Reference starts it in Support, direct-v1 in Compile. Do not interpret nested spans or startup relocation as slower meshing, or add nested Graphics to NativePrepare.

The final B control OwnerPlan median178.2 ms versus163.9 ms in the candidate; mesh worker7.8 versus7.5 ms and Main decode2.4 versus2.3 ms. The targeted change removes actual repeated Source graph construction and coordinate/metadata validation from known subset creation, rather than relocating the existing Physics Worker. Gate A decision: retain the production-bound driver and these bounded observations; no new profiling platform.

## B: actual owned graph and preserved behavior

Private ownedGraphs issuance occurs only after completed reserve-based full admission into first-party literal containers, or completed internal subset construction. General public issuance/Species behavior remains unchanged and is not trusted as that capability. General issued Sources get one complete owned normalization with identical content/evidence hash checks. Selectors are privately copied using a fixed own numeric length; ancestor traversal uses numeric indices. Genuine existing state records and immutable metadata are reused; caller bricks, mutable TypedArrays, clones and preliminary sources cannot become final issued subsets.

Complete canonical hash bytes, IDs, density/mass/inertia/colliders, revision0, Source metadata and all State fields are preserved relative to direct-v1 with identical inputs. No new hash form, public encoder shortcut or persistence schema change. Direct-v1's intentionally different legacy AddBox ancestry remains an existing experiment boundary.

Twenty final B sequences pass actual Native installation, actual committed render, Save, full document/World teardown, ColdLoad and the subsequent real recut. Gate B decision: **keep experimental mechanism**. The 352-cell pilot passes its ten latency observations; no larger/different population is implied.

## C: persistent provenance and real cold/warm cuts

Main retains the existing genuine Terrain-root derivative and exact Support algorithm. First Native admission receives a bounded plain reconstruction-input DTO, fully validates it, checks canonical ancestor/child digests and the normative frame/material profile, and retains the immutable ancestor per World session. Later fragments reuse that actual data. The live encode → encoder self-decode → Native decode roundtrip is absent. Public Save/Load remains fully validated.

Only fresh frozen plain records/arrays of own data properties travel: spoofed/frozen Map and ArrayBuffer internal slots are not copied. The whole declared clone graph, including metadata, is bounded and quoted; sender captures it before yields and sends exactly the quoted snapshot. This experiment is explicitly limited to the authored Rockarm ancestor. Native full semantic admission, current Root/session/epoch/generation bindings and transaction tickets remain mandatory.

All20 final cold/warm Terrain sequences pass. First384 and next32-cell fragments are real bodies; same-Source dirty-leaf deltas are synchronized/committed. Runtime Source string transport is0, and native ancestor acknowledgement is true. Normal disposal and Restore replacement clear the derivative; load-rollover clears Main acknowledgement. Cache is provenance, not World truth, and is not a new Save authority.

Cold Support median248.2→204.05 ms; warm Support34.75→19.65 ms. Candidate Compile remains135 ms cold /74.9 ms warm. Graphics is56.1 ms cold /32.15 ms warm, nested in NativePrepare91.55 /36.10 ms. The observed Main Support-pump maximum falls29.2→3.5 ms; that covers this pump only, not every unobserved Main/Native step. Cold initialization and first full admission remain included. All five mesh hash passes and Three.js admission remain unchanged.

Gate C decision: **keep the experimental Source path; reject complete cold-latency adoption**. The first Cut still has p95628 ms. Private render admission is a separate potential later variant, not implemented or silently credited here. No new renderer/engine program is started.

## Verification and exact limits

Final-source verification passes eight ownership/byte-parity/Save/iterator/metadata/Native-slot contracts (final-contract-r03.json) and nine Native-worker/Native-plan/Body-Save regressions (final-native-client-save-r02.json). A broader 28-test Source/Recipe/Native/Save run also passed at the preceding review revision; its receipt is retained separately. App/probe typechecks and production build pass. Two final extra complete Save/ColdLoad/follow-up recut sequences pass in B/C, in addition to the 40 matched final comparison sequences.

The real prepared-Moving cancellation finishes Disposed with confirmed native release. Unexpected actual Worker exit finishes Failed with UNCONFIRMED_NO_NATIVE_ACK, as required. Both preserve final Main Root hvp-session-1/epoch1/revision1/digest26d5308d and pass fresh recovery/disposal. The delayed-result case proves continued simulation and actual prepared projection before cancellation. C-specific forced cache cancellation is not claimed; its pure-owner cancellation/close contracts and real normal disposal/ColdLoad are covered.

All measured Scene logical CPU readings remain under256 MiB (largest paired reading259,950,864 bytes). Native cached Source bytes also enter the existing resident/Prepare admission paths. These are conservative logical estimates, not physical heap/GPU allocator measurements. Physical IPC, heap and compositor presentation remain unsupported. FirstRender is the real committed CPU render submission, not a compositor/GPU-Cut timestamp. No Unity/.NET changes or checks apply.

Source/build hashes remain fixed before/after Native runs. FinalSource cdce5dc042b8366a5835d81f3d106d22127a436f468d805c9abc0fe111c0df4b; built-byte manifest hash015095319ac9b0e1c4d4a0a7a9b58e94987d1c993eba729956282077286f50eb. Frozen measured Source, built bytes and raw attempts are retained. The isolated branch remains feature/hestia-cut-core-experiments-2026-10-07 at checkpoint aa2eabd918e03c475a489b412cd18e05f781a0f9, experimental changes uncommitted/unpushed. Exact-diff Plannotator approval is required before a later commit.

The archive freezes evidence before the administrative package task is closed. The final ZIP byte/hash check and task-closure receipt are stored alongside the archive, without modifying its sealed payload.

## Next concrete decision

Decide whether to fund one further bounded cold-path change: cold Source establishment and exact Support/recipe work on persistent owned data, then the remaining135-ms Compile and56-ms Graphics spans separately. This needs a new scoped experiment, not another broad renderer round. First qualify unchanged14 cold/warm populations and step/resource/quality caps before formal42, then1400. The original B1/B2/B3/P01–P06 and Planner-final gates remain incomplete.
