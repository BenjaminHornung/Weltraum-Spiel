# Tasks: Browser Flight HUD Polish v1

## Manual tracking note

DevToolbox MCP returned `unauthorized_path` for this repository and worktree. The user approved direct spec fallback. Treat this file plus `tests/execution-notes.md` as the manual execution record.

## Phase 1 - Implementation

- [x] Task 1: Polish player HUD presentation.
  - Objective: Upgrade the player-facing browser HUD hierarchy, grouping, state treatment, and readability while preserving existing flight truth and selectors.
  - Files: `apps/weltraum-browser/index.html`, `apps/weltraum-browser/src/ui/statusHud.ts`, `apps/weltraum-browser/src/style.css`; `apps/weltraum-browser/src/main.ts` only if wiring is truly needed.
  - Guidance: Keep `#flight-hud`, `#hud-top-strip`, `#hud-left-panel`, `#hud-right-panel`, `#hud-bottom-strip`, `.hud-center-safe-area`, `#debug-hud`, and current tested IDs. Add semantic wrappers/classes for compact panels, fuel/throttle meters, state badges, alert treatment, and lightweight center-safe chrome. Do not calculate route/fuel/ETA/authority truth in the renderer.
  - Required agent/skills: `frontend-worker`; require project `AGENTS.md`, `subagent-driven-development`, browser HUD spec, and UI constraints.
  - Acceptance: player HUD has clearer top status, ship systems, nav/autopilot/radar, alerts/action; debug remains separate/hidden; center safe area is protected; no raw TestBridge/failure code/completed hash clutter; no `Assets/**` changes.
  - Verification for task: focused unit tests and focused E2E after Task 2.
  - Report back: changed files, summary, invariants touched/not touched, tests run, blockers, risks.
  - Stopping rule: stop before changing flight-core/planner/executor/route truth or widening allowed file scope.

- [x] Task 2: Update HUD tests and evidence flow.
  - Objective: Add or update HUD unit/E2E coverage for the polished presentation and evidence screenshots.
  - Files: `apps/weltraum-browser/tests/unit/statusHud.test.ts`, `apps/weltraum-browser/tests/e2e/flight-ui-foundation.spec.ts` or a focused HUD polish spec, `apps/weltraum-browser/evidence/browser-flight-hud-polish-v1.md`, HUD evidence screenshots/logs.
  - Guidance: Preserve/extend tests for TestBridge default hidden, debug HUD hidden, center safe area, player-facing warning labels, completed route hash hidden, raw failure codes absent, primary action gating, normal/autopilot-active/holding screenshots.
  - Required agent/skills: `test-runner` for verification evidence; `browser-debugger` for browser screenshot evidence if needed.
  - Acceptance: HUD tests prove player/debug separation, state visibility, safe-area contract, and screenshot evidence; no autopilot/lifecycle/terminal/long-range tests weakened.
  - Verification: `npm run test`, `npm run build`, `npm run test:e2e -- tests/e2e/flight-ui-foundation.spec.ts`, and `npm run test:e2e` from `apps/weltraum-browser`.
  - Report back: exact commands/results, screenshots/evidence paths, unverified items.
  - Stopping rule: stop if dependencies or browser tooling are missing; do not weaken tests to pass.

## Phase 2 - Review and fixes

- [x] Task 3: UI/design review.
  - Objective: Validate visual hierarchy, concept alignment, center-safe layout, player/debug separation, and readability.
  - Required agent: `ui-designer`.
  - Acceptance: no blocking UI/design findings, or findings are converted into focused fixes.

- [x] Task 4: Correctness/regression review.
  - Objective: Validate correctness, invariants, regression risks, shared patterns, security/test gaps, and maintainability.
  - Required agents: `reviewer` and `reviewer-glm` in parallel.
  - Acceptance: no blocking findings, or findings are fixed and re-reviewed.

## Phase 3 - Completion

- [x] Task 5: Final verification and commit.
  - Objective: Run fresh verification, update evidence, commit the finished branch.
  - Required verification: `npm run test`; `npm run build`; focused HUD E2E; full `npm run test:e2e` unless blocked.
  - Commit format: `#WELTRAUM-000 Polish browser flight HUD`.
  - Acceptance: verification passes or blockers are explicitly documented and accepted; final report includes branch, commit SHA, changed files, screenshots, concepts used, tests, and remaining HUD gaps.
