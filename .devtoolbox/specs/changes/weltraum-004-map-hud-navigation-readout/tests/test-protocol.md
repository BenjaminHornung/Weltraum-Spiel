# Test Protocol: weltraum-004-map-hud-navigation-readout

Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scaffold Evidence - 2026-05-31

- Created DevToolbox change artifacts for `weltraum-004-map-hud-navigation-readout`.
- This pass is planning/scaffold only; no runtime code was implemented.
- Initial read-only discovery identified reuse targets:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`
  - `Assets/Scripts/Prototype/PrototypeMinimapOverlay.cs`
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
  - `Assets/Scripts/Prototype/Celestial/PrototypeOrbitMapDebugWindow.cs`
  - `Assets/Scripts/Prototype/Celestial/CelestialOrbitMapSnapshotBuilder.cs`
- Initial test surfaces to inspect during implementation:
  - `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`
  - `Assets/Tests/Editor/PrototypeTestEnvironmentValidationTests.cs`
  - `Assets/Tests/Editor/TrajectoryPreviewPredictionTests.cs`

## Coordination Notes

- `weltraum-002-orbit-map-prototype` is the prerequisite source for catalog/orbit-map values.
- Parallel DirectFastTransfer/autopilot/benchmark files are out of scope and must not be modified, reverted, staged, or committed by this change.
- Z.AI UI review is required before visible UI implementation and again after screenshot evidence.

## Verification To Run After Scaffold

- `specs_validate` for `weltraum-004-map-hud-navigation-readout`.
