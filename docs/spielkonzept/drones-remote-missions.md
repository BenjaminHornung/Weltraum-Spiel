# Spielkonzept: Drones And Remote Missions

Stand: 2026-06-14
Status: Planung fuer spaetere Drohnen, Remote-Missionen und Hintergrundsimulation; keine Implementierung
Bezug: Ergaenzt On-Planet First-Person Mode, Resources/Mining/Crafting, Planetary Exploration, Outposts, Factions/Economy, Ship Builder, Autopilot Player Experience und Real-Scale World Architecture.

## 1. Ziel

Drohnen sollen dem Spieler erlauben, Arbeit an Orten fortzusetzen, an denen der Spieler gerade nicht selbst steht: Ressourcenknoten abbauen, Gebiete auskundschaften, Cargo transportieren, Outposts schuetzen, Wracks bergen und Reparaturen vorbereiten.

Leitsatz:

> A drone is a useful remote worker only when its mission can be understood as data, simulated without a loaded Unity object, and brought back into the active scene when the player returns.

Die Drohne ist kein zweiter Spielercharakter und keine unsichtbare Einkommensquelle. Sie ist eine ausruestbare Einheit mit Aufgabe, Risiko, Cargo, Energie, Legalitaet, Fortschritt und Rueckrufregeln.

## 2. Nicht-Ziele

Dieses Dokument definiert nicht:

- Drohnenprefabs, Modelle, Animationen oder VFX,
- Unity-Komponenten oder Runtime-Code,
- finales KI-Verhalten,
- finales Pathfinding,
- finale UI-Flows,
- Balancewerte fuer Wirtschaft und Kampf,
- Multiplayer-Netcode,
- orbitales Drohnenflugmodell.

Die Planung muss spaetere Implementierung fuehren, ohne heute Code oder Assets zu erzeugen.

## 3. Warum Drohnen Wichtig Sind

Drohnen verbinden mehrere Kernsysteme:

- Surface gameplay: Spieler markiert, scannt, sichert oder repariert Orte.
- Resource loop: Drohnen extrahieren, laden, transportieren oder beproben Material.
- Ship loop: Schiffstraeger, Drone Bay, Cargo Bay, Fuel, Power und Autopilot setzen Grenzen.
- Outposts: Lager, Raffinerien, Pads und Service-Terminals geben Missionsziele.
- Factions: Besitz, Lizenzen, Schutzgebiete, Security und Piraterie bestimmen Risiko.
- Background simulation: Missionsfortschritt laeuft als Datenzustand weiter, nicht als deaktiviertes GameObject.
- Map discovery: Scout- und Probe-Missionen machen neue Ziele sichtbar.

## 4. Drone Deployment Sources

| Source | Use case | Constraints | Good V0 treatment |
| --- | --- | --- | --- |
| Ship drone bay | Normal deployment for mining, scout, hauler and repair drones. | Needs bay part, power, fuel/charge, physical launch zone, cargo link. | One abstract ship bay slot can launch one mission drone. |
| Ship cargo hatch | Emergency or low-end deployment from cargo. | Slower, limited drone size, no fast reload. | Future fallback; not V0. |
| Outpost pad/service | Local jobs, rental drones, defense support, cargo transfer. | Requires permission, fee, owner/faction context. | V1+ planning; data model must support owner. |
| Surface deploy crate | Player places small drone or drill by hand. | Requires suit carry, setup time, local safety. | Useful for mining V0 if ship is landed nearby. |
| Rover/vehicle bay | Extended surface logistics. | Future vehicle system. | Future only. |
| Probe tube | One-way or recoverable long-range survey. | Low cargo, limited control, communication delay later. | Future map-reveal mission type. |

Deployment must create a mission-capable data record even if a visible drone object is spawned in the loaded scene.

## 5. Drone Roles

### 5.1 Scout Drone

Purpose:

- scan terrain,
- reveal resource fields,
- identify outposts, hazards, patrols and landing/pickup zones,
- extend suit or ship sensor range.

Characteristics:

- low cargo,
- low combat,
- high sensor range,
- low extraction ability,
- strong map-discovery value.

Best missions:

- survey site,
- confirm landing zone,
- scout route,
- track enemy patrol,
- classify resource node,
- inspect restricted zone without landing ship.

