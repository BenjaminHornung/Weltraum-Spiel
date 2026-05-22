# player-navigation-computer-ui-v1 Test Protocol

Date: 2026-05-22

## Scope

- Added a compact Navigation Computer control row to the Player HUD context panel.
- Reused existing waypoint/autopilot/trajectory-preview APIs for target cycling, autopilot engage/abort, replanning, and preview toggling.
- Verified that the controls stay within the context panel and do not overlap the context body, gauges, radar, bottom bar, or side panels across the existing HUD aspect-ratio checks.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs` | PASS | 0 errors, 2 pre-existing warnings for FixedUpdate Rigidbody operations and string concat in Update. |
| Unity MCP `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` | PASS | Job `4beabbf3546f42c7a7bd73f9a5875b87`, 25/25 passed. |
| Unity MCP EditMode `PrototypePlayerHudValidationTests` + `PrototypeUiArchitectureValidationTests` | PASS | Job `53fe568c11d24e019c83d6d0a62b1f1c`, 35/35 passed. |
| `dotnet build "Weltraum Spiel.sln" --no-restore` | PASS | Exit code 0, 25 known Unity/reference warnings, 0 errors. |
| DevToolbox `specs_validate player-navigation-computer-ui-v1` | PASS | 6 tasks parsed. |
| DevToolbox `verify_run f54873d6431d421eb1bd709fe7227448` | BLOCKED BY DEFAULT COMMANDS | Specs step passed; generic `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011 / multiple project files because no explicit solution/workspace argument was supplied. Explicit solution build and Unity MCP checks above passed. |
| Runtime Unity MCP HUD probe | PASS | `hud=True, weaponPanelVisible=False, combatTarget=none, nav=Nav Waypoint 2, navControls=True, preview=True`. |
| Unity MCP GameView screenshot | PASS | `tests/screenshots/player-navigation-computer-ui-v1-gameview.png`. |
| Unity console after GameView capture | PASS | 0 log entries. |

## Aspect-Ratio Coverage

`ResponsiveLayoutKeepsNavigationComputerControlsSeparated` forces the Player HUD layout over:

- 2560 x 1080
- 1920 x 1080
- 1280 x 720
- 1024 x 768
- 900 x 1600
- 640 x 480

For each size it asserts:

- `NavigationControls` is active in Navigation context.
- The control row does not overlap `ContextBody`.
- The control row does not overlap `ContextGauges`.
- Each of `Prev`, `Next`, `Engage`, `Plan`, and `Preview` stays inside the row.
- Adjacent buttons do not overlap each other.

## Screenshot

![Navigation Computer UI GameView](screenshots/player-navigation-computer-ui-v1-gameview.png)
