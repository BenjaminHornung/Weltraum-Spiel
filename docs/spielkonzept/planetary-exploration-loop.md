# Spielkonzept: Planetary Exploration Loop

Stand: 2026-06-14
Status: Konzeptbasis fuer planetare Aktivitaeten, Sites und Surface Expedition Flow
Bezug: Verbindet on-planet First-Person Mode, Ressourcen, Drones, Autopilot, Settlements, Factions und Real-Scale SurfaceLocalFrames.

## 1. Ziel

Planetary exploration soll den Spieler von der Systemkarte bis zur Cargo-Rueckkehr fuehren. Ein guter Surface Site hat Ziel, Risiko, Werkzeugbedarf, Belohnung und Rueckbindung an das Schiff.

Leitsatz:

> A planetary activity is good when it starts as a map/scanner decision and ends as cargo, knowledge, reputation, damage, debt, upgrade progress or a new route.

## 2. Expedition Structure

1. Discover rough site from orbit, mission, rumor, drone, scan or faction board.
2. Select landing zone, outpost pad or dropship point.
3. Autopilot or manual flight brings ship to the approach area.
4. Surface scanner refines site position and hazards.
5. Player exits ship, vehicle or drone control.
6. Player investigates, mines, fights, trades, salvages or samples.
7. Cargo/data/resources return to ship, drone, vehicle or outpost storage.
8. Map updates with depletion, ownership, danger and follow-up leads.

## 3. Activity Types

| Activity type | Player objective | Required tools | Likely enemies/hazards | Resources/rewards | Ship/drone connection | Repeatability | Procedural vs hand-authored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Resource fields | Survey and extract ore, ice, volatiles or construction material | Scanner, mining cutter, drill, drone, vehicle, cargo | Claim defense, dust, heat, storms, pirates, cargo overload | Raw ores, volatiles, construction material, mining data | Ship cargo and autopilot route define profitability; drones can mine repeatably | High, with depletion and quality variance | Procedural fields with some authored hero nodes |
| Caves | Explore enclosed deposits, samples, ruins or shortcuts | Lights, scanner, cutter, oxygen, hazard suit, small weapons | Darkness, collapse, fauna, gas, radiation, lost signal | Rare crystals, bio samples, artifacts, hidden salvage | Ship cannot enter; drones scout but may lose signal | Medium | Mix: procedural layout shells with authored rooms |
| Wrecks | Salvage cargo, data cores, survivors or parts | Salvage tool, breacher, scanner, cargo drone, weapon | Traps, pirates, security drones, unstable reactors | Electronics, ship parts, logs, ammo, fuel, missions | Ship carries salvage; autopilot may mark crash site; drones haul | Medium, unique wrecks deplete | Hand-authored for story wrecks, procedural for small debris |
| Abandoned stations | Restore power, recover data, unlock storage | Cutter, power cells, hacking/terminal tool, weapon | Automated security, vacuum, radiation, locked doors | Components, old tech, faction clues, docking access | Can become docking/refuel point or map beacon | Low to medium | Mostly hand-authored modules with reusable room kits |
| Active outposts | Trade, refuel, accept missions, deliver cargo, negotiate | Comms, reputation, cargo, credits/resources | Social/legal risk, raids, inspections, faction hostility | Contracts, market access, fuel, repairs, storage | Direct cargo transfer, landing pads, drone services | High | Hand-authored anchors with procedural service inventory |
| Hostile camps | Remove threat, steal cargo, rescue captives, gather intel | Weapons, scanner, drones, stealth tools, cargo | Raiders, turrets, mines, alarms | Contraband, ammo, bounty, salvage, reputation | Ship extraction, overwatch and drone scouting matter | Medium | Procedural camp variants plus authored leader sites |
| Scientific anomalies | Scan, sample, stabilize or report unknown phenomenon | Advanced scanner, sample case, shielded suit, drone | Radiation, EM pulse, gravity weirdness later, faction competition | Research data, exotics, unlocks, story leads | Ship sensors discover; drones test danger; cargo handles samples | Low to medium | Hand-authored high-value events, procedural minor anomalies |
| Crashed ships | Rescue, salvage, investigate route failure | Med kit, cutter, cargo drone, beacon, weapon | Survivors, pirates, fire, fuel leak, security | Parts, fuel, mission chains, reputation | Autopilot route history and black box connect to space navigation | Medium | Mix: procedural crash layouts, authored important crashes |
| Underground facilities | Infiltrate, restore, loot, disable or research | Access tool, power, weapons, scanner, map beacons | Security, locked sectors, drones, oxygen loss | AI remnants, data, rare parts, faction secrets | Ship cannot help directly; drones relay/carry | Low | Mostly hand-authored |
| Weather-danger zones | Time entry, collect resources, survive and exit | Weather scanner, suit upgrades, vehicle, beacons | Lightning, storms, corrosive rain, low visibility | Storm crystals, exposed rare nodes, science data | Ship landing window and pickup timing matter | High if weather cycles | Procedural zones with authored landmarks |
| Rare landmark biomes | Document, sample, protect or exploit unique locations | Bio scanner, sealed samples, permits, light weapons | Wildlife, contamination, legal restrictions, terrain | Bio samples, reputation, discoveries, hidden nodes | Ship/drones map biome boundaries and carry sealed cargo | Low to medium | Hand-authored landmarks with procedural surroundings |

