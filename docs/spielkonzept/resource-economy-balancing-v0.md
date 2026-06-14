# Spielkonzept: Resource Economy Balancing v0

Stand: 2026-06-14
Status: Konzeptbasis fuer fruehe Ressourcen-, Cargo- und Economy-Balancing-Regeln
Bezug: Ergaenzt `resource-cargo-inventory-model.md`, Resources/Mining/Crafting, Ship Builder, Outposts und Factions.

## 1. Ziel

Dieses Dokument definiert eine kleine, robuste Balancing-Richtung fuer die ersten Ressourcen. Es soll verhindern, dass der Anfang des Spiels zu frueh zu einer grossen Tabellenwirtschaft wird.

Leitsatz:

> Start with few resources, clear uses, meaningful cargo limits, and prices that create route choices without drowning the player in commodities.

## 2. Balancing-Prinzipien

- Fruehe Ressourcen muessen sofort erklaeren, warum Mining und Cargo wichtig sind.
- Jede Ressource braucht mindestens einen klaren Sink: Fuel, Repair, Builder, Ammo, Mission, Research oder Trade.
- Starter-Ressourcen sollten legal und lesbar sein; illegale oder exotische Ware kommt spaeter.
- Bulk-Ware hat niedrigen Wert pro Einheit, aber hohe Masse/Volumen.
- Kompakte Komponenten und Proben haben hohen Wert pro Volumen.
- Cargo-Masse ist langfristig ein Performance-Kostenfaktor, nicht nur UI-Zahl.
- Economy darf nicht zum Grind werden: Preise sollen Routen und Risiken formen, nicht reine Wartezeit.

## 3. Minimal Starter Set

Der erste spielbare Resource Loop sollte mit 6 bis 8 Ressourcentypen auskommen.

| Resource ID | Primary loop | Why it exists early | Risk/cost |
| --- | --- | --- | --- |
| `ore_iron_silicate` | mining -> ship cargo -> sell/refine/build | Basic bulk ore teaches mass and cargo limits. | Heavy, low value per unit. |
| `volatile_water_ice` | mining -> fuel/life support input | Connects surface extraction to range and survival. | Bulky, needs suitable storage later. |
| `component_scrap_electronics` | salvage -> repair/builder/drones | Makes wrecks useful without huge crafting. | Ownership-sensitive. |
| `material_structural_plate` | refined/build/repair | First bridge from ore to ship parts. | Medium mass, useful sink. |
| `fuel_refined_propellant` | buy/refine -> ship fuel/RCS | Makes fuel a resource without exposing full refinery complexity. | Regulated near stations. |
| `ammo_ballistic_powder` | mine/buy -> ammunition | Gives combat recurring cost. | Restricted, explosive tag. |
| `sample_geology_core` | sample -> research/trade | Teaches low-mass high-value samples. | Mission or permit context. |
| `cargo_mission_sealed_crate` | accept -> transport -> deliver | Teaches mission cargo restrictions. | Cannot be sold/split normally. |

Do not add separate copper, nickel, titanium, carbon, silicon, polymer, oxygen, hydrogen, nitrogen and trace-gas resources in the first slice unless the gameplay needs them. They can be hidden inside refined outputs or future recipes.

## 4. Early Game Shape

Early game should teach three cargo truths:

1. Suit inventory is convenient but small.
2. Ship cargo makes mining profitable.
3. Cargo mass and fuel/ammo costs matter when planning trips.

Early sources:

- one surface ore node,
- one ice or volatile node,
- one salvage crate or wreck panel,
- one mission crate from an outpost,
- one trader that buys ore and sells fuel/ammo.

Early sinks:

- sell ore for credits,
- turn some ore into structural plate,
- use electronics for repair or scanner/drone upgrade,
- consume propellant as ship fuel,
- deliver mission crate,
- optionally fabricate simple ammo.

## 5. Mid-Game Expansion

Mid game can expand once the player understands transfer, capacity and ownership.

Add categories gradually:

| Category | Example IDs | Gameplay reason |
| --- | --- | --- |
| Better metals | `ore_dense_metal`, `material_reinforced_alloy` | Stronger ship parts, armor and heavy thrusters. |
| Volatile chemistry | `volatile_methane`, `volatile_ammonia` | Better fuel processing, cooling, outpost demand. |
| Advanced components | `component_sensor_array`, `component_drone_actuator` | Drones, sensors, turret upgrades. |
| Cargo trade goods | `trade_medicine_pack`, `trade_frontier_supplies` | Outpost economy and delivery contracts. |
| Legal samples | `sample_hestia_biological`, `sample_anomaly_dust` | Research faction loops and permits. |
| Weapon materials | `ammo_capacitor_cell`, `ammo_rail_coil` | Energy/coil weapons and turret upgrades. |

Mid game should introduce:

- outpost storage,
- drone cargo,
- legal claims,
- permit gates,
- market demand differences,
- ship builder part costs,
- meaningful cargo module choices.

## 6. Rare Late-Game Resources

Late-game resources should be rare because they unlock capabilities, not because the player needs thousands of them.

