# Design: Gravity and Orbits

## Options

- No gravity: current arena-space default.
- Central-body gravity: `acceleration = mu / r^2` toward a body.
- Sphere of influence/patched conics: later approach for readable orbital gameplay.
- Full N-body: explicitly deferred unless it becomes core gameplay.

## First Implementation Direction

Start with optional central-body acceleration. Apply as environment acceleration/force through the physics core path and keep default scenes unaffected.

## Diagnostics

Show active body, distance, mu, and acceleration vector.

## Risks

Gravity interacts with large coordinates and trajectory prediction. This spec should remain separate from floating origin and burn planner specs.
