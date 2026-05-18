# thruster-rcs-flight-controls

## Why

The prototype needs a spacecraft control model that can grow toward Kerbal Space Program-like behavior instead of arcade reverse thrust. The earlier refinement still treated `S` as a backward/turnaround command. That is not the desired direction anymore.

Main engines should have a persistent throttle from 0-100%, gimballed main engines should contribute turning torque while they are producing thrust, and RCS thrusters should matter based on whether they are actually installed and where they are placed on the ship.

## What

Revise the prototype flight controls around a simple physical propulsion model:

- `W` increases main-thruster throttle toward 100%.
- `S` decreases main-thruster throttle toward 0%.
- A small GUI/debug readout shows current main-throttle percentage.
- Main thrusters fire continuously according to the current throttle percentage while fuel is available.
- Main thrusters may support gimbal; their gimbal angle contributes to turning torque when throttle is above 0%.
- `A`/`D` request left/right turning using installed RCS thrusters and available main-thruster gimbal authority.
- If main throttle is 0 and RCS thrusters exist, turning is driven by the precomputed RCS pivot/control center.
- If main throttle is above 0, the turn behavior also accounts for forward thrust, gimbal angle, and main-thruster placement.

The result should feel closer to a small KSP-like prototype while remaining intentionally simple and bootstrap-generated.

## Included Features

- Persistent main-throttle state from 0-100%.
- GUI/debug percentage display for main throttle.
- Main thruster force application based on throttle percentage.
- Gimbal configuration per main thruster with degree limit.
- Left/right turning via RCS and main-thruster gimbal authority.
- Precomputed prototype control pivot from installed RCS thrusters.
- Main-thrust/gimbal torque contribution when main throttle is active.
- README update for the changed controls.

## Out of Scope

- No full Kerbal Space Program simulation.
- No orbital mechanics or celestial bodies.
- No staging system.
- No reaction wheels.
- No final part editor.
- No full mass-tree solver.
- No aerodynamics.
- No full SAS/autopilot.
- No final multi-thruster balancing UI.

## Success Criteria

- `W` increases the main-thruster throttle percentage.
- `S` decreases the main-thruster throttle percentage.
- `S` no longer means reverse thrust or turnaround assist.
- The GUI/debug overlay shows the main-throttle percentage.
- Main thrust scales with throttle percentage and fuel availability.
- `A`/`D` produce left/right turning behavior using installed RCS and/or active gimballed main thrusters.
- When main throttle is 0 and RCS exists, turning uses the precomputed RCS control pivot.
- When main throttle is above 0 and gimbal is available, gimbal authority contributes more turning as throttle rises.
- RCS absence is handled cleanly without null errors.
- Existing bootstrap, camera, gun, projectile, fuel, and speed debug behavior remain usable.
