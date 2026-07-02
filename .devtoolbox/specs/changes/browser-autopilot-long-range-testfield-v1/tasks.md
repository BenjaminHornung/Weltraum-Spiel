# Tasks: Browser Autopilot Long-Range Testfield V1

- [x] **Catalog expansion**
  - Objective: expand the proving-ground course catalog toward a 20-25 course matrix with 500m/1000m/2500m coverage and explicit `KnownStress` / `ExpectedFail` markers.
  - Exact files/search targets: `apps/weltraum-browser/src/world/autopilotProvingGroundCourses.ts`.
  - Acceptance criteria: the catalog includes the required distance tiers, uses all three `SpeedProfile` values, and keeps existing baseline courses intact.
  - Implementation guidance: add courses additively; do not delete baseline cases; encode classification in the course metadata.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: later inspect the catalog shape and course count after implementation.
  - Report-back format: changed files, course-count summary, any newly added stress/fail labels.
  - Stopping rule: stop once the catalog addition is in place and the matrix target is met.

- [x] **Metrics / runner expansion**
  - Objective: expand `scenarioRunner` metrics so long-range observations can report terminal speed, `planHash`, silent replan avoidance, and stop-envelope checks.
  - Exact files/search targets: `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`; `apps/weltraum-browser/src/core/types.ts`.
  - Acceptance criteria: runner metrics surface the required fields without replacing the existing runner flow; `StopWithinEnvelope` can prove terminal speed `<= 0.5`.
  - Implementation guidance: extend the current metrics pipeline; keep renderer output non-authoritative; preserve plan-stability checks.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: later run the scenario runner against a representative long-range course set.
  - Report-back format: modified files, metric fields added, and any stress/fail visibility changes.
  - Stopping rule: stop after metrics are emitted and consumed end-to-end.

- [x] **Unit tests**
  - Objective: add focused tests for matrix coverage, classification handling, stable `planHash`, and terminal-speed constraints.
  - Exact files/search targets: new or updated tests adjacent to `apps/weltraum-browser/src/test-harness/` and `apps/weltraum-browser/src/world/`.
  - Acceptance criteria: tests assert the long-range matrix shape, do not treat `KnownStress`/`ExpectedFail` as pass, and cover `StopWithinEnvelope` terminal-speed behavior.
  - Implementation guidance: keep tests narrow; prefer targeted assertions over broad harness rewrites.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: run the focused test set for the new or updated unit coverage.
  - Report-back format: test names, assertions added, and pass/fail summary.
  - Stopping rule: stop once the new assertions are green.

- [x] **E2E / evidence**
  - Objective: capture browser evidence for the long-range testfield and distinguish pass, `KnownStress`, and `ExpectedFail` outcomes.
  - Exact files/search targets: scenario/evidence files under the later implementation path; current bootstrap remains in `.devtoolbox/specs/changes/browser-autopilot-long-range-testfield-v1/**` only.
  - Acceptance criteria: evidence shows the required distances/profiles, `TestBridge` is only active with `?testBridge=1`, and renderer output is treated as observation only.
  - Implementation guidance: do not add Unity; do not use `Assets/**`; keep evidence collection explicit and reproducible.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: later run the browser scenario and capture the evidence bundle.
  - Report-back format: scenario id, evidence paths, and any observed stress/fail labels.
  - Stopping rule: stop after evidence is captured and linked.

- [x] **Docs**
  - Objective: document the long-range testfield contract, matrix, and failure taxonomy for future implementation work.
  - Exact files/search targets: `proposal.md`, `design.md`, `specs/browser-autopilot-long-range-testfield/spec.md`, and any later implementation docs that reference the matrix.
  - Acceptance criteria: the docs clearly state the matrix size, real distances, speed profiles, stress/fail rules, and anti-snap / anti-silent-replan constraints.
  - Implementation guidance: keep documentation additive and aligned with the spec; do not change product docs outside this change folder during bootstrap.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: manual review of the markdown artifacts for completeness.
  - Report-back format: files updated and the specific requirements captured.
  - Stopping rule: stop when the change docs are complete and internally consistent.

