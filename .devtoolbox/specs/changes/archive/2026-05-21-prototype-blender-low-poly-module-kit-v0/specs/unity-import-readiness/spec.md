# Spec: Unity Import Readiness

## Capability

The generated assets shall be ready for later manual or scripted Unity import tests without modifying gameplay code during this run.

## Requirements

### Export Files

- Each part shall export as `.glb` under `Assets/Art/PrototypeShipKit/Parts`.
- Demo ships shall export as `.glb` under `Assets/Art/PrototypeShipKit/DemoShips`.
- The export set shall include:
  - `cockpit_wedge_mk1.glb`
  - `hull_core_mk1.glb`
  - `hull_segment_mk1.glb`
  - `fuel_tank_small_mk1.glb`
  - `main_engine_bell_mk1.glb`
  - `rcs_pod_4way_mk1.glb`
  - `gun_mount_light_mk1.glb`
  - `cargo_pod_small_mk1.glb`
  - `connector_hardpoint_mk1.glb`
  - `demo_scout_mk1.glb`
  - `demo_cargo_mk1.glb`

### Coordinate Documentation

- The manifest shall document the Blender local axes and intended Unity axes.
- The `.blend` shall contain a visible axis reference for manual import inspection.
- Part dimensions shall be recorded in meters.

### Project Boundaries

- This run shall not modify `PrototypeBootstrap`, `PlayerShipController`, VFX scripts, physics scripts, or control scripts.
- This run shall not add external asset packs.
- This run shall not create final Unity prefabs or runtime ship-builder integration.

## Acceptance Scenarios

- Unity can discover GLB files and manifest under `Assets/Art/PrototypeShipKit`.
- The exported files are self-contained prototype meshes/materials.
- Git diff for this run contains only new asset, Blender, manifest, and spec/test artifacts.
