# Capability: Physics Test Suite

## Requirements

### Requirement: Force and torque tests

The project SHALL have repeatable checks for core force and torque formulas.

#### Scenario: Main thrust straight-line stability

- GIVEN throttle-only main thrust with no gimbal
- WHEN the test runs
- THEN net forward force is positive
- AND unintended torque is within tolerance

### Requirement: RCS allocator tests

The project SHALL test that RCS allocation does not oversubscribe nozzles and can minimize undesired force/torque for known geometry.

#### Scenario: Translation command

- GIVEN a symmetric generated ship
- WHEN +X translation is requested
- THEN net force points +X
- AND net torque remains within tolerance
- AND no nozzle throttle exceeds 1

### Requirement: Fuel and momentum tests

Fuel and projectile behavior SHALL have focused regression checks once implemented.

#### Scenario: Partial fuel step

- GIVEN fuel is almost depleted
- WHEN a thrust step requests more fuel than available
- THEN applied thrust is scaled and fuel does not go negative

### Requirement: Evidence convention

Physics verification artifacts SHALL be saved under the active spec change tests folder.
