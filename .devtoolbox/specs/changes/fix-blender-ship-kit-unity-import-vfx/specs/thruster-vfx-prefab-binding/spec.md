# thruster-vfx-prefab-binding Specification

## ADDED Requirements

### Requirement: Prototype thruster VFX prefabs exist

The ship kit MUST include reusable Unity ParticleSystem prefabs for imported main and RCS nozzle transforms.

#### Scenario: VFX prefab assets are inspected

- **WHEN** the project assets are refreshed
- **THEN** `Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab` exists
- **AND** `Assets/Art/PrototypeShipKit/VFX/Prefabs/RcsThrusterVfx.prefab` exists
- **AND** an optional muzzle flash prefab may exist for `MUZZLE` transforms
- **AND** the main thruster plume is visible, orange/blue, and sized for the prototype ship kit
- **AND** the RCS plume is short, cyan/blue, and readable on small side pods

### Requirement: VFX bind to named imported nozzle transforms

The preview/import pipeline MUST attach VFX by stable nozzle names rather than manual placement.

#### Scenario: Imported demo ship hierarchy is bound

- **WHEN** the binder processes a ship kit model hierarchy
- **THEN** transforms whose names contain `THRUST_NOZZLE_MAIN` receive main thruster VFX
- **AND** transforms whose names contain `RCS_NOZZLE_` receive RCS thruster VFX
- **AND** the binder does not rename or move the nozzle/connector transforms
- **AND** the binder avoids duplicating existing child VFX on repeated runs

### Requirement: Preview scene demonstrates imported VFX

A Unity preview scene MUST prove that the imported model, material, and VFX pipeline works without gameplay controllers.

#### Scenario: Preview scene is opened

- **WHEN** `Assets/Scenes/PrototypeShipKitPreview.unity` is opened
- **THEN** the scene contains the imported Scout demo ship
- **AND** the scene contains the imported Cargo demo ship
- **AND** the scene contains representative individual parts
- **AND** visible main thruster and RCS VFX are attached to nozzle transforms
- **AND** a simple preview component can keep the effects visible or pulse them for inspection

### Requirement: VFX remains runtime-compatible

The VFX assets and binding names MUST remain compatible with later gameplay integration.

#### Scenario: Gameplay integration is implemented later

- **WHEN** future runtime code connects imported ship visuals to `EngineVfxController` or `RcsThrusterController`
- **THEN** it can locate the same nozzle names used by this preview binder
- **AND** this change has not modified flight physics, control routing, or RCS allocation behavior
