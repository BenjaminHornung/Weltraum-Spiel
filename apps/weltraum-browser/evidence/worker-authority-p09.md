# Worker Authority P09 Evidence

Real consumer adopts derived products over the existing WorkerPool/streamingWorker path.
The SurfaceLabController enforces an adoption gate at its adoption boundary; stale,
foreign, cancelled, evicted, forged, and tampered worker responses are rejected
before decode, cache admission, or publication.

- Status: **PASS**
- Scope: `pure-core-unit-proof` (one product path: Surface Lab Hestia voxel-brick mesh jobs)
- Visual UI change: `false` (no UI, no renderer, no scene change; no screenshot required)
- Browser E2E: not required for this slice (pure worker/adoption protocol proof via Vitest)

## Binding fields

Every dispatched Surface Lab job carries: authority epoch (controller generation),
planning epoch, worker epoch (bound at dispatch to the executing handle), target key,
input revision, output revision, algorithm version, source/input digest
(`sourceInputDigest`, fnv1a over payload identity + input bytes), job ID, cancel,
and residency transitions. The source/input digest is threaded through
`WorkerJobRequest` / `WorkerJobResult` / `WorkerResultExpectation` and checked in
the pool result gate (`RejectedSourceInputDigestMismatch`) before completion.

## Obligations

| ID | Status | Deterministic detail |
| --- | --- | --- |
| P09-01 | PASS | Current worker response is adopted exactly once; duplicate delivery is rejected (`RejectedDuplicateDelivery`) and settled generations ignore late unconsumed deliveries. |
| P09-02 | PASS | Dispatch, then newer edit/regeneration: late old terminals settle to null adoption with genuine stale rejections (`RejectedStaleAuthorityEpoch`, `RejectedUnknownJob` + `staleRejects`). |
| P09-03 | PASS | Evict before delivery (real WorkerPool + held transport): cached terminal whose source residency was evicted is rejected (`RejectedEvictedResidency`), `readyChunks` 15 / `failedChunks` 1. |
| P09-04 | PASS | Cancel (supersede/dispose/replace): superseded tickets are cancelled, in-flight replacement failure settles the generation as failed with `cancelledJobs` recorded. |
| P09-05 | PASS | Forged completed terminal never issued by the pool is rejected before decode/cache/publication (`RejectedUnknownPoolTerminal`, pool-scoped authorizer). Cross-pool terminals are not authorized. |
| P09-06 | PASS | Tampered worker epoch and mismatched planning epoch / target / revision / algorithm / source digest are rejected with distinct fail-closed codes. |
| P09-07 | PASS | Bounded queue: over-capacity enqueue fails closed with `QueueFull`; transferable input ownership is taken at enqueue and detached after completion. |
| P09-08 | PASS | Pool failure classification is preserved through the adoption gate (stale/target/revision/algorithm/digest/layout/budget/content-hash), never coerced to generic failure. |

## Stable observations

```json
{
  "unitSuite": {
    "testFiles": 147,
    "tests": 1431,
    "status": "PASS"
  },
  "focusedSlices": {
    "surfaceLabWorkerAdoption": 22,
    "surfaceLabController": 47,
    "workerResultGate": "PASS",
    "workerPoolLifecycle": "PASS"
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

## Verification

- `npm run test` (apps/weltraum-browser): 147 files / 1431 tests PASS
- `npm run build` (apps/weltraum-browser): `tsc -p tsconfig.json && vite build` PASS
- No UI/render change: Playwright not applicable to this slice.
