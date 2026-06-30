# Browser Playable Ship Flight v1 Evidence

## What is now playable

- The browser ship is no longer a cone-only marker. It uses a procedural low-poly ship fallback with hull/body, cockpit/front, main engine, RCS marker, muzzle-placeholder and camera-anchor descriptors.
- Flight State V2 and the shared `applyFlightControllerStep` foundation are implemented, so manual controls and autopilot act through the same deterministic actuator/controller path.
- Manual flight controls are implemented: `W/S` pitch, `A/D` yaw, `Q/E` roll, `Shift/Ctrl` throttle ramp, `X` cut, `Y/Z` full, `R` toggle RCS, `T` toggle SAS, `CapsLock` mode cycle, `H/N` translation vertical, `V` camera cycle, RMB orbit/look, and wheel zoom.
- Camera modes are implemented: `ChaseLocked` default, `OrbitInspect`, `Side`, and `FreeInspect`. `ChaseLocked` follows the moving ship.
- VFX are telemetry-driven: main flame comes from `mainThrustActive`; RCS puffs come from `rcsTranslationActive`, `rcsRotationActive`, and `sasCorrectionActive`.
- HUD now displays control mode, camera mode, throttle, velocity/speed, RCS/SAS actuator state, keybind help, plus existing autopilot/target/warnings.
- Autopilot uses the actuator layer without normal-runtime snap shortcuts. It no longer performs normal-runtime arrival `position = target.position`, waypoint `position = segment.end`, waypoint `velocity = vec3()`, or terminal velocity clamp/zero shortcuts. Idle/cancel remain drift-preserving. Segment progression uses actual envelope entry/crossing without mutating position or velocity. Arrival requires actual distance within the arrival envelope, terminal speed if specified, stable `planHash`, and no replan replacement.
- Review-fix coverage hardens `MatchTerminalSpeed` so a configured arrival terminal speed remains the braking target instead of a hardcoded stop, and routes autopilot facing through flight-controller rotation commands instead of overwriting orientation per tick.

## What is still worse than Unity

- The ship is a procedural browser fallback, not the production Unity/GLB ship art pipeline.
- Existing candidate `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` was verified read-only as a valid GLB asset with size `127108` and a `glTF` binary header, but it was not copied or used in this bounded slice because async loader/bundling risk was out of scope. No `Assets/**` mutation was made.
- Physics remain deterministic browser approximations; this is not a Unity Rigidbody, per-nozzle RCS allocator, gimbal, or full SAS solver parity claim.
- VFX are simple low-poly state indicators, not a full particle/engine-effects system.
- Camera modes are player/render projections only; they are not gameplay truth and must not become save/navigation authority.

## Verification

| Check | Result | Notes |
| --- | --- | --- |
| `npm ci` | PASS | Implementation-lane verification. |
| Targeted HUD/simulation tests | PASS | 18 tests. |
| Targeted executor/flightController/provingGround/simulation tests | PASS | 48 tests, including review-fix coverage for N1/N2. |
| `npm run test` | PASS | 71 tests. |
| `npm run build` | PASS | Existing Vite chunk-size warning remains. |
| default `npm run test:e2e` | FAIL (known local launcher issue) | Fails only with known `browserType.launch: spawn UNKNOWN`. |
| Chrome fallback E2E | PASS | `WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" npm run test:e2e`; 8 tests. |
| `git status --short -- Assets` | PASS | Clean; no `Assets/**` mutation. |

## Screenshot paths

- `apps/weltraum-browser/evidence/manual-flight-chasecam.png`
- `apps/weltraum-browser/evidence/rcs-translation.png`
- `apps/weltraum-browser/evidence/autopilot-thruster-burn.png`
- `apps/weltraum-browser/evidence/autopilot-arrival.png`
- `debug-scene.png`
- `debug-scene-mobile.png`

## Historical spike audit disposition

Historical audit input: `.opencode/plans/1782807169649-eager-canyon.md`.

- B1/B9 active braking and desired-speed concerns are directly addressed by actuator/no-snap tests and the shared `applyFlightControllerStep` path.
- B2 dependency `latest` issue is already fixed in the current browser `package.json` exact versions.
- B3 phantom ship `lockPlan` issue is already fixed in current mainline.
- B4/B8/B16 remain follow-up candidates if not already covered by later slices.

## Residual risks

- Review-fix verification reran the E2E suite through the Chrome executable fallback, regenerating the standard evidence artifacts without adding new screenshot paths.
- Default Playwright remains environment-sensitive because the bundled browser launch fails with `spawn UNKNOWN`; the Chrome executable fallback is the proven local path.
- Procedural ship marker/socket descriptors are sufficient for v1 evidence but can hide future GLB socket/marker mismatches unless the asset pipeline gets explicit descriptor validation.
- Autopilot arrival now depends on real envelope entry and terminal-speed conditions; future tuning must keep no-snap/no-idle-zero regression tests in place.

## Next recommended task

Run the review/commit closure for `browser-playable-ship-flight-v1`: review the docs/evidence against the implemented browser behavior, then commit the bounded docs/evidence update. A later implementation slice should harden the real ship asset/GLB loader path with marker/socket validation before claiming art-pipeline parity.
