# Three.js Core Port Spike Test Summary

Date: 2026-06-29

Analyzed commit: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`

Branch: `spike/threejs-core-port-v1`

Spike path: `spikes/threejs-core-port-v1`

## Final Command Results

All required commands were run from `spikes/threejs-core-port-v1`.

| Command | Status | Evidence |
| --- | --- | --- |
| `npm install` | Passed | Up to date, 59 packages audited, 0 vulnerabilities. npm printed non-fatal user config warnings for `always-auth` and `email`. |
| `npx playwright install chromium` | Passed | Exit code 0. RTK displayed `[RTK:PASSTHROUGH] playwright parser: All parsing tiers failed`, but the command completed successfully. |
| `npm run test` | Passed | Vitest `v4.1.9`: 3 test files passed, 6 tests passed, duration 304 ms. |
| `npm run build` | Passed | Vite build passed in 251 ms. Output JS chunk `index-zNlKb5Wp.js`: 537.71 kB minified, 135.84 kB gzip. Vite emitted a non-fatal chunk-size warning. |
| `npm run test:e2e` | Passed | Playwright Chromium: 2 tests passed in 4.8 s. Desktop and mobile debug scene tests both passed. |

## Unit Coverage

Vitest covers the pure TypeScript core:

- `tests/unit/planner.test.ts`
  - deterministic hashes for equal direct plans
  - obstacle blocking creates `Avoidance` plus `Terminal` segments
- `tests/unit/executor.test.ts`
  - executor moves the ship using a locked plan without replacing the hash
  - divergence sets `replanRequired` and keeps the original `planHash`
- `tests/unit/simulation.test.ts`
  - fixed-step `advance` and explicit `step` produce deterministic ticks and matching position
  - verifies two `1/60` bridge advances produce exactly one `1/30` tick via `FixedStepSimulationLoop.advance`

## Browser E2E Evidence

Playwright covers browser runtime behavior:

- `tests/e2e/debug-scene.spec.ts`
  - loads the Vite/Three.js scene
  - waits for `window.TestBridge`
  - steps simulation telemetry
  - verifies `planHash` shape and locked route segment count
  - forces a divergence through `TestBridge.disturbShip(0)`
  - verifies `replanRequired === true`
  - verifies the divergent telemetry still uses the original locked `planHash`
  - samples a Playwright canvas screenshot to prove the WebGL canvas is not blank
  - repeats a render check on a mobile-sized viewport

Generated evidence:

- `evidence/debug-scene.png`
  - 1280 x 720
  - 71,534 bytes
  - independent sample: 2,304 sampled pixels, 157 non-dark, 30 unique sampled colors
- `evidence/debug-scene-mobile.png`
  - 393 x 851
  - 34,782 bytes
  - independent sample: 860 sampled pixels, 77 non-dark, 31 unique sampled colors
- `evidence/telemetry.json`
  - `status`: `Diverged`
  - `planHash`: `4f3a1050`
  - `lockedPlan.planHash`: `4f3a1050`
  - `replanRequired`: `true`
  - `invalidationReasons`: [`OffLockedRoute`]
  - active segment after final run: `avoid-rock-a-0`
  - tick: `110`

## Notes

- Browser debug scene now calls `TestBridge.advance(elapsedSeconds)`, which delegates to `FixedStepSimulationLoop.advance`, instead of forcing at least one fixed tick per animation frame.
- E2E nonblank validation samples Playwright's rendered canvas screenshot (not `canvas.toDataURL()`), because WebGL backbuffer reads can appear dark/blank even when the canvas is rendering correctly.
