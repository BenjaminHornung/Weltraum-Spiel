# Ship Builder Modular Parts v0 Catalog

## 1) Planning scope and conventions

This document defines the first planning catalog for modular ship parts.

### Design goals

- Keep a clear low-poly hard-surface art direction.
- Use one deterministic module grammar for Blender authoring and Unity binder import.
- Prefer explicit functional markers; no hidden fallback behavior.
- Keep gameplay semantics metadata-driven so art can be replaced without logic changes.
- Keep shipping timeline short with a v0 of 32 parts across 8 categories (4 variants each).

### Orientation and axes

- World convention: `+Z` = Forward, `+Y` = Up, `+X` = Right.
- Snap grid: `0.5 m` increments.
  - 0.5 m is half of a common 1 m module tile.
  - It supports compact workships, utility craft, surface-rated landers, and large cargo blocks.
  - Small offsets from physics and camera placement remain stable when using integer snap coordinates.
- The builder snap origin is at local module center unless pivot-specific.

### Naming and marker conventions

- Mesh prefix: `MESH_`
- Collider prefix: `COL_`
- Socket/marker prefix: `SOCKET_`
- Optional helper/vfx prefix (non-bounds): `HELPER_`, `VFX_`
- Canonical module name template:
  `SHIP_<CATEGORY>_<VARIANT>_<SIZE>_V0`
- Primary Blender socket name template:
  `SOCKET_<FUNCTION>_<SIDE_OR_AXIS>_<NN>`
- Primary connector side names:
  `FRONT`, `AFT`, `LEFT`, `RIGHT`, `TOP`, `BOTTOM`
- Existing canonical/compat socket names to support now:
  - `Hardpoint`
  - `MainThrusterNozzle`
  - `MainThrusterGimbalPivot`
  - `RcsNozzle`
  - `WeaponMuzzle`
  - `TurretYawPivot`
  - `TurretPitchPivot`
  - `VisualOnly`
- Direction enums for marker naming:
  - `Forward`, `Back`, `Left`, `Right`, `Up`, `Down`, `Main`, `Muzzle`, `Unknown`
- Direction roles used by sockets:
  - `ForceDirection`, `PlumeDirection`, `BarrelForward`, `ConnectorNormal`
- Required primary socket examples:
  - main thruster nozzle: `SOCKET_THR_MAIN_AFT_01`
  - optional main thruster gimbal: `SOCKET_THR_GIMBAL_AFT_01`
  - RCS nozzles: `SOCKET_RCS_POS_X_01`, `SOCKET_RCS_NEG_X_01`,
    `SOCKET_RCS_POS_Y_01`, `SOCKET_RCS_NEG_Y_01`, `SOCKET_RCS_POS_Z_01`,
    `SOCKET_RCS_NEG_Z_01`
  - turret base: `SOCKET_TURRET_BASE_TOP_01`
  - turret yaw pivot: `SOCKET_TURRET_YAW_01`
  - turret pitch pivot: `SOCKET_TURRET_PITCH_01`
  - muzzle: `SOCKET_MUZZLE_01`
  - muzzle flash: `SOCKET_MUZZLE_FLASH_01`
  - cargo attach: `SOCKET_CARGO_ATTACH_01`
  - docking / connectors: `SOCKET_CONN_FRONT_01`, `SOCKET_CONN_AFT_01`,
    `SOCKET_CONN_LEFT_01`, `SOCKET_CONN_RIGHT_01`, `SOCKET_CONN_TOP_01`,
    `SOCKET_CONN_BOTTOM_01`
  - optional camera anchor: `SOCKET_CAMERA_ANCHOR_01`
- Import compatibility aliases that should be emitted as metadata compatibility names where needed:
  - `MainThrusterGimbal`, `MainThrusterNozzle`, `RCS_Nozzle_<PodId>_<Direction>`, `Muzzle`,
    `TurretYawPivot`, `TurretPitchPivot`, `THRUST_NOZZLE_MAIN*`, `RCS_NOZZLE_*`
- Runtime turret names expected today:
  - `WEAPON_TURRET_BASE_PRIMARY`, `WEAPON_TURRET_YAW_PRIMARY`,
    `WEAPON_TURRET_PITCH_PRIMARY`, `WEAPON_MUZZLE_PRIMARY`,
    `WEAPON_MUZZLE_FLASH_PRIMARY`

### Marker rule set

- Every functional part must include all required `SOCKET_` markers listed in its catalog row.
- Blender object name format:
  `SOCKET_<FUNCTION>_<SIDE_OR_AXIS>_<NN>`
- Socket metadata maps each Blender object to socket type, direction, and role.
  Example: `SOCKET_THR_MAIN_AFT_01` maps to `MainThrusterNozzle`,
  physical side `AFT`, force direction `Forward`, and plume direction `Back`.
- Missing required markers must fail import/binder validation explicitly.
- `SOCKET_VisualOnly` is mandatory for decorative-only pieces.
- `Hardpoint` markers are required for structural mounts.
- Imported fallback to zero vectors or root object is forbidden.
- Marker transforms define local forward axis and must match role direction.

### Metadata schema concept (v0 planning)

