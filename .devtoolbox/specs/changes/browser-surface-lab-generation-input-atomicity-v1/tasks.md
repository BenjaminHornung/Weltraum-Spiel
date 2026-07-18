# Tasks: Browser Surface Lab Generation Input Atomicity V1

## Phase 1 — Contract implementation

- [x] 1.1 Implement only the controller-level candidate-input admission/commit boundary.
  - Files/search targets: existing `apps/weltraum-browser/src/surface-lab/surfaceLabController.ts` and its focused controller test only.
  - Acceptance: all eight scenarios in `specs/default/spec.md`; non-admitted starts are inert; candidates commit once after admission; synchronous exceptions and async rejections are observable; existing lifecycle/failure/artifact/hash/metric/cache/Presentation behavior is preserved.
  - Forbidden: WorkerPool or public contract changes; package/lock/stability/config changes; product files outside the named controller/test targets.

## Phase 2 — Fresh verification

- [x] 2.1 Run focused controller tests and strict TypeScript/build checks; report exit codes and Node version.
- [x] 2.2 Run the complete Node 22 matrix from `apps/weltraum-browser`:
  `npm ci`, `npx tsc -p tsconfig.json`, `npm run test`, `npm run build`, `npm run test:e2e:core`, `npm run test:e2e:live`, `npm run test:e2e:ui`, `npm run test:e2e`, `git diff --check`.
  - Do not change package/lock files; if `npm ci` would modify them, stop and report the blocker.

## Phase 3 — Review and handoff

- [x] 3.1 Obtain findings-first review from `reviewer` and `reviewer-GLM`; fix only confirmed in-scope findings and rerun affected verification.
- [x] 3.2 Run completion preflight. Confirm exactly the allowed files changed, no product/public-contract/WorkerPool/package/lock/stability changes, all eight scenarios and Node 22 results recorded, and no execution or test-data mutation occurred.
- [x] 3.3 Run exactly one final human review for this repository after all verification. Do not report completion until feedback is handled; if feedback causes fixes, rerun affected review/verification and the final human review.

## Authorized release handoff (record only; do not execute in this change)

- Normal commit message, only after explicit authorization: `#WELTRAUM-000 Preserve Surface Lab generation inputs`.
- Push only the normal branch with a non-force push.
- PR body must state scope, exact verification commands/results, reviewers, residual risk, and the explicit no-merge gate.
- Before publication, check PR thread comments and checks, verify the PR head SHA equals the reviewed local head, and stop on any mismatch or unresolved thread.
- Merge is explicitly forbidden by this contract; require separate user authorization.
