# Spielkonzept: On-Planet First-Person Mode

Stand: 2026-06-14
Status: Konzeptbasis fuer spaetere planetare First-Person-Spielbarkeit, keine Implementierung
Bezug: Baut auf Startsystem, Real-Scale World Architecture, Navigation Computer, Drones and Remote Missions, Persistence, Autopilot Player Experience und kuenftiger Ship-Builder-Richtung auf.

## 1. Ziel

On-planet first-person mode ist die Schicht, in der der Spieler den Raumfahrtkreislauf aus naechster Naehe beruehrt: landen, aussteigen, scannen, abbauen, handeln, kaempfen, reparieren, bergen und wieder zum Schiff zurueckkehren.

Leitsatz:

> The player goes on foot when precision, risk, access, legality, social contact, or environmental complexity makes the ship or drone alone insufficient.

Dieser Modus ist kein separates Survival-Spiel. Er ist die menschliche Schnittstelle zu Ressourcen, Orten, Factions, Ruinen, Outposts, Drones, Ship Builder und Autopilot.

## 2. Nicht-Ziele

Dieses Dokument definiert nicht:

- fertige Controller-Implementierung,
- finale Keybinds,
- Unity-Szenen,
- Terrain-Streaming,
- Charaktermodelle,
- Animationen,
- finalen Waffen-Balance,
- finales Crafting-System,
- Multiplayer-Architektur.

Es definiert, was die First-Person-Schicht fuer Spieler leisten soll.

## 3. Gameplay Pillars

| Pillar | Bedeutung |
| --- | --- |
| Fast to understand | Der Spieler weiss schnell, warum er aussteigt und was der naechste sinnvolle Schritt ist. |
| Precise interaction | Dinge, die am Boden passieren, brauchen genaue Positionen, Werkzeuge und Entscheidungen. |
| Logistics matter | Suit, Cargo, Drone, Vehicle und Ship Storage sind echte Grenzen, keine kosmetischen Werte. |
| Dangerous but readable | Gefahr soll frueh erkennbar sein: Sensorwarnung, Wetter, Spuren, Faction-Marker, Hitze, Laerm. |
| Space loop reinforcement | Alles am Boden fuehrt zurueck zu Schiff, Drohnen, Navigation, Ressourcen, Upgrades, Handel oder Reputation. |
| Player agency | Der Spieler kann manuell handeln, Drohnen einsetzen, markieren, kaempfen, handeln, schleichen oder spaeter zurueckkehren. |

## 4. Warum der Spieler auf Planeten geht

Der Spieler geht auf Planeten, weil dort Dinge existieren, die im Orbit oder aus dem Schiff heraus nur unvollstaendig geloest werden koennen:

- feine Ressourcenknoten, die genaue Analyse oder manuelles Freilegen brauchen,
- Ruinen, Wracks, Hoehlen, Bunker und Outposts, die fuer Schiffe zu eng sind,
- Faction-Kontakte, Haendler, Lizenzen, Hinweise und Missionen,
- Bergung von empfindlichen Teilen, Datenkernen oder Artefakten,
- Reparaturen an externen Modulen, Landestuetzen, Sensoren oder Drohnen,
- leise Erkundung ohne die hohe Signatur eines Schiffs,
- biologische, geologische oder wissenschaftliche Proben,
- Gefahren, die nicht sinnvoll mit Schiffskanonen geloest werden duerfen.

## 5. Was der Spieler zu Fuss besser kann

| Aufgabe | Warum zu Fuss besser |
| --- | --- |
| Fein-Scan | Suit-Scanner kann kleine Proben, Oberflaechenadern und lokale Anomalien genauer erfassen. |
| Manuelle Bergung | Fragile Komponenten oder Datenkerne werden zerstoert, wenn ein Schiff sie grob extrahiert. |
| Innenraeume | Ruinen, Hoehlen, Bunker und Outposts haben enge Raeume, Tueren, Terminals und Deckung. |
| Soziale Interaktion | Lizenzen, Handel, Missionen und Reputation brauchen Praesenz an Orten und Faction-Kontakt. |
| Niedrige Signatur | Zu Fuss oder mit kleiner Drohne kann der Spieler weniger auffallen als mit einem Schiff. |
| Umweltarbeit | Reparieren, Markieren, Bojen setzen, Sprengladungen platzieren und Proben nehmen sind lokale Handlungen. |
| Risikoentscheidung | Der Spieler kann entscheiden, ob er selbst hineingeht, eine Drohne schickt oder das Gebiet meidet. |

