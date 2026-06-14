# Spec: Ship Builder Modular Parts v0 Art Pipeline

## Summary

This spec defines planning requirements for the modular ship-builder part catalog and art pipeline.
It is documentation and planning only. No assets, scenes, tests, or code are created in this change.

## Scope

- Create and standardize:
  - v0 catalog and metadata fields
  - marker and socket naming conventions
  - Blender MCP generation prompts
  - import/binder readiness requirements
- Do not create or modify Unity runtime code, tests, prefabs, materials, scenes, or assets.

## Requirements

### R1: Catalog completeness
For each category below there must be 3-4 planned entries in docs with:
- purpose
- approximate dimensions
- mass tier
- gameplay stats plan
- sockets/markers required
- VFX needs
- collider plan
- snap points
- mount sides
- silhouette notes
- generation and binder notes

Categories:
- Cockpit/command
- Hull/frame
- Main thrusters
- RCS blocks
- Fuel/power
- Storage/cargo
- Weapons/turrets
- Utility

### R2: Naming and orientation conventions
All authored parts must follow:
- `+Z` forward, `+Y` up, `+X` right.
- snap grid `0.5m`.
- object prefixes `MESH_`, `COL_`, `SOCKET_`.
- primary Blender marker naming format `SOCKET_<FUNCTION>_<SIDE_OR_AXIS>_<NN>`.
- compatibility alias format `SOCKET_<Type>_<Direction>_<Role>` where existing binders need it.

### R3: Socket naming and orientation
The following functional socket types are valid:
`Hardpoint`, `MainThrusterNozzle`, `MainThrusterGimbalPivot`, `RcsNozzle`, `WeaponMuzzle`, `TurretYawPivot`, `TurretPitchPivot`, `VisualOnly`.
Directions must use `Forward`, `Back`, `Left`, `Right`, `Up`, `Down`, `Main`, `Muzzle`, `Unknown`.
Roles must use `ForceDirection`, `PlumeDirection`, `BarrelForward`, `ConnectorNormal`.
Primary marker examples include `SOCKET_THR_MAIN_AFT_01`, `SOCKET_RCS_POS_X_01`,
`SOCKET_RCS_NEG_X_01`, `SOCKET_TURRET_BASE_TOP_01`, `SOCKET_TURRET_YAW_01`,
`SOCKET_TURRET_PITCH_01`, `SOCKET_MUZZLE_01`, `SOCKET_MUZZLE_FLASH_01`,
`SOCKET_CARGO_ATTACH_01`, `SOCKET_CONN_FRONT_01`, and `SOCKET_CAMERA_ANCHOR_01`.
Import compatibility names may be emitted as alias metadata where needed.

### R4: Import contract
Missing required markers must fail explicitly.
No root fallback, no zero-vector fallback, no implicit default mapping to undefined sockets.
`VFX_` and `HELPER_` objects are excluded from bounds and gameplay logic.

### R5: Blender MCP prompt requirements
Blender MCP prompts must:
- be category scoped
- request low-poly style
- request named `MESH_`, `COL_`, and `SOCKET_` objects
- request exact socket placement and marker orientation
- request applied transforms and metric scale
- include non-manifold safety and export-ready hierarchy
- include validation prompt check.

### R6: Import/binder readiness checks
Each planned part must pass checks for:
- complete required marker set
- valid orientation for nozzles and pivots
- `SOCKET_` hierarchy presence and naming correctness
- existence of collider proxy
- no unknown file path dependencies in docs or prompts
- documented metadata compatibility aliases

### R7: Turret and arc rules
- `TurretYawPivot` and `TurretPitchPivot` are required for moving turrets.
- Underside blocked shooting arcs must be documented in metadata.
- Fixed turrets must only require structural and muzzle markers as defined in catalog.
- No hardcoded runtime direction fallback for blocked turrets.

### R8: Thruster and exhaust rules
- `MainThrusterNozzle` marker is required for thruster parts.
- Exhaust VFX origin must come from marker transform and direction, not object center.
- `MainThrusterGimbalPivot` defines aim/steering reference.
- RCS and main thrusters must use explicit `ForceDirection` or `PlumeDirection`.

### R9: RCS direction semantics
- Forces must be directionally explicit and pairs should be documented.
- Missing vector pair definitions must be treated as non-import until fixed.
- No defaults to `Unknown` unless explicitly documented as planned metadata-only variant.

### R10: Cargo volumes and utility
- Cargo and utility modules carry planned metadata fields only in this change.
- Cargo volumes are not implemented in gameplay in this slice.
- Cargo attach and docking connectors are documented for future runtime integration.

### R11: Collider and silhouette requirements
- Collider should follow planned low-poly proxy approach.
- Collider type must be documented in the catalog entry.
- Silhouette notes must include occlusion and profile intent.
- Collider proxies must not include `VFX_` or `HELPER_` objects.

### R12: No implementation assets in this change
- This change does not create `.blend`, `.fbx`, `.prefab`, `.unity`, `.asset`, runtime code, tests, or scenes.
- This change only creates and edits requested markdown/spec paths.

## Acceptance and testability

The change is considered accepted when all listed planning files exist and contain explicit entries matching the requirements above, and when no default scaffold `specs/default/spec.md` remains in the change folder.

Future slices must add:
- runtime import tests
- geometry validation tooling
- gameplay balance tests
- asset import and binder integration tests
