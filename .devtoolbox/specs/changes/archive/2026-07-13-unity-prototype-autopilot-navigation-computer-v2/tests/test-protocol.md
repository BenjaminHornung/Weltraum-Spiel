# Test Protocol

Change: `prototype-autopilot-navigation-computer-v2`
Date: `2026-05-27`

## Evidence
- Scene View close-up of the launch obstacle course: `.devtoolbox/specs/changes/prototype-autopilot-navigation-computer-v2/tests/logs/launch-obstacle-2-scene-view.png`
- Scene View of the live bootstrap-built scene: `.devtoolbox/specs/changes/prototype-autopilot-navigation-computer-v2/tests/logs/launch-corridor-scene-view.png`
- Game View runtime HUD capture: `.devtoolbox/specs/changes/prototype-autopilot-navigation-computer-v2/tests/logs/launch-corridor-game-view.png`

## Verification
- Unity script validation passed for:
  - `Assets/Scripts/Prototype/PrototypeTestEnvironment.cs`
  - `Assets/Tests/Editor/PrototypeTestEnvironmentValidationTests.cs`
  - `Assets/Tests/PlayMode/PrototypeAutopilotNavigationPlayModeTests.cs`
- EditMode regression passed:
  - `PrototypeTestEnvironmentValidationTests.Rebuild_AddsLaunchCorridorObstacleCourseOnDirectApproachLine`
  - Assembly: `Assembly-CSharp-Editor`
- PlayMode regression passed:
  - `PrototypeAutopilotNavigationPlayModeTests.PlayMode_Autopilot_LaunchCorridorObstacleCourse_PrecomputesAvoidanceBeforeFlightAndReachesTarget`
  - Assembly: `Assembly-CSharp`
- `dotnet build "Weltraum Spiel.sln" --no-restore` passed with pre-existing Unity/package warnings only.
- `verify_run` on execution `5d4e6b8885e84ff68b1754edae848e0c` failed on the known generic bare `dotnet build` / `dotnet test` / `dotnet format --verify-no-changes` MSB1011 issue, which is documented in the ServiceRunner review comments.

## Notes
- The runtime obstacle course is built from `PrototypeTestEnvironment`, so the live scene and the PlayMode regression share the same source of truth.
- The PlayMode run ended in `HoldPosition`, which is accepted for the terminal deadzone as long as avoidance, clearance, and route reacquisition all succeed.
