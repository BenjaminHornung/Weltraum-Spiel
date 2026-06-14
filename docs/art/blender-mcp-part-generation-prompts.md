# Blender MCP Part Generation Prompts

Use these prompts as direct input to the Blender MCP workflow.
All prompts are planning-only and request editable scene assets, not Unity import.

## Common generation preface

Use this preface for all prompts:

```text
Generate a single planning model for Weltraum Spiel ship parts in low-poly hard-surface style.
Use metric units. Set object naming and prefixes:
MESH_ for mesh nodes, COL_ for collider proxies, SOCKET_ for markers.
Create named empties for all required sockets. Apply transforms (location, rotation, scale) before finishing.
Use 0.5m snap alignment. Avoid non-manifold geometry where possible.
Use primary socket names such as SOCKET_THR_MAIN_AFT_01, SOCKET_RCS_POS_X_01, SOCKET_TURRET_BASE_TOP_01, SOCKET_TURRET_YAW_01, SOCKET_TURRET_PITCH_01, SOCKET_MUZZLE_01, SOCKET_MUZZLE_FLASH_01, SOCKET_CARGO_ATTACH_01, and SOCKET_CONN_FRONT_01 where applicable.
Do not export to Unity. Export-ready FBX hierarchy only.
```

## 1) Cockpit / command prompt

```text
Create 4 modular cockpit variants for v0:
Scout cockpit small, Industrial cockpit box, Long-range cockpit, Armored bridge cockpit.
For each variant include:
- mesh object prefix MESH_ and collision object prefix COL_
- required marker names from the ship builder catalog, especially Hardpoint and WeaponMuzzle where noted
- VFX helper nodes prefixed VFX_ and non-bounds helper nodes prefixed HELPER_
- simple MAT_ role materials with no high-poly details
- one consistent local module center at origin
- metadata-ready hierarchy root named after the part variant
Export-ready FBX structure only; no Unity or code integration steps.
```

## 2) Hull / frame prompt

```text
Generate 4 hull/frame variants for v0:
Small spine frame, Medium rectangular frame, Cross-frame connector, Armor wedge frame.
Constrain to hard-surface planar geometry and low poly.
Add SOCKET_Hardpoint markers for all required directions and ConnectorNormal role.
Include a visible collision proxy COL_ object that matches gameplay hull extents.
Keep geometry on 0.5 meter snaps and names using MESH_ and COL_ prefixes.
Apply transforms and provide clean marker orientation for each socket.
```

## 3) Main thruster prompt

```text
Generate 4 main thruster variants for v0:
Small chemical bell, Twin medium engine, Heavy block engine, Compact maneuver engine.
Build with low-poly geometry and clean exhaust alignment.
Place SOCKET_THR_MAIN_AFT_01 and optional SOCKET_THR_GIMBAL_AFT_01 where required.
Place SOCKET_VisualOnly and VFX helper nodes for planned flame and plume.
Ensure plume vectors use local forward orientation rules and no non-manifold surfaces.
Prepare FBX-friendly hierarchy with MESH_, COL_, SOCKET_ naming.
```

## 4) RCS blocks prompt

```text
Generate 4 RCS variants for v0:
2-way side RCS, 4-way corner RCS, 6-way cube RCS, Heavy precision RCS cluster.
Create required RCS socket markers for each directional role, such as SOCKET_RCS_POS_X_01 and SOCKET_RCS_NEG_X_01.
Use directional pairs Forward/Back, Left/Right, Up/Down.
Use HELPER_ nodes only for gizmos and debug vectors, not part of collision/mesh.
Keep each nozzle on 0.5m grid and avoid intersecting emission origins with hull collider.
```

## 5) Fuel / power prompt

```text
Generate 4 fuel/power variants for v0:
Small tank, Medium side tank, Long cylinder tank, Protected internal tank.
Use low-poly hard-surface forms and keep interior volume readable.
Add Hardpoint markers for all catalog-required mounting faces.
Add VFX and HELPER nodes for valve, vent, and planned fuel metadata markers.
Create conservative collision proxy with COL_ prefix.
```

## 6) Storage / cargo prompt

