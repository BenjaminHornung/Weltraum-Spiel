# Test Protocol: Performance Stability Hotpath Cleanup v1

## Artifact Paths

- Logs: `.devtoolbox/specs/changes/performance-stability-hotpath-cleanup-v1/tests/logs/`
- Performance: `.devtoolbox/specs/changes/performance-stability-hotpath-cleanup-v1/tests/performance/`
- Screenshots: `.devtoolbox/specs/changes/performance-stability-hotpath-cleanup-v1/tests/screenshots/`

## Planned Verification

## Results

All verification commands below were run on 2026-05-21 against `E:\Unity\Weltraum Spiel\Weltraum Spiel`.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused EditMode: `PrototypeWaypointAutopilotValidationTests` | PASS 25/25 | `tests/logs/focused-prototypewaypointautopilotvalidationtests.xml` |
| Focused EditMode: `PrototypeAutopilotNavigationComputerV2ValidationTests` | PASS 19/19 | `tests/logs/focused-prototypeautopilotnavigationcomputerv2validationtests.xml` |
| Focused EditMode: `PrototypeFunctionalShipSocketValidationTests` | PASS 8/8 | `tests/logs/focused-prototypefunctionalshipsocketvalidationtests.xml` |
| Focused EditMode: `PrototypeHotpathAllocationValidationTests` | PASS 2/2 | `tests/logs/focused-prototypehotpathallocationvalidationtests.xml` |
| Focused EditMode: `PrototypeSimpleFollowCameraValidationTests` | PASS 17/17 | `tests/logs/focused-prototypesimplefollowcameravalidationtests.xml` |
| Focused EditMode: `PrototypeShipVisualSwitcherValidationTests` | PASS 12/12 | `tests/logs/focused-prototypeshipvisualswitchervalidationtests.xml` |
| Focused EditMode: `PrototypeShipVariantValidationTests` | PASS 9/9 | `tests/logs/focused-prototypeshipvariantvalidationtests.xml` |
| Full Unity EditMode suite | PASS 228/228 | `tests/logs/editmode-full-results.xml`, `tests/logs/editmode-full.log` |
| Full Unity PlayMode suite | PASS 7/7 | `tests/logs/playmode-full-results.xml`, `tests/logs/playmode-full.log` |
| PlayMode performance smoke | PASS 1/1 | `tests/logs/playmode-performance-smoke-results.xml`, `tests/performance/playmode-performance-smoke.md`, `tests/screenshots/playmode-performance-final.png` |
| `dotnet build "Weltraum Spiel.sln" --nologo` | PASS, 0 errors, 23 warnings | Existing Unity/MCP assembly conflict and serialized-field warnings remain. |
| `dotnet test "Weltraum Spiel.sln" --no-build --nologo` | PASS, exit 0 | Command produced no test output. |
| OpenSpec validation | PASS 1/1 valid, 0 issues | Local `openspec validate performance-stability-hotpath-cleanup-v1 --type change --json --no-interactive` against a temporary `openspec/changes` mirror. |

## Performance Evidence

- Runtime smoke: 34.49s, 105539 frames in batchmode Editor PlayMode.
- Camera mode cycles: 10; camera visual bounds refreshes stayed bounded to visual switches, `5 -> 11`.
- Autopilot was disengaged after manual replan; navigation plan refreshes stayed `1 -> 1`, proving no continuous FixedUpdate planning while off.
- RCS nozzle refreshes stayed bounded to visual rebuild events, `9 -> 23`, rather than frame count.
- Profiler recorder: GC recorder active, max recorded GC allocated in frame `1481792` bytes; main-thread recorder active, max sample `20062300` ns.
- Screenshot evidence: `tests/screenshots/playmode-performance-final.png`.

## MCP Note

Unity MCP tools were discovered and the editor was started against this project path, but MCP reported `instance_count: 0` and `no_unity_session` for `read_console`. Because the connector had no active Unity session, script validation and console reads through MCP could not be used as authoritative evidence. Unity Batchmode compile, EditMode, PlayMode, and logs were used instead.