- [x] **Review / verification / commit / push**
  - Objective: after implementation exists, verify the change end-to-end, review for correctness, and prepare a clean commit/push sequence.
  - Exact files/search targets: all files touched by the later implementation slice plus the evidence paths produced by verification.
  - Acceptance criteria: verification is green, review has no blockers, and the final Git state is clean enough for the project's normal handoff flow.
  - Implementation guidance: use the project’s standard review and completion gates; this bootstrap step does not perform the commit/push itself.
  - Required skills/MCPs: `subagent-driven-development`, `verification-before-completion`; no Unity; direct artifact fallback only.
  - Verification command/scenario: run the prescribed verification suite for the implemented slice before any handoff.
  - Report-back format: verification summary, review result, and Git status.
  - Stopping rule: stop once the implementation is verified and ready for handoff.

## Follow-up fixes

- [ ] **Fast 2500m terminal-speed buffer (profile-only stopped/escalated)**
  - Objective: make the accepted Fast 2500m pass less brittle by adding at least a 0.05 m/s buffer below the existing `StopWithinEnvelope` terminal gate.
  - Exact files/search targets: `apps/weltraum-browser/src/core/types.ts`, `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`, `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`, and regenerated `apps/weltraum-browser/evidence/*long-range*` artifacts.
  - Acceptance criteria: Safe, Balanced, and Fast 2500m direct-stop rows pass; Fast final speed is `<= 0.45` while Fast remains no slower than Balanced; plan hashes stay stable; no silent replan/failure/invalidation codes appear for Pass rows.
  - Implementation guidance: tune only the Fast speed profile first; do not weaken terminal gates or executor physics; no Unity or `Assets/**` changes.
  - Verification command/scenario: focused unit test, `tsc --noEmit`, focused long-range Playwright coverage in `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts` with Chrome fallback if bundled Chromium is broken, `git status --short -- Assets`, and `git diff --check`.
  - Report-back format: exact Safe/Balanced/Fast 2500m metrics, changed files, evidence paths, verification results, risks/unverified items.
  - Stopping rule: stop if a profile-only tune cannot satisfy `finalSpeed <= 0.45` while preserving Fast `<=` Balanced arrival time.
  - Status: stopped/escalated under manual execution `manual-fast-2500m-buffer-2026-07-02`; profile-only probing could not make first-arrival `finalSpeed <= 0.45` without losing the Fast-vs-Balanced arrival-time constraint, so this task remains intentionally incomplete.

- [x] **Fast 2500m settled holding evidence**
  - Objective: replace the brittle first-arrival buffer claim with explicit post-arrival holding evidence while preserving the existing first-`Arrived` runtime semantics and terminal-speed gate.
  - Exact files/search targets: `apps/weltraum-browser/src/test-harness/scenarioRunner.ts`, `apps/weltraum-browser/tests/unit/autopilotSpeedProfiles.test.ts`, `apps/weltraum-browser/tests/unit/autopilotCourseMetrics.test.ts`, `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`, and regenerated `apps/weltraum-browser/evidence/*long-range*` artifacts.
  - Acceptance criteria: Safe, Balanced, and Fast 2500m direct-stop rows pass at first arrival; `finalSpeed` remains the first-arrival terminal-speed metric and is `<= terminalSpeedLimit`; Fast emits `settledSpeed <= 0.45` after a bounded holding window; Fast remains no slower than Balanced at first arrival; plan hashes stay stable; no silent replan/failure/invalidation codes appear for Pass rows.
  - Implementation guidance: add settled evidence metrics only; do not weaken terminal gates, arrival checks, profile tuning, executor physics, Unity, or `Assets/**`.
  - Verification command/scenario: `npm run test -- --run tests/unit/autopilotSpeedProfiles.test.ts tests/unit/autopilotCourseMetrics.test.ts`, `npx tsc -p tsconfig.json --noEmit`, Chrome-fallback focused long-range Playwright coverage in `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-v2.spec.ts`, `git status --short -- Assets`, `git diff --check`, plus full `npm run test` and `npm run build` while time allowed.
  - Report-back format: exact Safe/Balanced/Fast 2500m first-arrival and settled metrics, changed files, evidence paths, verification results, risks/unverified items.
  - Stopping rule: stop if post-arrival stepping requires product/runtime executor changes or if Fast cannot reach `settledSpeed <= 0.45` within the bounded holding window.
