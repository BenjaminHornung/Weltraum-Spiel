# Proposal: Ship Builder Data Validation v1

## Change

`ship-builder-data-validation-v1`

## Problem

The Ship Builder now has several planning foundations: the prototype blueprint
idea separates definitions and instances, the modular parts catalog defines
functional socket and marker expectations, the gameplay UX package defines
builder flow, and the resource/cargo model defines stable resource IDs and
capacity rules.

What is still missing is a precise data and validation contract that future
implementation can follow without creating a parallel ship format. The project
needs shared definitions for part data, placed instances, sockets, functional
components, validation errors/warnings, stat formulas, serialization, and later
resource/cost integration.

## Outcome

This change creates a planning/spec-only package that defines:

- `PartDefinition`, `PartInstance`, `SocketDefinition`, and future blueprint
  serialization shape.
- Functional component data for cockpit/control core, hull/frame, main thruster,
  RCS cluster, fuel tank, cargo/storage, turret/weapon, utility/sensor, docking
  connector, armor plate, and future power/heat systems.
- Hard validation errors and warnings with deterministic rules and player-facing
  messages.
- Simple v0 stat formulas for mass, fuel, cargo, thrust, acceleration, RCS force,
  RCS torque, delta-v, burn time, turn authority, COM, thrust axis, weapon DPS,
  recoil, and power/heat placeholders.
- Future resource/cost integration using stable resource IDs instead of display
  strings.
- Later EditMode test expectations for pure data validation and formulas.

## Scope

In scope:

- `docs/spielkonzept/ship-builder-data-model.md`
- `docs/spielkonzept/ship-builder-validation-rules.md`
- `docs/spielkonzept/ship-builder-stat-formulas.md`
- This DevToolbox change package under
  `.devtoolbox/specs/changes/ship-builder-data-validation-v1/`

Out of scope:

- Runtime code, tests, scenes, assets, prefabs, ScriptableObjects, Blender files,
  FBX files, or UI implementation.
- Changes to existing ship builder runtime code.
- Autopilot or proving-ground harness files.
- Final economy, final resource balancing, damage/repair implementation, and
  final art import.

## Success criteria

- The docs define the requested data fields, socket types, functional component
  shapes, validation rules, formulas, serialization requirements, and later test
  plan.
- The formal spec requires separation of definitions and instances, stable
  instance IDs, complete functional sockets, separate errors and warnings,
  deterministic stats, art-independent validation, and resource costs by ID.
- The package validates with `specs_validate ship-builder-data-validation-v1`.
