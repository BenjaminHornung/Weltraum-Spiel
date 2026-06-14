# Background Simulation Boundaries

Stand: 2026-06-14
Status: Architecture concept for future loaded/unloaded simulation boundaries, no implementation

## 1. Goal

Weltraum-Spiel should support a world where drones mine, outposts trade, resources deplete, factions react and ships travel without keeping every Unity object alive at full fidelity. This document defines the future boundary between active Unity simulation and background data simulation.

Design rule:

```text
Loaded objects may use Unity physics.
Unloaded work must be represented as deterministic state and events.
```

## 2. Simulation Levels

| Level | Meaning | Examples |
| --- | --- | --- |
| Active physics | Unity Rigidbody, colliders, sensors and per-frame control are running. | Player ship, nearby drones, local obstacles, player body, active enemy. |
| Active scripted local | Object is loaded but may use simplified controller logic. | Surface NPC, drill animation, outpost terminal, parked vehicle. |
| Background event simulation | Object is unloaded but progresses by jobs, timers and deterministic events. | Mining drone extracting ore, refinery processing cargo, faction inspection starting. |
| Frozen persistent state | Object is unloaded and does not progress until revisited or triggered. | Decorative wreck debris, unopened cave door, inactive cargo crate. |
| Regenerated presentation | Object can be rebuilt from seed/state and is not individually saved. | Pebbles, dust, non-gameplay vegetation, minor visual clutter. |

The level can change as the player moves, saves, loads, timewarps or accepts missions.

## 3. Active Physics Bubble

Use active Unity physics for:

- player-controlled ship,
- player first-person body,
- currently piloted drone/vehicle,
- nearby collision-relevant obstacles,
- active docking or landing approach,
- local combat projectiles and targets,
- immediate resource interaction,
- local cargo transfer with physical proximity,
- hazards that can affect the player now.

Avoid active Unity physics for:

- distant drones,
- unloaded drills,
- far outposts,
- distant ships not interacting with the player,
- already simulated cargo transfers,
- visual-only debris,
- background resource extraction.

## 4. Approximate Analytical Simulation

Use analytical or simplified simulation for:

- future orbital/coasting paths,
- long-range route estimates,
- fuel/ETA planning,
- background ship travel,
- large map predictions,
- drone mission travel timers,
- cargo mass and capacity checks,
- surface weather windows.

Analytical simulation should produce clear events and states, not hidden corrections to loaded physics.

## 5. Event-Based Background Simulation

Background simulation should use durable jobs and events:

```text
JobStarted
JobProgressed
CargoFull
ExtractionComplete
DroneThreatened
DroneReturned
LostLink
StormArriving
FactionInspectionStarted
IllegalMiningDetected
OutpostProcessedCargo
MarketRestocked
MissionExpired
```

Events should carry:

- job/entity IDs,
- time or tick,
- location/frame/site reference,
- resource/cargo deltas,
- risk/faction consequences,
- next state,
- player-facing notification priority.

## 6. Drone Boundary Rules

### Loaded Drone

A loaded drone may use:

- local transform,
- simplified physics or Rigidbody,
- local collision,
- scanner rays,
- cargo transfer interaction,
- combat/avoidance behavior,
- direct player remote control.

### Unloaded Drone

An unloaded drone should use:

- mission state,
- absolute or surface-frame target references,
- cargo container state,
- power/fuel state,
- risk policy,
- deterministic travel/extraction timers,
- event outcomes.

Unloaded drones should not rely on:

- active GameObjects,
- per-frame pathfinding,
- hidden colliders,
- animation state,
- current Unity scene hierarchy.

## 7. Mining And Extraction Jobs

Mining jobs should be data records:

```text
jobId
siteId
surfaceFrameId
nodeId
actorId
method
targetContainerId
resourceRate
powerUse
signature
riskProfile
startTime
lastTickTime
state
```

Loaded extraction can show tool beams, drill animation, dust and local hazard cues. Unloaded extraction advances by ticks and may trigger events:

- partial cargo accepted,
- cargo full,
- tool durability lost,
- heat/noise attracted threat,
- legal inspection triggered,
- node depleted,
- drone recalled or disabled.

## 8. Outpost And Settlement Background State

Outposts should simulate only service-level state while unloaded:

- storage inventory,
- accepted/completed jobs,
- market stock bands,
- fuel availability,
- repair/refit availability,
- defense enabled/disabled,
- owner/faction status,
- alert/hostility state,
- storage fees or contract expiry.

They should not simulate:

- every NPC walking,
- every door animation,
- every turret aim frame,
- visual traffic unless needed for a mission,
- exact combat between distant minor actors.

## 9. Faction And Legality Boundaries

Faction consequences should be event-based:

- illegal mining detected,
- contraband scanned,
- protected sample collected,
- pirate camp alerted,
- outpost service denied,
- reputation changed,
- claim dispute opened.

The background sim should avoid surprise punishment without a readable chain. If a player action can trigger enforcement while unloaded, the game should have shown risk before the action or provide an event notification.

## 10. Cargo And Resource Boundaries

Cargo and resources are durable state. They should persist whether loaded or not:

- resource stack identity,
- quantity,
- mass,
- volume,
- owner/legal state,
- containment/hazard,
- container ID,
- location reference.

Visual piles, crates and ore chunks can be regenerated from cargo state. The cargo state itself cannot be regenerated from visuals.

## 11. Save/Load Rules

Save data must include:

- active local frame context,
- absolute entity state,
- active and background jobs,
- last simulation tick,
- resource/cargo containers,
- depletion state,
- drone missions,
- outpost services/storage,
- player/ship/drone handoff state.

On load:

1. Rebuild active frame and loaded objects near the player.
2. Reconcile background jobs from `lastTickTime` to current save time.
3. Emit any pending important events.
4. Keep unimportant visuals regenerated or dormant.

## 12. Timewarp And Offline-Like Progression

If timewarp or long waits exist later, background simulation must be bounded:

- cap risk checks per job,
- avoid simulating every second individually for long durations,
- use deterministic aggregate outcomes,
- pause or prompt on high-priority danger,
- keep player-facing consequences understandable.

Example:

```text
Mining drone extracted 120 kg ore.
Cargo became full after 38 minutes.
Storm risk paused extraction before damage.
```

## 13. What To Simulate When Player Is Not Nearby

Persist and progress:

- active drone missions,
- deployed drills,
- cargo transfers in progress,
- resource depletion,
- outpost storage and services,
- faction alerts,
- accepted missions,
- major hazards,
- important combat/defense outcomes if tied to a mission.

Persist but do not progress by default:

- parked vehicles,
- inactive cargo crates,
- unopened doors,
- disabled turrets,
- discovered map markers,
- static ruins/wrecks.

Regenerate:

- small rocks,
- dust,
- minor local clutter,
- non-gameplay plants,
- generic ambient fauna far away,
- non-critical VFX.

## 14. Determinism Requirements

Background ticks should be deterministic enough to test:

- same initial state and elapsed time produce same outcome,
- random events use saved seeds or explicit event tables,
- jobs are idempotent across save/load,
- partial ticks do not double-add cargo,
- failure reasons are explicit,
- player notifications are not duplicated.

## 15. Testing Plan

Recommended tests:

- background mining tick adds expected resources,
- cargo capacity stops extraction at the right point,
- drone travel job resolves to target state,
- unloaded outpost storage persists,
- faction alert event is emitted once,
- save/load resumes a job without double progress,
- unloaded site reloads with correct depletion,
- background sim does not require a Unity GameObject,
- timewarp aggregate outcome matches repeated smaller ticks within tolerance.

No Unity scene should be required for core background job tests.

## 16. Summary

The game can feel large only if most of it is not running as live Unity physics. Active bubbles provide tactile play; background data simulation provides continuity. The boundary must be explicit so drones, mining, cargo, outposts, factions and save/load remain reliable when the player is somewhere else.
