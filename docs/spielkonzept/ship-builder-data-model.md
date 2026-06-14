# Ship Builder Data Model

Status: planning/spec-only, 2026-06-14.

This document defines the future Ship Builder data model. It bridges the current
`PrototypeShipBlueprint` idea, the modular parts catalog, functional sockets,
gameplay stats, and future resource/cost integration. It does not implement code,
tests, assets, scenes, prefabs, ScriptableObjects, Blender files, or runtime
systems.

## 1. Design goals

- Separate reusable part definitions from placed part instances.
- Keep gameplay data metadata-driven and testable without final Blender art.
- Preserve the existing prototype blueprint direction: definitions, instances,
  validation, stats, and conversion into a flyable variant.
- Use the modular parts convention: `+Z` forward, `+Y` up, `+X` right, and a
  `0.5 m` player-facing grid.
- Treat sockets and markers as functional data, not cosmetic decoration.
- Reference future resources and costs by stable resource IDs, never display
  strings.
- Keep visual assets, collider assets, VFX helpers, and final art optional for
  pure data validation.

## 2. Core entities

The future builder model has four primary layers:

| Entity | Lifetime | Purpose |
| --- | --- | --- |
| `PartDefinition` | Catalog data | Describes one reusable buildable part. |
| `PartInstance` | Blueprint data | Places one definition in a player ship. |
| `SocketDefinition` | Catalog or imported metadata | Describes attach points, force markers, pivots, muzzles, camera anchors, and effects. |
| `ShipBlueprint` | Save data | Stores one draft or variant as part instances plus metadata. |

Definitions are shared and immutable during editing. Instances are the player's
draft. Validation and stats combine both.

## 3. PartDefinition

`PartDefinition` is the catalog entry for a part. It can be backed by primitive
prototype visuals, later Blender art, or purely metadata test fixtures.

### Required fields

| Field | Type concept | Purpose |
| --- | --- | --- |
| `id` | stable string | Internal ID, e.g. `cockpit_scout_small_v0`. Never localized. |
| `displayName` | localized string key or text | Player-facing name. |
| `category` | enum/string | Cockpit, hull/frame, main thruster, RCS, fuel/power, cargo/storage, turret/weapon, utility. |
| `description` | localized string key or text | Short player-facing explanation. |
| `dimensions` | vector meters | Approximate physical box size `[x, y, z]`. |
| `gridFootprint` | grid extents | Occupied footprint on the `0.5 m` builder grid. |
| `massDry` | kg | Dry installed mass. Must be finite and non-negative. |
| `allowedMountSides` | side list | Allowed sides such as Front, Aft, Left, Right, Top, Bottom. |
| `tags` | string list | Semantic filters such as `starter`, `internal`, `external`, `cargo`, `volatile`, `mirror_ok`. |
| `sockets` | socket list | Structural and functional sockets owned by the part. |
| `functionalComponents` | component list | Gameplay roles contributed by the part. |
| `statContributions` | stats object | Numeric gameplay contributions. |
| `validationMetadata` | rules object | Extra rules and thresholds used by validation. |

### Optional or future fields

| Field | Purpose |
| --- | --- |
| `massLoaded` | Full mass when the part carries built-in cargo, ammo, or fuel. |
| `hitpoints` | Future local durability. |
| `armorTier` | Future damage/resistance classification. |
| `costResourceRequirements` | Future builder cost list referencing resource IDs and quantities. |
| `visualAssetRef` | Later prefab/mesh/FBX reference. Not required for pure data validation. |
| `colliderProxyRef` | Later collider/proxy asset reference. Data validation can use dimensions instead. |
| `unlockRequirements` | Future licenses, faction access, research, or tech tier. |
| `variantGroup` | Family grouping for alternate skins or stat variants. |
| `balanceTier` | Starter, midgame, heavy, experimental, etc. |

### Example shape

