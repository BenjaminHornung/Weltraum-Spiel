# Test Protocol: prototype-ui-readability-testability-pass

Date: 2026-05-20
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity: 6000.4.7f1

## Automated Verification

| Check | Result | Notes |
| --- | --- | --- |
| `workspace_prepare_for_agent` | Passed | Change context prepared before creating the DevToolbox change. |
| `specs_validate prototype-ui-readability-testability-pass` | Passed | Proposal, design, tasks, and `specs/ui-readability/spec.md` parsed successfully. |
| `refresh_unity` | Passed | Script compile requested; Unity returned to `ready_for_tools`. |
| Unity console check | Passed | No compile errors after refresh, tests, and Play Mode screenshot. |
| `validate_script Assets/Scripts/Prototype/PrototypeFlightHud.cs` | Passed | 0 errors, 0 warnings after the final navball/target fallback patch. Earlier changed scripts also validated with no errors; `PrototypeDebugOverlay` and `PrototypeFlightDebugConsole` only reported non-blocking heuristic warnings. |
| `dotnet build "Weltraum Spiel.sln"` | Passed | 0 errors. Existing Unity/MCP reference warnings and existing serialized-field warnings remain. |
| `dotnet test "Weltraum Spiel.sln" --no-build` | Passed | Exit code 0. |
| Unity MCP `run_tests` EditMode | Passed | Job `1edae150a0594e57b906e9a254e8b48b`: 70 total, 70 passed, 0 failed, 0 skipped. |

## Regression Caught During Verification

The first fresh Unity EditMode run failed in `PrototypeFlightHudValidationTests.HudComputesProgradeAndRetrogradeMarkersFromShipLocalVelocity`: the HUD picked up a scene `PrototypeTargetDummy` while testing a minimal ship without `PlayerShipController`, causing the active mode label to resolve to `TARGET` instead of `VELOCITY`.

Fix applied: `PrototypeFlightHud.ResolveTrackedTarget()` now only auto-discovers a scene target when the HUD is bound to a real ship controller. The rerun passed all 70 EditMode tests.

## Manual Sight Check

Screenshot:

`E:\Unity\Weltraum Spiel\Weltraum Spiel\.devtoolbox\specs\changes\prototype-ui-readability-testability-pass\tests\screenshots\default-compact-flight-ui-after-navball-fix.png`

Observed:

- Startup no longer shows the old full diagnostics wall; the Flight Diagnostics window starts compact with fuel, speed, throttle, RCS/SAS, thrust, target, and debug-vector status.
- Flight Debug Console is hidden by default.
- HUD/Navball is in a draggable window and uses the shorter `Mode: TARGET` label instead of the long mode list.
- Standard navball labels are readable in the captured view; `DES`, `ACT`, `RES`, and `SAS` debug markers are not shown in the default HUD.
- Prototype ship modules are easier to distinguish with role colors for hull, cockpit, fuel, main thruster, RCS, gun, and utility/cargo roles.
- The screenshot also shows a Minimap/Radar window from existing untracked `prototype-test-environment-ui-pass` work. It was not changed as part of this pass.

Not directly mouse-verified through MCP:

- Physical mouse dragging of each IMGUI window. Code paths for the changed windows use `GUI.Window`, `GUI.DragWindow`, and `PrototypeUiWindowState.ClampToScreen()`, and the Play Mode screenshot verifies the windowed layout renders without compile/runtime console errors.

## Documentation Check

- `README.md` and `PrototypeKeybindOverlay` list the same F-key UI toggles available in this workspace.
- `docs/physics-flight-model.md` documents the prototype HUD/debug behavior at the same temporary-IMGUI level as the implementation.
