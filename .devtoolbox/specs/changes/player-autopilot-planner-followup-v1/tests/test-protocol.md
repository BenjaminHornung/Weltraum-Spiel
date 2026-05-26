# Test Protocol

## Slice

`player-autopilot-planner-followup-v1`

## Scope

- Navigation Planner popup readability and route-first map hierarchy.
- Waypoint autopilot brake alignment authority and closed-loop main-thruster deceleration.

## Evidence

- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: PASS, 0 errors, 22 existing warnings.
- Unity MCP PlayMode job `f7772f85660f45769b5c4005de125cfb`
  - Test: `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_ClosedLoopBrake_RotatesAndUsesMainThrusterWithoutHarnessRotation`
  - Result: 1/1 PASS.
  - Covered real physics stepping without harness rotation: retrograde rotation, actual RCS torque, first main throttle only after alignment, and main force opposing velocity.
- Unity MCP PlayMode job `406f41e041154898aca753fa16798c6f`
  - Fixture: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: 8/8 PASS.
- Unity MCP EditMode job `bf8a0c2699d6458fb0ad7fbe996f2432`
  - Fixtures: `PrototypePlayerHudValidationTests`, `PrototypeWaypointAutopilotValidationTests`
  - Result: 83/83 PASS.
  - Covered planner blip cap/range sharing/popup controls/responsive layout plus autopilot RCS/SAS reassertion and existing closed-loop brake checks.
- Unity MCP PlayMode job `cd81c6f25a9b41a89977aff633943b14`
  - Test: `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`
  - Result: 1/1 PASS.
  - Captured real Player HUD popup screenshots.
- Unity MCP regression note:
  - Job `a855e34c8a10485c9d0cad5a52e399ef` failed 1/1 while proving premature main-throttle gating.
  - Job `ad98ba16a6d8451b94735a3933cd9311` failed 1/1 before Unity recompiled the narrowed first-burn gate assertion.
  - Both failures were used to tighten the PlayMode harness; the final focused and full PlayMode jobs above pass.
- DevToolbox `verify_run` for execution `b521d43865354db6a32abda5c84af58b`
  - Specs: PASS.
  - Generic Build/Test/Lint: BLOCKED by the known Unity-root `MSB1011` failure because the runner invokes `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without naming `Weltraum Spiel.sln` in a directory with multiple MSBuild files.
  - Replacement evidence: explicit solution build plus Unity MCP EditMode/PlayMode jobs listed above.
  - Completion preflight was run and blocked on the generic failed verify metadata, so task checkboxes remain intentionally unchecked.

## Screenshots

- `tests/screenshots/player-autopilot-planner-followup-nav-planner-1280x720.png`
  - Source: copied from the refreshed runtime screenshot `player-ui-regression-nav-planner-1280x720.png` after the PlayMode popup evidence test.
  - Visual check: Navigation Planner popup is route-first, shows thick cyan route and amber preview with 4 planner contacts, and no obvious map/body/button overlap at 1280x720.

## Notes

- Claude plan-review attempts:
  - Including the PNG in `file_paths` failed because the wrapper tried to treat binary screenshot data as text.
  - Text-only attempts with the screenshot path in the prompt timed out after 120 seconds.
  - The final decision is therefore based on local code review plus Unity MCP runtime/test evidence.
