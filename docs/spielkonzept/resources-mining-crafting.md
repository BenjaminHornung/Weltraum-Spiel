# Spielkonzept: Resources, Mining And Crafting

Stand: 2026-06-14
Status: Konzeptbasis fuer Ressourcen, Mining und spaetere Crafting-/Economy-Anbindung
Bezug: Verbindet planetare First-Person-Erkundung mit Ship Builder, Fuel, Ammo, Drones, Autopilot, Outposts und Economy.

## 1. Ziel

Ressourcen sollen der Grund sein, warum Orte im Aurelia-System wichtig werden. Mining ist nicht nur eine Fortschrittsleiste, sondern eine Entscheidung aus Ort, Werkzeug, Risiko, Zeit, Cargo, Ownership und Ruecktransport.

Leitsatz:

> Every useful resource should answer where it comes from, how the player detects it, what risk extraction creates, and which space-game system it feeds.

## 2. Designprinzipien

- Ressourcen muessen in Schiffen, Drohnen, Fuel, Ammo, Reparatur, Upgrades, Handel oder Forschung enden.
- Mining erzeugt Signatur: Laerm, Hitze, Staub, Energieverbrauch oder rechtliche Aufmerksamkeit.
- Kleine wertvolle Proben duerfen in den Suit passen; Bulk Ore gehoert in Cargo.
- Bessere Werkzeuge erhoehen nicht nur DPS, sondern erlauben neue Orte, geringeres Risiko oder sauberere Ausbeute.
- Faction Ownership und Umweltregeln machen Mining zu mehr als "alles abbauen".
- Drones und Ship-mounted Tools sind effizient, aber nicht immer praezise oder legal.

## 3. Resource Lifecycle

1. Survey from orbit, ship, drone or suit.
2. Identify node type and ownership.
3. Choose extraction method.
4. Spend time, power, durability and cargo capacity.
5. Trigger possible noise, heat, hazard or faction response.
6. Transfer raw or refined material.
7. Refine, craft, sell, repair, refuel, reload, research or upgrade.
8. Persist depletion, claim status and discovery data.

## 4. Resource Categories

