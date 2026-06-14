# Architecture: Background Simulation For Drones

Stand: 2026-06-14
Status: Architekturplanung fuer spaetere Drohnen- und Remote-Mission-Simulation; keine Implementierung
Bezug: Baut auf Real-Scale World Architecture, Drones And Remote Missions, Resources/Mining/Crafting, Outposts, Factions/Economy und Autopilot-Konzepten auf.

## 1. Goal

Drone missions must continue when the player is elsewhere without requiring unloaded Unity GameObjects. The authoritative state is a deterministic data record. Loaded scenes may render or physically simulate drones, but unloaded missions advance through simplified ticks.

Core rule:

> Loaded drones can be objects; remote drones must be data.

## 2. Simulation Modes

| Mode | When used | Behavior | Authority |
| --- | --- | --- | --- |
| Loaded real physics | Player nearby, camera watching, combat active, direct remote control, docking/connector interaction. | Unity Rigidbody, sensors, collision and visible effects can run. | Mission state still owns objective/progress; scene object reports events back. |
| Loaded simplified | Drone visible but not in precision interaction. | Basic movement/path samples, simple hazards, no per-frame AI depth. | Mission state plus lightweight controller. |
| Unloaded background tick | Site or route not loaded. | Deterministic data updates for travel, extraction, transfer, risk, damage and consumption. | Mission data only. |
| Suspended | Missing prerequisite or explicit pause. | No progress except timers such as weather/legal deadlines where relevant. | Mission state. |

Switching modes must not duplicate rewards, cargo, damage or depletion.

## 3. Data Ownership

The following data must exist independently of loaded scene objects:

- drone id, type, owner and loadout,
- absolute or surface-frame position,
- mission id and mission state,
- cargo inventory and reservations,
- fuel/energy/ammo/durability,
- health/damage state,
- target entity/location,
- route legs,
- resource node depletion,
- legal/faction context,
- last event/notification id,
- save/load version.

Scene objects are projections of this state. They may cache animation, particle or local physics state, but they must not be the only source of mission progress.

## 4. Deterministic Tick Model

Background simulation should use fixed deterministic ticks.

Recommended planning shape:

```text
DroneMissionTick
  input: mission state, drone state, world time delta, target state, hazard state
  output: state delta, events, notifications, wake requests
```

Tick rules:

- Use fixed step accumulation, not frame delta.
- Clamp large offline time jumps into bounded chunks.
- Record last processed world time.
- Never instantiate unloaded GameObjects during normal background ticks.
- Use deterministic calculations for V0.
- If random events are later needed, seed them from mission id, world time bucket and stable hazard id.

## 5. Loaded Physics Behavior

When loaded, drones may:

- use Rigidbody movement,
- collide with terrain and obstacles,
- use simple local steering,
- attach to ship or cargo ports,
- mine with visible tool effects,
- take damage from actual projectiles/hazards,
- be remote-controlled later.

Loaded mode must report back:

- current position/velocity summary,
- cargo changes,
- resource extraction events,
- damage events,
- completed transfer events,
- blocked/failed path events,
- combat or legal events.

When unloading, the scene object must be collapsed back into the data state.

## 6. Unloaded Simplified Behavior

Unloaded behavior should calculate:

- travel time,
- work time,
- extraction rate,
- cargo transfer rate,
- fuel/energy/ammo consumption,
- damage/repair over time,
- route or hazard risk,
- mission state changes.

It should not simulate:

- per-frame Rigidbody motion,
- individual small avoidance maneuvers,
- local animation,
- visual particles,
- every projectile in a remote fight,
- inactive terrain colliders.

## 7. Travel Time

Travel can start simple:

```text
travelTime = routeDistance / effectiveDroneSpeed
```

Modifiers:

- cargo mass,
- terrain class,
- atmosphere/weather,
- legal stealth mode,
- damage,
- energy reserve policy,
- route risk avoidance.

The route should be stored as legs:

```text
ship -> pickup zone -> resource node -> ship cargo port
```

V0 can use straight-line distance in a local SurfaceLocalFrame. Later versions can replace the route calculator without changing the mission state contract.

## 8. Resource Extraction Rate

Extraction should depend on:

- resource type,
- node richness,
- node hardness/hazard,
- drone tool module,
- power availability,
- legal/noise policy,
- damage and overheating.

Simple V0 formula:

```text
extractedMass = min(remainingNodeMass, toolRateKgPerSecond * tickSeconds)
energyUsed = extractionEnergyPerKg * extractedMass
```

The tick must update both the node depletion and drone cargo atomically.

## 9. Cargo Transfer Rate

Cargo transfer should depend on:

- compatible cargo category,
- available volume/mass capacity,
- transfer endpoint type,
- connector access,
- sealed container requirements,
- legal scan/owner permission.

Transfer targets:

- drone internal cargo,
- deployable crate,
- ship cargo bay,
- outpost storage,
- repair inventory,
- later vehicle cargo.

