# Test Protocol - player-target-indicators-v1

Date: 2026-05-24
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scope

Adds player-facing screen-space target indicators to the existing Player HUD. The slice covers selected navigation target, selected combat target, active docking target, and arena objective targets. It also adds projection/clamping and compact label behavior so target text does not collide with fixed HUD panels or other target labels when the aspect ratio changes.

This update closes the previous Unity MCP visual-evidence gap. The earlier untracked screenshot included a debug Weapon Computer IMGUI window and was not suitable as final Basic-player evidence. It has been overwritten by a fresh PlayMode capture from the real `PrototypeBootstrap` runtime.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Claude plan review | ATTEMPTED/BLOCKED | `review_plan` failed in the local wrapper with `charmap` encoding on project file context. No actionable findings were produced. |
| DevToolbox specs validation | PASS | `specs_validate` for `player-target-indicators-v1` passed. |
| Unity MCP script validation | PASS | `validate_script Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: 0 errors, 3 existing analyzer warnings. `validate_script Assets/Tests/Editor/PrototypePlayerHudEvidenceManifestValidationTests.cs`: 0 errors, 0 warnings. |
| Unity MCP focused PlayMode evidence | PASS | `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicators` passed as job `6bdb608ac102409aa0c988e796e639fd`, 1/1. |
| Screenshot evidence | PASS | `.devtoolbox/specs/changes/player-target-indicators-v1/tests/screenshots/player-target-indicators-v1-gameview.png`, captured at 1280x720 from the real Bootstrap runtime with Basic Player HUD, no debug IMGUI weapon window, navigation/combat/objective indicators, and separated HUD panels. |
| Explicit solution build | PASS | `dotnet build 'Weltraum Spiel.sln' --no-restore`: 0 errors, 22 existing Unity/project warnings. |
| DevToolbox `verify_run` | PARTIAL/BLOCKED | Execution `4a35aa6cd4014130ade573c0339da087`: Specs PASS; generic root Build/Test/Lint FAIL with `MSB1011` / multiple MSBuild project files. |
| DevToolbox completion preflight | BLOCKED | Source line 7 remained unchecked because the latest linked DevToolbox verification is failed by the generic root Lint preset. |

## Implemented Checks

- `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets` verifies that the snapshot contains selected nav, selected combat, active docking, and objective indicators, and that docking does not appear without an active docking target.
- `TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels` verifies offscreen/behind-camera clamping, right-panel safe area bounds, tiny-viewport label suppression, and active target-label non-overlap.
- `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicators` verifies the real Bootstrap PlayMode runtime has navigation, combat, and objective target indicators in the Basic Player HUD, keeps docking inactive for this evidence state, captures the GameView screenshot, checks fixed panel separation, and checks active button text overflow.
- Existing HUD regression tests remain in the focused HUD suite, including responsive layout and no duplicate IMGUI radar path coverage.

## Notes

- The first 2026-05-24 PlayMode MCP job `430ab67618e24ee2b2e50be15f0630eb` stayed stale in the MCP job registry while Unity returned to idle. A second focused job completed successfully and produced the committed screenshot.
- DevToolbox generic `verify_run` is expected to remain limited in this Unity repository because root-level `dotnet build`, `dotnet test`, and `dotnet format` cannot choose between multiple project/solution files. Scoped Unity MCP tests and explicit solution builds are the meaningful verification path.
- Tasks remain unchecked until the DevToolbox completion gate can consume scoped Unity verification instead of the generic root .NET presets.
