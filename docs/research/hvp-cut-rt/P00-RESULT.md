# ExecPlan: Hestia Cut RT V2 — source reconciliation and diagnostics

## Goal

Execute the Owner-supplied V2 package in bounded, independently reviewed cards. Preserve the exact 0.125 m source/collision/mechanics/persistence contracts and measure real input-to-Applied latency, rather than treating kernel or pause-to-commit timings as end-to-end proof.

## Context and authority

- Owner authorized execution and subsequently instructed use of agents as configured in the current profile, without repeated per-step confirmations.
- Active package: `HESTIA_CUT_RT_AGENTENPAKETE_V2_2026-09-21.zip`; SHA256 `d28d824ef9579ccf912f151cad534b50162f998a458ef6514914a24ab3398de2`.
- Extracted package and external journal: `C:/IFI_SourceCode/Utils/npm-tmp/opencode/hestia-cut-rt-v2-preflight-20260921/`.
- Research/main `25bc7f5bbd2db6317c42193873eadeaf10a092c5`; feature/base `9341fb906383515057e659a99e16a381632f2bea`; common tree `98ab58173ef0a61cb2d35cbdc39ab0343f9bce96`. Relevant remote refs were rechecked; no newer published Cut fix was found.
- Original worktree `Hestia-HVP03-signature-vegetation` contains 16 tracked local modifications and one untracked test. It remains untouched. This worktree, `Hestia-CutRT-P00`, is the isolated remediation target on `feature/hvp-cut-rt-p00`.
- The imported delta is not a semantically accepted source baseline. `EXECUTION_BASE.json` must not claim unresolved findings are cleared.
- Historical profile execution used `frontend-worker` = Luna/xhigh and independent Astra/GLM reviews. Current execution is owned directly by the primary assistant, including implementation, self-review and verification; no further delegation or Plannotator gate is used. Historical reviews are not claimed as fresh independent review of subsequent changes.

## Non-goals

No Unity work, new dependencies, solver/engine changes, coarse colliders, save-schema changes, Golden promotion, cap/tolerance relaxation, deployment, push, PR or Main merge. No new orchestration framework or DevToolbox execution.

## Architecture decisions

Preserve canonical cells/materials and session/epoch/revision/source bindings. Retain exact coverage, mass/COM/full tensor, live-pose ownership, paired source/native/render publication, rollback and honest RecoveryHold. Compiler concurrency remains two, queue 32, prepare reserve 96 MiB; CPU 256 MiB, mesh 128 MiB, 500k triangles, 300 draws and all local limits remain unchanged.

Use existing helpers and observer paths. P00 is instrumentation only after source reconciliation. Source defects inherited from earlier local optimizations require separately bounded corrections before acceptance, not a reset of useful changes.

## Implementation phases

1. M00 current-profile qualification outside product: two fresh runs, fixed independent oracles, no best-of selection.
2. P00-A source reconciliation: exact isolated import, correct confirmed findings with reproductions, paired review and fresh checks, then approve source binding.
3. P00-B pure trace helper; P00-C main call sites; then package verification. The Owner explicitly deferred new P00-D worker spans as NOT_MEASURED, retaining existing main/hold measurements and allowing the subsequent optimizations after C2B. No full P00-D acceptance, extra memory allowance or gameplay delay is authorized.
4. Wave 1 P01/P02/P03/P04 with disjoint leases, at most two actual writers. Critical P02 mathematics and P03 wire contracts receive design review before implementation.
5. P05 on reviewed P03; I01 isolated integration without Main merge or duplicate adoption of P03 history.
6. P07/B01 production-build measurements on the exact combined candidate, no competing heavy workload. P06 only after measured hold trigger and separate state-contract review; X01 only after measured native-cooking trigger, outside product.
7. F01 repeat affected checks after changes and inspect the final diff. Under the current execution instructions, review is performed directly; independent/human reviews not run on the final candidate are reported explicitly. Code, functional, native, browser, performance and visual-owner status remain separate.