Failure shape:

- signal lost,
- damaged by weather/security,
- detected by faction,
- returns partial scan data.

### 5.2 Mining Drone

Purpose:

- mine surface resource nodes,
- operate a drill/cutter/siphon,
- fill internal cargo or nearby container,
- continue work while player scouts, guards or leaves.

Characteristics:

- medium cargo,
- vulnerable while mining,
- requires power/tool modules,
- creates noise/heat/signature,
- may need hauler support for bulk nodes.

Best missions:

- extract ore batch,
- mine volatile pocket with sealed module,
- collect marked sample with correct tool,
- run timed extraction while player secures the site.

Failure shape:

- cargo full,
- tool overheated,
- power low,
- node hazardous,
- illegal mining detected,
- damaged while stationary.

### 5.3 Hauler Drone

Purpose:

- move cargo between resource node, container, ship, outpost or vehicle,
- keep mining productive without the player hand-carrying bulk goods.

Characteristics:

- high cargo for its size,
- low mining ability,
- route risk matters,
- capacity, fuel/energy and transfer compatibility are central.

Best missions:

- shuttle ore from mining drone to ship,
- deliver sealed samples to outpost lab,
- retrieve dropped cargo,
- move repair parts to damaged drone,
- resupply ammo/fuel to combat drone.

Failure shape:

- route blocked,
- cargo incompatible,
- fuel/energy insufficient,
- attacked in transit,
- destination storage full or illegal.

### 5.4 Combat/Security Drone

Purpose:

- protect mining operation, outpost, player, ship or convoy,
- escort haulers,
- suppress light hostile drones or wildlife,
- warn before mission site becomes unsafe.

Characteristics:

- low to medium cargo,
- ammo/energy usage,
- higher legal/faction consequences,
- risk of collateral damage,
- may escalate local hostility.

Best missions:

- guard mining site,
- escort hauler,
- patrol outpost perimeter,
- hold pickup zone,
- distract hostile drones while player escapes.

Failure shape:

- ammo depleted,
- disabled by superior force,
- illegal weapon discharge,
- faction complaint,
- mission suspended due to rules of engagement.

### 5.5 Repair/Utility Drone

Purpose:

- repair ship modules, outpost components, drones or surface equipment,
- interact with connectors, cargo ports, power couplings and salvage points,
- support recovery after combat or environmental damage.

Characteristics:

- low combat,
- low to medium cargo,
- consumes parts, power and repair tool durability,
- depends on connector/tool compatibility.

Best missions:

- patch damaged mining drone,
- repair ship landing gear or exposed module,
- restore outpost generator,
- salvage usable electronics from wreck,
- connect cargo hose or power relay.

Failure shape:

- missing repair parts,
- connector inaccessible,
- hazard too high,
- repair incomplete without player intervention.

### 5.6 Probe/Survey Drone

Purpose:

- reveal remote map locations,
- sample hazardous zones,
- enter one-way or long-range survey paths,
- future orbital/surface bridge.

Characteristics:

- very low cargo,
- high sensor or science value,
- one-way or recoverable variants,
- minimal direct control,
- can be cheap enough to lose.

Best missions:

- map unknown canyon,
- test radiation zone,
- sample atmosphere,
- reveal landing/pickup zones,
- deploy beacon.

Failure shape:

- consumed as one-way probe,
- partial telemetry only,
- recovery optional,
- faction detects unauthorized survey.

## 6. Remote Mission Model

Every drone task should become a remote mission record. A mission can have visible Unity objects while loaded, but the record is authoritative.

Minimum fields:

