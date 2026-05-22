# Weapon Projectile Balance Physics

## ADDED Requirements

### Requirement: Data-driven weapon settings

Prototype weapon settings SHALL expose projectile speed, projectile diameter or radius, projectile mass, rounds per second, projectile lifetime, recoil enabled, hit chance, engagement range, yaw/pitch limits, turret slew rate, optional auto fire, and optional lead target support.

#### Scenario: Existing settings remain compatible

- GIVEN existing prototype config values for projectile speed, fire rate, lifetime, scale, mass, and recoil
- WHEN settings are clamped or applied
- THEN existing values still map to equivalent runtime behavior
- AND new fields receive safe defaults.

#### Scenario: Settings clamp unsafe values

- GIVEN hit chance, fire rate, diameter, mass, range, slew rate, yaw limits, or pitch limits are outside valid ranges
- WHEN settings are clamped
- THEN hit chance is clamped to 0..1
- AND fire rate, diameter, mass, lifetime, range, and slew rate have safe positive minimums
- AND yaw/pitch limits are normalized so min is not greater than max.

### Requirement: Projectile diameter affects visuals and sweep

Configured projectile diameter SHALL affect the visible projectile size and collision/sweep radius.

#### Scenario: Diameter changes projectile scale and collider

- GIVEN a projectile is initialized with a configured diameter
- WHEN the projectile is spawned
- THEN transform scale reflects that diameter
- AND the sphere collider radius reflects half that diameter.

#### Scenario: Diameter changes sweep radius

- GIVEN two projectiles have different configured diameters
- WHEN each calculates sweep radius
- THEN the larger projectile uses a larger sweep radius
- AND both respect a small minimum sweep radius.

### Requirement: Fire rate is cooldown-based

Rounds per second SHALL be implemented as a cooldown gate, not as frame-dependent burst spawning.

#### Scenario: Repeated fire in the same cooldown is blocked

- GIVEN a weapon has fired once
- WHEN fire is requested again before `1 / roundsPerSecond` has elapsed
- THEN no second projectile is spawned.

### Requirement: Deterministic hit chance

Hit chance SHALL be deterministic and testable for 0% and 100% cases.

#### Scenario: One hundred percent hit chance aims at the active target

- GIVEN hit chance is 1.0 and an active target is inside arc
- WHEN the weapon fires
- THEN the projectile direction is toward the target/muzzle aim solution
- AND the shot is recorded as an intended hit shot.

#### Scenario: Zero percent hit chance creates a deterministic miss

- GIVEN hit chance is 0.0 and an active target is inside arc
- WHEN the weapon fires
- THEN a projectile is still spawned unless a documented fire gate blocks it
- AND its aim is deterministically dispersed away from the direct target line
- AND tests can assert that the shot is not counted as an intended hit.

### Requirement: Recoil remains physical

Recoil SHALL remain an impulse through `ShipPhysicsCore` at the muzzle, opposite the muzzle forward direction.

#### Scenario: Recoil impulse magnitude and direction are derived from projectile momentum

- GIVEN projectile mass and speed are configured
- WHEN the weapon fires with recoil enabled
- THEN recoil impulse magnitude equals `projectileMass * projectileSpeed`
- AND direction is opposite muzzle forward
- AND `ShipPhysicsCore.ApplyForceAtPosition(..., ForceMode.Impulse)` is used.

#### Scenario: No direct velocity writes are introduced for recoil

- GIVEN recoil or impact behavior runs
- WHEN code applies physical effects
- THEN ship velocity is not directly assigned as a shortcut for recoil or impact response.
