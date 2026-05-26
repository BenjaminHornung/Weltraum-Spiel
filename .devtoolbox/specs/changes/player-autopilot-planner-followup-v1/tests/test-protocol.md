# Test Protocol

## Slice

`player-autopilot-planner-followup-v1`

## Scope

- Navigation Planner popup readability and route-first map hierarchy.
- Waypoint autopilot brake alignment authority and closed-loop main-thruster deceleration.

## Evidence

- 2026-05-26 follow-up: Navigation Planner map readable labels and planner-only hierarchy
  - Implementation:
    - Replaced code-like planner map labels (`DR2p`, `R8p`, `Pv16p`, `3c`) with short player-facing labels (`Direct 2`, `Route 8`, `Preview 16`, `No preview`, `2.5 km`, `3 contacts`).
    - Kept compact radar range text unchanged while making the planner range label readable.
    - Added planner-only grid dimming so the route/preview strokes dominate the map instead of the frame.
    - Muted non-primary planner blips more strongly while leaving selected navigation, selected combat, and objective blips prominent.
    - Added regression coverage for dimmer planner grid alpha, readable route/range/contact labels, and primary-vs-secondary blip prominence.
  - Claude plan review:
    - Attempted with local plan and file context.
    - Result: timed out after 120 seconds; no Claude findings were available for this slice.
  - Unity MCP `validate_script`:
    - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, 2 existing warnings.
    - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: PASS, 0 errors, 0 warnings.
    - `Assets/Tests/PlayMode/PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.cs`: PASS, 0 errors, 3 existing warnings.
  - Unity MCP EditMode focused planner regression:
    - Job `614e4f72fd8849e49bf3e2695824dc69`.
    - Tests: readable planner labels, planner grid dimming, planner blip filtering/de-emphasis, shared range controls, selected-target route extension, responsive map separation, and planner popup API wiring.
    - Result: 11/11 PASS.
  - Unity MCP EditMode full HUD validation:
    - Job `5f4b4c7fe6134686b9b9649c42bcbb6e`.
    - Fixture: `PrototypePlayerHudValidationTests`.
    - Result: 58/58 PASS.
  - Unity MCP PlayMode real GameView popup evidence:
    - Job `04892902d0df4d89ab7fb7756271c989`.
    - Test: `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`.
    - Result: 1/1 PASS.
    - Refreshed runtime screenshot source: `.devtoolbox/specs/changes/player-ui-regression-controls-autopilot-rcs-v1/tests/screenshots/player-ui-regression-nav-planner-1280x720.png`.
    - Copied evidence screenshot: `.devtoolbox/specs/changes/player-autopilot-planner-followup-v1/tests/screenshots/player-autopilot-planner-followup-nav-planner-1280x720.png`.
    - Visual check: planner popup shows `Route 8 | Preview 16 | 2.5 km | 3 contacts`; route/preview are visible and there is no obvious map/body/button overlap at 1280x720.
  - Unity MCP console check:
    - Result: no real compile/runtime errors; console only showed Unity TestRunner result-save entry and a PerformanceTesting cleanup warning.
  - `.NET` build:
    - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`.
    - Result: PASS, 0 errors, 22 existing warnings.
  - DevToolbox `verify_run`:
    - Execution: `5bd5887e96d2408ca135dee804617f93`.
    - Result: `Specs` passed; generic `Build`, `Test`, and `Lint` failed because the presets run bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a folder with multiple MSBuild files, reproducing the known MSB1011/tooling issue.
    - Targeted Unity MCP tests and `dotnet build "Weltraum Spiel.sln" --no-restore` are the authoritative verification for this slice.

- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: PASS, 0 errors, 22 existing warnings.
- Unity MCP `validate_script`
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: PASS, 0 errors, 2 existing warnings.
  - `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: PASS, 0 errors, 1 existing warning.
- Unity MCP EditMode job `92409bac5e5b45bdb39c04eca2d0de30`
  - Fixture: `PrototypePlayerHudValidationTests`
  - Result: 55/55 PASS.
  - Covered planner route-to-selected-target extension, shared range controls, capped/faded planner contacts, and responsive no-overlap layout.
