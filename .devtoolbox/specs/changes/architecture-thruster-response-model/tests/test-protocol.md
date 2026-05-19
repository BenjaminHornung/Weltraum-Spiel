# Test Protocol: architecture-thruster-response-model

Date: 2026-05-19

## Unity MCP Script Validation

- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeShipConfig.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing style warning about string concatenation in Update.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing style warnings about Rigidbody operations and string concatenation in Update.
- Unity console error query: 0 entries.

## Deterministic Unity MCP Probes

- Throttle finite-rate probe: `ok=True upRate=0.500 downRate=1.000 targetUp=1.000 afterUp=0.100 targetDown=0.000 afterDown=0.050`.
- Gimbal slew and clamp probe: `ok=True slewOk=True clampOk=True slew=10.000 limit=20.000 firstActual=0.250 firstAngle=5.000 settledActual=1.000 settledAngle=20.000 clampMagnitude=1.000 clampAngle=19.897`.
- Default responsiveness probe: `ok=True ratesDefaultInstant=True targetThrottle=1.000 actualThrottle=1.000 targetYaw=0.350 actualYaw=0.350 angle=7.000`.

## Unity EditMode Tests

- Unity MCP `run_tests(mode=EditMode)`: passed.
- Job id: `9a8870eecbbc4d70967cc42b2045db23`.
- Summary: 25 total, 25 passed, 0 failed, 0 skipped.
- Last finished test: `PrototypePhysicsValidationTests.WiderModuleLayoutRaisesInertiaAndLowersAngularAcceleration`.

## .NET Verification

- `dotnet build "Weltraum Spiel.sln"`: exit 0, build succeeded.
- Build warnings: 2 MSB3277 Unity/MCP assembly version conflict warnings (`System.Net.Http`, `System.IO.Compression`).
- `dotnet test "Weltraum Spiel.sln"`: exit 0; solution contains no separate .NET test project output beyond restore.