| Resource direction | Example ID | Role |
| --- | --- | --- |
| Exotic crystals | `exotic_radiant_crystal` | Advanced sensors, power cores, weapon focusing. |
| Rare isotopes | `isotope_helium3_refined` | High-end fuel, reactors, long-range expeditions. |
| Old AI cores | `artifact_ai_core_fragment` | Story, research unlocks, black-market value. |
| Protected bio samples | `sample_hestia_protected_bio` | Science/illegal trade conflict. |
| Ancient alloys | `material_remnant_alloy` | Unique hull or turret upgrades. |

Late-game resources should usually be:

- low volume,
- high value,
- legally sensitive,
- tied to hazard or mission context,
- used in small quantities for upgrades.

## 7. Price Model v0

Start with a simple price:

```text
finalPrice = baseValue * locationDemand * factionRelation * legalityModifier * freshnessOrCondition
```

V0 can clamp or round this rather than simulate a full economy.

| Modifier | Example |
| --- | --- |
| Location demand | Water is expensive on hot worlds and cheap near ice depots. |
| Faction relation | Friendly outposts pay better or charge lower fees. |
| Legality | Restricted goods need permit or black market. |
| Condition | Damaged electronics sell lower, pristine components sell higher. |
| Distance/logistics | Remote outposts pay more for fuel, medicine and repair parts. |

Avoid dynamic supply chains until the basic buy/sell and transfer loop is stable.

## 8. Cargo Mass And Performance

Cargo mass should eventually affect:

- acceleration,
- braking distance,
- fuel burn estimates,
- RCS responsiveness,
- landing safety margins,
- autopilot route validity,
- mission risk and delivery timing.

The early implementation does not need to retune all physics immediately. It should expose aggregate cargo mass so later flight code can consume it:

```text
shipCargoMassKg
shipFuelMassKg
shipTotalLoadedMassKg
```

Autopilot fuel estimates should eventually use loaded mass, fuel reserves and cargo module configuration. Until then, planning docs and UI should avoid promising exact fuel math.

## 9. Ship Builder Cost Balancing

Ship builder costs should reference resource IDs:

```text
partId: main_thruster_small_chemical_bell_v0
costs:
  material_structural_plate: 12
  component_scrap_electronics: 3
  fuel_refined_propellant: 2
```

Cost rules:

- Structural parts use plates and basic components.
- Thrusters use plates, electronics and fuel/volatile inputs.
- RCS blocks use electronics plus propellant-related materials.
- Cargo modules use plates and low-tier components.
- Turrets use plates, electronics and ammo/weapon material.
- Exotic costs are reserved for late upgrades, not starter parts.

The builder should never key costs by display names such as `Iron Ore` or `Fuel`.

## 10. Fuel And Ammo Balancing

Fuel and ammo should be recurring but readable costs.

Fuel:

- starter fuel is easy to buy,
- refined propellant is a catalog resource,
- raw volatiles can become fuel later through refinery/fabricator flows,
- remote fuel scarcity creates route planning choices.

Ammo:

- early ammo uses simple material inputs,
- energy weapons may consume cells instead of powder,
- explosives and heavy ordnance are restricted,
- turrets can consume resource-backed ammo feeds later.

Fuel and ammo meters may be shown as simple bars in UI, but underlying data should still map back to resources when implementation reaches cargo/economy integration.

## 11. Legal And Illegal Economy

Legal state should be balancing data, not only story text.

| Legal state | Economy behavior |
| --- | --- |
| Legal | Normal markets buy/sell. |
| Claimed | Requires owner permission or purchase. |
| Restricted | Requires license, faction relation or mission. |
| Protected | Research permit or mission only; normal sale blocked. |
| Illegal | Black market or hostile consequences. |
| MissionLocked | Destination-only; no market sale. |

Illegal goods should be profitable because they add risk:

- scan risk,
- faction penalty,
- storage refusal,
- mission failure,
- hostile encounters.

V0 can begin with only warnings and transfer restrictions; full law enforcement can be later.

## 12. Outpost Demand Examples

| Outpost type | Wants | Pays less for |
| --- | --- | --- |
| Mining camp | fuel, repair parts, food/medicine, drone parts | raw ore it already produces |
| Corporate refinery | bulk ore, volatiles, licensed samples | stolen or low-grade scraps |
| Research lab | samples, electronics, protected mission cargo | bulk ore |
| Frontier settlement | water, fuel, medicine, construction material | exotic contraband |
| Pirate hideout | ammo, fuel, stolen electronics, illegal samples | legal paperwork-heavy cargo |
| Shipyard | structural plates, electronics, thruster/RCS materials | unrefined low-grade ore |

## 13. First Balancing Targets

The first practical loop should target:

- suit can carry a few samples or a tiny ore batch, not a profitable bulk load,
- ship cargo can carry enough ore for one satisfying sale,
- drone cargo carries less than ship cargo but more than the suit,
- one cargo module meaningfully increases trip value,
- fuel cost is visible but not punishing in the starter range,
- ammo cost matters after repeated combat, not after one encounter,
- mission cargo competes with normal cargo space.

Exact numbers should come from playtests after the container model exists.

## 14. Kurzfazit

Resource economy v0 should be small, physical and readable. The player mines or salvages because the cargo has weight, value, legal context and useful sinks. The model should start with a modest resource set and grow only when new loops need new IDs.
