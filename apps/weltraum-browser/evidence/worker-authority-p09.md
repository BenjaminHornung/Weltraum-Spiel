# Worker Authority P09 Evidence

Real consumer adopts derived products over the existing WorkerPool/streamingWorker path.
The SurfaceLabController enforces an adoption gate at its adoption boundary; stale,
foreign, cancelled, evicted, forged, and tampered worker responses are rejected
before decode, cache admission, or publication.

- Status: **PASS**
- Scope: `pure-core-unit-proof` (one product path: Surface Lab Hestia voxel-brick mesh jobs)
- Visual UI change: `false` (no UI, no renderer, no scene change; no screenshot required)
- Browser E2E: not applicable to this slice (pure worker/adoption protocol proof via Vitest)
- Branch: `feature/worker-authority-p09`
- Regenerated: 2026-09-09 from fresh runs on this worktree (prior revision reported 1431 tests and predates the reconciliation fixes)

## Binding fields

Every dispatched Surface Lab job carries: authority epoch (controller generation),
planning epoch, worker epoch (bound at dispatch to the executing handle), target key,
input revision, output revision, algorithm version, source/input digest
(`sourceInputDigest`, fnv1a over payload identity + input bytes), job ID, cancel,
and residency transitions. The source/input digest is threaded through
`WorkerJobRequest` / `WorkerJobResult` / `WorkerResultExpectation` and checked in
the pool result gate (`RejectedSourceInputDigestMismatch`) before completion.
The owning pool's scoped authorizer (`WorkerPool.isAcceptedCompletedTerminal`) is
passed by the controller into decode and cache admission; the process-wide
`isWorkerPoolAcceptedCompletedTerminal` remains only as a documented genuineness
check for standalone callers.

## Obligations

| ID | Status | Deterministic detail |
| --- | --- | --- |
| P09-01 | PASS | Current worker response is adopted exactly once; duplicate delivery is rejected (`RejectedDuplicateDelivery`) and settled generations ignore late unconsumed deliveries. |
| P09-02 | PASS | Dispatch, then newer edit/regeneration: late old terminals settle to null adoption with genuine stale rejections (`RejectedStaleAuthorityEpoch`, `RejectedUnknownJob` + `staleRejects`). |
| P09-03 | PASS | Evict before delivery (real WorkerPool + held transport): cached terminal whose source residency was evicted is rejected (`RejectedEvictedResidency`), `readyChunks` 15 / `failedChunks` 1. |
| P09-04 | PASS | Cancel (supersede/dispose/replace): superseded tickets are cancelled, in-flight replacement failure settles the generation as failed with `cancelledJobs` recorded. Settled-`Ready` replacement failure is an explicit documented contract: `readTelemetry()` reports `Failed` (16 ready / 0 failed, pool stopped, throw propagated) while the already-resolved `whenSettled()` promise preserves its `Ready` snapshot; locked by test. |
| P09-05 | PASS | Forged completed terminal never issued by the pool is rejected before decode/cache/publication (`RejectedUnknownPoolTerminal`, pool-scoped authorizer). Cross-pool terminals are not authorized. |
| P09-06 | PASS | Tampered worker epoch and mismatched planning epoch / target / revision / algorithm / source digest are rejected with distinct fail-closed codes. |
| P09-07 | PASS | Bounded queue: over-capacity enqueue fails closed with `QueueFull`; transferable input ownership is taken at enqueue and detached after completion. |
| P09-08 | PASS | Pool failure classification is preserved through the adoption gate (stale/target/revision/algorithm/digest/layout/budget/content-hash), never coerced to generic failure. |

## Stable observations

```json
{
  "unitSuite": {
    "testFiles": 147,
    "tests": 1432,
    "status": "PASS"
  },
  "focusedSlices": {
    "surfaceLabWorkerAdoption": 22,
    "surfaceLabController": 47,
    "workerResultGate": "PASS",
    "workerPoolLifecycle": "PASS",
    "focusedTotal": 99
  },
  "adoptionRejectionCodes": [
    "RejectedUnknownJob",
    "RejectedDuplicateDelivery",
    "RejectedStaleAuthorityEpoch",
    "RejectedCancelled",
    "RejectedTerminalFailure",
    "RejectedForeignJob",
    "RejectedStalePlanningEpoch",
    "RejectedStaleWorkerEpoch",
    "RejectedTargetMismatch",
    "RejectedRevisionMismatch",
    "RejectedAlgorithmMismatch",
    "RejectedSourceInputDigestMismatch",
    "RejectedEvictedResidency",
    "RejectedUnknownPoolTerminal",
    "RejectedInvalidLayout",
    "RejectedOverBudget",
    "RejectedContentHashMismatch"
  ],
  "nonGoalsHeld": [
    "no planet-wide streaming",
    "no second world truth",
    "no renderer as authority",
    "no R5B queue rewrite",
    "no UI"
  ]
}
```

## Verification (fresh, this worktree)

- `node --version`: `v26.2.0` (spec protocol prefers Node 22; no Node-22 binary available — documented deviation, same toolchain as all prior runs on this worktree)
- `npx tsc -p tsconfig.json` (apps/weltraum-browser): PASS, no errors
- `npm run test -- tests/unit/surfaceLabWorkerAdoption.test.ts tests/unit/workerResultGate.test.ts tests/unit/surfaceLabController.test.ts tests/unit/workerPoolLifecycle.test.ts`: 4 files / 99 tests PASS
- `npm run test` (apps/weltraum-browser): 147 files / 1432 tests PASS
- `npm run build` (apps/weltraum-browser): `tsc -p tsconfig.json && vite build` PASS (only the pre-existing Vite chunk-size warning)
- `git diff --check`: PASS (no output)
- No UI/render change: Playwright NOT APPLICABLE to this slice.

## Independent reviews (reconciliation)

- Correctness re-review: **CLEAN** — no BLOCKING/HIGH findings; fail-closed ordering, scoped authorizer threading, exactly-once settlement, and generic-protocol compatibility verified.
- Robustness re-review: **CONDITIONAL PASS** — one HIGH (settled `Ready` → `Failed` lifecycle divergence) dispositioned as the explicit documented contract above with a `whenSettled()` post-condition test; process-wide fallback accepted as a documented compatibility boundary; no data-corruption or stale-publication defect found.
- Open low items (non-blocking): no dedicated `WorkerPool.fail()` double-emit regression test; standalone decoder/cache defaults stay process-wide by design.

## Known limitations

- Plannotator final human review: NOT RUN (review tool unavailable in this environment).
- Playwright E2E: NOT APPLICABLE (no UI/render change in this slice).
- Node 22 verification: NOT RUN (toolchain provides Node v26.2.0 only).