```json
{
  "id": "thruster_small_chemical_bell_v0",
  "displayName": "Small Chemical Bell",
  "category": "mainThruster",
  "description": "Starter main engine with one aft nozzle.",
  "dimensions": { "x": 1.8, "y": 1.2, "z": 1.8 },
  "gridFootprint": { "x": 4, "y": 3, "z": 4, "gridMeters": 0.5 },
  "massDry": 700.0,
  "allowedMountSides": [ "Aft" ],
  "tags": [ "starter", "main_thrust", "mirror_centerline" ],
  "sockets": [ "conn_front_01", "thr_main_aft_01", "thr_gimbal_aft_01" ],
  "functionalComponents": [ "mainThruster" ],
  "statContributions": {
    "mainThrustNewton": 45000.0,
    "fuelBurnKgPerSecond": 0.6,
    "heatOutput": 1.0
  },
  "validationMetadata": {
    "requiresNozzleDirection": true,
    "preferredMount": "Aft"
  }
}
```

## 4. PartInstance

`PartInstance` places a `PartDefinition` in a blueprint.

### Required fields

| Field | Purpose |
| --- | --- |
| `stableInstanceId` | Unique stable ID inside the blueprint. Required for saves, undo, validation rows, and future damage/cargo state. |
| `partDefinitionId` | Reference to `PartDefinition.id`. |
| `localGridPosition` | Integer grid coordinate or snapped local position. Uses the builder grid, default `0.5 m`. |
| `localRotation` | Local rotation, MVP yaw-only unless a part explicitly allows pitch/roll. |
| `enabled` | Allows future disabled/parked parts without deleting data. |

### Optional or future fields

| Field | Purpose |
| --- | --- |
| `mirrorGroupId` | Groups mirrored placements for diagnostics and future linked edits. |
| `parentAttachedSocket` | Parent instance/socket reference when socket-based assembly is active. |
| `customName` | Player nickname for a module. |
| `cargoFillState` | Future cargo contents or fill fraction. |
| `damageState` | Future per-part damage/repair status. |
| `colorMaterialOverride` | Future color, paint, material, or decal overrides. |
| `lockedBySystem` | Future mission/factory lock or tutorial restriction. |

### Stable instance ID rule

Every instance shall have a stable ID. A recommended MVP rule is:

```text
<partDefinitionId>-<sequence>
```

Examples:

- `cockpit_scout_small_v0-1`
- `rcs_6way_cube_v0-4`
- `cargo_heavy_block_v0-2`

The ID should not change when the part moves, rotates, mirrors, or changes
selection. If a part is duplicated, the duplicate gets a new stable ID.

## 5. SocketDefinition

`SocketDefinition` represents both attach sockets and functional markers. It is
data that can come from hand-authored metadata, imported Blender marker data, or
prototype fixtures.

### Required fields

| Field | Purpose |
| --- | --- |
| `socketId` | Stable ID unique within the part definition. |
| `localPosition` | Local position in meters relative to the part origin. |
| `localRotation` | Local orientation. Directional sockets must not use identity as a hidden fallback unless identity is correct. |
| `socketType` | Structural, hardpoint, nozzle, pivot, muzzle, cargo, docking, camera, etc. |
| `compatiblePartCategories` | Categories allowed to attach or consume this socket. |
| `directionVector` | Local normalized vector for force, plume, barrel, connector normal, or camera direction. |
| `capacitySize` | Size class, load rating, cargo rating, or hardpoint capacity. |

### Optional or future fields

| Field | Purpose |
| --- | --- |
| `occupiedState` | Runtime/editor occupancy: free, occupied, blocked, reserved. |
| `allowedArcs` | Turret yaw/pitch or docking approach arc limits. |
| `vfxRole` | Exhaust, muzzle flash, RCS jet, sensor pulse, dock beacon, etc. |
| `ignoreForCameraBounds` | True for helper/VFX markers that should not inflate visual framing. |
| `requiredForCategory` | Whether missing this socket blocks the part definition. |
| `compatibilityAliases` | Existing names such as `MainThrusterNozzle`, `THRUST_NOZZLE_MAIN*`, `RCS_NOZZLE_*`, or `WEAPON_MUZZLE_PRIMARY`. |

