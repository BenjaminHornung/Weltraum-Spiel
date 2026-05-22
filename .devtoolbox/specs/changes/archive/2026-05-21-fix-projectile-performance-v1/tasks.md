# Tasks: Projectile Performance v1

## Spec

- [x] 1. Author proposal, design, capability specs, and initial validation for `fix-projectile-performance-v1`.

## Implementation

- [x] 2. Add projectile mode/settings/runtime request types and a central `PrototypeProjectileSimulation` with NonAlloc hitscan and lightweight simulated projectile processing.
- [x] 3. Add pooled muzzle, tracer, projectile, and impact visuals with shared materials, bounded active counts, and runtime marker/layer exclusion.
- [x] 4. Route `GunModule` and `PrototypeTurretWeapon` through the shared runtime API while preserving fire gates, hit chance/miss dispersion, and recoil diagnostics.
- [x] 5. Harden legacy `Projectile` and target discovery so live projectile/runtime visual objects never become weapon targets and legacy slow projectiles avoid All-cast/material/light hot-path behavior where practical.

## Verification And Docs

- [x] 6. Add/extend EditMode tests for hitscan, simulated projectile manager path, visual pool reuse, target discovery exclusion, recoil diagnostics, and high-fire-rate object bounds.
- [x] 7. Update README/docs and `tests/test-protocol.md` with mode guidance, performance rationale, config values, and fresh verification evidence.
