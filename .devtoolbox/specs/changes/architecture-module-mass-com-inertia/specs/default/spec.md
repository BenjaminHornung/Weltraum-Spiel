# Capability: Module Mass, COM, and Inertia

## Requirements

### Requirement: Module mass contribution

The ship SHALL calculate total mass from physical module masses rather than only fixed aggregate constants.

#### Scenario: Generated prototype modules

- GIVEN the generated cockpit, hull, fuel tank, engine, gun, and RCS modules
- WHEN mass properties are recalculated
- THEN total Rigidbody mass equals the sum of active module mass plus fuel mass when enabled

### Requirement: Module center of mass

The ship SHALL calculate local center of mass from module masses and local positions.

#### Scenario: Asymmetric heavy module

- GIVEN a heavy module is moved to one side of the ship
- WHEN mass properties are recalculated
- THEN Rigidbody center of mass shifts toward that module

### Requirement: Approximate inertia

The ship SHALL apply a simple inertia approximation so broad or long ships rotate differently from compact ships.

#### Scenario: Wider ship turns slower

- GIVEN two ships with equal mass but different width
- WHEN the same RCS torque is applied
- THEN the wider ship shows lower angular acceleration around the affected axis

### Requirement: Scope boundary

This change SHALL NOT add ship editor UI, damage detachment, fuel consumption rules, or final art assets.
