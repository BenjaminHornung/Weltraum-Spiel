# Test Protocol: Autopilot Navigation Computer v2

## Scope
Evidence for `prototype-autopilot-navigation-computer-v2`.

## Environment
- Branch: `feature/autopilot-navigation-computer-v2-validation`
- Baseline commit: `eb53503b0ca3df921b4034eadd59ce4774a4b0b4`
- Final commit: pending
- Unity version: `6000.4.7f1`
- Worktree: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
- Unity MCP project: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

## MCP Status
- Unity MCP custom tools: connected, 30 tools reported.
- Unity MCP project info: connected, Unity `6000.4.7f1`, platform `StandaloneWindows64`.
- Editor state: first read timed out; will retry after script changes/import.

## Verification Results
| Check | Result | Evidence |
| --- | --- | --- |
| `specs_validate` | Pending | Run after scaffold and implementation. |
| Script validation | Pending | Unity MCP `validate_script` for changed scripts. |
| Unity console | Pending | `tests/logs/unity-mcp-console.md`. |
| EditMode tests | Pending | `tests/logs/editmode-results.xml`, `tests/logs/editmode.log`. |
| PlayMode tests | Pending | `tests/logs/playmode-results.xml`, `tests/logs/playmode.log`. |
| GUI screenshots | Pending | `tests/screenshots/*.png`. |
| Static Rigidbody write guard | Pending | Source scan and EditMode test. |

## Iterations
- Initial setup preserved dirty workspace changes and created the v2 branch from current `origin/main`/`main` at `eb53503`.

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
- Pending final verification.
