# Tasks: Browser Live E2E Concurrency Stability V1

The completed evidence is recorded without changing task checkboxes. Unchecked
task boxes remain pending until completion preflight.

## Phase 0 — Handoff artifacts

- [x] 0.1 Create only the five artifacts in this change directory.
  - Acceptance: the existing uncommitted
    `browser-heavy-unit-test-stability-v1` directory is byte-for-byte
    untouched; no Playwright config or test is edited.
  - Stop: stop if any path outside this change directory must be written for
    this artifact handoff.

## Phase 1 — Baseline and sole implementation

- [x] 1.1 Record current head, Playwright config, 14-test live inventory,
  30/30 E2E assignment, package/lock state, and the final evidence state
  without mutation.
  - Acceptance: zero evidence status and staged/unstaged diffs empty after
    normalization are recorded; no evidence content is changed.
- [x] 1.2 Make the sole initial implementation edit in
  `apps/weltraum-browser/playwright.config.ts`:
  `workers: process.env.CI === "true" ? 1 : 2`.
  - Acceptance: `fullyParallel`, retries, timeouts, webServer, projects, and
    every Playwright test remain unchanged.
  - Forbidden: Hestia bootstrap wait, Playwright test edits, package/lock,
    evidence, product, or architecture changes.
- [x] 1.3 Review the diff and stop if any second implementation edit is needed.

## Phase 2 — Official live stability

- [x] 2.1 Run the official live E2E group three times with CI unset and no CLI
  workers override, exercising local config workers=2.
  - Acceptance: 14/14 each run, zero retries/skips, port 5173 free after each,
    Hestia 16/16, required hash contracts, and browser health 0/0/0/0.
- [x] 2.2 Record the combined matrix: Core, Live, UI, aggregate E2E, npm ci,
  TypeScript, unit, and build checks, plus the exact 30/30 assignment once.
  - Acceptance: no group suppression, no duplicate/unassigned specs, and no
    evidence or LFS mutation.
- [x] 2.3 Do not add a Hestia bootstrap wait. If workers=2 evidence exposes a
  reproducible bootstrap-only race, stop and request the approved contingency
  review before any scope expansion.

## Phase 3 — Integrity and review gates

- [x] 3.1 Verify package/lock integrity, zero evidence status, staged/unstaged
  empty diffs after normalization, and scope/diff checks.
- [x] 3.2 Run the separate technical reviewer and reviewer-GLM reviews.
  - Acceptance: findings are resolved or explicitly blocking; no speculative
    test/config redesign.
- [x] 3.3 Run completion preflight. Keep the separate P2 `Preserve inputs when
  generation cannot start` as a merge blocker.
- [x] 3.4 Run one combined human final gate for this change and handle any
  requested fix with fresh affected verification.

## Phase 4 — Authorized publication

- [ ] 4.1 After all gates pass, make the first of exactly two separately
  authorized commits.
- [ ] 4.2 After the first commit remains verified and publication is separately
  authorized, make the second commit and perform the approved publication
  update.
  - Stop: no commit, push, PR update, or merge while the P2 remains open or
    any required gate is not PASS.
