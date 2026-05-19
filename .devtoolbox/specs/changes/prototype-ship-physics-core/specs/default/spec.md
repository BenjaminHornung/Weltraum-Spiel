# Capability: Prototype Ship Physics Core

## Requirements

### Requirement: Central ship force application

The prototype ship SHALL have a `ShipPhysicsCore` component that owns normal ship-level force application for migrated systems.

#### Scenario: Bootstrap creates the core

- GIVEN the prototype scene starts from `PrototypeBootstrap`
- WHEN the prototype ship is generated
- THEN the ship has a configured `ShipPhysicsCore`
- AND the core references the same Rigidbody used by flight systems

### Requirement: Shared wrench diagnostics

The physics core SHALL expose per-step net applied force and net applied torque diagnostics.

#### Scenario: Force at position records torque

- GIVEN a force is applied at a world position away from center of mass
- WHEN the core records the application
- THEN diagnostic torque equals `cross(position - worldCenterOfMass, force)` within floating point tolerance

### Requirement: Main thrust routes through the core

The main thruster SHALL route normal ship force application through `ShipPhysicsCore` after this change.

#### Scenario: Throttle-only main thrust stays straight

- GIVEN no gimbal or turn input is active
- WHEN main throttle applies forward thrust
- THEN the applied force is routed through the core
- AND unintended torque remains near zero

### Requirement: RCS allocator routes through the core

The RCS allocator SHALL keep per-nozzle allocation ownership but SHALL use `ShipPhysicsCore` for the final physical force application.

#### Scenario: Allocated nozzles apply once through the core

- GIVEN a combined translation and attitude command
- WHEN the allocator computes selected nozzles
- THEN each selected nozzle still has one throttle in `[0, 1]`
- AND each final force application is routed through `ShipPhysicsCore`

### Requirement: Prototype behavior remains stable

The migration SHALL preserve current working prototype behavior.

#### Scenario: Existing acceptance probes remain valid

- GIVEN the existing prototype ship
- WHEN deterministic probes run after migration
- THEN RCS translation parity remains within current tolerance
- AND pure translation has near-zero unintended torque
- AND pure pitch/yaw/roll have near-zero linear drift and nonzero torque
- AND gun, camera, controls, and bootstrap still work

### Requirement: Scope boundary

This change SHALL NOT introduce module COM/inertia, fuel mass flow, projectile recoil, gravity, docking, damage, heat, power, trajectory prediction, external optimizer packages, or a final ship-editor architecture.
