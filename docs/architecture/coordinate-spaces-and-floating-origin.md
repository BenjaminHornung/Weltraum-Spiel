# Coordinate Spaces And Floating Origin

Stand: 2026-06-14
Status: Architecture concept for future coordinate conversion and floating-origin behavior, no implementation

## 1. Goal

This document defines the future coordinate spaces and floating-origin rules for Weltraum-Spiel. The aim is to keep large distances, local physics, HUD/map rendering, autopilot, surface sites and save/load compatible.

Design rule:

```text
Floating origin changes where Unity objects are drawn and simulated.
It must not change where anything truly is.
```

## 2. Coordinate Spaces

### Absolute System Coordinates

Purpose:

- durable world state,
- save/load,
- map and system navigation,
- background simulation,
- unloaded drones/outposts/sites/resources,
- future orbit and gravity planning.

Properties:

- high precision representation chosen later,
- stable across origin shifts,
- not tied to Unity scene root,
- can store large distances between bodies,
- can include absolute velocity.

Likely users:

- world state service,
- save system,
- system map,
- background simulation,
- future orbit planner,
- mission target registry.

### Current Local Physics Frame

Purpose:

- Unity `Transform` positions,
- Rigidbody simulation,
- active collision,
- camera,
- visible HUD/minimap markers,
- short-range autopilot execution.

Properties:

- small magnitude around the active focus,
- can be shifted by floating origin,
- not durable on its own,
- can be rebuilt from absolute state.

Likely users:

- player ship controller,
- Rigidbody components,
- active drones/enemies,
- local obstacles,
- camera systems,
- local route preview.

### Ship-Local Frame

Purpose:

- ship builder placement,
- modular part sockets,
- thruster directions,
- RCS nozzles,
- weapon muzzles,
- cargo ports,
- docking/entry points,
- maintenance/landing hardpoints.

Properties:

- `+Z` forward,
- `+Y` up,
- `+X` right,
- origin chosen by ship blueprint/runtime root,
- converted to current local physics frame by ship pose.

Likely users:

- ship builder,
- part import/binder,
- weapon computer,
- RCS allocator,
- cargo transfer,
- docking/landing systems.

### Planet-Centered Frame

Purpose:

- planet-relative positions,
- orbit/local conversion,
- surface projection,
- planet rotation,
- gravity/up direction,
- latitude/longitude/altitude or equivalent later.

Properties:

- anchored to a planet body,
- stable for surface site definitions,
- can map to absolute system coordinates,
- can define surface normals and tangent axes.

Likely users:

- planet model,
- surface site registry,
- future landing planner,
- orbital map,
- biome/resource placement.

### SurfaceLocalFrame

Purpose:

- first-person surface play,
- landed ship,
- outpost layout,
- resource nodes,
- surface drones,
- vehicles,
- caves or local sites.

Properties:

- has a planet/body reference,
- has an absolute or planet-centered anchor,
- has local tangent axes,
- has a local up vector,
- can be unloaded and reconstructed,
- can host a local physics bubble.

Likely users:

- first-person controller,
- surface scanner,
- local resources/mining,
- outposts,
- surface drones,
- cargo transfer,
- local surface hazards.

### Outpost Or Site Frame

Purpose:

- local authored/procedural layouts,
- landing pads,
- terminals,
- cargo ports,
- defense arcs,
- NPC/service positions,
- interior entrances.

Properties:

- child of a `SurfaceLocalFrame`,
- can have its own local origin,
- small enough for simple placement,
- maps service points to exact target descriptors.

Likely users:

- settlement/outpost service model,
- mission board,
- cargo transfer,
- scanner/map labels,
- landing permission logic.

### UI And Map Coordinates

Purpose:

- player-facing representation,
- labels,
- scale bars,
- route previews,
- risk overlays,
- scanner pings,
- map markers.

Properties:

- derived from underlying frame data,
- never authoritative for gameplay state,
- must show frame/scale-aware units,
- may simplify or cluster markers.

Likely users:

- ship HUD,
- map,
- minimap,
- scanner,
- suit HUD,
- debug views.

### Builder Coordinates

Purpose:

- part placement,
- grid snapping,
- socket validation,
- blueprint save data,
- test-flight spawn.

Properties:

- ship-local only,
- `0.5 m` snap grid,
- never system-scale,
- converted to runtime local physics only when spawning a ship.

Likely users:

- ship builder,
- part catalog,
- validation,
- test-flight system.

## 3. Frame Descriptor Contract

Future code should avoid passing a naked `Vector3` when crossing systems. Use a frame descriptor concept:

```text
FrameId
FrameType
ReferenceBodyId
OriginAbsolutePosition
Orientation
Scale/Units
ValidTime
```

Examples:

- `AbsoluteSystemFrame`
- `LocalPhysicsFrame: player-ship-focus`
- `PlanetCenteredFrame: tharos`
- `SurfaceLocalFrame: tharos-crater-mining-site-001`
- `ShipLocalFrame: player-ship-active`
- `OutpostSiteFrame: miners-rest-pad-a`

The exact runtime type can be decided later; the design requirement is that the frame exists as data.

## 4. Velocity Representation

Position conversion alone is not enough. Autopilot, docking, landing, collision, save/load and background simulation need velocity.

Velocity should be represented with:

- value,
- frame of reference,
- reference body where applicable,
- whether it is inertial, surface-relative, ship-relative or local-physics-relative.

Examples:

| Velocity type | Meaning |
| --- | --- |
| Absolute velocity | System-space motion for long-lived entities. |
| Planet-relative velocity | Motion relative to a planet body, useful for approach and landing. |
| Surface-relative velocity | Local motion relative to a rotating/anchored surface frame. |
| Ship-relative velocity | Docking, cargo transfer, boarding and turret targeting. |
| Local Rigidbody velocity | Unity physics value in the current local frame. |

Origin shifts should not create artificial velocity. If the local frame origin moves, every local Rigidbody should receive the correction consistently so relative motion is unchanged.

## 5. Floating Origin Trigger Rules

Future origin shifts may happen when:

- the player ship moves beyond a local magnitude threshold,
- the active camera focus moves too far from local origin,
- the player transitions from space to a surface frame,
- the player loads a save near a far-away body,
- a large local route would otherwise exceed precision comfort,
- an active surface site is unloaded and a new one is loaded.

Thresholds should be conservative and test-driven. The architecture should first prove invariants, then tune shift distances.

## 6. What Moves During A Shift

During a floating-origin shift, these local projections move:

- active GameObject roots,
- Rigidbody positions,
- active colliders,
- camera rig,
- local map/minimap geometry,
- route preview renderers,
- active particles/VFX that should remain visually attached,
- local target marker visuals,
- local labels and debug gizmos.

These do not change their durable truth:

- absolute entity position,
- absolute velocity,
- resource depletion,
- cargo ownership,
- drone mission state,
- outpost inventory,
- faction state,
- map discovery,
- save-game records.

The shift is a render/physics projection correction, not a gameplay event.

## 7. Shift Event Consumers

Systems that should receive explicit shift events later:

| Consumer | Reason |
| --- | --- |
| Rigidbody owners | Correct positions without changing relative motion. |
| Camera | Avoid snap/glitch and preserve framing. |
| HUD/minimap/map | Recompute marker positions from frame data. |
| Autopilot | Keep target, route samples and tracking error in the same local frame. |
| Obstacle detector | Refresh local obstacle positions. |
| Route preview renderers | Move drawn lines or regenerate from route samples. |
| Particle/VFX systems | Avoid detached exhaust, muzzle, dust or mining particles. |
| Audio emitters | Preserve relative sound placement. |
| Surface site manager | Keep local site children aligned. |
| Debug/evidence harnesses | Record shift count and invariant checks. |

Systems should not discover shifts by comparing raw positions after the fact.

## 8. Avoiding Visual And Physics Glitches

Risks:

- particle trails left behind,
- camera bounds recalculated from helper objects after shift,
- route preview line shifted twice,
- local target marker not shifted,
- Rigidbody interpolation smearing,
- sleeping bodies waking unexpectedly,
- UI labels using stale local distances,
- projectiles with previous-frame raycast positions crossing the shift incorrectly.

Mitigations:

- central shift event,
- stable shift order,
- suspend/resume particle trails where needed,
- recompute UI from frame-aware target descriptors,
- preserve Rigidbody velocity and angular velocity,
- update previous-frame positions used by sweep tests,
- keep camera focus semantic, not renderer-bounds driven,
- test before runtime feature adoption.

## 9. Autopilot Shift Rules

Autopilot should treat an origin shift as a coordinate projection update. It should not:

- reselect target just because local coordinates changed,
- reset phase without a real plan invalidation,
- mark arrival because the target marker moved,
- lose obstacle state if obstacles shifted consistently,
- alter fuel estimate because of origin correction alone.

It may reproject:

- target point,
- route samples,
- obstacle positions,
- tracking error,
- local velocity,
- debug/evidence metrics.

Any plan invalidation should name a real reason, such as target changed, obstacle changed, authority changed, cargo mass changed or state diverged, not "origin shifted".

## 10. Save/Load And Floating Origin

Save files should not store "current Unity origin" as gameplay truth. They should store:

- absolute positions,
- reference body/frame IDs,
- local frame identity if the player is inside one,
- local pose within that frame where useful,
- velocities with reference frame,
- cargo/jobs/depletion/ownership state.

On load:

1. Determine player context: space, orbit, landed surface, outpost, interior or drone.
2. Create the appropriate local physics frame.
3. Spawn active entities from absolute/state records.
4. Reconstruct local poses.
5. Rebind camera/HUD/autopilot/map to frame descriptors.

## 11. Testing Plan

Pure math tests:

- absolute-to-local conversion round trip,
- local-to-absolute conversion round trip,
- planet-centered to absolute conversion,
- surface tangent projection,
- velocity conversion,
- frame descriptor identity and invalid frame rejection.

Floating-origin tests:

- shift does not change absolute state,
- relative distance between two active bodies remains stable,
- Rigidbody velocity remains stable,
- target point local position shifts by the expected offset,
- route sample distances remain stable,
- camera target focus remains stable,
- projectile sweep previous position is corrected,
- UI distance labels remain unchanged except formatting.

Surface transition tests:

- ship lands into a surface frame,
- player exits into local surface position,
- drone spawn point maps to correct absolute/site state,
- outpost cargo port target resolves to exact point,
- leaving/reloading reconstructs the same site state.

## 12. Summary

Floating origin is safest when it is boring. The player should not feel it, autopilot should not panic about it, and save/load should not care whether it happened. The architecture achieves that by keeping absolute truth separate from local Unity projection and by requiring every cross-system coordinate to carry its frame.
