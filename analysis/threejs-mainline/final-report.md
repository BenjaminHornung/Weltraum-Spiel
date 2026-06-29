# Weltraum Three.js Mainline Transition v1 - Final Report

Date: 2026-06-29

## Branch and Worktree Context

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Threejs-Mainline-Transition-v1`
- Branch: `mainline/threejs-browser-transition-v1`
- Original analyzed SHA: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`

## Mainline Decision

Three.js/TypeScript under `apps/weltraum-browser` is now the product mainline for browser gameplay work. Unity remains in the repository as legacy/reference material and as a feature-intent source only. New browser gameplay work should target `apps/weltraum-browser` unless a later ADR supersedes this decision.

## Hard Constraints Honored

- No Unity start or Unity installation was performed for this transition evidence.
- No Unity `MonoBehaviour` 1:1 port was created.
- No Unity files were deleted.
- No Unity asset migration was performed.
- Ship Builder, Surface-FPS, Economy, Missions, and Drones were not implemented.

## Output Inventory

- `apps/weltraum-browser/**`: browser product app, TypeScript source, deterministic scenario harness, Vitest coverage, Playwright coverage, and evidence output.
- Nine copied spec changes under `.devtoolbox/specs/changes/**`:
  - `browser-app-foundation-v1`
  - `browser-feature-port-roadmap-v1`
  - `browser-flight-authority-fuel-braking-v1`
  - `browser-low-poly-open-world-runtime-v1`
  - `browser-navigation-autopilot-v2-v1`
  - `browser-proving-ground-matrix-v1`
  - `browser-ui-input-hud-foundation-v1`
  - `threejs-mainline-transition-v1`
  - `unity-feature-intent-mining-v1`
- `docs/browser-mainline/**`: ADR, browser architecture, feature-intent index/cards, known Unity bug traps, port roadmap, and testing/evidence documentation.
- Proving-ground scenario matrix harness, tests, and generated evidence under `apps/weltraum-browser`.
- Playwright stale-server hardening in `apps/weltraum-browser/playwright.config.ts` with `reuseExistingServer: false` and Vite `--strictPort`.

## Proving-Ground Scenario Evidence

Evidence file: `apps/weltraum-browser/evidence/scenario-matrix.json`

Each scenario record includes final status, final distance, final speed, initial/final fuel, fuel used, authority state, braking-reserve booleans, initial/final plan hash, invalidation reasons, and replan-required state. The `insufficient-fuel` evidence records `status=OutOfFuel`, `fuelUsed=0`, `finalFuel=0`, `finalSpeed=0`, `brakingReserve.fuelAvailable=false`, and `brakingReserve.canBrake=false`; `no-authority` records `status=NoAuthority`, `authority.autopilot=false`, and `brakingReserve.canBrake=false`.

| Scenario | Evidence status |
| --- | --- |
| `direct-local-arrival` | PASS |
| `obstacle-avoidance-route` | PASS |
| `insufficient-fuel` | PASS |
| `no-authority` | PASS |
| `off-route-divergence` | PASS |
| `locked-plan-hash-preservation` | PASS |
| `explicit-replan-required-signal` | PASS |

## Final Verification Results

The final verification evidence is recorded in app-local evidence logs:

- `npm install`: pass, up to date/audited 59 packages, 0 vulnerabilities, npmrc warnings only.
- `npx playwright install chromium`: pass, npmrc warnings only.
- `npm run test`: pass, Vitest 4 files / 17 tests.
- `npm run build`: pass, Vite build completed, chunk-size warning only.
- `npm run test:e2e`: local bundled Chromium launch failed with `spawn UNKNOWN` in this environment.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e`: pass, Playwright 3 passed, no stale-server reuse. The path is an environment-gated local fallback only; it is not hardcoded in source/config.

`npm install` remains the approved transition gate. For reproducible installs, `npm ci` is the canonical command because `apps/weltraum-browser/package-lock.json` pins the resolved dependency graph.

## Generated Evidence Artifacts

- `apps/weltraum-browser/evidence/verification-npm-install.log`
- `apps/weltraum-browser/evidence/verification-npx-playwright-install-chromium.log`
- `apps/weltraum-browser/evidence/verification-npm-run-test.log`
- `apps/weltraum-browser/evidence/verification-npm-run-build.log`
- `apps/weltraum-browser/evidence/verification-npm-run-test-e2e.log`
- `apps/weltraum-browser/evidence/debug-scene.png`
- `apps/weltraum-browser/evidence/debug-scene-mobile.png`
- `apps/weltraum-browser/evidence/telemetry.json`
- `apps/weltraum-browser/evidence/playwright-report/`

## Operational Notes and Blockers

- DevToolbox MCP blocker: `workspace_discover` failed with `unauthorized_path` because this repo path is outside the allowed DevToolbox root. Direct file/spec work and direct verification evidence were used instead.
- Spec task boxes remain unchecked because DevToolbox MCP completion preflight/task toggling is blocked by the same `unauthorized_path` path guard. This report does not fake completion preflight; direct evidence is used instead.
- Initial LFS worktree issue was handled non-destructively by using `GIT_LFS_SKIP_SMUDGE=1`, avoiding asset downloads and keeping Unity assets untouched.
- E2E stale-server risk was resolved operationally by Playwright config hardening: the browser app now starts Vite with `--strictPort` and `reuseExistingServer: false` instead of silently reusing an unrelated server on port 5173.
- Product runtime bootstrap now creates an app-local browser runtime controller directly; `window.TestBridge` is exposed only when `?testBridge=1` is requested for E2E/test harness use, and the default product URL does not expose the global bridge.
- Delivery state: this is an uncommitted worktree pending explicit user/orchestrator approval for any commit. No commit or push is claimed.

## Review Follow-Up Notes

- Verification logs under `apps/weltraum-browser/evidence/verification-*.log` are intended to be trackable by normal `git add`; the app-local `.gitignore` allows them despite the root `*.log` ignore.
- Browser-mainline documentation cites copied source evidence under `analysis/threejs-mainline/source-evidence/`; package-only inputs are marked as historical external inputs, not live repo paths.
- Browser app dependencies are pinned to versions already resolved in `package-lock.json`; no dependency or devDependency uses `latest`.
- Playwright defaults to the installed browser from Playwright, supports an optional `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` override for local runner compatibility, and keeps stale-server hardening via `reuseExistingServer: false` and Vite `--strictPort`.
- The HUD renders mode as a dedicated visible readout instead of only embedding mode in telemetry JSON.
- Scenario matrix evidence now includes `finalSpeed`, `initialFuel`, `finalFuel`, `fuelUsed`, `authority`, and `brakingReserve` fields, with unit and E2E assertions enforcing their presence.

## Scope Boundaries

This report does not claim commit, push, archive, Unity validation, dotnet validation, or new feature implementation beyond the documented Three.js/TypeScript browser mainline transition artifacts and their recorded evidence.
