# Browser UI Input HUD Foundation v1 Evidence

Date: 2026-06-29

Branch/worktree: `feature/browser-ui-input-hud-foundation-v1` / `Weltraum-Browser-IFIWELTRAUM-000-hud-input-telemetry-v1`

## Scope

- Basic browser HUD renders a `StatusHudViewModel` from telemetry snapshots.
- HUD commands dispatch explicit runtime commands for engage/cancel instead of mutating simulation state.
- HUD exposes Playwright-visible selectors for Basic HUD, selected target, autopilot state, warning state, and TestBridge-hidden default state.
- TestBridge remains query-gated behind `?testBridge=1`.

## Verification

- `npm ci` — PASS (local dependency restore for this worktree).
- `npm run test -- tests/unit/statusHud.test.ts tests/unit/simulation.test.ts` — PASS, 10 tests.
- `npm run test` — PASS, 44 tests in 5 files.
- `npm run build` — PASS; Vite reports the existing >500 kB chunk warning.
- `npm run test:e2e` — FAIL only with known `browserType.launch: spawn UNKNOWN` for bundled Chromium.
- `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e` — PASS, 7 tests.
- `git status --short -- Assets` — PASS, no Assets changes.

## Artifacts

- `apps/weltraum-browser/evidence/debug-scene.png`
- `apps/weltraum-browser/evidence/debug-scene-mobile.png`
- `apps/weltraum-browser/evidence/telemetry.json`
- `apps/weltraum-browser/evidence/scenario-matrix.json`
