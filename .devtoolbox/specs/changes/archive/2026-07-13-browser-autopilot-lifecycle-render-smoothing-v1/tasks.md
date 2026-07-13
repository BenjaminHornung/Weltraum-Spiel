# Tasks

- [x] Split active route lock from completed Holding/station-keeping lifecycle.
  - Evidence: `apps/weltraum-browser/tests/unit/executor.test.ts`, `apps/weltraum-browser/tests/unit/simulation.test.ts`, `apps/weltraum-browser/tests/e2e/autopilot-lifecycle-render-smoothing.spec.ts`.
- [x] Gate target selection and Engage on telemetry `canSelectNewTarget` / `canAcceptNewPlan` instead of raw `lockedPlan` only.
  - Evidence: active route replacement remains blocked in unit/E2E tests; completed Holding accepts a new target and route.
- [x] Add fixed-step presentation interpolation without mutating simulation truth.
  - Evidence: `FixedStepSimulationLoop.getPresentationSnapshot()` unit coverage mutates returned snapshots and verifies truth is unchanged.
- [x] Use interpolated pose only for DebugScene ship visual and camera, with dt-corrected camera smoothing.
  - Evidence: render snapshot fields and `render-smoothing-sample.json` / `render-smoothing-chasecam.png`.
- [x] Update docs/evidence and run verification.
  - Evidence: `apps/weltraum-browser/evidence/browser-autopilot-lifecycle-render-smoothing-v1.md` and Chrome fallback E2E pass.

## Verification

- [x] `npm ci`
- [x] `npm run test` — 104/104 passed.
- [x] `npm run build` — passed with existing Vite chunk-size warning.
- [x] `npm run test:e2e` — default bundled Chromium failed with known `spawn UNKNOWN`.
- [x] Chrome fallback E2E — 13/13 passed using `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`.
- [x] `git status --short -- Assets` — clean / no output.
- [x] `git diff --check` — passed / no whitespace errors.

## Review-fix verification (2026-07-02)

- [x] Focused executor unit regression: `npm run test -- --run tests/unit/executor.test.ts` - 23/23 passed.
- [x] Focused Chrome fallback E2E: `npm run test:e2e -- tests/e2e/autopilot-lifecycle-render-smoothing.spec.ts --project=chromium` - 1/1 passed; evidence refreshed with rendered/camera frame-jump thresholds.
- [x] `npm run test` - 104/104 passed.
- [x] `npm run build` - passed with existing Vite chunk-size warning.
