# Tasks: Browser Worker Streaming Pinned Telemetry Fix V1

All tasks are sequential and remain unchecked until fresh evidence exists. Work
only in the files listed below. Do not create a DevToolbox execution, toggle a
task, mutate test data, commit, or edit any other path.

- [x] **1. Implement the frozen cache transition contract**
  - Files: `apps/weltraum-browser/src/streaming/memoryContentCache.ts`,
    `apps/weltraum-browser/src/diagnostics/performance/streamingProjection.ts`.
  - Acceptance: exported observer events include frozen `Pinned`/`Unpinned` with
    `canonicalKey`; only distinct `0 -> 1` and final `1 -> 0` mutations emit;
    duplicate/non-final/repeated/stale releases are silent; `Cleared` remains one
    reset; observer exceptions remain isolated; projection maintains truthful
    `pinnedEntries` in O(1).
  - Stop rule: stop without redesign if current cache lifecycle cannot prove the
    requested transition semantics or if another file is required.

- [x] **2. Add focused regression coverage**
  - Files: `apps/weltraum-browser/tests/unit/streamingMemoryCache.test.ts`,
    new `apps/weltraum-browser/tests/unit/streamingProjection.test.ts`,
    existing `apps/weltraum-browser/tests/unit/voxelWorkerProtocol.test.ts`.
  - Acceptance: tests cover frozen canonical events, distinct pin transitions,
    duplicate/non-final/repeated/stale releases, clear reset, exception
    isolation, O(1) event projection, and the existing voxel worker protocol
    regression without changing its unrelated contract.
  - Verification: from `apps/weltraum-browser`, run
    `npx vitest run tests/unit/streamingMemoryCache.test.ts tests/unit/streamingProjection.test.ts tests/unit/voxelWorkerProtocol.test.ts`.
  - Stop rule: stop on a failure caused by unrelated baseline behavior or on any
    need to alter package, lock, configuration, Hestia, WorkerPool, resultGate,
    render, or UI code.

- [x] **3. Update only the existing runtime spine evidence and documentation**
  - Files: `apps/weltraum-browser/tests/e2e/worker-streaming-telemetry-spine.spec.ts`,
    existing `apps/weltraum-browser/evidence/browser-worker-streaming-telemetry-spine-v1-summary.json`,
    existing `apps/weltraum-browser/evidence/browser-worker-streaming-telemetry-spine-v1.md`,
    `docs/browser-mainline/worker-streaming-telemetry-spine-v1.md`.
  - Acceptance: the real browser scenario uses the exported observer, proves
    `pinnedEntries` `0 -> 1 -> 0`, contains no manual `setCacheState` call, and
    regenerates only the existing JSON/Markdown evidence. No screenshot is made.
  - Verification: run
    `npm run test:e2e -- tests/e2e/worker-streaming-telemetry-spine.spec.ts`.
  - Stop rule: stop if the route requires TestBridge, manual state injection, a
    screenshot, or any new evidence/config/package/CI path.

- [x] **4. Run final verification, scope audit, and report**
  - Files audited: exactly the four implementation/test/doc groups above plus
    the four change artifacts in this directory; `apps/weltraum-browser/package.json`
    and `apps/weltraum-browser/package-lock.json` must be unchanged.
  - Environment gate: `node --version` is `v22.23.1`; `npm --version` and
    `npx --version` are both `11.13.0`.
  - Verification, from `apps/weltraum-browser`:
    `npx tsc -p tsconfig.json --noEmit`;
    `npm run build`;
    `npm test`;
    and the focused unit and E2E commands above.
  - Audit: run `git status --short`, `git diff --check`, inspect the diff, and
    verify no package/lock/config/CI or out-of-scope path changed.
  - Final review: perform one final diff/scope/contract review, record every
    command and PASS/FAIL/NOT RUN result, report blockers and residual risk, and
    stop. Do not commit or toggle tasks.