Each part entry in catalog metadata should include:

| Field | Purpose |
|---|---|
| `partId` | Stable internal ID, e.g. `cockpit_scout_small_v0` |
| `category` | One of 8 categories |
| `variantName` | Human name shown in editor |
| `moduleName` | Runtime prefab/binder identifier |
| `meshName` | Unity mesh path target |
| `sizeMeters` | `[x, y, z]` approximate bbox |
| `massTier` | Light/Medium/Heavy |
| `snapSockets` | Required socket entries |
| `socketAliases` | Compatibility names such as `MainThrusterNozzle` or `WeaponMuzzle` |
| `vfxProfiles` | Exhaust, muzzle flash, reactor glow etc |
| `collider` | `BOX`/`MESH` and shape notes |
| `mountSides` | Allowed builder faces |
| `stats` | Hit points, durability, power, fuel, cargo slots |
| `allowedVariants` | Build-time compatibility tags |

## 2) v0 part catalog

Dimensions are rough planning targets in meters.

### 2.1 Cockpit / command

#### Scout cockpit small
- Purpose: tiny forward command pod for lightweight craft.
- Dimensions: `2.0 x 2.2 x 1.5`
- Mass tier: Light
- Gameplay stats: +4 armor HP, +1 pilot seat, +2 power draw, +1 radar radius
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_WeaponMuzzle_Forward_BarrelForward` (optional for nose gun)
  - `SOCKET_VisualOnly_Forward_Unknown`
- VFX needed: `VFX_DynamicCockpitLight`, optional forward landing light
- Collider plan: simple BOX collider from center shell, no self-intersecting hull
- Snap points: +Forward and -Back sockets
- Allowed mount sides: `Forward`, `Back`, `Up`
- Silhouette notes: small oval nose, short profile, rear spine cut-out for connectors
- Blender MCP generation notes:
  - Keep center mass forward heavy
  - `MESH_ShipMod_Cockpit_Scout`
  - `COL_ShipMod_Cockpit_Scout`
- Unity import/binder notes:
  - Ensure hardpoint compatibility name list includes `Main` as forward role
  - Reject imports if back hardpoint absent

#### Industrial cockpit box
- Purpose: durable cockpit with cargo-friendly side rails.
- Dimensions: `2.2 x 2.2 x 2.0`
- Mass tier: Medium
- Gameplay stats: +8 armor HP, +1 pilot seat, +4 power draw, +3 radar radius
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_Hardpoint_Right_ConnectorNormal`
- VFX needed: `VFX_BridgePanel`, `VFX_InternalGlow`
- Collider plan: BOX + trimmed protrusion for side rails
- Snap points: 6-axis structural ports
- Allowed mount sides: `Forward`, `Back`, `Left`, `Right`, `Up`
- Silhouette notes: boxy, visible seam around side rails
- Blender MCP generation notes:
  - Keep no triangles >2k per mesh
- Unity import/binder notes:
  - Add import compatibility alias for `Main` directional role in case reused as bridge block

#### Long-range cockpit
- Purpose: command pod with sensor mast and forward scan mast.
- Dimensions: `2.0 x 2.6 x 2.4`
- Mass tier: Medium
- Gameplay stats: +6 armor HP, +1 pilot seat, +1 extra sensor range slot
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Up_ConnectorNormal`
  - `SOCKET_WeaponMuzzle_Forward_BarrelForward` (optional)
- VFX needed: `VFX_SensorSweep`, `VFX_WindlightFaint`
- Collider plan: BOX plus thin mast proxy with separate helper collider
- Snap points: back and upward mast connection
- Allowed mount sides: `Forward`, `Back`, `Up`
- Silhouette notes: long upper mast creates larger z-axis profile
- Blender MCP generation notes:
  - Keep mast as child mesh, isolated `MESH_` object
- Unity import/binder notes:
  - Include `SOCKET_MainThrusterNozzle` only if adding forward weapon thruster variant

#### Armored bridge cockpit
- Purpose: high-protection bridge with reinforced hull.
- Dimensions: `3.2 x 2.4 x 2.0`
- Mass tier: Heavy
- Gameplay stats: +14 armor HP, +1 pilot seat, +2 fire immunity bonus planned
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_ArmorGlow`, `VFX_BridgeInterior`
- Collider plan: two-stage BOX colliders, outer hull and bridge canopy
- Snap points: front and back reinforced ports
- Allowed mount sides: `Forward`, `Back`, `Left`, `Right`, `Up`
- Silhouette notes: wider and taller with thick edge rails
- Blender MCP generation notes:
  - Emphasize planar armor plates; keep UV seams minimal
- Unity import/binder notes:
  - Add compatibility marker alias for `WEAPON_TURRET_BASE_PRIMARY` mount testing

### 2.2 Hull / frame

