# Test Protocol: Browser Celestial Gravity Core v1

Date: 2026-07-13

## Baseline

- Base: `origin/main` at `7b2b3cb3089ff3e1032652446183b1a5da77cf07` after `git fetch --all --prune`.
- Branch: `feature/browser-celestial-gravity-core-v1`.
- Worktree: isolated task-owned worktree under the repository `.worktrees` convention.
- Unity is excluded by contract and was not started.
- The initial worktree checkout required `GIT_LFS_SKIP_SMUDGE=1` because an unrelated historical screenshot LFS object returns HTTP 404.
- DevToolbox MCP `workspace_prepare_for_agent` currently rejects this isolated worktree as outside its configured allowed root. The canonical change files are used as the safe fallback; DevToolbox calls will be retried after the artifacts exist and the limitation will be reported if it remains.

## Planned verification

From `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/celestialCatalog.test.ts
npm run test -- tests/unit/celestialValidation.test.ts
npm run test -- tests/unit/celestialEphemeris.test.ts
npm run test -- tests/unit/celestialGravity.test.ts
npm run test:e2e -- tests/e2e/celestial-gravity-core.spec.ts
npm run test
npm run build
npm run test:e2e
```

Repository checks:

```text
git diff --check
git diff --name-only origin/main...HEAD
git status --short
```

## Evidence outputs

- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-celestial-gravity-core-v1.md`
- Screenshot: not applicable; no visual contract or UI change.

## Results

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 59 packages installed, 0 vulnerabilities; package and lockfiles unchanged. |
| `npx tsc -p tsconfig.json` | PASS | Exit code 0. |
| `celestialCatalog.test.ts` | PASS | 4 tests. |
| `celestialValidation.test.ts` | PASS | 6 tests. |
| `celestialEphemeris.test.ts` | PASS | 7 tests. |
| `celestialGravity.test.ts` | PASS | 5 tests. |
| Focused celestial Playwright | PASS | 1 test on normal `/` through installed-Chrome fallback; both task-owned evidence files written. |
| `npm run test` | PASS | 43 files, 466 tests. |
| `npm run build` | PASS | TypeScript and Vite production build; existing chunk-size warning only. |
| `CI=true npm run test:e2e` | PASS | 45 tests, 1 worker, 5.1 minutes. |
| `git diff --cached --check` | PASS | Exit code 0 after removing seven EOF-only blank lines. |
| Allowed-path audit | PASS | Every changed/untracked path matches the task allowlist; no package, lockfile, Unity, flight, navigation, runtime, render, UI, world, or test-harness change. |
| Foreign generated evidence cleanup | PASS | Tracked evidence outside `browser-celestial-gravity-core-v1*` restored after the final browser run. |

The first parallel full-browser attempt produced one load-related timeout and three image-comparison failures. Isolated diagnosis proved the timeout passed alone and the image failures were caused by four 131-byte Git LFS pointers left by the worktree's required skip-smudge checkout. Materializing only those already tracked comparison objects made their existing suite pass 3/3. The final complete serial CI run passed 45/45.

The installed Playwright headless shell fails to spawn on this Windows host with `spawn UNKNOWN`. The repository's documented local fallback, `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`, was used for all successful browser gates.

## DevToolbox completion preflight

`workspace_prepare_for_agent`, `specs_get_status`, `specs_validate`, `tasks_load`, and `tasks_completion_preflight` were attempted against the isolated worktree. Each path-aware call was rejected with non-retryable `unauthorized_path` because the DevToolbox server's configured allowed root excludes the repository's `.worktrees` directory. No security/configuration bypass was attempted.

The manual fallback preflight checked every task against source, tests, generated evidence, fresh exit codes, the task allowlist, and the documented non-goals. Tasks 1-7 were closed only after that evidence existed. Task 8 remains open until the implementation commit and first branch push have actually succeeded.
