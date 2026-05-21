# Tasks: performance-stability-hotpath-cleanup-v1

## Implementation

- [x] 1. Gate and throttle autopilot navigation planning.
- [x] 2. Add `ObstacleAvoidance` autopilot state and diagnostics.
- [x] 3. Add `PrototypeNavigationObstacleRegistry` and remove detector `FindObjectsByType` fallback.
- [x] 4. Make RCS allocator steady-state scratch allocation-free.
- [x] 5. Restrict VisualSwitcher stripping to the dedicated manager and add safe migration.
- [x] 6. Avoid camera-bounds refresh on camera-mode-only reframe.

## Verification

- [x] 1. Add/update source guards and focused EditMode tests.
- [x] 2. Add PlayMode performance smoke evidence.
- [x] 3. Attempt Unity MCP script validation and console checks; MCP reported `no_unity_session`, so Unity Batchmode logs are the authoritative fallback.
- [x] 4. Run focused Unity EditMode tests.
- [x] 5. Run full Unity EditMode suite.
- [x] 6. Run PlayMode performance smoke test or record blocker.
- [x] 7. Run `dotnet build "Weltraum Spiel.sln"`.
- [x] 8. Run `dotnet test "Weltraum Spiel.sln" --no-build`.
- [x] 9. Validate OpenSpec change.
- [x] 10. Commit and push.
