# Test Protocol

Verified on 2026-07-20 in the isolated hotfix worktree from base `260dfd3a281ee65352ea8479da7cafe08f82cbe4`.

| Gate | Command | Result |
| --- | --- | --- |
| Runtime | `node --version` | PASS: v22.23.1 |
| Clean install | `npm ci` | PASS: 59 packages, 0 vulnerabilities; lockfile unchanged |
| TypeScript | `npx tsc -p tsconfig.json` | PASS |
| Focused mission unit | `npx vitest run tests/unit/missionContractCore.test.ts` | PASS: 1 file, 23 tests |
| Full unit suite | `npm run test` | PASS: 87 files, 843 tests |
| Production build | `npm run build` | PASS |
| Focused mission proof | `npx playwright test --config=tests/e2e/configs/mission-contract-framework-core.playwright.config.ts --workers=1` | PASS: 1/1 |
| Serial core E2E | `npm run test:e2e:core -- --workers=1` | PASS: 31/31; mission proof included |
| E2E ownership scan | all `tests/e2e/**/*.spec.ts` across core/live/ui scripts | PASS: exactly one group each |
| Scope scan | changed-path allowlist | PASS |
| Lockfile scan | package/lockfile diff | PASS: package.json only, no lockfile |
| Forbidden import scan | mission imports for UI/economy/cargo/faction/world/navigation/interaction/suit/scheduler | PASS |
| Secret scan | staged candidate diff patterns | PASS |
| Whitespace | `git diff --check` | PASS |

The first sandboxed Vitest attempt was not a product failure: Vite could not spawn a child process under the restricted Windows token (`spawn EPERM`). The same focused command passed outside that token. Test-generated modifications to pre-existing evidence files were restored to `HEAD`; the deterministic mission proof itself remained unchanged.
