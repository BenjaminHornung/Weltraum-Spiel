# Manual Execution Log

- Manual execution id: `manual-browser-autopilot-long-range-testfield-v1-001`
- Plan status: approved
- DevToolbox MCP fallback reason: `unauthorized_path` for this repo path
- Worktree path: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-autopilot-long-range-testfield-v1`
- Worktree branch: `feature/browser-autopilot-long-range-testfield-v1`
- Base branch: `main` at `5a42d6ff5de9224abba0f40277ebb612caa07d1a`
- Current task: spec/task bootstrap only
- Product changes: none yet

## 2026-07-02 catalog/runner/unit fallback implementation

- Expanded the browser autopilot proving-ground catalog to 35 courses, including the requested long-range distance, obstacle, authority/fuel, disturbance, and speed-profile rows.
- Extended deterministic course-runner metrics with simulated seconds, average speed, fuel reserve remaining, completed plan hash, route lifecycle, terminal-capture/holding tick counts, and holding/station-keeping booleans.
- Focused browser unit verification passed: `cmd /c npm run test -- --run tests/unit/provingGroundScenarios.test.ts tests/unit/autopilotProvingGroundCourses.test.ts tests/unit/autopilotSpeedProfiles.test.ts tests/unit/autopilotCourseMetrics.test.ts` (4 files, 26 tests).

## 2026-07-02 review, fixes, and full verification

- Added long-range E2E/evidence generation and browser-mainline docs.
- Dual review found no high/critical blockers; medium findings for derived evidence distances and 2500m profile coverage were fixed and re-reviewed cleanly.
- Fixed full-suite unit blocker in `simulation.test.ts` after catalog expansion.
- Full verification passed: `npm ci`, `npm run test` (12 files, 118 tests), `npm run build`, `npm run test:e2e` with Chrome fallback (15/15), `git status --short -- Assets` clean, and `git diff --check` clean.
- Bundled Chromium still fails with known `browserType.launch: spawn UNKNOWN`; Chrome fallback path used: `C:\Program Files\Google\Chrome\Application\chrome.exe`.

## 2026-07-02 E2E/evidence/docs fallback implementation

- Added the browser long-range Playwright evidence spec to write the required JSON, Markdown and representative screenshot file names through the gated TestBridge while preserving GLBLoaded/default-hidden checks.
- Updated the existing v2 Playwright catalog assertion so it accepts the expanded catalog while still requiring baseline and long-range course IDs.
- Updated browser-mainline docs with the 35-course long-range testfield, current one-blocking-obstacle planner limit, evidence artifact paths and no-snap/no-zero/no-silent-replan/stable-planHash guardrails.
- Verification passed: `cmd /c npx tsc -p tsconfig.json --noEmit` from `apps/weltraum-browser`.
- Focused browser E2E passed with Chrome fallback on free port 5173: `npx playwright test tests/e2e/autopilot-proving-ground-long-range.spec.ts --project=chromium` (2/2 tests).

## 2026-07-02 16:56 +02:00 Task 1 bookkeeping/checks

- Manual execution id: `manual-browser-autopilot-long-range-testfield-v1-task-1`.
- DevToolbox MCP was unavailable for this Temp worktree because of `unauthorized_path`.
- WIP was preserved with a named stash including untracked files, then restored with `git stash pop`.
- Branch update verified as `5a42d6f -> d06c2b1`; `HEAD` is currently aligned with `origin/main`.
- Post-pop worktree still contains the expected tracked/untracked WIP files; no unmerged/conflict files are present.
- Remaining next task: catalog/runner/test/evidence completion.

## 2026-07-02 review-finding fixes

- Added deterministic `targetDistance` course-runner metric and changed long-range E2E evidence to derive `distanceMeters` from runtime results instead of request literals.
- Added 2500m Safe/Balanced/Fast direct-tier unit coverage; all three profiles classify as `Pass` with terminal speed under the StopWithinEnvelope limit.
- Made Pass classification explicit from hard/acceptance violation lists and tightened unit assertions for 500m/1000m/2500m anchor course geometry.
- Focused verification passed: unit tests for long-range catalog/profile/metrics, `npx tsc -p tsconfig.json --noEmit`, and Chrome-fallback long-range Playwright E2E (2/2 tests).

## 2026-07-02 Task 3 core completion pass

- Manual execution id: `manual-browser-autopilot-long-range-testfield-v1-task-3-core`.
- Audited and completed the existing WIP rather than replacing it. The catalog remains additive at 35 browser-native courses and now exposes derived catalog metadata for category, distance metres, and default evidence speed profile.
- Tightened `KnownStress` classification so it may only tolerate route-quality planner-limit notes. Stable plan hash, no unexpected `replanRequired`, arrival, final-distance, terminal-speed, finite metrics, and fuel gates remain hard failures.
- Folded the useful long-range E2E/evidence flow into the allowed `tests/e2e/autopilot-proving-ground-v2.spec.ts` and removed the untracked `autopilot-proving-ground-long-range.spec.ts` after subsuming it.
- Kept TestBridge query-gated (`?testBridge=1`) and preserved Demo Scout GLB assertions in the E2E spec. No Unity/Assets/package changes were made.
- Verification passed from `apps/weltraum-browser`: `npm run test -- tests/unit/provingGroundScenarios.test.ts` (19 tests), `npm run test -- tests/unit/autopilotProvingGroundCourses.test.ts tests/unit/autopilotSpeedProfiles.test.ts tests/unit/autopilotCourseMetrics.test.ts` (10 tests), and `tsc -p tsconfig.json --noEmit`.
- Verification passed from repo root: JSON parse check for `apps/weltraum-browser/evidence/autopilot-long-range-summary.json` and `apps/weltraum-browser/evidence/autopilot-long-range-speed-profile-summary.json`.
- E2E was not rerun in this task; existing long-range evidence JSON/Markdown was kept parseable and the merged v2 E2E spec will regenerate the required evidence artifacts during final browser verification.

## 2026-07-02 scope cleanup before review

- Manual execution id: `manual-browser-autopilot-long-range-testfield-v1-scope-cleanup`.
- Preserved out-of-scope tracked evidence churn in stash `stash@{0}` named `manual-browser-autopilot-long-range-testfield-v1 out-of-scope evidence churn` instead of discarding it.
- Stashed only unrelated tracked files under `apps/weltraum-browser/evidence/`; kept required long-range evidence files and `apps/weltraum-browser/evidence/scenario-matrix.json` in the worktree.
- Verification after cleanup: `git status --short --branch` still shows the intended source/test/docs/spec/evidence WIP; `git diff --name-only -- apps/weltraum-browser/evidence` no longer shows unrelated evidence churn; no commit, push, Unity, or `Assets/**` changes were made.

## 2026-07-02 E2E file layout correction

- Manual execution id: `manual-browser-autopilot-long-range-testfield-v1-001`.
- Moved the long-range Playwright evidence owner to `apps/weltraum-browser/tests/e2e/autopilot-proving-ground-long-range.spec.ts` and updated generated Markdown to name that spec.
- Trimmed `autopilot-proving-ground-v2.spec.ts` back to a compatibility smoke that asserts baseline v2 IDs plus expanded catalog IDs/count without generating long-range evidence artifacts.
- Focused E2E passed with Chrome fallback: `npx.cmd playwright test tests/e2e/autopilot-proving-ground-v2.spec.ts tests/e2e/autopilot-proving-ground-long-range.spec.ts --project=chromium` (3/3 tests).

## 2026-07-02 Fast 2500m settled-evidence recovery

- Manual execution id: `manual-fast-2500m-settled-evidence-2026-07-02-recovery`.
- Recovery worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-autopilot-long-range-testfield-v1-settled-nosmudge`.
- Recovery branch: `recovery/browser-autopilot-long-range-settled-evidence-v1-nosmudge` at long-range commit `89fc09061025c2ac44e767606e008234e4654be0`.
- Previous profile-only approach stopped/escalated: first-arrival Fast 2500m speed could not be tuned to `<= 0.45` without changing first-arrival semantics or ordering, so the approved follow-up is settled-evidence only.
- Scope guardrails: no `Assets/**`, no Unity, no LFS smudge/pull, no commit/push, and no product/runtime arrival behavior changes.
- Implemented runner/evidence split: existing `finalSpeed`, `finalDistance`, `tick`, `simulatedSeconds`, and `ticksToArrival` remain first-`Arrived` metrics; new `settledSpeed`, `settledDistance`, and `settlingTicks` report a bounded 30-tick post-arrival holding window.
- Exact 2500m speed-profile evidence after focused E2E regeneration:
  - Safe: `ticksToArrival=6471`, `simulatedSeconds=215.7`, `finalSpeed=0.4967`, `settledSpeed=0.3597`, `settledDistance=1.1088`, `settlingTicks=30`, `terminalSpeedLimit=0.5`, `classification=Pass`, `replanRequired=false`, `planHashBefore=22afedd7`, `planHashAfter=22afedd7`, `completedPlanHash=22afedd7`, `failureReasonCodes=[]`, `invalidationReasons=[]`.
  - Balanced: `ticksToArrival=4428`, `simulatedSeconds=147.6`, `finalSpeed=0.4958`, `settledSpeed=0.359`, `settledDistance=1.1069`, `settlingTicks=30`, `terminalSpeedLimit=0.5`, `classification=Pass`, `replanRequired=false`, `planHashBefore=7f5c1f03`, `planHashAfter=7f5c1f03`, `completedPlanHash=7f5c1f03`, `failureReasonCodes=[]`, `invalidationReasons=[]`.
  - Fast: `ticksToArrival=3691`, `simulatedSeconds=123.0333`, `finalSpeed=0.4998`, `settledSpeed=0.3619`, `settledDistance=1.1158`, `settlingTicks=30`, `terminalSpeedLimit=0.5`, `classification=Pass`, `replanRequired=false`, `planHashBefore=acb63fa7`, `planHashAfter=acb63fa7`, `completedPlanHash=acb63fa7`, `failureReasonCodes=[]`, `invalidationReasons=[]`.
- Verification passed from `apps/weltraum-browser`: `npm run test -- --run tests/unit/autopilotSpeedProfiles.test.ts tests/unit/autopilotCourseMetrics.test.ts` (5 tests), `npx tsc -p tsconfig.json --noEmit`, Chrome-fallback `npx playwright test tests/e2e/autopilot-proving-ground-long-range.spec.ts --project=chromium` (2/2), `npm run test` (118 tests), and `npm run build`.
- Repository checks passed: `git status --short -- Assets` returned clean and `git diff --check` reported no whitespace errors.
- Regenerated evidence files: long-range Markdown, summary JSON, speed-profile JSON, and the four long-range PNG screenshots under `apps/weltraum-browser/evidence/`.
