# Test Protocol: architecture-main-thrust-modes

Date: 2026-05-19

## Unity MCP Script Validation

Validated changed scripts with Unity MCP `validate_script(level=standard)`:

- `Assets/Scripts/Prototype/MainThrustMode.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeShipConfig.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing generic warning
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing generic warnings
- `Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings
- `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings

Unity console error query after refresh/test run returned no compile errors.

## Unity MCP EditMode Tests

Command:

```text
run_tests mode=EditMode filter=PrototypePhysicsValidationTests
```

Result:

```text
25 total, 25 passed, 0 failed, 0 skipped
duration: 0.5819014 seconds
job_id: 448612c14f57427bb016a695da995fcb
```

Relevant passing tests:

- `PrototypePhysicsValidationTests.MainThrottleAppliesForwardForceWithoutUnintendedTorque`
- `PrototypePhysicsValidationTests.FullyPhysicalMainThrottleAppliesFullForceAtNozzlePosition`
- `PrototypePhysicsValidationTests.GimbalSteeringTorqueMatchesCrossProductEstimate`
- `PrototypePhysicsValidationTests.FullyPhysicalGimbalTorqueDiagnosticsMatchFullForceCrossProduct`

The first test verifies the default `ComSafeSteeringOnly` throttle-only torque remains near zero. The fully physical tests verify full gimballed force is applied at the nozzle position and torque diagnostics match `cross(nozzlePosition - worldCenterOfMass, force)`.

## dotnet

Command:

```text
dotnet build "Weltraum Spiel.sln"
```

Result:

```text
Exit code: 0
Build succeeded.
Warnings: MSB3277 Unity/MCP assembly version conflicts for System.Net.Http and System.IO.Compression.
Errors: 0
```

Command:

```text
dotnet test "Weltraum Spiel.sln"
```

Result:

```text
Exit code: 0
Restore complete; no test project execution output from dotnet.
```
