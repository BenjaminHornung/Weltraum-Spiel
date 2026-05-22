# builder-ready-part-metadata Specification

## ADDED Requirements

### Requirement: Prototype parts expose lightweight metadata

Prototype ship visual parts MUST have simple metadata that can serve as a later ship-builder foundation without implementing builder behavior.

#### Scenario: Part metadata is inspected

- **WHEN** a prototype visual part is mapped or created
- **THEN** metadata is available for `partId`, `displayName`, `category`, `visualArchetype`, `localSize`, `massRole`, connector or hardpoint marker placeholders, and gameplay role

### Requirement: Existing layout entries map to visual archetypes

Existing `PrototypeShipLayout` entries MUST map to builder-ready visual archetypes.

#### Scenario: Layout entries are enumerated

- **WHEN** the prototype ship layout is used to spawn the ship
- **THEN** each entry has a defined visual archetype mapping
- **AND** the mapping is stable enough for later builder data extraction or UI work

### Requirement: Builder metadata does not introduce builder systems

The metadata foundation MUST NOT add builder UI, snapping rules, inventory, unlocks, save/load, or economy behavior.

#### Scenario: Prototype gameplay runs after metadata is added

- **WHEN** the prototype scene starts
- **THEN** ship assembly remains the existing prototype bootstrap/layout flow
- **AND** no new inventory, unlock, save/load, economy, or final ship-builder UI is required

### Requirement: Documentation explains future-builder intent

README or project docs MUST explain that the metadata and archetype mapping are a foundation for later ship-builder work.

#### Scenario: A developer reads project documentation

- **WHEN** the prototype ship visual kit documentation is read
- **THEN** it identifies the current metadata as intentionally lightweight and non-authoritative for a final builder
