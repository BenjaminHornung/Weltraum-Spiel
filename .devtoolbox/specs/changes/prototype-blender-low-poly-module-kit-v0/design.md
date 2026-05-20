# Design: prototype-blender-low-poly-module-kit-v0

## Asset Generation Strategy

The kit is generated through Blender MCP using one deterministic `bpy` script when Python execution is available. The script creates all geometry from primitive mesh data, applies flat shading, assigns procedural materials, applies transforms, sets object origins, creates connector empties and visible hardpoint markers, saves the `.blend`, exports selected parts and demo ships as GLB, and writes the JSON manifest.

This avoids external asset packs and keeps the prototype repeatable. New Unity-side files are limited to imported GLB outputs and metadata under `Assets/Art/PrototypeShipKit`.

## Coordinate System

The kit uses meters as Blender units. Local ship forward is positive Y, local up is positive Z, and local right is positive X. The manifest records:

- `localForwardAxis`: `+Y`
- `localUpAxis`: `+Z`
- `intendedUnityForward`: `+Z`
- `intendedUnityUp`: `+Y`

The first run intentionally preserves Blender-native axes and documents the intended Unity interpretation rather than changing gameplay code. An `AxisReference` collection contains visible red/green/blue arrows for right/forward/up.

## Collections

The scene is organized under `ModularShipKit` with child collections:

- `00_AxisReference`
- `01_Materials`
- `10_Parts`
- `20_DemoShips`
- `30_ConnectorsAndHardpoints`
- `90_ExportMarkers`

Materials are data-blocks rather than visible material swatches; the `01_Materials` collection is retained as a named scene section for readability.

## Part Design

Each module is a separate Blender object or root object with low-poly hard-surface geometry. Cylindrical shapes use 8 to 12 sides. Panel lines and accents are represented by simple raised or inset mesh strips using assigned materials. Connector and nozzle markers use empty objects plus small visible lime/debug markers so future builder snapping can inspect them in the `.blend`.

Every part receives custom properties for `partId`, `category`, `role`, and relevant mass/fuel/thrust estimates. Connector empties use unique names based on the required naming convention.

## Demo Ships

`DEMO_Scout_Mk1` and `DEMO_Cargo_Mk1` are assembled from duplicated kit parts so their modular composition stays visually readable. They are export-only prototype demonstrations and do not introduce Unity prefabs or gameplay components.

## Verification

Verification checks are asset-focused:

- Blender scene exists and contains all required collections, parts, materials, connector objects, and demo ships.
- Nine part GLBs and two demo ship GLBs exist.
- Manifest parses as JSON and contains axis, part, connector, and demo ship metadata.
- The generated assets do not require external files.
- Git diff confirms no C# gameplay files were modified by this run.
