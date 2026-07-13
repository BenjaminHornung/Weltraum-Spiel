# Weltraum Browser Mainline Transition Summary

Date: 2026-06-29

## Branch and Mainline Decision

- Worktree: `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Threejs-Mainline-Transition-v1`
- Current branch for this evidence refresh: `feature/browser-navigation-autopilot-v2-v1`
- Current analyzed base SHA before the navigation/autopilot v2 v1 edits: `2f1f68b`
- Historical mainline transition branch: `mainline/threejs-browser-transition-v1`
- Historical transition SHA: `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`
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

Each scenario record includes final status, final distance, final speed, final position, target position, initial/final mass, initial/final fuel, fuel used, authority state, braking reserve, route validity, failure reason codes, initial/final plan hash, invalidation reasons, replan-required state, target kind, arrival envelope, route validation metadata and deterministic route score metadata. The `direct-local-arrival` evidence records `finalPosition == targetPosition` and `distanceToTarget=0`; `insufficient-fuel` records `status=OutOfFuel`, `fuelUsed=0`, `finalFuel=0`, `finalSpeed=0`, `routeValid=false`, `failureReasonCodes` containing `FuelInsufficient`/`FuelDepleted`, and `brakingReserve.canBrake=false`; `brake-reserve-insufficient` records both `FuelInsufficient` and `BrakeReserveInsufficient`; `off-route-divergence` records `status=Diverged`, `routeValid=false`, `failureReasonCodes=[OffLockedRoute]`, `fuelUsed=0`, `finalFuel=100`, and no silent plan replacement.

| Scenario | Evidence status |
| --- | --- |
| `direct-local-arrival` | PASS |
| `obstacle-avoidance-route` | PASS |
| `insufficient-fuel` | PASS |
| `no-authority` | PASS |
| `no-main-thrusters` | PASS |
| `brake-reserve-insufficient` | PASS |
| `off-route-divergence` | PASS |
| `locked-plan-hash-preservation` | PASS |
| `explicit-replan-required-signal` | PASS |

## Final Verification Results

- `npm ci`: pass, added/audited 59 packages, 0 vulnerabilities, npmrc warnings only.
- `npx playwright install chromium`: pass, npmrc warnings only.
- `npm run test`: pass, Vitest 5 files / 38 tests after navigation/autopilot v2 v1 contract coverage, including structured planner rejection, invalid obstacle rejection, deterministic scoring, terminal green-target arrival capture, already-inside-envelope clamp, `NoStopRequired` velocity and tangential non-arrival tests.
- `npm run build`: pass, Vite build completed, chunk-size warning only.
- `npm run test:e2e`: default bundled Chromium launch failed with `spawn UNKNOWN` in this local environment during the latest rerun.
- `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:e2e`: pass, Playwright 6/6 tests, no stale-server reuse. The path is an environment-gated local fallback only; it is not hardcoded in source/config.
- Scenario evidence field check: pass, 9 records and no missing `targetKind`, `arrivalEnvelope`, `routeValidation`, `routeScore`, `finalPosition`, or `targetPosition` fields.
- Green target arrival check: pass in E2E/TestBridge fallback run; the live browser runtime reaches `Arrived`, final ship position equals the locked plan target point used for the green target marker, final distance is inside the explicit `arrivalEnvelope.radius`, and the gated render snapshot proves the rendered ship position, rendered green target position, and locked target position are the same point.

`npm ci` is the canonical reproducible install gate because `package-lock.json` pins the resolved dependency graph.

## Generated Evidence Artifacts

- `apps/weltraum-browser/evidence/verification-npm-install.log`
- `apps/weltraum-browser/evidence/verification-npx-playwright-install-chromium.log`
- `apps/weltraum-browser/evidence/verification-npm-run-test.log`
- `apps/weltraum-browser/evidence/verification-npm-run-build.log`
- `apps/weltraum-browser/evidence/verification-npm-run-test-e2e.log`
- `apps/weltraum-browser/evidence/debug-scene.png`
- `apps/weltraum-browser/evidence/debug-scene-mobile.png`
- `apps/weltraum-browser/evidence/telemetry.json`
- `apps/weltraum-browser/evidence/navigation-autopilot-v2-summary.md`
- `apps/weltraum-browser/evidence/playwright-report/`

## Blockers and Operational Notes

- DevToolbox MCP blocker: `workspace_discover` failed with `unauthorized_path` because this repo path is outside the allowed DevToolbox root. Direct file/spec work and direct verification evidence were used instead.
- Spec task boxes remain unchecked because DevToolbox MCP completion preflight/task toggling is blocked by the same `unauthorized_path` path guard. This summary does not fake completion preflight; direct evidence is used instead.
- Initial LFS worktree issue was resolved non-destructively with `GIT_LFS_SKIP_SMUDGE=1`.
- Product runtime bootstrap creates an app-local browser runtime controller directly; `window.TestBridge` is exposed only when `?testBridge=1` is requested for E2E/test harness use, and the default product URL does not expose the global bridge.
- Delivery state for this refresh: current edits are on `feature/browser-navigation-autopilot-v2-v1` and are intentionally left for orchestrator verification/review before any staging or commit. This summary no longer makes a delivery claim about the historical mainline transition branch. No commit, push, archive, Unity validation, or dotnet validation is claimed by this refresh.

## Repository Cleanup Note (2026-07-13)

Capture-time `Assets/**` strings in historical Markdown and JSON evidence remain
unchanged. They describe the original worktree and are recoverable from
`unity-legacy-final-2026-07:Assets/**`; retained reusable art now lives under
`art/`. Current documentation paths below reflect their post-cleanup locations.

## Review Follow-Up Notes

- Five generated, unreferenced `verification-*.log` files were removed after the cleanup evidence inventory; screenshots, JSON, Markdown, baselines and conservative unreferenced records remain.
- Browser-mainline documentation cites copied source evidence under `docs/legacy-unity/source-evidence/`; package-only inputs are marked as historical external inputs, not live repo paths.
- Browser app dependencies are pinned to versions already resolved in `package-lock.json`; no dependency or devDependency uses `latest`.
- Playwright defaults to the installed browser from Playwright, supports an optional `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` override for local runner compatibility, and keeps stale-server hardening via `reuseExistingServer: false` and Vite `--strictPort`.
- The HUD renders mode as a dedicated visible readout instead of only embedding mode in telemetry JSON.
- Scenario matrix evidence now includes `finalSpeed`, `finalPosition`, `targetPosition`, `initialFuel`, `finalFuel`, `fuelUsed`, `authority`, `brakingReserve`, `routeValid`, `targetKind`, `arrivalEnvelope`, `routeValidation`, and `routeScore` fields, with unit and E2E assertions enforcing their presence. E2E also asserts the runtime ship and browser-rendered ship arrive at the locked green target marker point without plan replacement.
