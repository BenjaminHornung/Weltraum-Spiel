# Test Protocol - player-world-label-readability-v1

## Scope

This slice removes debug-style world labels from the normal Training display mode when they interfere with the Player HUD center view. The environment still keeps its geometry and `PrototypeEnvironmentPoint` data for radar/minimap and diagnostics.

## Verification Log

| Check | Result | Evidence |
| --- | --- | --- |
| Claude plan review | PASS with refinements applied | Added explicit Training/FullDebug label assertions, point-data preservation, and programmatic world-label absence checks. |
| Unity MCP `validate_script` - `PrototypeTestEnvironment.cs` | PASS | 0 warnings, 0 errors. |
| Unity MCP `validate_script` - `PrototypeTestEnvironmentValidationTests.cs` | PASS | 0 warnings, 0 errors. |
| Unity MCP `validate_script` - `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs` | PASS | 0 errors, 3 broad warnings. |
| Unity MCP EditMode `PrototypeTestEnvironmentValidationTests` | PASS | Job `4c9c504abe8148e78352b033d402439b`, 11/11 passed. |
| Unity MCP PlayMode world-label evidence | PASS | Job `637775edd2ef4e6281dad62e9af664be`, 1/1 passed. |
| Explicit solution build | PASS | `dotnet build "Weltraum Spiel.sln" --no-restore`, 22 known warnings, 0 errors. |
| DevToolbox `specs_validate` | PASS | Change `player-world-label-readability-v1` parsed 6 tasks and 1 spec file. |
| DevToolbox `verify_run` | BLOCKED by generic root commands | Execution `cece8ab16526423d94b87b6e2e23f30a`: Specs passed; generic Build/Test/Lint failed because root `dotnet build`, `dotnet test`, and `dotnet format` do not select a project/solution in this Unity workspace (`MSB1011` / multiple project files). |
| DevToolbox task completion preflight | BLOCKED | Source line 3 blocked on the failed generic verification result, so tasks remain unchecked. |

## Live Runtime Screenshot

| Screenshot | Size | State | Assertion focus |
| --- | --- | --- | --- |
| `screenshots/30-live-cruise-no-origin-label-1280x720.png` | 1280x720 | Cruise/objective | Real `PrototypeBootstrap` runtime, no `ORIGIN` or `STATION / HANGAR` world TextMesh labels in Training mode, HUD panels separated. |

## Notes

- `PrototypeEnvironmentPoint` entries for Origin and Station remain present; only the large Training-mode world TextMesh labels are suppressed.
- `FullDebug` display mode still creates debug world labels, including `Label_ORIGIN` and `Label_Station`.
- The surviving first target/beacon labels are intentionally kept as small Training aids.
- The final code pass also updated the new label queries to Unity's non-obsolete `FindObjectsByType(..., FindObjectsInactive)` overloads.