#### Small spine frame
- Purpose: lightweight connection spine.
- Dimensions: `2.0 x 1.0 x 3.0`
- Mass tier: Light
- Gameplay stats: +3 armor HP, no power, no seats, +2 structural integrity
- Sockets / markers required:
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Up_ConnectorNormal`
- VFX needed: none
- Collider plan: BOX
- Snap points: two axial endpoints plus one vertical mount
- Allowed mount sides: `Forward`, `Back`, `Up`, `Down`
- Silhouette notes: linear spine for tight turn ship frames
- Blender MCP generation notes:
  - Ensure straight 0.5m aligned endpoints
- Unity import/binder notes:
  - Validate no missing `Hardpoint_Back` marker

#### Medium rectangular frame
- Purpose: core hull section for medium craft.
- Dimensions: `2.5 x 2.0 x 3.0`
- Mass tier: Medium
- Gameplay stats: +8 armor HP, +1 hardpoint capacity
- Sockets / markers required:
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_Hardpoint_Right_ConnectorNormal`
- VFX needed: none
- Collider plan: BOX with chamfered faces
- Snap points: four side ports + center spine mount
- Allowed mount sides: all six
- Silhouette notes: balanced cuboid silhouette
- Blender MCP generation notes:
  - Keep faces planar to avoid normal flicker
- Unity import/binder notes:
  - Emit aliases: `RCS_NOZZLE_*` reserved empty allowed not required

#### Cross-frame connector
- Purpose: intersecting connector for branching hull geometry.
- Dimensions: `2.0 x 2.0 x 2.0`
- Mass tier: Heavy
- Gameplay stats: +12 armor HP, +2 structure anchors
- Sockets / markers required:
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_Hardpoint_Right_ConnectorNormal`
  - `SOCKET_Hardpoint_Up_ConnectorNormal`
- VFX needed: none
- Collider plan: composed BOX set
- Snap points: 5-face cross pattern
- Allowed mount sides: all except `Down` only if thruster clearance planned
- Silhouette notes: plus shape, larger attachment area
- Blender MCP generation notes:
  - Export as one root mesh if possible for easy snapping
- Unity import/binder notes:
  - Reject if any connector side lacks marker in required roles

#### Armor wedge frame
- Purpose: angled frame for frontal armor transitions.
- Dimensions: `2.8 x 1.8 x 2.6`
- Mass tier: Heavy
- Gameplay stats: +16 armor HP, reduces incoming frontal hit chance planned
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Down_ConnectorNormal`
- VFX needed: `VFX_ArmorHeat`
- Collider plan: 2 BOX colliders, one for wedge tip
- Snap points: rear + lower mount
- Allowed mount sides: `Back`, `Down`, `Up`, `Left`, `Right`
- Silhouette notes: forward wedge to reduce target profile
- Blender MCP generation notes:
  - Maintain clean 45 or 30 degree planar cuts
- Unity import/binder notes:
  - Include `VisualOnly` for optional decals

### 2.3 Main thrusters

#### Small chemical bell
- Purpose: standard starter forward/rear propulsion.
- Dimensions: `1.8 x 1.2 x 1.8`
- Mass tier: Light
- Gameplay stats: +2 thrust rating, +1 heat output
- Sockets / markers required:
  - `SOCKET_MainThrusterNozzle_Back_PlumeDirection`
  - `SOCKET_MainThrusterGimbalPivot_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Back_Unknown`
- VFX needed: `VFX_MainFlame`, `VFX_ThermalCore`, `VFX_SmokeTrail`
- Collider plan: BOX + narrow ring proxy at nozzle
- Snap points: centerline rear mount and optional forward gimbal
- Allowed mount sides: `Back`, `Down` (for gravity plane variants)
- Silhouette notes: short bell with clear bell cone
- Blender MCP generation notes:
  - nozzle axis must point to `-Z` for back-facing thruster
- Unity import/binder notes:
  - Import marker parser must read `MainThrusterNozzle` and `MainThrusterGimbalPivot` explicitly

#### Twin medium engine
- Purpose: paired thrust for higher maneuverability.
- Dimensions: `2.4 x 1.6 x 2.0`
- Mass tier: Medium
- Gameplay stats: +4 thrust rating, +2 heat output
- Sockets / markers required:
  - `SOCKET_MainThrusterNozzle_Left_ForceDirection`
  - `SOCKET_MainThrusterNozzle_Right_ForceDirection`
  - `SOCKET_MainThrusterGimbalPivot_Back_ConnectorNormal`
- VFX needed: two synchronized `VFX_MainFlame` emitters
- Collider plan: BOX + per-nozzle trigger sphere
- Snap points: central gimbal, two nozzles
- Allowed mount sides: `Back`, `Left`, `Right`
- Silhouette notes: two protruding bells, compact envelope
- Blender MCP generation notes:
  - Keep mirrored symmetry within 0.001m
- Unity import/binder notes:
  - Add runtime alias list for compatibility check with `THRUST_NOZZLE_MAIN*`

#### Heavy block engine
- Purpose: high thrust booster for heavy hull.
- Dimensions: `3.0 x 2.2 x 2.8`
- Mass tier: Heavy
- Gameplay stats: +9 thrust rating, +4 heat output
- Sockets / markers required:
  - `SOCKET_MainThrusterNozzle_Back_PlumeDirection`
  - `SOCKET_MainThrusterGimbalPivot_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Back_Unknown`
