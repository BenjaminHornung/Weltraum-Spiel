# Test Protocol: Browser Hestia Microvoxel Surface Lab V1

## Preconditions
- Worktree branch feature/browser-hestia-microvoxel-surface-lab-v1 from origin/main 5ff47ae.
- Node 22.
- No dependency or lockfile change.
- Required concept PNGs materialized only for human guidance and never loaded by runtime.

## Unit Matrix
1. VoxelBrick accepts exact V1 layout and rejects malformed dimensions, revisions, non-finite values and wrong buffer lengths.
2. Apron maps to the correct global coordinates.
3. Neighbor density and material samples are byte-identical.
4. Material IDs/classification are stable and complete.
5. Same seed produces same brick hashes; changed seed produces a different valid result.
6. 0.25 and 0.50 m produce separate keys/hashes/extents.
7. Scatter is reconstructable and contains no random/wall-clock input.
8. Surface Nets produces finite geometry, in-range indices and containing bounds.
9. Empty and full terrain produce valid empty products.
10. Material ranges cover all indices exactly once.
11. Same inputs produce identical mesh hashes.
12. Border vertices match and missing-neighbor paths fail closed.
13. Worker protocol validates multi-buffer layouts, transfer lists, hashes and output budget.
14. Stale results are rejected and cancellation publishes no mesh.
15. Caller/worker/cache ownership remains valid after transfer and artifact handoff.
16. Snapshot and adoption strategies preserve topology and canonical mesh hash.
17. SurfaceLocalFrame ID is preserved and camera/floating-origin movement does not change brick hash.
18. Surface Lab controller handles 16/16 readiness, failure, regenerate, resolution switch and disposal.
19. Static scans prove no Three.js import in Voxel/Generator core, no Math.random and no generator Date.now.

## Focused Browser Matrix
- Load /?surfaceLab=1 as a normal runtime mode.
- Assert no TestBridge global/path.
- Capture console, pageerror, requestfailed and HTTP >=400; require none.
- Wait with a 120-second bound for requested=16, ready=16, failed=0, queue=0, running=0.
- Record seed, preset, brick hashes and mesh hashes.
- Regenerate same seed with cache bypass and require identical hashes.
- Change seed and require a different valid hash set.
- Toggle wireframe and chunk boundaries.
- Move camera and require unchanged canonical hashes.
- Activate 0.25 m and require honestly reported 32 x 16 x 32 m region.
- Capture 1920x1080 default, wireframe and quarter-meter screenshots.

## Technical Screenshot Review and Visual Deferral
Require a visible non-empty live terrain projection, no obvious chunk holes, no always-on dominant debug grid, a compact edge HUD, exact 1920x1080 dimensions, and no runtime concept image/ship/outpost/mission/player fiction. These captures are technical evidence for the pipeline and controls, not visual-fidelity acceptance. Independent review records the current visual result as known failing: landforms/material bands are too dark, the waterline is not convincingly readable, overlays can dominate, and the quarter-meter capture does not demonstrate readable microvoxel detail. Those findings are deferred to `browser-hestia-surface-lab-visual-fidelity-v1`.

## Performance Evidence
Record per-region vertices, triangles and mesh bytes; per-job generation/meshing; upload time; queue/running; cache hits/misses; stale rejects; and 300 settled frame samples. Enforce <=16 MiB output per chunk and <=128 MiB region mesh buffers. Report observed values without generalizing beyond the test host.

## Full Verification
- npm ci
- npx tsc -p tsconfig.json
- npm run test
- npm run build
- npm run test:e2e:core
- npm run test:e2e:live
- npm run test:e2e:ui
- npm run test:e2e
- git diff --check

## Completion Evidence
Store summary JSON, Markdown and technical screenshots under apps/weltraum-browser/evidence. Record start/final SHAs, exact commands and results, screenshot dimensions/runtime state, measured values, review findings/fixes, the explicit visual-fidelity deferment and remaining limits.

## Approved Pipeline-Baseline Reframe (2026-07-15)
1. Task 4.2 completes on real-browser inspectability, focus/input behavior, presentation-only environment ownership, telemetry, lifecycle/disposal safety and canonical-hash stability.
2. The live spec proves same-seed equality, changed-seed inequality, settlement, zero browser/network errors, interaction hash stability, truthful quarter-meter extent and measured budgets without TestBridge.
3. Screenshots remain required technical evidence, but visual-fidelity review is intentionally failing/deferred and is not a Task 5.2 blocker.
4. Full Node 22 verification and independent correctness reviews remain mandatory. Any unavailable Node 22 runtime is a blocker rather than an implicit Node 26 substitution.

