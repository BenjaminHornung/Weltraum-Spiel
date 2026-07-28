# Test Findings: Browser Voxel Representation Ladder V2

## Status

Implementation head `612eb313b757bec0010aeb8da264a1e306679cec` passed every
exact-head check and the prior hard-AABB thread was fixed and resolved, but its
Codex review opened a valid P2 missing-coordinate validation finding. The
failing regression, smallest boundary-order fix, fresh local verification, and
bounded technical re-review are complete. DevToolbox re-verification, a
replacement human review, and task 6.1 completion preflight passed; task 6.1 is
closed. Publication and another exact-head round remain pending. Task 6.2 is
open, and PR #53 remains open and unmerged as required.

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
- Exact-head CI, policy, dependency, and Codex-review checks passed on
  `575cbf510e0cd5bc6a171f0d2fc2fff94db5866e`, but Codex comment `3660650274`
  identified that side-effect-empty rejected decisions did not bind validated
  Authority, simulation, fallback, readiness, or eviction inputs. The focused
  regression first reproduced all seven variants with one identical hash, then
  passed 21/21 after rejection-only decision inputs gained canonical hashes of
  those normalized values. Accepted decision hashes and rejected publication
  fields remain unchanged.
- Focused technical review found that the first fix computed rejection-only
  hashes on accepted paths and that its initial regression did not directly
  exercise `NoReadyCandidate`, Authority region changes, or canonical input
  reordering. Hash construction now occurs only in the shared rejection branch.
  A dedicated regression covers both rejection codes, deadline and region
  changes, all five related normalized input categories, and order-invariant
  Authority/simulation/readiness inputs. The affected selection set passes
  22/22, the full suite passes 1,382 tests, the build and focused E2E pass, and
  bounded re-review reports no remaining correctness or R1-R6/T1-T6 finding.
- Final tracking head `f3a3cb812da3fba012966e09fccb997f4942a1d0` passed all five
  checks, but Codex comment `3662144209` identified that selection validated a
  hard AABB at its declared coarse target before mandatory L4 promotion. A
  32-quantum L4-aligned AABB declared at L2 reproduced the mismatch: selection
  failed 1/22 while the equivalent sphere path promoted successfully. Selection
  now validates the supplied level domain, validates hard requests against the
  shared normalized L4 target at its owning boundary, and continues to validate
  soft requests unchanged. Review then found that record access preceded the
  fail-closed boundary and that L4 ownership was duplicated. Validation now
  rejects accessor, custom-prototype, non-enumerable, and symbol-bearing request
  records before property access, and the interaction boundary exports the
  shared hard-Authority level. The focused selection suite passes 23/23 and
  bounded re-review reports no remaining correctness or R1-R6/T1-T6 finding.
- Implementation head `612eb313b757bec0010aeb8da264a1e306679cec` passed all five
  checks and comment `3662144209` was resolved, but Codex comment `3662974732`
  identified that missing Authority coordinates returned `NOT_READY` before
  validating request identity, hard reason, priority, and the coverage flag. A
  null-coordinate regression reproduced the issue with 23 passing / 1 failing
  selection tests. `resolveProxyInteraction` now validates and snapshots those
  fields before the readiness return and reuses the validated values downstream.
  Review found one remaining double-read of the coverage flag; the final fix
  snapshots both reason and coverage once, with changing-getter coverage. The
  selection suite passes 25/25 and bounded re-review reports no remaining
  correctness or R1-R6/T1-T6 finding.

## Final matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Node 22 / npm ci | PASS | Node 22.23.1; 59 packages installed; audit found 0 vulnerabilities. |
| Focused representation units | PASS | The missing-coordinate request-field regression failed with 23 passing / 1 failing test before the boundary fix. After review hardening, selection passes 25/25 and the final focused representation set passes 42/42. |
| Settings and Authority regressions | PASS | Settings: 37/37; Adaptive/Structural regression set: 72/72. |
| Full unit / production build | PASS | Final affected rerun: 141 files / 1,385 tests; TypeScript and Vite production build passed. Existing npm-config and chunk-size warnings remain non-blocking. |
| Focused E2E twice / byte identity | PASS | Final post-review run passed 1/1 twice with one worker and retries zero. SHA-256 JSON `38AA1A81BB35B02A131AB46FC079731651A540AF967CD84A947B8C5089BF1814`; Markdown `604BDC6D413FDD247E2AA4F79A6714870740922EA824DE62B61E9BB8342131A5`. |
| Core / live / UI E2E | PASS | Final fresh Node-22, one-worker, zero-retry runs after the missing-coordinate fix: core 41/41, live 14/14, UI 12/12. |
| Static, scope, secret, lockfile scans | PASS | Generated E2E evidence was restored after the passing matrix. Final three-file changed-path, diff, secret, inventory, evidence, forbidden-source, Unity, and lockfile scans passed; deterministic evidence hashes remain unchanged. |
| DevToolbox verification/preflight | PASS | Recovery execution `a3d3d5d4c13c4c96a75c2424eba63d87` remains authoritative and records the failing reproduction. Fresh re-verification operation `b16c0c17102b49999be28a3818bfb39f`, spec validation, and task 6.1 completion preflight passed. |
| Technical review | PASS | Review found a second read of the validated coverage flag. Reason and coverage are now snapshotted once, the regression covers changing getters, and bounded re-review reports no correctness, regression, or R1-R6/T1-T6 finding. |
| Final Plannotator review | PASS | Replacement human review approved the exact four-file patch based on `612eb313b757bec0010aeb8da264a1e306679cec`; source and review-mirror binary diffs matched hash `a252c5692f8ec629f90ce7660b5079b88d6b6b92`. |
| Exact-head CI and Codex review | PENDING | Head `612eb313b757bec0010aeb8da264a1e306679cec` passed all five checks and comment `3662144209` is resolved, but valid comment `3662974732` remains open until the fixed head is published and reviewed. |