- VFX needed: `VFX_MainFlame`, `VFX_HotPlume`, `VFX_ReactionShockwave`
- Collider plan: BOX hull plus tapered cone proxy
- Snap points: one heavy mount with reinforced back connection
- Allowed mount sides: `Back`, `Up`
- Silhouette notes: bulky mass with strong rear volume
- Blender MCP generation notes:
  - Add bevel and low-poly edges only
- Unity import/binder notes:
  - Missing gimbal pivot should fail import

#### Compact maneuver engine
- Purpose: short impulse engine for quick strafe blocks.
- Dimensions: `1.2 x 1.2 x 1.2`
- Mass tier: Medium
- Gameplay stats: +1 thrust rating, +0.5 heat output
- Sockets / markers required:
  - `SOCKET_MainThrusterNozzle_Back_PlumeDirection`
  - `SOCKET_THR_MAIN_AFT_01`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
- VFX needed: `VFX_ShortBurst`
- Collider plan: BOX
- Snap points: single mount with local exhaust direction marker
- Allowed mount sides: `Back`, `Left`, `Right`, `Down`
- Silhouette notes: very compact cubic volume
- Blender MCP generation notes:
  - Keep center offset so no overlap with attached Hardpoint mesh
- Unity import/binder notes:
  - Treat as a main-thruster category part; any RCS reuse must be a later explicit metadata variant

#### Main thruster marker metadata

Every main thruster variant must define where force, plume, heat, and optional gimbal behavior originate. The nozzle marker local force direction is metadata-driven; exhaust particles and heat glow emit from the nozzle marker and should not use the part root.

| Variant | Thrust direction | Nozzle marker | Exhaust cone | Heat / glow area | Camera bounds | Optional gimbal |
|---|---|---|---|---|---|---|
| Small chemical bell | force forward, plume aft | `SOCKET_THR_MAIN_AFT_01` | `2.0 m` length, `0.45 m` radius | bell lip and aft ring | ignore `VFX_EXHAUST_*` and `HELPER_*` | no |
| Twin medium engine | force forward, twin plume aft | `SOCKET_THR_MAIN_AFT_01`, `SOCKET_THR_MAIN_AFT_02` | each `2.6 m` length, `0.35 m` radius | twin bell lips and center heat panel | ignore plume helpers | `SOCKET_THR_GIMBAL_AFT_01` shared |
| Heavy block engine | force forward, broad plume aft | `SOCKET_THR_MAIN_AFT_01` | `3.4 m` length, `0.9 m` radius | aft block grid and heat panels | ignore heat/exhaust helpers | `SOCKET_THR_GIMBAL_AFT_01` |
| Compact maneuver engine | force forward by default, side mounting allowed by metadata | `SOCKET_THR_MAIN_AFT_01` | `1.2 m` length, `0.28 m` radius | compact nozzle throat | ignore compact plume helper | optional `SOCKET_THR_GIMBAL_AFT_01` |

### 2.4 RCS blocks

#### 2-way side RCS
- Purpose: lateral translation and rotation damping.
- Dimensions: `1.6 x 1.0 x 1.2`
- Mass tier: Light
- Gameplay stats: +1.5 RCS force, +1 angular force
- Sockets / markers required:
  - `SOCKET_RcsNozzle_Left_ForceDirection`
  - `SOCKET_RcsNozzle_Right_ForceDirection`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
- VFX needed: `VFX_RcsJetPulse` on both nozzles
- Collider plan: BOX
- Snap points: left/right local side flanges
- Allowed mount sides: `Left`, `Right`
- Silhouette notes: thin rectangular shell
- Blender MCP generation notes:
  - Force vector arrows should align to +X/-X for side behavior
- Unity import/binder notes:
  - No auto-map to root `Vector3.zero`; marker direction is mandatory

#### 4-way corner RCS
- Purpose: fast corner correction at low speed.
- Dimensions: `1.8 x 1.2 x 1.8`
- Mass tier: Medium
- Gameplay stats: +2.5 RCS force, +2 angular force
- Sockets / markers required:
  - `SOCKET_RcsNozzle_Forward_ForceDirection`
  - `SOCKET_RcsNozzle_Back_ForceDirection`
  - `SOCKET_RcsNozzle_Left_ForceDirection`
  - `SOCKET_RcsNozzle_Right_ForceDirection`
- VFX needed: `VFX_RcsPlume`
- Collider plan: four small BOX proxy
- Snap points: central structural mount + 4 nozzle vectors
- Allowed mount sides: all horizontal
- Silhouette notes: compact cube with corner nozzles
- Blender MCP generation notes:
  - Keep nozzles centered on each axis side
- Unity import/binder notes:
  - Fails if fewer than two lateral vectors

#### 6-way cube RCS
- Purpose: omnidirectional fine control.
- Dimensions: `1.8 x 1.8 x 1.8`
- Mass tier: Medium
- Gameplay stats: +3.5 RCS force, +3 angular force
- Sockets / markers required:
  - `SOCKET_RcsNozzle_Forward_ForceDirection`
  - `SOCKET_RcsNozzle_Back_ForceDirection`
  - `SOCKET_RcsNozzle_Left_ForceDirection`
  - `SOCKET_RcsNozzle_Right_ForceDirection`
  - `SOCKET_RcsNozzle_Up_ForceDirection`
  - `SOCKET_RcsNozzle_Down_ForceDirection`
