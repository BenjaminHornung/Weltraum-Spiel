# Test Protocol: environment-atmosphere-layer

Date: 2026-05-19
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity: 6000.4.7f1

## Implementation Evidence

- `PrototypeAtmosphereVolume` defines an opt-in atmosphere volume/field. Defaults are vacuum: simulation disabled and density `0`.
- `PrototypeAtmosphereVolume.CalculateDragForce` implements `-relativeVelocity.normalized * 0.5 * density * speed^2 * dragCoefficient * referenceArea`.
- `ShipPhysicsCore` samples the configured atmosphere during `ApplyEnvironmentForces` and applies non-zero drag at the center of mass through `ApplyForceAtCenterOfMass`.
- `PrototypeDebugOverlay` shows atmosphere active/vacuum state, density, relative speed, drag coefficient, reference area, and drag force.

## Unity MCP Script Validation

- `Assets/Scripts/Prototype/PrototypeAtmosphereVolume.cs`: `validate_script` standard, 0 warnings, 0 errors.
- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: `validate_script` standard, 0 warnings, 0 errors.
- `Assets/Scripts/Prototype/PlayerShipController.cs`: `validate_script` standard, 1 existing non-blocking string-allocation warning, 0 errors.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: `validate_script` standard, 2 existing non-blocking overlay warnings, 0 errors.
- `Assets/Tests/Editor/PrototypeAtmosphereValidationTests.cs`: `validate_script` standard, 0 warnings, 0 errors.

## Unity MCP EditMode Tests

Command:

```text
run_tests(mode=EditMode, test_names=[
  PrototypeAtmosphereValidationTests.NoAtmosphereConfiguredAppliesZeroAtmosphereForce,
  PrototypeAtmosphereValidationTests.AtmosphereDragOpposesVelocity,
  PrototypeAtmosphereValidationTests.AtmosphereDragScalesWithSquaredSpeed
])
```

Result:

```text
job_id=242d14b4b22e4808af4009b2eb39b266
total=3
passed=3
failed=0
skipped=0
resultState=Passed
```

Covered requirements:

- Default/no atmosphere: `ApplyEnvironmentForces` returns false, `LastAtmosphereActive` is false, drag force and net applied force are zero.
- Test atmosphere direction: drag magnitude is positive, `Vector3.Dot(drag, velocity) < 0`, and drag aligns with `-velocity`.
- Squared-speed scaling: drag at 20 m/s divided by drag at 10 m/s equals `4.0` within `0.001`.

## .NET Commands

```text
dotnet build ".\Weltraum Spiel.sln"
```

Result: exit code `0`. Build succeeded with existing Unity reference/version warnings (`MSB3277`) and existing serialized-field warnings.

```text
dotnet test ".\Weltraum Spiel.sln"
```

Result: exit code `0`. The command restored projects and found no dotnet test projects to execute.
