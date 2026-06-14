# Surface Local Frame Architecture

Stand: 2026-06-14
Status: Architecture concept for future planet surface local frames, no implementation

## 1. Goal

`SurfaceLocalFrame` is the future bridge between planet-scale simulation and first-person surface play. It lets a landed ship, player, drones, resources, outposts, hazards and cargo transfer share a small, precise local world while remaining anchored to the real planet/system state.

Design rule:

```text
A planet surface site is not just terrain.
It is a frame, a set of exact targets, and persistent gameplay state.
```

## 2. Why SurfaceLocalFrame Exists

Without a named surface frame, several systems would invent their own local coordinates:

- first-person controller,
- landed ship,
- outpost layout,
- resource nodes,
- drone mining,
- landing pads,
- cargo ports,
- scanner pings,
- mission markers,
- future terrain chunks.

That would cause bugs around landing, pickup, save/load, cargo transfer, drone pathing and map target handoff.

`SurfaceLocalFrame` gives them one shared local context.

## 3. Frame Definition

A future `SurfaceLocalFrame` descriptor should include:

| Field | Purpose |
| --- | --- |
| `surfaceFrameId` | Stable ID for save/load, map and background jobs. |
| `planetId` | Reference body that owns the surface. |
| `anchorAbsolutePosition` | Durable anchor in system coordinates. |
| `anchorPlanetPosition` | Planet-centered surface anchor, such as lat/lon/alt or equivalent. |
| `localOrigin` | Local physics origin for the active site projection. |
| `upAxis` | Surface normal or local gravity up. |
| `forwardAxis` | Tangent direction, usually north or site-defined approach direction. |
| `rightAxis` | Tangent axis completing the frame. |
| `radiusMeters` | Approximate local playable/loaded area. |
| `siteType` | Resource field, outpost, cave, landing zone, wreck, camp, etc. |
| `loadedState` | Loaded, unloaded, background-simulated or dormant. |
| `discoveryState` | Unknown, detected, surveyed, visited, depleted, secured, contested, restricted. |

The exact math representation can change later, but these concepts must exist.

## 4. Axes And Orientation

Suggested convention:

- local `+Y` = surface up,
- local `+Z` = frame forward along tangent,
- local `+X` = frame right along tangent.

This matches the ship-builder preference that `+Z` is forward and `+Y` is up while making "up" planet-surface aware.

Important distinction:

- ship-local `+Y` is the ship's local up,
- surface-frame `+Y` is terrain/surface up,
- gravity direction is usually `-Y` in the surface frame,
- landed ship orientation is a pose within the surface frame, not the frame itself.

## 5. Planet Surface Mapping

A surface position should be convertible:

```text
SurfaceLocalFrame local position
-> planet-centered position
-> absolute system position
```

And back:

```text
Absolute system position
-> planet-centered position
-> nearest/selected SurfaceLocalFrame local position
```

For small sites, a tangent-plane approximation is enough. For large sites or long rover routes, the system may need chunked frames or periodic re-anchoring later. V0 should stay small enough that a single frame is believable.

## 6. Surface Site Types

| Site type | Surface frame role |
| --- | --- |
| Resource field | Holds nodes, drills, cargo pickup points, hazards and claim ownership. |
| Landing zone | Resolves safe area into exact landing/approach target points. |
| Outpost | Hosts pads, service terminals, cargo ports, storage and defense arcs. |
| Wreck | Hosts salvage points, interior entrance, hazard state and black box target. |
| Cave | Hosts entrance, interior transition point, local hazards and drone signal rules. |
| Hostile camp | Hosts patrol paths, cover, turrets, alarm and loot containers. |
| Scientific anomaly | Hosts scanner target, sample points, danger radius and research state. |
| Weather zone | Hosts hazard boundary, timing windows and special resource exposure. |

Every site can be a broad activity area, but navigation should use exact target points inside it.

## 7. Landing Zones And Exact Targets

Surface navigation needs a taxonomy:

| Concept | Meaning |
| --- | --- |
| `SurfaceSite` | Broad activity area such as a resource field or outpost. |
| `LandingZone` | Evaluated safe or permitted area where landing may be possible. |
| `ApproachTargetPoint` | Exact point used for approach alignment or holding. |
| `LandingTargetPoint` | Exact point selected for final touchdown or hover stop. |
| `PickupTargetPoint` | Exact point for player, drone, cargo or vehicle retrieval. |
| `CargoPortTargetPoint` | Exact point for transfer alignment. |
| `OutpostPadTargetPoint` | Exact point within a settlement pad service. |

