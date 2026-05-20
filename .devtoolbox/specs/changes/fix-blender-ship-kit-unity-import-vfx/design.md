# Design: fix-blender-ship-kit-unity-import-vfx

## Overview

This change repairs the current Blender-authored prototype kit rather than replacing it. Blender remains the source of truth for mesh geometry, connector empties, part naming, and GLB/FBX exports. Unity owns imported material normalization, ParticleSystem prefabs, and the preview scene that proves the imported hierarchy can carry VFX.

## Mesh and Export Strategy

The Blender pass will operate on the existing `prototype_modular_ship_kit_v0.blend` scene. It should preserve part roots, connector empties, demo ship roots, origins, and manifest-compatible names. Mesh repair will focus on transform cleanliness, material assignment, face normals, duplicate vertices, loose geometry, and one-sided visible panels.

For thin decorative panels and plates, the preferred repair is real thin geometry. Double-sided Unity material settings are only a fallback for surfaces that are intentionally thin and non-structural. The prototype canopy will be opaque dark blue, not alpha-transparent, because missing/incorrect alpha is more harmful than real glass at this stage.

Exports keep the existing paths so Unity references and manifest data remain useful:

- `Assets/Art/PrototypeShipKit/Parts/*.glb`
- `Assets/Art/PrototypeShipKit/DemoShips/*.glb`
- Existing FBX mirrors may also be regenerated because this Unity project has historically imported GLB files as `DefaultAsset` while FBX files are usable model assets.

## Unity Material Strategy

Unity-side materials are explicit project assets under `Assets/Art/PrototypeShipKit/Materials`. They use URP/Lit when available, otherwise Unity's standard compatible shader fallback. Structural materials are opaque with alpha 1. The canopy is dark blue opaque for predictable prototype rendering.

A small editor/runtime-safe utility may normalize renderer materials by source material name. This avoids relying on manual import settings and keeps future re-exports reproducible.

## VFX Binding Strategy

Imported GLB/FBX assets provide named transforms but not Unity ParticleSystems. This change therefore adds simple ParticleSystem prefabs:

- `MainThrusterVfx.prefab`
- `RcsThrusterVfx.prefab`
- optional `MuzzleFlashVfx.prefab`

A binder script finds transforms whose names contain `THRUST_NOZZLE_MAIN` or `RCS_NOZZLE_` and instantiates the appropriate prefab as a child. The binder keeps naming compatible with later gameplay integration and does not control physics or input.

The VFX should orient from the nozzle transform. Existing project convention records nozzle forward as force direction and visual exhaust opposite the nozzle forward. The binder can apply a local rotation/offset to show plume geometry behind the nozzle without renaming or moving connector transforms.

## Preview Scene

`Assets/Scenes/PrototypeShipKitPreview.unity` is a visual QA scene, not gameplay. It should contain imported part examples, the Scout demo, the Cargo demo, lights, a camera, and bound VFX. A lightweight `PrototypeShipKitVfxPreview` component may pulse all RCS and main effects so the scene proves VFX presence without flight controllers.

## Safety Boundaries

- Do not edit `PlayerShipController`, `PrototypeWaypointAutopilot`, flight physics, or RCS allocator files.
- Do not rename existing nozzles/connectors unless the manifest and binder are updated in the same change.
- Do not introduce external dependencies or asset packs.
- Preserve unrelated dirty work in the shared workspace.

## Verification Plan

Verification combines Blender validation, Unity import probes, script validation, console checks, targeted tests if present, and screenshot evidence from the preview scene. The Blender validation script writes a report so mesh health can be inspected without opening Blender manually.
