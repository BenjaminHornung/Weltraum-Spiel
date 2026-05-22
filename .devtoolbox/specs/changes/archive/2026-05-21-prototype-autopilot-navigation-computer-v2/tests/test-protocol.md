# Test Protocol: Autopilot Navigation Computer v2

## Scope
Evidence for `prototype-autopilot-navigation-computer-v2`.

## Environment
- Branch: `feature/autopilot-navigation-computer-v2-validation`
- Baseline commit: `eb53503b0ca3df921b4034eadd59ce4774a4b0b4`
- Implementation commit under verification: `0d0f878`
- Final closeout commit: reported by Codex after committing this protocol
- Unity version: `6000.4.7f1`
- Worktree: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
- Unity MCP project: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## MCP Status
- Initial Unity MCP discovery connected to the project and reported Unity `6000.4.7f1`.
- A focused MCP test attempt later stalled on unrelated pre-existing tests outside this v2 slice.
- At final closeout no active Unity Editor instance was available through MCP, so final verification used Unity batchmode.
- Console/fallback status is recorded in `tests/logs/unity-mcp-console.md`.

## Verification Results
| Check | Result | Evidence |
| --- | --- | --- |
| `dotnet build "Weltraum Spiel.sln" --no-restore -v:minimal` | Passed | Build completed with two existing `MSB3277` warnings, 0 errors. |
| `specs_validate` | Passed | 1 spec file, 11 task items validated after implementation. |
| Script validation | Passed by compile/test fallback | Unity batchmode compile and focused EditMode/PlayMode suites completed successfully. |
| Unity console | Recorded fallback | `tests/logs/unity-mcp-console.md`. |
| EditMode tests | Passed: total 19, passed 19, failed 0, skipped 0 | `tests/logs/editmode-results.xml`, `tests/logs/editmode.log`. |
| PlayMode tests | Passed: total 6, passed 6, failed 0, skipped 0 | `tests/logs/playmode-results.xml`, `tests/logs/playmode.log`. |
| GUI screenshots | Captured synthetic/headless | `tests/screenshots/*.png`. |
| Performance budget | Passed | `tests/performance/autopilot-step-budget.csv`. |
| Static Rigidbody write guard | Passed | `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_DoesNotWriteRigidbodyStateDirectly`. |

## Commands

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore -v:minimal
```

```powershell
& "C:\Program Files\Unity\Hub\Editor\6000.4.7f1\Editor\Unity.exe" `
  -batchmode -nographics `
  -projectPath "E:\Unity\Weltraum Spiel\Weltraum Spiel" `
  -runTests -testPlatform EditMode `
  -testFilter PrototypeAutopilotNavigationComputerV2ValidationTests `
  -testResults ".devtoolbox\specs\changes\prototype-autopilot-navigation-computer-v2\tests\logs\editmode-results.xml" `
  -logFile ".devtoolbox\specs\changes\prototype-autopilot-navigation-computer-v2\tests\logs\editmode.log"
```

```powershell
& "C:\Program Files\Unity\Hub\Editor\6000.4.7f1\Editor\Unity.exe" `
  -batchmode -nographics `
  -projectPath "E:\Unity\Weltraum Spiel\Weltraum Spiel" `
  -runTests -testPlatform PlayMode `
  -testFilter PrototypeAutopilotNavigationPlayModeTests `
  -testResults ".devtoolbox\specs\changes\prototype-autopilot-navigation-computer-v2\tests\logs\playmode-results.xml" `
  -logFile ".devtoolbox\specs\changes\prototype-autopilot-navigation-computer-v2\tests\logs\playmode.log"
```

## Iterations
- Initial setup preserved dirty workspace changes and created the v2 branch from current `origin/main`/`main` at `eb53503`.
- Added start-overlap obstacle detection and registry/cached obstacle fallback so obstacles already inside the safety sphere are detected.
- Expanded trajectory planning from one rejection vector to scored direct/side/up/diagonal candidates with burn plan, predicted path, fuel, brake, and RCS authority diagnostics.
- Added persistent navigation phases and stable avoidance waypoint handling so avoidance does not oscillate frame to frame.
- Adjusted hold confirmation and avoidance-lock seams in the deterministic PlayMode harness while keeping separate EditMode coverage for hold windows and avoidance persistence.
- PlayMode initially needed a deterministic rig rather than relying on a pre-existing scene; final tests spawn their own minimal ship, target, obstacles, and actuator setup.

## Evidence Paths
- `tests/logs/editmode-results.xml`
- `tests/logs/editmode.log`
- `tests/logs/playmode-results.xml`
- `tests/logs/playmode.log`
- `tests/logs/unity-mcp-console.md`
- `tests/screenshots/direct-route.png`
- `tests/screenshots/obstacle-detected.png`
- `tests/screenshots/avoidance-active.png`
- `tests/screenshots/reacquire-direct-path.png`
- `tests/screenshots/final-hold.png`
- `tests/screenshots/navigation-computer-gui.png`
- `tests/headless/`
- `tests/playmode/`
- `tests/performance/autopilot-step-budget.csv`

## Known Limits
- Final screenshots are synthetic/headless PNGs, not real GameView captures, because Unity MCP was unavailable at closeout.
- PlayMode tests use a deterministic spawned rig and set zero hold/avoidance lock timing for synchronous assertions; EditMode tests cover the real hold window and avoidance waypoint persistence behavior.
- Full all-project Unity suites were not used for the final gate because unrelated pre-existing tests outside this v2 slice were failing or hanging during earlier attempts.
- `TrajectoryPredictor` now supports simplified actuator simulation for candidates, but it is still a prototype planner rather than a high-fidelity orbital or attitude-control optimizer.
