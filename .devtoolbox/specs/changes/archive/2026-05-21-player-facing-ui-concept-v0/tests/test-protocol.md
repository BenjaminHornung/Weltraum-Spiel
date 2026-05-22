# Player-facing UI concept v0 test protocol

Date: 2026-05-21

Source document: `docs/player-facing-ui-concept-v0.md`

## Coverage map

- Flight HUD v0: implemented as `PrototypePlayerHudRenderer` with speed, throttle, fuel, Cruise/Precision/Translation mode, RCS/SAS chips, warning strip, assist strip, center markers, Kill Momentum button, and ship-system summary.
- Navigation / Autopilot: implemented through `PrototypePlayerHudSnapshotBuilder` with target name/type, distance, ETA or `nicht auf Kurs`, closing/lateral speed, friendly state/phase labels, warning-chip translation, predicted route points, and avoidance cue. Raw candidate scores, requested forces, and planner internals are not exposed.
- Combat / Weapon Computer: implemented as player-facing combat snapshot/labels for active target, health/integrity gauge, range, fire state, cooldown/arc/range/offline states, Auto Fire, and priority. Hit chance, projectile tuning, yaw/pitch internals, and recoil values are not exposed.
- Docking UI: implemented as snapshot/translator for distance, angle, relative/closing speed, lateral offset, distance/alignment/speed gauges, soft-capture request readiness, and placeholder-safe hard-lock labels. It never reports a final Docked state while hard lock remains a placeholder.
- Ship Status / Damage: implemented as fuel, main engine, RCS, SAS, weapon standby/status, damaged count, worst module integrity, and RCS thrust reduction when backed by `RcsThrusterBlock` damage. Cargo, mission/reward, and builder UI remain intentionally absent because the source document marks them as future/non-v0 scope.
- Settings / Keybinds: implemented as player help text from `PrototypeInputBindingCatalog`, filtering debug-only lines by default.
- Debug separation: `PrototypeUiLayoutManager` now defaults to `Basic`; the new player HUD is visible while old prototype/debug windows remain present but hidden unless toggled.
- Responsive safety: `PrototypePlayerHudRenderer` now rebinds its generated canvas after reloads instead of stacking duplicate HUD windows, switches CanvasScaler policy for width/height-constrained aspect ratios, and verifies panel and bottom-bar child separation across 1280x720, 1024x768, 800x600, and 640x480 layouts.
- Design decisions and deferred scope are recorded in `design-decisions.md`.

## Automated verification

- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: 0 errors, 2 non-blocking warnings from validator heuristics.
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: 0 errors.
- Unity MCP EditMode:
  - `PrototypePlayerHudValidationTests`: 10/10 passed.
  - `PrototypePlayerHudValidationTests + PrototypeUiArchitectureValidationTests + PrototypeFlightHudValidationTests`: 23/23 passed after target type, route/avoidance, gauge, soft-capture, damage, default-preset, EventSystem, responsive-layout, and duplicate-canvas coverage.
- `dotnet build '.\Weltraum Spiel.sln' --no-restore`: succeeded with existing warnings.
- `dotnet test '.\Weltraum Spiel.sln' --no-build`: exit code 0.

## Runtime / screenshot verification

- Unity MCP play-mode probe:
  - `playerHud=True`
  - `canvasInstances=1`
  - `canvasEnabled=True`
  - `scaleMatch=1.00`
  - `screen=1813x783`
  - `eventSystems=1`
  - `oldHudVisible=False`
  - `diagVisible=False`
  - `minimapVisible=False`
  - `mode=Cruise`
  - `hint=Cruise uses main thrust and full attitude controls.`
  - `navType=Waypoint`
  - `route=0` in the default live scene
  - `damage=Modules nominal`
- Unity MCP direct responsive probe:
  - `1280x720 overlapFree=True`
  - `1024x768 overlapFree=True`
  - `800x600 overlapFree=True`
  - `640x480 overlapFree=True`
- Unity MCP console after runtime verification: 0 errors/warnings.
- Screenshot evidence:
  - `tests/screenshots/player-ui-final-verified.png`

## Incomplete broad-suite note

A full Unity MCP EditMode run was attempted. The MCP job became stale at 62/234 tests with no failures reported and `blocked_reason=editor_unfocused`, while Unity editor state later reported tests were no longer running. After the job reset, verification was completed with focused Unity MCP suites, live play-mode probes, screenshot inspection, a clean runtime console check, `validate_script`, and `dotnet build/test`.
