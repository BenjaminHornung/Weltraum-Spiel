# Real-Scale World Architecture

Stand: 2026-06-14
Status: Architecture concept for future large-scale world handling, no implementation
Scope: Space-scale coordinates, local physics bubbles, surface sites, landing targets, drones, outposts, save/load and background simulation boundaries.

## 1. Goal

Weltraum-Spiel will eventually need ships, planets, stations, outposts, drones, resource sites, surface play and large travel distances to exist in one coherent simulation. Unity scene transforms cannot be the only truth for that world. They are useful for the active local bubble, but they are not stable enough for system-scale positions, unloaded entities, save/load, map markers, surface jobs or long-distance autopilot.

Design rule:

```text
Absolute simulation state is durable truth.
Unity local transforms are the current playable projection.
```

This document defines the architecture target so future implementation slices do not accidentally build incompatible coordinate, physics, cargo, drone or surface systems.

## 2. Non-Goals

This package does not implement:

- runtime code,
- Unity scenes,
- terrain streaming,
- planet generation,
- orbital mechanics,
- floating origin runtime behavior,
- save/load code,
- drone AI,
- outpost UI,
- ship builder runtime changes,
- autopilot harness changes.

It defines contracts and boundaries for later slices.

## 3. Core Principles

| Principle | Meaning |
| --- | --- |
| Absolute first | Long-lived entities keep stable absolute position, velocity and ownership data even when unloaded. |
| Local physics only where needed | Unity Rigidbody simulation runs inside the active local physics bubble, not across the whole star system. |
| Frame explicitness | Autopilot, map, HUD, drones and surface systems pass explicit coordinate-frame data, not implicit Transform guesses. |
| Exact target semantics | A site or zone can be broad, but any autopilot execution target resolves to an exact point plus arrival gates. |
| Shifts are invisible to gameplay | Floating origin shifts may move Unity objects, but they must not change gameplay state. |
| Surface frames are first-class | Planet surface sites use a named `SurfaceLocalFrame` with tangent axes, up direction and absolute anchor. |
| Unloaded work is data simulation | Drones, drills, mining, outposts and faction events continue through deterministic state, not hidden GameObjects. |
| Small slices first | Core math and frame conversion tests should exist before terrain, landing, orbit or surface content depend on them. |

## 4. Coordinate Space Overview

| Space | Durable? | Used by | Purpose |
| --- | --- | --- | --- |
| Absolute system coordinates | Yes | Save/load, map, background simulation, long-range navigation | Stable positions and velocities for stars, planets, ships, drones, sites and outposts. |
| Current local physics frame | No | Unity Rigidbody, camera, active ship, nearby targets | Small coordinate range where Unity physics and rendering stay precise. |
| Ship-local frame | Derived | Ship builder, weapons, thrusters, cargo ports, docking points | Part sockets, force directions, COM, turret arcs and actor entry points. |
| Planet-centered frame | Yes for planet-relative data | Planet model, orbit/local conversion, surface projection | Position relative to planet center and rotation for sites, orbits and surface points. |
| SurfaceLocalFrame | Yes as descriptor, local as projection | First-person surface mode, landed ships, drones, resources, outposts | Tangent local site coordinates for walking, mining, cargo transfer and surface encounters. |
| Outpost/local site frame | Yes as child of surface frame | Outpost layout, pads, terminals, cargo ports | Small authored/procedural site layout with local service points. |
| UI/map coordinates | Derived | HUD, scanner, map, minimap, route preview | Display projection of absolute/local targets with labels, scale and risk. |
| Builder/local part coordinates | Derived | Ship builder, import validation, part metadata | Modular part placement and sockets using `+Z` forward, `+Y` up, `+X` right. |

No gameplay system should infer which space it is in from a `Transform` alone.

## 5. Ownership Of Truth

### Absolute Entity State

Every long-lived entity should eventually have an absolute state record:

```text
EntityId
EntityType
AbsolutePosition
AbsoluteVelocity
ReferenceBodyId
OrientationState
LoadedState
FrameBinding
Owner/Faction
Cargo/Job/Persistence refs
```

This applies to:

- player ship,
- other ships,
- drones,
- landed vehicles,
- outposts,
- surface sites,
- resource nodes,
- cargo containers,
- deployed drills,
- mission targets,
- navigation beacons,
- important wrecks or ruins.

Visual debris, particle effects, temporary projectiles and small local-only props do not need long-lived absolute state unless they become gameplay objects.

### Unity Local State

Unity `Transform` and `Rigidbody` state are the active projection of the absolute state into the current local physics frame. They answer:

- where the object appears right now,
- what Unity physics simulates this frame,
- what the camera and HUD can render,
- which colliders and sensors are active.

They are not the save-game truth for real-scale position.

### Conversion Boundary

Systems should convert through a named frame service later:

```text
AbsoluteState -> LocalPhysicsPose
LocalPhysicsPose -> AbsoluteState delta
PlanetCenteredPosition -> SurfaceLocalFrame position
SurfaceLocalFrame position -> Absolute target point
ShipLocalSocket -> World/local target point
```

