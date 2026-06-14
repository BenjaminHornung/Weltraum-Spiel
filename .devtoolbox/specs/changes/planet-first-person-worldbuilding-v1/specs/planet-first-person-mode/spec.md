# Capability: Planet First-Person Mode

## Capability

The project shall define a future first-person on-planet gameplay layer that reinforces Weltraum-Spiel's ship, drone, resource, autopilot, faction, economy and ship builder loops.

## Requirements

### Requirement: Future first-person on-planet mode

The game SHALL support a future first-person on-planet mode.

The mode SHALL let the player leave a ship, dropship, drone/vehicle context or settlement entry point and act directly on a planet surface or local surface site.

#### Scenario: Player starts a surface expedition

- GIVEN the player has reached a valid landing or surface arrival point
- WHEN the player exits the ship or arrival vehicle
- THEN the game presents a first-person surface mode
- AND the player can scan, interact, move, manage suit state and return to the ship or pickup point.

### Requirement: Reinforce ship gameplay

The first-person mode SHALL NOT replace ship gameplay.

Surface activities SHALL produce outcomes that matter to ships, drones, navigation, cargo, fuel, weapons, economy, factions, exploration or ship building.

#### Scenario: Surface action returns to the space loop

- GIVEN the player mines, salvages, trades, scans or completes a surface objective
- WHEN the objective is completed
- THEN the result is represented as cargo, data, reputation, repair, fuel, ammo, upgrade progress, map discovery or mission progress
- AND the ship/drones/autopilot layer can use or respond to that result.

### Requirement: Ship cargo and resource integration

The first-person mode SHALL integrate with ship cargo/resource systems.

Resources collected on foot SHALL be transferable to suit, drone, vehicle, outpost or ship cargo according to mass, volume, ownership and containment constraints.

#### Scenario: Player transfers mined ore to ship cargo

- GIVEN the player has mined a resource node into suit inventory
- WHEN the player transfers that resource at a ship cargo point
- THEN suit inventory decreases
- AND ship cargo increases
- AND the transferred resource keeps type, quantity, mass/volume and legal/ownership state.

### Requirement: Resource node definitions

Resource nodes SHALL define detection, extraction, mass/volume and use cases.

Resource nodes SHALL also define tool requirement, risk/hazard, ownership/legal state where relevant, economy value and progression role.

#### Scenario: Scanner inspects resource node

- GIVEN the player scans a resource node
- WHEN the node is within scanner capability
- THEN the UI can show resource type, detection confidence, extraction method, required tool tier, risk, mass/volume implication, use case and ownership state where known.

### Requirement: Mining methods and constraints

Mining SHALL support multiple future methods including hand tool mining, deployable drills, drone mining, vehicle mining, ship-mounted surface extraction and future deep-core mining.

Each method SHALL have constraints such as extraction time, signature, power use, durability, cargo capacity, environmental danger or legal/faction ownership.

#### Scenario: Extraction method changes risk

- GIVEN a resource node can be extracted by hand tool or ship-mounted extractor
- WHEN the player chooses ship-mounted extraction
- THEN extraction can be faster or higher volume
- AND it can create higher noise, heat, legal risk, collateral risk or landing requirement than hand mining.

### Requirement: Weapons have role and resource constraints

Weapons SHALL have resource, ammo, heat, role, signature and environment constraints.

Weapon definitions SHALL describe role, range, ammo/resource cost, recoil, sound/signature, damage type, armor interaction, environmental risk, crafting/upgrading resources and relation to ship weapon technology.

#### Scenario: Weapon choice matters by environment

- GIVEN the player enters a cave, outpost, wreck or open surface site
- WHEN the player selects a weapon
- THEN weapon usefulness depends on range, damage type, recoil, signature, ammo/heat cost, collateral risk and enemy armor
- AND heavy weapons can create legal, environmental or resource consequences.

### Requirement: Surface combat is dangerous but bounded

On-foot combat SHALL be dangerous compared with ship combat.

The game SHALL provide reasons why ship weapons, turrets and ship fire support cannot trivially solve every planet problem.

#### Scenario: Ship weapons are not the universal answer

