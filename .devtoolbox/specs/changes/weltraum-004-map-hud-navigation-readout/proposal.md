# Proposal

## Goal
Prepare `weltraum-004-map-hud-navigation-readout` as the next slice after `weltraum-002-orbit-map-prototype`: expose the catalog-backed orbit/map data in existing HUD and map debug surfaces as read-only navigation readouts.

## Motivation
`weltraum-002` proved that the Aurelia catalog can produce analytical orbit positions, scaled map snapshots, orbit lines, and real-vs-map debug readouts. The next useful step is to make those values visible where a player or tester already looks during manual play, without starting navigation execution work too early.

## Scope
- Create the DevToolbox change artifacts for `weltraum-004` and record the intended implementation path.
- Reuse `weltraum-002` orbit-map contracts and catalog source.
- Reuse existing HUD/map surfaces, especially `PrototypePlayerHud`, `PrototypeMinimapOverlay`, and `PrototypeBootstrap`.
- Add read-only navigation/celestial readout planning for current target body, body ID, parent, distance in real meters, and map-scale context.
- Require `zai-ui-glm51` review before implementation and again after screenshot/evidence capture.

## Non-goals
- No runtime implementation in this scaffold step.
- No route execution, autopilot wiring, timewarp, drones, or object-bound warp.
- No final System Map UX and no replacement of `PrototypePlayerHudRenderer`.
- No edits to DirectFastTransfer, autopilot, benchmark, or other parallel-agent files.

## Success criteria
- `weltraum-004` exists as a valid DevToolbox change.
- Requirements and tasks make the HUD/GUI lane and Z.AI UI gates explicit.
- Future implementation can start from known reuse targets instead of inventing a parallel HUD/map path.
- `specs_validate` passes for the new change.