Any system that crosses frames should receive both:

- the numeric value,
- the frame descriptor that defines what the value means.

## 6. Local Physics Bubble

The current playable bubble contains the active high-fidelity simulation. In a space-flight context it may include:

- the player ship,
- selected target,
- nearby obstacles,
- nearby drones,
- docking target,
- weapons/projectiles in range,
- short-range autopilot route samples,
- camera, HUD and local map markers.

In a surface context it may include:

- player body,
- landed ship,
- surface vehicle,
- active drones,
- resource nodes,
- outpost geometry,
- enemies,
- local hazards,
- cargo containers.

Objects outside the bubble should not keep active Rigidbody simulation unless a specific local encounter is loaded for them.

## 7. Frame Handoff Scenarios

### Space Flight

1. Ship has absolute state in system coordinates.
2. Current local physics frame is anchored near the ship or selected focus.
3. Ship Rigidbody receives local pose and velocity.
4. Autopilot plans against explicit local target descriptors.
5. On simulation step or origin shift, absolute state is updated from local motion.

### Approach To Planet

1. Planet has absolute body state and planet-centered frame.
2. Map target resolves to surface site, landing zone or outpost pad.
3. Landing zone resolves to exact approach/landing target points.
4. Future gravity/orbit planner operates on absolute/planet-centered data.
5. Final local approach uses a local frame with explicit conversion.

### Landed Surface Mode

1. A `SurfaceLocalFrame` is created or loaded for the site.
2. Landed ship pose is represented in that surface frame.
3. Player exits into first-person local coordinates.
4. Drones, resources, outpost cargo ports and hazards share the same surface frame.
5. When leaving, durable state is written back to absolute/site records.

### Ship Builder

1. Builder uses ship-local part coordinates, not world coordinates.
2. Part sockets and hardpoints use the catalog convention `+Z` forward, `+Y` up, `+X` right.
3. Built ship metadata produces mass, COM, cargo and authority values.
4. Runtime spawn converts ship-local sockets into the active local physics frame.

## 8. Autopilot Integration Boundary

Current waypoint autopilot is local-space guidance. It should remain honest and bounded:

- It consumes local target data.
- It reports ETA, fuel, risk, authority and exact-arrival state.
- It completes only on precise point arrival with velocity/attitude gates.
- It says why it cannot complete if ship authority is insufficient.

Future large-world navigation should add layers rather than blur responsibilities:

| Layer | Scope | Completion target |
| --- | --- | --- |
| Local-space autopilot | Nearby target, obstacle avoidance, exact arrival | Exact local target point |
| Large local range | 1 km to 10 km local tests and UI readability | Exact local target point |
| Gravity/orbit planner | Planet/system-scale transfer | Maneuver or approach state, not final landing by itself |
| Landing/approach planner | Planet surface approach and pad selection | Exact landing/approach target point |
| Surface pickup/return | Player, drone, cargo or vehicle rendezvous | Exact pickup/cargo/ship point |

Exact-arrival work remains a prerequisite because landing zones and pickup targets must not become "close enough" loopholes.

## 9. Save And Load Shape

Save data should store:

- absolute position and velocity for long-lived entities,
- reference body or frame binding,
- orientation or landed/site pose,
- current local frame identity if the player is loaded inside one,
- cargo containers and resource stacks,
- resource node depletion,
- drone mission state,
- outpost owner/services/storage state,
- active jobs and background simulation clocks,
- map discovery and target descriptors.

Save data should not depend on:

- Unity instance IDs,
- current Transform hierarchy positions as absolute truth,
- active particle state,
- loaded-only physics bodies,
- temporary route preview geometry.

Resuming near a planet or outpost should reconstruct the appropriate local frame from saved absolute/site state, then spawn local GameObjects into that frame.

## 10. Testing Strategy

Core frame behavior should be testable without Unity scene dependencies.

Recommended test groups:

- pure math coordinate conversion tests,
- absolute-to-local and local-to-absolute round trips,
- velocity conversion across frame changes,
- floating origin shift invariants,
- planet-centered to surface tangent projection,
- SurfaceLocalFrame spawn tests,
- ship/player/drone state handoff tests,
- background simulation deterministic tick tests,
- save/load reconstruction tests for active and unloaded entities.

Unity scene tests can come later for camera, Rigidbody, HUD and surface integration, but the math contracts should be proven first.

## 11. Recommended Implementation Slices

1. Coordinate math library.
2. Absolute entity state records.
3. Floating-origin test harness.
4. SurfaceLocalFrame prototype.
5. Ship/player/drone handoff.
6. Background simulation tick.
7. Large map/orbit integration.

Each slice should have independent evidence before the next layer depends on it.

## 12. Summary

Real-scale world handling is not mainly about bigger numbers. It is about stable ownership of truth. Absolute state persists the world, local frames make Unity playable, surface frames make planets usable, and background simulation keeps unloaded work honest. If those contracts are explicit, ships, drones, mining, outposts, autopilot and ship building can grow together instead of fighting over coordinate assumptions.
