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

Screenshot evidence was originally recorded here. The two historical Git LFS
pointers referenced objects
`909d62e6585e6439a6d189d21b81140e8e892a054801c7fa2e026e8daa50fdd1` and
`414747a1b9c1943cce1f8b5087a2b55be292df891514e477ceec64e8a0b2a284`,
but both payloads were already absent from GitHub LFS before the 2026-07
browser-mainline repository cleanup. The broken pointers were removed from the
active branch; their original state remains visible through
`unity-legacy-final-2026-07`.

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

## 2026-05-20 Architecture Slice Addendum

Scope:

- Added shared IMGUI data surfaces: `PrototypeUiFormatter`, `PrototypeUiStyle`, `PrototypeHudViewModel`, `PrototypeDebugViewModel`, `PrototypeAutopilotViewModel`, `PrototypeMomentumAssistViewModel`, and `PrototypeKeybindViewModel`.
- Added `PrototypeInputBindingCatalog` so the runtime keybind overlay renders structured mode-aware bindings instead of hardcoded text blocks.
- Extended layout reset with zone defaults, testable bounds clamping, and simple overlap resolution.
- Added regression coverage in `PrototypeUiArchitectureValidationTests`.
- During full-suite verification, fixed an existing imported-visual RCS blocker where inactive/generated RCS nozzles were still counted when an imported ship visual was active.

Fresh verification:

| Check | Result | Notes |
| --- | --- | --- |
| `specs_validate prototype-ui-readability-testability-pass` | Passed | ServiceRunner reported proposal, design, tasks, and spec valid. |
| Unity console check | Passed | Cleared after full test run; no error entries remained. |
| Unity MCP focused EditMode UI architecture tests | Passed | Job `9233d4615e014a0fafe26aa3ed38f484`: 4 total, 4 passed. |
| Unity MCP imported scout blocker rerun | Passed | Job `86c5e32b236643d2b53b18a22a5fe5e7`: 1 total, 1 passed after RCS active imported-root filtering. |
| Unity MCP full EditMode suite | Passed | Job `ab843b945bfc41b5a058e2480a78ec2f`: 128 total, 128 passed. |
| `dotnet build "Weltraum Spiel.sln" --no-restore` | Passed | 0 errors; existing Unity/MCP assembly-version warnings remain. |
| `dotnet test "Weltraum Spiel.sln" --no-build` | Passed | Exit code 0. |
| Scoped `git diff --check` | Passed | Checked changed UI/RCS/test files; only line-ending warnings were emitted. |
