# Test Protocol

## Scope

Player UI regression controls, minimap evidence, navigation/combat popups, Kill Momentum keybind and braking authority, autopilot flip/decel and obstacle avoidance coverage, and RCS VFX direction checks.

## Evidence

- Latest Basic legacy-window gating slice:
  - Fix: `PrototypeUiLayoutManager.HandleFunctionKeys(...)` now blocks legacy IMGUI F2 diagnostics, F3 Debug Console, and F4 Prototype Flight HUD routing while `PrototypeUiPreset.Basic` is active, matching the existing Basic guards for F5 Minimap and F7 legacy Weapon Computer.
  - Developer presets keep the legacy tooling routes: FlightTest, RcsTest and FullDiagnostics still allow F2/F3/F4/F5/F7.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs`: PASS, 0 errors.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
  - Unity MCP EditMode job `8dc042d2a99e41fa9ab74395cf0dc05d`: `PrototypePlayerHudValidationTests.BasicPresetBlocksLegacyF2F3F4F5F7PresetRouting` PASS 1/1.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
  - Scope note: F1 remains the Player HUD help route in Basic and is not changed by this slice.
- Latest minimap Sqrt-Projection slice:
  - Update: `PrototypePlayerHud.cs` and `PrototypePlayerHudValidationTests.cs` were extended with nonlinear radar projection and corresponding tests.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/PlayMode/PrototypePlayerHudRuntimeEvidenceExporter.cs`: PASS, 0 errors, existing warnings only.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
  - Unity MCP PlayMode test `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`: PASS 1/1 (executed before the projection patch).
  - Manual Unity MCP GameView screenshot after patch: `tests/screenshots/minimap-live-sqrt-projection-after.png`.
  - Unity MCP EditMode job `4a26bdd9c1fb4a3facecb3e88fa20a28`: focused minimap/radar projection and adjacent radar regressions PASS 5/5:
    - `PrototypePlayerHudValidationTests.RadarWorldToLayerPointExpandsCloseContactsForMidRangeImageLayer`
    - `PrototypePlayerHudValidationTests.RadarGraphicClampRadarPointExpandsCloseContactsForMidRange`
    - `PrototypePlayerHudValidationTests.RadarAutoRangeUsesMidZoomForMediumDistanceNavigationTarget`
    - `PrototypePlayerHudValidationTests.RadarTextUsesSnapshotAutoRangeLabelAndContactCount`
    - `PrototypePlayerHudValidationTests.RadarSnapshotCollectsGameplayBlipsRoutePreviewAndHazards`
- Latest live minimap readability follow-up:
  - Live MCP screenshot before the patch showed the top-right radar was technically populated (`31 contacts`) but still read as empty because the panel was too small and the contact cluster was visually weak.
  - Fix: enlarge the compact radar, increase grid/route/preview/blip contrast and size, raise the uGUI blip pool from 36 to 64 contacts, and sort radar contacts so selected navigation/combat blips render above lower-priority map contacts.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
  - Unity MCP EditMode radar data job `5b268d58d423458684feeb1b994ba952`: 4/4 passed.
  - Unity MCP EditMode responsive layout job `a2043a2afa754a4da5b0a3d34ad59415`: 3/3 passed.
  - Unity MCP PlayMode screenshot job `baa19a6323d44cf4b5f7df007220be60`: 1/1 passed.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
  - Screenshot before patch: `tests/screenshots/minimap-live-empty-diagnostic-1280x720.png`
  - Screenshot after patch: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Live MCP screenshot after patch: `tests/screenshots/minimap-live-readable-diagnostic-1280x720.png`
  - Visual check: the top-right radar is now a larger readable map with strong grid lines, visible selected/actionable contact blips, route/preview cues, and `Range 2.5 km | 34 contacts` without overlapping the top strip, context panel, or bottom bar.