- VFX needed: `VFX_RcsPlume_Force` for six directions
- Collider plan: BOX with slight radius at corners
- Snap points: one central node
- Allowed mount sides: all
- Silhouette notes: symmetric cubic block
- Blender MCP generation notes:
  - Keep each nozzle marker exactly opposite its paired vector
- Unity import/binder notes:
  - Exported compatibility aliases can include `RCS_NOZZLE_*`

#### Heavy precision RCS cluster
- Purpose: advanced cluster for turreted ships.
- Dimensions: `2.2 x 1.6 x 2.4`
- Mass tier: Heavy
- Gameplay stats: +5 RCS force, +4 angular force, +0.5 heat output
- Sockets / markers required:
  - `SOCKET_RcsNozzle_Forward_ForceDirection`
  - `SOCKET_RcsNozzle_Back_ForceDirection`
  - `SOCKET_RcsNozzle_Up_ForceDirection`
  - `SOCKET_RcsNozzle_Down_ForceDirection`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
- VFX needed: `VFX_RcsPlume` with staggered burst
- Collider plan: merged BOX + two long side fins
- Snap points: center and lower side for optional support
- Allowed mount sides: all
- Silhouette notes: taller profile with fine fins
- Blender MCP generation notes:
  - Use repeated ring geometry for nozzle details and avoid dense topology
- Unity import/binder notes:
  - Include compatibility alias `RCS_Nozzle_<PodId>_<Direction>`

#### RCS direction metadata

RCS markers must be semantic thruster origins, not decoration. `POS_X` means the force direction is local `+X`; `NEG_X` means local `-X`, and so on. The particle plume emits opposite the force direction from the same marker unless a `VFX_RCS_*` helper is explicitly mapped.

| Variant | Required nozzle directions | Visual nozzle location | Particle origin marker | Minimum hull spacing | Efficiency class |
|---|---|---|---|---:|---|
| 2-way side RCS | `SOCKET_RCS_POS_X_01`, `SOCKET_RCS_NEG_X_01` | left/right side pods | same as nozzle markers | `0.15 m` outside hull | translation-efficient |
| 4-way corner RCS | `SOCKET_RCS_POS_X_01`, `SOCKET_RCS_NEG_X_01`, `SOCKET_RCS_POS_Z_01`, `SOCKET_RCS_NEG_Z_01` | left/right and forward/back chamfered faces | same as nozzle markers | `0.15 m` outside hull | mixed |
| 6-way cube RCS | `SOCKET_RCS_POS_X_01`, `SOCKET_RCS_NEG_X_01`, `SOCKET_RCS_POS_Y_01`, `SOCKET_RCS_NEG_Y_01`, `SOCKET_RCS_POS_Z_01`, `SOCKET_RCS_NEG_Z_01` | six cube faces | same as nozzle markers | `0.2 m` outside hull | mixed |
| Heavy precision RCS cluster | paired multi-nozzles per axis, indexes `_01` and `_02` where present | extended pods at high moment arms | same as nozzle markers plus `VFX_RCS_*` helpers | `0.25 m` outside hull | torque-efficient |

### 2.5 Fuel / power

#### Small tank
- Purpose: short-range fuel reserve.
- Dimensions: `1.6 x 1.6 x 2.0`
- Mass tier: Light
- Gameplay stats: +10 fuel units, +2 power buffer
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_FuelValveGlow`
- Collider plan: BOX with inner shell proxy
- Snap points: one rear structural and one top access
- Allowed mount sides: `Back`, `Down`
- Silhouette notes: rounder cylindrical feel
- Blender MCP generation notes:
  - Keep tank profile smooth with few subdivisions
- Unity import/binder notes:
  - Metadata marks as `fuel` storage category

#### Medium side tank
- Purpose: compact lateral fuel extension.
- Dimensions: `2.0 x 1.4 x 2.6`
- Mass tier: Medium
- Gameplay stats: +18 fuel units, +1 armor penalty
- Sockets / markers required:
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_Hardpoint_Right_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_FuelGlow`
- Collider plan: BOX + side fins
- Snap points: side flanges and optional front connector
- Allowed mount sides: `Left`, `Right`, `Forward`
- Silhouette notes: elongated tank with side bulge
- Blender MCP generation notes:
  - Ensure each side marker points normal out of mesh
- Unity import/binder notes:
  - Planned runtime metadata includes `fuelCapacity` and `fuelLeakProfile`

#### Long cylinder tank
- Purpose: long endurance supply.
- Dimensions: `1.2 x 1.2 x 4.0`
- Mass tier: Heavy
- Gameplay stats: +30 fuel units, +4 drag profile
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
- VFX needed: `VFX_VentLeak` (idle)
- Collider plan: capsule-style proxy split into two BOX
- Snap points: both ends
- Allowed mount sides: `Forward`, `Back`, `Up`
- Silhouette notes: very long cylindrical volume
- Blender MCP generation notes:
- Align long axis with local +Z for this catalog
- Unity import/binder notes:
  - Must declare orientation in metadata to avoid runtime ambiguity

