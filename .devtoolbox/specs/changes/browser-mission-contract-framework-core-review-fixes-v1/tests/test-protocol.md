# Test Protocol

Final verification completed on 2026-07-20 in the isolated hotfix worktree after integrating current `origin/main` at `93c72c7cbe7ad2413b8fcedab88c030b70e06104`. The original hotfix base was `260dfd3a281ee65352ea8479da7cafe08f82cbe4`.

| Gate | Command | Result |
| --- | --- | --- |
| Runtime | `node --version` | PASS: v22.23.1 |
| Clean install | `npm ci` | PASS: 59 packages, 0 vulnerabilities; lockfile unchanged |
| TypeScript | `npx tsc -p tsconfig.json` | PASS |
| Focused mission unit | `npx vitest run tests/unit/missionContractCore.test.ts` | PASS: 1 file, 23 tests |
| Full unit suite | `npm run test` | PASS: 104 files, 999 tests |
| Production build | `npm run build` | PASS |
| Focused mission proof | `npx playwright test --config=tests/e2e/configs/mission-contract-framework-core.playwright.config.ts --workers=1` | PASS: 1/1 |
| Serial core E2E | `npm run test:e2e:core -- --workers=1` | PASS: 31/31; mission proof included |
| E2E ownership scan | all `tests/e2e/**/*.spec.ts` across core/live/ui scripts | PASS: exactly one group each |
| Scope scan | PR diff allowlist against current main | PASS |
| Lockfile scan | package/lockfile diff | PASS: no lockfile change |
| Forbidden import scan | mission imports for UI/economy/cargo/faction/world/navigation/interaction/suit/scheduler | PASS |
| Secret scan | candidate diff patterns | PASS |
| Whitespace | `git diff --check` | PASS |

The first sandboxed Vitest attempt was not a product failure: Vite could not spawn a child process under the restricted Windows token (`spawn EPERM`). The same focused command passed outside that token. Test-generated modifications to pre-existing evidence files were restored to `HEAD`; the deterministic mission proof itself remained unchanged.

## Review follow-up

Exact-head review on `57ef58ba41110ba2d8417d449db76e36d215f153` found the Offered-state terminalization edge; it was fixed in `9eb4ff42785b781c78cd1ea8515a6d5d9f1569ee`, whose re-review reported no major issues. After current main was integrated and final evidence recorded, review on `004d2bc9c845cf7a8118abebc969bdde0fc22dfa` found that explicit prerequisites still blocked successors after a non-terminal failure. The finding was accepted: `Failed` now counts as a terminally processed prerequisite, and the regression retains the real explicit edge. The complete matrix above was rerun successfully after this second fix.

Before merge, `origin/main` had advanced by 17 commits. It was integrated in merge commit `a277d9a`; the only conflict was E2E ownership in `package.json`, resolved by retaining both the already-landed mission core assignment and the new Hestia live assignment.
