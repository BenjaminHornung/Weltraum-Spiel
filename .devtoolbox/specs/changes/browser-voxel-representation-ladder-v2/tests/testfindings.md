# Test Findings: Browser Voxel Representation Ladder V2

## Status

Published head `1f4bdf074ecb44a881c58fb7c8c6b6aebe62276a` fixed the prior
accessor-backed Authority-coordinate double-read. Its next exact-head review
opened four valid P2 findings: remaining interaction double-reads, missing
fallback-parent readiness/revision proof, and V1 concrete presets migrating to
High voxel defaults. All four now have failing-reproduction evidence, the
smallest owning-boundary fixes, focused/full unit and build evidence, and twice-
passing deterministic E2E evidence. Bounded technical review found and cleared
one remaining proxy-snapshot gap plus documentation/test-completeness gaps.
Replacement human review passed without feedback. Publication and another exact-
head round remain pending. Task 6.1 is closed, task 6.2 is open, and PR #53
remains open and unmerged as required.

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
- Implementation head `4e4c4989f3d1d0ec925c8618e47bf9018cb9524f` fixed comment
  `3662974732`, which was replied to and resolved, and passed its exact-head
  Codex review. Codex comment `3663344832` then identified that accessor-backed
  Authority coordinates were checked and copied through separate reads. A
  changing getter reproduced the raw `TypeError` with 24 passing / 1 failing
  selection tests. `resolveProxyInteraction` now snapshots coordinates once,
  branches on and copies that same value, and the regression asserts one read.
  Selection passes 25/25, the focused representation set passes 42/42, the full
  suite passes 1,385 tests, the build and focused E2E twice pass, deterministic
  hashes are unchanged, and bounded re-review reports no finding.
- Published head `1f4bdf074ecb44a881c58fb7c8c6b6aebe62276a` fixed comment
  `3663344832`, which was replied to and resolved. Its next exact-head review
  opened four valid P2 comments: `3663565990` and `3663565995` identified
  remaining accessor-backed work/budget, hard-reason, deadline, and region-kind
  double-reads; `3663565998` identified that incomplete fallback groups could
  select an unproven parent; and `3663566005` identified that V1 Low, Medium, and
  Ultra presets migrated to High voxel values and later normalized to Custom.
  The focused red run reproduced five failures with 32 passing tests.
  Interaction inputs are now snapshotted once, concrete V1 presets reuse their
  existing V2 preset values, and the fallback input contract now carries an
  optional exact parent record with identity, readiness, and revision evidence.
  Complete current children still win without a parent; incomplete children now
  require a Ready parent at the group revision or reject with typed
  `InvalidFallback` at `fallback/parent`. The affected tests pass 43/43, the
  focused representation/settings set passes 55/55, the full suite passes 1,390
  tests, the production build passes, and the focused E2E passes twice with
  unchanged deterministic hashes.
- Bounded technical review found that proxy-backed parent/readiness values could
  still change across the parser's repeated reads, the High migration case was
  absent from the parameter table, and the mainline migration text still
  described High defaults for every V1 preset. A focused Proxy regression failed
  with 19 passing / 1 failing test before the fix. The parser now snapshots the
  outer parent and all nested parent fields once; the regression asserts typed
  `InvalidFallback` plus one read, exact-shape regressions reject legacy/inexact
  records, all four concrete presets are parameterized, and documentation lists
  their exact mappings plus Custom defaults. The affected files pass 20/20, the
  final focused set passes 58/58, the full suite passes 1,393 tests, the build
  passes, and the focused E2E passes twice with unchanged hashes. Bounded
  re-review reports no correctness, regression, or R1-R6/T1-T6 finding.

## Final matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Node 22 / npm ci | PASS | Node 22.23.1; 59 packages installed; audit found 0 vulnerabilities. |
| Focused representation units | PASS | The four-comment red run failed five tests with 32 passing. Review's proxy regression then failed with 19 passing / 1 failing. The affected fallback/settings files pass 20/20 and the final focused representation/settings set passes 58/58. |
| Settings and Authority regressions | PASS | V1 Low/Medium/High/Ultra retain matching voxel preset values across load, unrelated update, save, and reload. Accessor/proxy-backed Authority fields are read once, and fallback parent readiness/revision rejects fail closed. |
| Full unit / production build | PASS | Final affected rerun: 141 files / 1,393 tests; TypeScript and Vite production build passed. Existing npm-config and chunk-size warnings remain non-blocking. |
| Focused E2E twice / byte identity | PASS | Current post-fix run passed 1/1 twice with one worker and retries zero. SHA-256 JSON `38AA1A81BB35B02A131AB46FC079731651A540AF967CD84A947B8C5089BF1814`; Markdown `604BDC6D413FDD247E2AA4F79A6714870740922EA824DE62B61E9BB8342131A5`. |
| Core / live / UI E2E | PASS | Final fresh Node-22, one-worker, zero-retry runs after the missing-coordinate fix: core 41/41, live 14/14, UI 12/12. |
| Static, scope, secret, lockfile scans | PASS | Final changed-path review, `git diff --check`, secret-like assignment, forbidden-source/nondeterminism, Unity-scope, and lockfile-scope scans pass. Deterministic evidence is unchanged. |
| DevToolbox verification/preflight | PASS | Recovery execution `a3d3d5d4c13c4c96a75c2424eba63d87` remains authoritative. Async verification operation `ebf9dd14e52d4732bdcab7e48e007e00` passed all three configured steps and spec validation passed. Its only generated comment is the known non-blocking npm-config/chunk-size build warnings. Task 6.2 completion preflight remains pending until exact-head publication checks pass. |
| Technical review | PASS | Initial review identified the proxy snapshot, High-table, and migration-documentation gaps. The Proxy regression reproduced the defect before the direct snapshot fix; bounded re-review found no actionable correctness, regression, or R1-R6/T1-T6 issue. |
| Final Plannotator review | PASS | Human review approved the replacement Git review mirror without feedback. All 13 relevant working files in the mirror matched the source worktree by Git blob hash at the gate. |
| Exact-head CI and Codex review | PENDING | Published head `1f4bdf074ecb44a881c58fb7c8c6b6aebe62276a` has four valid open threads. Publish the reviewed replacement head without force, then require all current-head checks clean and resolve only the fixed threads. |
