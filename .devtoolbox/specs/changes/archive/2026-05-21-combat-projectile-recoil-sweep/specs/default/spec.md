# Capability: Projectile Recoil and Sweep

## Requirements

### Requirement: Projectile velocity remains relative

Projectile spawn velocity SHALL include current ship velocity plus muzzle-forward projectile speed.

#### Scenario: Moving shooter

- GIVEN the ship is moving forward
- WHEN it fires
- THEN projectile velocity equals ship velocity plus relative muzzle velocity

### Requirement: Recoil impulse

Weapon fire SHALL optionally apply recoil impulse opposite the shot direction.

#### Scenario: Recoil enabled

- GIVEN recoil is enabled and projectile mass is configured
- WHEN the gun fires
- THEN the shooter receives opposite impulse consistent with projectile momentum

### Requirement: Sweep-based hit detection

Fast projectiles SHALL be able to detect hits between previous and current positions.

#### Scenario: Thin target

- GIVEN a projectile crosses a thin target between physics steps
- WHEN sweep detection runs
- THEN the target is reported hit once

### Requirement: Shooter self-collision protection

A projectile SHALL not immediately hit the ship that fired it.
