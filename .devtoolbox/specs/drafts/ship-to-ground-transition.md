# Draft Spec: ship-to-ground-transition

Status: draft only. Promote after `basic-ground-walkaround-prototype` exists and the spaceflight prototype is stable.

## Purpose

Prototype the transition between ship flight and on-foot gameplay without attempting Star-Citizen-style seamless full-world complexity. The goal is a controlled handoff that feels understandable and can later be refined.

## In Scope

- A simple trigger or key-based transition from ship mode to walkaround mode.
- Preserve ship position/orientation enough that the player understands where they exited.
- Spawn player character near a landing pad, station, or test platform.
- Return from walkaround mode to ship flight mode.
- Disable conflicting controls while in the other mode.
- Basic camera handoff.
- Clear debug overlay state showing current mode.

## Out of Scope

- No seamless physical walking inside moving ships.
- No begehbare/interior modular ships.
- No full landing system.
- No planet terrain.
- No multiplayer.
- No inventory transfer.

## Design Notes

Use an intentionally simplified mode switch first. A fully seamless transition can be researched later, but early gameplay should not be blocked by the hardest version of the problem.

## Acceptance Criteria

- Player can switch from flight mode to walkaround mode at a test location.
- Player can switch back to the same ship.
- Controls do not conflict between modes.
- Camera and input state are reset cleanly during transition.
- Ship state such as fuel and velocity is not accidentally corrupted.
- README documents the prototype limitation that this is not yet seamless ship interior gameplay.

## Risks

Seamless ship interiors are a major technical trap. This spec must avoid committing to that architecture before the core game loop proves itself.
