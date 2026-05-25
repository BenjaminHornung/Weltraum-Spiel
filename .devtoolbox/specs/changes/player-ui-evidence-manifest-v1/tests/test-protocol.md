# Test Protocol

## Scope

Validate the Player UI screenshot evidence manifest for `docs/player-facing-ui-concept-v0.md`.

This slice is evidence-only. It does not change runtime HUD behavior.

## Evidence Inventory

- Manifest: `.devtoolbox/specs/changes/player-ui-evidence-manifest-v1/tests/player-ui-evidence-manifest.json`
- Screenshot entries: 33
- Capture kinds covered: `unity-rendered-exporter`, `live-playmode`, `live-aspect`
- Aspect coverage includes 16:9, 4:3, 16:10, ultrawide, portrait, and 640x480 minimum captures.

## Verification Log

- Claude plan review: attempted for the post-regression evidence-manifest update. The full concept context failed on local `charmap` encoding for a citation glyph, the screenshot-file context failed on binary PNG encoding, and the final text-only context timed out after 120s. No actionable findings were returned.
- Unity MCP custom tools/resource preflight: active instance `Weltraum Spiel@49c909b3e97ba6e8`, Unity `6000.4.7f1`.
- Unity MCP `validate_script` for `Assets/Tests/Editor/PrototypePlayerHudEvidenceManifestValidationTests.cs`: PASS, 0 errors, 0 warnings.
- Unity MCP focused EditMode test `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders`: PASS, latest job `990673b372ac43fa9761f15e9cfa5592`, 1/1. The manifest includes the `player-target-indicators-v1` live Basic HUD screenshot and dedicated 4:3, ultrawide, and portrait target-indicator screenshots.
- Post-regression manifest update: adds `player-ui-regression-controls-autopilot-rcs-v1` live PlayMode evidence for visible minimap grid/blips, Navigation Planner popup, and Combat Computer popup.
- `dotnet build 'Weltraum Spiel.sln' --no-restore`: PASS, 0 errors, 22 known warnings from Unity package/reference conflicts, existing obsolete API use, and current project warning state.
- DevToolbox `specs_validate` for `player-ui-evidence-manifest-v1`: PASS.
- DevToolbox `verify_run` for execution `df8d6b1082c94458ab468abd30e7940a`: Specs PASS; generic Build/Test/Lint FAIL because root-level `dotnet build`, `dotnet test`, and `dotnet format` cannot choose between multiple project/solution files (`MSB1011` / multiple MSBuild project files).

## Notes

- The Editor test validates each manifest path stays inside `.devtoolbox/specs/changes`, exists, has a valid PNG signature, matches the recorded IHDR width/height, and has nontrivial file size.
- The test intentionally checks the screenshot artifacts as files. It does not perform subjective visual-quality analysis.
- Visual review was performed on the new 4:3, ultrawide, and portrait target-indicator screenshots and on the post-regression minimap/planner/combat-computer screenshots before committing the manifest update.
- Untracked legacy screenshot folders outside the current evidence manifest remain excluded from this slice.
