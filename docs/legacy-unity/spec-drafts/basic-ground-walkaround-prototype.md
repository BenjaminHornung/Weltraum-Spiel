# Draft Spec: basic-ground-walkaround-prototype

Status: draft only. Promote only after the ship/navigation/combat core is stable enough that ground gameplay will not distract from the main loop.

## Purpose

Create the first minimal player-on-foot slice. The long-term vision includes FPS/PvE on the ground and inside locations, but the first version should only prove ship-to-person scale, basic movement, and interaction with simple objects.

## In Scope

- A simple ground/walkaround test scene or station pad.
- Basic first-person or third-person character controller.
- Walk, look, jump optional.
- Interact with a terminal or crate.
- Return to ship/flight mode through a simple trigger or debug key.
- Simple scale reference between player, ship, and environment.

## Out of Scope

- No combat.
- No inventory.
- No NPCs.
- No dialogue.
- No large city.
- No procedural planet surface.
- No ship interior.
- No multiplayer.

## Acceptance Criteria

- Player can enter a small ground scene or mode.
- Player can move and look around reliably.
- Player can interact with one simple object.
- Player scale feels plausible relative to the prototype ship.
- Returning to ship/flight mode is possible.
- Existing spaceflight prototype remains unaffected.

## Risks

Ground movement can become a second game too early. Keep it as a narrow technical slice and do not add FPS combat until a later spec.