## Revised Task 4.1 Contract Matrix (2026-07-15)
1. Execute the query predicate for absent, empty, 0, 01, true, duplicate 1 and exact single 1; source-text matching is not evidence.
2. Same canonical brick/product input preserves representation key; changed seed/content, 0.50/0.25 resolution and mesher version produce fresh deterministic keys.
3. A real revision-enforcing backend accepts changed-seed and changed-resolution generations and observes prior-key removal exactly once.
4. Controller requests exactly 16 jobs from real catalog/time/BodyFixed/SurfaceLocalFrame inputs and settles once.
5. Invalid seed fails before generation, epoch, ticket, telemetry or settlement mutation.
6. One-of-16 failure leaves no prior-generation artifact; lifecycle is Failed and only current-generation successes may remain.
7. Real decoder coverage proves accepted-terminal plus exact buffer identity adoption, any mismatch/unproven/cached snapshot, and empty product no-artifact success.
8. Fake cancellation resolves as Cancelled; stale Completed behavior is tested separately and is not used to simulate cancellation.
9. Dispose racing start or restartWorker remains Disposed and produces no post-dispose enqueue, artifact, telemetry or settlement replacement.
10. Normal cache lookup records actual hit/miss; explicit regenerate records bypass; accepted canonical output may admit; stale/cancelled/malformed/rejected output does not admit; cache-owned buffers remain intact after dispatch.
11. Telemetry records actual brick and mesh hashes and cannot influence decisions.
12. Fresh verification includes focused controller/canonical/query tests, relevant WorkerPool/result-gate/cache/adapter/backend regressions, strict TypeScript, Vite build, whitespace/NUL and forbidden-scope/import audits. Full-suite results must state Node version and separate Task 4.1 failures from known TypeScript-7 hestiaSeedDeterminism failures.

## Task 4.1 Amendment 2 Protocol Matrix (2026-07-15)
1. Spatial WorkerJob target keys remain deterministic and request-computable.
2. Generated mesh representation keys require validated brick content plus mesher algorithm/version and differ when either changes.
3. Protocol accepts valid Generate and Cached outputs only after canonical brick reconstruction/validation.
4. Protocol rejects tampered representation key, brick content/hash, wrong algorithm/target, stale epoch, transfer-hash mismatch, layout and budget errors at the intended gates.
5. Surface Lab controller tests use separate job target and decoded representation identities; no payload-only content-key prediction remains.
6. Existing Surface Nets V1 artifact revision, WorkerPool/resultGate, cache ownership and backend revision tests remain green.


## Approved Task 4.1 Amendment 3 Protocol Matrix (2026-07-15)
1. Adapter default mapping preserves neutral revision zero; optional override changes only Presentation artifactRevision while key, source revision, content hash, topology and ownership strategy remain stable.
2. Every same-input regenerate/restart removes 16 prior publications and the real backend accepts 16 same-key upserts at a strictly greater Presentation revision.
3. Seed/resolution A-to-B-to-A preserves A's canonical key and accepts its later publication above the prior removal tombstone.
4. One-of-16 failure after a complete generation leaves no old artifact for the failed coordinate.
5. Accepted Generate plus exact buffers adopts; accepted CachedCanonicalBrick always snapshots; mismatched/unaccepted snapshots; empty publishes nothing; cache buffers remain intact.
6. Idle/failed-start requested count is zero; successful ticket creation reports actual count; corrupt cached bundle records a miss and falls back to Generate; shadow cache metadata remains bounded.
7. Dispose racing a rejecting worker replacement leaves Disposed and returns without an unhandled rejection; genuine replacement failure still reports failure.
8. Query predicate executes absent, empty, 0, 01, true, duplicate 1 and exact single 1; only exact single 1 activates dynamic composition.
9. Fresh verification runs adapter/controller/canonical/protocol/cache/WorkerPool/real-backend suites, focused strict TypeScript, direct Vite, valid full-suite command, Node-version report, whitespace/NUL/import/scope audits and no DevToolbox verify_run.
