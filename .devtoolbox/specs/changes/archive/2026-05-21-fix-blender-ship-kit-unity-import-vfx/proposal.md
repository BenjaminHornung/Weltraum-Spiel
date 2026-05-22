# Change: fix-blender-ship-kit-unity-import-vfx

## Problem

The Blender-generated low-poly ship kit is close enough for prototype use, but Unity import readiness is not reliable yet. Some visible surfaces appear transparent or missing after import, and imported ship-kit parts do not carry runtime-style main/RCS thruster VFX because GLB/FBX assets only provide geometry and transforms.

## Goal

Make the existing procedural Blender ship kit visibly stable in Unity and provide prototype VFX attachment for imported nozzle transforms. The result should be a reliable preview/import baseline for the current Scout and Cargo demo ships, without turning this into a final ship builder or changing flight physics.

## Scope

- Repair and validate the existing `art/blender/prototype_modular_ship_kit_v0.blend` mesh/export pipeline.
- Re-export existing Parts and DemoShips to the existing `Assets/Art/PrototypeShipKit` paths.
- Normalize imported material behavior so structural ship surfaces are opaque and the canopy is controlled dark-blue opaque for this prototype.
- Add reusable Unity ParticleSystem VFX prefabs for main and RCS thrusters.
- Add a Unity preview scene and binding utility that attaches VFX to imported `THRUST_NOZZLE_MAIN` and `RCS_NOZZLE_*` transforms.
- Document Blender and Unity verification evidence under this change.

## Non-Goals

- No final ship builder.
- No inventory, module authoring UI, save/load, or gameplay progression.
- No flight physics, RCS allocator, autopilot, or player-control rewrite.
- No external asset packs.
- No manual-only Unity material or prefab fixes that cannot be reproduced.

## Success Criteria

- Exterior hull/module faces do not disappear in Unity because of broken normals, one-sided panels, alpha materials, or bad transforms.
- Blender validation report exists and covers mesh count, materials, negative scale, loose geometry, non-manifold counts, connectors, and exports.
- Unity materials for hull, fuel, engine, RCS, weapon, cargo, and connectors are opaque and reusable.
- Main and RCS VFX prefabs exist and can be bound to imported nozzle transforms.
- `Assets/Scenes/PrototypeShipKitPreview.unity` shows parts, Scout, Cargo, and visible prototype thruster VFX.
- Unity MCP refresh, console check, script validation, and relevant tests/probes are documented in `tests/test-protocol.md`.
