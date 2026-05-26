# Test Protocol

## Slice

`player-mission-reward-ui-v1`

## Scope

- Reserve a real, compact Mission/Reward surface in the Player HUD Objective panel.
- Reuse existing Arena/objective gameplay data only.
- Avoid fake mission/economy/unlock UI.

## Evidence

- Unity MCP `validate_script`
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: success, 0 errors, 2 existing warnings.
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: success, 0 errors, 0 warnings.
  - `Assets/Tests/Editor/PrototypePveArenaLoopValidationTests.cs`: success, 0 errors, 0 warnings.
- Unity MCP EditMode tests
  - Job `dea4c3e6394e492b868a034920e3c6f6`: 3/3 passed.
    - `PrototypePlayerHudValidationTests.ObjectivePanelShowsRewardOnArenaCompletionAndStaysCompactWhenIncomplete`
    - `PrototypePlayerHudValidationTests.ObjectivePanelShowsRewardPendingOnCompletedArenaWithoutRewardStub`
    - `PrototypePveArenaLoopValidationTests.HudSnapshotCarriesArenaStatusAndCompletionReward`
  - Job `1812756427f647769f240e9662cbe051`: 1/1 passed.
    - `PrototypePlayerHudValidationTests.ObjectivePanelSeparatesArenaProgressFromShipSystems`
- `.NET` build
  - Command: `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: exit code `0`, `0 Error(s)`, existing Unity/.NET warnings only.
- Unity MCP GameView runtime capture
  - Live incomplete Arena Objective panel shows `Clear the Arena` and `Targets 0/3 | Active`.
  - No `Reward:` line is shown while incomplete.
  - No overlapping panels were visible in the captured 720px-wide GameView screenshot.
  - `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesMissionRewardCompleted` passed as Unity MCP PlayMode job `913aa2f6817b422fba1802cd247b00de`, 1/1 passed.
  - The completed evidence test captures a real completed objective/reward state at
    `.devtoolbox/specs/changes/player-mission-reward-ui-v1/tests/screenshots/mission-reward-completed-gameview-1280x720.png`.
    - Objective text includes `Reward:` and completed progress `Targets 3/3`.
    - Fixed HUD panel overlap checks pass.
- DevToolbox `verify_run e49ad58e9a624ab18954a02c4dd763b9`
  - `Specs` passed.
  - Generic root `Build`, `Test`, and `Lint` failed with the known MSB1011 / multiple project files issue because the presets run bare `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without specifying `Weltraum Spiel.sln`.
  - The targeted Unity MCP PlayMode test and explicit solution build above are the authoritative verification for this slice.

## Review Notes

- Claude plan review was attempted with the screenshot path included. Passing the PNG as a file path failed with a binary/charmap read error, then the text-only retry timed out after 120 seconds. No Claude findings were available for this slice.
- The runtime completed-state gap is now covered by
  `PrototypeBootstrapRuntimePlayerHudEvidenceCapturesMissionRewardCompleted`, which captures
  `.devtoolbox/specs/changes/player-mission-reward-ui-v1/tests/screenshots/mission-reward-completed-gameview-1280x720.png` under Play Mode evidence.
- Claude plan review was attempted again for the completed-state evidence follow-up. The first attempt hit a `charmap` encoding failure; the text-only retry timed out after 120 seconds, so no Claude findings were available.

## Screenshots

- `.devtoolbox/specs/changes/player-mission-reward-ui-v1/tests/screenshots/mission-reward-incomplete-gameview-1280x720.png`
- `.devtoolbox/specs/changes/player-mission-reward-ui-v1/tests/screenshots/mission-reward-completed-gameview-1280x720.png`
