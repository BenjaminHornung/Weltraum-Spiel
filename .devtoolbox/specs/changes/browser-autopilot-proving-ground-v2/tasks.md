# Browser Autopilot Proving Ground v2 Tasks

## 1. Worktree and spec scaffold

- [x] Create the spec/evidence scaffold for `browser-autopilot-proving-ground-v2`.
  - Files: `.devtoolbox/specs/changes/browser-autopilot-proving-ground-v2/proposal.md`, `design.md`, `tasks.md`, `specs/browser-autopilot-proving-ground/spec.md`, `apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md`.
  - Verification: `git status --short -- Assets` shows no output; `git status --short` shows only intended scaffold files.
  - Stopping rule: stop if any source/test/Unity file would need to change during scaffold authoring.

## 2. Course and profile model

- [x] Add an additive browser course catalog and `Safe`/`Balanced`/`Fast` profile model.
  - Files: browser app flight/proving-ground model files and colocated unit tests only.
  - Verification: targeted unit tests prove catalog IDs, profile defaults, and profile-to-non-terminal-speed/brake-margin semantics.
  - Stopping rule: stop if implementation requires `Assets/**`, Unity, render smoothing, jitter, VFX, nozzle, Cargo, Surface, or Economy changes.

## 3. Planner integration

- [x] Integrate catalog courses and speed profiles with the existing browser planner/executor flow.
  - Files: browser planner/runtime integration files and tests.
  - Verification: tests prove `terminalSpeed` and `StopWithinEnvelope` remain hard gates; no snap, velocity-zero shortcut, or silent replan is introduced; repeated equivalent inputs keep a stable deterministic `planHash`.
  - Stopping rule: stop if GLBLoaded/procedural fallback/TestBridge query gating or HUD snapshot/ViewModel consumer contracts would be broken.

## 4. Scenario metrics and classification

- [x] Add scenario metrics and classification output for catalog runs.
  - Files: browser diagnostics/metrics/classification files and tests.
  - Verification: tests prove obstacle clearance calculation, terminal capture classification, hard failure classification, and `KnownStress` classification for documented current planner limits.
  - Stopping rule: stop if metrics require changing planner internals beyond the approved additive integration.

## 5. E2E and evidence capture

- [x] Add browser E2E coverage and evidence generation for the proving ground catalog.
  - Files: browser Playwright/TestBridge tests and `apps/weltraum-browser/evidence/browser-autopilot-proving-ground-v2.md`.
  - Verification: E2E evidence records course ID, profile, classification, terminal envelope result, obstacle clearance, and `planHash` stability.
  - Stopping rule: stop if evidence requires Unity, manual-only validation, or un-gated browser runtime changes.

## 6. Documentation

- [x] Update relevant browser autopilot documentation with catalog/profile/classification semantics.
  - Files: existing browser autopilot docs and evidence markdown only.
  - Verification: docs state the non-goals and terminal capture invariants clearly.
  - Stopping rule: stop if documentation drifts into unrelated roadmap or Unity feature promises.

## 7. Verification

- [x] Run focused verification for the completed implementation.
  - Files: no source files expected unless verification exposes a defect that gets a new task/fix.
  - Verification: run the agreed browser unit/E2E commands plus `git status --short -- Assets`; record exact results in evidence.
  - Stopping rule: stop and report blockers if tests fail for reasons unrelated to the scoped implementation.

## 8. Review and commit

- [ ] Review the completed change and commit only after evidence is complete.
  - Files: review notes/evidence as needed.
  - Verification: review confirms scope, invariants, tests, evidence, and no `Assets/**` changes.
  - Stopping rule: do not commit, merge, push, or toggle tasks without completed verification evidence and approval-compatible status.

## Implementation Evidence Notes

- 2026-07-02: Browser-only implementation completed through task 7. No commit/merge/push performed because the bounded handoff explicitly forbids it.
- `npm ci`: passed in `apps/weltraum-browser` to install missing worktree dependencies.
- `npm run test`: passed, 9 files / 99 tests.
- Focused Playwright v2 spec with Chrome fallback passed, 2/2 tests, using a temporary port-5174 config because another worktree's Vite server already occupied 5173; temporary config was deleted after verification.
- Evidence refreshed under `apps/weltraum-browser/evidence/`: markdown summary, `autopilot-proving-ground-v2-summary.json`, and requested PNG screenshots.
