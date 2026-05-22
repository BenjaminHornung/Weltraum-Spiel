# procedural-low-poly-module-kit Specification

## ADDED Requirements

### Requirement: A reusable prototype visual factory exists

The implementation MUST introduce a prototype-only helper or factory named `PrototypeShipVisualKit` or `PrototypeShipPartVisualFactory` to construct low-poly visual module archetypes.

#### Scenario: Prototype ship visuals are created

- **WHEN** `PrototypeBootstrap` or the prototype layout assembly creates ship visuals
- **THEN** visual module construction is routed through the reusable helper or factory
- **AND** new visual code is not duplicated separately for each module role

### Requirement: Visual archetypes are available for prototype modules

The helper or factory MUST support the following archetypes: `CockpitWedge`, `HullCore`, `HullLongSegment`, `FuelTankPod`, `MainEngineBell`, `RcsPod`, `GunMount`, `CargoBox`, `UtilityBlock`, and `ConnectorHardpointMarker`.

#### Scenario: Existing layout entries are mapped to visuals

- **WHEN** existing prototype ship layout entries are instantiated
- **THEN** each entry maps to one of the required visual archetypes
- **AND** unsupported entries use an explicit utility or hull fallback rather than an unstyled white cube

### Requirement: Low-poly geometry uses role-appropriate forms

Visuals MUST use low-poly forms instead of only plain cubes.

#### Scenario: Role archetypes are inspected

- **WHEN** the generated ship hierarchy is inspected
- **THEN** cockpit visuals include a wedge or canopy-like shape
- **AND** fuel visuals resemble a cylinder, capsule, or tank pod
- **AND** main thruster visuals include a cone, cylinder, or engine bell/nozzle form
- **AND** RCS pods include small pod bodies plus visible nozzle markers
- **AND** gun visuals include a barrel and muzzle
- **AND** hull visuals are segmented or shaped rather than a single uniform cube

### Requirement: Gameplay transforms and components remain compatible

The visual kit MUST preserve gameplay-critical transform names and component contracts.

#### Scenario: Existing gameplay systems search runtime transforms

- **WHEN** main thrust, RCS, weapons, mass descriptors, and tests run after the visual update
- **THEN** `MainThrusterNozzle` still exists for main engine effects and thrust references
- **AND** `RCS_Nozzle_*` transforms still exist for RCS selection and VFX
- **AND** `Muzzle` still exists for projectile origin logic
- **AND** `ModuleMassDescriptor`, RCS, gun, main thruster, and existing tests continue to work
