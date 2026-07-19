# Design: Browser First-Person Locomotion Sandbox V1

## Standalone route
Use prototype-local browser JavaScript modules: `index.html`, `style.css`, `main.js`, `scene.js`, `locomotion-model.js`, `course-model.js`, and local `playwright.config.ts`. Vite resolves the existing `three` dependency; production files remain untouched.

## Pure model
`locomotion-model.js` owns authoritative state and consumes normalized intents at a provisional fixed 1/60 s step. The render accumulator clamps frame contribution and exposes backlog. Bounds use radius, standing/crouched height, and foot position. Course queries expose support height/normal/slope/traction, blocking, step candidates, overhead clearance, and contacts. Use bounded micro-steps/sweeps, support/step/clearance resolution, and only project velocity components moving into explicit contact normals. Landing removes only downward vertical velocity. Reset is the only spawn snap and may initialize velocity.

## Analytic course
`course-model.js` owns one named constant catalog used for collision and rendering descriptors: flat start, 10°/20°/35°/50° ramps, passable and blocked stair rises, low tunnel, narrow platform, slippery patch, deterministic uneven rock/heightfield patch. This is a bounded proving-ground solver, not a general mesh collider.

## Fixtures
`Grounded`, `Heavy suit`, `Low gravity`, `Slippery`, and `Precision` are immutable provisional parameter fixtures. All movement, camera, and course numbers must be exported/collectable and labeled `UX fixture — not final balance` in UI/evidence/audit.

## Input and presentation
Keyboard and visible DOM press/hold/release controls update one normalized intent path. A narrowly namespaced test surface may reset, step, drive intents, read telemetry, and check finite state without bypassing the solver. Pointer lock requires explicit gesture; Escape only releases it. Yaw/pitch, Head Bob, and FOV Kick are presentation-only; reduced motion suppresses bob.

## Diagnostic UI
Keep the center view clear. Use flat edge-aligned instrumentation explicitly labeled `PROVING GROUND / DIAGNOSTIC`; no glass/blur, decorative gradients, icon soup, or excessive cards. Use stable `data-testid`, `aria-pressed`, `aria-live`, visible focus, and reduced-motion support.

## Browser Health
Counter order: uncaught page/runtime errors, console errors, failed requests, non-finite simulation samples. Both UI and evidence require `0/0/0/0`.

## Focused Playwright
The local config resolves repository E2E `testDir`, matches only `first-person-locomotion-sandbox.spec.ts`, uses `http://127.0.0.1:5223`, exact strict-port Vite command, `reuseExistingServer: false`, workers 1, retries 0, Chromium only, and locomotion-prefixed outputs/reports. It never loads root config or starts 5173. The spec derives the actual base URL and run label from Playwright `testInfo.project.use.baseURL`; only the exact prototype-local 5223 base URL enables approved-prefix screenshot capture and the after-all evidence gates/writes. Focused tests reset deterministically and generate only approved-prefix screenshots/JSON/Markdown.

## Repository E2E inventory assignment
Use the user-approved one-line package exception to append exactly `tests/e2e/first-person-locomotion-sandbox.spec.ts` to the existing `test:e2e:ui` script. This assigns the spec exactly once without changing aggregate `test:e2e`, the core/live groups, `package-lock.json`, root Playwright/Vite config, or the CI workflow. The focused config still starts only port 5223. Normal UI CI executes every test and behavioral assertion separately under the actual root base URL `http://127.0.0.1:5173`; its four canonical screenshot calls are disabled and its after-all returns before screenshot/evidence gates, directory creation, or JSON/Markdown writes. The focused run never starts both servers.

## Rejected alternatives and risks
Reject production `src/**`, root config changes, dual servers, added physics dependencies, Three.js collision truth, and pointer-lock-only automation. Verify nested HTML serving early. Constrain solver to named regions. Treat camera feel as visually reviewed. Verify owned process/port cleanup without terminating foreign processes.
