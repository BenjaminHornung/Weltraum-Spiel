# prototype-ship-physics-core

## Why

The prototype now has physically meaningful RCS allocation, but force application is still spread across ship modules. Main thrusters, RCS, SAS, and future systems such as recoil, docking assist, damage, autopilot, gravity, or flight assist should not independently stack forces without a shared model.

A small central `ShipPhysicsCore` gives the project one place to express and inspect ship-level force and torque behavior before the prototype grows into a larger modular ship game.

## What

Introduce the first narrow physics-core slice for the prototype ship:

- a shared wrench concept: force plus torque (`Fx, Fy, Fz, Tx, Ty, Tz`),
- a `ShipPhysicsCore` component that owns Rigidbody force application for ship systems,
- a small request/application model for center-of-mass forces and force-at-position calls,
- diagnostics for requested/applied net force and torque per physics step,
- migration of main thruster and RCS force application through the core while preserving current prototype behavior.

The goal is not to build the final space-sim architecture. The goal is to create a stable seam where future systems can request physical effects without directly bypassing shared budgets and telemetry.

## Out of Scope

- No final modular ship editor architecture.
- No full quadratic wrench solver.
- No module-based inertia tensor implementation yet.
- No fuel tank COM shifting yet.
- No RCS fuel consumption yet.
- No projectile recoil yet.
- No gravity/orbits/floating origin.
- No docking, damage, power, heat, atmosphere, or trajectory preview.
- No hidden damping or new flight-assist mode.
- No new packages or external solver dependency.

## Success Criteria

- `PrototypeBootstrap` adds `ShipPhysicsCore` to the generated prototype ship.
- `ShipPhysicsCore` owns the ship Rigidbody reference and centralizes ship force application.
- Main thruster and RCS no longer call `Rigidbody.AddForce` or `Rigidbody.AddForceAtPosition` directly in normal operation.
- Existing main-thrust behavior remains gameplay-stable: throttle-only main thrust does not create unintended torque.
- Existing RCS allocator behavior remains intact: one bounded throttle per nozzle and no oversubscription.
- Debug diagnostics can show net ship force/torque routed through the core.
- Existing controls, camera, gun firing, and prototype bootstrap continue to work.
- Unity MCP validation reports no C# compile errors.
- Deterministic probes confirm RCS parity, translation low torque, attitude low linear drift, and main-thrust straight-line stability remain within current tolerances.