- Unity MCP EditMode job `c65ae9b9b61a47ce81d162048a5a660f`
  - Fixtures: `PrototypeWaypointAutopilotValidationTests`, `PrototypeAutopilotMomentumStartupStateTests.BootstrapAutopilotFlipsAndMainBrakesWithoutManualAlignment`
  - Result: 32/32 PASS.
  - Covered NoAttitudeAuthority fail-fast diagnostics, successful brake flip/main-thruster decel, and the bootstrap/runtime ship brake path.
- Unity MCP PlayMode job `598537fbdbb74e488a5850eae755e9d3`
  - Fixture: `PrototypeAutopilotNavigationPlayModeTests`
  - Result: 8/8 PASS.
  - Covered real closed-loop avoidance, retrograde rotation, RCS brake torque, main-thruster decel after alignment, and force opposing velocity.
- Unity MCP PlayMode job `867cdb347c0a4f1080fe9db5280f1647`
  - Test: `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`
  - Result: 1/1 PASS.
  - Refreshed real GameView planner popup screenshot.
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
- 2026-05-26 follow-up after live feedback on aggressive flip / orbiting before target:
  - Claude plan-review: timed out after 120 seconds on text-only context pack.
  - Diagnostic Unity MCP PlayMode jobs `88b4d1053b94438b9d5d16e07188bc82`, `bc42a6a690244adfae3ffd4ca46abb50`, `1f7d3f4ab3b94e4b814c419e1773ce0a`, and `c82add9f0a5c420faa782324e1d9f440` failed while isolating brake-hold/orbit behavior. They showed the autopilot stuck in FlipForBrake/Brake/FinalApproach after overshoot instead of reaching terminal completion.
  - Unity MCP PlayMode job `271f98105e7349209b3447cccad61246`
    - Test: `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone`
    - Result: 1/1 PASS.
    - Covered high-speed overshoot, reacquire, deadzone capture, and final `Complete` state instead of orbiting.
  - Unity MCP PlayMode job `2547af8dcc114e97a5230a5dc2c08df6`
    - Tests: arrival deadzone, closed-loop brake/main-thruster decel, manual override stale-input grace.
    - Result: 3/3 PASS.
  - Unity MCP PlayMode job `21e13f404f2a4e2ca363c52639f90a16`
    - Fixture: `PrototypeAutopilotNavigationPlayModeTests`
    - Result: 9/9 PASS.
  - Unity MCP EditMode job `efb3430e390041669dc821a9d3ad2d1a`
    - Fixtures: `PrototypeWaypointAutopilotValidationTests`, `PrototypePlayerHudValidationTests`
    - Result: 86/86 PASS.
  - Unity MCP PlayMode job `f47b3d61a5654570937bb078d20284ca`
    - Test: `PrototypePlayerHudLiveRuntimeEvidencePlayModeTests.PrototypeBootstrapRuntimePlayerHudEvidenceCapturesPlayerComputerPopups`
    - Result: 1/1 PASS.
    - Refreshed the planner popup screenshot copied below.
  - `dotnet build "Weltraum Spiel.sln" --no-restore`
    - Result: PASS, 0 errors, 22 existing warnings.

## Screenshots

- `tests/screenshots/player-autopilot-planner-followup-nav-planner-1280x720.png`
  - Source: copied from the refreshed runtime screenshot `player-ui-regression-nav-planner-1280x720.png` after the PlayMode popup evidence test.
  - Visual check: Navigation Planner popup is route-first, shows a thick cyan route extended to the selected target, keeps amber preview visible, caps planner contacts to 3, and has no obvious map/body/button overlap at 1280x720.

## Notes

- Claude plan-review attempts:
  - Including the PNG in `file_paths` failed because the wrapper tried to treat binary screenshot data as text.
  - Text-only attempts with the screenshot path in the prompt timed out after 120 seconds, including the post-screenshot review attempt for this follow-up patch.
  - The final decision is therefore based on local code review plus Unity MCP runtime/test evidence.