| Resource type | Where it appears | Detection | Collection | Tool tier | Risk/hazard | Mass/volume | Use cases | Economy value | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Raw ores | Asteroids, crater walls, exposed seams, caves, regolith fields, old mines | Orbit survey for fields; suit scan for composition and grade | Cutter, drill, drone miner, vehicle bucket, ship extractor | Tier 1 for soft ores, Tier 2+ for dense metals | Dust, cave collapse, claim defense, heavy cargo, heat | High mass, medium to high volume | Hull plates, frames, armor, engines, station parts | Stable baseline commodity | Early: iron/silicates; mid: alloys; late: rare dense metals |
| Volatile fuels | Ice deposits, cryo vents, comet fragments, polar caps, gas pockets, sealed tanks | Thermal scan, spectrometer, ground-penetrating scan | Sealed pump, cryo container, drone siphon, refinery intake | Tier 1 for ice, Tier 2 for unstable volatiles | Explosion, pressure burst, contamination, evaporative loss | Medium mass, requires containers | Fuel, RCS propellant, life support, chemical ammo | High in remote zones | Early: water/ice; mid: methane/ammonia; late: rare isotopes |
| Rare crystals/exotics | Deep caves, impact sites, volcanic vents, ancient machinery, high-radiation zones | Anomaly scan, radiation spike, precise suit scan | Careful cutter, stabilizer field, sample case, late drone | Tier 2-4 | Radiation, instability, pirates, science restrictions | Low mass, high value, fragile | Advanced sensors, power cores, weapon focusing, research | Very high and volatile | Mid to late progression gate |
| Salvage parts | Wrecks, abandoned stations, crashed drones, battlefields, outposts | Visual scan, transponder, EM scan, ownership check | Hand salvage, breacher, repair drone, cargo drone | Tier 1 for panels, Tier 2+ for locked/fragile systems | Legal ownership, traps, security, sharp debris | Mixed; components compact, hull bulky | Repairs, ship modules, electronics, trade, crafting | Depends on legality and rarity | Early survival and repair; mid builder parts; late unique tech |
| Biological/organic materials | Hestia biomes, farms, fungal caves, alien reefs, medical labs | Bio scanner, contamination filter, sample analysis | Sample kit, sealed container, drone sampler | Tier 1 samples, Tier 2 sterile/hostile sites | Spores, toxins, predators, protection laws | Low to medium, sealed volume | Medicine, filters, food, biotech, research | High near science factions, illegal in protected areas | Early science income; mid suit upgrades; late rare bio-tech |
| Electronics/components | Outposts, wrecks, drones, factories, labs, trade hubs | EM scan, terminal logs, part IDs | Salvage tool, hacking, repair drone, trade | Tier 1 common boards, Tier 2+ secure systems | Shock, security alerts, legal claims | Low mass, valuable volume | Autopilot modules, drones, scanners, ship builder systems | High, especially frontier | Early repairs; mid drone expansion; late advanced automation |
| Ammunition materials | Metal powders, chemical precursors, capacitor cells, coils, explosives, salvage | Resource scanner plus crafting station recipe | Mine/refine, buy, salvage, synthesize | Tier 1 ballistics, Tier 2 energy cells, Tier 3 explosives/rails | Fire, detonation, legality, noise | Medium; ammo competes with cargo | Foot ammo, ship ammo, turret feeds, defense systems | High in conflict zones | Early pistol/rifle; mid lasers/coil; late heavy ordnance |
| Construction materials | Regolith, stone, ceramics, structural metals, polymers, insulation | Terrain scan, outpost demand, cargo manifest | Excavator, drill, vehicle, ship extractor | Tier 1 bulk gathering, Tier 2 fabrication | Heavy cargo, dust, machinery noise | Very high mass/volume | Outposts, landing pads, storage, shipyard modules | Low per unit, high volume | Mid economy backbone; late base/station expansion |
| Research samples/artifacts | Anomalies, ruins, old AI sites, rare biomes, deep caves, wreck data cores | Mission scanner, anomaly detector, precise suit scan | Manual sample, sealed case, puzzle/terminal extraction | Tier varies by site | Faction conflict, contamination, unstable tech | Usually low mass, special handling | Unlocks tech, story, faction reputation, unique upgrades | Extremely variable | Progression and worldbuilding driver |

## 5. Mining Methods

| Method | Strength | Weakness | Best use |
| --- | --- | --- | --- |
| Hand tool mining | Precise, low setup, works in tight spaces | Slow, suit power drain, limited cargo | First playable loop, samples, small nodes, emergency repair materials |
| Deployable mining drill | Extracts while player guards or explores | Setup time, noise, heat, can be stolen/damaged | Medium surface nodes, claims, outpost support |
| Drone mining | Autonomous, can work while player scouts | Needs pathing, cargo, power, risk policy, recall | Repeated nodes, dangerous but accessible sites |
| Vehicle mining | Large cargo and power on surface | Needs terrain access, vehicle deployment, garage/hangar | Regolith fields, construction materials, mid-game mines |
| Ship-mounted surface extraction | Very fast bulk extraction | High signature, landing requirements, collateral/legal limits | Owned claims, exposed fields, industrial operations |
| Deep-core mining | Access to rare deep resources | Future scope; high complexity, seismic and legal risk | Late-game planets, major outposts, faction contracts |

## 6. Mining Constraints

### Extraction Time

Each method has time cost. Hand mining is slow but flexible. Ship extraction is fast but obvious. Drills and drones create a defendable timer: the player chooses whether to guard, scout, return later or recall.

### Noise, Heat And Signature

Mining can attract:

- wildlife,
- hostile drones,
- pirates,
- faction inspectors,
- claim defense systems,
- weather-sensitive hazards,
- scanner-visible heat signatures.

Extraction UI should show expected signature:

```text
SIGNATURE: LOW
HEAT: RISING
NOISE: AUDIBLE AT 600 m
LEGAL: CLAIMED BY FRONTIER SETTLERS
```

### Power Usage

