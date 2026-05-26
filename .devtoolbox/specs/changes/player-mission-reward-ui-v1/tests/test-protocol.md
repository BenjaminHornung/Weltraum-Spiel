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
  - Result: exit code `0`, `0 Error(s)`, `2 Warning(s)` from existing Unity/.NET assembly reference conflicts.
- Unity MCP GameView runtime capture
  - Live incomplete Arena Objective panel shows `Clear the Arena` and `Targets 0/3 | Active`.
  - No `Reward:` line is shown while incomplete.
  - No overlapping panels were visible in the captured 720px-wide GameView screenshot.

## Review Notes

- Claude plan review was attempted with the screenshot path included. Passing the PNG as a file path failed with a binary/charmap read error, then the text-only retry timed out after 120 seconds. No Claude findings were available for this slice.
- A runtime completed-state screenshot was not captured because Unity blocked direct component property mutation during Play Mode and `execute_code` failed with `filename or extension is too long`. Completed-state behavior is covered by the focused EditMode tests listed above.

## Screenshots

- `.devtoolbox/specs/changes/player-mission-reward-ui-v1/tests/screenshots/mission-reward-incomplete-gameview-1280x720.png`
