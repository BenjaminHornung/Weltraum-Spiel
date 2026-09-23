# P05 — bounded compiler refill and binary-body activation

## Goal and scope

Replace the HVP compiler's fixed two-job waves with a two-lane, input-ordered mapper that refills a free lane without waiting for its sibling. Preserve real event-loop yields, source/result admission, all local limits and cancellation ownership. Activate the already verified P03 binary format only for `compileBody`; no V1 fallback or other algorithm change.

Only `src/workers/hvpBoundedPump.ts`, `src/hestia-prototype/terrain/terrainProducts.ts`, `tests/unit/hvpBoundedPump.test.ts` and this document are in scope. Generic WorkerPool/WorkerHandle/StreamingWorker, physics/bootstrap, codecs, caps and the96MiB preparation allowance remain protected. Execution is direct and sequential in the existing task-owned worktree; no agent, Plannotator, commit or publication. The P04 full baseline must finish before source/test writes begin.

## Current evidence and reuse

- Compiler raw `938f291d4df270fd87392f970559a27e0fe4f111`: `compileSectors`115–136 creates work in render-then-collision order but waits on each `Promise.all` wave. Packing already occurs inside active callbacks and must stay there. Output maps currently depend on completion order; P05's explicit contract makes them input-ordered.
- Protected pool `48043f10e9c503d4af868aa577ac5e1dc1b586d2`, handle `3096038e855a162393a5adb79519ffec28f9a57f`, runtime `55890438a6edc266c24735d3eea1e3aab1252c0a`: running cancellation requests do not settle the ticket until a real terminal response. Fault/shutdown paths terminate the owning worker before awaiting callers resume. `cancel()` returning is not a release proof.
- P03 job raw `121b7707e11a93a24ed60b33684fac98e27a1e50` exports `HVP_BODY_CUT_ALGORITHM = 2`; compiler177 still requests1. Only that body-request expression changes after pump integration. V1 and V2 decoders/guards stay intact.
- Reuse the existing `WorkerTransport`/`StreamingWorkerRuntime` structured-clone test pattern from `workerPoolLifecycle.test.ts`, not that executing test module. The browser transport is just a Worker implementing this port. A scoped test-only Worker replacement can delegate to the real runtime and real pool while controlling message delivery; it is not native/browser performance proof or a product test hook.

## Implementation sequence

1. **P05-A:** implement the supplied `runHvpBounded<T,R>(items, parallel, run, onFailure)` contract with concurrency exactly1 or2. Assign the shared cursor before awaiting; store results by input index. The first caught failure latches a separate flag (including `throw undefined`), invokes best-effort synchronous cancellation once, and is rethrown only after every started lane settles. Use Deferred tests, not timing thresholds.
2. **P05-B:** use the helper only in `compileSectors`. Keep the existing work list and64/80/12 limits. Track at most two local active tickets, check disposed/abort before packing and after terminal response, require the owning pool's Accepted proof and actual decoder, then return a discriminated `{id, render, mesh}` result. Preserve a real `setTimeout(0)` yield after completed work, without a wave barrier; recheck disposed/abort afterward so a late abort cannot become success. Remove each abort listener/ticket in `finally`. Cancellation exceptions are caught per ticket, but all original ticket promises still drain. Fill output maps only after complete success in work-list order.
3. **P05-C:** import the existing P03 algorithm constant and change only the body request. Keep support/terrain/collision/neighbor at their existing versions, the same input digest and decoder, and no retry.
4. Self-review the narrow diff and protected hashes; run fresh focused/type/build/package checks and original relevant browser flows. Report observed queue/liveness and actual timings separately; synthetic scheduling proofs cannot establish whole-Cut p95 or preemptive kernel cancellation.

## Deterministic oracles

- With job0 held and job1 complete, job2 starts and results remain input-ordered; max active2. Limit1 stays serial; empty input and invalid limits are explicit.
- First synchronous/asynchronous failure stops new callback starts; a pending sibling keeps the aggregate promise pending. Secondary sibling/cancellation errors cannot replace the first, even if it is undefined.
- Actual compiler tests use real Root snapshots and real worker kernels/Accepted gates through a scoped transport host. Hold only actual protocol completion delivery to prove refill, input packing bounds, stable map order and real cancellation drain. Exercise pre-abort, abort during work/after Completed, dispose, rejected output, and zero remaining listeners/tickets after settlement.
- Serial restore/neighbor limits remain intact. Body compilation actually emits the seven-buffer V2 output and matches existing V1 semantic products; corrupted binding/output must not trigger a fallback.

No new retained cache is introduced: work/results remain bounded by the existing local job limits, plus at most two ticket/listener records. Existing output buffers remain retained as before; this does not claim immediate GC, total heap bounds or new preparation headroom.

## Status

- [x] P04 full regression finished:204 files/2246 tests PASS, actual Exit0; source/test writes may begin.
- [x] P05-A helper and deterministic scheduling checks.
- [x] P05-B real compiler cancellation/refill/order checks.
- [x] P05-C body-version activation and unchanged guard checks.
- [x] Self-review, fresh package/browser verification and measured limits.

## Implemented and freshly verified

The32-line helper refills at most two lanes and drains every started callback before returning or throwing the first failure. The compiler change is limited to the scoped sector loop/imports and the body algorithm expression. Actual packing and Accepted-result/decoder checks remain in each live callback; successful output maps are built in work-list order. Real timer yields, cancellation acknowledgement/termination, all local limits and preparation reservations remain intact. No generic pool, physics or codec change was needed.

Test-first reports preserve the genuine missing-helper, absent refill/late-abort behavior and body-version activation failures. Three new-fixture assumptions were corrected against actual source: the decoder is also called by the pool; corruption needs a nonempty real output buffer; the pool translates rejected output into a Failed ticket. Earlier failed reports remain retained, not counted as passes. The final tests additionally wait one event-loop turn before asserting that an unresolved sibling still keeps rejection pending; this is a Deferred-based lifetime proof, not a speed threshold.

Fresh combined result `p05-focused-self-verified.json`: five files/139 tests PASS, zero skipped, actual Exit0. It includes25 pump/compiler cases,57 binary-codec cases,31 existing pool tests, four real native moving-session cases and22 terrain-consumer cases. Self-review, TypeScript, diff-check and production build PASS;272 modules, existing large-chunk warning. Raw blobs: helper `5fbbf5e7b0018933b9850ceb8f4f64ed80863a60`, compiler `45ca5dd1994b70905359857a61fe7c05f87ef5a9`, test `1c3024ddd1ae2cce5c72fbefa9a57429e94d3b83`. Protected pool/handle/runtime/body-codec/bootstrap/visual-renderer hashes are unchanged.

Six unchanged production-browser tests pass with one worker/zero retries, no skipped/flaky results (`p05-browser-01/report.json`, actual Exit0): eastern-region admission/hot-cold flow, quarry Box cut, terrain and timber recuts, and both terrain/timber cold-save restoration followed by another real recut. This exercises V2 activation through the normal player/compiler/native path, not only a synthetic transport. Test preview port5177 is released. No new whole-Cut timing or P03's previously failed50%-round-trip target is inferred from these functional passes.

The complete P05 regression passed205 files/2271 tests, zero skipped, actual Exit0 in1027.35s (`p05-full-unit-self-verified.json`, completed2026-09-22T17:32:56.671Z), before subsequent P07 observation changes. This is the combined P00–P05 baseline, not a performance pass. Final I01/P07 source/build binding and measured populations remain pending. New P00-D worker spans remain explicitly deferred; no independent/human review, commit or publication has been performed.
