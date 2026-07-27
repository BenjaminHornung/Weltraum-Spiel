# Test Findings: Browser Voxel Representation Ladder V2

## Status

Implementation and the latest local technical verification are complete. The
linked DevToolbox completion preflight, final human review, updated publication
commit, and new exact-head CI/Codex-review round remain pending. PR #53 remains
open and unmerged as required.

## Baseline

- Base `origin/main`: `15f3550bd604856b25d40a7ac700ec4d5106b89e`
- Branch: `feature/browser-voxel-representation-ladder-v2`
- Worktree: isolated sibling worktree documented in `design.md`
- Duplicate branch/worktree/PR check: none at start

## Findings log

- The focused technical review found four medium fail-closed gaps: unbounded
  Authority work, unchecked proxy schemas/shapes at current-source ingress,
  unchecked prior band IDs, and noncanonical direct fallback child lists. All
  four were fixed at their owning boundaries; affected tests passed 20/20 and
  bounded re-review found no production regression. A final low test-isolation
  gap was fixed by independently exercising required-work and budget caps.
- The first full core E2E attempt ran its npm-spawned Playwright shim under the
  ambient Node 26 and was correctly rejected by an existing Node-22 assertion
  after 40 tests passed. Prepending the verified Node-22 binary directory fixed
  the runner without source/test changes; the focused trajectory reproduction
  and complete core rerun then passed.
- Full browser groups regenerated unrelated tracked evidence. Authorized cleanup
  restored those files and removed one untracked Hestia test-output directory;
  only the two intended ladder evidence artifacts remain changed/untracked.
- Exact-head Codex review on `743229678a7e6dac5aa77f0e3df66bdd93fa6092`
  identified stale checked-in gate evidence and three valid fail-closed gaps.
  Selection now owns atomic fallback resolution from the raw bounded group,
  contradictory eviction eligibility and unknown Authority region kinds reject,
  and all nested/top-level count caps preflight before entry traversal. Focused
  tests, full units, build, ladder E2E, and bounded re-review pass.
- Exact-head Codex review on `a6ad6cfc2e10d03d126bdad03be0ba815e852d5d`
  found that valid soft Adaptive requests were discarded and that malformed
  interaction budgets could return coordinate `NOT_READY` before validation.
  Selection now validates and defensively copies every Adaptive request,
  preserves soft requests, and promotes only hard reasons through the L4 pin
  factory. Interaction budget fields now validate before the missing-coordinate
  return. The focused 36-test set and bounded technical re-review pass.
- Bounded review also required exact indexed validation paths plus explicit
  defensive-copy and non-L4 hard-request promotion coverage. Optional path
  parameters preserve the existing standalone validator API while the canonical
  request boundary supplies indexed target/deadline paths. The added regressions
  pass and re-review found no correctness or maintainability regression.
- The original execution `1df0c32f9b164594b596278a52147746` became
  technically unusable when its persisted history JSON was left empty/malformed
  after a timed-out synchronous verification call. In accordance with the
  recovery exception, one replacement execution
  `a3d3d5d4c13c4c96a75c2424eba63d87` was created for the remaining verification
  and publication round; no per-task or per-review executions were created.

## Final matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Node 22 / npm ci | PASS | Node 22.23.1; 59 packages installed; audit found 0 vulnerabilities. |
| Focused representation units | PASS | Latest Adaptive/selection run: 2 files / 36 tests, including soft-request preservation, defensive-copy, hard-L4 promotion, exact validation paths, and pre-coordinate budget rejection. |
| Settings and Authority regressions | PASS | Settings: 36 tests; Adaptive/Structural regression set: 72 tests. |
| Full unit / production build | PASS | Latest Vitest: 141 files / 1,381 tests; TypeScript and Vite build passed. Existing npm-config and chunk-size warnings are non-blocking. |
| Focused E2E twice / byte identity | PASS | 1/1 twice, one worker, retries zero. SHA-256 JSON `38AA1A81BB35B02A131AB46FC079731651A540AF967CD84A947B8C5089BF1814`; Markdown `604BDC6D413FDD247E2AA4F79A6714870740922EA824DE62B61E9BB8342131A5`. |
| Core / live / UI E2E | PASS | Latest Node-22, one-worker, zero-retry runs: core 41/41, live 14/14, UI 12/12. |
| Static, scope, secret, lockfile scans | PASS | Inventory exact once in core; evidence parsed and volatile scan passed; diff/secret/import/nondeterminism/scope scans passed; no Unity, lockfile, workflow, or Playwright-config changes. Adaptive changes are limited to reusable validation paths; Structural source remains unchanged. |
| DevToolbox verification/preflight | PASS | Recovery execution `a3d3d5d4c13c4c96a75c2424eba63d87` operation `d9046704925b4f518f490dc1f1a678eb` completed 3 steps with 2 pass, 1 known-warning build, 0 fail, and 0 skip. Task 6.1 completion preflight `712e4c2e89784effb17c56944c3c1ee4` passed. Earlier operations `08b4eb9e2c1a4bb5968a9fa730052c30` and `1c43f5734ffe45c2855278433e290120` passed before the original execution became unreadable. |
| Technical review | PASS | The bounded re-review found the two latest Codex fixes and the path/copy/promotion follow-up clean, with no correctness, API, or R1-R6/T1-T6 maintainability regression. |
| Final Plannotator review | PENDING | The prior approval covered head `a6ad6cfc2e10d03d126bdad03be0ba815e852d5d`; the new code/doc/test patch requires a fresh final gate. |
| Exact-head CI and Codex review | PENDING | The updated patch is not committed or pushed yet. Comments `3660076342` and `3660304384` remain open until the fixed head is published and reviewed. |
