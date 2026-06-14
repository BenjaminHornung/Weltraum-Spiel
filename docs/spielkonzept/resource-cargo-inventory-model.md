# Spielkonzept: Unified Resource, Cargo And Inventory Model

Stand: 2026-06-14
Status: Konzeptbasis fuer ein spaeteres gemeinsames Ressourcen-, Cargo- und Inventory-Modell
Bezug: Verbindet planetare Ressourcen, Suit Inventory, Ship Cargo, Drones, Outposts, Ship Builder, Fuel, Ammo und Economy.

## 1. Ziel

Dieses Dokument definiert ein gemeinsames Datenmodell fuer alles, was gesammelt, gelagert, transportiert, verbraucht, verkauft oder als Baukosten referenziert wird.

Leitsatz:

> Every resource should have one identity, every container should use the same capacity rules, and every transfer should be explicit enough to test.

Das Modell ist bewusst kein finales Crafting- oder Economy-System. Es ist die gemeinsame Sprache, damit spaetere Systeme nicht eigene Ressourcennamen, Cargo-Slots oder Sonderregeln erfinden.

## 2. Nicht-Ziele

Dieses Dokument definiert nicht:

- Runtime-Code,
- Unity ScriptableObjects,
- UI,
- Prefabs,
- finale Economy-Preise,
- finales Crafting,
- finale Ship-Builder-Kosten,
- Multiplayer-Synchronisation.

Es plant Datenvertraege und Spielregeln fuer spaetere Implementierungsslices.

## 3. Designprinzipien

- Eine Ressource hat genau eine stabile ID.
- Anzeigenamen duerfen sich aendern; IDs nicht.
- Mining, Ship Builder, Economy, Fuel, Ammo, Repair und Missionssysteme referenzieren dieselben IDs.
- Container pruefen Masse, Volumen, Stack-Regeln, Ownership und Gefahr.
- Transfers sind eigene Aktionen, keine stillen Nebenwirkungen.
- Bulk cargo gehoert in Schiff, Drone, Outpost oder Cargo-Module; der Suit traegt Proben, Tools, Ammo und kompakte Komponenten.
- Mission cargo und illegale Ware muessen von normalem Handel unterscheidbar sein.
- Cargo-Masse muss spaeter fuer Ship Physics, Autopilot-Fuel-Schaetzungen und Performance verfuegbar sein.

## 4. Resource Identity Model

Jede Ressource bekommt einen Katalogeintrag. Der Eintrag ist die Quelle fuer Display, Transfer, Preis, Legalitaet, Stack-Verhalten und spaetere Verbrauchslogik.

| Field | Purpose | Example |
| --- | --- | --- |
| `resourceId` | Stable lowercase ID used by saves, catalogs, mining nodes, costs and economy. | `ore_iron_silicate` |
| `displayName` | Player-facing localized name. | `Iron-Silicate Ore` |
| `category` | Broad gameplay type. | `RawOre`, `VolatileFuel`, `Component`, `AmmoMaterial` |
| `massPerUnitKg` | Physical mass for capacity and ship performance. | `8.0` |
| `volumePerUnitM3` | Cargo volume for containers. | `0.004` |
| `stackRule` | Stack size, stackable flag and special handling. | `BulkStack`, max `500` |
| `rarityTier` | Progression and loot/economy tier. | `Common`, `Uncommon`, `Rare`, `Exotic` |
| `tags` | Cross-system flags for uses and restrictions. | `ore`, `builder`, `refinable`, `legal_public` |
| `legalStatus` | Default legality, permit requirement or contraband state. | `Legal`, `Restricted`, `Illegal`, `ProtectedSample` |
| `ownershipImplication` | How possession or extraction is judged. | `ClaimedCargo`, `SalvageOwned`, `FactionEvidence` |
| `baseValueCredits` | Baseline economy value before local modifiers. | `4` |
| `hazardFlags` | Storage/transfer danger. | `volatile`, `biohazard`, `radioactive`, `explosive` |
| `defaultUse` | Primary sink or loop. | `fuel`, `ship_builder`, `trade`, `ammo` |

