# Proposal

## Change
`fix-flight-control-wasd-rcs-jitter-regression-v2`

## Problem
The current live flight-control path still routes most RCS force and torque requests through the physical nozzle allocator:

`PlayerShipController.FixedUpdate()` -> `RcsThrusterController.ApplyControls(...)` -> `AllocateAndApplyRcs(...)` -> `ShipPhysicsCore.ApplyForceAtPosition(...)`.

That is too fragile for the playable prototype. Translation, attitude, SAS, and assist torque can be coupled through off-center nozzle forces, which can produce unwanted torque during translation and unwanted linear force during attitude control. In Play Mode this presents as WASD translation feeling ineffective and normal pitch/yaw/roll causing visible jitter, spin, or camera shake. The camera is likely amplifying the Rigidbody motion rather than causing it.

Previous evidence covered part of the imported-ship movement path, but the change needs a more explicit v2 regression harness and a safer default solver mode that keeps the experimental physical nozzle allocator available without making it the default player-control path.

## Goal
- Add a real Unity PlayMode regression/evidence pass for the live `PlayerShipController` path across idle, translation, attitude, SAS on/off, imported visuals, F6 switching, and stale external-assist priority.
- Make the default RCS solver stable for the prototype by applying translation at the Rigidbody center of mass and attitude/SAS as torque, while keeping the greedy physical nozzle allocator as an opt-in experimental mode.
- Reduce physics jitter risk from repeated mass-property application in `FixedUpdate`.
- Preserve the existing imported visual/functional socket behavior without letting `PrototypeShipVisualSwitcher` strip gameplay objects.

## Non-Goals
- No DOTS/ECS migration.
- No attempt to make Unity Rigidbody calls from worker threads.
- No retuning of the entire flight model beyond the minimal stabilization needed for this regression.
- No removal of the experimental nozzle allocator.
