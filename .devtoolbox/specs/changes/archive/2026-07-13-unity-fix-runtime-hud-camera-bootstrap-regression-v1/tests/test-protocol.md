# Test Protocol

## Evidence Log

- ServiceRunner/DevToolbox MCP status:
  - `workspace_discover`, `specs_get_status`, `specs_list_changes`, and `mcp_transport_session_status` were attempted from the Codex tool surface.
  - Each returned `Transport closed`, so no MCP execution id could be created before implementation.
  - DevToolbox artifacts were created directly in the repository and this outage is recorded here as fallback evidence.

## Planned Verification

- Unity MCP, if visible to Codex tools:
  - Confirm editor ready and not in Play Mode.
  - Validate changed scripts.
  - Read console for compile/runtime errors.
  - Run focused EditMode and PlayMode tests.
  - Capture Game View screenshots for startup HUD/ship visibility and navigation planner target.
- Local fallback:
  - `dotnet build "Weltraum Spiel.sln" --no-restore`
  - Unity batchmode EditMode/PlayMode tests if Unity MCP remains unavailable.

## Results

- Implementation completed for the runtime HUD/camera bootstrap slice.
- Code changes:
  - `PrototypeBootstrap` now keeps one camera-bound HUD/component stack and selects a default navigation preview target after default waypoint creation without engaging autopilot.
  - `PrototypePlayerHudRenderer` can self-bind to the active `PrototypeShip` when created stale or unbound, and exposes clear bind-state diagnostics.
  - `SimpleFollowCamera` only enables autopilot flip assist while autopilot is engaged in flip/brake phases, so idle/cruise framing remains locked to the ship.
- Local .NET:
  - `dotnet build "Weltraum Spiel.sln" --no-restore` passed with 0 errors and existing warnings. Log: `tests/logs/dotnet-build.log`.
  - `dotnet test "Weltraum Spiel.sln" --no-build` exited 0. Log: `tests/logs/dotnet-test.log`.
- Unity MCP over local HTTP endpoint:
  - `validate_script` passed with 0 warnings and 0 errors for changed runtime/test scripts. Summary: `tests/logs/unity-validate-scripts-summary.json`.
  - Focused EditMode tests passed 3/3:
    - `PrototypePlayerHudValidationTests.BootstrapBindsPlayerHudCanvasSeparateFromPrototypeWindows`
    - `PrototypePlayerHudValidationTests.PlayerHudRefreshSelfBindsActivePrototypeShipWhenCreatedUnbound`
    - `PrototypeSimpleFollowCameraValidationTests.ChaseLockedDoesNotEnterAutopilotFlipAssistFromIdleAngularVelocity`
  - Focused PlayMode test passed 1/1:
    - `PrototypeRuntimeHudCameraBootstrapPlayModeTests.PlayMode_BootstrapShowsBoundHudShipAndDefaultNavigationTarget`
  - Unity logs include bootstrap visibility evidence with `hasVisibleImportedShip=True`, `importedVisibleMeshRendererCount=29`, `cameraTargetDistance=19.0`, bound HUD dependencies, default nav target, and arena targets.
  - `read_console` after the focused tests returned Unity's benign test-runner result-save message (`Saving results to: ...TestResults.xml`) as an `Exception` typed console entry; no compile errors or test failures were reported.
- ServiceRunner/DevToolbox MCP:
  - `specs_get_status`, `tasks_load`, `mcp_transport_session_status`, `execution_create`, and `specs_validate` all failed with `Transport closed`.
  - No `verify_run` execution id could be created. Fallback evidence is recorded in `tests/logs/servicerunner-mcp-outage-final.txt`.
- Screenshot note:
  - No Unity screenshot capture tool is exposed by the currently listed MCP tools. The PlayMode regression asserts the visible startup conditions directly: imported renderers, main camera chase target, bound HUD modules, non-`n/a` fuel, default nav target, radar blips, and 3 arena targets.
