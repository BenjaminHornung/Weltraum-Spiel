# Test Protocol: prototype-blender-low-poly-module-kit-v0

## Scope

This verification covers the procedural Blender low-poly modular spaceship kit generated for `prototype-blender-low-poly-module-kit-v0`.

## Generated Artifacts

- Blender scene: `art/blender/prototype_modular_ship_kit_v0.blend`
- Part exports: `Assets/Art/PrototypeShipKit/Parts/*.glb`
- Demo ship exports: `Assets/Art/PrototypeShipKit/DemoShips/*.glb`
- Unity-readable exports: `Assets/Art/PrototypeShipKit/Parts/*.fbx` and `Assets/Art/PrototypeShipKit/DemoShips/*.fbx`
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

Third follow-up RCS side-mount cleanup:

- User feedback: demo ship RCS pods still showed an extra underside mount in addition to the ship-side attachment.
- Removed demo-only RCS underside mount meshes from Scout and Cargo: 24 objects total (`Blank_MountPlate_Underside` and `Mount_Rails_ForeAft*` variants).
- Moved 8 demo RCS `CONN_MOUNT` empties to the ship-facing side of their pods.
- Recolored 8 inboard no-thruster faces to `MAT_Connector_Lime` so the only visible RCS mount face is the ship-side face.
- Blender audit result: `ok: true`.
- `DEMO_Scout_Mk1`: 4 RCS pods, 4 side-mount faces, 4 side connectors, 0 inboard nozzles, 0 underside mount geometry.
- `DEMO_Cargo_Mk1`: 4 RCS pods, 4 side-mount faces, 4 side connectors, 0 inboard nozzles, 0 underside mount geometry.
- Re-exported demo GLB and Unity-readable FBX files: `demo_scout_mk1.glb`, `demo_scout_mk1.fbx`, `demo_cargo_mk1.glb`, `demo_cargo_mk1.fbx`.

Unity visual switch follow-up:

- Unity `.glb` assets import as `DefaultAsset` in this project, so Blender also exported Unity-readable `.fbx` files for the 9 parts and 2 demo ships.
- Added new non-gameplay component `Assets/Scripts/Prototype/PrototypeShipVisualSwitcher.cs`; existing `PrototypeBootstrap`, `PlayerShipController`, `RcsThrusterController`, and VFX/controller scripts were not changed.
- Runtime switch: `F6` cycles `GeneratedPrimitives`, `ImportedDemoScout`, and `ImportedDemoCargo`.
- The switcher hides generated primitive renderers only; gameplay transforms, colliders, RCS nozzles, weapon muzzle, thruster modules, and controllers remain active.
- Unity alignment probe for FBX visual rotation `(-90, 180, 0)` confirmed cockpit ahead of engine on Unity `+Z` and top panels on Unity `+Y`.
- Runtime MCP sanity check after one cycle: `visualRoot=True`, `rcs=20`, generated hull renderer hidden.

Fourth follow-up RCS vertical nozzle and cargo tank attachment correction:

- User feedback: side RCS pods still needed visible up/down firing nozzles, while keeping the ship-facing side free of thruster geometry.
- Added visible `GEO_RCS_Nozzle_Up` and `GEO_RCS_Nozzle_Down` geometry plus `RCS_NOZZLE_UP` and `RCS_NOZZLE_DOWN` empties to all 8 demo RCS pods.
- Blender audit result: `ok: true`.
- `DEMO_Scout_Mk1`: 4 RCS pods, 4 up nozzle meshes, 4 down nozzle meshes, 4 up nozzle empties, 4 down nozzle empties, 0 inboard nozzles, 0 underside mount geometry.
- `DEMO_Cargo_Mk1`: 4 RCS pods, 4 up nozzle meshes, 4 down nozzle meshes, 4 up nozzle empties, 4 down nozzle empties, 0 inboard nozzles, 0 underside mount geometry.
- User feedback: Cargo side fuel tanks appeared to float beside the ship.
- Moved the two Cargo demo fuel tank roots to local positions `[-0.88, -0.60, -0.42]` and `[0.88, -0.60, -0.42]`.
- Added 2 hull-side fuel tank saddles, 6 visible clamp blocks, and 2 lower braces to `DEMO_Cargo_Mk1`.
- Re-exported demo GLB and Unity-readable FBX files: `demo_scout_mk1.glb`, `demo_scout_mk1.fbx`, `demo_cargo_mk1.glb`, `demo_cargo_mk1.fbx`.

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
- Part FBX files: 9.
- Demo FBX files: 2.
- Blend file exists: true.
- Unity MCP `refresh_unity` was requested after file generation.
- Unity generated `.meta` files for `Assets/Art`, `Assets/Art/PrototypeShipKit`, the Parts/DemoShips folders, the manifest, all 9 part GLBs, and both demo GLBs.
- Unity MCP console check after refresh returned 0 error/warning entries.
- Unity MCP refresh after the RCS attachment correction returned idle and console check returned 0 error/warning entries.
- Unity MCP refresh after the RCS side-mount correction returned idle and console check returned 0 error/warning entries.
- Unity MCP refresh after the Unity visual switch and final RCS underside-mount cleanup returned idle. Console check returned 0 errors; the remaining warnings were pre-existing obsolete API warnings in `PrototypeTestEnvironmentValidationTests.cs` and an MCP WebSocket warning.
- Unity MCP refresh after the RCS vertical-nozzle and Cargo fuel-tank attachment correction returned idle. Console check returned 0 errors; the remaining warnings were the same pre-existing obsolete API warnings in `PrototypeTestEnvironmentValidationTests.cs` and an MCP WebSocket warning.

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
- `demo_scout_mk1.fbx`
- `demo_cargo_mk1.fbx`

Unity verification:

- `PrototypeShipVisualSwitcherValidationTests` EditMode run passed: 2/2.
- `PrototypeShipVariantValidationTests.BaselineVariantBuildsStableRigAndRebindsDebugConsole` EditMode run passed: 1/1.
- Follow-up focused `PrototypeShipVisualSwitcherValidationTests` EditMode run passed: 2/2.
- Direct Unity FBX hierarchy audit: Scout `up=4`, `down=4`, `underside=0`; Cargo `up=4`, `down=4`, `underside=0`, `sideSaddles=2`, `clamps=6`, `lowerBraces=2`.
- `PrototypeShipVisualSwitcherValidationTests.ImportedScoutVisualKeepsGameplayRigAndCanReturnToGeneratedPrimitives` verifies imported Scout visual attachment, primitive shell hiding, no underside RCS mount geometry, 4 up RCS nozzles, 4 down RCS nozzles, 20 gameplay RCS nozzles retained, and switching back to generated primitives.
- `PrototypeShipVisualSwitcherValidationTests.ImportedCargoVisualAlignsWithUnityForwardAndUp` verifies imported Cargo alignment, no underside RCS mount geometry, 4 up RCS nozzles, 4 down RCS nozzles, fuel tank side saddles/clamps, cockpit ahead on Unity `+Z`, and top panels above the ship on Unity `+Y`.

## Scope / Safety Checks

- No external asset packs were used. Materials are procedural Blender material data blocks and no image textures are referenced.
- Initial asset generation created Blender/art/spec/manifest artifacts. The follow-up Unity integration added one new visual-switcher script, one new editor test file, README control documentation, and Unity-readable FBX assets.
- Existing gameplay/controller scripts were not edited:
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
- Demo ship FBX visuals can be switched in Unity with `F6` without replacing the gameplay prototype rig.
