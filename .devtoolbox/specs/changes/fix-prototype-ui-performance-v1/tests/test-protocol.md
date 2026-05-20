# Test Protocol: fix-prototype-ui-performance-v1

Date: 2026-05-20
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Branch: `main`

## Scope

Prototype IMGUI performance containment for HUD, Debug Overlay, Debug Console, Keybind Overlay, Minimap, Weapon Computer Panel, and the Flight Test preset.

## Commands and Results

| Check | Result | Evidence |
| --- | --- | --- |
| DevToolbox/OpenSpec validation | Passed | `specs_validate` for `fix-prototype-ui-performance-v1` returned valid with 4 spec files and 16 task items. |
| C# project build | Passed | `dotnet build "Weltraum Spiel.sln" --no-restore` completed with warnings only. Existing warnings include assembly conflict MSB3277, obsolete Unity object lookup warnings, and unassigned serialized fields. |
| Unity EditMode UI architecture tests | Passed | Unity MCP test job `e8a0497ea7d54dd4b86f4599c06e2b87`: `PrototypeUiArchitectureValidationTests`, 9/9 passed. Covers WindowState dirty persistence, sampling cadence, collapsed diagnostics guard, Flight Test UI defaults, and HUD/debug view model smoke coverage. |
| Unity EditMode HUD/weapon panel smoke tests | Passed | Unity MCP test job `d333002b1c95421b999ecd75d464c686`: `PrototypeFlightHudValidationTests` plus `PrototypeWeaponComputerTurretValidationTests.WeaponComputerPanelBindingAndStatusLabelsAreNullSafe`, 5/5 passed. |
| DevToolbox default verify_run | Tooling blocked | `verify_run` passed the Specs step but failed its default Build/Test/Lint steps because it runs `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without specifying a solution in a folder with multiple MSBuild files (`MSB1011`). The explicit solution build above is the relevant build evidence for this Unity workspace. |
| Play Mode smoke | Partial | `manage_editor play` entered Play Mode in `Assets/Scenes/PrototypeBootstrapHost.unity`; runtime `PrototypeBootstrap` was present; `manage_editor stop` exited Play Mode cleanly. Full manual responsiveness/profiler proof was not claimed because current workspace contains unrelated untracked PlayMode compile errors listed below. |

## Known Unrelated Verification Noise

- Unity console currently reports compile errors in untracked file `Assets/Tests/PlayMode/CombatFlightPlayModeTests.cs` at lines 168 and 172: `Object` is ambiguous between `UnityEngine.Object` and `object`. This file is outside the UI performance change scope and was not edited.
- A broader EditMode run had existing/non-UI failures:
  - `PrototypePhysicsValidationTests.ProjectileMomentumUsesConfiguredMassForRecoilAndImpact`: expected `2.5`, actual `0.0`.
  - `PrototypeWeaponComputerTurretValidationTests.HighFireRateHitscanKeepsProjectileObjectsAndVisualsBounded`: expected `<= 69`, actual `112`.
- The working tree contains other dirty files and untracked spec/code changes from separate work. This protocol records only the checks relevant to `fix-prototype-ui-performance-v1`.

## Performance Evidence

- PlayerPrefs writes are now dirty-gated and throttled through `PrototypeUiWindowState.TrySaveToPrefsThrottled`.
- Heavy Debug Overlay diagnostics are sampled at 0.2 second intervals and only for visible/open sections; collapsed overlay tests prove heavy diagnostics do not run.
- Flight Test preset test proves Debug Console and Weapon Computer are not opened by default, and minimap labels remain off until Full Diagnostics.

## Deferred Evidence

Unity Profiler before/after CPU hierarchy was not captured in this pass because the workspace had unrelated compile errors in untracked PlayMode tests. A follow-up profiler capture should compare `GUI.Repaint`, `GC Alloc`, and PlayerPrefs activity with Flight Test versus Full Diagnostics once the unrelated PlayMode test file compiles.
