# Design: Browser Vitest CPU Contention Stability

## Context
The complete suite combines CPU-intensive synchronous orbital/simulation workloads with ordinary unit tests. Vitest 4.1.9 derives a default worker count from available logical CPUs. On the current 16-logical-CPU machine, simultaneous heavy files compete for CPU, and individual tests that normally complete in approximately four seconds can cross the unchanged 5000 ms timeout. Isolated and serialized diagnostic runs pass, and the affected tests predate the IndexedDB branch.

Task 2.1 verification established that the focused browser-storage E2E passes with installed Chrome, but the complete Playwright suite under its default eight workers produced multiple timeouts and did not finish within the 600-second diagnostic bound. That failed run also rewrote tracked files under `apps/weltraum-browser/evidence/`. The revised closure path treats both as verification-environment effects: serialize the complete E2E only through the command-line worker override and restore generated evidence before final scope audit. Neither finding authorizes an additional product, Vitest, Playwright, test, package, lock, timeout, or pool change.

## Decision
Set `maxWorkers: 1` in the existing top-level `test` object in `apps/weltraum-browser/vite.config.ts`, adjacent to `include` and `environment`.

This serializes Vitest file workers while retaining the existing test pool, per-file behavior, assertions, test ordering semantics within each file, environment, and timeout values. It is a test-runner resource-budget decision, not a production-code workaround.

For complete E2E closure, invoke the existing Playwright command with the verification-only `--workers=1` CLI override. Do not persist that override in Playwright configuration or package scripts.

## Alternatives Rejected
- Raising `testTimeout`: masks resource contention and weakens regression detection.
- Editing or simplifying heavy tests: changes coverage and is outside the approved scope.
- Sharding or maintaining special full-suite commands: makes the default verification path diverge from local and CI behavior.
- Changing Vitest or Playwright pools, configs, scripts, or dependencies: increases scope without evidence that production/test definitions are incorrect.
- Using a machine-derived dynamic worker count: does not provide the approved deterministic one-worker Vitest budget.
- Treating the failed default-eight-worker E2E as closure evidence: it timed out, failed tests, and left tracked evidence changes.

## Verification Strategy
1. Confirm the user-restored pre-E2E baseline: only `apps/weltraum-browser/vite.config.ts` is tracked-modified, package files are unchanged, no tracked evidence path is modified, and `git diff --check` passes.
2. Retain the already-passed Node 22 evidence: TypeScript/build; CPU focus 3 files/57 tests; browser-storage focus 5 files/45 tests; three complete unit runs of exactly 91 files/865 tests within 120 seconds; focused browser-storage E2E 1/1; dual review with no unresolved material finding.
3. Under Node 22.23.1/npm 11.13.0 and installed Chrome 150.0.7871.115, run the complete existing E2E suite with `--workers=1`, a 45-minute command bound, and require exactly 55/55 passing tests.
4. Because E2E rewrites tracked evidence, require the user to run `git restore -- apps/weltraum-browser/evidence` after the E2E run. Do not bypass the environment safety block.
5. After restoration, rerun diff-check and exact changed-path/package audit, obtain focused reviewer follow-up, record all evidence, run asynchronous DevToolbox verification and completion preflight, and only then complete Task 2.1.

## Risks and Controls
- Serial execution may increase wall-clock duration. Control: bound the complete E2E command to 45 minutes and require exact 55/55 completion.
- A count change can conceal an accidentally omitted test. Control: retain exact 91-file/865-test unit evidence and require exact 55/55 complete E2E evidence.
- E2E updates tracked screenshots/logs/evidence. Control: require explicit user restoration both before the revised run and after it, then prove zero tracked evidence modifications.
- A passing suite could still hide an unintended timeout or package edit. Control: audit `vite.config.ts`, `package.json`, `package-lock.json`, and the complete changed-path set.
- Shared worktree changes can be misattributed. Control: compare against the recorded basis and treat only `vite.config.ts` plus this change's DevToolbox artifacts as stability-change files.

## Stop Conditions
Stop without broadening scope if the pre- or post-E2E cleanup is missing, the serialized complete E2E fails, times out, exceeds the 45-minute command bound, reports other than 55/55, an unauthorized tracked path appears, a material review finding remains, DevToolbox verification fails, or closure would require a test/production/package/config edit. Report the evidence and request replanning rather than masking the failure.