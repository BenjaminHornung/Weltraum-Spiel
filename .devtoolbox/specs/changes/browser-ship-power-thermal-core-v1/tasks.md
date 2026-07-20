# Tasks: Browser Ship Power/Thermal Core V1

## Execution Rules
- plan_status=approved; explicit_replan=false.
- Work only in the isolated feature worktree and only in prompt-allowlisted paths.
- Every task requires tasks_load, one execution_create, implementation handoff, execution_add_notes, verify_run or verify_re_run, completion preflight, and tasks_toggle after passing evidence.
- Use Node 22. Do not alter package.json, package-lock.json, main.ts, style.css, existing domains, agent-owned paths, .github, infra, or living-master-plan.
- Stop on unauthorized_path, scope drift, destructive operation need, ambiguous product balance value, or non-reproducible verification failure; do not ask the user and do not bypass safeguards.

- [x] 1. Implement domain contracts, IDs, validation, canonical serialization, fixtures, and public barrel
  - Objective: establish the complete standalone API and fail-closed boundary before algorithms.
  - Files: apps/weltraum-browser/src/ship-power-thermal/ids.ts, types.ts, validation.ts, canonical.ts, fixtures.ts, index.ts; apps/weltraum-browser/tests/unit/shipPowerValidation.test.ts; foundational cases in shipPowerThermalDeterminism.test.ts.
  - Acceptance: all required definitions/states/results exist; units and ranges are explicit; stable ASCII IDs, duplicate/cross-reference/state matching, threshold ordering, finite math, positive tick step, invalid-request handling, defensive clone/freeze, canonical JSON/signature, -0 normalization, and unsupported-value rejection are tested. No existing domain file changes.
  - Guidance: use existing core/hash, Ship Builder, Combat, and Persistence code only as read-only pattern evidence; keep domain-owned contracts and exact-number canonicalization local.
  - Required skills/MCPs: subagent-driven-development, devtoolbox-specs-execution, verification-before-completion; DevToolbox lifecycle remains controller-owned.
  - Verification: from apps/weltraum-browser under Node 22 run npx tsc -p tsconfig.json, npm run test -- tests/unit/shipPowerValidation.test.ts, and the available focused determinism tests.
  - Report: changed files, public symbols, validation decisions, commands/results, remaining risk; no commit.
  - Stop: do not invent balance constants or edit outside the listed new-domain/unit-test paths.

- [x] 2. Implement deterministic source dispatch, priority allocation, and battery energy flow
  - Objective: provide isolated bus evaluation with ramping, one-pass allocation, reserve-aware discharge, charging, and loss heat.
  - Files: apps/weltraum-browser/src/ship-power-thermal/powerAllocation.ts, battery.ts, narrowly necessary changes to new-domain types/index/fixtures; tests/unit/shipPowerAllocation.test.ts and shipBattery.test.ts.
  - Acceptance: fixed priority order; stable source/battery/consumer ordering; proportional same-class shares and stable-ID remainder; Powered/Throttled/Shed/Unavailable/Rejected states; no consumer reallocation after shedding; multi-bus isolation; ramp limits; PreserveReserve; Critical-only emergency reserve; charge/discharge energy conservation and heat; no negative/non-finite energy; no simultaneous charge/discharge.
  - Guidance: maintain bus-side power semantics and calculate energy bounds using explicit deltaTimeSeconds and efficiency.
  - Required skills/MCPs: subagent-driven-development, devtoolbox-specs-execution, systematic-debugging if tests fail, verification-before-completion.
  - Verification: Node 22 npx tsc plus focused shipPowerAllocation and shipBattery tests.
  - Report: changed files, algorithm/order summary, exact tests/results, unresolved edge; no commit.
  - Stop: no second allocation pass, cross-bus transfer, integration import, or balance default.

- [x] 3. Implement thermal integration, cooling, protection, and canonical events
  - Objective: convert explicit/loss heat into bounded fixed-step thermal state and semantic outcomes.
  - Files: apps/weltraum-browser/src/ship-power-thermal/thermal.ts, protection.ts, events.ts, narrowly necessary new-domain contract exports; tests/unit/shipThermal.test.ts and shipPowerThermalEvents.test.ts.
  - Acceptance: exact temperature formula; cooling only above sink and scaled by allocated consumer power; Warning/Critical/Shutdown/Invalid; explicit boundary-attempt metadata; required actions/events; deterministic event IDs, phases, severities, payloads, and order; no UI strings or external mutation.
  - Guidance: consumer allocation is not implicit heat; only source/battery losses and explicit HeatSourceContribution feed nodes.
  - Required skills/MCPs: subagent-driven-development, devtoolbox-specs-execution, systematic-debugging if needed, verification-before-completion.
  - Verification: Node 22 npx tsc plus focused shipThermal and shipPowerThermalEvents tests.
  - Report: changed files, thermal/protection/event contracts, exact tests/results, remaining risk; no commit.
  - Stop: do not silently clamp, introduce ambient/product constants, or call external runtime components.

