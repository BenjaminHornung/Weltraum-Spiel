# Test Protocol

## Phase 1 - no browser execution

Run from `apps/weltraum-browser`:

```powershell
npm ci
npm run test
npm run build
# Execute the workflow's exact membership validator locally.
# Parse every top-level evidence/*.json file.
```

Run from the worktree root:

```powershell
# Parse .github/workflows/browser-mainline-ci.yml with an available YAML parser.
git diff --check
git status --short -- Assets apps/weltraum-browser/src apps/weltraum-browser/package-lock.json package.json package-lock.json apps/weltraum-browser/tests/e2e/debug-scene.spec.ts
```

Static review also checks for `.only`, `continue-on-error`, unintended source/lock/asset changes, exact group counts, default and grouped artifact paths, and strict CI conditions.

## Phase 2 - exclusive browser port required

Run only after the shared fixed port 5173 is free:

```powershell
$env:CI = "true"
$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "core-autopilot"
npm run test:e2e:core
$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "live-runtime"
npm run test:e2e:live
$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "ui-layout"
npm run test:e2e:ui
Remove-Item Env:CI
Remove-Item Env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP
npm run test:e2e
```

Inspect all three grouped report/output directories and the unchanged aggregate directories. Exact-head pull-request CI is the final merge gate and must complete inside 45 minutes.

## Results

### Phase 1 - 2026-07-13

| Check | Result |
| --- | --- |
| `npm ci` | Pass; 59 packages installed, 0 vulnerabilities. |
| `npm run test` | Pass; 39 files, 444 tests. |
| `npm run build` | Pass with the existing Vite large-chunk warning. |
| Exact inline workflow membership validator | Pass; 21 discovered, 21 assigned, groups 10/8/3, no unassigned/duplicate/stale entry. Strict parser self-checks accept one valid representative and reject shell-suffix plus `--grep` mutations. |
| Exact inline workflow evidence parser | Pass; 23 top-level JSON files parsed. |
| Direct TypeScript config import | Pass; default paths, grouped paths, exact `CI=true` behavior, and invalid-group rejection verified without browser execution. |
| YAML parser | Not run; system Python is policy-blocked and no `actionlint`, Ruby, PowerShell YAML command, or installed Node YAML module is available. Pull-request Actions parsing remains required. |
| `.only` / `continue-on-error` search | Pass; neither is present in the scoped E2E/workflow files. |
| Guarded path status | Pass; `Assets`, browser product source, lockfiles, root package files, and `debug-scene.spec.ts` are clean. |
| `git diff --check` | Pass; Git reports only the repository's normal CRLF conversion notices. |

### Phase 2 - 2026-07-13

The fixed port 5173 was held exclusively and every browser command ran
serially. The host policy blocks Playwright's downloaded Chromium before page
launch, so the repository-supported `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH`
override selected the installed
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

| Check | Result |
| --- | --- |
| `npm run test:e2e:core` with `CI=true`, group `core-autopilot` | Pass; 23/23 tests in 46.0s. |
| `npm run test:e2e:live` with `CI=true`, group `live-runtime` | Pass; 12/12 tests in 198.0s. |
| `npm run test:e2e:ui` with `CI=true`, group `ui-layout` | Pass; 9/9 tests in 35.0s after the exact workflow-scoped LFS reference preflight was reproduced locally. |
| Unchanged aggregate `npm run test:e2e` | Pass; 44/44 tests in 284.6s. |
| Exact inline membership validator rerun | Pass; 21 discovered, 21 assigned exactly once, groups 10/8/3, strict parser mutation checks pass. |
| Exact evidence parser rerun | Pass; all 23 top-level JSON files parse. |
| Final tracked evidence cleanup | Pass; generated changes were restored and only the five intended tracked implementation files plus this new spec remain. |

The first local UI-slice attempt exposed an environment-preflight difference,
not a product failure: four allowed rejected-V1 PNG references were still
131-byte LFS pointers because the local command had skipped the workflow's
selective LFS hydration step. Their exact LFS objects were already present and
matched their expected SHA-256 values. Running `git lfs checkout` only for the
four workflow-allowlisted paths restored valid PNG signatures without changing
Git content; the complete UI slice then passed 9/9. Unscoped LFS download or
checkout was not used.

The DevToolbox MCP remains unavailable for this nested worktree because the
workspace path is rejected as unauthorized. The equivalent local completion
preflight consists of the phase-1 checks, all three independent CI-mode groups,
the unchanged aggregate suite, diff/path review, and independent review. The
only remaining task is the external exact-head pull-request CI run, which must
pass before merge and remain within the provisional 45-minute timeout.
