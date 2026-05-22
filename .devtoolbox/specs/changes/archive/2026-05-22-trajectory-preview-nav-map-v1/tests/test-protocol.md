# Test Protocol: Trajectory Preview Nav Map v1

## Scope

- Bounded runtime trajectory preview source and status reporting.
- Reuse of `TrajectoryPredictor`, `ShipPhysicsCore` central gravity, `TrajectoryBurnPlan`, `PrototypeWaypointAutopilot`, `PrototypePlayerHud`, and `PrototypeMinimapOverlay`.
- Toggleable HUD/minimap route exposure with finite-state fail-safe behavior.
- Explicit exclusion of full N-body, patched conics, SOI transitions, maneuver-node editing, full orbital map gameplay, persistent route planning, and unbounded prediction.

## Evidence Log

| Step | Command / Tool | Result |
| --- | --- | --- |
| 1 | DevToolbox `specs_validate` for `trajectory-preview-nav-map-v1` | Passed before implementation; proposal, design, spec, tasks, task parsing, and change root checks passed. |
| 2 | Source guard in `verify-trajectory-preview-nav-map.ps1` | Passed; required reuse/safety tokens were present and out-of-scope source tokens were absent. |
| 3 | Unity `validate_script` for `PrototypeTrajectoryPreviewNavMap.cs`, `PrototypePlayerHud.cs`, `PrototypeMinimapOverlay.cs`, `PrototypeBootstrap.cs`, and `TrajectoryPreviewPredictionTests.cs` | Passed with 0 errors. HUD reported existing analyzer hints only. |
| 4 | Unity focused EditMode job `1078b17ecf7c4a90a8e91ff00ba40ebf` for `TrajectoryPreviewPredictionTests` | Passed 9/9. |
| 5 | `dotnet build "Weltraum Spiel.sln" --no-restore` | Passed with 0 errors and known project/MSBuild warnings, including Unity/MCP `MSB3277` assembly binding warnings. |
| 6 | `dotnet test "Weltraum Spiel.sln" --no-build --filter "FullyQualifiedName~TrajectoryPreviewPredictionTests"` | Passed, exit code 0. |
| 7 | `powershell -NoProfile -ExecutionPolicy Bypass -File ".devtoolbox\specs\changes\trajectory-preview-nav-map-v1\tests\verify-trajectory-preview-nav-map.ps1"` | Passed; wrapper reran source guards, `dotnet build`, and focused `dotnet test`. |
| 8 | DevToolbox `verify_fresh` for execution `26dbea5d50474d75afb0ab86d784ea44` | Passed specs validation and wrapper verification; DevToolbox recorded a minor review comment for known Unity/MCP `MSB3277` warnings, with exit code 0 and 0 errors. |

## Notes

- Preview rendering is a bounded local route overlay, not an orbital solver.
- The preview source filters non-finite route points before HUD or minimap rendering receives them.
- Disabled, unavailable, empty, valid, and truncated states are intentionally separate for deterministic tests and player-facing status.
