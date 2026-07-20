# Tasks: Browser Heavy Unit Test Stability V1

## Phase 0 — Handoff artifacts

- [x] 0.1 Create only `proposal.md`, `design.md`, `specs/default/spec.md`,
  `tasks.md`, and `tests/test-protocol.md` under this change directory.
  - Acceptance: Markdown is internally consistent and records the completed
    implementation and evidence; this reconciliation writes no product,
    package, lockfile, configuration, or evidence path.
  - Stop: stop immediately if any additional path outside these five Markdown
    artifacts must be written for the handoff record.

## Scope boundary and staging guidance

- Base HEAD for the unit implementation and its unit evidence is
  `d65c9c0ff67df14e33d89af965b1749892e6d2cc`.
- The unit diagnostics, focused checks, official parallel attempts, and serial
  full-unit verification were run at that HEAD. The unit diff was reviewed
  before the separate Playwright/sibling change was present. The final
  combined E2E matrix was run with that separate live change present; it is
  integration evidence only and is not causal evidence for the unit fallback.
- The concurrent `apps/weltraum-browser/playwright.config.ts` change and the
  sibling `.devtoolbox/specs/changes/browser-live-e2e-concurrency-stability-v1/`
  change directory belong to that separate approved change. They are excluded
  from this change and from its commit; do not stage either path here.
- If staging is separately authorized later, stage only these exact paths:

  ```text
  git add -- apps/weltraum-browser/tests/unit/hestiaSeedDeterminism.test.ts apps/weltraum-browser/vite.config.ts .devtoolbox/specs/changes/browser-heavy-unit-test-stability-v1/proposal.md .devtoolbox/specs/changes/browser-heavy-unit-test-stability-v1/design.md .devtoolbox/specs/changes/browser-heavy-unit-test-stability-v1/tasks.md .devtoolbox/specs/changes/browser-heavy-unit-test-stability-v1/specs/default/spec.md .devtoolbox/specs/changes/browser-heavy-unit-test-stability-v1/tests/test-protocol.md
  ```

  This command contains exactly the two implementation paths and five handoff
  artifact paths. It excludes `apps/weltraum-browser/playwright.config.ts` and
  the sibling `browser-live-e2e-concurrency-stability-v1` directory. Do not
  use a directory-wide or repository-wide staging command.

## Phase 1 — Exact local implementation

- [x] 1.1 Record the exact current head, unit file/test/assertion inventory,
  package/lock status, E2E assignment inventory, and current `vite.config.ts`
  timeout/worker settings.
  - Files: read-only inventory; implementation target remains below.
  - Acceptance: baseline is reproducible and no source is changed during
    discovery.
- [x] 1.2 Add only the four approved local timeout options to
  `apps/weltraum-browser/tests/unit/hestiaSeedDeterminism.test.ts`:
  same canonical input 15,000 ms; changed root seed 10,000 ms; voxel-size
  separation 10,000 ms; seven-module boundary 10,000 ms.
  - Acceptance: each test body is byte-identical; helper, pinned-hash, and
    invalid-input controls remain unchanged.
  - Forbidden: global timeout/hook timeout, skip, retry, assertion, fixture,
    input, workload, product, package, lockfile, or Proving Ground timeout
    changes.
- [x] 1.3 Run the static declaration/body/scope review before any full suite.
  - Stop: revert/stop and replan if any approved declaration cannot be changed
    without changing its body or if another path is required.

## Phase 2 — Focused stability evidence

- [x] 2.1 Run the exact Hestia unit file five times under Node 22.
  - Acceptance: every run is 1 file / 7 tests / 22 assertions, with zero
    skips and zero retries; all four heavy declarations pass within their
    local budgets; helper, pinned hash, and invalid-input controls pass.
- [x] 2.2 Run the focused Proving Ground browser check three times without a
  higher local timeout.
  - Command and evidence: `tests/test-protocol.md`.
  - Acceptance: unchanged Proving Ground behavior and no browser errors.
- [x] 2.3 Run the joint Hestia + Proving Ground browser check three times.
  - Acceptance: Hestia equal/different hash contracts and Proving Ground
    behavior remain independent and pass together.

## Phase 3 — Official parallelism decision

- [x] 3.1 Run three official parallel full-unit-suite attempts after Phase 2.
  - Acceptance: classify every failure as functional, assertion, browser,
    package/environment, Hestia local budget, or exclusively parallelism-
    dependent CPU timeout.
- [x] 3.2 If at least one attempt is an exclusive
  parallelism-dependent CPU timeout after local budgets, with no assertion or
  product failure, the exact global `maxWorkers: 1` Vitest fallback is
  authorized. PASS/timeout/PASS qualifies. Rerun the affected evidence.
  - Stop: no fallback for any other failure class.

## Phase 4 — Exact-head verification matrix

- [x] 4.1 Run the full exact-head matrix: Node 22, clean package/lock
  installation/integrity, focused unit evidence, full unit suite, build, all
  three official E2E groups, aggregate E2E discovery, exact 30/30 assignment,
  Hestia 16/16 readiness, same/different hashes, browser 0/0/0/0, and
  `git diff --check`.
  - Acceptance: zero skips/retries; no package/lock drift; no unrelated diff.
- [x] 4.2 Run one independent technical review and resolve only confirmed
  in-scope findings.
- [x] 4.3 Run the final human review gate exactly once for the overall change;
  if feedback causes a fix, rerun affected review and verification.
- [x] 4.4 Run DevToolbox completion preflight before any task closure. The task
  checkboxes remain pending until that preflight completes. No NEW DevToolbox
  execution was created in the documentation pass; the handoff cites the
  existing execution IDs `b38fb50323d641da9a3538c723413f68` and
  `44f56900913a434588a94a8757c5dbc7`.

## Phase 5 — Separately authorized publication

- [ ] 5.1 After all gates pass and separate authorization is active, commit the
  approved change.
- [ ] 5.2 Push the approved branch and update/create the authorized PR.
  - Stop: no commit, push, PR update, or publication before Phase 4 approval.
