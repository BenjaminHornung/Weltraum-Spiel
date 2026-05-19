# Test Protocol: fix-physics-consistency-regressions

Date: 2026-05-19

## Spec Validation

- `specs_validate(changeName=fix-physics-consistency-regressions)`: passed.

## Unity MCP Script Validation

Validated changed scripts through Unity MCP `validate_script` / compile refresh. Result: no script errors.

- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/Projectile.cs`: 0 errors; validator warning about string concatenation in Update.
- `Assets/Scripts/Prototype/GunModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings after allocator normalization fix.
- `Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings.
- `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors; validator warning about string concatenation in Update.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors; validator warnings about FixedUpdate/Rigidbody and string concatenation.

## Unity MCP EditMode Tests

- Targeted `PrototypePhysicsValidationTests`: 26/26 passed after the RCS normalized-cost threshold adjustment.
- Full EditMode suite: 35/35 passed.
- Final Unity MCP job id: `62724e183cbd4d1a9a1472b766130101`.

Covered checks include configured-mass projectile recoil/impact consistency, force-vs-impulse diagnostic separation, RCS desired/actual/residual diagnostics, RCS spool-limited actual throttle, manual/SAS torque priority, and null-config default reset.

## dotnet Verification

- `dotnet build "Weltraum Spiel.sln"`: passed with existing Unity reference warnings (`MSB3277`) plus existing serialized-field warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exited 0; no additional test output was produced by the generated Unity project.

## Notes

- Unity MCP compile/test evidence remains the primary verification for this Unity project.
- A transient earlier `.sln` build attempt failed while Unity project files lagged behind a separate dirty `PrototypeBootstrap` debug-console change; after Unity/project refresh, the final `.sln` build passed.