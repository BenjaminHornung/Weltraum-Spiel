# Test Protocol - player-target-indicators-v1

Date: 2026-05-22
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## Scope

Adds player-facing screen-space target indicators to the existing Player HUD. The slice covers selected navigation target, selected combat target, active docking target, and arena objective targets. It also adds projection/clamping and compact label behavior so target text does not collide with fixed HUD panels or other target labels when the aspect ratio changes.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Whitespace/diff hygiene | PASS | `git diff --check -- Assets/Scripts/Prototype/PrototypePlayerHud.cs Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs .devtoolbox/specs/changes/player-target-indicators-v1` exited 0. Only existing CRLF conversion warnings were reported. |
| Local compile | PASS | `dotnet build "Weltraum Spiel.sln" --no-restore` exited 0. Known Unity/MCP binding warnings MSB3277 for `System.Net.Http` and `System.IO.Compression`; 0 errors. |
| Focused local test command | PASS/limited output | `dotnet test "Weltraum Spiel.sln" --no-build --filter "FullyQualifiedName~PrototypePlayerHudValidationTests"` exited 0 with no useful Unity test detail, matching prior Unity project behavior. |
| Unity MCP script validation before final label-collision tweak | PASS | `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs`: 0 errors, 2 warnings. `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: 0 errors/warnings. |
| Unity MCP focused EditMode before final label-collision tweak | PASS | `PrototypePlayerHudValidationTests`: 21/21 passed, job `8d4abd7f131a4b15b44f7adac4c1e560`. Combined `PrototypePlayerHudValidationTests` + `PrototypeUiArchitectureValidationTests`: 31/31 passed, job `e1b1f2e8c0f54964a1424652999414a3`. |
| Final Unity MCP rerun after label-collision tweak | BLOCKED | `refresh_unity`, `validate_script`, `manage_scene`, `read_console`, and screenshot/test commands stopped returning Unity command results. Editor process stayed responsive, but MCP logged WebSocket keep-alive failures and `ping not answered`. See `tests/logs/unity-mcp-target-indicators-2026-05-22.md`. |
| Screenshot evidence | BLOCKED after final tweak | A pre-fix GameView screenshot caught overlapping nav/combat labels; it was removed from evidence instead of being committed as a false pass. Final real GameView capture could not be re-taken because Unity MCP transport failed after the fix. |

## Implemented Checks

- `TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets` verifies that the snapshot contains selected nav, selected combat, active docking, and objective indicators, and that docking does not appear without an active docking target.
- `TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels` verifies offscreen/behind-camera clamping, right-panel safe area bounds, tiny-viewport label suppression, and active target-label non-overlap.
- Existing HUD regression tests remain in the focused HUD suite, including responsive layout and no duplicate IMGUI radar path coverage.

## Notes

The final code-level label fix is intentionally small and is covered by `dotnet build` plus the added label-overlap assertion. A final Unity MCP GameView screenshot still needs to be captured once the MCP WebSocket session is healthy again before this slice should be considered fully visually closed.
