# Spielkonzept: Drone Surface Mining And Logistics

Stand: 2026-06-14
Status: Planung fuer spaetere Drone-Mining-, Cargo- und Surface-Logistik; keine Implementierung
Bezug: Ergaenzt On-Planet First-Person Mode, Resources/Mining/Crafting, Planetary Exploration, Outposts, Drones And Remote Missions und Background Simulation.

## 1. Ziel

Drone surface mining turns a discovered resource site into an operation: choose a node, choose tools, assign drones, move cargo, react to risk, and decide when the operation is worth continuing.

Leitsatz:

> Mining is complete only when the extracted resource reaches a useful storage target or the player makes an informed decision to leave it behind.

## 2. Surface Mining Loop

1. Discover or scan resource site.
2. Confirm ownership, hazard and tool requirement.
3. Select deployment source: ship, surface crate, outpost or future vehicle.
4. Assign mining drone, hauler drone or one simple hybrid drone.
5. Mission estimates time, cargo, energy, risk and legal context.
6. Drone travels to node.
7. Drone extracts resource while consuming power/tool durability.
8. Cargo fills drone, crate or hauler.
9. Cargo moves to ship, outpost storage or another endpoint.
10. Player receives progress, warning, completion or failure.

## 3. Mining Site Data

Each resource site needs enough data for both loaded and background simulation:

| Field | Meaning |
| --- | --- |
| `resourceNodeId` | Stable id for depletion and save/load. |
| `resourceTypeId` | Shared resource/cargo id. |
| `remainingMass` | How much can still be extracted. |
| `qualityGrade` | Affects output value or refinement. |
| `hardness/toolRequirement` | Required mining module tier. |
| `hazardTags` | Heat, dust, gas, radiation, collapse, wildlife, security. |
| `ownerFactionId` | Legal owner or unclaimed. |
| `legalState` | Unclaimed, licensed, restricted, protected, illegal, contested. |
| `surfaceLocation` | SurfaceLocalFrame or absolute reference. |
| `pickupZone` | Safe-ish cargo point near the node. |
| `signatureProfile` | Noise/heat/EM produced when mined. |
| `depletionState` | Unknown, active, depleted, abandoned, contested. |

## 4. Cargo Endpoints

Drone mining should move resources through explicit endpoints:

| Endpoint | Role | Constraints |
| --- | --- | --- |
| Drone cargo | Temporary carry capacity. | Mass/volume, sealed containers, return reserve. |
| Deployable crate | Buffer at the site. | Can be stolen/damaged; needs recovery. |
| Ship cargo bay | Primary early-game destination. | Ship must be landed/nearby or have pickup zone. |
| Outpost storage | Industrial or legal destination. | Permission, fees, market/refinery link. |
| Vehicle cargo | Future rover/dropship support. | Surface route and vehicle system. |
| Refinery intake | Later direct processing. | Ownership, throughput, fees. |

V0 should use one ship cargo target.

## 5. Cargo Plan

Every mining mission should create a cargo plan:

```text
Source: ResourceNode.TharosRidgeA
Extraction: DroneMiningTool.BasicCutter
Intermediate: DroneCargo.SmallOreHopper
Destination: PlayerShip.CargoBay.Main
Resource: RawOre.IronSilicate
Expected: 40 kg
Reserve capacity required: 40 kg mass, 0.08 m3 volume
Legal: Unclaimed
```

The cargo plan prevents:

- mining when nowhere can hold output,
- duplicate cargo rewards,
- invisible conversion from resource node to ship inventory,
- confusion between sample cargo and bulk ore,
- hauler missions that have no valid pickup or dropoff.

## 6. Mining And Hauling Patterns

### Single Hybrid Drone

One drone mines and returns cargo.

Good for:

- V0,
- small nodes,
- safe sites,
- tutorial.

Limit:

- inefficient for large nodes,
- one drone pauses mining while traveling.

### Mining Drone Plus Ship Cargo

Mining drone extracts and periodically returns to ship.

Good for:

- early resource loop,
- landed ship nearby.

Limit:

- ship must stay available or mission suspends.

