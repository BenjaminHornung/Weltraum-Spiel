# Test Protocol: Camera Anchor Framing

## Scope
Evidence for `prototype-camera-anchor-framing-v1`.

## Environment
- Branch: `feature/autopilot-navigation-computer-camera-anchor-v1`
- Unity version: `6000.4.7f1`
- Worktree: `E:\Unity\Weltraum Spiel\Weltraum Spiel-autopilot-navigation-computer-camera-anchor-v1`
- Note: Unity MCP is connected to `E:\Unity\Weltraum Spiel\Weltraum Spiel`, while this change is isolated in a clean sibling worktree because the original worktree contains uncommitted user changes. MCP-targeted verification is used only when it can validate explicit file paths or otherwise documented as unavailable for this worktree.

## Planned Verification
| Check | Result | Notes |
| --- | --- | --- |
| `specs_validate` | Pending | Run after spec creation. |
| `tasks_load` | Pending | Run after task creation. |
| Unity script validation | Pending | Use Unity MCP if possible; otherwise document mismatch and use local build/tests. |
| Unity/EditMode tests | Pending | Run camera and visual switch tests. |
| `dotnet build "Weltraum Spiel.sln"` | Pending | Static compile backup. |
| `dotnet test "Weltraum Spiel.sln"` | Pending | Test backup if Unity test runner is unavailable. |

## Iterations
- Pending implementation.

## Screenshots and Evidence
- `tests/screenshots/camera-anchor.png`: Pending.
- `tests/screenshots/camera-visual-switch.png`: Pending.

## Known Limits
- Pending final verification.

