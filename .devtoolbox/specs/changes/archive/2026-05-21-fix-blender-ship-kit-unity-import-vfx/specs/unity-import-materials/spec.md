# unity-import-materials Specification

## ADDED Requirements

### Requirement: Imported structural materials are opaque

Unity MUST render ship-kit structural materials as opaque by default so hull, fuel, engine, RCS, weapon, cargo, connector, and panel geometry does not disappear because of accidental alpha or blend settings.

#### Scenario: Imported part and demo materials are inspected

- **WHEN** Unity imports `Assets/Art/PrototypeShipKit/Parts/*.glb` and `Assets/Art/PrototypeShipKit/DemoShips/*.glb`
- **THEN** normal ship materials use alpha 1
- **AND** normal ship materials use opaque surface settings where the shader exposes them
- **AND** the canopy uses controlled dark-blue opaque material for this prototype
- **AND** no structural renderer depends on accidental transparency to be visible

### Requirement: Canonical material assets are reusable

The Unity project MUST contain stable reusable material assets for the ship kit.

#### Scenario: Material assets are created or updated

- **WHEN** the material normalization pass runs
- **THEN** material assets exist for `MAT_Hull_DarkGrey`, `MAT_Hull_Panel`, `MAT_Cockpit_Glass_DarkBlue`, `MAT_Fuel_Green`, `MAT_Engine_DarkMetal`, `MAT_Engine_Emission_Orange`, `MAT_RCS_Cyan`, `MAT_Weapon_YellowRed`, `MAT_Cargo_Violet`, and `MAT_Connector_Lime`
- **AND** the assets are compatible with the active Unity render pipeline as far as this project supports it
- **AND** generated or imported renderers can be remapped to these materials by material/name convention

### Requirement: Material remapping is reproducible

Material repair MUST not rely on manual Inspector-only changes.

#### Scenario: Assets are re-imported or re-exported

- **WHEN** Blender GLB/FBX assets are regenerated
- **THEN** a scriptable/editor utility or importer-safe code path can reapply the canonical materials by name
- **AND** Unity console reports no material import or shader errors

### Requirement: Double-sided rendering remains a fallback

Double-sided materials MAY be used only for explicitly thin non-structural surfaces where geometry thickening is not appropriate.

#### Scenario: Thin decorative surfaces are rendered

- **WHEN** a decorative surface would otherwise be culled from an expected preview angle
- **THEN** the implementation SHOULD prefer real thin geometry
- **AND** any double-sided material behavior MUST be limited and documented in verification evidence