## 6. First-Person Interaction Loop

Der Kernloop:

1. Land ship or arrive by dropship/drone.
2. Exit ship.
3. Scan area.
4. Identify resource node, ruin, wreck, outpost, cave, anomaly, enemy patrol, or mission object.
5. Decide: mine manually, deploy drone, fight, sneak, trade, salvage, or mark for later.
6. Transfer resources to suit, drone, vehicle, or ship cargo.
7. Return to ship or call pickup.
8. Resources unlock, craft, repair, refuel, upgrade, sell, or progress missions.

Der Loop funktioniert auch ohne grosse Story: Ein klarer Ort, ein klares Risiko, eine Ressource oder Entscheidung, ein Rueckweg zum Schiff.

## 7. Player Movement Assumptions

Bewegung ist planetenabhaengig, aber anfangs bewusst einfach:

- First-person walking, running, crouching and jumping.
- Planetary gravity affects movement, jump height, fall risk and stamina/energy use.
- Suit assists smooth extreme gravity differences, but does not remove them.
- Slopes, loose regolith, ice, mud and biological ground can affect traction.
- Climbing and mantling are later polish; V0 may use ramps, stairs and simple obstacles.
- EVA-style thrusters are not the default on atmospheric planets, but suit boost or low-G hops can be future scope.
- Movement must feel grounded enough that mining and combat have weight, not pure zero-G drifting.

Surface play occurs in a `SurfaceLocalFrame`. The player does not walk in system-scale coordinates; the ship, landing point, outpost and resource nodes are projected into a local surface scene or chunk.

## 8. Camera Mode And Controls

Default camera:

- first-person body camera,
- head-height view with minimal camera bob,
- tool/weapon visible in hand,
- HUD integrated into helmet/suit display,
- clear reticle or focus marker for interaction,
- scanner overlay as a mode, not a permanent screen-covering effect.

Control assumptions:

- normal movement: walk, sprint, crouch, jump,
- interact key for terminals, loot, cargo ports, doors and tools,
- scanner key or mode to highlight resources, hazards and faction markers,
- tool/weapon selection via quick slots,
- hold-to-transfer for cargo actions to avoid accidental drops,
- emergency return/ship beacon command from suit UI.

The mode should not reuse ship controls blindly. First-person controls should feel familiar, while retaining specific Weltraum systems like suit energy, cargo mass and scanner data.

## 9. Suit, Oxygen, Energy And Health

The suit is the player's portable ship system. It has limited but readable state.

| System | Purpose | Gameplay effect |
| --- | --- | --- |
| Oxygen | Supports hostile or unknown atmospheres. | Limits time outside safe zones; refill from ship/outpost/tanks. |
| Suit energy | Powers scanner, mining tool, shields, lights, temperature control and comms. | Forces loadout and expedition planning. |
| Health | Tracks physical injury. | Combat, falls, wildlife and hazards matter. |
| Pressure seal | Protects from vacuum, thin atmosphere, high pressure and toxins. | Damaged suit becomes urgent. |
| Thermal control | Protects against heat/cold. | Planet choice and day/night timing matter. |
| Radiation shielding | Protects in solar, reactor, exotic or gas-giant moon zones. | Drives upgrade progression. |
| Contamination filter | Handles spores, corrosives, dust and biological exposure. | Especially important on Hestia-style living worlds. |

The suit should warn early:

```text
OXYGEN LOW
SUIT POWER LOW
FILTER SATURATED
THERMAL LOAD RISING
PRESSURE SEAL DAMAGED
RADIATION SPIKE
```

## 10. Interaction Model

Interactions should be consistent:

- Look at object.
- UI shows name, distance, owner/faction if known, action and required tool.
- Tap for simple action.
- Hold for irreversible, noisy, illegal or time-consuming action.
- Scanner reveals hidden quality, composition, ownership, hazard and mission relevance.
- If blocked, UI explains why.

