# Design

## Change
`fix-flight-control-wasd-rcs-jitter-regression-v2`

## Current Live Path
Manual input is polled by `PlayerShipController`, converted into `RcsTranslationCommand` and `RcsAttitudeCommand`, combined with SAS and optional flight-assist requests, then passed to `RcsThrusterController.ApplyControls`. The current allocator builds nozzle data, greedily solves desired force and torque, and applies the result through `ShipPhysicsCore.ApplyForceAtPosition`.

This means a command that should be pure translation can still create torque if the allocator selects asymmetric nozzles. A command that should be pure attitude can still create residual force. SAS then sees the residual rotation and can feed more corrective torque into the same coupled solver.

## Stable Prototype Solver
Add a solver mode, `RcsSolverMode.StablePrototype`, and make it the serialized default. The existing greedy allocator remains available as `ExperimentalPhysicalNozzles`.

`StablePrototype` behavior:

- Translation and assist force are applied through `ShipPhysicsCore.ApplyForceAtCenterOfMass`.
- Manual attitude, SAS torque, and assist torque are applied through a new `ShipPhysicsCore.ApplyTorque`.
- Mixed translation and attitude are intentionally decoupled: force cannot create torque and torque cannot create force.
- Diagnostics continue to expose desired, actual, and residual force/torque plus active/installed nozzle counts and allocator status.
- Fuel use is still proportional to request magnitude through the existing `ShipStats.ConsumeFuelForThrust` path.
- RCS VFX can be selected by command direction and throttle equivalent. Visual nozzle selection is diagnostic/visual only in the stable solver.

## Manual Priority
Manual input already clears stale external assist before RCS apply. The v2 evidence must prove this through the live path and log `HasExternalFlightAssistRequest`, `LastFlightAssistRequest.source`, force, torque, and weapon-stabilization state. Weapon stabilization may add short-lived torque after recoil, but it must not persistently override manual controls.

## Mass Properties
`ShipStats.ApplyMassProperties` currently recalculates descriptors and writes mass/COM/inertia in `FixedUpdate`, and can run twice per step. This change throttles runtime application so build/reset/module changes can force refresh while fuel changes are applied at a controlled cadence or significant fuel delta.

## PlayMode Evidence
Use `Assets/Scenes/PrototypeBootstrapHost.unity` and the imported Blender/default visual (`ImportedDemoScout` preferred) to drive the real components. Evidence is stored under this change's `tests/` folder:

- `tests/test-protocol.md`
- `tests/logs/unity-playmode-flight-control.log`
- `tests/performance/flight-control-diagnostics.csv`
- Required screenshots for idle, translation, attitude, and imported visual movement.

## Risks
- `StablePrototype` is less physically literal than the nozzle allocator, so VFX/nozzle throttle is approximate in the default mode.
- Torque magnitudes must remain compatible with existing SAS and recoil tuning.
- Mass-property throttling must not hide real ship rebuild/module-change updates.
- Unity PlayMode evidence can be blocked by editor/MCP availability; if so, the blocker and partial logs must be captured.
