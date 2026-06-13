# Acceptance Evidence

Date: 2026-06-13

## Passing Checks

- `git diff --cached --check` passed before the HUD radar cache reset commit.
- Commit-view build after `07217a8`: `dotnet build "Weltraum Spiel.sln" --no-restore` exited 0 with the known Unity/MSBuild warnings and 0 errors.
- Unity MCP EditMode targeted regression after `07217a8`: 2/2 passed.
  - `PrototypePlayerHudValidationTests.RadarSnapshotCollectsGameplayBlipsRoutePreviewAndHazards`
  - `PrototypePlayerHudValidationTests.RadarSnapshotFallsBackToSceneNavigationTargetsWhenAutopilotManagerIsMissing`
- Unity MCP PlayMode smoke after `07217a8`: 1/1 passed.
  - `PrototypeRuntimeHudCameraBootstrapPlayModeTests.PlayMode_BootstrapShowsBoundHudShipAndDefaultNavigationTarget`

## Full EditMode Status

Full Unity MCP EditMode was rerun on a C# commit-view after the HUD radar cache reset. It is not green: 427 tests ran, 21 failed.

The Quick-Wins HUD radar failures from the previous run are fixed. Remaining failures are outside the narrow Item 5/6 radar/text-refresh regression:

- Autopilot/navigation behavior expectations: `PrototypeAutopilotMomentumStartupStateTests`, `PrototypeAutopilotNavigationComputerV2ValidationTests`, `PrototypeWaypointAutopilotValidationTests`, and `PrototypeHeadlessScenarioValidationTests`.
- Variant/control/evidence expectations: `PrototypeControlModeValidationTests`, `PrototypeShipVariantValidationTests`, and `PrototypePerformancePlayModeEvidenceTests`.
- Evidence-manifest file state: `PrototypePlayerHudEvidenceManifestValidationTests` still sees missing archived screenshot evidence in the current shared working tree.
- Planner UI expectation: `PrototypePlayerHudValidationTests.NavigationSnapshotUsesEmittedFlightPlanForPlannerScheduleRows`.

Because the full EditMode suite remains red, the `tasks.md` Abnahme checkbox for "EditMode-Suite gruen; PlayMode-Smoke gruen" is intentionally left open. The focused Quick-Wins regression checks and the available PlayMode smoke are green.