- GIVEN a threat is inside a cave, settlement, protected biome, wreck interior or restricted outpost
- WHEN the player considers ship fire support
- THEN the game can block or discourage it through line of sight, collateral, legal consequences, terrain, fragile objectives, defense systems or unsafe landing geometry.

### Requirement: Factions connect worldbuilding to play

Factions SHALL connect worldbuilding to missions, economy and locations.

Each faction SHALL define motivation, visual identity, resources they value, ships/equipment style, relation to player, mission types, hostility/friendliness and locations they create.

#### Scenario: Faction ownership affects a site

- GIVEN a resource field or outpost has faction ownership
- WHEN the player scans or enters the site
- THEN the game can show owner, access state, likely services or restrictions
- AND player actions can affect reputation, legality, prices, hostility or mission availability.

### Requirement: Economy hooks

The future economy SHALL include hooks for resource supply/demand, ship parts market, fuel/ammo market, mining licenses, illegal mining, faction reputation, salvage legality, black market and repair/refit costs.

#### Scenario: Resource value depends on context

- GIVEN the player carries fuel volatiles, ore, salvage, bio samples or exotics
- WHEN the player visits different outposts or factions
- THEN value and legality can vary by local demand, faction policy, license state, scarcity, black-market access and reputation.

### Requirement: Planetary activities

Planetary exploration SHALL support activity types such as resource fields, caves, wrecks, abandoned stations, active outposts, hostile camps, scientific anomalies, crashed ships, underground facilities, weather-danger zones and rare landmark biomes.

Each activity type SHALL define player objective, required tools, likely enemies/hazards, resources/rewards, ship/drones connection, repeatability and procedural versus hand-authored suitability.

#### Scenario: Activity has a complete loop

- GIVEN the player discovers a planetary activity
- WHEN the player accepts or approaches it
- THEN the activity provides objective, tool expectations, risk, reward and return path to ship, drone, outpost cargo or map state.

### Requirement: Outpost interactions

Planetary settlements and outposts SHALL define layout needs, landing/docking relationship, NPC/vendor/mission role, storage/cargo transfer, defense systems, faction ownership, scanner/map appearance and a low-complexity V0 interaction path.

#### Scenario: Player uses a simple outpost

- GIVEN the player lands near a small outpost
- WHEN the player approaches the terminal or cargo point
- THEN the game can show owner, services, storage/transfer options, simple mission or trade action, and restrictions without requiring full RPG dialogue.

### Requirement: Singleplayer-compatible simulation

The first-person mode SHALL remain singleplayer-compatible.

The mode SHALL define what is simulated when the player is not nearby, including resource depletion, deployed drones/drills, cargo containers, outpost inventory, faction alerts, mission state and major hazards.

#### Scenario: Player leaves a deployed drill

- GIVEN the player deploys a drill or drone at a resource node and leaves the local area
- WHEN the area unloads
- THEN the game can continue the operation through data/event simulation
- AND it does not need to simulate unloaded per-frame Unity physics for every visual object.

### Requirement: V0 isolated test slice

V0 SHALL be implementable as an isolated test slice before full planet integration.

The first playable version SHOULD include a landed ship, exit/entry, first-person controller, suit HUD placeholder, scanner, one resource node, hand mining tool, suit inventory, ship cargo transfer and return-to-ship completion.

#### Scenario: First playable surface loop

- GIVEN an isolated surface test range with a landed ship and one resource node
- WHEN the player exits, scans, mines, transfers cargo and re-enters the ship
- THEN the prototype proves the full minimum surface loop without requiring full planet terrain, economy, factions, procedural placement or orbital landing integration.

### Requirement: Future scope stays explicit

The design SHALL keep future scope explicit so early implementation does not expand into full terrain streaming, deep-core mining, faction war, full RPG NPC systems, base building, procedural ecology, multiplayer raids or gravity/orbit/landing integration before the isolated loop is proven.

#### Scenario: Future feature is requested during V0

- GIVEN a feature belongs to explicit future scope
- WHEN V0 implementation planning is performed
- THEN the feature remains deferred unless a separate approved change defines its scope, files and verification.
