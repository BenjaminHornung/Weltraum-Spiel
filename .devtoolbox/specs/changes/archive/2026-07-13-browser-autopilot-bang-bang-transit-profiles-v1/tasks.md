# Tasks: Browser Autopilot Bang-Bang Transit Profiles v1

- [x] 1. Implement propulsion capability, occupant envelope, and transit policy contracts
  - Objective: create finite serializable abstractions and deterministic defaults that replace a global acceleration cap as final authority.
  - Files/search targets: `apps/weltraum-browser/src/core/types.ts`, `src/flight/state.ts`, new focused files under `src/flight/`, existing `AutopilotSpeedProfile*`, `FlightModelOptions`, `accelerationLimitForMass`, and ship factories.
  - Acceptance: required capability fields/fixtures exist; HumanCrew defaults are 1.0/0.8/1.5/1.5 g; DroneSprint is finite and physically bounded; Safe/Balanced/Fast resolve deterministically; Custom rejects non-finite values; current mass and main/braking thrust participate in limits.
  - Guidance: preserve legacy call sites with deterministic factory defaults; standard gravity is 9.80665; do not name engine technologies or use `Infinity`; retain compatibility clamps only as non-authoritative bounds.
  - Skills/MCPs: `subagent-driven-development`, root `AGENTS.md`; no Unity MCP/editor.
  - Verification: `npm run test -- tests/unit/autopilotTransitPolicies.test.ts tests/unit/autopilotCrewAcceleration.test.ts` from `apps/weltraum-browser`.
  - Report: changed files/symbols, fixture/policy table, tests run, blockers, residual model limits, unverified items.
  - Stop: halt if compatibility requires forbidden package/UI/render/Ship Builder/Assets edits or non-finite data.

- [x] 2. Lock and hash motion profiles with deterministic waypoint speed constraints
  - Objective: make all policy/motion constraints immutable route truth and enforce geometry/authority-aware waypoint velocities without route mutation.
  - Files/search targets: `src/core/types.ts`, `src/core/hash.ts`, `src/navigation/planners.ts`, `multiObstaclePlanner.ts`, `validation.ts`, optional `src/navigation/motionProfile.ts`, and allowed `tests/unit/autopilot*.test.ts`.
  - Acceptance: route contains requested/resolved policy, occupant/capability snapshot, alignment/flip/brake/jerk constraints and per-segment entry/exit/peak limits; full data changes hash; identical input is stable; direct routes stay uncapped unless policy/physics supplies a cap; sharp obstacle corners are slower and validated.
  - Guidance: use deterministic forward acceleration/backward braking passes; derive corner limits from turn angle, lateral/angular authority, clearance, and next braking; never mutate a locked plan or weaken validation.
  - Skills/MCPs: `subagent-driven-development`, root `AGENTS.md`; no Unity MCP/editor.
  - Verification: focused transit-policy/hash/obstacle unit tests plus `npm run test -- tests/unit/autopilotSpeedProfiles.test.ts`.
  - Report: changed files, locked schema/hash behavior, waypoint algorithm, tests, blockers, risks/unverified items.
  - Stop: halt if the design needs executor-side route mutation, silent replan, or forbidden files.

- [x] 3. Implement physical body-forward align/accelerate/flip/brake execution
  - Objective: make attitude causally control main thrust and execute jerk-limited acceleration policies through physical phases while preserving terminal capture/holding.
  - Files/search targets: `src/flight/flightController.ts`, `src/flight/executor.ts`, `src/flight/state.ts`, `src/core/types.ts`, `src/core/vector.ts` only if necessary, `tests/unit/autopilotBangBangExecutor.test.ts`, `tests/unit/executor.test.ts`.
  - Acceptance: main thrust uses actual +X forward; badly misaligned ships cannot use full thrust; flips rotate over multiple ticks; dynamic braking uses projected velocity, terminal velocity, remaining distance, braking acceleration, flip reserve, and margin; CrewSprint direct routes have negligible coast; no snap/zero/replan; terminal/station keeping remain controller-integrated; failures remain explicit.
  - Guidance: persist the required phase vocabulary; use live mass/capability without changing hash; cap angular acceleration/velocity; coast only for real locked constraints; preserve terminal distance/speed gates and locked plan ownership.
  - Skills/MCPs: `subagent-driven-development`, root `AGENTS.md`, systematic debugging if failures emerge; no Unity MCP/editor.
  - Verification: `npm run test -- tests/unit/autopilotBangBangExecutor.test.ts tests/unit/executor.test.ts`.
  - Report: changed files, phase/braking formula, physical thrust telemetry, tests, blockers, risks/unverified items.
  - Stop: halt rather than introduce world-space thrust bypass, midpoint hardcode, snap, silent replan, or terminal weakening.

