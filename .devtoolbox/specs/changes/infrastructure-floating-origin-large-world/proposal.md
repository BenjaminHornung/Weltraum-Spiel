# infrastructure-floating-origin-large-world

## Why

Large space worlds will exceed the precision comfort zone of Unity float transforms. The project needs a future path for double-precision absolute state and local Unity coordinates near the origin.

## What

Define a floating-origin and large-world coordinate foundation with absolute ship state, local rendering/physics state, and origin-shift rules.

## Out of Scope

- No planet implementation.
- No multiplayer replication.
- No streaming world content.
- No immediate replacement of the current prototype coordinates.
- No custom physics engine.

## Success Criteria

- Absolute position/velocity can be represented separately from Unity local transform position.
- Origin shifts preserve relative positions and velocities.
- Rigidbody simulation remains near local origin.
- Debug output shows absolute and local coordinates.
- The design does not force large-world complexity into the current prototype scene.
