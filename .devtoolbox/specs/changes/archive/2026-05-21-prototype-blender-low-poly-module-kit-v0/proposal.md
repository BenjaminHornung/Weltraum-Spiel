# Proposal: prototype-blender-low-poly-module-kit-v0

## Motivation

The prototype currently relies on generated Unity primitives for ship readability. A later modular ship builder needs first visual module assets with stable names, consistent axes, visible hardpoints, and import-ready metadata before gameplay code or builder architecture is introduced.

## Outcome

Create a first procedural low-poly modular spaceship kit in Blender. The kit shall contain distinguishable cockpit, hull, fuel, engine, RCS, weapon, cargo, and connector modules, two assembled demo ships, GLB exports, and a JSON manifest that records dimensions, categories, roles, axes, connectors, and prototype-only notes.

## Scope

- Procedural Blender scene generation only.
- New art/export/manifest files under `art/blender` and `Assets/Art/PrototypeShipKit`.
- New DevToolbox spec and verification artifacts for this asset run.
- No gameplay-code changes, no C# physics/controller edits, and no external asset packs.

## Non-Goals

- No final ship builder.
- No runtime prefab integration.
- No gameplay balance tuning.
- No final art direction, textures, animations, damage states, or production-ready modular authoring workflow.
