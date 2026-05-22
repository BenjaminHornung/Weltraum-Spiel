# combat-projectile-recoil-sweep

## Why

Projectile velocity is already relative to ship velocity, but weapons still lack recoil and robust high-speed hit detection. For combat to feel physical, firing should exchange momentum and fast projectiles should not tunnel through targets.

## What

Add a projectile physics slice for recoil, shooter self-collision protection, and sweep-based hit detection for high-speed shots.

## Out of Scope

- No full damage model.
- No weapon inventory or gun selection UI.
- No missiles, lasers, or guidance.
- No final combat balance.

## Success Criteria

- Projectile initial velocity remains `shipVelocity + muzzleForward * projectileSpeed`.
- Firing can apply recoil impulse to the shooter.
- Projectile checks travel from previous to current position with ray/sphere sweep.
- Projectile does not immediately collide with the firing ship.
- Hit output can feed later damage systems.