### Socket types

The planned socket type vocabulary is:

- `structural`
- `hardpoint`
- `mainThrusterNozzle`
- `rcsNozzle`
- `turretBase`
- `turretYawPivot`
- `turretPitchPivot`
- `muzzle`
- `muzzleFlash`
- `cargoAttach`
- `dockingConnector`
- `cameraAnchor`
- `landingGear` future
- `droneBay` future

### Socket direction rules

- Structural and hardpoint sockets use `directionVector` as connector normal.
- Main thruster nozzles use direction for force or plume according to role.
- RCS nozzles must always define force direction.
- Muzzles define projectile and VFX forward direction.
- Turret pivots define yaw or pitch axes and arc constraints.
- VFX and helper sockets may be marked `ignoreForCameraBounds`.

No functional socket may silently fall back to part root, world origin, or a zero
vector.

## 6. Functional components

Functional components turn a part into gameplay capability. A part can carry more
than one component, but the MVP should keep components explicit rather than
inferring them from category alone.

### Cockpit/control core

Fields:

- `controlCoreId`
- `crewSeats`
- `commandPriority`
- `cameraAnchorSocketId`
- `radarSensorBonus`
- `requiredForFlightReady`
- `powerDrawFuture`

Purpose: marks a controllable ship. Validation requires at least one enabled
control core for a flight-ready variant.

### Hull/frame

Fields:

- `structureRating`
- `connectorCapacity`
- `armorTierFuture`
- `mountCapacityBySide`
- `damagePassThroughFuture`

Purpose: provides structural graph and mounting surfaces.

### Main thruster

Fields:

- `thrustNewton`
- `fuelBurnKgPerSecond`
- `nozzleSocketIds`
- `gimbalSocketId`
- `forceDirectionLocal`
- `heatOutputFuture`
- `requiresFuel`

Purpose: provides primary acceleration. Validation requires at least one usable
main thruster for flight-ready variants.

### RCS cluster

Fields:

- `nozzleSocketIds`
- `forceNewtonPerNozzle`
- `fuelBurnKgPerSecondPerNewton`
- `axisCoverage`
- `torqueEfficiencyClass`
- `vfxProfile`

Purpose: provides translation and rotational authority. Every RCS nozzle must
have a valid direction.

### Fuel tank

Fields:

- `fuelCapacityKg`
- `emptyMassKg`
- `filledMassKg`
- `acceptedFuelResourceIdFuture`
- `leakRiskFuture`
- `internalOrExternal`

Purpose: stores propellant or planned power resource. Fuel mass contributes to
loaded ship mass.

### Cargo/storage

Fields:

- `cargoMassCapacityKg`
- `cargoVolumeM3`
- `cargoAttachSocketIds`
- `internalOrExternal`
- `allowedResourceTagsFuture`
- `hazardSupportFuture`

Purpose: provides cargo capacity and future transfer targets. Cargo mass must be
queryable for ship physics and autopilot estimates.

### Turret/weapon

Fields:

- `weaponId`
- `weaponType`
- `turretBaseSocketId`
- `yawPivotSocketId`
- `pitchPivotSocketId`
- `muzzleSocketIds`
- `muzzleFlashSocketIds`
- `projectileDamage`
- `projectileSpeed`
- `fireRatePerSecond`
- `recoilImpulseNewtonSecond`
- `ammoResourceIdFuture`
- `arcLimits`

Purpose: provides weapon capability and firing markers. Turret weapons require
pivot and muzzle data. Fixed weapons require muzzle data.

### Utility/sensor

Fields:

- `utilityType`
- `sensorRangeBonus`
- `scanQualityBonus`
- `powerDrawFuture`
- `mountSocketIds`

