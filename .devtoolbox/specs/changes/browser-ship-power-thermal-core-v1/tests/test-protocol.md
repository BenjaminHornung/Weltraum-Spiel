# Test Protocol: Browser Ship Power/Thermal Core V1

## Baseline
- Repository: BenjaminHornung/Weltraum-Spiel
- Base ref: origin/main
- Base SHA: 5ff47aeef3c42c0b933e8480dafa5680759a40df
- Branch: feature/browser-ship-power-thermal-core-v1
- Runtime baseline: Node 22
- Worktree: isolated task-owned worktree; other worktrees are out of scope.

## Scope
Verify the standalone TypeScript ship-power-thermal domain only. No runtime, UI, renderer, Flight, Combat, Ship Builder, Persistence, Navigation, infrastructure, or roadmap integration is permitted. Package-script scope is limited to assigning this spec exactly once to `test:e2e:core`.

## Planned Static Verification
1. Confirm Node major version 22.
2. npm ci and confirm package.json/package-lock.json remain byte-identical to base.
3. npx tsc -p tsconfig.json.
4. Scan change-owned source for Three.js, mesh, scene, DOM/TestBridge, Date.now, Math.random, non-finite literals, and forbidden-domain imports.
5. git diff --check.
6. Compare every changed path with the explicit allowlist.

## Planned Unit Verification
Run each required file independently:
- npm run test -- tests/unit/shipPowerValidation.test.ts
- npm run test -- tests/unit/shipPowerAllocation.test.ts
- npm run test -- tests/unit/shipBattery.test.ts
- npm run test -- tests/unit/shipThermal.test.ts
- npm run test -- tests/unit/shipPowerThermalStep.test.ts
- npm run test -- tests/unit/shipPowerThermalEvents.test.ts
- npm run test -- tests/unit/shipPowerThermalDeterminism.test.ts

Then run npm run test and npm run build.

## Mandatory Unit Matrix
The unit suite must map named tests to all 30 prompt cases: sufficient source; Critical before Flight; Flight before Utility; proportional class; stable-ID remainder; non-throttleable shed; throttleable throttled; battery deficit; preserved reserve; Critical emergency reserve; surplus charge; charge/discharge loss heat; source ramp; isolated buses; loss heat; cooling heat reduction; underpowered cooling; reproducible thermal step; Warning/Critical/Shutdown; invalid thresholds; no negative energy; explicit temperature-bound failure metadata; no NaN/Infinity; equal events/signatures; insertion-order independence; unchanged inputs; frozen results; no Three.js; no mesh/scene; no wall-clock/random.

## Planned Browser Verification
Focused command: npm run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts.

The spec must load /, prove window.TestBridge absent, dynamically import /src/ship-power-thermal/index.ts, run the required generator/battery/load/cooling sequence twice, compare canonical results, and assert empty console, pageerror, requestfailed, and non-success (non-2xx) HTTP response collections. No screenshot is required. The spec is assigned exactly once to the existing `test:e2e:core` group.

## Full Regression
After focused proof: npm run test:e2e. Existing Playwright webServer owns Vite startup. No raw foreground server or unmanaged background process is allowed.

## Evidence Outputs
- apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1-summary.json
- apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1.md
- this protocol updated with observed commands, timestamps, exits, failures/fixes, reviews, and final scope audit.

## Result Log
### Task 5 - 2026-07-15

- Node baseline probe: `npx --yes node@22 -p "process.version + ' ' + process.execPath"` reported `v22.23.1`.
- First focused run with bundled Playwright Chromium: failed before test execution with the documented Windows-host `browserType.launch: spawn UNKNOWN` condition.
- Repository-supported Chrome fallback run: reached the browser scenario but failed at step 1 because the E2E test passed the fixture helper's validated internal shape back through the public evaluator; validation correctly rejected its internal-only `rejectedConsumerResults` field. The test was corrected to pass the raw public `ShipPowerThermalStepInput` to `evaluateShipPowerThermalStep`.
- Bounded correction removed the synthetic favicon route, asserted the real `/favicon.png` document declaration, retained all four unfiltered browser-health collectors, and strengthened Warning/Critical action and event checks to exact ordered arrays.
- The first correction rerun was blocked before test execution because an unmanaged orphaned Vite process from another worktree still owned port 5173 after its parent exited. With explicit user approval, PID 89708 was stopped and the required managed Playwright webServer then owned the port.
- Final fresh focused run from `apps/weltraum-browser`: `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npx --yes node@22 "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:e2e -- tests/e2e/ship-power-thermal-core.spec.ts` - PASS, exit 0, 1/1 test in 13.1 seconds.
- Scenario evidence: normal operation at 85 W; reduced source at 40 W with 20 W battery discharge and Weapon/Mission shed; temperatures 310 K Warning and 330 K Critical; 250 W cooling recovery to 305 K Nominal.
- Determinism: both complete serializable scenario results, canonical JSON, signatures, event IDs, and event streams were equal.
- Browser health: `consoleErrors`, `pageErrors`, `failedRequests`, and `nonSuccessHttpResponses` were all empty; `window.TestBridge` was absent before and after. The normal document declared `/favicon.png`; no request interception or network exclusion was used.
- Exact thermal arrays: Warning events were `[PowerAllocationCompleted, ThermalWarning]`; Critical actions were `[CoolingInsufficient, ThermalNodeCritical]`; Critical events were `[PowerAllocationCompleted, CoolingInsufficient, ThermalCritical]`.
- Evidence generated: `apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1-summary.json` and `apps/weltraum-browser/evidence/browser-ship-power-thermal-core-v1.md`. No screenshot was generated because this standalone core has no UI or renderer integration.
- Task 5 scope audit: changes are confined to its five allowlisted E2E, evidence, documentation, and protocol files; package manifests and E2E grouping remain unchanged. `git diff --no-index --check` reported no whitespace errors for all five files.
- Task 5 intentionally did not run the full unit/build/E2E regression or DevToolbox verify/completion preflight; those gates remain assigned to Task 6. No package script or E2E group was changed.
