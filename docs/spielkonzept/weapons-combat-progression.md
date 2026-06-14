# Spielkonzept: Weapons, Combat And Progression

Stand: 2026-06-14
Status: Konzeptbasis fuer spaetere on-foot Waffen, Kampfrollen und Progression
Bezug: Ergaenzt bestehende Raumkampf-, Weapon-Computer-, Mining-, Ressourcen- und Faction-Richtung.

## 1. Ziel

On-foot combat soll gefaehrlich, lesbar und systemisch sein. Waffen sind nicht nur DPS-Werte, sondern Werkzeuge fuer Mining, Verteidigung, Drohnenabwehr, Tuer-/Panel-Arbeit, Abschreckung und Eskalation.

Leitsatz:

> A good on-foot weapon solves a kind of problem, consumes meaningful resources, creates a readable signature, and has consequences in the surrounding world.

## 2. Combat Design Principles

- On-foot combat should be dangerous; ships are powerful but not always usable.
- Weapons should be useful tools, not only DPS numbers.
- Different environments favor different weapons.
- Heavy weapons should need resources, heat management, ammo, or legal consequences.
- Turrets and ship guns should not trivially solve every planet problem.
- Combat should reinforce exploration, salvage, faction ownership and cargo decisions.

## 3. On-Foot Versus Ship Weapons

| Aspect | On-foot weapons | Ship weapons |
| --- | --- | --- |
| Scale | Personnel, drones, wildlife, turrets, doors, tools | Ships, stations, large turrets, surface targets |
| Precision | High local precision | High firepower, lower social/legal precision |
| Collateral | Dangerous in interiors, caves, settlements | Extreme collateral near outposts or protected biomes |
| Logistics | Ammo, batteries, heat, suit power | Ship ammo, capacitors, fuel, weapon computer |
| Access | Works indoors and under cover | Requires line of sight and safe firing geometry |
| Law | Concealable or restricted by zone | Obvious escalation, likely faction response |

Ships should dominate open battlefields, but many planetary problems happen under canopies, inside structures, near civilians, in caves, under shielded roofs or in zones where firing ship weapons is illegal.

## 4. Weapon Types

| Weapon type | Role | Range | Ammo/resource cost | Recoil | Sound/signature | Damage type | Armor interaction | Environmental risk | Crafting/upgrading resources | Relation to ship weapons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mining cutter as weak weapon | Emergency defense, cutting soft material, opening panels | Very short | Suit energy, tool durability | Low | Bright heat, low to medium sound | Thermal/cutting | Good vs light drones/panels, poor vs armor | Fire in oxygen-rich areas, heats volatiles | Common electronics, lenses, heat sinks | Miniature industrial cutter, related to beam/repair tools |
| Ballistic pistol/rifle | Reliable early combat and wildlife defense | Short to medium | Bullets from metals, propellant, casings | Medium to high | Loud, visible muzzle, low power draw | Kinetic/piercing | Good vs unshielded armor, weak vs heavy plating | Ricochet, hull breach, settlement alarm | Metals, ammo powder, salvage springs/barrels | Low-tech cousin to kinetic ship guns |
| Shotgun/close-range weapon | Burst damage, panic defense, cave fighting | Very short | Heavy shells, pellets/slugs | High | Very loud | Kinetic spread or slug | Strong vs soft targets, weak at range | Ricochet, collateral, fauna panic | Metals, propellant, reinforced receiver | No direct ship equivalent except flak/point defense logic |
| Laser cutter/laser rifle | Precise silent-ish tool/combat hybrid | Medium | Battery/capacitor charge, heat sinks | Very low | Low sound, high optical/thermal signature | Thermal/energy | Good vs exposed components, poor through reflective armor | Fire, overheating, atmospheric scatter | Crystals, capacitors, cooling loops | Shares focusing, heat and capacitor tech with ship lasers |
| Coil/rail weapon | Anti-armor precision, high-tier combat | Medium to long | Dense slugs, capacitors, coils | Medium impulse | Sharp EM/sonic crack, high EM signature | High-velocity kinetic | Excellent vs armor, drones, turrets | Overpenetration, magnetic interference | Dense metals, coils, advanced electronics | Direct miniaturization of rail/coil ship tech |
| Explosive/launcher | Area denial, breaching, anti-vehicle later | Short to medium | Expensive explosives, warheads, safety parts | Variable | Very loud, high heat, high legal signature | Blast, fragmentation, shaped charge | Good vs groups, doors, light vehicles | Cave collapse, fire, friendly damage, legal escalation | Volatiles, casings, fuses, guidance electronics | Shares missile/rocket logic with ship ordnance |
| Stun/EMP weapon | Disable drones, robots, shields, electronics | Short to medium | Capacitor charge, EMP cells | Low | EM spike, low acoustic | Electrical/EMP | Strong vs drones/security, weak vs organics | Can fry terminals, alert sensors | Capacitors, coils, rare electronics | Ground-scale electronic warfare from ship ECM/EMP tech |
| Melee/tool fallback | Last resort, silent utility | Touch | Durability/stamina/suit energy | None | Low | Blunt, cutting, shock | Poor vs armor except weak points | Close danger, contamination | Common materials, tool heads | No ship relation; reinforces emergency survival |

## 5. Damage Types

Suggested damage categories:

- kinetic,
- thermal,
- electrical/EMP,
- explosive,
- cutting,
- chemical/corrosive,
- blunt/impact,
- biological/toxic as hazard more than normal weapon.

