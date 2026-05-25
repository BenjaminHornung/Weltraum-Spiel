# Test Protocol

## Scope

Player UI regression controls, minimap evidence, navigation/combat popups, Kill Momentum keybind and braking authority, autopilot flip/decel and obstacle avoidance coverage, and RCS VFX direction checks.

## Evidence

- Latest navigation-planner map slice:
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
    - `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: PASS, 0 errors, existing warnings only.
  - Unity MCP EditMode focused regression job `b10fef80997340ac947adf44df4769a1`: 14/14 passed.
  - Unity MCP PlayMode screenshot job `36bf8fac716448ddab6d35afc73895db`: 1/1 passed.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
- Unity MCP PlayMode: `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`
  - Result: 1/1 passed.
  - Screenshot: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-nav-planner-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-combat-computer-1280x720.png`
- Unity MCP EditMode:
  - `PrototypePlayerHudValidationTests`
  - `PrototypeAutopilotMomentumStartupStateTests`
  - `PrototypeWaypointAutopilotValidationTests`
  - `PrototypeFunctionalShipSocketValidationTests`
  - `PrototypeShipKitImportVfxValidationTests`
  - Result: 87/87 passed.
- Script validation:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: 0 errors.
  - `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: 0 errors.
- Build:
  - `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: passed, 0 errors, existing Unity/generated assembly warnings only.

## Screenshot Review

- Radar screenshot shows the player minimap in the top-right panel with visible grid and blips.
- Navigation Planner popup is centered above the bottom bar, hides fixed context/radar panels while open, and now includes an embedded player map layer with grid, blips, route/preview counts, and range label.
- Combat Computer popup is centered above the bottom bar and hides fixed context/radar panels while open.

## External Review

`claude-plan-review` was invoked with the implementation context and screenshot paths before the latest planner-map slice, but the local wrapper timed out after 120 seconds. No actionable review feedback was returned.
