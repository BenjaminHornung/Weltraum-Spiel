# Test Protocol

## Automated unit acceptance

Run the eight focused Vitest files and prove:

1. Queue sorting is deterministic.
2. Same priority uses deadline, target, then job-ID tie-breaks.
3. Queue limit fails closed.
4. Queued jobs can be cancelled.
5. Running jobs can be cooperatively cancelled.
6. Cancelled jobs publish no result.
7. Wrong PlanningEpoch is rejected.
8. Wrong WorkerEpoch is rejected.
9. Wrong input revision is rejected.
10. Invalid buffer layout is rejected.
11. Oversized result is rejected.
12. Worker failure settles all affected requests.
13. Replacement advances WorkerEpoch.
14. Old Worker output after replacement is rejected.
15. Shutdown leaves no unresolved promises.
16. Transfer descriptors validate byte ranges, alignment, overflow, and declared size.
17. The loader deduplicates identical requests.
18. Cache hit avoids provider work.
19. Cache miss loads data.
20. Pinned entries are not evicted.
21. Release permits later eviction.
22. Byte budget remains enforced.
23. Same key plus different hash is rejected.
24. Valid residency transitions succeed.
25. Invalid residency transitions fail closed.
26. Telemetry counts jobs and transferred bytes correctly.
27. Diagnostics do not change queue decisions.
28. Canonical snapshots are deterministic.
29. Worker/streaming/telemetry core imports no Three.js.
30. Caller inputs are not mutated and internal snapshots remain frozen.

Also cover the exact 4-Urgent and 8-non-Normal fairness boundaries, empty-lane no-idle behavior, duplicates across terminal jobs, idempotent cancellation/release, multiple subscribers with independent cancellation, stale provider revisions, hash mismatches, clear semantics, telemetry reset, counter saturation, messageerror/invalid-protocol faults, and terminal settlement once.

## Browser acceptance

Run `npm run test:e2e -- tests/e2e/worker-streaming-telemetry-spine.spec.ts` against the normal Vite route. Install console, page, request, and HTTP failure collectors before navigation. Prove TestBridge is absent. Dynamically import `/src/workers/index.ts`, `/src/streaming/index.ts`, and `/src/diagnostics/performance/index.ts`. Create a real module Worker through the workers public API.

For deterministic 256 KiB, 1 MiB, and 4 MiB buffers, prove transfer detachment, exact transformed bytes/hash/layout/revisions, queued cancellation, running chunk-yield cancellation with no late output, stale PlanningEpoch rejection, termination/replacement with increased WorkerEpoch, cache miss/hit/pin/release/eviction, and telemetry counters. Repeat from clean state and compare canonical semantic output only. Record elapsed observations as evidence without gating on them except a generous hang timeout.

## Evidence

Write only after assertions pass:

- `apps/weltraum-browser/evidence/browser-worker-streaming-telemetry-spine-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-worker-streaming-telemetry-spine-v1.md`

No screenshot is required.

## Regression commands

From `apps/weltraum-browser` run `npm ci`, `npx tsc -p tsconfig.json`, each focused unit command, focused E2E, `npm run test`, `npm run build`, `npm run test:e2e`, and finally `git diff --check`. Confirm package and lock hashes are unchanged and every changed path is allowed.
