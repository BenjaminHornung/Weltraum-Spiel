# Design

## Overview

This planning package treats drones as remote mission executors. A drone may be visible and physically simulated when loaded, but the mission record owns progress, cargo, risk, legal context and save/load continuity. This matches the existing real-scale architecture direction: active local scenes show only the current interaction zone, while remote ships, drones and outposts continue as data.

## Core Design Decisions

### 1. Data-First Mission Records

Future implementation should introduce a mission record before sophisticated drone AI. The mission record stores:

- mission id,
- owner/faction context,
- assigned drone ids,
- target entity or location,
- objective type,
- route legs,
- cargo/resource plan,
- risk/time/fuel/energy/ammo estimates,
- required equipment,
- state and progress,
- notification and recall/abort policy.

Reasoning:

- Save/load works without loaded GameObjects.
- Background simulation can continue while the player is elsewhere.
- UI can explain progress and failure.
- Later visible AI can be swapped without changing the player-facing contract.

### 2. Loaded Objects Are Projections

Loaded drones may use real Unity physics, simple local steering, visible mining tools, combat effects or connector interactions. They still project from and report back to mission/drone data. Unloaded drones advance through deterministic state transitions.

This avoids two common failures:

- a drone exists only as a disabled scene object and cannot continue remotely,
- a background mission creates cargo or damage that the visible drone cannot reconcile when loaded.

### 3. Deterministic Background Tick Before Random Events

The V0 background tick should be deterministic:

- resource extraction rate,
- cargo transfer rate,
- travel time,
- power consumption,
- blocked reasons,
- simple hazard modifiers.

Random risk can come later, seeded by mission id/time/hazard id, but the first playable slice should be reproducible and testable.

### 4. Shared Cargo And Resource Identity

Drones must use the shared resource/cargo model. There should not be separate "drone ore", hidden mission reward counters or invisible cargo conversion. Extraction changes a resource node and adds a resource stack to drone/ship/outpost cargo by stable resource ids.

### 5. V0 Does Not Need Full Pathfinding

V0 can use route legs and straight-line travel estimates in a local `SurfaceLocalFrame`. The mission model should store route data in a way that later pathfinding can replace the estimate without changing mission state shape.

### 6. Autopilot Concepts, Not Autopilot Duplication

Drone missions should share concepts with ship navigation:

- target points,
- pickup/landing zones,
- route legs,
- risk/reserve estimates,
- explicit failure labels.

They should not duplicate the current ship autopilot controller. A drone V0 can be a mission-state machine with deterministic travel estimates.

## Player Interaction Model

### Ship Computer

The ship computer is the complete planning surface:

- select drone,
- select target,
- choose objective,
- choose cargo destination,
- review risk/time/energy/legal estimates,
- start/suspend/recall mission,
- view mission log.

### Surface Assignment

On foot, the player should be able to scan a node, mark it and assign a nearby drone or ship-bay drone. The surface flow should remain concise but must still show blocked prerequisites, cargo target and legal risk.

### Outpost Assignment

Outposts can later provide drone rental, storage, refinery targets, repair services, legal permits and faction contracts. The data model must include owner/faction/legal context from the start.

### Status And Distress

Drone status should answer:

- where is it,
- what is it doing,
- how much progress/cargo,
- what is the current risk,
- what player action is available.

Distress events must include a reason and response: recall, send support, go there, ignore or abandon.

## Background Simulation Model

### Tick Inputs

- mission state,
- drone state,
- world time delta,
- target node/outpost/container state,
- route/hazard/faction state,
- cargo reservations.

### Tick Outputs

- mission state delta,
- resource/cargo delta,
- fuel/energy/ammo/tool wear delta,
- damage/repair delta,
- notification events,
- wake requests for real Unity objects.

### Wake Conditions

Wake a real drone object only when:

- the player enters the site,
- remote camera/control is requested,
- visible connector/cargo interaction is needed,
- combat or recovery must be resolved locally,
- the drone reaches the active ship/outpost,
- debugging requests visualization.

## V0 Implementation Slice For Later

V0 should implement only:

- one scout/mining drone record,
- one resource node record,
- one player ship cargo target,
- one remote mission state machine,
- one deterministic background tick,
- one save/load-safe mission progress model,
- one focused deterministic tick test.

V0 should not implement:

- full drone AI,
- full pathfinding,
- full economy,
- multi-drone coordination,
- combat/security drone behavior,
- remote camera/control,
- detailed ship-builder drone bay UI.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Drone autonomy scope creep | Keep V0 to data/state/tick and one simple drone. |
| Planet surface pathfinding complexity | Start with route legs and simple estimates. |
| Duplicating ship autopilot | Reuse route concepts but not controller logic. |
| Background sim desync | Make mission data authoritative; reconcile on load/unload. |
| Cargo/resource mismatch | Use shared cargo/resource ids and cargo plans. |
| Hidden unfair failure | Deterministic hazards and player-readable failure reasons first. |
| Player confusion | Status and notifications must include cause and next action. |

## Documentation Map

- `docs/spielkonzept/drones-remote-missions.md`: player-facing mission model, drone roles and V0 slice.
- `docs/architecture/background-simulation-drones.md`: data-first loaded/unloaded simulation architecture.
- `docs/spielkonzept/drone-types-and-progression.md`: drone roles, modules, tiers and ship-builder bay direction.
- `docs/spielkonzept/drone-surface-mining-logistics.md`: surface mining operation, cargo plan and logistics flow.
