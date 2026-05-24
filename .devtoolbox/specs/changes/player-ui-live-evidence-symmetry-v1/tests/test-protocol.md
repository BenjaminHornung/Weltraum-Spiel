# Test Protocol - player-ui-live-evidence-symmetry-v1

## Scope

This slice adds missing live 4:3 runtime evidence for the Player HUD concept audit. It does not change gameplay behavior; it strengthens proof for cruise/objective and navigation/autopilot states using the real `PrototypeBootstrap` runtime.

## Verification Log

| Check | Result | Evidence |
| --- | --- | --- |
| Claude plan review | ATTEMPTED | First call failed on concept-doc encoding; second call timed out after 120s. Treated as non-blocking review input because the plan was evidence-only and locally bounded. |
| Unity MCP `validate_script` - `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs` | PASS | 0 errors, 3 broad warnings. |
| Unity MCP PlayMode 4:3 cruise/navigation evidence | PASS | Job `383d0d0cbc4b44e4b47bb7bc77fc88ee`, 1/1 passed. Earlier job `b4ea7d30388444aa93e4f17ed33e0205` wrote screenshots but hit Unity initialization timeout before reporting a result. |
| Explicit solution build | PASS | `dotnet build "Weltraum Spiel.sln" --no-restore`, 22 known warnings, 0 errors. |
| DevToolbox `specs_validate` | PASS | Change `player-ui-live-evidence-symmetry-v1` parsed 5 tasks and 1 spec file. |
| DevToolbox `verify_run` | BLOCKED by generic root commands | Execution `2343212d723c410c87621ddf9eb7202a`: Specs passed; generic Build/Test/Lint failed because root `dotnet build`, `dotnet test`, and `dotnet format` do not select a project/solution in this Unity workspace (`MSB1011` / multiple project files). |

## Live Runtime Screenshots

| Screenshot | Size | State | Assertion focus |
| --- | --- | --- | --- |
| `screenshots/31-live-cruise-objective-4x3.png` | 1024x768 | Cruise/objective | Real `PrototypeBootstrap` runtime; arena/objective visible; no active combat target; Docking hidden; no combat indicator; HUD panels separated; active button text fits. |
| `screenshots/32-live-navigation-autopilot-4x3.png` | 1024x768 | Navigation/autopilot | Real `PrototypeBootstrap` runtime; waypoint selected through `PrototypeWaypointAutopilot`; Navigation visible; radar blips present; navigation target indicator present; HUD panels separated; active button text fits. |

## Notes

- Screenshots were visually reviewed after capture; the 4:3 panels remain separated and the right context panel stays readable.
- The first Unity PlayMode job produced the PNGs but exceeded the initialization result timeout; the immediate rerun passed and rewrote the same evidence files.
- The generic DevToolbox root verifier limitation is unchanged from previous Unity slices.
