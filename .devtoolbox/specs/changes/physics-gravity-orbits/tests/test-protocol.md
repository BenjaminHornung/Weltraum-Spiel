# Test Protocol: physics-gravity-orbits

Date: 2026-05-19

## Summary

Optional central-body gravity was added through `ShipPhysicsCore` and remains disabled by default. Deterministic EditMode probes cover the default zero-gravity path, `mu / r^2` direction and magnitude, and mass-independent acceleration.

## Commands

```powershell
dotnet build "Weltraum Spiel.sln"
dotnet test "Weltraum Spiel.sln"
```

## Results

- `dotnet build "Weltraum Spiel.sln"`: passed. Existing Unity reference/unassigned-field warnings remained.
- `dotnet test "Weltraum Spiel.sln"`: passed with exit code 0.
- Unity MCP script refresh/compile: ready with 0 console errors after refresh.
- Unity MCP EditMode `PrototypePhysicsValidationTests`: passed 18/18.

## Gravity Evidence

- Default prototype gravity step: no body, no acceleration, no force application.
- Central body at 10 m with `mu = 1000`: acceleration `(10, 0, 0)` m/s^2 toward the body and zero torque.
- Central body at 20 m with `mu = 800`: acceleration stayed `(0, 2, 0)` m/s^2 for light and heavy ships, while diagnostic force scaled with mass.
