# Test Protocol

## Environment

- Worktree: `C:\IFI_SourceCode\WT\Weltraum-Browser-IFIWELTRAUM-000-simulation-scheduler-core-v1`
- Branch: `feature/browser-simulation-scheduler-core-v1`
- Pinned base SHA: `75d78d4c8d12e2d85a8fb70864feb19dbe8d9c8f`
- Node.js: `v22.23.1`
- npm: `11.16.0`

## Focused unit verification

The requested literal command was executed first:

```text
npx vitest run tests/unit/simulationScheduler*.test.ts --maxWorkers=1 --minWorkers=1
```

Result: CLI rejection before test discovery because Vitest `4.1.9` does not support `--minWorkers` (`CACError: Unknown option --minWorkers`). The supported equivalent used explicit Windows-safe file arguments and one worker:

```text
node node_modules/vitest/vitest.mjs run tests/unit/simulationSchedulerValidation.test.ts tests/unit/simulationSchedulerPlanner.test.ts tests/unit/simulationSchedulerState.test.ts --maxWorkers=1
```

Result: PASS, 3 files, 32/32 tests.

## Full unit matrix

Executed through the local verification orchestrator with the desktop-heavy profile:

```text
node node_modules/vitest/vitest.mjs run --maxWorkers=4
```

- Result: PASS, 89 files, 852/852 tests.
- Run ID: `da47e026fdfa46439d62e8f513687091`
- Canonical plan hash: `cfabf9baf3c1f62adc8759b3255a98f7655111240e49d8027f08209f5e70553e`
- Summary hash: `d6540041172a60acec6d12ed25901d6813ebdcf3a5f786820472e7ea84728a7b`
- Unexpected dirty paths: none.

## Typecheck and production build

```text
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Result: PASS. Vite emitted its existing advisory that the main minified chunk is larger than 500 kB; no build error occurred.

## Normal-route browser evidence

The dedicated Playwright config was executed twice under Node `v22.23.1`:

```text
node node_modules/@playwright/test/cli.js test --config tests/e2e/configs/simulation-scheduler-core.playwright.config.ts --workers=1 --retries=0
```

- Run 1: PASS, 1/1 test.
- Run 2: PASS, 1/1 test.
- Route: `/`.
- `window.TestBridge`: absent before and after module execution.
- Deterministic repeat: canonical bytes identical; signature `fnv1a32:d670b296`.
- Browser health: 0 console errors, 0 page errors, 0 request failures, 0 HTTP errors, 0 unhandled rejections.
- JSON SHA-256 after both runs: `98D808CF170CC7DE031C1DD9D73CFB3ED3EAEBE9733789410B317C2ACD52ED01`.
- Markdown SHA-256 after both runs: `003C881557D4793D95D3CAAAF511AE346DE681F3376E666B3E0C33266BCE3685`.

The matching hashes prove byte-identical evidence regeneration across both runs.

## Review and scope notes

- Standard reviewer: all scheduler code findings addressed; final review requested only evidence regeneration, completed above.
- Reviewer-GLM: eligibility, progress-aware wake behavior, result scheduling invariants, and health evidence findings addressed.
- Verification Reviewer: PASS; the direct shell evidence is sufficient despite the DevToolbox helper hang.
- Completion Preflight: `canProceed: true`, no blockers, no unhandled warnings. It retained an advisory because the hung `verify_run` produced no stored automated result; the manual protocol and execution note contain the complete fresh evidence.
- The new E2E spec cannot be added to `test:e2e:core` in this bounded change because both `package.json` and `package-lock.json` are explicitly forbidden. Dedicated config coverage is complete; package-script assignment is deferred to a later mainline integration change.
