# Blender + MCP Guidelines for Modular Ship Parts

## 1) Coordinate and orientation rules

- Coordinate convention: `+Z` forward, `+Y` up, `+X` right.
- Local axis alignment is required for all exported parts.
- Thruster nozzles must emit particles in negative local forward when used as backward-facing exhaust.
- Keep all marker empties with clean +Z/-Z orientation matching marker semantic direction.

## 2) Snap grid and transform policy

- Use `0.5 m` snap grid.
- Rationale:
  - Keeps all markers and sockets on stable decimal half-step coordinates.
  - Works for 32-bit float transforms in import pipelines with low drift.
  - Aligns with current builder assumptions in simple module prototypes.
- Always model on this grid and keep origin values aligned to `0.0`, `+/-0.5`, etc.

## 3) Prefixes and naming

- Mesh objects: `MESH_` prefix.
- Collision proxies: `COL_` prefix.
- Socket markers and role empties: `SOCKET_` prefix.
- Helper objects not part of gameplay bounds: `HELPER_` or `VFX_`.
  - `VFX_` and `HELPER_` objects must be excluded from camera-framing proxy calculations.
- Recommended import-safe example names:
  - `MESH_ShipMod_Cockpit_Scout_Small`
  - `COL_ShipMod_Cockpit_Scout_Small`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `VFX_Exhaust_Core`

## 4) Marker and socket naming

- Primary Blender object marker format:
  `SOCKET_<FUNCTION>_<SIDE_OR_AXIS>_<NN>`
- Socket metadata maps each primary marker to the existing Unity socket type, direction, and role.
- Compatibility alias format:
  `SOCKET_<SocketType>_<Direction>_<Role>`
- Required socket types:
  - `Hardpoint`
  - `MainThrusterNozzle`
  - `MainThrusterGimbalPivot`
  - `RcsNozzle`
  - `WeaponMuzzle`
  - `TurretYawPivot`
  - `TurretPitchPivot`
  - `VisualOnly`
- Directions:
  - `Forward`, `Back`, `Left`, `Right`, `Up`, `Down`, `Main`, `Muzzle`, `Unknown`
- Roles:
  - `ForceDirection`
  - `PlumeDirection`
  - `BarrelForward`
  - `ConnectorNormal`
- Keep role names exact and consistent with existing importer expectations.
- Canonical compatibility marker names should be emitted as additional metadata aliases where possible:
  - `MainThrusterGimbal`, `MainThrusterNozzle`, `RCS_Nozzle_<PodId>_<Direction>`, `Muzzle`,
    `TurretYawPivot`, `TurretPitchPivot`, `THRUST_NOZZLE_MAIN*`, `RCS_NOZZLE_*`.
- Required primary examples:
  - `SOCKET_THR_MAIN_AFT_01`
  - `SOCKET_RCS_POS_X_01`, `SOCKET_RCS_NEG_X_01`, `SOCKET_RCS_POS_Y_01`, `SOCKET_RCS_NEG_Y_01`, `SOCKET_RCS_POS_Z_01`, `SOCKET_RCS_NEG_Z_01`
  - `SOCKET_TURRET_BASE_TOP_01`, `SOCKET_TURRET_YAW_01`, `SOCKET_TURRET_PITCH_01`
  - `SOCKET_MUZZLE_01`, `SOCKET_MUZZLE_FLASH_01`
  - `SOCKET_CARGO_ATTACH_01`
  - `SOCKET_CONN_FRONT_01`, `SOCKET_CONN_LEFT_01`, `SOCKET_CONN_RIGHT_01`, `SOCKET_CONN_AFT_01`, `SOCKET_CONN_TOP_01`, `SOCKET_CONN_BOTTOM_01`
  - `SOCKET_CAMERA_ANCHOR_01`

## 5) Functional marker semantics

- `Hardpoint`: structural socket for builder placement and part connection.
- `MainThrusterNozzle`: thrust emission vector and optional thrust center.
  - The local `Z` axis of this marker defines plume direction when role includes `PlumeDirection`.
