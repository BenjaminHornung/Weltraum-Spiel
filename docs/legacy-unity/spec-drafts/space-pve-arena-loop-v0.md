# Draft Spec: space-pve-arena-loop-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/space-pve-arena-loop-v0/` before implementation.

## Purpose

Create the first small playable space PvE loop: fly, navigate, shoot, destroy targets/enemies, and complete a simple objective. This should come after basic weapon health/destruction exists.

## In Scope

- Small arena with orientation markers or asteroids.
- Simple enemy drone or target group.
- Objective: destroy all targets or reach a waypoint then destroy target.
- Enemy movement can be minimal: stationary, slow drift, patrol, or basic chase.
- Player projectiles can destroy enemies.
- Optional enemy fire if simple.
- Clear success/failure state.
- Debug mission overlay.

## Out of Scope

- No full mission system.
- No persistent rewards.
- No advanced AI.
- No factions.
- No loot.
- No multiplayer.
- No ground gameplay.

## Acceptance Criteria

- A player can start the arena and receive a clear objective.
- At least three enemies/targets exist.
- The player can destroy them with prototype weapons.
- The arena reports objective complete.
- Existing flight, autopilot, RCS, fuel, and camera behavior remain usable.
- The loop is replayable/resettable from Play mode.

## Risks

- Enemy AI can expand quickly. Keep first enemies dumb and test-focused.
- Do not start economy/reward design in this slice; that belongs to `mission-reward-part-unlock-v0`.
