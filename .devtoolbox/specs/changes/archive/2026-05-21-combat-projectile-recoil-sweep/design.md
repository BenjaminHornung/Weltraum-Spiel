# Design: Projectile Recoil and Sweep

## Momentum

Projectile firing should optionally apply recoil:

```text
projectileMomentum = projectileMass * muzzleForward * projectileSpeed
shipImpulse = -projectileMomentum
```

The impulse should route through `ShipPhysicsCore` or a clearly documented Rigidbody impulse path.

## Sweep Hits

At high projectile speed, collider-only detection may miss small targets. Track previous position and sweep to current position each physics step, using a raycast or sphere cast depending on projectile radius.

## Shooter Ignoring

The projectile should ignore the firing ship's colliders for a short grace period or via explicit collider ignore rules.

## Risks

Recoil can destabilize small ships and sweep hits can double-report impacts. Verification must include one-hit-per-projectile behavior.
