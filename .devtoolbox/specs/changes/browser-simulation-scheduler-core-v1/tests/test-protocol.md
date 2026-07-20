# Test Protocol

## Environment

- Fresh isolated worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-035-simulation-scheduler-pr35-finalize`
- Continuation branch: `feature/browser-simulation-scheduler-core-v1-integration-pr35-finalize`
- PR branch target: `feature/browser-simulation-scheduler-core-v1-integration`
- Integrated main SHA: `f6d3fe69175b168ddea5e385c6d7b3452e6cba16`
- Starting PR head: `91a4875c124bacbaa3f315be35c98a26e5583eba`
- Node.js for the authoritative direct matrix: `v22.23.1`
- npm for the authoritative direct matrix: `10.9.8`
- All full matrices were executed serially.
- Unity and `Assets/**` were neither started nor changed.

## Dependency, type, unit, and build verification

The following commands used the explicit Node 22 installation at
`C:\tmp\node-v22.23.1-win-x64`:

```text
npm ci
npx tsc -p tsconfig.json
npx vitest run tests/unit/simulationSchedulerPlanner.test.ts tests/unit/simulationSchedulerState.test.ts tests/unit/simulationSchedulerValidation.test.ts --maxWorkers=1
npm run test -- --maxWorkers=1
npm run build
```

Results:

- `npm ci`: PASS; 59 packages installed, 60 audited, 0 vulnerabilities.
- TypeScript: PASS.
- Focused Scheduler unit tests: PASS; 3 files, 37/37 tests.
- Full unit matrix: PASS; 107 files, 1036/1036 tests.
- Production build: PASS; 165 modules transformed. Vite emitted only the existing advisory for a minified chunk larger than 500 kB.

An initial sandboxed focused-test launch was blocked before test execution by Vite subprocess `spawn EPERM`. The same Node 22 command was rerun with the required subprocess permission and passed; the blocked launch is not counted as a test result.

## Core and focused browser verification

The core matrix used Node 22, one worker, and no retries:

```text
npm run test:e2e:core -- --workers=1 --retries=0
```

Result: PASS, 32/32 tests.

The focused Scheduler Playwright config was then executed twice serially:

```text
npx playwright test --config tests/e2e/configs/simulation-scheduler-core.playwright.config.ts --workers=1 --retries=0
```

- Run 1: PASS, 1/1 test.
- Run 2: PASS, 1/1 test.
- Browser executable: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Route: normal `/`.
- `window.TestBridge`: absent before and after module execution.
- Canonical bytes: identical.
- Signature: identical, `fnv1a32:d670b296`.
- Browser health: 0 console errors, 0 page errors, 0 request failures, 0 HTTP errors, 0 unhandled rejections.
- JSON SHA-256 after both runs: `98D808CF170CC7DE031C1DD9D73CFB3ED3EAEBE9733789410B317C2ACD52ED01`.
- Markdown SHA-256 after both runs: `003C881557D4793D95D3CAAAF511AE346DE681F3376E666B3E0C33266BCE3685`.

The matching hashes prove byte-identical evidence regeneration across both focused runs.

## E2E inventory and audits

Machine-readable package-script inventory:

- Discovered E2E specs: 32.
- Assigned specs: 32.
- Unique assigned specs: 32.
- Core group: 19.
- Live group: 9.
- UI group: 4.
- Unassigned: 0.
- Duplicates: 0.
- Stale assignments: 0.
- `simulation-scheduler-core.spec.ts`: assigned exactly once, to `test:e2e:core`.

Audits:

- `git diff --check origin/main`: PASS.
- Package lock differs from `origin/main`: no.
- `package.json` differs from main only by the single Scheduler core-group assignment.
- Forbidden import/path scan: 0 matching pattern groups.
- Secret scan: 0 matching pattern groups; no secret values were printed.
- Scope audit: no Mission, Surface, Hestia, Voxel, Blender, Persistence-authority, renderer, DOM, Three.js, runtime-service, Unity, `Assets/**`, dependency, timeout, assertion, or lockfile changes.
- The full core E2E matrix regenerated unrelated evidence files; those generated worktree changes were removed. Scheduler evidence remained byte-identical.

## Retry regression contract

Fresh coverage proves:

- completion `100`, retry `AtTick 99`: rejected;
- completion `100`, retry `AtTick 100`: rejected;
- completion below snapshot and retry after completion but not after snapshot: rejected;
- completion `100`, snapshot `100`, retry `AtTick 101`: accepted;
- `RetryableFailure + None`: rejected;
- rejected results leave the entire input snapshot and job unchanged;
- rejected results do not change revisions, due/planned/completed ticks, failure count, receipts, event intents, or mode;
- valid future retry is not immediately reselected at the same UniverseTime;
- repeated invalid inputs produce structurally identical error objects.

## DevToolbox and independent review

- DevToolbox execution: `eeacc99a8a1745f8bad0657692d4ab65`.
- DevToolbox asynchronous verification operation: `08f4ccf355814aab8ee5319a87e8b356`.
- Wrapper result: `verified`; 2 passed, 1 warning, 0 failed, 0 skipped.
- Specs: PASS.
- Tests: PASS, 107 files and 1036 tests.
- Build: PASS with only the existing chunk-size advisory.
- The wrapper does not expose an explicit Node 22 pin, so its result is supplemental. The explicit Node `v22.23.1` direct matrix above is authoritative.
- Independent read-only code review: no P1, P2, P3, maintainability-decay, or test-health findings.
- Completion preflight and final exact-head remote review are recorded after the final local commit and push.
