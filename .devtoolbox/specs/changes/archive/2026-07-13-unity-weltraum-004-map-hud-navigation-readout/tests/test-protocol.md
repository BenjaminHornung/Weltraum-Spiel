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

## Final Verification - 2026-05-31

- Unity script validation passed for:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs` with 0 errors and 3 existing HUD performance warnings.
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs` with 0 errors and 0 warnings.
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs` with 0 errors and 0 warnings.
  - `Assets/Tests/PlayMode/PrototypeRuntimeHudCameraBootstrapPlayModeTests.cs` with 0 errors and 0 warnings.
- Unity EditMode targeted `PrototypePlayerHudValidationTests` passed: 5 total, 5 passed, 0 failed.
- Unity PlayMode targeted `PrototypeRuntimeHudCameraBootstrapPlayModeTests.PlayMode_BootstrapAppliesCatalogFallbackToNavigationReadout` passed: 1 total, 1 passed, 0 failed.
- `dotnet build "Weltraum Spiel.sln" --no-restore` passed with 0 errors and known Unity/project warnings.
- `specs_validate` for `weltraum-004-map-hud-navigation-readout` passed.
- `git diff --check` for scoped 004 files passed; only LF/CRLF warnings were reported.

## Review Closeout

- Pre-implementation `zai-ui-glm51` review blocked naive body-line expansion and raw debug ID display; implementation uses one compact pilot-safe line instead.
- Final `zai-ui-glm51` review blockers were resolved:
  - missing display names now use safe pilot labels instead of raw IDs.
  - large distances now format as `Mkm` or `AU`.
  - the spec now describes pilot-safe display names and keeps raw IDs debug-only.
- Reviewer finding was resolved:
  - active replan/obstacle diagnostics are preserved in the compact context line when non-default.
- `PrototypeMinimapOverlay`, DirectFastTransfer, autopilot execution, timewarp, drones, and final System Map UX remain out of scope.

## Z.AI Final Blocker Fixes

- Pilot-facing celestial context now uses safe fallback labels (`Unknown body`) instead of raw IDs when display names are missing.
- Raw body/parent body IDs are retained only in debug payloads (`DebugBodyId`, `DebugParentBodyId`) and are excluded from rendered planner body text.
- Celestial context distance formatting now escalates units to `Mkm` above 1e6 m and `AU` at 1e9 m (AU conversion uses 149,597,870,700 m).
- Added editor tests for ID leakage prevention and large-distance formatting verification through private renderer helpers.

## Implementation Notes (Phase 1 complete)

- Added `PrototypePlayerNavigationCelestialContext` to `PrototypePlayerHud.cs` as a compact nested readonly struct and exposed it as a single `CelestialContext` member on `PrototypePlayerNavigationSnapshot`.
- Extended `PrototypePlayerHudSnapshotBuilder.Build(...)` and `PrototypePlayerHudRenderer.Bind(...)` signatures with optional `CelestialBodyCatalog` inputs to carry catalog-derived context into the HUD snapshot/render path without changing autopilot behavior.
- Implemented deterministic, null-safe context resolution in `PrototypePlayerHud`:
  - Build map snapshot once through `CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(...)`.
  - Try direct name/GameObject match against autopilot target.
  - Fall back to nearest-body matching when name mapping is unavailable.
  - Keep read-only labels pilot-safe; retain raw IDs only for telemetry/debug fields in structs.
- Changed navigation planner body render to replace the low-signal diagnostic line with a compact context line when `CelestialContext.HasContext` is true (`BuildNavigationPlannerBody`), preventing panel growth while preserving previous fallback text when absent.
- Added 004-owned test coverage:
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`
    - context appears when catalog is supplied to `PrototypePlayerHudSnapshotBuilder`.
    - context stays absent when catalog input is missing.
    - body readout still uses compact context when present and old obstacle/replan diagnostics when absent.
  - `Assets/Tests/PlayMode/PrototypeRuntimeHudCameraBootstrapPlayModeTests.cs`
    - bootstrap builds navigation context via catalog fallback and exposes it in `LastSnapshot.Navigation.CelestialContext`.
- No autopilot logic, map panel geometry, or minimap behavior was changed in phase 1.

## Pre-ZAI Findings (as requested to track)

- HUD output now avoids exposing raw body IDs or parent IDs in player-facing text; tests assert no body-id leakage in rendered planner body lines.
- `NavigationPlannerBody` no longer appends extra debug-only lines when context exists; it swaps in the compact pilot-facing context line.
- Bootstrap catalog fallback path is exercised from tests using runtime bootstrap + default wiring (no explicit scene catalog injection).
- Reviewer finding `NavigationPlannerBody` hides active obstacle/replan diagnostics when celestial context is present was resolved: compact context now appends diagnostics whenever obstacle summary or replan status is non-default, while staying context-only for default/no-obstacle states.
