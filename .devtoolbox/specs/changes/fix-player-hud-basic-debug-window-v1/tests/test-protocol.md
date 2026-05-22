# Test Protocol

Change: fix-player-hud-basic-debug-window-v1
Date: 2026-05-22

## Scope

Verify that the Basic player HUD no longer shows the legacy Weapon Computer IMGUI window, target/offscreen indicators stay out of fixed HUD panels, and aspect-ratio layout tests still keep panels separated.

## Verification

1. Unity MCP script validation
   - `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs`
     - Result: success, 0 errors, 2 existing warnings about Rigidbody update timing and string concatenation in Update.
   - `validate_script Assets/Scripts/Prototype/PrototypeUiLayoutManager.cs`
     - Result: success, 0 warnings, 0 errors.
   - `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`
     - Result: success, 0 warnings, 0 errors.
   - `validate_script Assets/Tests/Editor/PrototypeUiArchitectureValidationTests.cs`
     - Result: success, 0 warnings, 0 errors.

2. Unity MCP EditMode tests
   - Command: `run_tests EditMode` for `PrototypePlayerHudValidationTests` and `PrototypeUiArchitectureValidationTests`
   - Job: `86102927b49c4fcd90ac6a5a676fc43d`
   - Result: 32/32 passed, 0 failed, 0 skipped.

3. Local build
   - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
   - Result: exit code 0.
   - Notes: known Unity/MCP reference and obsolete API warnings remain; no new errors.

4. DevToolbox validation
   - Command: `specs_validate fix-player-hud-basic-debug-window-v1`
   - Result: passed, 5 tasks parsed.

5. DevToolbox verification preflight attempt
   - Command: `verify_run 109f32de76504262acf67e1e81a3688a`
   - Result: expected project-tooling failure for generic Unity-root commands.
   - Details: `specs validate` passed, but generic `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` failed with MSB1011/multiple project files because the tool did not specify `Weltraum Spiel.sln`.
   - Replacement evidence: the explicit solution build and Unity MCP tests above are authoritative for this Unity project.

6. Runtime Game View check through Unity MCP
   - Scene: `Assets/Scenes/PrototypeBootstrapHost.unity`
   - Preset: `PrototypeUiPreset.Basic`
   - Probe result: `hud=True, weaponPanelVisible=False, active=Target Moving Placeholder, nav=Nav Waypoint 2, indicators=5`
   - Screenshot: `tests/screenshots/player-hud-basic-clean-layered-final.png`
   - Unity console after capture: 0 error/warning entries.

## Coverage Notes

- Basic preset now hides the legacy Weapon Computer panel.
- FlightTest keeps the legacy Weapon Computer available but collapsed.
- FullDiagnostics keeps the legacy Weapon Computer visible and expanded.
- Target indicator safe rect now reserves enough top space for the alert/context strip.
- The generated overlay graphic renders below fixed HUD panels, while labels remain clamped and hidden when risky.
- Responsive panel separation is covered at 2560x1080, 1920x1080, 1440x900, 1280x720, 1024x768, 900x1600, 800x600, and 640x480.
