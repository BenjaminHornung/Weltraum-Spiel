# Tasks: Browser First-Person Locomotion Sandbox V1

## Phase 1 — Deterministic model
- [ ] 1. Implement pure locomotion and analytic course models.
  - **Objective:** Deterministic fixed-step movement and all required course collision/traction queries without Three.js/DOM ownership.
  - **Files/search targets:** `apps/weltraum-browser/prototypes/first-person-locomotion-sandbox-v1/locomotion-model.js`, `course-model.js`; read spec/design and `src/sim/` patterns only.
  - **Acceptance:** Bounds, walk/sprint/crouch/blocked stand/jump/grounded/gravity/slope/step/accel/decel/air-control/traction/contacts/reset/finite checks; complete named course; no arbitrary snaps or blanket zeroing.
  - **Guidance:** Named exported UX fixtures, normalized input, bounded sweeps/micro-steps, explicit support/clearance/contact queries and contact-normal projection.
  - **Skills/MCPs:** `subagent-driven-development`, project `AGENTS.md`; no Unity; orchestrator owns DevToolbox records.
  - **Verification/report:** Node import, deterministic repeated sequence and finite telemetry; report files/API/fixtures/checks/risks.
  - **Stop:** Before scene/UI/E2E; escalate dependency or out-of-scope need.

## Phase 2 — Route and experience
- [ ] 2. Implement standalone Three.js route, scene, input, camera and diagnostics.
  - **Objective:** Manually usable, visually inspectable course preserving model/render separation.
  - **Files/search targets:** Prototype-local `index.html`, `style.css`, `main.js`, `scene.js`, justified local helpers only.
  - **Acceptance:** All regions render; keyboard/pointer-lock/reset and visible controls share intents; five presets and Head Bob/FOV Kick work; required diagnostics/health/accessibility visible; effects presentation-only.
  - **Guidance:** Clear center, flat diagnostic UI, stable selectors, aria states/live status, focus/reduced motion; no glass/gradients/icon soup.
  - **Skills/MCPs:** `subagent-driven-development`, `uncodixfy`, project instructions; no Unity.
  - **Verification/report:** Static import/selector/API checks only; report contracts/fixtures/unverified browser items.
  - **Stop:** Before E2E/docs; escalate root config/src/package or model defects.

## Phase 3 — Focused E2E and evidence
- [ ] 3. Implement prototype-local port-5223 config, focused E2E, telemetry, and screenshot evidence generation.
  - **Objective:** Prove all required behavior through one isolated Chromium configuration and no 5173 server.
  - **Files/search targets:** Prototype-local `playwright.config.ts`, repository `tests/e2e/first-person-locomotion-sandbox.spec.ts`, approved-prefix evidence, and the user-approved one-line `apps/weltraum-browser/package.json` script exception only.
  - **Acceptance:** Exact config isolation; all 11 cases cover start, movement bands, crouch/stand, jump/land, slope, step, slippery, reset, finite state, Browser Health `0/0/0/0`; focused 5223 alone captures/gates four PNGs and writes JSON/Markdown with the actual base URL and run label; exact `tests/e2e/first-person-locomotion-sandbox.spec.ts` token assigned once through `test:e2e:ui` with aggregate `test:e2e` and core/live groups unchanged. Root 5173 executes all assertions without canonical screenshot capture, focused screenshot gates, or canonical evidence writes.
  - **Guidance:** Derive actual base URL and run mode from Playwright `testInfo.project.use.baseURL`; reset cases; same visible/normalized input path; health order page/console/request/nonfinite; no package-lock, root Playwright/Vite config, or CI workflow edits. Focused config starts only 5223; normal UI CI runs assertions separately under root 5173, never as a dual-server focused run.
  - **Skills/MCPs:** `playwright`, `subagent-driven-development`; no Unity.
  - **Verification/report:** Static config/list check only; full run reserved for test-runner; report selectors/tolerances/evidence/risks.
  - **Stop:** Escalate if 5223 isolation requires scope expansion.

## Phase 4 — Audit and review
- [ ] 4. Write design audit and complete spec/correctness/UI review with only concrete in-scope fixes.
  - **Objective:** Evidence isolation, solver discipline, diagnostic UX/accessibility, and fixture status.
  - **Files/search targets:** `docs/design-audits/first-person-locomotion-sandbox-v1.md` and all approved diff paths.
  - **Acceptance:** Audit covers scope/non-goals, architecture, collision assumptions, input/pointer lock, screenshot matrix, evidence, limitations, every UX fixture; severity-ordered findings fixed and focused review rerun.
  - **Guidance/skills:** `devtoolbox-review`, `requesting-code-review`, maintainability review where applicable, UI review lanes; no Unity.
  - **Verification/report:** Diff-path/static checks; findings/fixes/risks; full tests remain Task 5.
  - **Stop:** No opportunistic refactors or production paths.

## Phase 5 — Fresh verification
- [ ] 5. Run fresh supported tests/build/focused browser evidence, port/process/path checks, and verification review.
  - **Objective:** Sufficient fresh evidence for every acceptance criterion.
  - **Files/search targets:** Approved diff/evidence only; fixes return to owner.
  - **Acceptance:** If needed plan-approved `npm ci`, then `npm test`, `npm run build`, focused Playwright command; only sandbox spec and only port 5223 in that focused run; all 11 cases, four canonical screenshots and actual Browser Health `0/0/0/0` gate the 5223 evidence; the payload reports actual base URL and focused run label. Normal UI CI executes the same assertions separately under unchanged root port 5173 without canonical capture/writes or focused screenshot gates; 5173 remains untouched by the focused run; 5223 is free; no owned process remains; package token/inventory equivalence and exact diff scope; verification reviewer approves.
  - **Guidance/skills:** `verification-before-completion`, `playwright`, test-runner, verification-reviewer; visible commands, before/after ownership, no foreign process stops.
  - **Verification/report:** Exact commands/results/artifacts/health/ports/processes/diff/risks.
  - **Stop:** Do not complete on failure/unaccepted risk; no commit/push until user confirmation.
