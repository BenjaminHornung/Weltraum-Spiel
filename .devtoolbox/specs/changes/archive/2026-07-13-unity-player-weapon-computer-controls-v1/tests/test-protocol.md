# player-weapon-computer-controls-v1 Test Protocol

Date: 2026-05-22

## Scope

- Added player-facing target cycling and priority helper APIs to `PrototypeWeaponComputer`.
- Added compact Combat/Weapon Computer controls to the Player HUD context panel.
- Wired controls to previous target, next target, clear target, Auto Fire toggle, and priority cycle.
- Kept the legacy `PrototypeWeaponComputerPanel` hidden in Basic and preserved it as diagnostic UI.
- Verified layout separation across the existing HUD aspect-ratio matrix.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypeWeaponComputer.cs` | PASS | 0 errors, 1 existing Update string-concat warning. |
| Unity MCP `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs` | PASS | 0 errors, 2 existing HUD warnings. |
| Unity MCP `validate_script Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP `validate_script Assets/Tests/Editor/PrototypeWeaponComputerTurretValidationTests.cs` | PASS | 0 errors, 0 warnings. |
| Unity MCP focused new EditMode tests | PASS | Job `0eb095d36f99470fb1f1887e841eb639`, 4/4 passed. |
| Unity MCP `PrototypePlayerHudValidationTests` | PASS | Job `a09fcd46b8c14c20b6663a309cc31248`, 28/28 passed. |
| Unity MCP HUD + UI architecture + new helper test | PASS | Job `9fe2bd1bcc4e4cdabac6d5568536ce9d`, 39/39 passed. |
| `dotnet build "Weltraum Spiel.sln" --no-restore` | PASS | Exit code 0, 25 known Unity/reference warnings, 0 errors. |
| DevToolbox `specs_validate player-weapon-computer-controls-v1` | PASS | 7 tasks parsed. |
| DevToolbox `verify_run` | BLOCKED | Execution `a0e30636346243c8aace8f9b679f5dab`; Specs passed, generic root Build/Test/Lint failed because the workspace contains multiple MSBuild projects/solutions and the configured command does not pass `Weltraum Spiel.sln`. |
| DevToolbox task completion preflight | BLOCKED | Source line 3 blocked by latest failed generic `verify_run`; tasks left unchecked. |
| Runtime Unity MCP HUD probe | PASS | `hud=True, weaponPanelVisible=False, targets=10, active=Target Moving Placeholder, auto=False, priority=ManualOrder, combatControls=True`. |
| Unity MCP GameView screenshot | PASS | `tests/screenshots/player-weapon-computer-controls-v1-gameview.png`. |
| Unity console after GameView capture | PASS | 0 log entries. |

## Aspect-Ratio Coverage

`ResponsiveLayoutKeepsCombatComputerControlsSeparated` forces the Player HUD layout over:

- 2560 x 1080
- 1920 x 1080
- 1280 x 720
- 1024 x 768
- 900 x 1600
- 640 x 480

For each size it asserts:

- `CombatControls` is active in Combat context.
- The control row does not overlap `ContextBody`.
- The control row does not overlap `ContextGauges`.
- Each of `Prev`, `Next`, `Clear`, `Auto`, and `Prio` stays inside the row.
- Adjacent buttons do not overlap each other.

## Broader Suite Note

The broader `PrototypePlayerHudValidationTests` + full `PrototypeWeaponComputerTurretValidationTests` run (`52888cbefac54b099762c4c7d772735f`) failed in existing projectile visual/simulation tests:

- `HighFireRateHitscanKeepsProjectileObjectsAndVisualsBounded`
- `SimulatedProjectileSnapshotPersistsAcrossSimulationFrames`

The failed area is not touched by this slice. The high-fire-rate test passed when run alone (`4ff22f8ab7794b56897bc3bb43b6a6ac`). Scoped acceptance therefore uses the focused helper/HUD tests, the full HUD suite, the UI architecture suite, explicit solution build, and runtime GameView evidence above.

## DevToolbox Preflight Note

`verify_run` uses root-level `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes`. Those commands fail in this Unity workspace with `MSB1011` / multiple workspace-file selection errors unless the explicit solution path is supplied. The explicit command `dotnet build "Weltraum Spiel.sln" --no-restore` passed. Because `tasks_completion_preflight` uses the latest `verify_run` state, it blocked task completion; task checkboxes were not toggled.

## Screenshot

![Weapon Computer Controls GameView](screenshots/player-weapon-computer-controls-v1-gameview.png)
