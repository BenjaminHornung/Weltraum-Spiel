# Weapon Hit Simulation

## ADDED Requirements

### Requirement: Hit simulation is separated from weapon recoil

Projectile hit simulation SHALL be independent from recoil application.

#### Scenario: Hitscan recoil remains physical

- GIVEN a weapon fires in hitscan mode with recoil enabled
- WHEN the runtime resolves hit simulation without creating a projectile GameObject
- THEN the weapon still records and applies recoil through `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)`.

#### Scenario: Simulated projectile recoil is applied on fire

- GIVEN a weapon fires in simulated projectile mode
- WHEN the projectile record is queued
- THEN recoil is applied at fire time
- AND later hit processing does not apply an extra firing recoil.

### Requirement: Hits apply existing damage and impact behavior

Hitscan and simulated projectile hits SHALL reuse existing target feedback, module damage, and impact impulse behavior.

#### Scenario: Target dummy receives hit feedback

- GIVEN a projectile runtime hit collider belongs to a `PrototypeTargetDummy`
- WHEN the hit is reported
- THEN dummy hit feedback is triggered at the hit point.

#### Scenario: Module damage and impact impulse are traceable

- GIVEN a hit collider belongs to a damageable ship module
- WHEN the hit is processed
- THEN damage derives from projectile impact impulse
- AND `ShipPhysicsCore.ApplyImpactImpulse` remains the target physics entrypoint when enabled.

### Requirement: Fire result diagnostics are explicit

The shared runtime SHALL return diagnostics for fired mode, projectile velocity, hit status, hit point, active simulated projectile count, and visual emission.

#### Scenario: Existing weapon diagnostics remain usable

- GIVEN external diagnostics read `LastProjectileVelocityWorld`, `LastRecoilImpulseWorld`, `LastRecoilPositionWorld`, and `LastRecoilApplied`
- WHEN a gun or turret fires through the shared runtime
- THEN those properties continue to describe the last accepted shot.

### Requirement: Multiplayer path uses events, not bullet objects

The v1 design SHALL document future network replication as FireEvent and HitEvent data.

#### Scenario: Multiplayer guidance is documented

- GIVEN a developer reads the design or README
- WHEN they look for future multiplayer integration guidance
- THEN it states that bullets should be represented by compact fire/hit events rather than one network object per bullet.
