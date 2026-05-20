# Test Protocol: prototype-blender-low-poly-module-kit-v0

The canonical test protocol for this run is also available at:

`../test-protocol.md`

Summary:

- `specs_validate` passed for `prototype-blender-low-poly-module-kit-v0`.
- Blender Python/bpy execution passed on Blender `5.1.2`.
- Generated scene: `art/blender/prototype_modular_ship_kit_v0.blend`.
- Part count: 9.
- Material count: 13.
- Connector/hardpoint empties in full scene, including demo duplicates: 91.
- Demo ship count: 2.
- Part GLB exports: 9.
- Demo GLB exports: 2.
- Manifest JSON parsed successfully with axes `+Y` forward, `+Z` up, intended Unity `+Z` forward, `+Y` up.
- No external asset packs were used.
- No C# gameplay files were edited by this asset run; existing dirty prototype/controller files were already present in the shared workspace.
- DevToolbox `verify_run` passed Specs and then hit the known Unity-root MSB1011 default command issue for Build/Test/Lint; asset verification evidence is recorded in the root test protocol and execution note.
- Unity MCP refresh generated `.meta` files for the new art assets, and the Unity console returned 0 error/warning entries after refresh.
- Follow-up RCS correction re-exported `rcs_pod_4way_mk1.glb`, `demo_scout_mk1.glb`, and `demo_cargo_mk1.glb`; both demo ships now have 4 RCS roots, 4 hardpoint plates, 4 blank inboard faces, and 0 inward-facing RCS nozzle objects.
- Second RCS correction moved demo RCS pods to left/right side hardpoints instead of top/bottom placement; both demo ships have 4 side-mounted RCS roots, 4 side hardpoint plates, 4 blank inboard faces, 0 inward-facing RCS nozzle objects, and 0 pods flagged as top/bottom mounted.
