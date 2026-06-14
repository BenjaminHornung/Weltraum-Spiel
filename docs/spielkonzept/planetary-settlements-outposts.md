# Spielkonzept: Planetary Settlements And Outposts

Stand: 2026-06-14
Status: Konzeptbasis fuer planetare Outposts, Settlements, Pads, Storage und einfache Interaktion
Bezug: Ergaenzt Worldbuilding, Economy, Planetary Exploration, Resources, Drones und Ship Builder.

## 1. Ziel

Settlements und Outposts sind die Orte, an denen die Systemwirtschaft sichtbar wird. Sie geben dem Spieler sichere oder halb-sichere Knoten fuer Landung, Handel, Cargo, Missionen, Reparatur, Konflikte und Faction-Identitaet.

Leitsatz:

> An outpost is a gameplay interface: land, identify owner, transfer cargo, get work, spend resources, change risk, and leave with a clearer route.

## 2. Grundfunktionen

Outposts koennen eine oder mehrere Funktionen haben:

- landing pad,
- refuel,
- cargo storage,
- market,
- repair/refit,
- mission board,
- faction checkpoint,
- mining claim office,
- drone service,
- scanner relay,
- defense hub,
- story/environmental location.

Nicht jeder Outpost braucht NPC-Tiefe. Ein Terminal, ein Cargo-Port, ein Besitzerstatus und ein paar starke visuelle Hinweise koennen fuer V0 reichen.

## 3. Settlement And Outpost Types

| Type | Layout needs | Landing/docking relationship | NPC/vendor/mission role | Storage/cargo transfer | Defense systems | Faction ownership | Map/scanner appearance | V0 interaction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Small mining camp | Drill pads, tents/modules, ore bins, generator, beacon | Rough pad or nearby flat zone for small ship/rover | Job giver, miner rescue, claim dispute | Ore bins, simple cargo port, claim container | Light turret, claim beacon, worker drones | Settlers, corporation, independent miners | Heat, dust, mining signature, owner beacon | Land nearby, trade ore, take simple mining job |
| Corporate refinery | Large tanks, conveyors, refinery stack, offices, security gate | Formal pad, cargo docking, approach corridor | Buy/sell bulk, license office, repair services | High-capacity cargo transfer, fees, storage contracts | Security drones, turrets, scans, restricted zones | Industrial mining corporation | Strong EM/heat, transponder, restricted markers | Sell ore, buy fuel, get license, avoid restricted doors |
| Independent trade post | Market ring, small hangars, antenna, mixed modules | Public pad, low fees, drone parking | Vendors, rumors, mission board, black-market hints | Mixed storage, small cargo jobs | Improvised defenses, local guards | Settlers/salvagers | Friendly beacon, trade icon, weak security | Buy/sell, refuel, accept delivery/salvage job |
| Pirate hideout | Hidden valley/cave, camo nets, stolen crates, escape route | Hidden pad, no official transponder | Contraband trade, ambush, bounty target | Stolen cargo, hidden caches | Mines, turrets, patrols, jammer | Pirates/smugglers | Weak/false signal, scanner anomalies | Fight or sneak, recover cargo, maybe black-market contact |
| Research lab | Clean modules, sample locks, quarantine, sensor mast | Restricted pad or drone landing zone | Science contracts, permits, sample analysis | Sealed sample storage, data uplink | Access doors, non-lethal security, quarantine protocols | Science expedition/security authority | High sensor activity, protected-site warning | Deliver sample, scan anomaly, obey contamination rules |
| Abandoned bunker | Buried entrance, sealed doors, old power, interior rooms | No formal pad; land nearby | Lore, old AI/automated systems, salvage | Locked storage, data core, power cells | Dormant turrets, drones, traps | Old infrastructure or unknown | Faint EM, partial map, no owner or obsolete owner | Enter, restore power, salvage one objective |
| Automated defense station | Sensor tower, turret arcs, power core, control room | Dangerous approach, landing at safe perimeter | Security obstacle, disable/authorize objective | Limited; may protect nearby cargo/claims | Strong turrets, drones, scanner locks | Security authority, corporation, old AI | Clear threat bubble and targeting emissions | Disable, avoid, hack or get authorization |
| Landing pad / fuel depot | Pad, fuel tanks, beacon, cargo hose, small office | Primary landing support | Refuel, emergency services, docking fee | Fuel/cargo ports, temporary storage | Pad lights, small turret, access control | Varies by region | Strong navigation beacon, service icon | Land, refuel, pay fee, transfer cargo |
| Shipyard/hangar | Large pad, hangar, cranes, part storage, fabricator | Requires formal approach and cargo capacity | Ship parts, repairs, builder services, module install | High-capacity part/cargo transfer | Strong security, scans, restricted hangars | Corporation, settlers, player later | Major map icon, traffic, transponder | Future: repair/refit; V0 may be read-only concept marker |