#### Protected internal tank
- Purpose: armored internal reserve with blast shielding.
- Dimensions: `2.0 x 1.6 x 2.0`
- Mass tier: Heavy
- Gameplay stats: +22 fuel units, +6 blast resistance bonus planned
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_ShieldLining`, `VFX_SparkLeak` (damage)
- Collider plan: BOX inner and outer hull
- Snap points: hidden mount and outer access cover
- Allowed mount sides: `Back`, `Left`, `Right`
- Silhouette notes: thick outer profile, venting seam
- Blender MCP generation notes:
  - Reserve face area for planned breach seam decals
- Unity import/binder notes:
  - Add no hardcoded gameplay behavior; only metadata tags

### 2.6 Storage / cargo

#### Small storage box
- Purpose: lightweight cargo container.
- Dimensions: `1.4 x 1.4 x 1.4`
- Mass tier: Light
- Gameplay stats: +4 cargo slots planned, +1 structural integrity
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: none
- Collider plan: BOX
- Snap points: one rear mount
- Allowed mount sides: `Back`, `Left`, `Right`, `Down`
- Silhouette notes: compact cube with visible hatch
- Blender MCP generation notes:
  - Add internal volume marker `SOCKET_Volume_Cargo_Small` (planner metadata)
- Unity import/binder notes:
  - Runtime cargo integration not in this change; mark as metadata only

#### Medium cargo bay
- Purpose: main load bay.
- Dimensions: `2.0 x 1.6 x 2.2`
- Mass tier: Medium
- Gameplay stats: +10 cargo slots planned
- Sockets / markers required:
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_AccessDoor`
- Collider plan: BOX with open hatch proxy
- Snap points: front and rear structural
- Allowed mount sides: `Forward`, `Back`, `Up`
- Silhouette notes: rectangular bay with vent rails
- Blender MCP generation notes:
  - Model hatch as child mesh, not separate root
- Unity import/binder notes:
  - Include metadata `cargoVolume` and `stackedLoad` planning fields

#### External container rack
- Purpose: exposed cargo stack.
- Dimensions: `2.8 x 1.0 x 2.0`
- Mass tier: Medium
- Gameplay stats: +8 cargo slots planned, +0 armor
- Sockets / markers required:
  - `SOCKET_Hardpoint_Down_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_DustWake` if exposed
- Collider plan: BOX + strap proxy objects
- Snap points: underside + rear
- Allowed mount sides: `Down`, `Back`
- Silhouette notes: open, exposed, non-stealthy
- Blender MCP generation notes:
  - Keep items visually readable but physically simple
- Unity import/binder notes:
  - Validate no collision blocker from `HELPER_` volumes

