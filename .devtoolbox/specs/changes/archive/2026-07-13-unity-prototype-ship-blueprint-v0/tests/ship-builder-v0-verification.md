# Ship Builder v0 Verification

Date: 2026-06-14

## Commands

- Unity script validation:
  - `Assets/Scripts/Prototype/PrototypeShipBuilderModels.cs`
  - `Assets/Scripts/Prototype/PrototypeShipBuilderViewModels.cs`
  - `Assets/Scripts/Prototype/PrototypeShipBuilderHud.cs`
  - `Assets/Scripts/Prototype/PrototypeShipBuilderMode.cs`
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`
  - `Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs`
  - `Assets/Tests/Editor/PrototypeShipBuilderV0ValidationTests.cs`
  - `Assets/Tests/PlayMode/PrototypeShipBuilderV0PlayModeTests.cs`
- Unity EditMode: `PrototypeShipBuilderV0ValidationTests`, `PrototypeShipBlueprintBuilderValidationTests`
- Unity PlayMode: `PrototypeShipBuilderV0PlayModeTests`
- Solution build: `dotnet build "Weltraum Spiel.sln" --no-restore`

## Results

- Unity script validation: passed for touched scripts. `PrototypeShipBuilderMode` and existing `PrototypePlayerHud` report performance-style warnings only.
- Unity EditMode: 12 total, 12 passed, 0 failed.
- Unity PlayMode: 3 total, 3 passed, 0 failed.
- `dotnet build`: 0 errors, 23 warnings.

## Screenshots

- `screenshots/ship-builder-hangar-1280x720.png`
- `screenshots/ship-builder-hangar-2560x1080.png`
- `screenshots/ship-builder-testflight-1280x720.png`

## Notes

- Console still contains Unity AssetManager `[SerializeReference]` serialization exception entries unrelated to the ship builder scripts.
- Screenshot artifacts were captured by `PrototypeShipBuilderV0PlayModeTests.ScreenshotEvidence_CapturesBuilderAndTestFlightPngs`.
