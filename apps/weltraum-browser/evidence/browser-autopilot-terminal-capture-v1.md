# Browser Autopilot Terminal Capture v1 Evidence

Date: 2026-07-01
Branch: `feature/browser-autopilot-terminal-capture-v1`
Base: `927ca01 #WELTRAUM-000 Merge browser mainline CI`

## Root cause before this change

1. **Overspeed arrival:** `navigationAlpha` and `navigationBeta` used `terminalSpeed: 8` with `stopBehavior: "MatchTerminalSpeed"`, so `AutopilotExecutor.isArrived()` could accept `Arrived` near 8 m/s.
2. **Hard freeze after arrival:** `AutopilotExecutor.step()` checked `isArrived(...)` before calling `applyFlightControllerStep()`, wrote `Arrived` telemetry, and returned the previous `ShipState`. With a locked plan still active, later ticks could freeze a state that still contained nonzero velocity.

## New semantics to verify

- Default proving-ground navigation targets are stop/capture targets: `StopWithinEnvelope` with terminal speed 0.5 m/s or lower.
- Terminal capture uses a browser-native desired-acceleration controller through `applyFlightControllerStep()`.
- `Arrived` means captured and holding, not a frozen shortcut.
- Holding continues controller integration through station-keeping after the active route lock is cleared.
- Active-route `planHash` remains stable while executing/capturing; after completion the finished hash remains visible as `completedPlanHash`. No silent replan, target snap, waypoint snap, or velocity-zero shortcut is introduced.
- Demo Scout `GLBLoaded`, procedural fallback, TestBridge gating, renderer-not-truth, and HUD ViewModel flow remain intact.

## Evidence files

- `apps/weltraum-browser/evidence/autopilot-terminal-brake.png` — TerminalBrake phase screenshot from Playwright/Chrome fallback.
- `apps/weltraum-browser/evidence/autopilot-terminal-capture.png` — Capture phase screenshot inside the stop envelope while still above terminal speed.
- `apps/weltraum-browser/evidence/autopilot-terminal-hold.png` — Holding/Arrived screenshot after speed is within the 0.5 m/s envelope.
- `apps/weltraum-browser/evidence/autopilot-terminal-capture-telemetry.json` — serialized `engaged`, `terminalBrake`, `capture`, `holding`, `afterHold`, and render snapshot evidence.

Key telemetry from the generated JSON:

| Phase sample | Status | Arrival phase | Speed | Distance | Limit | GLB state |
| --- | --- | --- | ---: | ---: | ---: | --- |
| terminalBrake | Executing | TerminalBrake | 1.0482 m/s | 3.2322 m | 0.5 m/s | GLBLoaded |
| capture | Executing | Capture | 0.9618 m/s | 2.9658 m | 0.5 m/s | GLBLoaded |
| holding | Arrived | Holding | 0.4992 m/s | 1.5392 m | 0.5 m/s | GLBLoaded |
| afterHold | Arrived | Holding | 0.4680 m/s | 1.4430 m | 0.5 m/s | GLBLoaded |

The plan hash remained `53a60488` while the route was executing/capturing. In holding samples, active-route `planHash` is cleared and `completedPlanHash` preserves `53a60488`, so the completed route no longer blocks selecting/engaging a new target. The ship position differs from the selected target position in capture and holding samples; holding continues to integrate for five more TestBridge ticks instead of returning a frozen state.

## Verification

Latest implementation-pass evidence:

- `npm ci` — passed, installed browser dependencies.
- `npm run test -- tests/unit/executor.test.ts tests/unit/simulation.test.ts` — passed, 39 focused tests.
- `npm run build` — passed; Vite reported the existing large chunk warning.
- `npm run test:e2e -- tests/e2e/autopilot-terminal-capture.spec.ts` — bundled Chromium failed with known `browserType.launch: spawn UNKNOWN`.
- Chrome fallback: `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e -- tests/e2e/autopilot-terminal-capture.spec.ts` — passed, generated the terminal screenshots and JSON above.

Full-suite verification is recorded in the implementation report/final output for this pass.

## Remaining risks

- This remains a browser-mainline local-space terminal-capture slice, not full Unity or orbital autopilot parity.
- Bundled Playwright Chromium is still blocked by the known local `spawn UNKNOWN`; Chrome executable fallback is required on this machine.
