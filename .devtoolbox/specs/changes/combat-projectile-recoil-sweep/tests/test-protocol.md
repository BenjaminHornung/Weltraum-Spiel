# Test Protocol: combat-projectile-recoil-sweep

Date: 2026-05-19 16:00:02 +02:00
Unity instance: Weltraum Spiel@49c909b3e97ba6e8
Unity version: 6000.4.7f1

## Unity MCP Validation

- `refresh_unity` with script compilation completed successfully.
- `validate_script` results:
  - `Assets/Scripts/Prototype/GunModule.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/Projectile.cs`: 0 errors, 1 analyzer warning about string concatenation in `Update()`.
  - `Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings.
  - `Assets/Scripts/Prototype/PrototypeShipConfig.cs`: 0 errors, 0 warnings.

## Behavioral Probes

- Relative projectile velocity unchanged (`executionId=77ddf41572504a09a1fe9cf9c784981e`): `pass=True`; expected velocity `(912.722500, -2.000000, 1227.953000)` matched actual velocity exactly with error `0.000000`.
- Recoil impulse direction and magnitude (`executionId=6a8ca779a0544a10bf496b2c4828b478`): `pass=True`; projectile mass `0.120000`, projectile speed `1500.000000`, expected magnitude `180.000000`; recorded recoil impulse and `ShipPhysicsCore.NetAppliedForce` matched exactly, `directionDot=1.000000`.
- Thin target sweep hit (`executionId=7aa84518eb574fd188eaa30500aece07`): `pass=True`; projectile swept from `z=0` to `z=20` through a cube with `z` depth `0.05`; `PrototypeTargetDummy.WasHit=True`, `Projectile.HasHitData=True`, `LastHitData.fromSweep=True`.
- No immediate self-hit (`executionId=823222b9fe80469c8a2ffb4a7d73de41`): `pass=True`; projectile fired from a cube ship registered `ignoredColliders=1` and reported no hit after moving through its own collider.

Note: The edit-mode sweep probe produced Unity's expected editor-only `Destroy may not be called from edit mode! Use DestroyImmediate instead.` console message because `Projectile.TryReportHit` schedules runtime destruction while the probe invokes `FixedUpdate` through editor code.

## Command Checks

- `dotnet build`: failed in the repository root with `MSB1011` because the folder contains more than one project or solution file.
- `dotnet test`: failed in the repository root with the same `MSB1011` ambiguity.
- `dotnet build "Weltraum Spiel.sln"`: passed. Warnings: `MSB3277` assembly version conflicts for `System.Net.Http` and `System.IO.Compression` from Unity/MCP references.
- `dotnet test "Weltraum Spiel.sln"`: passed with exit code 0; no test project output beyond restore/no packages.