```text
Generate 4 storage variants for v0:
Small storage box, Medium cargo bay, External container rack, Heavy cargo block.
No gameplay logic must be implemented, metadata only.
Model cargo containers with clear interior/volume cues and add SOCKET_Volume_Cargo helpers.
Required Hardpoint and VisualOnly marker naming must follow the conventions.
Keep silhouette readable for future gameplay and build validation.
```

## 7) Weapons / turrets prompt

```text
Generate 4 weapon/turret variants for v0:
Small single gun turret, Dual light turret, Heavy slow turret, Fixed forward cannon mount.
Create TurretYawPivot and TurretPitchPivot markers for movable turret variants.
Add SOCKET_MUZZLE_01 and SOCKET_MUZZLE_FLASH_01 markers for each barrel with BarrelForward metadata.
For fixed forward cannon, only Hardpoint and WeaponMuzzle are required.
Add VFX nodes for muzzle flash planning only.
Maintain strict naming and marker orientation.
```

## 8) Utility prompt

```text
Generate 4 utility variants for v0:
Sensor dish/module, Docking connector, Shield/armor plate, Landing/maintenance hardpoint.
Use functional markers for sensor/connector/docking roles.
Keep VFX markers separate and named with VFX_.
Include helper markers for maintenance or alignment as HELPER_ and exclude from bounds.
Use low-poly style and export-ready hierarchy.
```

## Validation prompt

```text
Validate this Blender module for Weltraum Ship builder import.
Check:
- Coordinate convention +Z forward +Y up +X right
- Object naming: MESH_, COL_, SOCKET_ prefixes
- All required SOCKET_* markers exist for this category
- No missing required sockets and no root fallbacks to world origin
- 0.5m snapped marker positions
- Applied transforms and zeroed non-uniform scales
- VFX_ and HELPER_ excluded from mesh extents
- Collider present and non-harmful to marker visibility
- No non-manifold geometry and export-ready FBX hierarchy
```

## Optional per-part variant list (paste directly)

Use this list to validate generated output quickly:

- `SHIP_COCKPIT_SCOUT_SMALL_V0`
- `SHIP_COCKPIT_INDUSTRIAL_BOX_V0`
- `SHIP_COCKPIT_LONGRANGE_V0`
- `SHIP_COCKPIT_ARMORED_BRIDGE_V0`
- `SHIP_HULL_SMALL_SPINE_V0`
- `SHIP_HULL_MED_RECT_V0`
- `SHIP_HULL_CROSS_CONNECTOR_V0`
- `SHIP_HULL_ARMOR_WEDGE_V0`
- `SHIP_THRUSTER_SMALL_BELL_V0`
- `SHIP_THRUSTER_TWIN_MEDIUM_V0`
- `SHIP_THRUSTER_HEAVY_BLOCK_V0`
- `SHIP_THRUSTER_COMPACT_MANEUVR_V0`
- `SHIP_RCS_2WAY_SIDE_V0`
- `SHIP_RCS_4WAY_CORNER_V0`
- `SHIP_RCS_6WAY_CUBE_V0`
- `SHIP_RCS_HEAVY_CLUSTER_V0`
- `SHIP_FUEL_SMALL_TANK_V0`
- `SHIP_FUEL_SIDE_TANK_V0`
- `SHIP_FUEL_LONG_CYLINDER_V0`
- `SHIP_FUEL_PROTECTED_INTERNAL_V0`
- `SHIP_CARGO_SMALL_BOX_V0`
- `SHIP_CARGO_MED_BAY_V0`
- `SHIP_CARGO_EXTERNAL_RACK_V0`
- `SHIP_CARGO_HEAVY_BLOCK_V0`
- `SHIP_WEAPON_SMALL_GUN_TURRET_V0`
- `SHIP_WEAPON_DUAL_LIGHT_TURRET_V0`
- `SHIP_WEAPON_HEAVY_SLOW_TURRET_V0`
- `SHIP_WEAPON_FIXED_CANNON_V0`
- `SHIP_UTILITY_SENSOR_DISH_V0`
- `SHIP_UTILITY_DOCKING_CONNECTOR_V0`
- `SHIP_UTILITY_SHIELD_PLATE_V0`
- `SHIP_UTILITY_LANDING_HARDPOINT_V0`
