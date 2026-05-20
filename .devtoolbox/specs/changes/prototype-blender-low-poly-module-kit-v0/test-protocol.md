# Test Protocol: prototype-blender-low-poly-module-kit-v0

## Scope

This verification covers the procedural Blender low-poly modular spaceship kit generated for `prototype-blender-low-poly-module-kit-v0`.

## Generated Artifacts

- Blender scene: `art/blender/prototype_modular_ship_kit_v0.blend`
- Part exports: `Assets/Art/PrototypeShipKit/Parts/*.glb`
- Demo ship exports: `Assets/Art/PrototypeShipKit/DemoShips/*.glb`
- Manifest: `Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json`

## DevToolbox

- `workspace_prepare_for_agent` completed successfully for `E:\Unity\Weltraum Spiel\Weltraum Spiel`.
- New change folder created: `.devtoolbox/specs/changes/prototype-blender-low-poly-module-kit-v0`.
- `specs_validate` passed for `prototype-blender-low-poly-module-kit-v0`.
- Execution created: `39f9453b914b422f910b53477cdf930c`.
- `verify_run` recorded `Specs` as passed, then failed the default `Build`, `Test`, and `Lint` steps because the Unity repository root contains multiple project/solution files and the default commands do not specify `Weltraum Spiel.sln`. This is the known DevToolbox MSB1011 behavior for this project and is not evidence of an asset-generation failure.

## Blender MCP

- Blender MCP tools were available, including `execute_blender_code`, `get_scene_info`, `get_object_info`, and `get_viewport_screenshot`.
- Python/bpy probe passed: Blender reported `BLENDER_BPY_OK 5.1.2`.
- Scene generation used a single procedural `bpy` script.

## Scene Verification

Blender verification script result:

- Missing required parts: none.
- Missing required materials: none.
- Missing required collections: none.
- Connector/hardpoint empties in full scene, including demo duplicates: 91.
- Required part roots with custom properties: 9/9.
- Required parts with material-bearing geometry: 9/9.
- `DEMO_Scout_Mk1` visible descendant object count: 115.
- `DEMO_Cargo_Mk1` visible descendant object count: 133.

Follow-up RCS attachment correction:

- Source `PART_RCS_Pod_4Way_Mk1` now has an explicit blank underside mount plate and mounting note.
- `DEMO_Scout_Mk1` RCS root count: 4.
- `DEMO_Scout_Mk1` RCS hardpoint plates: 4.
- `DEMO_Scout_Mk1` blank inboard no-thruster faces: 4.
- `DEMO_Scout_Mk1` inward-facing RCS nozzle objects found: 0.
- `DEMO_Cargo_Mk1` RCS root count: 4.
- `DEMO_Cargo_Mk1` RCS hardpoint plates: 4.
- `DEMO_Cargo_Mk1` blank inboard no-thruster faces: 4.
- `DEMO_Cargo_Mk1` inward-facing RCS nozzle objects found: 0.
- Updated exports: `rcs_pod_4way_mk1.glb`, `demo_scout_mk1.glb`, and `demo_cargo_mk1.glb`.
- Manifest RCS and demo ship notes document the blank mount face and inboard nozzle removal in demo assemblies.

Second follow-up RCS side-mount correction:

- User feedback: RCS pods should be mounted on ship sides, not all on top or bottom.
- `DEMO_Scout_Mk1` and `DEMO_Cargo_Mk1` were rebuilt with four RCS pods mounted on left/right side hardpoint plates.
- `DEMO_Scout_Mk1` side-mounted RCS root count: 4.
- `DEMO_Scout_Mk1` side hardpoint plates: 4.
- `DEMO_Scout_Mk1` blank inboard no-thruster faces: 4.
- `DEMO_Scout_Mk1` inward-facing RCS nozzle objects found: 0.
- `DEMO_Scout_Mk1` RCS pods flagged as top/bottom mounted: 0.
- `DEMO_Cargo_Mk1` side-mounted RCS root count: 4.
- `DEMO_Cargo_Mk1` side hardpoint plates: 4.
- `DEMO_Cargo_Mk1` blank inboard no-thruster faces: 4.
- `DEMO_Cargo_Mk1` inward-facing RCS nozzle objects found: 0.
- `DEMO_Cargo_Mk1` RCS pods flagged as top/bottom mounted: 0.
- Updated exports: `demo_scout_mk1.glb` and `demo_cargo_mk1.glb`.
- Manifest demo notes now describe left/right side hardpoint mounting.

Required generated counts:

- Blender scene created: yes.
- Part count: 9.
- Material count: 13.
- Demo ship count: 2.
- Manifest created: yes.

## File Verification

PowerShell JSON/file verification:

- Manifest `kitId`: `prototype_low_poly_ship_kit_v0`.
- Units: `meters`.
- Local forward axis: `+Y`.
- Local up axis: `+Z`.
- Intended Unity forward: `+Z`.
- Intended Unity up: `+Y`.
- Manifest part entries: 9.
- Manifest demo ship entries: 2.
- Part GLB files: 9.
- Demo GLB files: 2.
- Blend file exists: true.
- Unity MCP `refresh_unity` was requested after file generation.
- Unity generated `.meta` files for `Assets/Art`, `Assets/Art/PrototypeShipKit`, the Parts/DemoShips folders, the manifest, all 9 part GLBs, and both demo GLBs.
- Unity MCP console check after refresh returned 0 error/warning entries.
- Unity MCP refresh after the RCS attachment correction returned idle and console check returned 0 error/warning entries.
- Unity MCP refresh after the RCS side-mount correction returned idle and console check returned 0 error/warning entries.

Expected part exports exist:

- `cockpit_wedge_mk1.glb`
- `hull_core_mk1.glb`
- `hull_segment_mk1.glb`
- `fuel_tank_small_mk1.glb`
- `main_engine_bell_mk1.glb`
- `rcs_pod_4way_mk1.glb`
- `gun_mount_light_mk1.glb`
- `cargo_pod_small_mk1.glb`
- `connector_hardpoint_mk1.glb`

Expected demo exports exist:

- `demo_scout_mk1.glb`
- `demo_cargo_mk1.glb`

## Scope / Safety Checks

- No external asset packs were used. Materials are procedural Blender material data blocks and no image textures are referenced.
- This run created new Blender/art/spec/manifest artifacts only.
- Git status before asset generation already showed unrelated dirty C# prototype/UI/controller files in the shared workspace.
- A scoped post-generation git status shows those C# files remain dirty, but they were not edited by this asset run:
  - `Assets/Scripts/Prototype/EngineVfxController.cs`
  - `Assets/Scripts/Prototype/PlayerShipController.cs`
  - `Assets/Scripts/Prototype/PrototypeBootstrap.cs`
  - `Assets/Scripts/Prototype/RcsThrusterController.cs`

## Result

Acceptance criteria passed for this prototype run:

- At least 9 modular low-poly parts exist.
- At least 2 composed demo ships exist.
- Cockpit, hull, fuel, main engine, RCS, gun, cargo, and connector roles are visually/materially distinguishable.
- Connector and hardpoint markers exist and are visible in the `.blend`.
- Part names, custom properties, connector names, GLB exports, and manifest entries are consistent enough for later Unity import experiments.
