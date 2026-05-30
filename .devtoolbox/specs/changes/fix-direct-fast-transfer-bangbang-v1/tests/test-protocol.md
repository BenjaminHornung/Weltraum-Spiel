# Test Protocol: fix-direct-fast-transfer-bangbang-v1

## Scope

Evidence for DirectFastTransfer waypoint autopilot behavior:

- analytical planner solution,
- lateral-feasible DirectFastTransfer acceptance versus high-lateral fallback,
- no arbitrary Coast in free direct routes when DirectFastTransfer is selected,
- continuous full main throttle during full burn/full brake windows,
- terminal brake commitment and RCS-only final hold,
- arrival point measured from ship center of mass to target position,
- obstacle and limited-authority fallbacks.
- `plannedSwitchDistanceMeters` is documented as diagnostic metadata only unless a dedicated distance gate is added.

## Evidence Artifacts

Logs and traces saved under this change's `tests/` folder:

- `tests/logs/dotnet-build.log`
- `tests/logs/editmode-results.xml`
- `tests/logs/unity-mcp-editmode-navigation-computer-v2-final.json`
- `tests/logs/unity-mcp-playmode-autopilot-navigation-final.json`
- `tests/logs/unity-mcp-validate-scripts.json`
- `tests/logs/direct-fast-transfer-trace.csv`
- `tests/screenshots/direct-fast-transfer-unity-mcp-scene-view.png`

Earlier CLI PlayMode evidence from before the terminal no-RCS fix was moved to `tests/logs/playmode-results-pre-mcp-failed.xml` and `tests/logs/playmode-unity-pre-mcp-failed.log` for historical debugging. The final passing PlayMode evidence is the Unity MCP JSON result above.

## Verification Commands

Executed:

- `dotnet build "Weltraum Spiel.sln" --no-restore`
- Unity MCP `validate_script` for changed product and test scripts.
- Unity MCP `run_tests` EditMode group `PrototypeAutopilotNavigationComputerV2ValidationTests`.
- Unity MCP `run_tests` PlayMode group `PrototypeAutopilotNavigationPlayModeTests`.
- Unity MCP `manage_camera` Scene View screenshot capture.

Final results:

- `dotnet build`: passed with 0 errors and existing Unity reference warnings.
- Unity MCP script validation: passed with 0 errors; `PrototypeWaypointAutopilot.cs` reports one existing GC warning.
- EditMode `PrototypeAutopilotNavigationComputerV2ValidationTests`: passed 31/31.
- PlayMode `PrototypeAutopilotNavigationPlayModeTests`: passed 30/30.

## Evidence Log

- `2026-05-30`: Initial Unity CLI EditMode pass produced `tests/logs/editmode-results.xml` with 31/31 passing.
- `2026-05-30`: Initial full CLI PlayMode run exposed two DirectFastTransfer regressions; kept as `playmode-results-pre-mcp-failed.xml`.
- `2026-05-30`: After product fixes, Unity MCP final EditMode run passed 31/31.
- `2026-05-30`: After product fixes, Unity MCP final PlayMode run passed 30/30.
- `2026-05-30`: `direct-fast-transfer-trace.csv` summarizes build, validation, EditMode, PlayMode, and screenshot evidence.

## Known Limits

- Unity MCP tools were not exposed by Codex tool discovery at change creation time, but the running Unity MCP HTTP bridge was available later at `http://127.0.0.1:8080/mcp`; final Unity tests used that bridge.
- The screenshot artifact is a Scene View availability capture, not phase-specific burn/flip/brake/final-hold imagery. Runtime behavior is covered by PlayMode tests and trace logs.