Autopilot should never complete merely because the ship is somewhere inside a broad zone. Zone selection must resolve to exact target points plus arrival envelopes.

## 8. Landed Ship Rules

When a ship lands at a surface site:

- ship absolute state remains durable,
- landed pose is stored relative to the surface frame,
- ship-local entry/exit/cargo/maintenance sockets are converted into surface local target points,
- ship cargo mass remains part of ship state,
- ship can be the surface expedition anchor,
- ship can be unloaded into data state when the player leaves the site.

The landing state should distinguish:

- landed on rough terrain,
- landed on permitted pad,
- docked/locked to outpost service,
- parked near site,
- unsafe landing,
- impounded/disabled/damaged.

## 9. Player Rules

The first-person player on a planet surface should exist inside a `SurfaceLocalFrame`.

The player state should include:

- local surface pose,
- suit state,
- inventory container,
- active tool/weapon/scanner,
- current frame ID,
- return ship or pickup target,
- save/checkpoint context.

If the player loads a save mid-expedition, the frame must be reconstructable from durable site and player state.

## 10. Drone And Vehicle Rules

Surface drones and vehicles should also be frame-aware.

Loaded drones:

- use local surface positions,
- path to nodes, cargo ports, player, ship or outpost targets,
- may use simplified local physics or controller logic,
- report cargo and mission state.

Unloaded drones:

- keep absolute or site-relative state,
- run mission steps through background simulation,
- do not require active GameObjects,
- emit events such as `CargoFull`, `DroneThreatened`, `LostLink`, `ExtractionComplete`.

Vehicle rules can start simple: a vehicle is a cargo/power/mobility object in the surface frame, not a separate world authority.

## 11. Resources And Mining Persistence

Resource nodes should be stored as site data:

```text
nodeId
surfaceFrameId
localPosition
resourceOutputs
remainingQuantity
grade
owner/claim
hazards
depletionState
activeExtractionJobs
```

When loaded, nodes can have colliders, visuals and scanner targets. When unloaded, they are data records. Mining jobs update depletion and cargo through deterministic events, not hidden running GameObjects.

## 12. Outposts And Local Site Frames

An outpost can be a child site frame or a structured layout inside the surface frame.

Outpost data should include:

- owner/faction,
- service points,
- landing pads,
- cargo ports,
- storage containers,
- defense arcs,
- restricted zones,
- scanner/map appearance,
- mission/service state,
- persistent damage/repair state.

Outpost service points should expose exact target descriptors:

```text
Pad A landing point
Cargo port 1 transfer point
Terminal interaction point
Fuel hose alignment point
Drone parking point
Restricted door point
```

## 13. Surface Scanner And Map Integration

Scanner/map should show discovery layers:

- unknown signal,
- detected site,
- identified owner,
- hazard known,
- landing zone evaluated,
- exact target selectable,
- services known,
- restricted/hostile state known,
- depleted/secured/contested state.

Scanner confidence matters. A rough orbital signal may reveal a site, while suit scan resolves exact node position, composition, legality and hazard.

## 14. Leaving The Surface Frame

When the player leaves:

- player returns to ship, drone, vehicle, outpost interior or another frame,
- cargo transfers are finalized,
- active mining/drone jobs are converted to background jobs,
- resource depletion and containers are saved,
- outpost state is persisted,
- local GameObjects can be unloaded,
- absolute state remains valid.

Leaving should not delete local decisions. A depleted node, parked cargo crate, damaged drone or disabled turret should still be known when returning.

## 15. Future Large Sites

Some future sites may be too large for one tangent frame:

- long rover routes,
- large settlements,
- mountain/canyon biomes,
- cave networks,
- surface convoys,
- multi-kilometer resource belts.

Future options:

- neighboring `SurfaceLocalFrame` chunks,
- site subframes,
- streaming cells,
- re-anchored tangent frames,
- analytic far-distance representation for map/drones.

V0 should avoid needing these by keeping the surface test range small.

## 16. Testing Plan

Tests should prove:

- surface frame axes are orthonormal,
- local up matches planet surface normal within tolerance,
- local-to-planet-to-local round trip is stable,
- landing target resolves to exact point,
- ship exit socket maps to safe surface point,
- cargo port target maps correctly,
- resource node local position persists through unload/reload,
- drone mission target persists while unloaded,
- player save/load reconstructs the same surface context.

## 17. Summary

`SurfaceLocalFrame` is the safety rail for planet gameplay. It lets the game support precise local interaction without lying about real-scale position. The ship, player, drones, resources and outposts can all share one surface truth while still feeding back into absolute world state.