No commit or publication is authorized. HEAD plus exact file/diff digests identify uncommitted candidates, never a fabricated candidate commit SHA. No Plannotator or agent review gate will be invoked under the current execution instructions.

## Tests and evidence

- M00 `m00/qualification.mjs`, SHA256 `9dc687f0cbc9f385dbdd6eb45e1e9bb5863fbebf9455c836304cc9608e787098`: two independently invoked Node runs PASS. BigInt hash oracle, safe span cases, Deferred lane refill/order/drain and unchanged protected fixtures. No performance inference.
- Inherited baseline: seven existing unit files, 37 tests PASS, JSON `p00-inherited-baseline-units.json` in external journal directory. The baseline predates new adversarial review reproductions; it does not invalidate the findings below.
- Mechanical import: raw blob hashes recorded in `P00-RECONCILE-IMPORT.binding.json`, same-directory source/target comparisons, `git diff --check`, original-worktree preservation.
- Remediation: focused red/green reproductions, then paired review and fresh focused/full relevant verification. Existing failing checks are retained, not weakened.
- Real browser/production timing, native rollback coverage, cold/warm distributions and hardware/visual acceptance remain NOT RUN for V2. The original input-to-Applied p95 target is 250 ms; proposed hold/render/slice budgets do not replace it.

## Confirmed findings and reconciliation

| ID | Finding | Disposition |
|---|---|---|
| R1 | Cold load retains distinct snapshot, restored-root base and prepared arrays. Removing the primary slot term undercounts 8 MiB during coexistence. | CLOSED for accounting slice. Truthful extra term restored through tested estimator; dual review and fresh six selected checks/typecheck pass. Any resulting cold-browser budget failure remains visible, not fixed or hidden by this accounting change. |
| R2 | Arbitrary exact transferred cuboid partitions can be admitted but fail unchanged save decoding, which regenerates canonical greedy collider membership. | CLOSED for recipe slice. Existing canonical merger and order compared, no persistence-format change; dual review and fresh native/save tests pass. |
| R3 | Fast recipe admission does not reject anchors or unsupported joint-bearing sources. | CLOSED for recipe slice. Zero-origin, anchor-free, joint-free subset enforced and tested. |
| R4 | Fast recipe's collider array is mutable although its members and enclosing recipe are frozen. | CLOSED for recipe slice. Containing array frozen before issuance; mutation checks pass. |
| R5 | Hold stops at commit rather than confirmed finalize/rollback; failures and previous transactions can leave mixed/stale timing fields. | CLOSED for timing slice. Transaction-bound nullable spans, terminal-only closure including sticky RecoveryHold retries, coherent reply projection and real worker-host tests; dual re-review and fresh full suite pass. |
| R6 | Support decoder does not compare collider count or timing cell count with actual decoded contents; optional timing count has a different aggregate policy. | CLOSED for decoder slice. Contradictory claims reject, truthful optional diagnostics preserve report admission, owned records frozen; dual review and fresh31/31 protocol tests/typecheck pass. Physical transfer limits unchanged. |

Astra source review `ses_f3c8c8de3ffegtNCKdt6xrlQ6x` blocks admission with R1–R6. GLM review `ses_f3c8c8d0bffeZ1tjC306SGuTsu` independently confirms timing issues and decoder test gaps; its conditional READY does not override the confirmed persistence/accounting defects. Both were read-only. Orchestrator traced R1's three allocations and R2's persistence dependency independently. No broad refactor is warranted.

Recipe reconciliation subsequently reviewed clean by independent sessions `ses_f3c4aad51ffehKWyFy0iXuYXNK` and `ses_f3c4aac8dffemTGZ3urIBNb8xv`. Four genuine red assertions were captured before correction. After both reviews, the orchestrator reran the three focused suites: 16/16 PASS, plus TypeScript noEmit PASS (`p00-recipe-verified.json` externally). R1/R5/R6 remain open; no end-to-end or performance acceptance follows from these unit/native checks.

