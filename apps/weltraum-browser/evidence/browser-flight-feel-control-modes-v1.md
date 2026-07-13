# Browser Flight Feel Control Modes v1 Evidence

Date: 2026-06-30

> Repository cleanup note (2026-07-13): `Assets/**` below is the original
> capture-time path. The immutable Unity snapshot is available at
> `unity-legacy-final-2026-07:Assets/**`; retained reusable art is under `art/`.

## Scope

- Implemented Task 1 from `browser-flight-feel-rcs-sas-parity-v1`: make Browser Cruise, Precision and Translation distinct without changing executor safety contracts.
- Preserved Demo Scout GLB visual parity, procedural fallback, TestBridge query gating, stable plan hash/no-silent-replan behavior, and drift-preserving idle/cancel.
- Did not edit `Assets/**`, did not add throttle spool/inertia, per-nozzle RCS allocation, full SAS HoldAttitude, or new gameplay systems.

## Behavior proven

- Cruise: throttle/main thrust is enabled and drives main thruster VFX.
- Precision: throttle commands are ignored/cleared and main thrust is mode-blocked; W/S/A/D/Q/E drive finer RCS attitude response than Cruise.
- Translation: throttle commands are ignored/cleared and main thrust is mode-blocked; W/S/A/D/H/N drive RCS translation and Q/E remains separate roll/rotation authority.
- `ControlModeEffectSnapshot` in actuator telemetry exposes `controlMode`, `mainThrustAllowed`, `rcsTranslationAllowed`, `rcsRotationAllowed`, `sasAllowed`, `modeEffectLabel`, `blockedReasonCodes`, `notes`, and `rotationResponseScale` for HUD/tests.
- Translation rotation is centrally masked to roll-only before angular acceleration, so yaw/pitch rotation commands from runtime/TestBridge ingress cannot rotate the ship in Translation.
- SAS damping uses the base `sasDamping` authority across modes; `rotationResponseScale` now shapes only manual RCS rotation acceleration. If RCS rotation authority is missing, SAS is explicitly blocked with `SasNoRcsAuthority`.
- HUD reads the owner telemetry and shows concise player text: `main thrust enabled`, `RCS attitude / main thrust blocked`, `RCS translation / main thrust blocked`, with readable active/blocked labels for main thrust, RCS translation, RCS rotation and SAS.

## Verification

### Original slice verification

- `npm ci`: passed; installed browser app dependencies because `node_modules` was absent.
- `npm run test`: passed, 9 files / 82 tests.
- `npm run build`: passed; Vite kept the existing large chunk warning.
- `npm run test:e2e`: failed with known Playwright bundled Chromium `spawn UNKNOWN`.
- `$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:e2e`: passed, 9/9 tests.

### Review-fix verification

- `npm run test -- tests/unit/flightController.test.ts tests/unit/simulation.test.ts tests/unit/statusHud.test.ts`: passed, 3 files / 40 tests.
- `npm run test`: passed, 9 files / 87 tests.
- `npm run build`: passed; Vite kept the existing large chunk warning.
- `git diff --check`: passed.
- `git status --short -- Assets`: clean.

## Screenshot evidence

- `control-mode-cruise-main-thrust.png` — Cruise mode with main thrust active and Demo Scout GLB line preserved.
- `control-mode-precision-rcs-rotation.png` — Precision mode with main thrust blocked/off and RCS attitude authority visible.
- `control-mode-translation-rcs-translation.png` — Translation mode with RCS translation puffs visible and main thrust blocked.
- Existing updated E2E artifacts also include `demo-scout-glb-loaded.png`, `demo-scout-main-thruster.png`, `demo-scout-chasecam.png`, `demo-scout-rcs-puffs.png`, `autopilot-thruster-burn.png`, `autopilot-arrival.png`, `demo-scout-autopilot-arrival.png`, `debug-scene.png`, and `debug-scene-mobile.png`.

## Notes

- GLB visual source remained `GLBLoaded` in passing E2E, with marker/VFX bindings still asserted through render snapshots.
- The default runtime still hides `window.TestBridge`; it is available only with `?testBridge=1`.
- Locked route/no-snap invariants are covered by the existing vertical slice E2E and unit regression tests, which remained green.
