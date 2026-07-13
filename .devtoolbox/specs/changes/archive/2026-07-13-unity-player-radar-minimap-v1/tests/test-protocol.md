# player-radar-minimap-v1 Test Protocol

## Scope

Validate the new Player HUD radar/minimap slice:

- radar snapshot data collection from existing navigation, arena, combat, docking, environment, obstacle, route, preview, and avoidance sources
- existing `PrototypePlayerHudRadarGraphic` rendering path with typed blips and dynamic range label
- no regression to the second IMGUI radar path
- responsive HUD layout still separated at tested aspect ratios

## Evidence

### Static/Build

- `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Result: Passed.
  - Notes: Existing Unity/.NET warnings remained: `System.Net.Http`/`System.IO.Compression` version conflict warnings and pre-existing obsolete Unity test API warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`
  - Result: Passed with exit code 0.
  - Notes: This route does not provide useful Unity test detail; Unity MCP EditMode tests below are the authoritative test evidence.
- `dotnet format "Weltraum Spiel.sln" --verify-no-changes --no-restore`
  - Result: Failed on pre-existing whitespace formatting issues across unrelated prototype/tutorial files.
  - Notes: Reported files include `PrototypeShipLayout.cs`, `PrototypeFlightHud.cs`, `PrototypeMomentumAssist.cs`, `PrototypeTurretWeapon.cs`, existing later sections of `PrototypeWaypointAutopilot.cs`, and `TutorialInfo/Scripts/Editor/ReadmeEditor.cs`. These are outside the radar implementation and were not bulk-formatted to avoid unrelated churn.

### Unity Script Validation

- `validate_script Assets/Scripts/Prototype/PrototypePlayerHud.cs`
  - Result: Passed, 0 errors.
  - Notes: Existing validator warnings: Rigidbody work should use `FixedUpdate`, string concatenation can allocate.
- `validate_script Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`
  - Result: Passed, 0 errors.
  - Notes: Existing validator warning: string concatenation can allocate.

### Unity EditMode Tests

- `PrototypePlayerHudValidationTests`
  - First run after code compile: passed 19/19.
  - Re-run after Unity domain reload: passed 19/19.

### Runtime Screenshot

- Captured with Unity MCP `manage_camera` from the real `PrototypeBootstrapHost` scene during runtime.
- Screenshot: `tests/screenshots/player-radar-minimap-v1-screen.png`

## Tool-State Note

A later full EditMode suite attempt was blocked by a stale Unity MCP test job (`cbac00fdcbe149c3934d01edd8f6776a`) that remained reported as `running` even though `editor_state` reported the editor idle and no tests running. `refresh_unity` and `manage_editor stop` did not clear that stale job. The focused HUD test suite was already run successfully after domain reload.

DevToolbox `verify_run` also failed its default Build/Test/Lint steps because it runs unscoped `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` in a Unity directory with multiple MSBuild files. The explicit solution-based build/test commands above were run manually.
