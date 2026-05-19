# Draft Spec: prototype-weapon-archetypes-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/prototype-weapon-archetypes-v0/` before implementation.

## Purpose

Create the first comparable weapon archetypes so the ship builder can later make meaningful weapon choices. The goal is not balance, but feel: ballistic projectiles, railguns, lasers, and early missiles should be visibly and mechanically different.

## In Scope

- Weapon archetype definitions for prototype testing.
- Ballistic gun: visible non-instant projectile around 1000-2000 m/s.
- Railgun: much faster projectile or sweep, high impact, longer cooldown, strong trail/flash.
- Laser: beam/raycast or very fast visible beam with short duration.
- Missile: optional simple unguided or lightly guided test projectile, slower than gun, visible exhaust.
- Shared damage interface against target dummies.
- Debug selection between weapon archetypes.
- VFX placeholders using URP-compatible primitives, lights, trails, or particles.

## Out of Scope

- No final weapon inventory.
- No ammo economy.
- No heat system unless only as a displayed placeholder.
- No lock-on UI unless needed for the simplest missile test.
- No multiplayer lag compensation.
- No final balance.

## Suggested Initial Values

- Gun projectile speed: 1500 m/s.
- Railgun projectile/sweep equivalent: 5000-10000 m/s.
- Laser: immediate raycast/beam for prototype, but still visually rendered as a short beam duration.
- Missile: 100-300 m/s initial speed with simple acceleration, if included.

## Acceptance Criteria

- Player can switch between at least gun, railgun, and laser.
- Each weapon has distinct visual feedback.
- Each weapon can damage target dummy health from `prototype-combat-health-explosions`.
- Projectile/beam velocity semantics are documented.
- Gun remains non-instant.
- Railgun feels faster/stronger than gun.
- Laser feels beam-like and not like a normal projectile.
- Weapon code remains prototype-focused and does not require inventory/economy.

## Risks

- Missile guidance can become complex; keep it optional or extremely simple in v0.
- Very fast physical projectiles may need sweep/raycast logic rather than relying on collisions.
