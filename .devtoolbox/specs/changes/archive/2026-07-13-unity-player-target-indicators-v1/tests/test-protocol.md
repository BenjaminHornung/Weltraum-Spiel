# Test Protocol - player-target-indicators-v1

Date: 2026-05-24
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scope

Adds player-facing screen-space target indicators to the existing Player HUD. The slice covers selected navigation target, selected combat target, active docking target, and arena objective targets. It also adds projection/clamping and compact label behavior so target text does not collide with fixed HUD panels or other target labels when the aspect ratio changes.

This update closes the previous Unity MCP visual-evidence gap. The earlier untracked screenshot included a debug Weapon Computer IMGUI window and was not suitable as final Basic-player evidence. It has been overwritten by a fresh PlayMode capture from the real `PrototypeBootstrap` runtime.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Claude plan review | ATTEMPTED/BLOCKED | `review_plan` failed in the local wrapper with `charmap` encoding on project file context for the first screenshot pass and again for the aspect-evidence plan. No actionable findings were produced. |
| DevToolbox specs validation | PASS | `specs_validate` for `player-target-indicators-v1` passed. |
| Unity MCP script validation | PASS | `validate_script Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: 0 errors, 3 existing analyzer warnings. `validate_script Assets/Tests/Editor/PrototypePlayerHudEvidenceManifestValidationTests.cs`: 0 errors, 0 warnings. |
| Unity MCP focused PlayMode evidence | PASS | `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicators` passed as job `6bdb608ac102409aa0c988e796e639fd`, 1/1. |
| Unity MCP target aspect evidence | PASS | `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicatorAspectMatrix` passed as job `0f8c988b3b714c3a947e7c65ef1fcb86`, 1/1. A prior job `6329839ea8204ae0a3b8aa792739c3af` produced screenshots and Unity XML PASS, but MCP later marked it failed to initialize. |
| Screenshot evidence | PASS | `.devtoolbox/specs/changes/player-target-indicators-v1/tests/screenshots/player-target-indicators-v1-gameview.png`, `player-target-indicators-v1-4x3-1024x768.png`, `player-target-indicators-v1-ultrawide-2560x1080.png`, and `player-target-indicators-v1-portrait-900x1600.png`, captured from the real Bootstrap runtime with Basic Player HUD, no debug IMGUI weapon window, navigation/combat/objective indicators, and separated HUD panels. |
| Manifest validation | PASS | `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders` passed as job `d3242bf5d8a34f7f8768a600a3895c0c`, 1/1, with the target-indicator aspect screenshots registered. |
| Explicit solution build | PASS | `dotnet build 'Weltraum Spiel.sln' --no-restore`: 0 errors, 22 existing Unity/project warnings. |
| DevToolbox `verify_run` | PARTIAL/BLOCKED | Executions `4a35aa6cd4014130ade573c0339da087` and `b9c37d97237e451a95450261c8a5a571`: Specs PASS; generic root Build/Test/Lint FAIL with `MSB1011` / multiple MSBuild project files. |
| DevToolbox completion preflight | BLOCKED | Source line 7 remained unchecked because the latest linked DevToolbox verification is failed by the generic root Lint preset; latest preflight `62da1b3912c64b5184b6a3a41d65df88`. |

## Implemented Checks

- `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets` verifies that the snapshot contains selected nav, selected combat, active docking, and objective indicators, and that docking does not appear without an active docking target.
- `TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels` verifies offscreen/behind-camera clamping, right-panel safe area bounds, tiny-viewport label suppression, and active target-label non-overlap.
- `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicators` verifies the real Bootstrap PlayMode runtime has navigation, combat, and objective target indicators in the Basic Player HUD, keeps docking inactive for this evidence state, captures the GameView screenshot, checks fixed panel separation, and checks active button text overflow.
- `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesTargetIndicatorAspectMatrix` repeats that live target-indicator state at 1024x768, 2560x1080, and 900x1600, then checks navigation/combat/objective indicators, no docking marker, fixed panel separation, active button text overflow, and target-label collisions against other labels and fixed panels.
- Existing HUD regression tests remain in the focused HUD suite, including responsive layout and no duplicate IMGUI radar path coverage.

## Notes

- The first 2026-05-24 PlayMode MCP job `430ab67618e24ee2b2e50be15f0630eb` stayed stale in the MCP job registry while Unity returned to idle. A second focused job completed successfully and produced the committed screenshot.
- The first target-aspect matrix job `6329839ea8204ae0a3b8aa792739c3af` also had stale MCP job reporting: Unity wrote `TestResults.xml` with `result="Passed"` and generated all three aspect screenshots, but the MCP job later reported failed initialization. The rerun job `0f8c988b3b714c3a947e7c65ef1fcb86` reported PASS through MCP.
- DevToolbox generic `verify_run` is expected to remain limited in this Unity repository because root-level `dotnet build`, `dotnet test`, and `dotnet format` cannot choose between multiple project/solution files. Scoped Unity MCP tests and explicit solution builds are the meaningful verification path.
- Tasks remain unchecked until the DevToolbox completion gate can consume scoped Unity verification instead of the generic root .NET presets.
