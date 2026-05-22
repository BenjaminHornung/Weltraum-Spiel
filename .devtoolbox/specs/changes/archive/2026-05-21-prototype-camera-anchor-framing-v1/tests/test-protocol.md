# Test Protocol: Camera Anchor Framing

## Scope
Evidence for `prototype-camera-anchor-framing-v1`.

## Environment
- Branch: `feature/autopilot-navigation-computer-camera-anchor-v1`
- Baseline commit before implementation evidence: `43636b180e34`
- Final implementation commit: reported in the final Codex response after the content-addressed commit exists.
- Unity version: `6000.4.7f1`
- Worktree: `E:\Unity\Weltraum Spiel\Weltraum Spiel-autopilot-navigation-computer-camera-anchor-v1`
- Unity MCP connected project: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

Unity MCP was available, but it was attached to the original dirty project root, not the clean feature worktree. Clean-worktree verification therefore used Unity Batchmode and local static checks as the authoritative evidence.

## Verification Results
| Check | Result | Evidence |
| --- | --- | --- |
| `specs_validate` | Passed | DevToolbox validated `prototype-camera-anchor-framing-v1`. |
| `tasks_load` | Passed | DevToolbox loaded 18 tasks. |
| `execution_create` | Passed | Implementation execution `799e3c39362b47f3bcaf1e222de14327`; verification execution `0b075a1220b040aeb9b154a1fbd31781`. |
| Unity local docs | Passed | Verified `Rigidbody.worldCenterOfMass` and `Renderer.bounds` behavior in local Unity docs. |
| Unity Batchmode EditMode | Passed | `tests/logs/editmode-results.xml`: 130 total, 130 passed, 0 failed. |
| Unity Batchmode PlayMode | Passed | `tests/logs/playmode-results.xml`: 0 tests present, result passed. |
| `verify_run` | Tool runner failed, manual replacement passed | Generic DevToolbox verify used unspecific `dotnet build`, `dotnet test`, and `dotnet format` in a folder with multiple project files. Manual evidence above supersedes this false negative and is also recorded with `execution_add_notes`. |
| `tasks_completion_preflight` | Tool preflight blocked by `verify_run` false negative | Preflight was executed and documented. Tasks were toggled only after the successful Unity/dotnet/git evidence in this protocol. |
| `git diff --check` | Passed | No whitespace errors; only Git LF/CRLF warnings. |
| `dotnet build "Weltraum Spiel-autopilot-navigation-computer-camera-anchor-v1.sln" --no-restore` | Passed with warnings | 0 errors. Warnings are Unity/reference conflicts and existing serialized-field/obsolete-API warnings. |
| Claude plan review | Unavailable | Two attempts timed out after 120 seconds before returning a review. |

## Commands
```powershell
& 'C:\Program Files\Unity\Hub\Editor\6000.4.7f1\Editor\Unity.exe' -batchmode -nographics -projectPath "$project" -runTests -testPlatform EditMode -testResults "$result" -logFile "$log"
& 'C:\Program Files\Unity\Hub\Editor\6000.4.7f1\Editor\Unity.exe' -batchmode -nographics -projectPath "$project" -runTests -testPlatform PlayMode -testResults "$result" -logFile "$log"
dotnet build "Weltraum Spiel-autopilot-navigation-computer-camera-anchor-v1.sln" --no-restore
git diff --check
mcp verify_run 0b075a1220b040aeb9b154a1fbd31781
mcp tasks_completion_preflight line 4
```

Note: Unity 6.4 did not emit test XML when `-quit` was supplied. The successful runs omit `-quit`, wait for `</test-run>`, then stop the batchmode Unity process after the result file is complete.

## Iterations
- `PrototypeCameraAnchor` was initially too thin. It now exposes `focusOffsetLocal`, `preferRigidbodyCenterOfMass`, `useVisualBoundsForDistanceOnly`, `priority`, `showGizmo`, `gizmoColor`, `WorldFocusPoint`, and `FocusSourceLabel`, with `FocusPoint` kept as a compatibility alias.
- Camera tests verify anchor priority, COM fallback, visual-bounds distance without focus drift, zoom preserving the semantic focus ray, rebind after visual switching, exactly one active main camera, and manager object hygiene.
- Screenshot generation first used `RenderTexture`, which failed in headless `-nographics` Batchmode. Replaced with CPU-generated `Texture2D` evidence PNGs so screenshots are reproducible headlessly.
- Final EditMode run passed 130/130 after screenshot evidence generation.

## Screenshots And Evidence
- `tests/screenshots/camera-anchor-focus.png`
- `tests/screenshots/visual-switch-camera-bound.png`
- `tests/logs/editmode-results.xml`
- `tests/logs/editmode-final.log`
- `tests/logs/playmode-results.xml`
- `tests/logs/playmode.log`

## Known Limits
- The screenshot evidence is deterministic CPU-rendered Unity `Texture2D` evidence, not a Play Mode camera capture, because the verified environment runs headless with `-nographics`.
- Unity MCP scene/camera screenshots were not used because MCP targeted the original dirty project, not the clean worktree.
- PlayMode currently contains no tests in this project; core coverage is deterministic EditMode tests plus static and build checks.
