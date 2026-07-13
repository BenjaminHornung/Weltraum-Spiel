# Test Protocol: add-autopilot-obstacle-avoidance-v1

Date: 2026-05-20

## Scope

Implemented local reactive waypoint-autopilot obstacle avoidance:

- `PrototypeNavigationObstacle` metadata for label, clearance radius, and danger radius.
- Generated asteroid-field objects now keep physical colliders and obstacle metadata.
- `PrototypeWaypointAutopilot` adds `ObstacleAvoidance`, `Avoidance` phase, cached diagnostics, and bounded `Physics.SphereCastNonAlloc` corridor sensing.
- Avoidance requests physical RCS/main/attitude control only through `FlightAssistRequest`.

## Automated Checks

- `mcp__unityMCP__.validate_script` on `Assets/Scripts/Prototype/PrototypeNavigationObstacle.cs`: passed, 0 diagnostics.
- `mcp__unityMCP__.validate_script` on `Assets/Scripts/Prototype/PrototypeWaypointAutopilot.cs`: passed, 0 errors, 1 existing-style warning about string concatenation.
- `mcp__unityMCP__.validate_script` on `Assets/Tests/Editor/PrototypeWaypointAutopilotValidationTests.cs`: passed, 0 diagnostics.
- `mcp__unityMCP__.validate_script` on `Assets/Scripts/Prototype/PrototypeTestEnvironment.cs`: passed, 0 diagnostics.
- `mcp__servicerunner__.specs_validate add-autopilot-obstacle-avoidance-v1`: passed with 4 capability specs.
- Focused Unity EditMode obstacle/environment tests: passed 7/7.
- `PrototypeWaypointAutopilotValidationTests`: passed 20/20.
- `PrototypeTestEnvironmentValidationTests`: passed 9/9.
- `dotnet build "Weltraum Spiel.sln"`: passed with existing MSB3277 assembly-version warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exit 0.
- Static source check in `PrototypeWaypointAutopilotValidationTests.AutopilotSourceDoesNotAssignRigidbodyMotionStateDirectly` covers direct Rigidbody motion writes and `SphereCastAll` in the autopilot source.
- Unity MCP profiler `get_frame_timing`: available and returned a timing sample. No meaningful PlayMode spike comparison was captured in this pass.

## Full-Suite Result

Full Unity EditMode suite was attempted and failed 162/163 with one unrelated projectile test failure:

```text
PrototypePhysicsValidationTests.ProjectileMomentumUsesConfiguredMassForRecoilAndImpact
Expected: 2.5f +/- 0.00999999978f
But was:  0.0f
```

Git status shows many unrelated modified/untracked files outside this change, including weapon/projectile/UI work. This protocol does not treat that projectile regression as an obstacle-avoidance failure.

## Planned Manual/PlayMode Regression

Pending:

- Free waypoint route: ship should stay out of `ObstacleAvoidance` and continue normal long-range burn/brake/final approach.
- Blocked route with RCS: ship should enter `ObstacleAvoidance`, suppress main throttle toward the obstacle, request lateral RCS force, then resume route after clear frames.
- Blocked route without practical authority: ship should report `NoAvoidanceAuthority` or `ObstacleBlocked`, not fly through the obstacle.

## Performance Notes

The autopilot hot path uses a reusable `RaycastHit[]`, `Physics.SphereCastNonAlloc`, query-trigger ignore, layer mask filtering, and a configurable scan interval. It does not use `FindObjectsByType`, global obstacle lists, or `SphereCastAll` in `PrototypeWaypointAutopilot`.