| Field | Meaning |
| --- | --- |
| `missionId` | Stable save/load id. |
| `ownerId` | Player, faction, outpost, contract giver or temporary controller. |
| `assignedDroneIds` | One or more drones assigned to the mission. |
| `targetEntityId` | Resource node, outpost, container, enemy, wreck, beacon or site id. |
| `targetLocation` | Absolute/surface-frame location when no entity is loaded. |
| `objectiveType` | Scout, mine, haul, guard, repair, salvage, probe, recall, recover. |
| `routePlan` | Waypoints or simplified route legs in the relevant frame. |
| `resourceCargoPlan` | Expected input/output, cargo reservations, transfer endpoints. |
| `riskEstimate` | Player-readable risk band and cause list. |
| `timeEstimateSeconds` | Planned duration including travel, work and return if needed. |
| `fuelEnergyEstimate` | Required and reserve energy/fuel/ammo. |
| `requiredEquipment` | Tool, cargo module, sealed tank, weapon, sensor, connector, permit. |
| `factionLegalContext` | Owner, permit, restricted status, illegal flags, rules of engagement. |
| `state` | Planned, Active, Suspended, Completed, Failed, Aborted, RecallRequested. |
| `progress` | Work amount, travel leg, cargo moved, scan coverage, combat outcome. |
| `notificationPolicy` | What should interrupt, warn or silently log. |
| `abortRecallPolicy` | Safe abort, dump cargo, return home, hold position, request pickup. |

## 7. Mission State Flow

```text
Planned
Active
Suspended
RecallRequested
Completed
Failed
Aborted
Recoverable
```

Rules:

- Planned missions reserve drones and optionally reserve cargo space.
- Active missions consume time, energy/fuel/ammo and may change cargo/resource state.
- Suspended missions stop progress because of blocked route, full cargo, legal risk, low power, lost link or missing target.
- RecallRequested missions prioritize return or safe hold based on policy.
- Completed missions produce cargo, map data, repaired state, defended interval or mission credit.
- Failed missions must include a reason and recovery option when possible.
- Recoverable means the drone or cargo remains at a location and can be retrieved by player or another drone.

## 8. Player Notifications

Notifications must be useful, not noisy.

Immediate interrupt:

- drone under attack,
- illegal action about to escalate,
- drone disabled,
- valuable cargo at risk,
- recall cannot complete,
- mission objective changed.

Non-interrupt warning:

- cargo nearly full,
- power low,
- storm approaching,
- route risk increased,
- faction scan started.

Log only:

- scan coverage increased,
- routine cargo transfer done,
- extraction batch completed if mission is repeatable,
- drone returned safely.

Every notification should include a player action:

```text
MINING DRONE THREATENED
Site: Tharos Ridge Node A
Cause: hostile patrol detected
Actions: recall, send security drone, ignore, set hold position
```

## 9. Abort And Recall

Abort and recall are separate:

- Recall means return to assigned home, ship, outpost, pickup zone or safe hold.
- Abort means stop objective and resolve cargo/tools according to policy.

Recall can fail if:

- drone has no power,
- route is unsafe,
- cargo prevents movement,
- communication is lost,
- faction impounds or jams the drone,
- drone is physically stuck while loaded.

Abort policies:

| Policy | Behavior |
| --- | --- |
| Safe return | Stop work and return with cargo. |
| Cargo priority | Keep cargo even if slower/riskier. |
| Drone priority | Dump cargo if needed to survive. |
| Hold position | Stay near target and wait. |
| Self-preserve | Avoid combat and hide if possible. |
| Contract strict | Continue unless explicit player recall. |

## 10. V0 Slice

V0 must prove the architecture without pretending to be full AI.

V0 includes:

- one scout/mining-capable drone,
- one resource node,
- one ship cargo target,
- one remote mission state machine,
- data-first mission state,
- deterministic background tick,
- no full pathfinding,
- no full economy,
- no combat AI,
- no complex UI beyond status/debug or a simple panel later.

V0 player story:

1. Player deploys a simple drone from the ship.
2. Player assigns mining at one known resource node.
3. Drone mission progresses as data.
4. Resource amount decreases.
5. Drone cargo fills.
6. Cargo transfers to ship target.
7. Mission completes or reports why it cannot.

## 11. Player-Facing Contract

The player should always be able to answer:

- Where is my drone?
- What is it doing?
- What does it need?
- What cargo or data has it produced?
- What can go wrong?
- Who might care legally?
- Can I recall it?
- What happens if I leave?

If the UI cannot explain a mission failure, the failure rule is not ready.

## 12. Kurzfazit

Drohnen machen das Weltraum-Spiel groesser, ohne dass jeder Ort dauerhaft geladen sein muss. Der entscheidende Schritt ist nicht ein cleveres Drone GameObject, sondern ein klarer Remote-Mission-Datenzustand, der Cargo, Ressourcen, Risiko, Legalitaet, Zeit und Spielerbenachrichtigung verbindet.
