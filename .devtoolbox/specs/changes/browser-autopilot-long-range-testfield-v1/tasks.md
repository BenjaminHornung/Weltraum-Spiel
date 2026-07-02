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
