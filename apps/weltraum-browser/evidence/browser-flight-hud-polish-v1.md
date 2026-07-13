# Browser Flight HUD Polish v1 - Verification Evidence

Date: 2026-07-03
Execution: manual-exec-005
Scope: Task 2 HUD verification rerun after safe-area CSS box-sizing fix.

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; retained reusable art is under `art/`.

## Commands

From `apps/weltraum-browser`:

1. `npm run test` - PASS
   - Vitest: 12 files passed, 120 tests passed.
2. `npm run build` - PASS
   - `tsc -p tsconfig.json && vite build` completed.
   - Existing Vite chunk-size warning remained.
3. `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts` - initial bundled Chromium launch BLOCKED
   - Playwright bundled `chrome-headless-shell.exe` failed with `browserType.launch: spawn UNKNOWN`.
   - Error artifacts refreshed under `evidence/playwright-output/flight-ui-foundation-*/`.
4. `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts` - PASS
   - 2/2 Playwright tests passed.
   - Confirms default `/` player HUD hides TestBridge/debug text and HUD center-safe-area contract passes after the box-sizing fix.
5. `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e` - PASS
   - 16/16 Playwright tests passed.

## Refreshed screenshots and evidence

Key HUD screenshots refreshed by the focused/full E2E run:

- `evidence/flight-ui-foundation-1280x720.png`
- `evidence/flight-ui-autopilot-active-1280x720.png`
- `evidence/flight-ui-fuel-warning-1280x720.png`
- `evidence/flight-ui-760x640.png`
- `evidence/flight-ui-1024x768.png`
- `evidence/flight-ui-1440x900.png`
- `evidence/flight-ui-ultrawide-1920x800.png`
- `evidence/browser-flight-ui-foundation-v1.md`
- `evidence/playwright-report/index.html`
- `evidence/playwright-output/.last-run.json`

Full-suite evidence also refreshed autopilot/debug-scene screenshots and JSON summaries under `evidence/`.

## Verification notes

- Default `/` remains free of TestBridge/debug text per the passing focused E2E test.
- `#debug-hud` remains hidden by default per the passing focused E2E test.
- No autopilot, lifecycle, planHash, terminal, or TestBridge E2E tests were weakened in this verification; the full suite passed with those coverage areas included.
- Verification did not edit `Assets/**`.
- Playwright's bundled Chromium remains blocked by `spawn UNKNOWN`; Chrome fallback is required on this machine.

---

## Final verification rerun - manual-exec-009

Date: 2026-07-03
Scope: Task 5 final verification after responsive runtime-message fix and GLM review.

Commands from `apps/weltraum-browser`:

1. `npm run test` - PASS
   - Vitest: 12 files passed, 120 tests passed.
2. `npm run build` - PASS
   - `tsc -p tsconfig.json && vite build` completed.
   - Existing Vite chunk-size warning remained.
3. `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts` - PASS after one bounded environment retry
   - Initial attempt was blocked because port 5173 was already held by an unrelated `Weltraum-Threejs-Mainline-Transition-v1` Vite node process.
   - After stopping that unrelated port holder, focused HUD E2E passed: 2/2 tests.
4. `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e` - PASS
   - Full Playwright E2E passed: 16/16 tests.

Confirmations:

- Default `/` hides TestBridge/debug text.
- `#debug-hud` remains hidden by default.
- Full E2E after the runtime-message fix passed with Chrome fallback.
- `git status --short -- Assets` reported no `Assets/**` changes.
- Refreshed evidence includes HUD screenshots, `evidence/browser-flight-ui-foundation-v1.md`, full-suite screenshots/JSON summaries, `evidence/playwright-report/index.html`, and `evidence/playwright-output/.last-run.json`.
