# Spec: Ship Builder Data Validation

## Summary

This spec defines future Ship Builder data model, validation model, stat formula,
serialization, and resource/cost requirements. It is planning/spec-only and does
not create runtime code, tests, scenes, UI, assets, prefabs, ScriptableObjects,
Blender files, FBX files, or runtime systems.

## Scope

In scope:

- Part definition, part instance, socket, functional component, validation,
  formula, serialization, and future resource/cost requirements.
- Requirements that make future validation deterministic and testable without
  final art.

Out of scope:

- Runtime implementation.
- Unity tests, dotnet builds, scenes, assets, prefabs, `.unity`, `.prefab`,
  `.asset`, `.blend`, or `.fbx` files.
- Autopilot/harness changes.
- Existing ship builder runtime code changes.

## Requirements

### R1: Definitions and instances

The builder shall separate reusable part definitions from placed part instances.
Definitions shall contain catalog metadata and static gameplay capability.
Instances shall contain player placement, stable instance identity, and future
per-instance state.

### R2: Stable instance IDs

Every part instance shall have a stable ID. The stable ID shall not change when
the instance moves, rotates, mirrors, is selected, or is serialized and loaded
again. Duplicates shall receive new stable IDs.

### R3: PartDefinition fields

Part definitions shall support fields for:

- id
- display name
- category
- description
- dimensions
- grid footprint
- dry mass
- loaded mass where applicable
- later hitpoints or armor tier
- later cost/resource requirements
- allowed mount sides
- tags
- later visual asset reference
- later collider proxy reference
- sockets
- functional components
- stat contributions
- validation metadata

Future cost/resource requirements shall reference stable resource IDs, not
display strings.

### R4: PartInstance fields

Part instances shall support fields for:

- stable instance ID
- part definition ID
- local grid position
- local rotation
- mirror group ID
- parent or attached socket when socket-based assembly is active
- custom name
- enabled/disabled state
- later cargo fill state
- later damage state
- future color/material override

### R5: SocketDefinition fields

Every functional socket shall have local position, local orientation, type, and
compatibility metadata. Socket definitions shall support fields for:

- socket ID
- local position
- local rotation
- socket type
- compatible part categories
- direction vector
- capacity or size
- occupied state
- allowed arcs when turret or docking behavior needs them
- VFX role when the socket is an effect marker
- camera-bounds ignore marker for helper/VFX sockets

No functional socket shall silently fall back to root position, world origin, or a
zero direction vector.

### R6: Socket types

The builder shall define socket types for:

- structural
- hardpoint
- main thruster nozzle
- RCS nozzle
- turret base
- turret yaw pivot
- turret pitch pivot
- muzzle
- muzzle flash
- cargo attach
- docking connector
- camera anchor
- landing gear future
- drone bay future

### R7: Functional components

The builder shall define data shapes for:

- cockpit/control core
- hull/frame
- main thruster
- RCS cluster
- fuel tank
- cargo/storage
- turret/weapon
- utility/sensor
- docking connector
- armor plate
- power/heat future

Functional behavior shall be derived from these component data shapes rather than
category guesses alone.

### R8: Hard validation errors

Validation shall produce hard errors for:

- no cockpit/control core
- no structural connection between required modules
- hard overlap
- no main thrust for a flight-ready variant
- no fuel/power if required
- invalid socket occupancy
- turret missing muzzle
- RCS nozzle without direction
- non-finite stats
- negative mass or capacity

Hard errors shall block test flight and active-ship selection.

### R9: Validation warnings

Validation shall produce warnings for:

- no RCS on one axis
- thrust vector offset from center of mass
- weak braking authority
- low fuel or delta-v
- turret arc blocked
- exposed cargo or fuel
- high mass with low acceleration
- no docking connector
- no camera anchor
- asymmetry or mirror mismatch

Warnings shall be reported separately from errors and shall not block draft save.

### R10: Deterministic stats

Stats shall be deterministic and testable from part definitions, part instances,
sockets, and metadata. Visual assets shall not be required for pure data
validation or stat computation.

The builder shall define simple v0 formulas for:

- dry mass
- fuel mass
- cargo capacity mass and volume
- total empty and loaded mass
- main thrust
- acceleration as thrust divided by mass
- RCS acceleration by axis
- RCS torque estimate by lever arm
- delta-v estimate
- burn time
- turn authority estimate
- center of mass
- thrust axis
- center-of-mass/thrust-axis offset
- rough weapon DPS
- recoil estimate
- heat/power placeholders

### R11: Serialization

The builder shall plan a JSON-like shape containing:

- blueprint ID
- display name
- version
- referenced part definition IDs
- part instances
- optional validation result cache
- optional stats cache
- future created/modified timestamps
- future active ship variant flag

Validation and stats caches shall be optional and must not replace deterministic
recalculation from source data.

### R12: Resource and cost integration

Future resource costs shall reference resource IDs, not display strings. Resource
IDs shall remain stable across UI localization and balancing changes. Economy or
construction-mode validation may block construction for missing resources in a
future slice, but pure data validation and debug test flight shall not require a
final economy implementation.

### R13: Art-independent validation

Visual assets shall not be required for pure data validation. Metadata fixtures,
primitive visuals, or existing blueprint definitions shall be enough to validate
required systems, socket completeness, formulas, and serialization. Final Blender
art may feed socket and collider data later, but shall not be mandatory for the
data validator.

## Acceptance scenarios

### Scenario: valid minimal ship

Given a blueprint has one control core, connected hull, one usable main thruster,
compatible fuel/power, and usable RCS, when validation runs, then it reports no
hard flight-readiness errors and produces deterministic stats.

### Scenario: missing control core

Given a blueprint has thrusters, fuel, and RCS but no enabled control core, when
validation runs, then it reports a hard `MissingControlCore` error.

### Scenario: invalid RCS direction

Given an RCS cluster has a nozzle without a finite direction vector, when
validation runs, then it reports a hard RCS direction error and does not use a
root or zero-vector fallback.

### Scenario: warning separate from error

Given a ship is structurally valid but its thrust axis is offset from center of
mass, when validation runs, then it reports a warning while keeping hard errors
empty.

### Scenario: serialization roundtrip

Given a blueprint is serialized and loaded again, when instance IDs are compared,
then every existing instance keeps the same stable ID.

### Scenario: resource costs use IDs

Given a future part cost references resources, when the cost is serialized, then
it uses resource IDs such as `material_structural_plate` rather than localized
display strings.
