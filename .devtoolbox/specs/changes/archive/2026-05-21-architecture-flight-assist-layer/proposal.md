# architecture-flight-assist-layer

## Why

The project needs a clear separation between physics truth and pilot assistance. Hidden damping would make the ship easier to fly, but it would also erase the value of thruster placement, damage, fuel, and ship design.

This change defines flight assist as an explicit layer that requests forces and torques through the same physics path as the player and SAS.

## What

Introduce a flight-assist model for optional behaviors such as velocity assist, rotation assist, docking assist, or combat assist. Assist systems request desired force/torque and must be limited by available thrusters unless a mode is explicitly marked as debug-only.

## Out of Scope

- No final autopilot UI.
- No orbital planner.
- No docking implementation.
- No hidden Rigidbody damping as a gameplay substitute.
- No AI behavior.

## Success Criteria

- Physics truth remains Newtonian by default.
- Assist systems are explicit and diagnosable.
- Assist requests route through `ShipPhysicsCore` and allocators.
- Debug overlay can distinguish manual, SAS, and assist requests.
- Documentation names assisted and simulation-style flight modes.
