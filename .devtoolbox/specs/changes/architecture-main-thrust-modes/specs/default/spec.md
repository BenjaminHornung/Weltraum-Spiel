# Capability: Architecture Main Thrust Modes

## Requirements

### Requirement: Explicit main-thrust mode

The prototype SHALL expose an explicit main-thrust mode instead of relying on implicit force-splitting behavior.

#### Scenario: Stable default mode

- GIVEN the generated prototype ship
- WHEN no mode is manually changed
- THEN the main thruster uses `ComSafeSteeringOnly`
- AND throttle-only forward thrust produces near-zero unintended torque

### Requirement: Fully physical mode

The main thruster SHALL support a selectable fully physical mode.

#### Scenario: Nozzle-position force

- GIVEN `FullyPhysicalNozzleForce` is selected
- WHEN the main engine applies gimballed thrust
- THEN the full force vector is applied at the nozzle transform through `ShipPhysicsCore`
- AND resulting torque follows `cross(nozzlePosition - worldCenterOfMass, force)`

### Requirement: Diagnostics

Main-thrust diagnostics SHALL make the selected mode and resulting force/torque visible.

#### Scenario: Debug overlay identifies mode

- GIVEN the debug overlay is visible
- WHEN main thrust is active
- THEN the overlay shows the active thrust mode and main-thrust net torque

### Requirement: Scope boundary

This change SHALL NOT alter fuel, heat, damage, projectile, camera, RCS allocator, or ship-editor behavior.
