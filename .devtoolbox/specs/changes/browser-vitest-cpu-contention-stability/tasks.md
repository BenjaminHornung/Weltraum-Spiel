# Tasks: Browser Vitest CPU Contention Stability

## 1. Deterministic worker configuration

- [x] Task 1.1 — Configure one Vitest file worker
  - Objective: Remove cross-file CPU contention from the default browser Vitest run without weakening timeouts, tests, dependencies, or production behavior.
  - Files/search targets: `apps/weltraum-browser/vite.config.ts`; inspect `apps/weltraum-browser/package.json` and `package-lock.json` only to prove they remain unchanged.
  - Acceptance: the existing `test` object contains exactly `maxWorkers: 1`; existing `include` and `environment` settings remain intact; no test, source, package, lock, timeout, pool, or unrelated config edit is made; `git diff --check` passes for the edited file.
  - Implementation guidance: add one property immediately after `environment: "node"`; preserve formatting and avoid opportunistic cleanup; do not alter the shared IndexedDB implementation already present in this worktree.
  - Required skills/MCPs: subagent-driven-development, verification-before-completion, devtoolbox-specs-execution; use the `worker` lane for the mechanical edit.
  - Verification: inspect the focused diff; run Node 22 TypeScript check with `npx tsc -p tsconfig.json`; run together `tests/unit/provingGroundScenarios.test.ts`, `tests/unit/autopilotCourseMetrics.test.ts`, and `tests/unit/simulation.test.ts` using Vitest; run `git diff --check -- apps/weltraum-browser/vite.config.ts`.
  - Report back: changed lines, exact commands, Node version, pass/fail counts and durations, diff-check result, changed-path list, and any deviation.
  - Stopping rule: stop without further edits if the property is incompatible, a focused test fails/times out, verification requires changing timeouts/tests/packages/source, or any unrelated path changes.

## 2. Review, repeatability, and closure

- [x] Task 2.1 — Prove stable complete verification and close the change
  - Objective: Complete the remaining serial full-E2E proof, restore generated evidence, and close the stability change without broadening the approved one-line product scope.
  - Files/search targets: the complete stability-change diff; `apps/weltraum-browser/vite.config.ts`; `apps/weltraum-browser/evidence/`; `tests/e2e/browser-storage-save-repository.spec.ts`; package manifests and lock file for unchanged-state checks; this change's DevToolbox artifacts and verification evidence.
  - Acceptance: the retained Node 22 evidence remains valid (CPU focus 3/57, browser-storage focus 5/45, three complete unit runs each 91/865 within 120 seconds, typecheck/build, focused E2E 1/1, and dual review without unresolved material finding); complete E2E under the verification-only CLI override passes exactly 55/55 within the 45-minute command bound; after user restoration, no tracked evidence path is modified; only `vite.config.ts` remains tracked-modified; package/lock and diff-check remain clean; focused reviewer follow-up, asynchronous DevToolbox verify, and completion preflight pass.
  - Implementation guidance: record the default-eight-worker E2E attempt as failed diagnostic evidence, not closure evidence; do not rerun it; use installed Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`; serialize only through the existing command's `--workers=1` CLI override; do not edit Playwright/Vitest config, tests, packages, locks, timeouts, pools, source, production, IndexedDB files, or evidence; after E2E, stop and require the user to run `git restore -- apps/weltraum-browser/evidence` because the environment safety policy blocks agent-side restoration.
  - Required skills/MCPs: verification-before-completion, devtoolbox-specs-execution, requesting-code-review, devtoolbox-review; use `test-runner` for the serial full E2E and `reviewer` for the focused follow-up; retain the prior `reviewer-glm` result as the independent second lane.
  - Verification: from `apps/weltraum-browser`, under Node 22.23.1/npm 11.13.0 with installed Chrome 150.0.7871.115, run `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; & npx.cmd --yes node@22 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run test:e2e -- --workers=1` with an explicit 45-minute bound and require exactly 55/55; then obtain user evidence restoration, run `git diff --check`, exact changed-path/package audit, focused review, async DevToolbox verification, and task completion preflight.
  - Report back: exact E2E command, Node/npm/Chrome versions, 55/55 result and duration, generated-evidence cleanup status, final changed-path/package audit, focused review disposition, DevToolbox verification/preflight results, and any limitation.
  - Stopping rule: do not complete the task, resume IndexedDB Git closure, commit, or push if cleanup is missing, complete E2E fails/times out/exceeds 45 minutes/reports other than 55/55, an unauthorized tracked path appears, a material finding remains, DevToolbox fails, or broader edits are needed.

## Git restriction

This stability change authorizes no commit or push. After both tasks and all completion gates pass, return to the separate `browser-indexeddb-save-repository-core-v1` Task 4.1 flow and obtain the required explicit user confirmation before the exact approved commit and push.