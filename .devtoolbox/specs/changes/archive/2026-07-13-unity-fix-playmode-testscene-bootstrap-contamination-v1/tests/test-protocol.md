# Test Protocol

## Evidence Log

- ServiceRunner MCP calls attempted at start:
  - `workspace_discover`: `Transport closed`
  - `mcp_transport_session_status`: `Transport closed`
- ServiceRunner MCP calls attempted again after implementation:
  - `specs_get_status`: `Transport closed`
  - `tasks_load`: `Transport closed`
  - `specs_validate`: `Transport closed`
  - `execution_create`: `Transport closed`
- Fallback: DevToolbox artifacts are maintained directly in the repository.
- Editor recovery:
  - Stopped Play Mode from `Assets/InitTestSceneeddf73b2-278d-4020-84b3-62a0d4d68df8.unity`.
  - Loaded `Assets/Scenes/SampleScene.unity`.
  - Removed ignored `Assets/InitTestScene*.unity*` artifacts after confirming the active scene was not an InitTestScene.

## Planned Verification

- Unity MCP `validate_script` for changed scripts and tests.
- Unity MCP focused EditMode tests for bootstrap guard/watchdog behavior.
- Unity MCP focused PlayMode tests for normal startup, simulated root disappearance, and TestRunner contamination.
- `dotnet build "Weltraum Spiel.sln" --no-restore`.
- `dotnet test "Weltraum Spiel.sln" --no-build`.

## Results

- Unity MCP `validate_script`:
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 warnings, 0 errors.
  - `Assets/Tests/PlayMode/PrototypeRuntimeHudCameraBootstrapPlayModeTests.cs`: 0 warnings, 0 errors.
  - `Assets/Tests/Editor/PrototypeBootstrapRuntimeGuardValidationTests.cs`: 0 warnings, 0 errors after final cleanup.
- Unity MCP EditMode:
  - `PrototypeBootstrapRuntimeGuardValidationTests`: 3/3 passed.
- Unity MCP focused PlayMode:
  - `PlayMode_BootstrapShowsBoundHudShipAndDefaultNavigationTarget`: 1/1 passed.
  - `PlayMode_TestRunnerSceneDoesNotArmRuntimeIntegrityWatchdog`: 1/1 passed.
  - `PlayMode_ForcedRuntimeIntegrityRepairRestoresMissingRootsOnce`: 1/1 passed.
- Real `SampleScene` recovery probe:
  - Active scene restored to `Assets/Scenes/SampleScene.unity`.
  - PlayMode root probe found `PrototypeShip`, `PrototypeEnvironment`, `PrototypeNavigationWaypoints`, `Main Camera`, and `PrototypePveArena`.
  - Unity console error probe returned 0 entries.
- `dotnet build "Weltraum Spiel.sln" --no-restore`: passed with 0 errors; remaining warnings are existing Unity assembly/reference and legacy obsolete API warnings outside this slice.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exit code 0 with no emitted test output from the Unity-generated solution.
