# Tasks: Browser Surface Lab Generation Input Atomicity V1

All tasks are sequential, independently checkable, and intentionally remain
unchecked. This handoff records the approved plan; it does not create a
DevToolbox execution or mutate test data. Work is limited to the approved
change artifacts during this documentation pass. Later product implementation
is limited to the controller and focused unit-test files named below.

## Phase 1 — Contract and implementation

- [x] **1.1 Implement atomic generation-input admission**
  - Files: `apps/weltraum-browser/src/surface-lab/surfaceLabController.ts`.
  - Acceptance: locally validate candidates; commit authoritative seed and
    resolution at successful admission; make pre-admission/setup failures
    synchronous-atomic; preserve existing lifecycle/error semantics and do not
    swallow errors. A defensive/test-only post-admission `ticket.result`
    rejection keeps the admitted seed/resolution authoritative and does not
    roll back admitted epochs/jobs.
  - Stop: stop without redesign if the existing contract supports neither
    the required admission boundary nor synchronous pre-admission/setup
    atomicity.

- [x] **1.2 Add focused atomicity and stability regression tests**
  - Files: `apps/weltraum-browser/tests/unit/surfaceLabController.test.ts`;
    two named existing evidence files only if strictly necessary.
  - Acceptance: cover stopped-pool `regenerate(newSeed)` and
     `setResolution(0.25)` rejection, Failed/Stopped replacement failure and
     post-failure immutability, valid seed and resolution commits, invalid input,
     pre-admission/setup synchronous exception, defensive/test-only
     post-admission `ticket.result` rejection, exact planning epoch `+1`,
     payload/extent/telemetry consistency, unchanged per-job enqueue-failure
     accounting and backend-initialization behavior, and existing stability
     contracts. Rejected-promise coverage SHALL not alter WorkerPool/public
     contracts. Assertions SHALL not be weakened.
    Assertions SHALL not be weakened.
  - Stop: stop if another product, configuration, package, lockfile, renderer,
    WorkerPool, visual, CI, or unrelated test path is required.

## Phase 2 — Full verification

- [x] **2.1 Run the approved Node 22 verification matrix**
  - From `apps/weltraum-browser`, run exactly:
    `npm ci`; `npx tsc -p tsconfig.json`;
    `npx vitest run tests/unit/surfaceLabController.test.ts --maxWorkers=1`;
    `npm run test`; `npm run build`; `npm run test:e2e:core`;
    `npm run test:e2e:live`; `npm run test:e2e:ui`; and
    `npm run test:e2e -- --workers=1 --retries=0`.
  - Acceptance: units/core/UI green; live `14/14`; E2E inventory `30/30`
    exactly once; Hestia `16/16`; queue/running `0/0`; same-seed hashes
    identical; changed-seed hashes different; browser health `0/0/0/0`;
    package/lockfiles unchanged; no unintended evidence drift; and
    `git diff --check`, scope scan, and secret scan pass.
  - Stop: do not claim completion on missing, conflicting, or non-fresh
    evidence.

## Phase 3 — Technical review and fixes

- [x] **3.1 Complete canonical and reviewer-GLM technical review**
  - Review the complete implementation diff with one canonical reviewer and
    reviewer-GLM, as explicitly required.
  - Acceptance: record findings first; fix only confirmed in-scope findings;
    no open correctness, atomicity, lifecycle, telemetry, regression, or scope
    finding remains.
  - Verification: rerun the affected focused checks and then fresh applicable
    verification from Phase 2.

## Phase 4 — Pre-publication scope check

- [x] **4.1 Perform pre-publication scope check**
  - Baseline: exact head
    `fde7cdc5d3c9ea67401a688663b83f5cb73acff3` on
    `feature/browser-hestia-microvoxel-surface-lab-v1`.
  - Acceptance: inspect status and diff at the exact intended head; confirm
    only approved product/test/evidence paths and this change are present,
    package/lockfiles are unchanged, no secrets or unintended evidence drift
    exist, and all required verification results are recorded.
  - Stop: stop on missing, conflicting, or out-of-scope evidence.

## Phase 5 — Final human gate

- [ ] **5.1 Run one final Plannotator human gate for the complete change**
  - Acceptance: the complete change is presented once after technical review,
    confirmed fixes, and fresh verification; handle any requested feedback by
    rerunning affected review and verification before repeating the gate.
  - Stop: do not report completion or authorize publication before the gate
    returns and all feedback is handled.

## Phase 6 — Normal commit and non-force push

- [ ] **6.1 Create the exact normal commit and push the same branch**
  - Commit subject: exactly `#WELTRAUM-000 Preserve Surface Lab generation
    inputs`.
  - Acceptance: commit only after the final human gate; use no amend, rebase,
    squash, or force operation; push non-force to the same branch.
  - Constraint: merge remains forbidden.

## Phase 7 — PR body publication

- [ ] **7.1 Publish the required PR body statements**
  - Acceptance: the PR body states local Live `14/14` with `workers=2`, CI
    `workers=1`, `Stability fixes complete`, `Generation Input Atomicity
    complete`, and `Visual Fidelity DEFERRED_KNOWN_FAILING`.

## Phase 8 — Individual evidence and thread resolution

- [ ] **8.1 Evidence and resolve Chunk Loading Failure**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

- [ ] **8.2 Evidence and resolve Aggregate Region Mesh Budget**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

- [ ] **8.3 Evidence and resolve Retained Snapshot Buffers**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

- [ ] **8.4 Evidence and resolve Pinned Cache Telemetry**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

- [ ] **8.5 Evidence and resolve Hestia Unit Timeout**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

- [ ] **8.6 Evidence and resolve Preserve Inputs**
  - Acceptance: provide individual evidence containing the fix SHA, path, and
    test, then resolve the thread.

## Phase 9 — Exact-head Codex review and checks

- [ ] **9.1 Request exact-head Codex review with the approved comment**
  - Comment must contain exactly these three lines:
    ```text
    @codex review
    Please review the exact current PR head <NEW_HEAD_SHA>.
    All prior P1/P2 findings and the generation-input atomicity issue have been addressed. Please perform a fresh exact-head review.
    ```
  - Acceptance: exact-head review has no P0/P1/P2 findings; all threads are
    resolved; checks are green; the PR is mergeable; the head is unchanged; and
    the tree is clean.
  - Constraint: do not merge.
