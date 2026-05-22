# Test Protocol: Projectile Performance v1

## Scope

This evidence covers the high-rate projectile architecture change: hitscan and simulated projectile runtime paths, pooled visuals, target-discovery exclusion, recoil preservation, docs, and Unity verification.

## Evidence Log

- 2026-05-20: `specs_validate` for `fix-projectile-performance-v1` passed with proposal, design, tasks, and three capability specs.
- 2026-05-20: Unity MCP `validate_script` passed with 0 errors for:
  - `Assets/Scripts/Prototype/PrototypeProjectileSimulation.cs`
  - `Assets/Scripts/Prototype/PrototypeProjectileVisualPool.cs`
  - `Assets/Scripts/Prototype/GunModule.cs`
  - `Assets/Scripts/Prototype/PrototypeTurretWeapon.cs`
  - `Assets/Tests/Editor/PrototypeWeaponComputerTurretValidationTests.cs`
  - The simulation and visual pool checks reported one generic MCP GC warning each at line 0. No script validation errors were reported.
- 2026-05-20: Focused Unity EditMode tests passed: `PrototypeWeaponComputerTurretValidationTests` 18/18.
- 2026-05-20: Focused Unity EditMode tests passed after adapting the momentum probe to the hitscan runtime: `PrototypePhysicsValidationTests` 27/27.
- 2026-05-20: Full Unity EditMode suite passed: 163/163.
- 2026-05-20: `dotnet build "Weltraum Spiel.sln" --no-restore` passed. Remaining warnings are existing Unity/MCP assembly conflicts and serialized-field/obsolete-test API warnings; 0 errors.
- 2026-05-20: `dotnet test "Weltraum Spiel.sln" --no-build` exited successfully.
- 2026-05-20: Static hot-path scan confirmed the projectile runtime no longer contains `SphereCastAll`, `RaycastAll`, `GetComponentsInChildren<Collider>()`, `ContinuousDynamic`, or primitive projectile spawning in `GunModule`/`PrototypeTurretWeapon`.
- 2026-05-20: EditMode stress coverage fires a high-rate hitscan burst through `PrototypeProjectileSimulation`; it asserts 0 `Projectile` GameObjects, 0 active simulated projectiles, bounded pooled visuals, and increasing shot diagnostics.

## Runtime Notes

- Hitscan fire creates no Rigidbody projectile GameObject. Recoil remains recorded through `ShipPhysicsCore` diagnostics.
- Simulated projectiles are manager records with pooled visuals and NonAlloc sweep checks.
- Runtime projectile visuals are marked with `PrototypeProjectileRuntimeMarker` and moved to Ignore Raycast so weapon target discovery rejects them.
- Profiler counters were available through Unity MCP, but a later profiler/refresh attempt left the active Unity editor process unresponsive to MCP pings. No hard editor kill was performed, and no PlayMode profiler artifact is claimed here.
