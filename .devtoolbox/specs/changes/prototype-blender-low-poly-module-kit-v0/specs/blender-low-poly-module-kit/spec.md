# Spec: Blender Low-Poly Module Kit

## Capability

The prototype shall provide a procedural Blender-authored low-poly modular spaceship kit that can be inspected visually and exported for later Unity import experiments.

## Requirements

### Scene Structure

- The Blender scene shall be saved as `art/blender/prototype_modular_ship_kit_v0.blend`.
- The scene shall contain a top-level `ModularShipKit` collection.
- The scene shall contain child collections named `00_AxisReference`, `01_Materials`, `10_Parts`, `20_DemoShips`, `30_ConnectorsAndHardpoints`, and `90_ExportMarkers`.
- The scene shall include a visible `AxisReference` object or object group with red right, green forward, and blue up arrows.
- Blender unit scale shall represent meters.

### Materials

- The scene shall define procedural materials named `MAT_Hull_DarkGrey`, `MAT_Hull_Panel`, `MAT_Cockpit_Glass_DarkBlue`, `MAT_Fuel_Green`, `MAT_Engine_DarkMetal`, `MAT_Engine_Emission_Orange`, `MAT_RCS_Cyan`, `MAT_Weapon_YellowRed`, `MAT_Cargo_Violet`, `MAT_Connector_Lime`, `MAT_Debug_Axis_Red`, `MAT_Debug_Axis_Green`, and `MAT_Debug_Axis_Blue`.
- Materials shall be simple procedural colors/emission only, without external texture dependencies.

### Modular Parts

- The scene shall contain at least nine named modular parts:
  - `PART_Cockpit_Wedge_Mk1`
  - `PART_Hull_Core_Mk1`
  - `PART_Hull_Segment_Mk1`
  - `PART_Fuel_Tank_Small_Mk1`
  - `PART_Main_Engine_Bell_Mk1`
  - `PART_RCS_Pod_4Way_Mk1`
  - `PART_Gun_Mount_Light_Mk1`
  - `PART_Cargo_Pod_Small_Mk1`
  - `PART_Connector_Hardpoint_Mk1`
- Parts shall use low-poly hard-surface shapes with flat shading.
- Cylindrical parts shall use no more than 12 sides.
- Panel lines, bands, stripes, and role accents shall be modeled with simple mesh/material surfaces.
- Parts shall have applied transforms and sensible origins.

### Demo Ships

- The scene shall contain `DEMO_Scout_Mk1`.
- The scene shall contain `DEMO_Cargo_Mk1`.
- Demo ships shall be visibly composed from multiple modular parts.
- Demo ships shall preserve visual separation between modules.

## Acceptance Scenarios

- Opening the `.blend` shows a readable modular kit organized by collections.
- The cockpit, hull, fuel, engine, RCS, gun, cargo, and connector roles are distinguishable without runtime code.
- The axis reference makes forward/up/right interpretation visible.
