# Browser Autopilot Lifecycle + Render Smoothing v1 Evidence

Date: 2026-07-02
Branch: `feature/browser-autopilot-lifecycle-render-smoothing-v1`
Base: `082c9587b6ea02756e0bf312dd08327c7bcc2a71`

## Verified lifecycle semantics

- Active `Executing` / `TerminalCapture` routes keep a locked active `planHash` and block target selection / new Engage.
- After terminal capture reaches Holding, the executor clears the active `lockedPlan`, exposes `canAcceptNewPlan === true` and `canSelectNewTarget === true`, and preserves the finished route hash as `completedPlanHash`.
- Holding/station-keeping continues through `applyFlightControllerStep()` with desired acceleration; no target snap or velocity-zero shortcut is used.
- `NoStopRequired` fly-through arrivals complete without entering Holding/station-keeping; the next tick remains idle/ready with no locked plan, no terminal holding telemetry, and no velocity-zero shortcut.
- Locking a new plan while Holding clears station-keeping and starts the new active route without replacing the completed hash.

Generated lifecycle evidence:

- `apps/weltraum-browser/evidence/autopilot-lifecycle-new-route-after-arrival.json`
  - First route completed hash: `faecf105`.
  - Holding sample: `status=Arrived`, `routeLifecycle=Holding`, `planHash=null`, `completedPlanHash=faecf105`, `canAcceptNewPlan=true`, `canSelectNewTarget=true`.
  - New route sample: `status=Executing`, target `nav-alpha`, new active `planHash=334d0297`, `completedPlanHash=faecf105`.
  - Blocked active-route sample: selecting `nav-beta` while executing keeps selected target `nav-alpha` and keeps `planHash=334d0297` stable.

## Verified render smoothing semantics

- `FixedStepSimulationLoop` exposes cloned previous/current truth plus an interpolated presentation ship; mutating the presentation snapshot does not mutate truth.
- Three.js `DebugScene` uses the interpolated pose only for ship visual and camera. Target, route, HUD, VFX and TestBridge truth stay on owner telemetry.
- Camera damping is frame-rate-independent: `alpha = 1 - exp(-lambda * dt)`, with `lambda=16` for `ChaseLocked` and `lambda=11` for inspection modes.

Generated smoothing evidence:

- `apps/weltraum-browser/evidence/render-smoothing-sample.json`
  - `usesInterpolatedPose=true`
  - `interpolationAlpha=0.026`
  - `fixedStepCountThisFrame=1`
  - `frameDeltaSeconds=0.0167`
  - `cameraSmoothingAlpha=0.23448`
  - Truth/rendered positions differ in the snapshot (truthShipPosition.x=89.3387, renderedShipPosition.x=89.2492).
  - Consecutive render-frame sample: 32 executing frames, max rendered ship jump `0.1203` world units (threshold `2`), max camera jump `0.3694` world units (threshold `10`).
- `apps/weltraum-browser/evidence/render-smoothing-chasecam.png` - ChaseLocked browser screenshot captured during the smoothing sample.

## Verification

- `npm ci` — passed.
- `npm run test` — passed, 104/104 unit tests.
- `npm run build` — passed; Vite reported the existing large chunk warning.
- `npm run test:e2e` — default bundled Chromium failed with the known local `browserType.launch: spawn UNKNOWN`.
- Chrome fallback: `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e` — passed, 13/13 browser tests.

No Unity was started and no `Assets/**` files were modified.
