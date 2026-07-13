# Test Protocol

Date: 2026-07-13

## Baseline

- Base: freshly fetched `origin/main`.
- Branch: `fix/celestial-fail-closed-review-v1`.
- Worktree: isolated under the repository `.worktrees` convention.
- Scope: four unresolved automated review threads from merged PR #11.

## Planned verification

From `apps/weltraum-browser`:

```powershell
npm run test -- tests/unit/celestialGravity.test.ts tests/unit/celestialEphemeris.test.ts tests/unit/celestialCatalog.test.ts
npm run test
npm run build
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e:core
```

From the worktree root:

```powershell
git diff --check
git status --short
```

## Results

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 59 packages installed from the unchanged lockfile; 0 vulnerabilities. |
| Pre-fix focused regression run | EXPECTED FAIL | Three new cases reproduced gravity publication, Kepler publication, and the sparse-array native `TypeError`. |
| Focused celestial unit tests | PASS | 3 files, 19 tests. |
| `npm run test` | PASS | 44 files, 498 tests. |
| `npm run build` | PASS | TypeScript and Vite production build; existing large-chunk warning only. |
| Focused celestial Playwright | PASS | 1/1 through installed Chrome. |
| Core E2E, default local parallelism | DIAGNOSTIC FAIL | 16/24 with eight workers on a heavily loaded shared host; failures were broad timeout/state-contention symptoms. |
| Core E2E, `CI=true`, one worker | PASS | 24/24 in 94.7 seconds through installed Chrome. |
| `git diff --check` | PASS | No whitespace errors in the changed source/test paths. |
| Scope audit | PASS | Only three celestial source files, four focused test files, and this five-file change spec remain modified/untracked. |
| Generated evidence cleanup | PASS | All E2E-regenerated evidence outside this change was restored to `HEAD`. |

The changed celestial browser test passed in isolation before the complete core
group rerun. The serial CI-mode group is the repository-equivalent authoritative
result because `playwright.config.ts` pins `workers: 1` when `CI=true`.

DevToolbox `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load`,
`execution_create`, and `tasks_completion_preflight` were attempted. Each path-aware call rejected
the nested worktree with non-retryable `unauthorized_path`. The manual fallback
preflight checked the red regressions, fresh green commands, changed-path scope,
generated-evidence cleanup, and final cached diff before closing all tasks.
