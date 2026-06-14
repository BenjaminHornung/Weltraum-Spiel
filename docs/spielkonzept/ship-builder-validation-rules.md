# Ship Builder Validation Rules

Status: planning/spec-only, 2026-06-14.

This document defines future Ship Builder validation behavior. Validation should
produce hard errors and warnings separately, use player-facing messages, and stay
deterministic from pure data: part definitions, part instances, sockets, and
metadata. Visual assets are not required for pure data validation.

## 1. Validation model

Validation output should have this shape:

```json
{
  "isValidForTestFlight": false,
  "errors": [],
  "warnings": [],
  "sourceBlueprintVersion": 1,
  "sourceCatalogVersion": "ship-parts-v0"
}
```

Each issue should include:

| Field | Purpose |
| --- | --- |
| `code` | Stable validation code for tests and UI mapping. |
| `severity` | `Error` or `Warning`. |
| `message` | Player-facing fallback text. |
| `instanceIds` | Affected part instances, when known. |
| `socketIds` | Affected sockets, when known. |
| `statName` | Affected stat, when relevant. |
| `blocking` | Whether test flight is blocked. |
| `suggestedFix` | Short action hint. |

Hard errors block test flight and active-ship selection. Warnings do not block
draft save. Warnings may allow test flight in the MVP unless a later game mode
promotes a warning to an error.

## 2. Validation passes

Validation should run in predictable phases:

1. Schema and reference integrity.
2. Numeric sanity.
3. Instance layout and grid snap.
4. Socket occupancy and connection graph.
5. Required functional systems.
6. Spatial overlap and bounds.
7. Functional socket completeness.
8. Control authority and handling warnings.
9. Cargo, docking, camera, mirror, and future integration checks.
10. Stat formula sanity.

The same input data must produce the same result every time.

## 3. Hard errors

### No cockpit/control core

Code: `MissingControlCore`

Rule: A flight-ready variant must include at least one enabled part with a
cockpit/control core component.

Message: `Missing cockpit: add one control core so the ship can be piloted.`

### No structural connection between required modules

Code: `RequiredModuleDisconnected`

Rule: Required modules must be connected to the main structural graph through
valid structural or hardpoint sockets, or through the MVP adjacency rule if the
implementation does not yet use sockets.

Message: `Disconnected module: <part> is not attached to the ship structure.`

### Hard overlap

Code: `HardOverlap`

Rule: Two enabled instances occupy the same physical space beyond the hard
overlap threshold. The MVP can use axis-aligned part bounds from definitions.

Suggested threshold: overlap volume greater than `75%` of the smaller part's
volume, or any overlap explicitly marked as blocking by metadata.

Message: `Parts overlap too much: <A> and <B> occupy the same space.`

### No main thrust for flight-ready variant

Code: `MissingMainThrust`

Rule: A flight-ready variant must include at least one enabled usable main
thruster with finite positive thrust and a valid nozzle direction.

Message: `Missing main thrust: add at least one usable main engine.`

### No fuel/power if required

Code: `MissingFuelOrPower`

Rule: If installed propulsion requires fuel or future power, the ship must have
compatible fuel/power capacity. For MVP fuel is the expected blocker when
thrusters consume fuel.

Message: `Missing fuel or power: add a module that can feed the installed systems.`

### Invalid socket occupancy

Code: `InvalidSocketOccupancy`

Rule: A socket cannot be occupied by multiple incompatible instances. A part
cannot attach to a socket whose type, direction, size, capacity, or compatible
category rules reject it.

Message: `Invalid socket: <part> cannot attach to <socket>.`

### Turret missing muzzle

Code: `TurretMissingMuzzle`

Rule: A turret/weapon component must have at least one valid muzzle socket. Moving
turrets also need required pivot sockets when configured as turreted weapons.

Message: `Weapon missing muzzle: <weapon> has no valid firing point.`

### RCS nozzle without direction

Code: `RcsNozzleMissingDirection`

Rule: Every RCS nozzle must have a finite non-zero local direction vector. No RCS
force may fall back to the part root or zero vector.

Message: `RCS nozzle missing direction: <part> cannot produce reliable control force.`

### Non-finite stats

Code: `NonFiniteStat`

Rule: Derived mass, thrust, acceleration, delta-v, COM, torque, fuel, cargo,
weapon, power, and heat values must be finite when their inputs exist.

Message: `Invalid stat: <stat> produced an unusable number.`

### Negative mass/capacity

Code: `NegativeMassOrCapacity`

Rule: Mass, fuel capacity, cargo capacity, cargo volume, thrust, fire rate, damage,
power capacity, and heat capacity cannot be negative.

Message: `Invalid part data: <part> has negative mass or capacity.`

## 4. Warnings

### No RCS on one axis

Code: `RcsAxisMissing`

Rule: No useful RCS translation or torque authority exists on one relevant axis.

Message: `Weak RCS authority: no useful control on <axis>.`

### Thrust vector offset from COM

Code: `ThrustOffsetFromCom`

Rule: Main thrust axis passes too far from the loaded center of mass.

Suggested MVP threshold: warn when lateral offset is greater than `0.35 m` or a
part-defined tolerance.

