# Test Protocol

## Scope

Player UI regression controls, minimap evidence, navigation/combat popups, Kill Momentum keybind and braking authority, autopilot flip/decel and obstacle avoidance coverage, and RCS VFX direction checks.

## Evidence

- Latest empty-minimap fix:
  - Root cause: existing generated HUD canvases could be accepted as complete while missing the newer Navigation Planner map objects, and scene navigation targets were not added when the autopilot manager was missing or stale.
  - Fix: bind/validate Navigation Planner map pools during existing-canvas reuse, rebuild stale HUD canvases, keep the planner map visible for radar contacts even without an active route, and add a scene-target fallback for radar blips.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
  - Unity MCP EditMode focused radar/planner job `1d8c0e1cd04b4cce8a8b0c98da2dfb6a`: 5/5 passed.
  - Unity MCP PlayMode screenshot job `3a17d7aa50bb4583b256bb60189eb645`: 1/1 passed.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
  - Screenshot: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-nav-planner-1280x720.png`
  - Visual check: normal radar shows visible grid/blips in the top-right minimap; Navigation Planner popup shows a populated embedded map with 34 contacts, route points, preview points, and no bottom-bar overlap at 1280x720.
- Latest minimap/radar readability slice:
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs`: PASS, 0 errors.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
  - Unity MCP EditMode focused radar/F5 regression job `8f441ed025534b9f91f98f4b1edfb805`: 7/7 passed.
  - Unity MCP PlayMode screenshot job `b1ecb528066e4e789e76a6e87f265adb`: 1/1 passed.
  - Screenshot: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-nav-planner-1280x720.png`
  - Visual check: the top-right radar now shows visible gameplay blips/route at `Range 1 km`; the Navigation Planner popup shows the same map layer and remains centered above the bottom bar.
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

`claude-plan-review` was invoked with the empty-minimap fix context and screenshot paths after the latest PlayMode evidence; the local wrapper timed out after 120 seconds. It was also invoked before the latest planner-map slice and timed out after 120 seconds. For the minimap/radar readability slice, a PNG-backed review failed with a local `charmap` encoding error and the follow-up path-only review timed out after 120 seconds. No actionable review feedback was returned.
