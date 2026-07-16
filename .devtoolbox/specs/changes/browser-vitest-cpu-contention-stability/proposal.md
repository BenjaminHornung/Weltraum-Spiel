# Proposal: Browser Vitest CPU Contention Stability

## Problem
The browser application's complete Vitest suite is reproducibly unstable under the required Node 22 runtime when Vitest uses its default file-worker parallelism on this 16-logical-CPU workstation. CPU-intensive synchronous simulation suites pass in isolation but exceed Vitest's unchanged 5000 ms per-test timeout during the complete parallel run. The observed failures are in pre-existing simulation tests rather than in the browser IndexedDB implementation that the suite is intended to verify.

## Outcome
Configure the browser Vitest test runner to use one file worker so CPU-heavy suites do not contend with each other. Preserve every test, assertion, timeout, environment, package version, and production behavior while making the complete Node 22 verification repeatable.

## Scope
- Add `test.maxWorkers: 1` to `apps/weltraum-browser/vite.config.ts`.
- Verify the three known CPU-heavy files, the five browser-storage unit files, the complete unit suite, the browser build, and browser E2E coverage under Node 22.
- Require three consecutive complete unit-suite passes with unchanged counts of 91 files and 865 tests.
- Record review, verification, scope, and timing evidence through DevToolbox.

## Non-Goals
- Do not raise test or hook timeouts.
- Do not change pool type, package versions, package manifests, lock files, tests, simulation code, persistence code, or production behavior.
- Do not weaken, skip, quarantine, shard, reorder, or delete tests.
- Do not create a second worktree; the existing IndexedDB feature worktree is the approved reproduction environment.
- Do not commit, push, open a PR, merge, or perform destructive Git operations as part of this change.

## Success
- `apps/weltraum-browser/vite.config.ts` is the only non-DevToolbox file changed by this stability change and contains `test.maxWorkers: 1`.
- The three CPU-heavy files and five browser-storage files pass under Node 22.
- Three consecutive complete Vitest runs each pass 91/91 files and 865/865 tests without timeout and each finishes within 120 seconds.
- TypeScript/build and required browser E2E verification pass using installed Chrome when managed Chromium cannot launch.
- Dual review has no unresolved concrete finding, scope audit is clean, and DevToolbox verification/completion gates pass.