- [x] 4. Add deterministic gravity/phase metrics, scenarios, Playwright evidence, and docs
  - Objective: expose core-truth metrics and produce all requested unit/E2E/evidence comparisons without UI dependency.
  - Files/search targets: `src/test-harness/**`, `src/world/autopilotProvingGroundCourses.ts`, required new/allowed existing unit tests, `tests/e2e/autopilot-bang-bang-transit.spec.ts`, allowed autopilot/multi-obstacle E2E files only if required, `evidence/browser-autopilot-bang-bang*`, `docs/physics-flight-model.md`, optional `docs/browser-mainline/**`.
  - Acceptance: all requested metrics and 22 unit scenarios exist; required 500/1000/2500, drone, underpowered, and Economy runs are deterministic; new JSON/Markdown/timelines compare immutable old 2500 m numbers and label ideal kinematics; TestBridge remains `?testBridge=1` only; no renderer/UI becomes truth.
  - Guidance: accumulate from executor/actuator telemetry at fixed 30 Hz; do not fake g in coast/flip/capture/holding; document impulse-based fuel/thermal limits and abstract Ship Builder boundary.
  - Skills/MCPs: `subagent-driven-development`, `playwright` only for e2e evidence, root `AGENTS.md`; no Unity MCP/editor.
  - Verification: focused three new unit files, existing course/profile/scenario tests, JSON parse, and `npm run test:e2e -- tests/e2e/autopilot-bang-bang-transit.spec.ts`.
  - Report: changed files, metrics/timelines, old/new comparisons, browser evidence, tests, blockers, risks/unverified items.
  - Stop: halt if evidence requires default TestBridge exposure, UI/render changes, synthetic metrics, or forbidden paths.

- [x] 5. Complete high-risk dual review and resolve findings
  - Objective: independently verify spec compliance, correctness, reuse, maintainability, and regression safety.
  - Files/search targets: complete `main...feature/browser-autopilot-bang-bang-transit-profiles-v1` diff and nearby shared helpers/tests.
  - Acceptance: reviewer and reviewer-glm return finding-first reports; no unresolved high/medium correctness issue involving thrust direction, hash mutation/omission, human caps, waypoint clearance, fail-closed behavior, terminal gates, determinism, Economy claims, or scope.
  - Guidance: use `devtoolbox-review` and bounded maintainability-decay review; fixes return to the owning implementation lane and focused review is rerun.
  - Skills/MCPs: `devtoolbox-review`, `requesting-code-review`, `maintainability-decay-review`.
  - Verification: focused tests for every concrete fix; record only material findings/results.
  - Report: findings by severity with file references, reuse/maintainability verdicts, fixes, remaining risks.
  - Stop: do not advance with unresolved high-severity findings.

- [x] 6. Run full fresh verification and forbidden-scope guards
  - Objective: prove the complete Browser change is ready without touching the parallel UI checkout.
  - Files/search targets: all changed files, new evidence JSON, requested unit/E2E specs, original checkout status hash.
  - Acceptance: every user-requested test/build/E2E command passes; JSON parses; `git diff --check` passes; no package, `Assets/**`, UI/render/resources/Ship Builder/index/style, or other forbidden path changed; original dirty checkout status hash remains `9a2cc92d7cb102c9bdaf0f85c323cad4cfb8989b` unless the external UI agent independently changed it.
  - Guidance: use `test-runner` for unit/build and serialized `browser-debugger` for real browser/E2E; do not commit/push yet; distinguish unrelated external checkout changes from this worktree.
  - Skills/MCPs: `verification-before-completion`, `playwright`, `devtoolbox-specs-execution`.
  - Verification: run the exact command matrix from the approved plan, parse JSON with Node, run guard checks and `git diff --check`.
  - Report: command-by-command result, evidence paths, guard result, blockers, all skipped/unverified items.
  - Stop: keep task open and report any failure; no completion claim or task toggle without passing evidence or explicit user risk acceptance.