Cold accounting subsequently reviewed clean by `ses_f3c2cc47effenL4sJUaGopb54F` and `ses_f3c2cc42cffeHYpf1raO86PyFP`; four actual missing-term failures captured before fix. Orchestrator post-review run: six selected accounting/cap tests PASS, 24 lifecycle cases not selected, TypeScript and diff-check PASS (`p00-cold-verified.json`). R5/R6 now remain open; real cold-load and performance acceptance remain unproven.

Decoder correction reviewed clean by `ses_f3bfed5feffeZ7mJiMsiNdWrKw` and `ses_f3bfed5b7ffew0O27EZ0wynkmi`. After both reviews, orchestrator ran the entire workerPoolLifecycle file: 31/31 PASS, no filtered cases, plus TypeScript/diff-check PASS (`p00-decode-verified.json`). The larger report fixture is calculated test data, not native transfer or performance evidence. R5 remains open; source and full-P00 gates are not yet closed.

## Risks and safe stop

### Current runtime blocker CB01

After all six source corrections, the orchestrator ran the complete unit suite (197 files, 1836 tests: PASS) and production TypeScript/Vite build (266 modules: PASS; large-chunk warnings unchanged). The original HVP13 sleeping-fragment cold-reopen E2E then failed in the production preview: initialization rejected `268447232` CPU bytes against the unchanged `268435456` cap, an overrun of `11776` bytes. The prior cut, sleep, park and durable save actions had completed; cold Ready did not.

This is a real failing acceptance path, not a timeout/selector repair or accepted flake. Local report/trace/screenshot are under the external journal directory `p00-source-cold-01/`; nothing was uploaded. The test-owned preview listener is gone. A bounded read-only debugger is tracing actual retained ownership/lifetimes before any correction; the legitimate third-grid accounting is not being removed again. Sourcefreeze, detailed P00 diagnostics and later waves remain incomplete; no end-to-end performance pass is claimed.

CB01 diagnosis and two independent contract reviews subsequently identified an internal existing-API correction: share the already validated immutable coast base with the restored primary Root, eliminating the redundant second primary grid decode. Extract the unchanged terrain header validator at its existing owner and invoke it at the original validation point; retain standalone restore and all later validation. Only after allocation-count/constructor-identity/defensive-copy tests prove the actual eliminated buffer may its extra ledger term be removed. The five-path corrective card is now readback-approved and implementing. All caps, decoded-working allowances, stored schemas, native behavior and original E2E assertions remain protected; no success is claimed until fresh checks and the original runtime reproduction pass.

### CB01 verification completed; source manifest awaiting metadata review

CB01 implementation and one bounded correction were independently reviewed clean by `ses_f3b582496ffeDmV9OsqVevAHMA` and `ses_f3b582476ffeLDKKQj4NQaFs4v`. The real allocation oracle failed before the fix with two primary decodes instead of one; after the fix, constructor identity, standalone-checkpoint equivalence, defensive copies, inner validation and paired-error precedence pass. Old R1/CB01 reports are retained.

The orchestrator then freshly built the production app (TypeScript/Vite PASS,266 modules) and ran the two unchanged HVP13 browser tests on the isolated preview: sleeping-fragment cold reopen and eastern-region hot/cold restore, **2/2 PASS**, one worker, zero retries, updateSnapshots=none, no Golden recording. Local evidence: `cb01-cold-neighbor-01/report.json`. No listener remained on the test-owned port5177 afterward.

On the same unchanged product code, the complete suite passed **197 files /1838 tests**, zero failed/skipped, in778.07s (`cb01-full-unit-verified.json`). Diff-check passes. The prior11776-byte admission failure is now closed by actual allocation elimination plus successful original reproduction—not a cap discount. No p95 or physical heap measurement is inferred.

