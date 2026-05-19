# Test Protocol: architecture-fuel-mass-flow

Date: 2026-05-19

## Scope

Validated the implemented fuel mass-flow behavior for main thrust, partial fuel, RCS final allocator fuel consumption, mass integration, and project build/test health.

## Unity MCP Script Validation

Command family: Unity MCP `validate_script`, `level=standard`, `include_diagnostics=true`.

- `Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing warning about string concatenation in `Update()`
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing warnings about Rigidbody access/update timing and string concatenation
- `Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings
- `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings

## Deterministic Unity Probe

Command family: Unity MCP `execute_code` using `PhysicsValidationProbe`.

Result:

```text
main full=0.600000 half=0.300000 zeroThrottle=0.000000 zeroCostThrust=45000.0 zeroCostFuel=0.000000 ok=True;
partial applied=22500.000 expected=22500.000 remaining=0.000000 ok=True;
rcs allocated=2.451154 requested=0.029414 consumed=0.029414 expected=0.029414 fraction=1.000000 apps=7 active=7 ok=True;
mass initial=3770.000 final=3769.400 consumed=0.600000 drop=0.600098 ok=True
```

Coverage:

- Full, half, and zero main throttle fuel use scale as expected.
- Zero fuel-cost thrust still applies thrust and consumes 0 kg.
- Almost-empty tank applies partial main thrust and does not go negative.
- RCS fuel is requested and consumed once from final allocated nozzle throttle output.
- Fuel consumption feeds back into the mass model after mass properties are reapplied.

## Unity EditMode Tests

Command: Unity MCP `run_tests`, mode `EditMode`, test name `PrototypePhysicsValidationTests`.

Result: succeeded, 20/20 tests completed.

## .NET Verification

Command: `dotnet build "Weltraum Spiel.sln"`

Result: exit code 0. Build succeeded with existing Unity/MCP reference and unused serialized-field warnings.

Command: `dotnet test "Weltraum Spiel.sln"`

Result: exit code 0.
