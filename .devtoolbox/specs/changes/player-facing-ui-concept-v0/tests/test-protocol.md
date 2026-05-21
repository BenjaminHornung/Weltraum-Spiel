# Player-facing UI concept v0 test protocol

Date: 2026-05-21

Source document: `docs/player-facing-ui-concept-v0.md`

## Coverage map

- Flight HUD v0: implemented as `PrototypePlayerHudRenderer` with speed, throttle, fuel, Cruise/Precision/Translation mode, RCS/SAS chips, warning strip, assist strip, center markers, Kill Momentum button, and ship-system summary.
- Navigation / Autopilot: implemented through `PrototypePlayerHudSnapshotBuilder` with target name, distance, ETA, closing/lateral speed, friendly state/phase labels, and warning-chip translation. Raw candidate scores, requested forces, and planner internals are not exposed.
- Combat / Weapon Computer: implemented as player-facing combat snapshot/labels for active target, health, range, fire state, cooldown/arc/range/offline states, Auto Fire, and priority. Hit chance, projectile tuning, yaw/pitch internals, and recoil values are not exposed.
- Docking UI: implemented as snapshot/translator for distance, angle, relative/closing speed, lateral offset, soft-capture readiness, and placeholder-safe hard-lock labels. It never reports a final Docked state while hard lock remains a placeholder.
- Ship Status / Damage: implemented as fuel, main engine, RCS, SAS, weapon standby/status, and module damage summary. Cargo, mission/reward, and builder UI remain intentionally absent because the source document marks them as future/non-v0 scope.
- Settings / Keybinds: implemented as player help text from `PrototypeInputBindingCatalog`, filtering debug-only lines by default.
- Debug separation: `PrototypeUiLayoutManager` now defaults to `Basic`; the new player HUD is visible while old prototype/debug windows remain present but hidden unless toggled.

## Automated verification

- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: 0 errors, 2 non-blocking warnings from validator heuristics.
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: 0 errors.
- Unity MCP EditMode:
  - `PrototypePlayerHudValidationTests`: 6/6 passed.
  - `PrototypePlayerHudValidationTests + PrototypeUiArchitectureValidationTests + PrototypeFlightHudValidationTests`: 19/19 passed after the default-preset and EventSystem fixes.
- `dotnet build '.\Weltraum Spiel.sln' --no-restore`: succeeded with existing warnings.
- `dotnet test '.\Weltraum Spiel.sln' --no-build`: exit code 0.

## Runtime / screenshot verification

- Unity MCP play-mode probe:
  - `playerHud=True`
  - `canvas=True`
  - `eventSystems=1`
  - `oldHudVisible=False`
  - `diagVisible=False`
  - `minimapVisible=False`
- Unity MCP console after runtime verification: 0 errors/warnings.
- Screenshot evidence:
  - `tests/screenshots/player-ui-final-verified.png`

## Incomplete broad-suite note

A full Unity MCP EditMode run was attempted. The MCP job became stale at 62/234 tests with no failures reported and `blocked_reason=editor_unfocused`, while Unity editor state later reported tests were no longer running. After the job reset, verification was completed with focused Unity MCP suites, live play-mode probes, screenshot inspection, a clean runtime console check, `validate_script`, and `dotnet build/test`.