Purpose: planned sensors, beacons, scanners, maintenance modules, and other
non-required utilities.

### Docking connector

Fields:

- `dockingSocketId`
- `connectorSizeClass`
- `approachAxis`
- `captureRangeFuture`
- `compatibleDockingTypes`

Purpose: enables future docking and cargo transfer interactions. Missing docking
connector is a warning, not an MVP flight blocker.

### Armor plate

Fields:

- `armorHitpointsFuture`
- `coverageSide`
- `massKg`
- `blocksTurretArc`
- `externalExposure`

Purpose: future damage protection and silhouette/collision blocker.

### Power/heat future

Fields:

- `powerGenerated`
- `powerDraw`
- `heatGenerated`
- `heatCapacity`
- `coolingRate`
- `thermalRiskTags`

Purpose: reserved for later power and heat networks. MVP stats may show
placeholder summaries, but flight validation should not depend on final power
networks unless a later slice explicitly enables them.

## 7. ShipBlueprint serialization shape

A future JSON-like save shape should be explicit and migration-friendly:

```json
{
  "blueprintId": "scout-runner-v1",
  "displayName": "Scout Runner",
  "version": 1,
  "catalogVersion": "ship-parts-v0",
  "partDefinitionsReferenced": [
    "cockpit_scout_small_v0",
    "hull_small_spine_v0",
    "thruster_small_chemical_bell_v0",
    "rcs_6way_cube_v0"
  ],
  "partInstances": [
    {
      "stableInstanceId": "cockpit_scout_small_v0-1",
      "partDefinitionId": "cockpit_scout_small_v0",
      "localGridPosition": { "x": 0, "y": 0, "z": 2 },
      "localRotation": { "yaw": 0, "pitch": 0, "roll": 0 },
      "enabled": true
    }
  ],
  "validationResultCache": null,
  "statsCache": null,
  "createdUtc": "future",
  "modifiedUtc": "future",
  "activeShipVariant": false
}
```

### Serialization requirements

- `blueprintId` is stable and save-safe.
- `displayName` is player-facing and can change.
- `version` is the blueprint schema version.
- `partDefinitionsReferenced` records definition IDs used by instances.
- `partInstances` is the authoritative layout.
- `validationResultCache` is optional and must never be trusted without checking
  source data/version.
- `statsCache` is optional and must be deterministic from definitions and
  instances.
- `createdUtc`, `modifiedUtc`, and `activeShipVariant` are future fields.

## 8. Resource/cost integration

Future builder costs reference resource IDs from the unified resource model:

```json
{
  "costResourceRequirements": [
    { "resourceId": "material_structural_plate", "quantity": 12 },
    { "resourceId": "component_scrap_electronics", "quantity": 4 }
  ]
}
```

Rules:

- Use `resourceId`, not display name.
- Costs belong to definitions or recipes, not instances, unless a future refit
  system adds per-instance repair state.
- Resource requirements are future validation/economy data, not MVP flight
  blockers.
- Cargo modules later provide containers that use the same resource identity and
  capacity rules as suit, ship, drone, and outpost storage.

## 9. Data ownership boundaries

- Part definitions own static capability and metadata.
- Part instances own player placement and per-instance future state.
- Sockets own local functional transforms and compatibility.
- Blueprint owns layout, naming, save metadata, and active/draft state.
- Stats and validation are derived from definitions plus instances.
- Visual assets are presentation, not authoritative gameplay data.

## 10. Later EditMode test plan

Future tests should cover:

- valid minimal ship
- missing cockpit/control core
- disconnected module
- hard overlap
- invalid socket occupancy
- turret missing muzzle
- RCS direction coverage
- COM/thrust offset warning
- stat formulas
- serialization roundtrip
- mirror placement

These tests should not need final Blender art. They can use metadata fixtures,
primitive visual placeholders, or built-in blueprint definitions.