`EXECUTION_BASE.json` binds the source as **base commit/tree plus25 exact reconciled file blobs**, including two new test files (`oldBlob:null`). Its `executionBase`/`tree` identify the real Git base, not a fabricated commit of the uncommitted overlay. `newBlob` values are raw Git blob hashes (`git hash-object --no-filters`), verified against files; they need not already exist as objects in Git's database. Tracking documents are deliberately outside this source/test overlay to avoid self-referential hashes. This local binding is the documented no-premature-commit execution adaptation; it does not grant publication or claim a clean committed candidate. All package-level optimizations remain open (`alreadyImplemented:[]`); the inherited materialization prefilter is partial P02, not the requested editwise implementation.

Source decisions and confirmed baseline defects are resolved. Before P00-B dispatch, a fresh read-only metadata review must check this manifest against the actual Git/files/evidence. P00-B/C/D detailed tracing and all later packages remain unfinished.

Fresh metadata review `ses_f3b36baefffeeUgJkIjuDv05m1` returned SOURCE_BINDING_READY: exact eight keys,25 complete overlay entries, all old/new blobs and Git identities checked, source manifest SHA256 `4f92dec742230506e597b495fd941f6ddce209ced3738a298a487b2ef649ad51`, actual197-file/1838-test and2-E2E report metadata verified. The commit-plus-overlay interpretation is explicit; it is not a new committed candidate. P00-A source binding is accepted for the next serial card. P00 as a whole is not complete.

Unknown/currently failing baseline behavior is not success. Stop the affected card on source drift, ownership conflict, a changed public/serialized contract, weakened tests or uncertain recovery. Keep original worktree and all failed-run evidence. No destructive reset/cleanup. Worker correction loops are bounded to two per cause; then diagnose or reduce the card rather than retry indefinitely.

## Progress log

- [x] Read V2 package, task manifest, current source and repository guidance.
- [x] Apply Owner's current-profile routing revision without changing configuration.
- [x] Run and independently check two M00 qualifications.
- [x] Obtain both independent reviews of the inherited source delta.
- [x] Create isolated P00 worktree; install locked dependencies (59 packages, no lock changes).
- [x] Exact inherited-delta import and scope/hash verification (17/17 raw file hashes; one corrected test-block placement; original preserved).
- [x] Correct and re-review R1–R6 plus CB01; admit reviewed commit-plus-overlay source binding after full regression and original Cold repro.
- [x] P00-B pure trace helper: nine focused checks and TypeScript verified.
- [x] P00-C1 phase wiring and C2A bounded observer: local card checks complete; C2A dual re-review and fresh67-test verification pass.
- [x] P00-C2B bootstrap integration: confirmed findings corrected, direct self-review complete, fresh106-test/typecheck/build verification and three unchanged browser regressions pass.
- [ ] P00 package self-review and fresh evidence after C2B; new P00-D worker spans explicitly deferred by the Owner, NOT_MEASURED.
- [ ] P01–P05, I01 and P07; conditional P06/X01.
- [ ] F01, final self-review and fresh verification, distinct acceptance statuses; independent/human review NOT RUN under the current execution rule.

## Definition of Done

All executed cards satisfy their scoped source binding, focused tests, self-review and fresh verification requirements. Historical independent reviews remain historical evidence; no new delegated or human review is claimed under the current execution rule. Required final checks have fresh evidence and no concealed failures. Performance success requires actual production-build cold/warm end-to-end measurements on a declared device; visual Owner acceptance is never inferred from automated tests. No automatic Main integration or publication.

## Current diagnostic implementation checkpoint

P00-B/C1/C2A are locally verified, not a full-P00 acceptance. The existing commit-plus-overlay source manifest remains the accepted predecessor; subsequent uncommitted diagnostic code is bound separately by raw hashes and card evidence, not by inventing a new commit. C2A's latest fresh result is67/67 plus TypeScript/diff-check after clean independent reviews; see the external journal and `p00c2a-verified.json`.

