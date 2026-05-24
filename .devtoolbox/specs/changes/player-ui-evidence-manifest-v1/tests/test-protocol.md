# Test Protocol

## Scope

Validate the Player UI screenshot evidence manifest for `docs/player-facing-ui-concept-v0.md`.

This slice is evidence-only. It does not change runtime HUD behavior.

## Evidence Inventory

- Manifest: `.devtoolbox/specs/changes/player-ui-evidence-manifest-v1/tests/player-ui-evidence-manifest.json`
- Screenshot entries: 27
- Capture kinds covered: `unity-rendered-exporter`, `live-playmode`, `live-aspect`
- Aspect coverage includes 16:9, 4:3, 16:10, ultrawide, portrait, and 640x480 minimum captures.

## Verification Log

- Claude plan review: attempted for this evidence-manifest slice before final Unity verification; the wrapper timed out after 120s and produced no actionable findings.
- Unity MCP custom tools/resource preflight: active instance `Weltraum Spiel@49c909b3e97ba6e8`, Unity `6000.4.7f1`.
- Unity MCP `validate_script` for `Assets/Tests/Editor/PrototypePlayerHudEvidenceManifestValidationTests.cs`: PASS, 0 errors, 0 warnings.
- Unity MCP focused EditMode test `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders`: PASS, latest job `cb7a081b7f12476fb4ed4a2c1c010ba0`, 1/1. The manifest now also includes the `player-target-indicators-v1` live Basic HUD screenshot.
- `dotnet build 'Weltraum Spiel.sln' --no-restore`: PASS, 0 errors, 22 known warnings from Unity package/reference conflicts, existing obsolete API use, and current project warning state.
- DevToolbox `specs_validate` for `player-ui-evidence-manifest-v1`: PASS.
- DevToolbox `verify_run` for execution `df8d6b1082c94458ab468abd30e7940a`: Specs PASS; generic Build/Test/Lint FAIL because root-level `dotnet build`, `dotnet test`, and `dotnet format` cannot choose between multiple project/solution files (`MSB1011` / multiple MSBuild project files).

## Notes

- The Editor test validates each manifest path stays inside `.devtoolbox/specs/changes`, exists, has a valid PNG signature, matches the recorded IHDR width/height, and has nontrivial file size.
- The test intentionally checks the screenshot artifacts as files. It does not perform subjective visual-quality analysis.
- Untracked legacy screenshot folders outside the current evidence manifest remain excluded from this slice.
