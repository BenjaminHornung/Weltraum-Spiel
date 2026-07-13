# Draft Spec: mission-reward-part-unlock-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/mission-reward-part-unlock-v0/` before implementation.

## Purpose

Create the first progression loop connected to the ship builder: complete a simple mission, receive currency or unlock points, unlock a new ship part, and use it in the ship builder.

This is central to the intended game identity: players earn parts through missions/quests and use them to build custom ships.

## In Scope

- Prototype-only mission reward state.
- Currency counter or part-unlock counter.
- A small part catalog with locked/unlocked states.
- Completing the space PvE arena awards currency or directly unlocks one part.
- Builder palette only shows or marks available parts.
- Debug reset/unlock controls for testing.
- README/dev note explaining temporary progression model.

## Out of Scope

- No save/load persistence unless explicitly added as a temporary debug JSON.
- No full economy simulation.
- No shops with NPCs.
- No quest dialogue.
- No item inventory.
- No crafting.
- No balancing pass.

## Acceptance Criteria

- Completing a prototype objective awards a visible reward.
- A previously locked module can become available.
- Builder can use the unlocked part.
- Locked parts are not accidentally usable unless debug override is enabled.
- Progression state is clearly prototype-only and resettable.
- No final inventory/economy architecture is forced.

## Risks

- Economy systems can become a distraction. Keep this as a narrow proof that mission results can affect ship-building options.
