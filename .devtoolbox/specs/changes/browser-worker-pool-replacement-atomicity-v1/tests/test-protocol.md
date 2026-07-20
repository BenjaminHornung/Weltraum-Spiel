# Test Protocol: WorkerPool Replacement Atomicity V1

## Required behavior

Real WorkerPool lifecycle coverage must prove successful candidate-first replacement, inert candidate-start failure, preservation of the old active job and queue, unchanged PlanningEpoch/WorkerEpoch/restart count/lifecycle before admission, and shutdown while the candidate is starting. Surface Lab Scenario 5 remains unchanged and must stay green.

## Node 22 verification

Run from `apps/weltraum-browser` with `C:\tmp\node-v22.23.1-win-x64` first on `PATH`:

1. `npm ci`
2. `npx tsc -p tsconfig.json`
3. `npx vitest run tests/unit/workerPoolLifecycle.test.ts tests/unit/surfaceLabController.test.ts`
4. `npx playwright test tests/e2e/worker-streaming-telemetry-spine.spec.ts --workers=1`
5. `npx playwright test tests/e2e/hestia-microvoxel-surface-lab.spec.ts --workers=1`
6. `npm run test`
7. `npm run build`
8. `npm run test:e2e:core -- --workers=1`
9. `npm run test:e2e:live -- --workers=1`
10. `git diff --check`
11. Changed-path, package/lockfile, Assets, main bootstrap, renderer/game/presentation-authority and forbidden-import audits.

## Results

All commands ran from `apps/weltraum-browser` with Node `v22.23.1` and npm `10.9.8`. After the remote feature/PR head advanced from the verified baseline `02f436c6980414e00bb19602f52e72c158550d2e` to `cb5dedb1c5594a494bd790e4a79ec020362312c3`, the fix commit was rebased without conflicts and the complete matrix was repeated on the combined head.

- RED proof: `npx vitest run tests/unit/workerPoolLifecycle.test.ts` failed only the three new replacement-atomicity tests before the implementation.
- `npm ci`: PASS; 59 packages installed, 0 vulnerabilities.
- `npx tsc -p tsconfig.json`: PASS.
- `npx vitest run tests/unit/workerPoolLifecycle.test.ts tests/unit/surfaceLabController.test.ts`: PASS; 60/60 tests on the combined head.
- `npx playwright test tests/e2e/worker-streaming-telemetry-spine.spec.ts --workers=1`: PASS; 1/1 test.
- `npx playwright test tests/e2e/hestia-microvoxel-surface-lab.spec.ts --workers=1`: PASS; 2/2 tests.
- `npm run test`: PASS; 103 files and 976/976 tests on the combined head.
- `npm run build`: PASS; TypeScript and Vite production build. The pre-existing chunk-size warning remains informational.
- `npm run test:e2e:core -- --workers=1`: PASS; 30/30 tests.
- `npm run test:e2e:live -- --workers=1`: PASS; 14/14 tests.
- Port `5173`: clear after E2E execution.
- `git diff --check`: PASS.
- Exact changed-path allowlist, forbidden-path audit, package/lockfile blob comparison, and forbidden-import audit: PASS.

Playwright used the installed Chrome executable and distinct final artifact groups `pr32-rebased-worker-focused`, `pr32-rebased-hestia-focused`, `pr32-rebased-core`, and `pr32-rebased-live`. Test-generated baseline evidence was restored after the runs. DevToolbox verification and completion-preflight results are reported separately and are never inferred from local command success.

## DevToolbox result

- Spec validation: PASS for proposal, design, behavior spec, and the single task.
- `verify_run`: completed asynchronously after the caller stopped waiting; 2 steps passed, the build finished with exit code 0 plus the known chunk-size warning, and 0 steps failed. This automated result covers the pre-rebase head.
- Manual verification note: recorded on execution `0acadab889094134a2c9ba44e95d2604` and extended with the complete post-rebase repository-local matrix above.
- Completion preflight: PASS, no blockers or warnings, `canProceed: true`; the task has both the automated pre-rebase result and manual post-rebase evidence.
- Review status: one automated build finding remains available because DevToolbox classifies the exit-0 Vite chunk-size advisory as a major warning; no test or build step failed.
- Task 1: closed only after the completion preflight recognized the manual verification evidence.
- Archive: NOT RUN, as required.