- `MainThrusterGimbalPivot`: turret and thrust direction control pivot.
- `RcsNozzle`: local `Z` direction indicates force direction for translation/rotation.
- `WeaponMuzzle`: weapon effect emission point, with role `BarrelForward` using local `Z` for projectile and VFX forward.
- `TurretYawPivot`: yaw rotation point; axis must be local Y.
- `TurretPitchPivot`: pitch rotation point; axis must be local X.
- `VisualOnly`: non-functional marker for decals, light fixtures, and effects.

## 6) VFX and helper naming policy

- Camera bounds and physics should ignore markers prefixed `VFX_` and `HELPER_`.
- Use helper nodes for:
  - muzzle flash anchors
  - emission jitter controls
  - sensor arc gizmos
  - exhaust trail points
- Do not place `HELPER_` objects as root-level large geometry.
- Any part that uses `VisualOnly` must keep it separated from real collision geometry.

## 7) Main thruster / VFX rules

- `MainThrusterNozzle` marker defines where particle origin spawns.
- `MainThrusterGimbalPivot` marker defines the exhaust aim reference.
- Exhaust VFX direction:
  - `PlumeDirection` uses marker forward axis if part faces rear.
  - For forward-facing nozzles use `Direction=Main` or explicit inverse marker direction.
- Exhaust colliders must stay out of the plume volume.
- If no plume marker exists, binding should fail fast.

## 8) RCS particle semantics

- Every `RcsNozzle` must have a valid role direction.
- Vector pairing rule:
  - `Forward` pairs with `Back`, `Left` with `Right`, `Up` with `Down`.
- Add particle source nodes near marker center and slightly offset from hull to avoid z-fighting.
- If multiple nozzles exist, keep equal local offsets.
- Missing or mirrored missing pairs should fail import or trigger explicit non-import warning.

## 9) Turrets and muzzle rules

- `TurretYawPivot` and `TurretPitchPivot` must be in separate objects.
- Yaw and pitch arcs are defined in metadata, not geometry.
- Pitch arc must block downward facing fire:
  - do not point muzzle markers through hull underside.
  - add clear local minimum/maximum pitch markers as metadata fields only.
- `WeaponMuzzle` should be childed to the pitch pivot for runtime transform inheritance.
- `SOCKET_MUZZLE_FLASH_01` should sit at the visible flash origin and must not remain at root.
- For fixed turrets, only `Hardpoint` and `WeaponMuzzle` are required.

## 10) Cargo and utility planning markers

- Define cargo volume as `SOCKET_Volume_Cargo_<Alias>` helper empties (metadata field in this phase).
- Keep cargo helper geometry inside module bounds and not tagged as gameplay collision.
- Docking connectors:
  - use `Hardpoint` markers on matching directions
  - keep marker normals outward
  - include anti-snap clearance around connector body.

## 11) Collision and collider proxies

- Prefer simple convex geometry for `COL_`.
- Keep collision objects separate from render meshes to avoid VFX overlap.
- Avoid concave mesh colliders in first pass.
- Keep collision bounds tight but not interpenetrating markers.
- Every `COL_` object should be a non-render mesh object.

## 12) Export and hierarchy readiness

- Apply transforms before export: location (0,0,0), rotation (0,0,0), scale (1,1,1).
- Apply transforms on:
  - all mesh objects
  - all `COL_` objects
  - all `SOCKET_` objects
- Keep scale uniform.
- Export with metric units and axis orientation matching scene.
- Top-level hierarchy:
  - root module
  - mesh objects
  - collision objects
  - marker/point empties
- Do not include hardcoded paths to local drive or scene resources.
- Keep hierarchy export-ready for FBX: no animation, no cameras, no lights, no cameras.

## 13) Geometry and material rules

- Low-poly hard-surface style.
- Materials should use role naming consistent with `MAT_`.
- Keep transparent materials out except for planned non-structural glass/viewport panels.
- Do not duplicate topology for mirrored variants where mirror modifiers are sufficient.
- Avoid non-manifold geometry where possible.
- Keep UV islands simple and stable.

## 14) Reliability checklist

- All markers use exact spelling and case from this document.
- No fallback to zero vectors.
- Marker positions on 0.5 grid.
- No empty transform, no un-applied scale.
- No extra runtime components in root.
- No imported hardcoded material or texture paths.
