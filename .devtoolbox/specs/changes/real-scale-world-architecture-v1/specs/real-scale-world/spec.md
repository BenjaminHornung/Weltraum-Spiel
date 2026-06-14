# Capability: Real-Scale World Architecture

## Capability

The project shall define a future real-scale world architecture that separates durable absolute simulation state from local Unity physics frames, supports planet surface local frames, preserves exact navigation target semantics, and keeps unloaded world activity data-driven.

## Requirements

### Requirement: Separate absolute and local coordinates

The game SHALL separate absolute simulation coordinates from local Unity physics coordinates.

Long-lived world state SHALL be representable without relying on Unity scene transforms as the source of truth.

#### Scenario: Entity is projected into local physics

- GIVEN a ship has durable absolute position and velocity
- WHEN the ship is loaded into the current local physics frame
- THEN the local Transform and Rigidbody state are derived from absolute state and frame data
- AND the absolute state remains the durable source for save/load and background simulation.

### Requirement: Stable absolute state for long-lived entities

All long-lived entities SHALL have stable absolute state or a stable reference to a frame that can be converted back to absolute state.

This includes ships, drones, landed vehicles, outposts, surface sites, resource nodes, deployed drills, cargo containers, mission targets and important wrecks or ruins.

#### Scenario: Surface resource node unloads

- GIVEN a resource node exists in a surface site
- WHEN the site unloads
- THEN the node keeps a durable state record with resource identity, remaining quantity, owner/claim, hazards and frame-relative or absolute position
- AND it does not depend on a loaded Unity GameObject to persist.

### Requirement: Explicit coordinate-frame data

Autopilot, map, HUD, scanner, drones, cargo transfer, save/load and surface systems SHALL consume explicit coordinate-frame data instead of implicit Transform assumptions.

#### Scenario: Map target becomes an autopilot target

- GIVEN the player selects a map marker for an outpost pad or landing zone
- WHEN the target is handed to navigation
- THEN the handoff includes target type, exact target point, coordinate frame, reference body and arrival constraints
- AND navigation does not infer the target frame from marker visuals alone.

### Requirement: Floating origin preserves gameplay state

Floating origin shifts SHALL NOT change gameplay state.

Origin shifts MAY move active Unity objects, cameras, renderers, particles, route visuals and local target markers, but they SHALL NOT change durable absolute positions, velocities, cargo, ownership, resource depletion, faction state or mission state.

#### Scenario: Origin shifts during flight

- GIVEN a ship, target point and obstacle are loaded in a local physics frame
- WHEN the floating origin shifts
- THEN relative distances and velocities remain stable
- AND absolute entity state remains unchanged except for normal simulation progress
- AND autopilot does not report completion, failure or target loss solely because the origin shifted.

### Requirement: Velocity has reference frame

Velocity used across world, local physics, planet approach, surface movement, docking, landing and save/load SHALL be represented with an explicit reference frame.

#### Scenario: Local frame changes

- GIVEN an active Rigidbody has local velocity
- WHEN the local frame origin changes
- THEN the system can preserve physical relative motion without creating artificial velocity
- AND any saved velocity remains interpretable after reload.

### Requirement: SurfaceLocalFrame support

`SurfaceLocalFrame` SHALL support player, ship, drones, resources, vehicles, hazards and outposts in a local physics bubble.

The frame SHALL define a planet/reference body, durable anchor, local origin, tangent axes, up direction, site radius and discovery/loading state.

#### Scenario: Player exits a landed ship

- GIVEN a ship is landed at a surface site
- WHEN the player exits the ship
- THEN the player appears in the same SurfaceLocalFrame as the landed ship
- AND ship entry point, cargo port, nearby resource nodes, drones and outpost targets resolve in that frame.

### Requirement: Surface targets resolve to exact points

Surface sites, landing zones, outposts and pickup areas SHALL resolve to exact target points before autopilot or drone navigation executes.

Completion SHALL be based on the selected target point and arrival constraints, not merely being inside a vague site radius.

#### Scenario: Landing zone selected from map

- GIVEN a landing zone covers a broad safe area
- WHEN the player starts an approach or autopilot route
- THEN the landing zone resolves to an exact approach or landing target point
- AND the UI can still explain the larger zone, safety, permission and risk context.

### Requirement: Physics bubble boundaries

The game SHALL distinguish active Unity Rigidbody simulation, simplified loaded local simulation, analytical simulation, background event simulation, frozen persistent state and regenerated presentation.

#### Scenario: Drone leaves active bubble

- GIVEN a mining drone is running a surface extraction mission
- WHEN the player leaves the site and the drone unloads
- THEN the drone mission continues through durable mission/job state
- AND it does not require active Rigidbody simulation or a loaded GameObject.

### Requirement: Background simulation does not rely on unloaded GameObjects

Background simulation SHALL NOT rely on unloaded Unity GameObjects.

Mining, drone jobs, outpost services, resource depletion, cargo transfer, faction alerts and mission timers SHALL be representable as deterministic state and events.

#### Scenario: Mining job resumes after save/load

- GIVEN a deployed drill has an active extraction job
- WHEN the game is saved, unloaded and loaded later
- THEN the job can resume or reconcile elapsed progress from saved data
- AND cargo is not duplicated
- AND the node depletion state remains consistent.

### Requirement: Autopilot boundaries remain layered

Local-space autopilot, large-local-range testing, future gravity/orbit planning, landing/approach planning and surface pickup navigation SHALL remain distinct layers with explicit handoff data.

Exact-arrival behavior SHALL remain a prerequisite for landing, pickup and cargo target semantics.

#### Scenario: Future orbital route reaches approach state

- GIVEN a future gravity/orbit planner computes a transfer toward a planet
- WHEN the route reaches local approach
- THEN final landing or pickup still resolves through a local exact target point and local arrival gates
- AND the orbital planner is not treated as proof of surface point arrival.

### Requirement: Save/load reconstructs context

Save/load SHALL store enough absolute and frame-relative data to reconstruct the player's context near ships, planets, outposts, surface sites, drones and active jobs.

#### Scenario: Load mid-expedition

- GIVEN the player saved while on foot near a landed ship and active drone
- WHEN the save is loaded
- THEN the appropriate SurfaceLocalFrame is reconstructed
- AND the player, ship, drone, cargo, resource nodes and active jobs resume in coherent positions and states.

### Requirement: Core tests precede full planet implementation

Tests SHALL prove coordinate conversion and origin-shift invariants before full planet implementation depends on them.

Core math tests SHALL NOT require Unity scene dependencies.

#### Scenario: Coordinate conversion test

- GIVEN a position is converted from absolute coordinates to a local frame and back
- WHEN the round trip completes
- THEN the result remains within an explicit tolerance
- AND the test does not require a Unity scene, prefab or terrain asset.

### Requirement: Implementation can be sliced safely

V0 architecture work SHALL be implementable as documentation and later isolated test slices before terrain streaming, full orbital mechanics, seamless landing, procedural planet surfaces or first-person planet content depend on it.

#### Scenario: First implementation phase starts

- GIVEN the architecture package is approved
- WHEN implementation begins later
- THEN the first runtime slice can start with coordinate math and state tests
- AND it does not require scenes, assets, ship-builder runtime changes, autopilot harness changes or full planet integration.
