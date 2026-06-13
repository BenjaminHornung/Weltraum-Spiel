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
- Unity MCP focused EditMode test `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders`: PASS, latest job `a53bbb5f14b04ee388096a077834a71e`, 1/1.
- Post-regression manifest update: adds `player-ui-regression-controls-autopilot-rcs-v1` live PlayMode evidence for visible minimap grid/blips, Navigation Planner popup, and Combat Computer popup.
- Manifest path repair: the three `player-ui-regression-controls-autopilot-rcs-v1` screenshot entries now point at their archived evidence under `.devtoolbox/specs/changes/archive/2026-06-12-player-ui-regression-controls-autopilot-rcs-v1/tests/screenshots/`; a direct manifest sweep found 33 screenshots and 0 missing files.
- `dotnet build 'Weltraum Spiel.sln' --no-restore`: PASS, 0 errors, 2 known MSB3277 warning groups from Unity package/reference conflicts.
- DevToolbox `specs_validate` for `player-ui-evidence-manifest-v1`: PASS, 4 task items parsed.
- DevToolbox `verify_run` for execution `df8d6b1082c94458ab468abd30e7940a`: Specs PASS; generic Build/Test/Lint FAIL because root-level `dotnet build`, `dotnet test`, and `dotnet format` cannot choose between multiple project/solution files (`MSB1011` / multiple MSBuild project files).

## Notes

- The Editor test validates each manifest path stays inside `.devtoolbox/specs/changes`, exists, has a valid PNG signature, matches the recorded IHDR width/height, and has nontrivial file size.
- The test intentionally checks the screenshot artifacts as files. It does not perform subjective visual-quality analysis.
- Visual review was performed on the new 4:3, ultrawide, and portrait target-indicator screenshots and on the post-regression minimap/planner/combat-computer screenshots before committing the manifest update.
- Untracked legacy screenshot folders outside the current evidence manifest remain excluded from this slice.
