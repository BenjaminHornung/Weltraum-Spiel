# Tasks: prototype-blender-low-poly-module-kit-v0

## Spec

- [x] Create DevToolbox change artifacts for proposal, design, three specs, and tasks.
- [x] Validate the new change with `specs_validate` before Blender implementation.

## Blender Asset Generation

- [x] Use Blender MCP tool discovery and confirm Python/bpy execution.
- [x] Generate the procedural low-poly kit scene with required collections, materials, axis reference, nine modular parts, visible connectors, and custom properties.
- [x] Save `art/blender/prototype_modular_ship_kit_v0.blend`.
- [x] Export nine part GLBs under `Assets/Art/PrototypeShipKit/Parts`.
- [x] Export two demo ship GLBs under `Assets/Art/PrototypeShipKit/DemoShips`.
- [x] Write `Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json`.

## Verification

- [x] Verify all required parts, materials, connector/hardpoint objects, demo ships, GLB exports, and manifest entries exist.
- [x] Verify the manifest is valid JSON and records coordinate/Unity axis intent.
- [x] Verify no external asset packs are required and no C# gameplay files were modified by this run.
- [x] Write `.devtoolbox/specs/changes/prototype-blender-low-poly-module-kit-v0/tests/test-protocol.md`.
- [x] Run DevToolbox task completion preflight before toggling completed task items.
