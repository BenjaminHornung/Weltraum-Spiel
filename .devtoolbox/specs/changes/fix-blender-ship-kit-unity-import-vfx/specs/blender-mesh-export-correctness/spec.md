# blender-mesh-export-correctness Specification

## ADDED Requirements

### Requirement: Blender meshes are valid for Unity exterior rendering

The ship kit Blender scene MUST contain renderable mesh geometry that Unity can display without missing exterior faces caused by broken normals, negative scale, loose geometry, or accidental one-sided plates.

#### Scenario: Meshes are repaired and validated

- **WHEN** `art/blender/prototype_modular_ship_kit_v0.blend` is processed
- **THEN** all relevant part and demo mesh objects have non-negative applied scale
- **AND** rotations/scales are applied where doing so does not break object layout, connector empties, or part roots
- **AND** duplicate vertices are merged by distance
- **AND** loose geometry is removed
- **AND** normals are recalculated outside for exterior geometry
- **AND** important hull, cockpit, canopy, fuel, engine, RCS, weapon, cargo, and connector surfaces have assigned materials

### Requirement: Thin visible plates are not accidentally one-sided

Visible panels, plates, canopy patches, hardpoint markers, and decorative strips MUST be visible from expected Unity viewing angles.

#### Scenario: Thin visible features are inspected from both sides

- **WHEN** a visible exterior plate is thin enough that Unity backface culling could hide it
- **THEN** the preferred repair is to convert it into thin solid geometry with thickness
- **AND** double-sided Unity material behavior is only used as a fallback for non-structural decorative surfaces
- **AND** main hull and module bodies are real geometry rather than relying on double-sided materials

### Requirement: Existing names, origins, and connectors survive repair

Mesh repair MUST preserve the existing modular kit contract for later builders.

#### Scenario: The repaired scene is checked for connector compatibility

- **WHEN** mesh cleanup and re-export complete
- **THEN** required part roots and demo ship roots still exist
- **AND** connector/nozzle empties such as `CONN_*`, `THRUST_NOZZLE_MAIN`, and `RCS_NOZZLE_*` still exist
- **AND** the manifest remains compatible with unchanged part ids and export paths unless an intentional manifest update documents the change

### Requirement: Exports are regenerated from the repaired scene

The repaired scene MUST regenerate importable ship-kit exports at the existing asset paths.

#### Scenario: Export files are refreshed

- **WHEN** Blender export is run
- **THEN** all part GLB files under `Assets/Art/PrototypeShipKit/Parts/` exist
- **AND** Scout and Cargo demo GLB files under `Assets/Art/PrototypeShipKit/DemoShips/` exist
- **AND** existing FBX mirrors are refreshed when needed for Unity model import compatibility
- **AND** export paths remain stable for downstream Unity references

### Requirement: Blender validation artifacts exist

A reproducible Blender validation script and report MUST be created.

#### Scenario: Mesh validation is executed

- **WHEN** `art/blender/validate_ship_kit_meshes.py` runs inside Blender or via Blender MCP
- **THEN** it reports object count, mesh count, material assignment count, negative scale count, loose geometry count, non-manifold count, connector empty count, and export existence
- **AND** it writes `art/blender/ship_kit_mesh_validation_report.md`
- **AND** the report calls out any remaining known prototype limitations