ID rule:

```text
<category>_<material>_<variant>
```

Examples:

- `ore_iron_silicate`
- `volatile_water_ice`
- `component_scrap_electronics`
- `fuel_refined_propellant`
- `ammo_ballistic_powder`
- `sample_hestia_biological`
- `exotic_radiant_crystal`
- `cargo_mission_sealed_crate`

Display names, localization, icon names and balancing values are data attached to the stable ID, not the ID itself.

## 5. Starter Resource Catalog Shape

The first shared catalog should be small enough to understand quickly.

| Resource ID | Display | Category | Mass | Volume | Tags | Legal default | First use |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| `ore_iron_silicate` | Iron-Silicate Ore | RawOre | high | medium | `ore`, `bulk`, `refinable`, `builder` | Legal unless claim-owned | early mining, hull/frame costs |
| `volatile_water_ice` | Water Ice | VolatileFuel | medium | high | `volatile`, `fuel_input`, `life_support` | Legal unless protected | fuel, oxygen/life support input |
| `component_scrap_electronics` | Scrap Electronics | Component | low | low | `salvage`, `electronics`, `repair`, `builder` | Ownership-sensitive | drone/sensor repairs |
| `material_structural_plate` | Structural Plate | RefinedMaterial | medium | medium | `builder`, `repair`, `outpost` | Legal | ship builder and repairs |
| `fuel_refined_propellant` | Refined Propellant | Fuel | medium | container-bound | `fuel`, `volatile`, `ship_consumable` | Legal but regulated in stations | main/RCS fuel |
| `ammo_ballistic_powder` | Ballistic Powder | AmmoMaterial | medium | low | `ammo`, `explosive`, `restricted` | Restricted | early ammunition |
| `sample_geology_core` | Geology Core Sample | ResearchSample | low | low | `sample`, `research`, `mission_possible` | Usually legal | research contracts |
| `cargo_mission_sealed_crate` | Sealed Mission Crate | MissionCargo | variable | variable | `mission`, `sealed`, `no_market_sale` | Depends on mission | delivery and faction jobs |

Rare resources such as Hestia biological samples, advanced exotics, old AI cores and rare isotopes should not appear in the first implementation slice unless a specific loop needs them.

## 6. Containers

All containers use the same core rules:

- maximum mass,
- maximum volume,
- optional slot or stack limits,
- allowed categories,
- blocked categories,
- ownership context,
- transfer permissions,
- hazard handling,
- cargo mass reporting.

Container identity should be stable and explicit. A container is not just a UI list; it is a physical or logical storage place that other systems can query.

| Container | Purpose | Capacity shape | Special rules |
| --- | --- | --- | --- |
| Suit inventory | Player-carried samples, tools, ammo, compact components. | Low mass, low volume, optional mission/sealed slots. | Heavy loads slow player or increase suit energy use later. |
| Ship cargo | Main logistics hold for mined resources and trade. | High mass and volume from cargo parts. | Cargo mass must be exposed to ship physics and autopilot later. |
| Drone cargo | Mining/cargo drone payload. | Small to medium mass, strict volume. | Autonomous transfer tasks must fail clearly when full. |
| Outpost storage | Persistent owned, rented or faction storage. | Large volume, service-specific rules. | May charge fees, reject contraband or require reputation. |
| Cargo module internal volume | Ship-builder part-provided storage. | Declared by cargo module metadata. | Uses module capacity; mass contributes to ship. |
| External cargo rack | Exposed ship cargo. | Medium volume, external hazard profile. | Can be scanned, damaged, jettisoned later and may block turret arcs. |
| Mission cargo | Contract-owned sealed goods. | Dedicated or tagged stack/container. | Cannot be sold, refined or split unless mission allows it. |
| Mining node reservoir | Remaining extractable resource at a node. | Resource ID plus quantity and grade. | Not an inventory until extraction creates a transfer event. |

