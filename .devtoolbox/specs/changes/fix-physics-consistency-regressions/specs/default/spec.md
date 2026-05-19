# Capability: Physics Consistency Regressions

## Requirements

### Requirement: Projectile mass consistency

Projectile firing SHALL use one configured projectile mass consistently for recoil, projectile Rigidbody mass, impact impulse, and impact damage estimation.

#### Scenario: Gun fires configured projectile mass

- GIVEN a gun has a configured projectile mass and projectile speed
- WHEN the gun fires a projectile
- THEN the projectile Rigidbody mass equals the configured mass
- AND the Projectile impact mass equals the configured mass
- AND the recoil impulse equals `-muzzleForward * projectileMass * projectileSpeed`

### Requirement: Force and impulse diagnostics are separate

The physics core SHALL keep continuous force/torque diagnostics separate from impulse/angular-impulse diagnostics.

#### Scenario: Recoil impulse is applied

- GIVEN a recoil impulse is applied through ShipPhysicsCore
- WHEN physics diagnostics are read for the same fixed step
- THEN NetAppliedImpulse records the recoil impulse
- AND NetAppliedAngularImpulse records the impulse torque
- AND NetAppliedForce and NetAppliedTorque are not inflated by that impulse

### Requirement: RCS allocator diagnostics reflect actual output

RCS diagnostics SHALL distinguish desired requests from actual nozzle output and residual error.

#### Scenario: RCS request is allocated

- GIVEN an RCS translation or attitude request is active
- WHEN the allocator applies nozzle forces
- THEN diagnostics expose desired force and torque
- AND diagnostics expose actual applied force and torque
- AND diagnostics expose residual force and torque after allocation
- AND diagnostics expose the maximum actual nozzle throttle

### Requirement: RCS allocator cost is scale-aware

The RCS allocator SHALL combine force and torque residuals using normalized scales rather than raw unit magnitudes.

#### Scenario: Force and torque request

- GIVEN a combined force and torque request
- WHEN the greedy allocator ranks nozzle candidates
- THEN force residuals are compared against a force scale
- AND torque residuals are compared against a torque scale

### Requirement: RCS spool response is effective

RCS nozzle spool-up and spool-down settings SHALL affect actual nozzle throttle over time.

#### Scenario: Slow spool-up

- GIVEN a nozzle has a target throttle above zero and a limited spool-up rate
- WHEN one fixed step is applied
- THEN actual nozzle throttle moves toward the target without exceeding the configured rate

### Requirement: Null ship config applies defaults

Applying a null PrototypeShipConfig SHALL restore default settings rather than retaining stale values from a previous config.

#### Scenario: Reused prototype ship

- GIVEN a prototype ship was previously built with a non-default config
- WHEN the bootstrap rebuilds it with no config assigned
- THEN configurable stats, main thruster, RCS, RCS blocks, and gun values match their default settings

### Requirement: Manual attitude priority

Manual pitch, yaw, and roll inputs SHALL keep priority over SAS and assist torque requests.

#### Scenario: Manual yaw with SAS pitch request

- GIVEN manual yaw input is at full authority
- AND SAS requests pitch or roll torque
- WHEN the desired attitude torque is built
- THEN manual yaw is not reduced by a global clamp of the combined request
- AND SAS/assist torque uses only remaining authority