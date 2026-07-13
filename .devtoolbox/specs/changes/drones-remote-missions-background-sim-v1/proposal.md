# Proposal

## Change

`drones-remote-missions-background-sim-v1`

## Problem

Weltraum Spiel already frames drones as the bridge between ship-scale play, on-planet first-person activities, resources, outposts, factions, cargo and future real-scale streaming. The current planning surface does not yet define how drone missions should exist when the player is elsewhere, how mining/scouting/hauling/security/repair/probe roles differ, or how background simulation avoids relying on unloaded Unity GameObjects.

Without a data-first plan, future drone implementation risks becoming either a visible-scene-only AI feature that cannot persist, or a passive income spreadsheet disconnected from cargo, resources, factions and player-facing risk.

## Goal

Create a planning/spec package that defines drones as deployable, role-specific remote workers assigned to mission records that can continue through deterministic background simulation. The package should make later V0 implementation possible with one scout/mining drone, one resource node, one ship cargo target and one remote mission state machine, without requiring full AI, full pathfinding or a full economy.

## Scope

- Define player-facing drone roles: scout, mining, hauler, combat/security, repair/utility and probe/survey.
- Define the remote mission data model, mission states, progress, risk, cargo plans, notifications and recall/abort rules.
- Define loaded versus unloaded simulation behavior and when real Unity objects should wake.
- Define integration with shared resource/cargo concepts, ship cargo capacity, outpost storage, factions/legal context, map discovery, autopilot target points, landing/pickup zones, ship-builder drone bay parts and resource economy.
- Define player interactions for deployment, assignment, recall, status, transfer, distress response and damaged-drone recovery.
- Define a deliberately small V0 implementation slice for later work.
- Record risks and scope boundaries for future implementation.

## Non-Goals

- Do not implement runtime code, tests, scenes, assets, prefabs, UI, drones, AI or background systems in this change.
- Do not modify `unity-legacy-final-2026-07:Assets/**`, autopilot/harness files, ship builder runtime code or Unity assets.
- Do not define final balance values, final pathfinding, final economy, final combat AI or final remote camera/control behavior.
- Do not require full orbital navigation, gravity simulation, multiplayer authority or scene streaming before the V0 data slice can exist.

## Deliverables

- `docs/spielkonzept/drones-remote-missions.md`
- `docs/architecture/background-simulation-drones.md`
- `docs/spielkonzept/drone-types-and-progression.md`
- `docs/spielkonzept/drone-surface-mining-logistics.md`
- DevToolbox proposal, design, tasks and formal spec for this planning package.

## Success Criteria

- The planning docs explain how the player deploys drones from ship/outpost/surface contexts and assigns mining, scouting, hauling, combat/security, repair/utility and probe/survey work.
- The formal spec requires mission state to be data-first, save/load safe and independent of loaded Unity objects.
- The V0 slice is small enough to implement later without full AI, full pathfinding or full economy.
- `specs_validate drones-remote-missions-background-sim-v1` passes.
- Only allowed Markdown/spec files are modified and committed.
