# Capability: Resource Cargo Inventory

## Purpose

Define a future unified resource, cargo and inventory data model that can be used by planet mining, suit inventory, ship cargo, drones, outposts, modular ship-builder parts, fuel, ammo, repairs, mission cargo, faction ownership and economy.

This capability is planning-only in this change.

## Requirements

### Requirement: Shared Resource Identity

The game shall use one shared resource identity model across mining, inventory, cargo, fuel, ammo, repairs, ship-builder costs, missions, economy and faction systems.

Each resource identity shall include at least:

- stable resource ID,
- display name,
- category,
- mass per unit,
- volume per unit,
- stack rules,
- rarity or tier,
- tags,
- legal or illegal ownership implications,
- base value.

#### Scenario: Builder and economy reference the same resource

- Given a resource with ID `material_structural_plate`
- When a ship-builder part cost and an outpost price table need that material
- Then both shall reference `material_structural_plate`
- And neither shall rely on a display string such as `Structural Plate`

#### Scenario: Mining node emits catalog resources

- Given a mining node with a resource reservoir
- When extraction produces output
- Then the output shall be resource IDs and quantities from the shared catalog

### Requirement: Container Capacity Constraints

Containers shall enforce mass, volume and capacity constraints using shared rules.

Containers shall include at least:

- suit inventory,
- ship cargo,
- drone cargo,
- outpost storage,
- cargo module internal volume,
- external cargo rack,
- mission cargo,
- mining node reservoir.

#### Scenario: Suit inventory rejects bulk overload

- Given the suit inventory has lower mass and volume limits than ship cargo
- When the player attempts to add bulk ore beyond the suit capacity
- Then the transfer shall be rejected or partially accepted according to explicit transfer rules
- And the rejection reason shall include mass or volume capacity

#### Scenario: Ship cargo exposes loaded mass

- Given ship cargo contains resource stacks
- When ship systems request aggregate cargo mass
- Then the cargo model shall provide cargo mass without exposing unrelated inventory details

### Requirement: Explicit Transfers

Transfers shall be explicit, testable operations between source and target containers.

Transfers shall cover at least:

- suit to ship,
- ship to outpost,
- drone to ship,
- node to suit,
- node to drone,
- node to ship.

Transfer results shall report accepted quantity, rejected quantity, capacity deltas and rejection reasons.

#### Scenario: Suit to ship transfer succeeds

- Given the player has a resource stack in suit inventory
- And the ship cargo has enough remaining mass and volume capacity
- When the player transfers the stack to ship cargo
- Then the resource stack shall move to ship cargo
- And ownership and mission metadata shall be preserved
- And ship cargo mass shall update

#### Scenario: Drone to ship partial transfer

- Given a drone carries more ore than the ship cargo can currently accept
- When partial transfer is allowed
- Then the transfer shall move only the accepted quantity
- And the result shall report remaining cargo still held by the drone

#### Scenario: Node output target is full

- Given a mining node is producing a resource
- And the selected output container is full
- When extraction attempts to deposit output
- Then extraction shall pause, reject, spill, or keep material in the node according to method-specific rules
- And the result shall not silently delete resources

### Requirement: Mission And Ownership Restrictions

The model shall represent mission cargo, ownership, faction permission and legal restrictions as data on resource stacks, containers or transfer context.

#### Scenario: Mission cargo cannot be sold normally

- Given a sealed mission crate is stored in ship cargo
- When the player attempts to sell it at a normal market
- Then the economy system shall reject the sale
- And the rejection reason shall indicate mission cargo restrictions

#### Scenario: Faction-owned salvage keeps ownership state

- Given a stack of salvage electronics belongs to a faction claim
- When the player transfers it from suit inventory to ship cargo
- Then the ownership metadata shall be preserved
- And later faction or economy systems shall be able to inspect that state

### Requirement: Shared Resource Uses

The resource model shall support resource use cases for fuel, ammo, repairs, ship-builder part construction, turret and weapon upgrades, RCS/thruster upgrades, research samples, trade goods and illegal or smuggled goods.

#### Scenario: Fuel is represented by resource identity

- Given refined propellant exists in the resource catalog
- When fuel systems or markets refer to it
- Then they shall reference its resource ID instead of a private fuel-only name

#### Scenario: Ammo materials use catalog IDs

- Given an ammo recipe consumes ballistic powder
- When the recipe is evaluated
- Then it shall reference `ammo_ballistic_powder`

### Requirement: Cargo Mass For Ship Systems

Cargo mass shall be available to ship physics, fuel planning and autopilot estimates in a later implementation slice.

The inventory model shall expose aggregate cargo mass and fuel mass separately enough for future consumers to calculate loaded ship mass.

#### Scenario: Autopilot requests loaded mass later

- Given a ship has installed parts, fuel and cargo
- When future autopilot planning requests loaded mass
- Then the ship data shall be able to provide aggregate mass values derived from cargo and fuel
- And autopilot shall not need to inspect every cargo stack directly

### Requirement: Ship Builder Cost References

Ship-builder costs shall reference resource IDs, not hardcoded display strings.

#### Scenario: Part cost validation catches missing resource

- Given a ship part cost references a resource ID
- When the builder catalog is validated
- Then the validation shall fail if the resource ID does not exist in the shared catalog

### Requirement: Mining Node Outputs

Mining nodes shall output resource IDs and quantities.

Mining node data shall support ownership, depletion, grade and hazard metadata so mining and transfer systems can make legal and capacity decisions.

#### Scenario: Node depletion persists

- Given a mining node has a finite resource reservoir
- When extraction removes a quantity
- Then remaining quantity shall decrease
- And the node shall be able to persist partial depletion

### Requirement: Economy And Faction References

Economy and faction systems shall reference the same resource IDs used by mining, containers and builder costs.

Economy data shall be able to apply modifiers for location demand, faction relation, legality, ownership and condition without redefining resources.

#### Scenario: Restricted sample sale

- Given a protected biological sample has a restricted legal status
- When a normal outpost market evaluates the sale
- Then the market shall be able to reject or price it using the shared resource legal metadata

### Requirement: Planning-Only Boundary

This change shall not implement runtime code, tests, Unity scenes, assets, prefabs, UI, ScriptableObjects or autopilot/harness changes.

#### Scenario: Spec package is validated

- Given the planning documents and spec files exist
- When `specs_validate resource-cargo-inventory-model-v1` runs
- Then the change shall validate without requiring Unity tests or dotnet build
