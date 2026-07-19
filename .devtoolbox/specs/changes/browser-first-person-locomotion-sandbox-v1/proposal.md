# Proposal: Browser First-Person Locomotion Sandbox V1

## Motivation
Walk, sprint, crouch, jump, gravity, traction, slope handling, step handling, and first-person camera feel need an early visual proving ground before any production first-person core is designed.

## Outcome
Provide a standalone Three.js route at `/prototypes/first-person-locomotion-sandbox-v1/` with deterministic manual and visible automated controls, diagnostics, provisional presets, and focused Playwright evidence on port 5223.

The shared E2E spec has two configuration-derived modes: root UI CI at its actual base URL `http://127.0.0.1:5173` executes every behavioral assertion without canonical focused evidence capture or writes, while only the prototype-local actual base URL `http://127.0.0.1:5223` captures, gates, and writes the approved canonical evidence.

## Scope
- Asset-free deterministic course: flat ground; 10°, 20°, 35°, 50° ramps; multiple stair heights; crouch tunnel; narrow platform; slippery patch; uneven rocks; clear start/reset.
- Pure fixed-step locomotion/course model separated from Three.js, DOM, and camera.
- Walk, sprint, crouch/blocked standing, jump/land, grounded/gravity, slope limit, step height, acceleration/deceleration, air control, traction.
- Keyboard, pointer lock, reset, and visible press/hold/release automation controls.
- Diagnostic layer, five provisional presets, Head Bob/FOV Kick toggles, Browser Health, telemetry, screenshots, and design audit.
- Prototype-local Playwright config starting only strict Vite port 5223 and matching only the sandbox spec.

## Write Boundary
Only `.devtoolbox/specs/changes/browser-first-person-locomotion-sandbox-v1/**`, `apps/weltraum-browser/prototypes/first-person-locomotion-sandbox-v1/**`, `apps/weltraum-browser/tests/e2e/first-person-locomotion-sandbox.spec.ts`, `apps/weltraum-browser/evidence/first-person-locomotion-sandbox-v1-*`, `docs/design-audits/first-person-locomotion-sandbox-v1.md`, and the user-approved one-line `apps/weltraum-browser/package.json` script exception may change. That exception only appends `tests/e2e/first-person-locomotion-sandbox.spec.ts` to `test:e2e:ui` so repository inventory assigns the spec exactly once. No `src/**`, package-lock, root Playwright/Vite config, CI workflow, Unity scene/asset/project-setting changes.

## Non-Goals
No production controller, gameplay HUD, final tuning, SurfaceLocalFrame replacement, terrain streaming, combat, cargo, economy, surface-world integration, external assets, or general-purpose physics integration. No aggregate `test:e2e`, core/live group, root Playwright/Vite config, CI workflow, or package-lock changes. The focused run remains port 5223 only; normal UI CI runs the same behavioral assertions separately under the unchanged root port-5173 configuration but must not capture, gate, write, or overwrite canonical `first-person-locomotion-sandbox-v1-*` evidence. No dual-server focused run and no PR/merge.

## Success
Focused Chromium at the configuration-derived actual base URL `http://127.0.0.1:5223` proves all 11 required cases, four screenshots, reset and finite state; Browser Health is `0/0/0/0`; evidence records the truthful actual base URL and focused run label; port 5223 is released and 5173 untouched. Root UI CI at actual base URL `http://127.0.0.1:5173` executes all assertions and returns from after-all without focused evidence writes or screenshot gates. All numerical tuning is reported as provisional UX fixtures.