Tools consume suit, drone, vehicle or ship power. Running out of power can stop extraction, disable scanner detail, reduce suit safety, or force return.

### Tool Durability

Mining tools degrade by material hardness, dust, overheating and misuse as weapons. Durability should be repairable with parts, not just a punishment.

### Cargo Capacity

Mining is only useful if material can be moved:

- suit for samples,
- drone for small batches,
- vehicle for bulk,
- ship for real profit,
- outpost storage for long operations.

### Environmental Danger

Mining can destabilize caves, puncture gas pockets, overheat in direct sun, crack ice, trigger spores or expose radiation.

### Legal And Faction Ownership

Nodes may be:

- unclaimed,
- player claimed,
- faction claimed,
- protected,
- restricted,
- illegal salvage,
- abandoned but still legally owned.

The scanner must say why extraction is risky. If the game chooses to enforce law later, the data needs to exist from the start.

### Planetary Protection

Living worlds like Hestia can include protected biomes. Some samples may be legal only with research permits. Illegal extraction can produce black-market value and faction penalties.

## 7. Crafting And Refining

Crafting should not become a huge inventory spreadsheet early. Start with simple transformations:

| Input | Process | Output |
| --- | --- | --- |
| Raw ore | refine | ingots, ceramic plates, structural material |
| Volatiles | process | fuel, oxidizer, life support, coolant |
| Salvage parts | sort/repair | components, electronics, spare modules |
| Biological samples | analyze | filters, medicine, research data |
| Ammo materials | fabricate | bullets, cells, coils, charges |
| Exotics | stabilize | advanced sensor, power or weapon upgrade parts |
| Artifacts | research | unlocks, reputation, story leads |

Refining can happen at:

- ship fabricator, low efficiency,
- outpost refinery, medium efficiency,
- corporate refinery, high throughput but fees,
- player-owned future base,
- specialized faction labs.

## 8. Connections To Core Systems

| System | Resource connection |
| --- | --- |
| Ship builder | Frames, armor, engines, sensors, weapon mounts and modules require refined materials. |
| Fuel | Volatiles and isotopes feed ship fuel, RCS, life support and generators. |
| Ammo | Ballistic, energy, coil and explosive weapons consume material categories. |
| Repairs | Salvage and raw materials restore hull, modules, drones and suit systems. |
| Upgrades | Exotics, electronics and research samples unlock better scanners, mining tools and weapons. |
| Economy | Supply, demand, legality and location decide profit. |
| Exploration | Rare resources reveal new landing zones, caves, anomalies or faction interest. |
| Autopilot | Cargo mass changes fuel estimates, brake reserve and route validity. |
| Drones | Mining/cargo drones need power, tools, cargo and mission risk policies. |

## 9. Early, Mid And Late Game Shape

Early game:

- hand tool,
- basic scanner,
- small ores, ice, salvage,
- suit cargo and ship transfer,
- simple repairs and fuel.

Mid game:

- drones,
- deployable drills,
- legal claims,
- refineries,
- ammo crafting,
- outpost trade,
- modular ship parts.

Late game:

- deep-core mining,
- rare exotics,
- faction-scale contracts,
- ship-mounted extraction,
- automated logistics,
- advanced weapons,
- research artifacts,
- station/base construction.

## 10. Minimum First Playable

V0 resource loop:

1. One detected resource node.
2. Suit scanner reveals type, yield and required tool.
3. Hand mining tool extracts small amount over time.
4. Suit inventory receives material with mass.
5. Player transfers material to ship cargo.
6. Ship UI or debug inventory shows the cargo.
7. Node persists as depleted or partially depleted.

## 11. Future Scope

- refinery networks,
- dynamic supply/demand,
- full crafting trees,
- base construction,
- geological simulation,
- deep drilling,
- multi-drone mining fleets,
- automated cargo logistics,
- black-market smuggling economy,
- procedural resource generation tied to planet formation.

## 12. Kurzfazit

Resources are the bridge between planet surfaces and the space game. Mining should create practical decisions: what to extract, who owns it, what tool to use, how much cargo it costs, what danger it creates, and how it feeds ships, drones, weapons, fuel, economy and exploration.