Cargo identity must be shared with the resource/cargo model. Do not invent separate "drone ore" resources.

## 10. Risk Model

V0 should prefer deterministic hazards over opaque random failures.

Examples:

| Risk | Deterministic input | Result |
| --- | --- | --- |
| Storm | mission route crosses storm zone during time window | speed penalty, damage chance later, warning event |
| Patrol | route intersects hostile patrol zone | mission suspended or combat/security check |
| Illegal mining | node owner is faction and no permit | legal warning, fine/hostility event |
| Overheat | tool power above heat capacity for duration | extraction paused, damage if ignored |
| Cargo overload | cargo mass exceeds capacity | transfer stops, recall slower |
| Low energy | remaining energy below return reserve | mission pauses or recalls |

Later random rolls may exist, but player-facing risk should still name the source.

## 11. Enemy Encounter Risk

Remote combat must avoid hidden arbitrary loss.

Recommended model:

- Convert enemy presence to encounter pressure.
- Compare drone security rating, escort support, stealth and route danger.
- Produce events such as ThreatDetected, DroneDamaged, CargoStolen, DroneDisabled.
- Wake real scene if player chooses to intervene nearby or remote-control later.

V0 can omit combat and only report risk/suspension.

## 12. Damage And Repair

Damage state should be data:

```text
HullIntegrity
ToolIntegrity
MobilityIntegrity
CargoSealIntegrity
SensorIntegrity
WeaponIntegrity
```

Damage effects:

- lower speed,
- lower extraction rate,
- leak cargo/fuel for severe cargo seal damage,
- reduce scan quality,
- block recall if mobility is disabled,
- require repair drone, ship service or player surface recovery.

Repair uses shared cargo/resource items such as electronics, structural material, sealant, power cells and tool parts.

## 13. Power, Fuel And Ammo

Every mission estimates and consumes:

- travel energy/fuel,
- work energy,
- standby power,
- weapon ammo/energy,
- reserve needed for return,
- emergency beacon power.

The mission must warn before crossing reserve, unless the player chooses a risky policy.

## 14. Wake Conditions

The game should wake real Unity objects only when needed:

- player enters the local site,
- player switches to remote camera/control,
- drone enters combat that needs visible resolution,
- drone docks with the active ship/outpost,
- precise connector/cargo interaction is visible,
- mission reaches a recovery point near the player,
- debugging explicitly requests visualization.

Wake process:

1. Load or identify local frame.
2. Instantiate/project drone from data state.
3. Place it at the correct local position.
4. Apply cargo/damage/mission state.
5. Resume loaded controller.

Unload process:

1. Stop scene controller.
2. Persist position, cargo, damage and mission progress.
3. Destroy or pool the visible object.
4. Continue background tick from saved world time.

## 15. Save/Load Safety

Save data must include:

- mission records,
- drone records,
- route progress,
- cargo contents and reservations,
- target resource node depletion,
- faction/legal state,
- pending notifications,
- last tick time,
- deterministic seed/version if random hazards are later added.

On load:

- no drone mission should require a scene object to exist,
- duplicate completion rewards must be prevented,
- time since save can either be processed immediately or held until simulation resumes by design,
- player-facing status should explain any offline progress.

## 16. Integration With Autopilot

Drone routes should reuse concepts from ship navigation without duplicating ship autopilot:

- target points,
- route legs,
- safe approach/pickup zones,
- arrival tolerance by mission type,
- risk and reserve estimates,
- clear failure labels.

Do not make drone V0 depend on full ship autopilot execution. V0 can use deterministic route-time estimates and simple target locations.

## 17. V0 Background Tick

V0 target:

- one drone,
- one resource node,
- one ship cargo target,
- deterministic mission tick,
- no visible AI requirement,
- no pathfinding requirement,
- no economy requirement.

V0 test idea:

1. Create mission data with drone, node and ship cargo target.
2. Tick 10 seconds.
3. Assert node mass decreases.
4. Assert drone cargo increases.
5. Tick until drone cargo transfer.
6. Assert ship cargo increases.
7. Save/load state roundtrip.
8. Assert next tick continues without duplicate cargo.

## 18. Risks

| Risk | Mitigation |
| --- | --- |
| Drone autonomy scope creep | Keep V0 to a state machine and deterministic ticks. |
| Pathfinding on planet surfaces | Start with route legs and straight-line estimates; pathfinding later. |
| Duplicating ship autopilot | Share target/route concepts but do not copy full ship controller logic. |
| Background sim desync | Data state is authoritative; loaded objects reconcile on unload. |
| Cargo/resource identity mismatch | Use shared resource/cargo ids for all drone cargo. |
| Player confusion | Every failure must include reason, location and next action. |
| Hidden unfair loss | Use warnings and deterministic hazard causes before random destruction. |

## 19. Kurzfazit

Background drone simulation is a data architecture problem first. The mission tick decides time, work, cargo, risk and notifications. Unity objects are only the active presentation layer when the player is nearby, watching, controlling or intervening.