## 4. Discovery And Map Flow

Surface sites should move through discovery states:

```text
Unknown
Rumored
DetectedFromOrbit
Surveyed
LandingZoneConfirmed
Visited
Depleted
Secured
Contested
Restricted
LostContact
```

The player should be able to mark a site for later if current ship, tool, cargo or risk is insufficient.

## 5. Landing And Approach

Landing choices matter:

- close landing saves walking but may reveal ship or risk terrain,
- distant landing is safer but increases suit/cargo burden,
- outpost pad gives services but may include fees or inspections,
- dropship/drone insertion can reach places the main ship cannot land,
- storm windows and daylight can influence timing,
- autopilot should explain when a landing point is unsafe or inaccessible.

## 6. Player Decisions At A Site

A site should support several approaches where possible:

- mine manually,
- deploy drone,
- set drill and guard,
- sneak around patrol,
- fight directly,
- trade or negotiate,
- salvage only legal cargo,
- steal and accept consequences,
- scan and leave,
- mark for a future better ship/tool.

Not every site needs every option, but the UI should make available choices clear.

## 7. Risk Escalation

Risk should build visibly:

1. Low-level scan warnings.
2. Environmental cues.
3. Scanner classification.
4. Noise/heat/signature from player action.
5. Local response: wildlife, drones, faction call, weather shift.
6. Escape or completion pressure.
7. Persistent consequence: reputation, depletion, damage, new mission.

This makes danger feel earned rather than arbitrary.

## 8. Rewards

Rewards can be:

- bulk cargo,
- rare compact item,
- map data,
- route unlock,
- faction reputation,
- license,
- ship part blueprint,
- drone upgrade,
- weapon material,
- story clue,
- outpost service,
- rescue favor,
- black-market contact.

The best rewards should often connect multiple systems: for example, a science anomaly yields exotics plus a faction permit plus a new landing zone.

## 9. Repeatable Versus Unique Content

Repeatable content:

- resource fields,
- small pirate camps,
- simple wrecks,
- weather nodes,
- generic salvage,
- delivery outposts.

Unique content:

- major ruins,
- faction headquarters,
- old AI facilities,
- major crashed ships,
- rare Hestia landmark biomes,
- story anomalies.

Procedural generation should create variety, but hand-authored sites should define identity and memory.

## 10. Minimum First Playable

V0 exploration loop:

1. Map/HUD marks one surface resource site.
2. Player lands at a nearby safe point.
3. Player exits ship.
4. Scanner identifies a node and a hazard.
5. Player mines by hand.
6. A small threat or timer creates pressure.
7. Player returns to ship and transfers cargo.
8. Ship cargo unlocks a repair, fuel, or simple upgrade.

## 11. Future Scope

- full procedural planet sites,
- biome simulation,
- roaming patrol networks,
- dynamic faction control,
- weather forecasting,
- subterranean streaming,
- rescue chains,
- base construction,
- surface convoy logistics,
- orbital descent integration.

## 12. Kurzfazit

Planetary exploration is a route from space-scale planning to ground-scale decision and back again. The player should always know why the site matters, what tools are needed, what risk is growing, and how the result returns to ships, drones, cargo, factions or upgrades.
