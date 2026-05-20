# Test Protocol: trajectory-preview-burn-planner

## Scope

Completed the first debug-only trajectory preview and burn-plan slice. The slice includes bounded local-state prediction, optional central gravity through `ShipPhysicsCore`, a selected-gizmo trajectory preview, and data-only burn estimates.

## Script Validation

Unity MCP `validate_script` returned 0 errors and 0 warnings for:

- `Assets/Scripts/Prototype/TrajectoryPredictionState.cs`
- `Assets/Scripts/Prototype/TrajectoryPredictor.cs`
- `Assets/Scripts/Prototype/TrajectoryBurnPlan.cs`
- `Assets/Scripts/Prototype/TrajectoryPreviewDebugGizmo.cs`
- `Assets/Tests/Editor/TrajectoryPreviewPredictionTests.cs`

Unity MCP `read_console` with C# error filtering returned 0 entries.

## Unity EditMode Tests

Focused trajectory job `dd8d1f46baf0415f8baf9e7f85881fec`:

- Total: 5
- Passed: 5
- Failed: 0

Full EditMode job `75427719b5cd47dea1280e7d45d8780f`:

- Total: 46
- Passed: 46
- Failed: 0

Covered trajectory checks:

- Bounded prediction returns finite states.
- Step count clamps to `TrajectoryPredictor.MaxStepCount`.
- Gravity-only prediction matches a short real simulation within tolerance.
- Debug gizmo refresh stores predicted states.
- Burn plan estimates direction, duration, throttle, requested fuel, available fuel fraction, and delta-v.

## Additional Verification

- `specs_validate trajectory-preview-burn-planner`: passed.
- `dotnet build ".\Weltraum Spiel.sln"`: passed with existing Unity/MSB3277 and serialized-field warnings.
- `dotnet test ".\Weltraum Spiel.sln" --no-build`: passed.

DevToolbox `verify_run` for execution `c5c788baf5e241e3916731be79e795c7` passed the spec validation step and failed its generic Build/Test/Lint presets because they run `dotnet build`, `dotnet test`, and `dotnet format --verify-no-changes` without a workspace argument in a Unity root that contains multiple project/solution files. The scoped solution commands above are the accepted build/test evidence for this slice.

## Prediction Assumptions

Documented in `docs/physics-flight-model.md`:

- Included: local translation from initial velocity and optional central gravity using the same `mu / r^2` helper as live physics.
- Excluded: main thrust, RCS, SAS, flight assist, recoil, docking assist, atmosphere, drag, thermal effects, collisions, damage, floating-origin shifts, full rotation integration, orbit map UI, maneuver nodes, patched conics, SOI transitions, and N-body prediction.

## Notes

Unity generated `Assets/_Recovery/` during editor work. It is a recovery artifact and was intentionally left untracked.
