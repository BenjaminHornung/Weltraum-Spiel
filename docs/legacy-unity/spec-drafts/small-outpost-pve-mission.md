# Draft Spec: small-outpost-pve-mission

Status: draft only. Promote after basic walkaround and ship-to-ground transition exist.

## Purpose

Create the first tiny ground PvE mission slice: land/arrive near an outpost, exit or switch to ground mode, complete a simple objective, and return. This is the first bridge between the spaceflight game and later FPS/PvE ambitions.

## In Scope

- Small primitive outpost area.
- Simple objective: activate terminal, retrieve crate, or defeat one static target.
- Optional very simple hostile target if ground combat controls exist.
- Return-to-ship completion trigger.
- Reward hook placeholder for later part unlocks.
- Clear success/failure state.

## Out of Scope

- No large city.
- No complex FPS AI.
- No dialogue system.
- No inventory system.
- No procedural planets.
- No begehbare ship interiors.
- No multiplayer.

## Acceptance Criteria

- Player can access the outpost mission from a controlled test flow.
- Objective can be completed.
- Completion can return to the ship or space mode.
- A placeholder reward event is emitted or displayed.
- The mission is resettable for testing.
- The implementation remains a small PvE prototype, not a full ground game.

## Risks

Ground PvE can quickly become a separate game. Keep the first outpost mission extremely small and tied back to ship progression.
