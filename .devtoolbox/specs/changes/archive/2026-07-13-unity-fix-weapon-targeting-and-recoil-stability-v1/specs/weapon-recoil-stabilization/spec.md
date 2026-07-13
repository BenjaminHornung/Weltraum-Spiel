# Capability: Weapon Recoil Stabilization

## ADDED Requirements

### Requirement: Recoil remains physical

Weapon fire SHALL continue to apply recoil as an impulse at the muzzle or shot point through `ShipPhysicsCore`.

#### Scenario: Off-center shot produces angular impulse

- GIVEN a weapon fires from a point offset from center of mass
- WHEN recoil is applied
- THEN diagnostics expose the recoil impulse
- AND the estimated angular impulse equals `cross(muzzlePosition - COM, recoilImpulse)`.

### Requirement: Weapon stabilization uses flight assist

Weapon recoil stabilization SHALL create a short-lived counter-torque request through the existing RCS/SAS flight-control path.

#### Scenario: Weapon stabilization emits counter torque

- GIVEN SAS and RCS are effective
- WHEN an off-center shot records recoil angular impulse
- THEN `WeaponStabilization` emits a physical flight-assist torque request opposing that angular impulse.

#### Scenario: Request is actuator-limited

- GIVEN RCS nozzles, fuel, or authority cannot satisfy the requested torque
- WHEN the allocator runs
- THEN diagnostics expose actual RCS torque and residual RCS torque
- AND the ship is not made perfectly stable by direct velocity manipulation.

### Requirement: Manual input has priority

Manual attitude input SHALL keep priority over weapon stabilization.

#### Scenario: Manual axis masks stabilization authority

- GIVEN weapon stabilization requests torque on an axis
- AND the pilot is commanding manual attitude on that axis
- WHEN RCS allocation combines requests
- THEN manual torque receives priority
- AND weapon stabilization is limited to remaining authority.

### Requirement: No hidden damping

Weapon recoil stabilization SHALL NOT set Rigidbody angular velocity directly or add invisible angular damping.

#### Scenario: Stabilizer source does not manipulate angular velocity

- GIVEN the recoil stabilizer source is inspected
- WHEN searching for direct angular-velocity assignment
- THEN no such assignment exists in the stabilizer implementation.