## 7. Container Fields

Future implementations should represent containers with a shared shape similar to:

| Field | Purpose |
| --- | --- |
| `containerId` | Stable instance ID for saves and transfer logs. |
| `containerType` | Suit, ship, drone, outpost, rack, node reservoir etc. |
| `ownerId` | Player, faction, mission, unowned or unknown. |
| `locationRef` | Ship ID, drone ID, outpost ID, surface node ID or mission ID. |
| `maxMassKg` | Maximum accepted mass. |
| `maxVolumeM3` | Maximum accepted volume. |
| `allowedResourceTags` | Whitelist for category/tags when needed. |
| `blockedResourceTags` | Contraband, biohazard, volatile or mission restrictions. |
| `currentMassKg` | Derived sum from contents. |
| `currentVolumeM3` | Derived sum from contents. |
| `contents` | Resource ID, quantity, condition, ownership and stack metadata. |
| `accessPolicy` | Public, owned, faction-permitted, mission-only, locked or hostile. |
| `transferPorts` | Optional physical interaction points such as cargo port or rack connector. |

## 8. Transfer Rules

Transfers should be explicit commands with a clear result:

```text
TransferResource(sourceContainer, targetContainer, resourceId, quantity, actorId, context)
```

The transfer result should state:

- accepted quantity,
- rejected quantity,
- mass and volume delta,
- ownership/legal result,
- reason if blocked,
- warnings such as volatile, illegal, overweight or mission locked.

### Suit To Ship

Suit to ship transfer is the first required loop:

1. Player is near a ship cargo port, cockpit interior, landed ship, or allowed transfer range.
2. Source is suit inventory.
3. Target is ship cargo or a specific ship cargo module.
4. Target capacity checks mass and volume.
5. Legal/mission cargo keeps ownership tags.
6. Ship cargo mass updates aggregate ship mass data.

### Ship To Outpost

Ship to outpost transfer supports trade, storage, refuel and mission delivery:

1. Ship is landed, docked or close to a cargo port.
2. Outpost access policy permits the actor.
3. Market or storage service checks accepted resources.
4. Illegal cargo may be refused, scanned, fined or routed to black market later.
5. Transaction result records price, fee, reputation and ownership change.

### Drone To Ship

Drone to ship transfer supports mining and cargo shuttle loops:

1. Drone reaches ship, cargo bay, rack or cargo port.
2. Drone cargo source checks mission/risk policy.
3. Ship target checks capacity.
4. If partial transfer is allowed, the drone keeps remaining cargo and reports `CargoPartial`.
5. If not allowed, transfer fails atomically with a reason.

### Node To Suit, Drone Or Ship

Mining output should not bypass the shared container system:

1. Mining node reservoir declares resource IDs, grade and remaining quantity.
2. Extraction method produces a quantity over time.
3. Output target can be suit, drone, deployable container, vehicle or ship.
4. Capacity and allowed tag checks run before accepting the output.
5. Excess output is blocked, spilled, left in node, or pauses extraction depending on method.

### Mission Cargo Restrictions

Mission cargo can enforce:

- sealed stacks that cannot be split,
- no sale to normal markets,
- destination-only delivery,
- owner/faction inspection visibility,
- failure if opened, damaged, scanned illegally or transferred to forbidden storage.

### Ownership And Faction Restrictions

Ownership is checked at transfer and extraction time:

- unclaimed resources can transfer normally,
- player-owned resources are legal for player containers,
- faction-owned cargo needs permission, purchase, mission context or salvage status,
- protected resources require permit or research mission,
- illegal goods can enter containers but may trigger scanner/economy consequences.

### Mass And Volume Checks

A transfer must not complete if it would exceed target mass or volume unless the target explicitly supports partial transfer. The result must expose why:

```text
Rejected: target volume capacity exceeded by 0.14 m3
Accepted: 12 / 20 units
```

## 9. Resource Uses

