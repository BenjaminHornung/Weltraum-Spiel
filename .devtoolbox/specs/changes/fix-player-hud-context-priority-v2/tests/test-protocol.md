# Test Protocol

## Change
`fix-player-hud-context-priority-v2`

## Evidence
- `dotnet build "Weltraum Spiel.sln" --no-restore` passed after Unity project refresh regenerated the project file for the already-present `WeaponRecoilMode.cs`.
- `dotnet test "Weltraum Spiel.sln" --no-build` exited 0.
- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypePlayerHud.cs`: 0 errors, 2 existing-style warnings.
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors.
  - `Assets/Tests/Editor/PrototypePlayerHudValidationTests.cs`: 0 errors.
- Unity MCP EditMode `PrototypePlayerHudValidationTests`: 17/17 passed.
- Unity MCP focused EditMode HUD/docking/arena/trajectory pass: 39/39 passed.
- Unity MCP console after refresh/screenshot: 0 errors.
- Screenshot evidence:
  - `tests/screenshots/player-hud-context-priority-v2.png`: first visual check caught Objective title/body overlap.
  - `tests/screenshots/player-hud-context-priority-v2-fixed.png`: fixed visual check; Docking no longer dominates, Objective is separate, Ship Systems contains only ship state, and visible panels do not overlap.
- Git evidence:
  - Implementation commit: `89e810c #PLAYER-HUD-V2 fix HUD context priority`
  - Follow-up metadata commit records the final task toggle.

## Notes
- The workspace contained unrelated dirty/untracked Flight/RCS/recoil files before this change. They were not reverted.
- Unity Force Refresh created `Assets/Scripts/Prototype/WeaponRecoilMode.cs.meta` for an already-present source file so the editor and generated csproj could compile the existing recoil changes.