### Mining Drone Plus Hauler

Mining drone stays at the node; hauler shuttles cargo.

Good for:

- larger operations,
- outpost/refinery workflows.

Limit:

- requires route safety and cargo synchronization.

### Mining Drone Plus Security

Mining or hauler drones operate while security drone guards.

Good for:

- contested claims,
- pirate/wildlife pressure,
- legal patrol zones if authorized.

Limit:

- ammo/energy/legal escalation.

### Outpost Industrial Chain

Mining output goes to outpost storage/refinery.

Good for:

- licensed mining,
- faction contracts,
- long-running background operations.

Limit:

- fees, ownership and reputation.

## 7. Surface Route Risk

Hauling and mining routes should estimate:

- distance,
- terrain slope/class,
- hazard zones,
- hostile/security zones,
- storm windows,
- legal boundaries,
- cargo mass penalty,
- energy reserve.

V0 can use straight-line distance plus simple hazard flags. Later pathfinding can replace route calculation without changing mission/cargo records.

## 8. Player Interaction

### Deploy From Ship

The player selects:

- drone,
- target node,
- destination cargo target,
- risk policy,
- recall policy.

The ship computer should show:

- time estimate,
- cargo estimate,
- energy reserve,
- legal status,
- hazard warnings,
- what will happen if the player leaves.

### Assign On Surface

The player can scan a node and assign the drone from suit UI:

- mark node,
- choose nearby drone or ship bay,
- confirm cargo destination,
- start mission.

The suit UI should be simpler than the ship computer but still explain blocked prerequisites.

### Recall Drone

Recall options:

- return to ship with cargo,
- return to outpost,
- hold at pickup zone,
- abandon cargo and return,
- request recovery.

### Transfer Cargo

Cargo transfer should show:

- source and destination,
- mass/volume,
- resource identity,
- legal status,
- danger tag such as volatile or biohazard.

### Respond To Distress

Distress states:

- threatened,
- damaged,
- cargo full,
- power low,
- route blocked,
- illegal scan,
- disabled/recoverable.

Player response:

- recall,
- send security drone,
- send repair drone,
- go there personally,
- ignore,
- abandon mission.

## 9. Background Mining Rules

Unloaded mining should advance:

- extraction amount,
- node depletion,
- drone cargo,
- ship/outpost cargo transfer,
- energy use,
- tool wear,
- hazard escalation,
- mission events.

It should not require:

- terrain colliders,
- animated drill,
- loaded GameObject,
- active particle effects,
- per-frame pathfinding.

## 10. Integration With Factions

Mining mission legality:

| State | Behavior |
| --- | --- |
| Unclaimed | No legal penalty; normal hazards. |
| Licensed | Allowed within quota and tool/zone rules. |
| FactionOwned | Warn before extraction; may require permit. |
| Protected | Mining blocked or illegal unless special research permit. |
| Contested | Higher encounter risk; possible faction dispute. |
| PirateControlled | Legal issue low, combat risk high. |
| OldAutomated | Ownership unclear; defense drones or traps likely. |

The drone mission record should store legal context when the mission starts, then react if faction control changes.

## 11. Recovery

Damaged drone recovery should create gameplay:

- map marker at last known location,
- cargo may remain inside,
- repair drone or player can recover,
- hostile faction may impound,
- outpost can charge recovery fee,
- drone core can be salvaged if hull lost.

The game should avoid deleting expensive drones without readable cause.

## 12. V0 Surface Mining Slice

V0:

- one known resource node,
- one player-owned ship cargo target,
- one simple drone,
- simple deploy command,
- deterministic extraction tick,
- cargo moves into ship storage,
- mission completes or reports blocked reason.

No V0:

- full pathfinding,
- combat,
- economy pricing,
- faction permits,
- multi-drone coordination,
- remote camera,
- fully modeled drone bay.

## 13. Kurzfazit

Drone mining is logistics, not just extraction speed. The mission should explain the node, tool, cargo path, legal state, risk, time, and recall behavior. Once that data contract is clear, visible drones and richer AI can be added without changing what the operation means.
