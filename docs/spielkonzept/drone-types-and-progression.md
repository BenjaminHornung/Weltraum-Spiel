# Spielkonzept: Drone Types And Progression

Stand: 2026-06-14
Status: Planung fuer spaetere Drohnentypen, Upgrades und Freischaltung; keine Implementierung
Bezug: Ergaenzt Ship Builder Modular Parts, Resources/Mining/Crafting, Factions/Economy, Drones And Remote Missions und Surface Gameplay.

## 1. Ziel

Drohnentypen sollen klare Rollen haben, aber ueber Module, Ressourcen und Faction-Zugang wachsen. Der Spieler soll nicht einfach "bessere Zahlen" kaufen, sondern neue Missionsmoeglichkeiten, geringere Risiken und neue Orte erschliessen.

Leitsatz:

> Drone progression should unlock new mission contracts, environments and logistics options, not just bigger passive income.

## 2. Core Stats

Jede Drohne braucht planbare Werte:

| Stat | Purpose |
| --- | --- |
| Frame size | Determines bay compatibility, cargo limit and surface access. |
| Mass | Affects ship cargo/bay constraints and travel energy. |
| Cargo mass capacity | Limits raw ore, salvage, samples and parts. |
| Cargo volume capacity | Prevents tiny drones from hauling bulky goods. |
| Power capacity | Work duration, scanner time, weapons and return reserve. |
| Fuel/propellant | Flight or hover range where relevant. |
| Sensor range | Scout and probe value. |
| Tool rating | Mining, repair, salvage or sample compatibility. |
| Mobility rating | Terrain travel and route risk. |
| Armor/hull | Survival under hazards and attack. |
| Stealth/signature | Detection, legal scans and hostile attention. |
| Control link | Remote camera/control range and lost-link behavior later. |

## 3. Role Matrix

| Role | Cargo | Combat | Sensor | Tool | Mobility | Signature | Primary value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Scout | Low | Low | High | Low | High | Low | Discovery and route safety. |
| Mining | Medium | Low | Medium | High mining | Low/Medium | Medium/High while working | Extraction. |
| Hauler | High | Low | Low/Medium | Low | Medium | Medium | Logistics. |
| Combat/Security | Low | High | Medium | Weapon | High | High | Protection and escort. |
| Repair/Utility | Low/Medium | Low | Medium | Repair/salvage | Medium | Low/Medium | Recovery and support. |
| Probe/Survey | Very low | Very low | Very high | Science | One-way or long range | Low | Map reveal and hazardous survey. |

## 4. Progression Tiers

### Tier 0: Disposable/Basic

- Small scout/probe.
- No cargo or tiny sample cargo.
- Short range.
- Basic scan.
- Cheap loss.
- Unlocks map confidence and simple site marking.

### Tier 1: Starter Work Drone

- One simple scout/mining hybrid for V0.
- Small ore cargo.
- Basic cutter/drill.
- Works only at known safe node.
- Returns to ship cargo target.
- No combat AI.

### Tier 2: Specialized Surface Drones

- Separate mining, hauler, repair and security frames.
- Better cargo and tool compatibility.
- First legal/faction constraints matter.
- Outposts can service/repair/rent drones.

### Tier 3: Industrial Remote Operations

- Multi-drone missions.
- Mining drone plus hauler plus security escort.
- Outpost storage and refinery integration.
- Claim/licensing gameplay.
- Route risk and cargo contracts matter.

### Tier 4: Advanced/Restricted Drones

- Exotics, radiation, volatile fuels, biohazards.
- Stealth survey probes.
- Combat/security rules of engagement.
- Faction-specific modules.
- Recoverable long-range probes and orbital/surface hybrid missions later.

## 5. Module Families

| Module | Role impact | Resource/economy hook |
| --- | --- | --- |
| Sensor package | Scout/probe range, resource identification, patrol detection. | Electronics, exotics, science faction. |
| Mining tool | Node hardness, rate, heat, resource compatibility. | Metals, tool parts, corporate mining licenses. |
| Cargo pod | Mass/volume capacity, sealed cargo, volatile tanks. | Ship cargo rules, outpost storage, fuel materials. |
| Power cell | Mission duration and tool uptime. | Electronics, volatiles, advanced cells. |
| Mobility kit | Terrain access, speed, route safety. | Ship builder utility parts, repair materials. |
| Weapon package | Combat/security missions. | Ammo materials, legal restriction, security faction. |
| Repair kit | Repair, salvage, connector interaction. | Salvage parts, electronics, outpost service. |
| Signal package | Remote control range, lost-link resilience. | Sensors, antennas, faction tech. |
| Armor/seal | Hazard survival and cargo seal. | Structural materials, bio/volatile containers. |

## 6. Drone Bay And Ship Builder Integration

Ship Builder should eventually expose drone support as real ship parts:

- compact drone bay: one small drone,
- industrial drone bay: one medium work drone or two small drones,
- cargo-linked bay: faster transfer to ship cargo,
- armored bay: better launch/recovery under attack,
- probe launcher: disposable or recoverable probe missions,
- repair cradle: field repair for damaged drones.

Drone bay metadata should include:

- supported drone frame sizes,
- launch/recovery direction,
- cargo connection id,
- power/fuel recharge rate,
- repair support,
- bay storage count,
- legal weapon lockout if in restricted zones later.

V0 can fake this as one abstract ship bay slot, but the plan should not block real ship-builder parts later.

## 7. Faction And Legal Progression

Faction access should matter:

| Faction context | Drone progression |
| --- | --- |
| Corporate mining | Better mining tools, legal claim extraction, industrial haulers. |
| Frontier settlers | Repair, rescue, low-cost utility, outpost defense. |
| Independent salvagers | Salvage drones, hidden caches, questionable ownership. |
| Security authority | Combat drone licenses, patrol contracts, weapon restrictions. |
| Pirates/smugglers | Stealth, jamming, illegal cargo, black-market drones. |
| Science expedition | Probe/survey drones, biohazard sample handling, protected-site permits. |
| Old automated tech | Rare autonomous cores, high-risk unlocks, unstable behavior. |

Illegal drone use should be a gameplay choice, not an invisible flag. The mission risk estimate should say why.

## 8. Failure And Repair Progression

Drone loss should hurt but be recoverable:

- basic drone destroyed: cheap replacement,
- specialized tool broken: repair parts needed,
- mobility disabled: recoverable wreck,
- cargo seal damaged: cargo risk,
- control link lost: mission suspended,
- weapon violation: fine/reputation hit,
- rare drone core lost: major recovery mission.

Repair/utility drones create a positive loop: experienced players can recover rather than abandon damaged equipment.

## 9. V0 Progression

V0 should not create a huge tech tree. It needs only:

- one drone record,
- role tag: ScoutMining,
- basic sensor rating,
- basic mining tool rating,
- small cargo capacity,
- ship cargo target compatibility,
- energy capacity,
- damage state placeholder.

Unlock progression can be represented by future tasks, not runtime systems.

## 10. Kurzfazit

Drone progression is valuable when it opens new mission types and makes logistics richer. The first drone can be tiny, but it must already use the same role, cargo, tool, power and mission-state concepts that later scout, hauler, combat, repair and probe drones will share.