The same resource IDs should feed multiple systems.

| Use | Resource relationship |
| --- | --- |
| Fuel | Refined propellant and volatile inputs feed ship fuel, RCS propellant and later generators. |
| Ammo | Ammo materials, cells, coils and explosives become foot, ship and turret ammunition. |
| Repair | Structural plates, electronics and spare components repair hull, modules, drones and suit systems. |
| Ship builder construction | Parts reference resource IDs and quantities, never display-name strings. |
| Turret/weapon upgrades | Metals, electronics, ammo materials and exotics gate weapon tiers. |
| RCS/thruster upgrades | Volatiles, structural material, high-temperature alloys and electronics gate propulsion upgrades. |
| Research samples | Samples unlock faction reputation, tech leads, permits or story progress. |
| Trade goods | Commodity resources sell through economy price tables and location demand. |
| Illegal/smuggled goods | Restricted samples, stolen parts, contraband ammo and AI cores use the same container model with legal flags. |

## 10. Integration Points

### Planet Mining

Mining nodes should output resource IDs and quantities. Node composition can include grade, extraction difficulty, legal owner, hazard and depletion state.

Example:

```text
nodeId: tharos_crater_iron_001
ownerId: frontier_settlers
outputs:
  ore_iron_silicate: 420 units
  sample_geology_core: 1 unit
```

### Suit Inventory

Suit inventory is the first-person interface to samples, tools, compact ammo and small salvage. It should share container logic with larger cargo, but use smaller capacity values and stricter category restrictions.

### Ship Cargo And Ship Builder Parts

Ship cargo capacity should come from installed cargo modules and racks. Modular cargo parts already plan `HELPER_CARGO_VOLUME_*`, `SOCKET_CARGO_ATTACH_*` and metadata for capacity. Future cargo components should read part metadata and contribute:

- cargo mass capacity,
- cargo volume capacity,
- hazard support,
- external/internal exposure,
- turret fire blocking metadata later.

### Drones

Drones use the same resource stacks and container rules. Drone task logic should reason about full/partial cargo, accepted target resources and legal risk.

### Outposts

Outposts are persistent containers plus service rules. Trade terminals, refineries, storage rentals and mission boards all reference the same resource IDs.

### Ammo And Fuel

Fuel and ammo should be resources, even if early UI shows them as meters. The resource model should allow:

- actual fuel inventory later,
- RCS propellant as a separate or shared resource,
- weapon ammo feeds by turret or ship,
- market buy/sell for consumables.

### Economy And Factions

Economy prices and faction rules reference resource IDs, category tags and legal flags. Faction ownership should not require duplicate item definitions.

### Autopilot And Physics

Cargo mass must be queryable as:

```text
shipDryMassKg + installedPartMassKg + cargoMassKg + fuelMassKg
```

Autopilot should not depend on inventory details, but it must be able to receive aggregate mass and later fuel reserve estimates.

## 11. Persistence And Save Data

The save model should persist:

- resource catalog version,
- resource stack IDs and quantities,
- container instance IDs,
- ownership/faction status,
- mission cargo seals and destination rules,
- node depletion,
- outpost stored cargo,
- drone cargo and active transfer tasks,
- ship cargo aggregate mass.

Catalog migrations should map retired resource IDs forward instead of silently deleting cargo.

## 12. V0 Implementation Slices

Recommended future slices:

1. Resource catalog v0.
2. Generic container model.
3. Ship cargo component.
4. Suit inventory model.
5. Cargo transfer interaction.
6. Mining node output.
7. Ship builder cost integration.
8. Economy price table.

Each slice should keep the same ID vocabulary and add tests around capacity and transfer behavior before UI polish.

## 13. Kurzfazit

Resources should be the connective tissue of the game. A unified model lets planet mining, ship cargo, drones, outposts, builder costs, fuel, ammo and economy use one shared truth instead of many local approximations. The first version should be modest, but it must already respect identity, capacity, ownership and cargo mass.
