# Weapon, Turret and Projectile Intent

## Purpose

This document preserves combat behavior intent for future browser-native
contracts. Rendering, scene transforms and effects are presentation adapters,
not hit, damage or targeting truth.

## Behavior to preserve

- Target selection is explicit and refuses missing, invalid, friendly or
  otherwise ineligible targets with a visible reason.
- A weapon computer owns selected-target and fire-authority state; individual
  weapons consume that state rather than scanning for hidden fallback targets.
- Turret mounts expose traverse/elevation limits, aim error, tracking state,
  fire readiness and refusal reason. Aiming outside the permitted arc must not
  fire.
- Muzzle/weapon markers define spawn pose, but missing markers fail closed or
  use an explicitly declared weapon-local fallback; world origin is never a
  valid implicit fallback.
- Projectile launch snapshots include owner, target (if guided in a future
  slice), muzzle pose, initial velocity, projectile mass, lifetime and damage/
  impulse parameters.
- Projectile travel and collision are simulation truth. Visual meshes, trails,
  glow and pooling may interpolate snapshots but cannot author hits.
- Fast projectiles require swept collision so a fixed step cannot tunnel
  through a valid target.
- Impact separates hit detection, impulse, module damage and player feedback.
  Each outcome remains inspectable and deterministic.
- Recoil is an equal-and-opposite physical request routed through ship
  authority; stabilization must not hide the applied impulse.

## State and diagnostics

Suggested state vocabulary:

```text
NoTarget
Tracking
OutsideArc
Aligning
Ready
Cooldown
NoAmmunition
NoPower
Obstructed
Fired
Impact
Expired
Rejected
```

Diagnostics should carry target ID, weapon/turret ID, fire-request ID, aim
error, arc result, obstruction result, cooldown, muzzle source, projectile ID,
impact point/normal, hit module, impulse and applied damage.

## Failure cases

- Null or stale target descriptors fail closed.
- Missing muzzle/turret markers never spawn at root or zero.
- A target leaving the firing arc between request and execution cancels that
  shot with a reason.
- Owner colliders and explicitly ignored colliders cannot receive the launch
  hit.
- A projectile reports at most one terminal impact; collision and sweep paths
  must not double-apply damage.
- Expired or pooled visuals cannot create late impacts.
- Damage or impulse without a valid authoritative hit is rejected.

## Acceptance ideas

- Identical fire commands produce identical projectile/impact records.
- Arc boundary, cooldown, obstruction and missing-marker tests fail closed.
- A high-speed projectile hits a thin collider through swept collision.
- Owner-collider filtering prevents self-hit while still allowing valid nearby
  targets.
- One impact applies impulse/damage exactly once and presentation consumes the
  recorded event.
- Turret visuals follow authoritative aim snapshots without becoming the aim
  solution.

## Legacy evidence sources

- `Assets/Scripts/Prototype/PrototypeWeaponComputer.cs`
- `Assets/Scripts/Prototype/PrototypeTurretMount.cs`
- `Assets/Scripts/Prototype/PrototypeTurretWeapon.cs`
- `Assets/Scripts/Prototype/Projectile.cs`
- `Assets/Scripts/Prototype/PrototypeProjectileSimulation.cs`
- `Assets/Scripts/Prototype/WeaponRecoilStabilizer.cs`