Examples:

```text
Iron-Silicate Vein
Action: Mine
Tool: Cutter Tier 1
Yield: low mass ore
Risk: dust, low
Owner: unclaimed
```

```text
Corporate Cargo Crate
Action: Open
Tool: authorization or breacher
Risk: illegal salvage
Owner: Aurelian Extraction Combine
```

The game should avoid vague prompts like `Use` when a better action name exists.

## 11. Inventory And Carry Limits

The player has a suit inventory, but most serious logistics must involve ship, drone or vehicle cargo.

Suit carry rules:

- Suit inventory has both mass and volume limits.
- Heavy resources slow the player or increase suit energy use.
- Volatiles, hot samples, biological matter and explosives need containers.
- Mission items may occupy dedicated sealed slots.
- The player can carry small valuables, tools, ammo, samples and compact components.
- Raw bulk ore belongs in drone, rover, deployable container or ship cargo.

Cargo transfer targets:

- Suit inventory.
- Hand container.
- Deployable cargo crate.
- Mining drone.
- Cargo drone.
- Surface vehicle.
- Ship cargo bay.
- Outpost storage, if owned or permitted.

Transfer UI must show mass, volume, ownership and danger state.

## 12. Entering And Exiting The Ship

The ship is the anchor of an expedition.

Required behaviors:

- Ship can be landed, docked, parked at a pad, or approached by dropship/drone.
- Player exits through ramp, airlock or hatch.
- Exit point must be safe enough: not blocked, not inside terrain, not under lethal engine plume.
- Re-entry restores a safe interior or cockpit mode.
- Cargo transfer should be possible at a cargo port without walking every item by hand.
- If the ship is damaged, buried, under attack or legally impounded, the UI must say so.

Design rule:

> A surface expedition is complete only when the player, cargo, drone or mission data gets back into the wider space-game state.

## 13. Drones And Vehicles

Drones and vehicles bridge first-person and space systems.

Use cases:

- Scout drone maps terrain beyond suit scanner range.
- Mining drone extracts while player secures or scouts.
- Cargo drone shuttles ore between node and ship.
- Repair drone patches ship or suit systems.
- Rover or small vehicle carries heavy cargo and power cells.
- Remote control allows the player to stay in cover or inside the ship.

Entering/exiting rules:

- Player may directly pilot small vehicles if present.
- Player may remote-control drones from suit, vehicle, ship or outpost terminal.
- Control transfer must be explicit, with return-to-body safety.
- If remote link is lost, drone follows its mission risk policy.

## 14. Scanning, Mining And Interacting

Scanning layers:

| Layer | Tool | Reveals |
| --- | --- | --- |
| Orbit survey | ship sensors | broad resource fields, landing zones, hazards, faction zones |
| Low-altitude scan | ship/drone | precise site markers, patrols, heat, emissions |
| Suit scan | player | exact node composition, tool requirement, sample quality |
| Deep scan | deployable/drone | buried seams, cave voids, ancient structures |

Mining interaction:

- Scan the node.
- Confirm ownership and hazard.
- Choose extraction method.
- Spend time, power and durability.
- Generate noise/heat/signature.
- Transfer output to suitable storage.
- Mark depleted or partially depleted state for persistence.

Interacting includes terminals, doors, data cores, sample stations, cargo ports, faction kiosks, repair panels and construction nodes.

## 15. Combat Basics

On-foot combat is dangerous and tactical.

Core assumptions:

- The player is fragile compared with ships.
- Cover, range, visibility, sound and suit state matter.
- Weapons are also tools: cutters, EMP, breachers, mining charges and repair gear.
- Heavy weapons are expensive, loud, hot, illegal or dangerous in confined spaces.
- Ship weapons are powerful but limited by line of sight, collateral risk, laws, terrain, atmosphere and landing safety.

Combat should support:

- hostile drones,
- pirates/raiders,
- automated security,
- faction patrols,
- claim defense turrets,
- wildlife/fauna where appropriate,
- environmental hazards as non-enemy threats.

## 16. Environmental Hazards

Planet surfaces are not neutral floors.

Hazards:

- gravity too high or too low,
- vacuum, thin atmosphere or toxic atmosphere,
- high pressure or corrosive clouds,
- heat, cold and day/night extremes,
- storms, lightning, dust, ash, acid rain,
- unstable terrain, sinkholes, caves and rockfalls,
- radiation, solar events and reactor leaks,
- biological spores, toxins, predators or aggressive plant analogues,
- lava, cryovolcanic vents, geothermal fields,
- legal danger from restricted zones and protected ecosystems.

The scanner should make hazards readable before they become cheap deaths.

## 17. Death And Failure Rules

Failure should create consequences without breaking the space-game loop.

Possible failure states:

- player incapacitated and recovered at ship medbay,
- player respawns at nearest owned ship, station or outpost,
- carried cargo is dropped or lost if unrecovered,
- mission item may remain recoverable at the site,
- suit damage persists until repaired,
- faction consequences persist,
- drones keep executing their mission unless recalled or threatened,
- ship can remain landed, damaged or impounded.

Avoid:

- random instant death without warning,
- deleting the ship because the player failed on foot,
- background destruction without a readable event.

## 18. Save And Checkpoint Assumptions

Singleplayer save points can be pragmatic:

- manual save allowed in safe ship/outpost interiors,
- autosave on landing, exiting ship, entering ship, completing transfer, accepting mission, or returning with cargo,
- emergency checkpoint when entering a dangerous site,
- persistent state for resources, doors, cargo, enemies, drones and ship position.

If a save is loaded mid-expedition, the game must reconstruct:

- player body state,
- suit state,
- ship landed/docked state,
- cargo ownership,
- active drones,
- local site depletion and mission progress.

## 19. Singleplayer Compatibility

The mode must work fully in singleplayer:

- local process is authoritative,
- background drones can continue through data simulation,
- time does not need global multiplayer authority,
- encounter events can pause or request player attention,
- no required online services,
- no reliance on other human players for mining, combat or trade.

The data model should remain compatible with later multiplayer by keeping ownership, faction, cargo and absolute/surface frame state explicit.

## 20. Simulation When Player Is Not Nearby

Not every surface detail should be simulated at full fidelity when unloaded.

Persist and simulate:

- resource node depletion and ownership,
- deployed drills and drones,
- cargo containers,
- outpost inventory and trade state,
- faction alerts and claim status,
- mission objectives,
- major hazards such as storm fronts or radiation zones,
- dead/destroyed important enemies,
- doors/terminals if mission relevant.

Do not fully simulate:

- individual small animals far away,
- visual debris,
- every rock particle,
- detailed combat in an unloaded cave unless it is an explicit event,
- per-frame physics for unloaded drills or rovers.

Use event-based background simulation:

```text
DrillExtracted
CargoFull
DroneThreatened
StormArriving
FactionInspectionStarted
IllegalMiningDetected
```

## 21. Minimum First Playable Version

V0 on-planet mode should be intentionally small:

1. Isolated surface test scene, not full planet streaming.
2. One landed ship with an exit/entry point.
3. First-person controller with suit HUD.
4. One scanner mode.
5. One resource node.
6. One hand mining tool.
7. Suit inventory and ship cargo transfer.
8. One basic hazard, such as oxygen drain or radiation zone.
9. One simple hostile drone or static turret only if combat is in scope.
10. Return-to-ship completion loop.

V0 success is not a huge planet. V0 success is the player understanding: "I landed, got out, found something, used a tool, moved cargo back to my ship, and the ship game cared."

## 22. Explicit Future Scope

Future scope:

- seamless orbital descent,
- large streamed terrain,
- complex NPC dialogue,
- full settlement AI,
- base building,
- complex creature ecology,
- procedural cave networks,
- deep-core mining,
- faction war simulation,
- multiplayer surface raids,
- advanced vehicles,
- full body animation,
- gravity/orbit/landing integration,
- multi-crew ship interiors.

These should not block the first playable surface loop.

## 23. Kurzfazit

On-planet first-person mode makes the space game tactile. The player leaves the ship because some problems require hands, eyes, risk and presence. The mode must stay connected to ships, drones, resources, cargo, factions, autopilot and ship building. A good first version is small, readable and useful: land, exit, scan, choose, extract, transfer, return.