#### Heavy cargo block
- Purpose: high-capacity mass cargo and utility support.
- Dimensions: `3.2 x 2.2 x 2.0`
- Mass tier: Heavy
- Gameplay stats: +24 cargo slots planned, -2 speed planning penalty
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_Hardpoint_Left_ConnectorNormal`
  - `SOCKET_Hardpoint_Right_ConnectorNormal`
  - `SOCKET_VisualOnly_Unknown_Unknown`
- VFX needed: `VFX_LoadWeight`, optional suspension lines
- Collider plan: BOX with extra side shield planes
- Snap points: back and bilateral side nodes
- Allowed mount sides: `Back`, `Left`, `Right`, `Down`
- Silhouette notes: wide load-bearing bar shape
- Blender MCP generation notes:
  - Prioritize flat faces for quick UV and lightmap
- Unity import/binder notes:
  - Binder should treat cargo as metadata only in this phase

#### Cargo and storage metadata

Cargo markers are planned metadata only in this package. They still need precise names so later binders can validate cargo volume and access points without guessing or using root fallback.

| Variant | Capacity estimate | Attach points | Volume box | Access / door visual | Empty / full mass | Turret fire blocking |
|---|---:|---|---|---|---|---|
| Small storage box | 4 slots | `SOCKET_CARGO_ATTACH_01`, `SOCKET_CONN_AFT_01` | `HELPER_CARGO_VOLUME_01`, `1.2 x 1.0 x 1.2 m` | front hatch seam | `0.8 t / 2.0 t` | blocks fire rays passing through box volume |
| Medium cargo bay | 12 slots | `SOCKET_CARGO_ATTACH_01`, `SOCKET_CARGO_ATTACH_02`, `SOCKET_CONN_FRONT_01`, `SOCKET_CONN_AFT_01` | `HELPER_CARGO_VOLUME_01`, `2.0 x 1.4 x 2.4 m` | side bay doors | `1.8 t / 5.2 t` | blocks turret arcs through bay body |
| External container rack | 8 slots external | four rack clamps plus `SOCKET_CONN_TOP_01` | one `HELPER_CARGO_VOLUME_*` per visible container | visible clamp latches | `1.2 t / 4.0 t` | containers block fire unless marked jettisoned in future |
| Heavy cargo block | 24 slots | `SOCKET_CARGO_ATTACH_01` through `_04`, `SOCKET_CONN_AFT_01` | `HELPER_CARGO_VOLUME_01`, `3.0 x 2.0 x 1.8 m` | broad sliding cargo face | `3.6 t / 10.0 t` | hard blocker for turret line of fire |

### 2.7 Weapons / turrets

#### Small single gun turret
- Purpose: light defensive armament.
- Dimensions: `1.5 x 1.2 x 1.5`
- Mass tier: Light
- Gameplay stats: one barrel, +2 DPS, low spread
- Sockets / markers required:
  - `SOCKET_TURRET_BASE_TOP_01`
  - `SOCKET_TURRET_YAW_01`
  - `SOCKET_TURRET_PITCH_01`
  - `SOCKET_MUZZLE_01`
  - `SOCKET_MUZZLE_FLASH_01`
- VFX needed: `VFX_MuzzleFlash`, `VFX_ShellEject`
- Collider plan: BOX around turret housing
- Snap points: turret base socket + forward muzzle origin
- Allowed mount sides: `Forward`, `Left`, `Right`, `Up`
- Silhouette notes: low, compact turret
- Blender MCP generation notes:
  - Yaw pivot around local Y, pitch pivot around local X
- Unity import/binder notes:
  - This category must map runtime compatibility names:
    `WEAPON_TURRET_BASE_PRIMARY`, `WEAPON_TURRET_YAW_PRIMARY`, `WEAPON_TURRET_PITCH_PRIMARY`, `WEAPON_MUZZLE_PRIMARY`, `WEAPON_MUZZLE_FLASH_PRIMARY`

#### Dual light turret
- Purpose: two barrels for faster engagement.
- Dimensions: `2.0 x 1.6 x 2.0`
- Mass tier: Medium
- Gameplay stats: two barrels, +4 DPS, +1 heat
- Sockets / markers required:
  - `SOCKET_TURRET_BASE_TOP_01`
  - `SOCKET_TURRET_YAW_01`
  - `SOCKET_TURRET_PITCH_01`
  - `SOCKET_MUZZLE_LEFT_01`
  - `SOCKET_MUZZLE_RIGHT_01`
  - `SOCKET_MUZZLE_FLASH_LEFT_01`
  - `SOCKET_MUZZLE_FLASH_RIGHT_01`
- VFX needed: `VFX_DoubleMuzzleFlash`, `VFX_GunHeat`
- Collider plan: BOX + barrel caps
- Snap points: base and bilateral barrel sockets
- Allowed mount sides: `Forward`, `Left`, `Right`
- Silhouette notes: twin protruding barrels
- Blender MCP generation notes:
  - Mirror left/right muzzle to equal length
- Unity import/binder notes:
  - Reject if muzzle markers are missing

#### Heavy slow turret
- Purpose: high damage, low fire rate.
- Dimensions: `2.6 x 2.0 x 2.2`
- Mass tier: Heavy
- Gameplay stats: one heavy barrel, +9 DPS, +6 heat
- Sockets / markers required:
  - `SOCKET_TURRET_BASE_TOP_01`
  - `SOCKET_TURRET_YAW_01`
  - `SOCKET_TURRET_PITCH_01`
  - `SOCKET_MUZZLE_01`
  - `SOCKET_MUZZLE_FLASH_01`
- VFX needed: `VFX_MuzzleFlashHeavy`, `VFX_RecoilCloud`
- Collider plan: BOX + muzzle cone proxy
- Snap points: base and heavy recoil anchor
- Allowed mount sides: `Forward`, `Up`
- Silhouette notes: bulky barrel barrel plus recoil mount
- Blender MCP generation notes:
  - Keep turret base low-poly with heavy frontal ring
- Unity import/binder notes:
  - Include planned block for recoil arc values in metadata

#### Fixed forward cannon mount
- Purpose: no-traverse hardpoint cannon.
- Dimensions: `2.0 x 1.1 x 2.4`
- Mass tier: Medium
- Gameplay stats: fixed mount only, +5 DPS, zero arc
- Sockets / markers required:
  - `SOCKET_CONN_FRONT_01`
  - `SOCKET_MUZZLE_01`
  - `SOCKET_MUZZLE_FLASH_01`
- VFX needed: `VFX_MuzzleFlash`, `VFX_BurnTrail`
- Collider plan: BOX with short forward overhang proxy
- Snap points: front mount
- Allowed mount sides: `Forward`, `Up`
- Silhouette notes: slab with protruding barrel and no movable housing
- Blender MCP generation notes:
  - No yaw/pitch pivot for this variant
- Unity import/binder notes:
  - Mark as `fixed` turret in metadata and disable turret rotation at runtime

#### Weapon and turret marker metadata

Every turret variant must carry this metadata in addition to the catalog row above.

| Variant | Yaw arc | Pitch arc | Blocked body rule | Required sockets | Recoil direction | Clearance radius |
|---|---:|---:|---|---|---|---:|
| Small single gun turret | -135 to +135 deg | -5 to +55 deg | underside and ship-body occlusion block shots below local pitch -5 deg | `SOCKET_TURRET_BASE_TOP_01`, `SOCKET_TURRET_YAW_01`, `SOCKET_TURRET_PITCH_01`, `SOCKET_MUZZLE_01`, `SOCKET_MUZZLE_FLASH_01` | local `-Z` from barrel | `0.8 m` |
| Dual light turret | -120 to +120 deg | 0 to +50 deg | block any shot where either muzzle ray intersects parent hull clearance | `SOCKET_TURRET_BASE_TOP_01`, `SOCKET_TURRET_YAW_01`, `SOCKET_TURRET_PITCH_01`, `SOCKET_MUZZLE_LEFT_01`, `SOCKET_MUZZLE_RIGHT_01`, `SOCKET_MUZZLE_FLASH_LEFT_01`, `SOCKET_MUZZLE_FLASH_RIGHT_01` | local `-Z` from both barrels | `1.0 m` |
| Heavy slow turret | -90 to +90 deg | +2 to +45 deg | no underside fire; require larger front clearance before fire | `SOCKET_TURRET_BASE_TOP_01`, `SOCKET_TURRET_YAW_01`, `SOCKET_TURRET_PITCH_01`, `SOCKET_MUZZLE_01`, `SOCKET_MUZZLE_FLASH_01` | local `-Z` from heavy barrel | `1.4 m` |
| Fixed forward cannon mount | 0 deg | 0 deg | blocked if muzzle ray crosses any mounted forward hull piece | `SOCKET_CONN_FRONT_01`, `SOCKET_MUZZLE_01`, `SOCKET_MUZZLE_FLASH_01` | local `-Z` from muzzle | `0.7 m` |

Turret metadata must be treated as functional, not cosmetic. If future validation cannot prove the blocked-angle rule, the part should not enter the builder catalog.

### 2.8 Utility

#### Sensor dish/module
- Purpose: exploration and target scanning utility.
- Dimensions: `1.8 x 1.3 x 1.6`
- Mass tier: Light
- Gameplay stats: +4 sensor radius planned, +2 scan accuracy
- Sockets / markers required:
  - `SOCKET_Hardpoint_Up_ConnectorNormal`
  - `SOCKET_VisualOnly_Up_Unknown`
- VFX needed: `VFX_SensorPulse`
- Collider plan: BOX + dish disc proxy
- Snap points: top mount + optional rear mount
- Allowed mount sides: `Up`, `Back`
- Silhouette notes: dish profile extends above hull
- Blender MCP generation notes:
  - Keep dish shape low-poly and symmetric
- Unity import/binder notes:
  - Metadata should include `sensorRangeMultiplier`

#### Docking connector
- Purpose: hardpoint-compatible ship linking.
- Dimensions: `1.2 x 1.2 x 1.2`
- Mass tier: Light
- Gameplay stats: +1 link point, +1 docking lock speed
- Sockets / markers required:
  - `SOCKET_Hardpoint_Forward_ConnectorNormal`
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
- VFX needed: `VFX_DockBeacon`, `VFX_DockSpark`
- Collider plan: BOX plus lock ring proxy
- Snap points: front/back alignment cones
- Allowed mount sides: `Forward`, `Back`
- Silhouette notes: ring-like front geometry
- Blender MCP generation notes:
  - Place marker normals exactly on docking axis
- Unity import/binder notes:
  - Ensure this part supports `Hardpoint` only and cannot be misread as weapon mount

#### Shield/armor plate
- Purpose: add-on protective face.
- Dimensions: `2.2 x 1.0 x 1.8`
- Mass tier: Medium
- Gameplay stats: +6 armor HP, +1 impact resistance
- Sockets / markers required:
  - `SOCKET_Hardpoint_Back_ConnectorNormal`
  - `SOCKET_VisualOnly_Back_Unknown`
- VFX needed: `VFX_ShieldFlicker`
- Collider plan: thin BOX
- Snap points: 1 flat mounting face
- Allowed mount sides: `Back`, `Left`, `Right`, `Up`
- Silhouette notes: flat plate with visible edges
- Blender MCP generation notes:
  - Keep plate flush and avoid floating faces
- Unity import/binder notes:
  - Plan compatibility with `Main`, `Muzzle` direction for shield edge orientation

#### Landing/maintenance hardpoint
- Purpose: ground ops and repair mount.
- Dimensions: `1.8 x 1.0 x 2.0`
- Mass tier: Medium
- Gameplay stats: +1 maintenance slot planned, +1 ground stabilizer
- Sockets / markers required:
  - `SOCKET_Hardpoint_Down_ConnectorNormal`
  - `SOCKET_VisualOnly_Down_Unknown`
  - `SOCKET_MainThrusterGimbalPivot_Down_ConnectorNormal` (optional for animation)
- VFX needed: `VFX_DockingGlow`
- Collider plan: BOX with reinforced underside
- Snap points: downward landing surface marker
- Allowed mount sides: `Down`, `Back`
- Silhouette notes: short stabilizer and service rails
- Blender MCP generation notes:
  - Keep underside flat and separate landing target helper
- Unity import/binder notes:
  - Mark as utility-only; no direct weapon or thruster socket logic

## 3) Planned metadata fields (non-implemented)

- All cargo semantics above are metadata fields only in this v0 planning package.
- Gameplay balancing values may be tuned in later implementation tasks.
- No runtime code or scene changes are part of this change.
