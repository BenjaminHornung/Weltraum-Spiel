# Ship Blueprint Builder v0 Spec

## Requirements

### Requirement: Data-driven prototype blueprint model
The prototype SHALL provide serializable module definitions, module instances, and ship blueprints for generated prototype ships.

#### Scenario: Blueprint validates reusable definitions and instances
- GIVEN a blueprint with reusable part definitions and module instances
- WHEN validation runs
- THEN duplicate ids, missing definitions, missing required categories, and non-finite transforms are reported deterministically.

### Requirement: Blueprint-derived generated ship
A valid blueprint SHALL convert into the existing generated primitive ship runtime without replacing imported functional binding or generated fallback support.

#### Scenario: Sample blueprint spawns a playable generated ship
- GIVEN a valid built-in sample blueprint
- WHEN `PrototypeBootstrap` builds the generated fallback variant from that blueprint
- THEN the ship has a Rigidbody, ShipStats, ShipPhysicsCore, main thruster bank, RCS controller, gun module, mass descriptors, RCS nozzles, generated hardpoints, and a camera anchor.

### Requirement: Part-derived mass, fuel, thrust, RCS, and weapons
Generated sample ships SHALL derive behavior from module definition data.

#### Scenario: Module data changes runtime behavior
- GIVEN two valid sample blueprints with different module data
- WHEN they are converted and spawned
- THEN dry mass, fuel capacity/current fuel, center of mass, main thrust, RCS block thrust/nozzle count, and gun projectile data differ according to installed parts.

### Requirement: Deterministic sample coverage
At least two built-in sample blueprints SHALL be available for tests and debug selection.

#### Scenario: Two playable samples are exposed
- GIVEN the built-in blueprint catalog
- WHEN sample blueprints are requested
- THEN at least `Scout Blueprint` and `Hauler Blueprint` validate successfully and produce generated variants with distinct ids and display names.

### Requirement: Scope control
This slice SHALL NOT introduce final editor UI, inventory, economy, save/load, multiplayer, final art requirements, full ship-builder UX, or hardcoded imported demo hierarchy paths.
