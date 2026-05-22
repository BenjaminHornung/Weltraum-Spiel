# Proposal: Space PvE Arena Loop v0

## Motivation

The prototype has flight, camera, weapon targeting, projectile impact, target feedback, and player-facing HUD foundations, but it does not yet connect them into a small playable PvE loop. A player needs an immediate objective, multiple valid targets, visible progress, a clear completion state, and a reset/replay path so the combat prototype can be tested as a game loop instead of isolated systems.

## Outcome

Add a bounded v0 arena loop where the player can start or reset an arena, destroy at least three prototype targets/enemies with existing weapons, see objective progress in player-facing UI, complete the objective, and receive a non-persistent reward stub. The loop should remain deterministic enough for EditMode/PlayMode validation and should preserve existing flight, autopilot, RCS, fuel, camera, targeting, and generated/imported ship behavior.

## Scope

- Small prototype arena controller and objective state for a destroy-all-targets objective.
- At least three simple target/enemy actors using existing damage/destruction and target registry patterns where possible.
- Player-facing status UI that reports objective name, progress, completion, and reward stub.
- Reset/replay support from Play mode and deterministic tests for the core loop.
- Documentation and DevToolbox test evidence under this change.

## Non-Goals

- No full mission framework.
- No persistent economy, inventory, loot, or unlock system.
- No multiplayer.
- No advanced enemy AI, factions, or behavior trees.
- No ground gameplay.
- No rewrite of existing combat, targeting, flight, or HUD systems.