- Latest player combat-control keybind pass:
  - Fix: the player HUD now routes `C` to the next combat target through the existing `PrototypeWeaponComputer` API, so Basic Player view can select targets without opening the legacy IMGUI Weapon Computer.
  - Fix: player help/catalog now documents `C cycle combat target` alongside `F7: combat computer`. The earlier reviewed `Shift+C` idea was dropped because it conflicts with the existing Shift throttle-up binding.
  - Test hardening: the PlayMode radar screenshot marker check now maps the `RadarPanel` through the HUD canvas rect into the rendered screenshot, avoiding false negatives when the camera renders into a test RenderTexture.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Scripts/Prototype/PrototypeInputBindingCatalog.cs`: PASS, 0 errors.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
    - `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: PASS, 0 errors, existing warnings only.
  - Unity MCP EditMode focused HUD controls job `9abea7c223dd4874b322e796e1f452dd`: 5/5 passed.
  - Unity MCP PlayMode screenshot job `952bded41bbe40bfb6724827742e90f3`: 1/1 passed.
  - Screenshot: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-nav-planner-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-combat-computer-1280x720.png`
- Latest minimap non-empty clarity pass:
  - Root cause: the compact player radar could be technically populated but still read as empty because the status label only showed range and the uGUI layer did not draw a direct selected-target route when no autopilot route had been generated yet.
  - Fix: the compact radar now shows the contact count in its status label and draws a direct route line from the ship to the selected navigation target when route planning has not produced a multi-point route.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, existing warnings only.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
  - Unity MCP EditMode focused radar/planner job `2d88ed1dd1444e6cb24dba04845b14f9`: 5/5 passed, including direct-route fallback and `Range 250 m | 1 contact` label coverage.
  - Unity MCP PlayMode screenshot job `d2e47450d9684324815b78d28ac3b83a`: 1/1 passed.
  - Screenshot: `tests/screenshots/player-ui-regression-radar-normal-1280x720.png`
  - Screenshot: `tests/screenshots/player-ui-regression-nav-planner-1280x720.png`
  - Visual check: normal Basic Player HUD radar shows grid, visible blips, selected-route line, and `Range 1 km | 34 contacts`; no legacy IMGUI windows overlap the Basic screenshot.
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

## Latest: minimap combat fallback discovery slice

- Change: `PrototypePlayerHud.cs` now adds a guarded fallback in `AddCombatRadarBlips` that invokes
  `PrototypeWeaponTarget.DiscoverInto(..., includeDebugFallback: true)` only when `weaponComputer.AvailableTargets`
  plus registry-derived combat sources add zero combat blips.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors (2 existing analyzer warnings).
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors.
- Unity MCP EditMode job `7cf8a086444e438ab94031cf4418d7fb`: `PrototypePlayerHudValidationTests.RadarSnapshotFallsBackToCombatTargetDiscoveryWhenWeaponSourcesAreEmpty` PASS 1/1.
- Unity MCP EditMode job `70309e478e2248859d30d76aabb66c3a`: adjacent radar regressions PASS 4/4.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: PASS, 0 errors, 22 existing Unity/generated assembly warnings.
- Manual Unity MCP GameView screenshot after patch: `tests/screenshots/minimap-combat-fallback-live-after.png`.
- Note: combined first attempt `d574a6844dc44a7bb807bbf799c992b6` failed to initialize in the Unity test runner; the single fallback run and adjacent radar regression run above passed afterward.

## External Review

`claude-plan-review` was invoked for the player combat-control keybind slice with the touched file list and screenshot paths. The review flagged `Shift+C` as a conflict with the existing Shift throttle-up binding; that shortcut was removed before final verification, leaving the lower-conflict `C` next-combat-target binding and the existing uGUI popup buttons for previous/auto/prio controls.

`claude-plan-review` was invoked for the live minimap readability follow-up with before/after screenshot paths. Direct PNG attachment failed with the local `charmap` binary-encoding issue; the path-only retry timed out after 120 seconds, so no actionable Claude feedback was returned for this slice.

`claude-plan-review` was invoked with the empty-minimap fix context and screenshot paths after the latest PlayMode evidence; the local wrapper timed out after 120 seconds. It was also invoked before the latest planner-map slice and timed out after 120 seconds. For the minimap/radar readability slice, a PNG-backed review failed with a local `charmap` encoding error and the follow-up path-only review timed out after 120 seconds. No actionable review feedback was returned.
