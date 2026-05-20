# Proposal: Projectile Performance v1

## Motivation

The prototype combat loop currently creates a new Unity primitive, Rigidbody, collider, Projectile component, material, trail, and point light for every shot. Fast guns and auto-firing turrets therefore turn weapon fire into object creation, component setup, physics broadphase churn, and allocation-heavy hit queries. At multiple shots per second this makes Play Mode visibly slow and risks polluting weapon target discovery with live bullet objects.

## Outcome

Weapon fire should support high prototype fire rates by separating shot simulation from projectile visuals. Fast weapons use hitscan or lightweight simulated projectile records, while visible muzzle flashes, tracers, and impacts are optional pooled effects. Recoil remains physical through `ShipPhysicsCore`, and damage/impact reporting remains traceable.

## Scope

- Add explicit projectile modes for hitscan, lightweight simulated projectiles, and a future guided placeholder.
- Extend gun settings and `ShipStats` with mode, radius/diameter, tracer cadence, lifetime, spread, hit chance, and safe defaults.
- Add a central projectile runtime that owns NonAlloc hit queries, pooled visual effects, and lightweight projectile state.
- Route `GunModule` and `PrototypeTurretWeapon` through the shared runtime instead of creating primitive projectile GameObjects for fast bullets.
- Keep recoil diagnostics and physical recoil behavior intact.
- Ensure projectile/runtime visual objects cannot become weapon targets.
- Add editor tests and performance-oriented diagnostics for high-fire-rate behavior.
- Update README/docs and store verification evidence under this change.

## Non-Goals

- Final weapon balancing.
- Full multiplayer networking implementation.
- Networked projectile GameObjects.
- Full guided missile behavior beyond a clear placeholder mode.
- Replacing all existing slow/legacy projectile tests where keeping a contained compatibility path is safer.
