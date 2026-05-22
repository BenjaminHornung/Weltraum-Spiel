# Design: Projectile Performance v1

## Current Problem

`GunModule` and `PrototypeTurretWeapon` currently create a primitive sphere per accepted shot, then add/configure a Rigidbody, collider, `Projectile`, trail renderer, fresh materials, and point light. Each bullet also receives an owner collider array by scanning child colliders. `Projectile.FixedUpdate` then sweeps with `Physics.SphereCastAll` and falls back to `Physics.RaycastAll`. This design is useful for early visibility, but it is not suitable for high fire rates because every shot pays object construction, component registration, renderer/material/light setup, physics broadphase updates, collision mode cost, and allocation-heavy all-hit queries. Live Rigidbody projectile objects can also appear in broad target discovery unless every discovery path filters them correctly.

## Mode Split

Fast direct-fire weapons use `WeaponProjectileMode.Hitscan` by default. This includes nose guns, turret guns, machine-gun style prototype weapons, and any auto-fire weapon where the gameplay intent is an immediate line/sphere hit with optional tracer presentation.

Slow physical ordnance may use `WeaponProjectileMode.SimulatedProjectile`. This includes visible plasma bolts, rockets without guidance, slow cannon shells, and tutorial/debug shots where travel time matters. These are simulated as lightweight records in a central manager, not per-shot Rigidbody GameObjects.

`WeaponProjectileMode.GuidedProjectile` is reserved as a placeholder for later missile/torpedo work. v1 may route it through the simulated projectile path or deny it explicitly, but it must not create a network/object-per-bullet architecture by accident.

## Chosen Architecture

Add a shared runtime API centered on `PrototypeProjectileSimulation`:

- Weapons build a `PrototypeProjectileFireRequest` containing owner, muzzle, origin, direction, inherited velocity, settings, recoil-relevant momentum, hit mask, and optional target intent.
- Hitscan requests execute a single `Physics.SphereCastNonAlloc` or `Physics.RaycastNonAlloc`, choose the nearest non-owner/non-projectile hit, process damage/impact once, and return diagnostics.
- Simulated projectile requests append a small struct record with previous/current position, velocity, radius, mass, lifetime, owner root, and visual handle. FixedUpdate advances records and sweeps previous-to-current using NonAlloc casts.
- Visuals are owned by a `PrototypeProjectileVisualPool` child of the simulation manager. Muzzle flashes, tracers, and impacts are pooled GameObjects with shared materials and no default point lights.
- `Projectile` remains available as a legacy/slow component for compatibility tests and explicitly avoids becoming the default fast-bullet path.

## Separation Of Concerns

Simulation decides when a hit occurs and supplies `ProjectileHitData` / impact data. Visualization only shows pooled muzzle, tracer, simulated projectile, and impact hints. Damage and impact impulses remain centralized around the existing `PrototypeImpactEventData`, `PrototypeModuleDamageState`, `PrototypeTargetDummy`, and `ShipPhysicsCore` behavior. Recoil remains in the weapon modules because it is a ship-control side effect of firing, not a projectile simulation side effect.

## Recoil

`GunModule` and `PrototypeTurretWeapon` keep `LastProjectileVelocityWorld`, `LastRecoilImpulseWorld`, `LastRecoilPositionWorld`, and `LastRecoilApplied`. They calculate projectile momentum from configured mass/speed and call `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)` at the muzzle for accepted shots. The projectile mode only changes hit simulation and visuals; it does not introduce direct Rigidbody velocity resets or hidden recoil shortcuts.

## Hit Chance And Spread

Hit chance remains a prototype balancing control. When target-intent is available, hit chance decides whether the shot uses the direct aim direction or deterministic miss dispersion. Spread is a separate angular cone applied by settings and may be zero. Both are resolved before the request reaches the simulation manager, so the manager can stay deterministic and weapon-agnostic.

## Target Discovery And Layers

Runtime projectile visuals and legacy projectiles are clearly marked with `PrototypeProjectileRuntimeMarker` and assigned to the built-in `Ignore Raycast` layer when possible. Weapon target discovery rejects anything with that marker or the legacy `Projectile` component before resolving Rigidbody roots. The hot path never calls `FindObjectsByType` and never scans owner colliders per shot; owner colliders are cached by the runtime per owner root.

## Multiplayer Direction

Later multiplayer should replicate compact `FireEvent` and validated `HitEvent` records: shooter id, weapon id, muzzle transform sample, seed/spread data, projectile mode, and resulting hit. It should not spawn or synchronize one network object per bullet. Simulated projectiles can be deterministically advanced from FireEvents and reconciled by HitEvents when authority confirms a hit.

## Reuse

Existing `PrototypeGunSettings`, `ShipStats`, `GunModule`, `PrototypeTurretWeapon`, `PrototypeImpactEventData`, `PrototypeModuleDamageState`, `PrototypeTargetDummy`, and `ShipPhysicsCore` are reused. New code is required for the central runtime and visual pool because no existing component provides pooled, NonAlloc, high-fire-rate projectile simulation.

## Risks

- Editor tests that count `Projectile` GameObjects must be updated to count runtime diagnostics instead of assuming a spawned component.
- NonAlloc hit buffers can truncate many simultaneous overlaps; the manager chooses nearest from the returned subset and exposes buffer capacity for tests.
- EditMode tests need explicit simulation ticking because Unity's FixedUpdate loop is not running normally.
- Visual pooling still creates objects when a pool grows, so defaults prewarm a modest pool and expose max-active diagnostics instead of claiming zero instantiation forever.
