# Test Findings: Browser Voxel Representation Ladder V2

## Status

Published head `575cbf510e0cd5bc6a171f0d2fc2fff94db5866e` passed every
exact-head check, but its Codex review opened one valid P2 decision-identity
finding. The local regression and implementation fix are complete; the full
verification, technical re-review, spec validation, and DevToolbox
re-verification are complete, final human review approved the exact
implementation patch, and the task 6.1 completion preflight passed. The
updated publication commit and replacement exact-head round remain pending.
PR #53 remains open and unmerged as required.

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

## Final matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Node 22 / npm ci | PASS | Node 22.23.1; 59 packages installed; audit found 0 vulnerabilities. |
| Focused representation units | PASS | Descriptor 6/6, proxy 6/6, fallback 5/5, selection 22/22; the final combined Adaptive-contract/selection rerun passed 37/37. |
| Settings and Authority regressions | PASS | Settings: 37/37; Adaptive/Structural regression set: 72/72. |
| Full unit / production build | PASS | Final affected rerun: 141 files / 1,382 tests; TypeScript and Vite production build passed. Existing npm-config and chunk-size warnings remain non-blocking. |
| Focused E2E twice / byte identity | PASS | 1/1 twice before review and 1/1 after review fixes, one worker, retries zero. SHA-256 JSON `38AA1A81BB35B02A131AB46FC079731651A540AF967CD84A947B8C5089BF1814`; Markdown `604BDC6D413FDD247E2AA4F79A6714870740922EA824DE62B61E9BB8342131A5`. |
| Core / live / UI E2E | PASS | Fresh Node-22, one-worker, zero-retry runs after the decision-hash fix: core 41/41, live 14/14, UI 12/12. Full units/build/focused E2E were rerun after the review-only placement and test-coverage fixes. |
| Static, scope, secret, lockfile scans | PASS | E2E inventory exact once in core; evidence parsed and volatile-field scan passed; diff/secret/forbidden-source/changed-path scans passed. Only the two intended source/test files and this change's tracking files differ; no Unity, dependency, lockfile, workflow, Playwright-config, Adaptive, or Structural files changed. |
| DevToolbox verification/preflight | PASS | Recovery execution `a3d3d5d4c13c4c96a75c2424eba63d87` remains authoritative. Fresh async re-verification operation `015e12d095714783abd443f476eb1f70` succeeded with 2 pass, 1 known-warning build, and 0 fail; direct spec validation passed all six checks; task 6.1 completion preflight passed and the task was closed only after human approval. |
| Technical review | PASS | Initial review found accepted-path hashing overhead and incomplete regression coverage. Both were fixed; affected tests pass 22/22 and bounded re-review reports no remaining correctness, regression, API, performance, or R1-R6/T1-T6 finding. |
| Final Plannotator review | PASS | Human review approved stable patch ID `07386d1ea5e5eb407a031a11f5aa950d89203b18` through the clean in-project mirror; the mirror and implementation worktree patch IDs matched exactly before review, and the mirror was restored clean afterward. |
| Exact-head CI and Codex review | PENDING | Head `575cbf510e0cd5bc6a171f0d2fc2fff94db5866e` passed all checks. Comments `3660076342` and `3660304384` are resolved; valid comment `3660650274` remains open until the fixed head is published and reviewed. |
