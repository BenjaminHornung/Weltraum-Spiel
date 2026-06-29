# Weltraum Browser Mainline Transition Summary

Date: 2026-06-29

## Branch and Mainline Decision

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Threejs-Mainline-Transition-v1`
- Branch: `mainline/threejs-browser-transition-v1`
- Original analyzed SHA: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`
- Decision: Three.js/TypeScript under `apps/weltraum-browser` is the product mainline. Unity remains in-repo as legacy/reference material and as a feature-intent source only.

## Constraints Honored

- No Unity start/install.
- No Unity `MonoBehaviour` 1:1 port.
- No Unity file deletion.
- No asset migration.
- No Ship Builder, Surface-FPS, Economy, Missions, or Drones implementation.

## Output Inventory

- `apps/weltraum-browser/**`: browser product app, source, tests, harness, and evidence.
- Nine copied spec changes under `.devtoolbox/specs/changes/**`: `browser-app-foundation-v1`, `browser-feature-port-roadmap-v1`, `browser-flight-authority-fuel-braking-v1`, `browser-low-poly-open-world-runtime-v1`, `browser-navigation-autopilot-v2-v1`, `browser-proving-ground-matrix-v1`, `browser-ui-input-hud-foundation-v1`, `threejs-mainline-transition-v1`, and `unity-feature-intent-mining-v1`.
- `docs/browser-mainline/**`: ADR, architecture, feature-intent cards/index, Unity bug traps, roadmap, and testing/evidence docs.
- Proving-ground scenario matrix harness/tests/evidence.
- Playwright stale-server hardening in `apps/weltraum-browser/playwright.config.ts` with `reuseExistingServer: false` and Vite `--strictPort`.

## Proving-Ground Matrix Evidence

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

- `npm install`: pass, up to date/audited 59 packages, 0 vulnerabilities, npmrc warnings only.
- `npx playwright install chromium`: pass, npmrc warnings only.
- `npm run test`: pass, Vitest 4 files / 17 tests.
- `npm run build`: pass, Vite build completed, chunk-size warning only.
- `npm run test:e2e`: local bundled Chromium launch failed with `spawn UNKNOWN` in this environment.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e`: pass, Playwright 3 passed, no stale-server reuse. The path is an environment-gated local fallback only; it is not hardcoded in source/config.

`npm install` remains the approved transition gate. For reproducible installs, `npm ci` is canonical because `package-lock.json` pins the resolved dependency graph.

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

## Blockers and Operational Notes

- DevToolbox MCP blocker: `workspace_discover` failed with `unauthorized_path` because this repo path is outside the allowed DevToolbox root. Direct file/spec work and direct verification evidence were used instead.
- Spec task boxes remain unchecked because DevToolbox MCP completion preflight/task toggling is blocked by the same `unauthorized_path` path guard. This summary does not fake completion preflight; direct evidence is used instead.
- Initial LFS worktree issue was resolved non-destructively with `GIT_LFS_SKIP_SMUDGE=1`.
- Product runtime bootstrap creates an app-local browser runtime controller directly; `window.TestBridge` is exposed only when `?testBridge=1` is requested for E2E/test harness use, and the default product URL does not expose the global bridge.
- Delivery state: this is an uncommitted worktree pending explicit user/orchestrator approval for any commit. No commit, push, archive, Unity validation, or dotnet validation is claimed by this summary.

## Review Follow-Up Notes

- Verification logs under `apps/weltraum-browser/evidence/verification-*.log` are intended to be trackable by normal `git add`; the app-local `.gitignore` allows them despite the root `*.log` ignore.
- Browser-mainline documentation cites copied source evidence under `analysis/threejs-mainline/source-evidence/`; package-only inputs are marked as historical external inputs, not live repo paths.
- Browser app dependencies are pinned to versions already resolved in `package-lock.json`; no dependency or devDependency uses `latest`.
- Playwright defaults to the installed browser from Playwright, supports an optional `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` override for local runner compatibility, and keeps stale-server hardening via `reuseExistingServer: false` and Vite `--strictPort`.
- The HUD renders mode as a dedicated visible readout instead of only embedding mode in telemetry JSON.
- Scenario matrix evidence now includes `finalSpeed`, `initialFuel`, `finalFuel`, `fuelUsed`, `authority`, and `brakingReserve` fields, with unit and E2E assertions enforcing their presence.
