# Test Findings: Browser Voxel Representation Ladder V2

## Status

Implementation, local technical verification, linked DevToolbox verification
and completion preflight, and final human review pass are complete. Follow-up
exact-head Codex fixes are locally verified; publication CI/review remains open
under 6.2.

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

## Final matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Node 22 / npm ci | PASS | Node 22.23.1; 59 packages installed; audit found 0 vulnerabilities. |
| Focused representation units | PASS | Four files run separately; 30 tests. Combined six-file ladder/settings run after final review fix: 46 tests. |
| Settings and Authority regressions | PASS | Settings: 36 tests; Adaptive/Structural regression set: 72 tests. |
| Full unit / production build | PASS | Final post-gate Vitest: 141 files / 1,378 tests; TypeScript and Vite build passed. Existing npm-config and chunk-size warnings are non-blocking. |
| Focused E2E twice / byte identity | PASS | 1/1 twice, one worker, retries zero. SHA-256 JSON `38AA1A81BB35B02A131AB46FC079731651A540AF967CD84A947B8C5089BF1814`; Markdown `604BDC6D413FDD247E2AA4F79A6714870740922EA824DE62B61E9BB8342131A5`. |
| Core / live / UI E2E | PASS | Node-22 reruns: core 41/41, live 14/14, UI 12/12. |
| Static, scope, secret, lockfile scans | PASS | Inventory exact once in core; evidence parsed and volatile scan passed; diff/secret/import/nondeterminism/scope scans passed; no Unity, lockfile, workflow, Playwright-config, Adaptive source, or Structural source changes. |
| DevToolbox verification/preflight | PASS | Operation `08b4eb9e2c1a4bb5968a9fa730052c30`: Specs/Test passed and Build passed with known warnings; completion preflight `45081271397d4e5e92154c396aba3735` passed. Fresh Build rerun operation `1c43f5734ffe45c2855278433e290120` also passed with only the same known warnings. |
| Technical review | PASS | Earlier findings were fixed; the bounded follow-up review confirmed all three runtime Codex findings and fallback cap ordering resolved with no remaining actionable finding. |
| Final Plannotator review | PASS | The approved exact full patch was mirrored into a temporary in-workspace review worktree because the gate rejects sibling paths. Source and mirror matched stable patch ID `edd58a7a0b0d4602c420ab35aab87918d489d7a8`; the human gate approved without feedback, the mirror was removed, and post-gate unit/build/E2E/hash checks passed on the unchanged source patch. |
| Exact-head CI and Codex review | PENDING | PR #53 remains open; current-head publication rerun belongs to task 6.2. |
