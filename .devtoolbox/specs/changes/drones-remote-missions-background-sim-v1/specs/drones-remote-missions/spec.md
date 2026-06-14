# Capability: Drones, Remote Missions And Background Simulation

## ADDED Requirements

### Requirement: Future drones support remote missions

The game shall support future deployable drones that can be assigned to remote missions from ship, outpost, surface or probe deployment contexts. Supported planned roles shall include scout, mining, hauler, combat/security, repair/utility and probe/survey drones.

#### Scenario: Player assigns a mining drone from the ship

- **WHEN** the player selects a drone, a known resource node and a ship cargo target from the ship computer
- **THEN** the game can create a remote mission record with assigned drone, target, objective, route, cargo plan, estimates, legal context and recall policy.

#### Scenario: Player assigns a scout or mining task on the surface

- **WHEN** the player scans a surface site and assigns a nearby or ship-based drone
- **THEN** the mission records the scanned target, required equipment, risk and destination without requiring a full ship UI.

### Requirement: Drone missions are represented as data state

Drone missions shall be represented as data state, not only Unity scene objects. A loaded drone object may visualize or physically execute a mission, but mission progress, cargo, risk, damage, owner/faction context and save/load continuity shall be stored in mission/drone data.

#### Scenario: Drone mission continues while scene is unloaded

- **WHEN** the player leaves the mission site and the drone GameObject is not loaded
- **THEN** the mission can continue through mission data and deterministic background ticks.

#### Scenario: Loaded drone reconciles back to mission data

- **WHEN** a visible drone unloads
- **THEN** its position, cargo, damage and mission progress are persisted to the authoritative mission state.

### Requirement: Loaded drones may use real physics

Loaded drones may use real physics, local steering, visible tools, connector interactions and combat effects when the player is nearby, watching, controlling or intervening.

#### Scenario: Player returns to an active drone site

- **WHEN** the player enters the local site of an active drone mission
- **THEN** the game may wake a real Unity drone object from mission data in the correct local frame.

### Requirement: Unloaded drones use deterministic simplified simulation

Unloaded drones shall use deterministic simplified simulation for travel time, resource extraction, cargo transfer, power/fuel/ammo consumption, damage/repair and risk/failure state. The simulation shall avoid ticking unloaded GameObjects.

#### Scenario: Background tick extracts resource

- **WHEN** an unloaded mining mission ticks for a fixed duration
- **THEN** resource node mass decreases, drone or destination cargo increases, and energy/tool consumption updates deterministically.

#### Scenario: Background tick does not instantiate scene objects

- **WHEN** a remote mission advances in an unloaded area
- **THEN** no terrain, drone, cargo or effect GameObject is required for the tick to complete.

### Requirement: Drone cargo uses shared resource/cargo model

Drone cargo shall use the shared resource/cargo model. Drone missions shall not create separate hidden reward counters or drone-specific resource identities.

#### Scenario: Mining cargo transfers to ship

- **WHEN** a drone transfers mined ore to ship cargo
- **THEN** the cargo uses the same resource id, mass and volume semantics as other ship/outpost cargo.

#### Scenario: Cargo plan blocks impossible extraction

- **WHEN** no valid cargo destination or capacity exists for expected output
- **THEN** the mission is blocked or suspended with a player-readable reason instead of creating invisible cargo.

### Requirement: Drone missions report progress, risk, failure and completion

Drone tasks shall report progress, risk, failure and completion to the player through status and notification rules. Failures shall include a cause and at least one player-relevant response when possible.

#### Scenario: Drone becomes threatened

- **WHEN** a remote drone mission detects a hostile patrol, legal inspection, storm, low energy or route blockage
- **THEN** the player receives an appropriate warning, distress message or log event according to notification policy.

#### Scenario: Mission completes

- **WHEN** a mission reaches its objective and resolves cargo/data/damage state
- **THEN** it enters Completed and reports the result to the player.

### Requirement: Drone mission state is save/load safe

Drone mission state shall be save/load safe. Mission ids, assigned drones, target references, route progress, cargo reservations, resource depletion, damage, legal context, pending notifications and last tick time shall be reconstructable without loaded scene objects.

#### Scenario: Save/load resumes a mission

- **WHEN** the game saves and loads while a drone mission is active
- **THEN** the mission resumes from data state without duplicating cargo, completion rewards or damage events.

### Requirement: V0 remains small and implementation-safe

V0 shall be possible without full pathfinding, full AI, full economy, combat/security drone implementation, remote camera/control or real ship-builder drone bay parts.

#### Scenario: V0 mining mission

- **WHEN** V0 is implemented later
- **THEN** it may use one scout/mining drone, one resource node, one ship cargo target, one remote mission state machine and one deterministic background tick test.

#### Scenario: V0 route estimate

- **WHEN** V0 needs travel behavior
- **THEN** it may use route legs and deterministic distance/time estimates instead of full surface pathfinding.

### Requirement: Drone missions integrate with world systems

Drone mission planning shall account for resource/cargo model, ship cargo capacity, outpost storage, faction legality, map discovery, autopilot target points, landing/pickup zones, ship-builder drone bay parts and resource economy.

#### Scenario: Legal mining context is visible

- **WHEN** a mission targets a faction-owned, protected, licensed, contested or unclaimed resource node
- **THEN** the mission stores and reports the owner/faction/legal context before extraction begins.

#### Scenario: Map discovery updates from scouting

- **WHEN** a scout or probe mission surveys terrain, outposts, hazards or resources
- **THEN** the mission can update discovery state without requiring the player to visit the site personally.