Armor should not be a single health multiplier. It can react differently:

- soft suit armor resists fragments but not sustained heat,
- drone plating resists pistol rounds but exposes joints to cutters,
- shields resist kinetic better than EMP or sustained lasers,
- wildlife may ignore EMP but fear heat/noise,
- security doors require cutting, hacking or explosives.

## 6. Enemy And Combat Categories

| Category | Role | Typical behavior | Best counters | Rewards/risks |
| --- | --- | --- | --- | --- |
| Hostile drones | Common mechanical threat | Patrol, scan, call reinforcements, flank | EMP, rail/coil, weak-point laser | Electronics, batteries, legal ownership issues |
| Pirates/raiders | Human-like tactical enemies | Ambush, suppress, loot, retreat | Ballistics, cover, stealth, drones | Weapons, salvage, faction bounty |
| Automated security | Area control | Warn, escalate, turret lock, lockdown | Authorization, EMP, hacking, precision shots | Access to outposts, legal penalty if wrongful |
| Wildlife/fauna | Environmental pressure | Territory, swarm, ambush, flee from noise | Shotgun, deterrent tools, scanner avoidance | Bio samples, reputation risk on protected worlds |
| Environmental hazards | Non-enemy danger | Radiation, fire, cave-in, storm, gas | Suit upgrades, scanner, planning | Rare resources, forced evacuation |
| Faction military patrols | High consequence encounter | Challenge, scan cargo, enforce law | Comms, permits, retreat, non-lethal | Reputation, fines, combat escalation |
| Mining claim defense systems | Protect resource ownership | Turrets, drones, beacons, alarms | License, hacking, EMP, stealth | Claimed resources, legal conflict |

## 7. Environment-Driven Weapon Choice

| Environment | Favored tools | Discouraged tools |
| --- | --- | --- |
| Open regolith field | rifle, rail, drone support | shotgun unless close, melee |
| Cave | cutter, shotgun, pistol, scanner | explosives, ship weapons, high heat |
| Settlement/outpost | stun/EMP, sidearm, non-lethal options | heavy explosives, ship guns |
| Bio-dense Hestia biome | scanner, deterrents, low-fire weapons | incendiary/laser misuse, loud mining |
| Vacuum wreck | cutter, pistol, EMP | explosives, hull-puncturing rail shots |
| Storm zone | close weapons, drones with sensors | long-range precision lasers if visibility poor |
| Corporate facility | legal tools, hacking, EMP | illegal salvage weapons, open combat |

## 8. Progression Shape

Early:

- mining cutter,
- pistol or simple rifle,
- basic ammo crafting,
- weak EMP pulse or throwable,
- suit armor patch kits.

Mid:

- better scanner-assisted targeting,
- laser rifle,
- shotgun,
- specialized ammo,
- deployable cover/turret-lite tools,
- drone coordination.

Late:

- coil/rail rifle,
- heavy breaching launcher,
- advanced EMP,
- exotic lens upgrades,
- shield/armor specializations,
- faction-locked weapon tech.

Progression should widen options, not just increase damage numbers.

## 9. Ammo, Heat And Resource Costs

Resource economy keeps combat tied to mining:

- ballistic ammo consumes metals and propellant,
- lasers consume capacitors, energy and cooling,
- EMP consumes electronics and coils,
- rail weapons consume dense slugs and high power,
- explosives consume volatiles, casings and fuses,
- tool durability consumes repair parts.

This creates meaningful choices: use cheap ammo now, spend battery for stealth, save rail slugs for armored drones, or avoid the fight.

## 10. Legal And Faction Consequences

Weapons have social weight:

- settlements may ban long guns,
- corporate zones may scan for unauthorized explosives,
- wildlife preserves may punish incendiary weapons,
- salvage claims may become crimes if crates or drones are owned,
- firing ship weapons at surface targets may escalate to military response.

The scanner and HUD should label restrictions before the player crosses the line.

## 11. Why Ship Guns Do Not Solve Everything

Ship guns should not trivialize surface play because:

- caves, interiors and under-canopy sites are not visible from the ship,
- settlement collateral has reputation and legal consequences,
- ship line of sight is blocked by terrain,
- landing or hovering nearby may be impossible in storms or tight valleys,
- heavy fire can destroy fragile resources or mission items,
- some targets are too close to the player's own ship, drones or cargo,
- firing the ship reveals the player's position system-wide or locally,
- protected planets may prohibit bombardment.

Ship support should be useful as extraction cover, anti-vehicle defense or emergency overwatch, not the universal answer.

## 12. Minimum First Playable

V0 combat should include:

1. Mining cutter that can damage a simple drone slowly.
2. One basic sidearm or rifle.
3. One enemy drone with readable patrol/attack behavior.
4. Suit health and damage feedback.
5. Ammo or energy consumption.
6. One environmental risk that changes combat, such as explosive volatile node or low visibility.
7. Clear return-to-ship recovery loop.

## 13. Future Scope

- stealth systems,
- suppression and morale,
- full humanoid AI,
- wildlife ecosystem simulation,
- legal weapon permits,
- modular weapon crafting,
- ship-to-surface fire support UI,
- shields and armor layering,
- non-lethal bounty systems,
- multiplayer boarding/surface raids.

## 14. Kurzfazit

On-foot weapons should make surface decisions sharper. The player is vulnerable, tools matter, resources matter, and heavy escalation has cost. Combat is strongest when it forces the player to choose between risk, noise, legality, cargo, mission goals and the safety of the ship waiting nearby.
