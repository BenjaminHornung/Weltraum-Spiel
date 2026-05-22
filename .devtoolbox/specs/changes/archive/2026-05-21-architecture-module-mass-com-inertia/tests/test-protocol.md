# Test Protocol: architecture-module-mass-com-inertia

Date: 2026-05-19

## Implementation Evidence

- Added `ModuleMassDescriptor`, `ShipMassProperties`, and `PrototypeModuleMassLayout` for generated module dry mass, fuel mass, local COM, and simple box inertia.
- `PrototypeBootstrap` now adds descriptors for Hull, Cockpit, FuelTank, MainThrusterGimbal, Gun, and four RCS blocks.
- `ShipStats.ApplyMassProperties` calculates descriptor mass properties and applies `Rigidbody.mass`, `centerOfMass`, and `inertiaTensor`.
- `PlayerShipController` reapplies mass properties during FixedUpdate and after main-thruster fuel use.
- `PrototypeDebugOverlay` shows descriptor module count, dry mass, fuel mass, COM, and inertia tensor.
- `docs/physics-flight-model.md` documents descriptor mass, COM, and inertia behavior.

## Unity MCP Validation

- `refresh_unity(scope=scripts, compile=request)`: ready, no compile errors.
- `validate_script Assets/Scripts/Prototype/ModuleMassDescriptor.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings.
- `validate_script Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings.
- Console after test run contained Unity Test Runner prebuild/postbuild warnings and result-path log only; no C# compile errors.

## Deterministic Probe

Unity MCP `execute_code` result:

```text
generatedMass=3770.000; expectedMass=3770.000; generatedCom=(0.000,0.019,0.047); modules=9; symmetricCom=(0.000000,0.000000,0.000000); heavyComX=1.250; expectedHeavyComX=1.250; compactIz=83.333; wideIz=833.333; compactAlpha=12.000; wideAlpha=1.200
```

## Unity EditMode Tests

Command: Unity MCP `run_tests(mode=EditMode)`

Result: PASS, 14/14 tests.

Covered checks:

- Generated module descriptors drive Rigidbody mass properties.
- Symmetric module layout keeps local COM centered.
- Moving a heavy module shifts COM to the weighted expected position.
- Wider module layout raises inertia and lowers angular acceleration for equal torque.
- Existing main thrust, RCS, fuel, projectile recoil detection, timestep, and thermal tests still pass.

## Dotnet

Command: `dotnet build '.\Weltraum Spiel.sln'`

Result: PASS, 0 errors. Warnings were Unity-generated reference/version conflicts and existing serialized-field assignment warnings.

Command: `dotnet test '.\Weltraum Spiel.sln'`

Result: PASS, exit code 0. The Unity solution contains no dotnet test project execution output beyond restore.