The Owner explicitly chose bounded diagnostic payload inside the unchanged256MiB controlled-CPU cap, disabling only measurement when headroom is insufficient. Small remaining control/browser timing overhead is reported as `not-measured`, not zero heap. C2 reserves256KiB for its bounded main-thread observer only; this is not permission to hide future worker packet payload in that reserve.

C2B's initial77-test result did not cover all required wiring. Historical independent reviews identified three concrete bootstrap corrections: visible keys were copied into an unbounded intermediate array before validation; disposal-generated drops were omitted from the retained summary; the existing measurement-health outputs lacked observer status/counters. The apparent21-vs22-admission discrepancy was a review counting omission, not a product defect. The suggested support-preview harness path did not actually exceed the startup peak and was not accepted as revocation evidence.

Direct verification closed the remaining gap through the existing real preview-mesh admission callback. The new exact-cap test derives its budget from actual submitted artifact bytes and proves original over-cap rejection precedes diagnostic revocation, valid exact-cap admission releases observation once, lower peaks and scene rollback cannot re-arm or retain a reserve in previousLedger, and real frames continue. This is resource/wiring evidence with the existing fake transport, not a fabricated native cut. Two other tests now exercise actual pending-marker invalidation and actual RAF/backend result/error identity.

Final raw hashes: bootstrap `0c04e9f78b36e1cccc9c44770700717b145f4b04`, bootstrap test `58fae5d1c8d5af8490b3a9fcda1871187787e771`; observer/consumer dependencies unchanged. Fresh direct verification: `p00c2b-self-verified.json`, three files/106 tests PASS with zero skipped; TypeScript and diff-check PASS. Production build PASS,267 modules, existing large-chunk warnings. The unchanged production-preview cold fragment restore, eastern-region hot/cold flow and real quarry Box cut pass3/3 with one worker/zero retries (`p00-c2b-browser-01/report.json`). No Golden recording, new independent review or p95 claim.

P00-D's new worker spans are deferred by explicit Owner decision. Source inspection proved that an earlier neighbor load can reach a resource admission while a later terrain native command is still in flight; synchronous release of remote/transport diagnostics cannot be assumed. A permanently charged diagnostic reserve would also change otherwise valid gameplay admission. No new worker transport, cap allowance or gameplay wait is introduced. Existing transaction-bound hold metrics remain available, detailed worker spans stay NOT_MEASURED, and the following optimizations may proceed after C2B verification without claiming full P00-D completion.

### Live diagnostic evidence and remaining limits

Three predeclared fresh-runtime quarry Box cuts were observed through the configured Playwright MCP on the production build: all Applied,50 removed cells each, root/native generation1, native Idle, exact committed-render fact matches, zero collector drops and no TestBridge. Raw records retain command attribution via `PerformanceMeasure.detail`; `toJSON()` alone omitted that field in Chrome153. The first incomplete collector probe is retained separately, not counted as an attributed trace.

Local raw artifact `hvp-p00-quarry-box-3traces.json`: input-to-Applied300.800/349.400/254.300ms and first committed render submit336.400/379.200/275.100ms. Viewport1036x766,DPR1.25, Windows Chrome153; these are three instrumented functional traces, not the formal P07 sample or an instrumentation-overhead estimate. The uninstrumented real Box regression passed separately.

Additional rock-arm MCP tracing remains NOT RUN: browser Pointer Lock was denied twice before any cut (`issued:0`, root generation0). Both preparation failures were retained; no successful cut was discarded or repeated to select timings, and no input/gameplay code was changed. The owned tab and managed preview were closed; port5177 has no listener. The complete fresh P00 unit regression finished with199 files/1903 tests PASS, Exit0 in847.98s (`p00-full-unit-self-verified.json`). No full browser-matrix, new worker-span, performance or visual-owner acceptance follows from this checkpoint.