## 4. Layout Needs

Each outpost should support readable navigation:

- obvious landing area or reason no ship can land,
- clear entrance,
- cargo transfer point,
- owner/faction marker,
- service terminal or NPC cluster,
- restricted areas with clear signage,
- defense arcs readable before entering,
- safe return path to ship,
- physical reason for its economy: mine, lab, refinery, depot, hidden cache.

The player should understand function from silhouette before reading a paragraph.

## 5. Landing And Docking Relationship

Surface locations need approach logic:

- public landing pads accept autopilot approach if permitted,
- private pads require permission or mission,
- rough sites allow manual landing but no services,
- hidden sites may reject transponder or require low-signature approach,
- hostile sites may target ships before landing,
- storm/terrain sites may force distant landing.

Autopilot and HUD should explain:

```text
PAD AVAILABLE
PERMISSION REQUIRED
LANDING UNSAFE: SLOPE
HOSTILE DEFENSE ARC
FUEL DEPOT SERVICES AVAILABLE
```

## 6. NPC, Vendor And Mission Role Without Full RPG Complexity

V0 should avoid heavy RPG systems. Interaction can be:

- terminal-based shop,
- mission board,
- radio contact,
- faction status display,
- cargo contract kiosk,
- repair/refuel terminal,
- one named NPC represented by message panel,
- simple accept/decline job flow.

Mission types:

- deliver cargo,
- recover salvage,
- clear drone threat,
- scan anomaly,
- escort supply drone,
- bring fuel,
- repair generator,
- mine legal quota,
- investigate missing patrol.

## 7. Storage And Cargo Transfer

Outposts need explicit cargo rules:

- public storage may charge fees,
- faction storage requires reputation,
- player storage is persistent,
- illegal cargo may be refused or scanned,
- bulk transfer uses cargo ports, not suit inventory,
- volatile transfer requires safe tanks,
- samples require sealed lab storage.

Cargo UI should show:

```text
Source: Ship Cargo
Target: Corporate Refinery Intake
Mass: 2,400 kg
Fee: 3 percent
Legal status: licensed
Reputation change: +minor
```

## 8. Defense And Security

Defense systems make ownership real:

- warning beacons,
- scan gates,
- access doors,
- turrets,
- patrol drones,
- shielded storage,
- claim alarms,
- impound locks,
- minefields later.

Security should warn before firing except for pirates, old automated systems or explicitly hostile zones. Friendly outposts should escalate: warn, scan, fine, lock, then attack.

## 9. Faction Ownership

Ownership affects:

- docking permission,
- prices,
- legal mining,
- salvage rights,
- defense response,
- mission availability,
- map visibility,
- whether drones may operate nearby.

Ownership state should be visible on scanner and map:

```text
Owner: Frontier Settlers
Access: Public
Services: Fuel, Storage, Jobs
Threat: Low
```

## 10. Map And Scanner Appearance

Outposts appear in layers:

- unknown heat/EM source,
- detected structure,
- identified owner,
- services known,
- landing permission known,
- defense zone known,
- mission marker,
- restricted or hostile marker.

A player should be able to discover an outpost without immediately knowing everything about it.

## 11. Persistence

Outposts should persist:

- owner,
- service inventory,
- market prices or simplified stock,
- stored player cargo,
- accepted/completed jobs,
- destroyed/disabled defense systems,
- repaired generators,
- faction hostility,
- discovered map state.

Unloaded outposts can simulate only events:

- refinery processed cargo,
- mission expired,
- raid threat appeared,
- fuel restocked,
- faction relation changed,
- storage fee due.

## 12. Minimum First Playable

V0 outpost:

1. One small trade/mining outpost in a surface test range.
2. One landing pad or nearby safe landing marker.
3. One service terminal.
4. Ship cargo transfer.
5. Buy/sell one resource.
6. Refuel or repair one simple meter.
7. Owner/faction label.
8. One simple job, such as mine and deliver ore.

## 13. Future Scope

- walking NPCs,
- full dialogue,
- dynamic settlement growth,
- player base building,
- faction wars,
- hangar interiors,
- complex docking/traffic control,
- production chains,
- settlement damage and repair simulation,
- civilian population simulation.

## 14. Kurzfazit

Outposts make the planet economy playable. They are landing targets, service points, faction faces, cargo interfaces and conflict generators. The first version can be modest, but it must already connect ship landing, cargo transfer, ownership, trade, missions and safe return to space.
