# physics-gravity-orbits

## Why

The current prototype is an arena-like vacuum. If planets, moons, or orbital gameplay become part of the game, gravity must be introduced as its own physics layer with predictable behavior and clear tradeoffs.

## What

Define an optional gravity/orbit layer that can start with simple central-body gravity and later evolve toward sphere-of-influence or patched-conic behavior.

## Out of Scope

- No planets in the current playable prototype.
- No full N-body simulation.
- No orbital map UI in this slice.
- No trajectory preview implementation here.
- No floating-origin implementation here.

## Success Criteria

- Gravity is disabled by default in the prototype scene.
- A central-body gravity source can apply acceleration toward its center.
- Gravity uses mass-independent acceleration for ships where appropriate.
- Future SOI/patched-conic direction is documented.
- Debug output can show active gravity source and acceleration.
