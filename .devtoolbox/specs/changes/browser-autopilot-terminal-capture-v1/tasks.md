# browser-autopilot-terminal-capture-v1 Tasks

## Task 1 — Spec and root-cause evidence

- [x] Create proposal/design/spec/tasks and initial evidence scaffold.
- [x] Document old overspeed cause: `terminalSpeed: 8` + `MatchTerminalSpeed` on `nav-alpha`/`nav-beta`.
- [x] Document old freeze cause: early `Arrived` return before FlightController integration.
- [x] Verify `git status --short -- Assets` remains clean.

## Task 2 — Stop-target semantics

- [x] Update `navigationAlpha` and `navigationBeta` to `StopWithinEnvelope` with terminal speed 0.5 m/s or lower.
- [x] Preserve explicit `NoStopRequired` behavior for separate no-stop/fly-through cases.
- [x] Add unit coverage proving 8 m/s no longer arrives for default stop targets.

## Task 3 — Executor phases and capture/holding controller

- [x] Add executor arrival phase telemetry.
- [x] Remove/replace early `Arrived => return ship` freeze path for locked plans.
- [x] Implement terminal capture/holding desired-acceleration controller through `applyFlightControllerStep()`.
- [x] Preserve stable locked `planHash`, no silent replan, no snap, no velocity-zero shortcut, idle/cancel drift.

## Task 4 — Telemetry and scenario matrix

- [x] Add rounded executor telemetry fields: arrival phase, terminal speed limit, current speed, speed error, radial/tangential speed, desired terminal velocity, capture/holding activity.
- [x] Update scenario runner/result shape only where useful for evidence.
- [x] Keep HUD and renderer as consumers of snapshots, not truth owners.

## Task 5 — Unit and E2E coverage

- [x] Add/update unit tests for stop arrival, capture deceleration, holding non-freeze, stable planHash, no snap, no waypoint velocity-zero, idle/cancel drift, fail-closed fuel/authority.
- [x] Add `apps/weltraum-browser/tests/e2e/autopilot-terminal-capture.spec.ts`.
- [x] E2E must prove final distance within radius, final speed within terminal speed, stable planHash, no exact target snap, no contradictory freeze, capture actuator activity, and `GLBLoaded` remains true.

## Task 6 — Evidence and docs

- [x] Create screenshots: `autopilot-terminal-brake.png`, `autopilot-terminal-capture.png`, `autopilot-terminal-hold.png`.
- [x] Create `autopilot-terminal-capture-telemetry.json`.
- [x] Update `browser-autopilot-terminal-capture-v1.md`, `port-roadmap.md`, and `known-unity-bug-traps.md`.

## Task 7 — Verification, review, commit

- [x] Run `npm ci`, `npm run test`, `npm run build`, `npm run test:e2e` from `apps/weltraum-browser`.
- [x] If bundled Chromium fails with known `spawn UNKNOWN`, rerun E2E with Chrome fallback.
- [x] Run `git status --short -- Assets` and `git diff --check` from repo root.
- [ ] Run `reviewer` and `reviewer-glm`; fix blocker/high/medium findings.
- [ ] Commit with `#WELTRAUM-000 Fix browser autopilot terminal capture` after gates pass.