- [x] 4. Compose the immutable fixed-step pipeline and complete the required unit matrix
  - Objective: integrate Tasks 1-3 in the exact ten-stage step order and prove all 30 mandatory cases.
  - Files: apps/weltraum-browser/src/ship-power-thermal/step.ts plus narrowly necessary new-domain types/fixtures/index edits; tests/unit/shipPowerThermalStep.test.ts and shipPowerThermalDeterminism.test.ts; focused additions to the other five shipPower/shipThermal test files only when required.
  - Acceptance: immutable next state, one allocation round, source/battery/thermal/protection/event order, deterministic equal input signatures/events, insertion-order invariance, caller-input immutability, recursive result freeze, finite outputs, and static audits for no Three.js/mesh/scene/Date.now/Math.random.
  - Guidance: preserve canonical ordering at every accumulation boundary and fail before publishing an invalid next state.
  - Required skills/MCPs: subagent-driven-development, devtoolbox-specs-execution, systematic-debugging, verification-before-completion.
  - Verification: Node 22 npx tsc; all seven required unit files individually; npm run test.
  - Report: mandatory-case mapping to test names/files, exact results, changed files, residual risk; no commit.
  - Stop: no integration or opportunistic refactor outside the new domain and named tests.

- [x] 5. Add focused browser proof, evidence, and browser-mainline documentation
  - Objective: prove the pure core in a real normal-route browser without TestBridge or package-script changes.
  - Files: apps/weltraum-browser/tests/e2e/ship-power-thermal-core.spec.ts; evidence/browser-ship-power-thermal-core-v1-summary.json; evidence/browser-ship-power-thermal-core-v1.md; docs/browser-mainline/ship-power-thermal-core-v1.md; this change tests/test-protocol.md.
  - Acceptance: dynamic source import; reproducible fixture with generator, battery, Critical, Flight, Weapon/Mission, and Cooling; normal, reduced-source brownout/shedding/discharge, multi-step Warning/Critical, cooling recovery, duplicate-run canonical equality; empty console/page/request/HTTP failures; no screenshot; no E2E group change.
  - Guidance: follow existing pure-core E2E/evidence patterns and existing Playwright webServer; exclude only an already documented unavoidable favicon response if the repository baseline requires it and record it explicitly.
  - Required skills/MCPs: subagent-driven-development, playwright, verification-before-completion; browser-debugger only for evidence/debugging, not implementation.
  - Verification: Node 22 npm run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts.
  - Report: scenario stages, canonical comparison, browser-health arrays, evidence paths, exact command/result; no commit.
  - Stop: do not modify package files, TestBridge, app startup, UI, screenshots, or E2E grouping.

- [x] 6. Review, run the complete Node 22 regression/scope audit, commit, and push
  - Objective: obtain independent correctness review, repair concrete findings, prove the complete requested matrix, and publish only the feature branch.
  - Files/search targets: all change-owned paths; compare against 5ff47aeef3c42c0b933e8480dafa5680759a40df; no new write scope except focused fixes/evidence/test protocol.
  - Acceptance: dual review has no unresolved blocking findings; npm ci leaves package manifests unchanged; tsc, seven focused unit files, focused E2E, full unit, build, full E2E, git diff --check, DevToolbox validation/verify/completion preflight, and allowlist/forbidden-import audit pass. One commit exactly titled #WELTRAUM-000 Add ship power and thermal core is pushed non-force to origin/feature/browser-ship-power-thermal-core-v1. No PR or merge.
  - Guidance: inspect git status/diff/log before staging; stage only allowlisted files; never touch another worktree; record any environment limitation rather than weakening assertions.
  - Required skills/MCPs: requesting-code-review, devtoolbox-review, maintainability-decay-review, verification-before-completion, ifi-commit-message, finishing-a-development-branch; reviewer and reviewer-glm, then test-runner.
  - Verification: exact command sequence from the approved plan plus remote branch/commit confirmation and scope audit.
  - Report: per-area summary, findings/fixes, every command/result, evidence, SHA/branch/commit/push, scope audit, known limits.
  - Stop: no force push, PR, merge, package change, skipped blocker, or unverified completion claim.