Message: `Off-center thrust: main engines will rotate the ship while burning.`

### Weak braking authority

Code: `WeakBrakingAuthority`

Rule: The ship has poor ability to slow down relative to its forward acceleration
or intended mass. MVP can estimate this from main thrust direction, reverse/RCS
authority, and total loaded mass.

Message: `Weak braking: this ship may take a long distance to stop.`

### Low fuel/delta-v

Code: `LowDeltaV`

Rule: Estimated delta-v or full-throttle burn time falls below the chosen MVP
threshold for test flight comfort.

Message: `Low fuel endurance: this ship may run out of propellant quickly.`

### Turret arc blocked

Code: `TurretArcBlocked`

Rule: A weapon arc or muzzle ray intersects part bounds or cargo volumes within
its intended firing arc.

Message: `Blocked turret arc: <weapon> cannot aim through part of the ship.`

### Exposed cargo/fuel

Code: `ExposedCargoOrFuel`

Rule: Cargo or fuel is carried externally or in metadata marked as exposed,
volatile, fragile, or poorly armored.

Message: `Exposed cargo or fuel: <part> is vulnerable to hits.`

### High mass/low acceleration

Code: `LowAcceleration`

Rule: Loaded acceleration is below the expected handling threshold.

Message: `Low acceleration: installed thrust is weak for the loaded mass.`

### No docking connector

Code: `MissingDockingConnector`

Rule: No enabled docking connector or compatible utility socket exists.

Message: `No docking connector: this ship cannot use docking actions yet.`

### No camera anchor

Code: `MissingCameraAnchor`

Rule: No valid camera anchor socket exists. The builder or flight camera can
fallback to bounds/COM, but should warn about framing quality.

Message: `No camera anchor: the flight camera may frame this ship poorly.`

### Asymmetry/mirror mismatch

Code: `MirrorMismatch`

Rule: A mirror group is incomplete, mismatched, disabled on one side, or contains
parts whose stats or sockets no longer match.

Message: `Mirror mismatch: mirrored parts are no longer symmetric.`

## 5. Socket validation

Every functional socket must have:

- local position
- local orientation
- socket type
- compatibility metadata
- direction vector where the type needs direction

Socket-specific requirements:

| Socket type | Validation requirement |
| --- | --- |
| `structural` | Must be finite and may connect structural graph. |
| `hardpoint` | Must define connector normal and compatible categories. |
| `mainThrusterNozzle` | Must define finite force or plume direction. |
| `rcsNozzle` | Must define finite non-zero force direction. |
| `turretBase` | Must support turret mount compatibility. |
| `turretYawPivot` | Must define yaw axis and arc metadata for moving turrets. |
| `turretPitchPivot` | Must define pitch axis and arc metadata for moving turrets. |
| `muzzle` | Must define barrel forward direction. |
| `muzzleFlash` | May be VFX-only but must not be at root unless root is correct. |
| `cargoAttach` | Must define capacity/volume compatibility when used. |
| `dockingConnector` | Must define connector size and approach axis. |
| `cameraAnchor` | Must define camera orientation/focus role. |
| `landingGear` future | Reserved; not MVP flight blocker. |
| `droneBay` future | Reserved; not MVP flight blocker. |

`VFX_` and `HELPER_` markers should be ignored for camera bounds when flagged.

## 6. Structural connection graph

Future socket-based validation should build an undirected graph:

- nodes are enabled part instances
- edges are valid structural/hardpoint/socket connections
- the root is the highest priority cockpit/control core or first structural core
- required systems must be reachable from the root

MVP adjacency fallback may use snapped bounds contact, but must be explicit and
testable. It must not treat arbitrary visual overlap as valid connection.

## 7. Spatial validation

Spatial checks use metadata dimensions or collider proxy bounds, not final art.

Rules:

- Hard overlap is an error.
- Soft overlap is a warning.
- Floating required modules are errors when connection is required.
- Decorative or future-only floating parts can be warnings if the ship can still
  spawn safely.
- Helper/VFX bounds do not count as physical overlap.

## 8. Required system validation

Flight-ready MVP requires:

- one cockpit/control core
- connected structure for required modules
- at least one usable main thruster
- fuel/power capacity if propulsion requires it
- at least one usable RCS cluster
- finite non-negative stats

Weapons, cargo, docking connectors, camera anchors, armor, sensors, landing gear,
and drone bays are not mandatory for MVP test flight unless a later mode demands
them.

## 9. Resource and cargo validation

Future resource/cost checks should reference resource IDs:

- part build costs reference `resourceId`
- cargo contents reference `resourceId`
- fuel/ammo can later become resources
- cargo capacity checks mass and volume

Missing resources should block construction in economy mode, not pure data
validation or debug test flight. Invalid resource IDs should be catalog errors.

## 10. Later EditMode tests

Future tests should cover:

- valid minimal ship
- missing cockpit
- disconnected module
- hard overlap
- invalid socket
- turret missing muzzle
- RCS direction coverage
- COM/thrust offset warning
- stat formulas
- serialization roundtrip
- mirror placement

Test fixtures should use metadata and primitives. Final Blender assets are not
required for the validator tests.
