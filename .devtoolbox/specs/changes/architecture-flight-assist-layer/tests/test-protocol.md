# Test Protocol - architecture-flight-assist-layer

Date: 2026-05-19

## Unity MCP Script Validation

- `validate_script Assets/Scripts/Prototype/FlightAssistRequest.cs`: 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/PlayerShipController.cs`: 1 existing GC warning, 0 errors.
- `validate_script Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 2 existing Unity-MCP style warnings, 0 errors.
- `read_console` with error filter: 0 entries.

## Assist Off / Vacuum Inertia

Unity MCP `execute_code` probe created an isolated Rigidbody with zero gravity, zero linear damping, and zero angular damping. It inspected the default `PlayerShipController` flight-assist request and simulated 12 fixed steps.

Result:

```text
mode=Simulation; source=None; hasPhysical=False; hasAny=False; debugOnly=False; linearDamping=0.000; angularDamping=0.000; linearDelta=0.000000; angularDelta=0.000000
```

## Request-Source Diagnostics

Unity MCP `execute_code` probe called `RcsThrusterController.ApplyControls` with manual translation/attitude input, SAS enabled, and an explicit assisted-flight request.

Result:

```text
allOk=True; mode=AssistedFlight; source=FlightAssist; debugOnly=False; translation=(0.25, 0.00, 0.00); manualTorque=(650.00, 0.00, 0.00); rawSasTorque=(0.00, -1625.00, 0.00); maskedSasTorque=(0.00, -1625.00, 0.00); assistForce=(10.00, 20.00, 30.00); assistTorqueLocal=(4.00, 5.00, 6.00); desiredTorque=(608.31, -1506.83, 5.58)
```

Manual, SAS, and assist diagnostics are visible as separate fields before allocation.

## Hidden Damping Check

Command:

```powershell
rg -n "FlightAssist|flightAssist|linearDamping|angularDamping|linearVelocity\s*=|angularVelocity\s*=" Assets/Scripts/Prototype
```

Findings:

- Flight-assist hits are enum/data, diagnostics, request construction, and RCS allocator routing.
- Damping writes remain explicit zero-damping setup in `PrototypeBootstrap`, `PlayerShipController.ConfigureRigidbody`, and `PhysicsValidationProbe`.
- Velocity writes found are projectile launch velocity and the pre-existing SAS tiny-angular-velocity settle path; no flight-assist damping or hidden velocity-write path was found.

## Build And Test

- `dotnet build "Weltraum Spiel.sln"`: passed with existing Unity reference/serialized-field warnings.
- `dotnet test "Weltraum Spiel.sln"`: exited 0.
