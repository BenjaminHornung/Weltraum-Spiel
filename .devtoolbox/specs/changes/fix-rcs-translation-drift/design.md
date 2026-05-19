# Design: Fix RCS Translation Drift

## Observed Failure

A deterministic Unity MCP probe against `PrototypeShip` starts from zero linear and angular velocity and calls `RcsThrusterController.ApplyControls` with translation commands only. The current implementation selects visible nozzles correctly, but each selected nozzle applies force via `Rigidbody.AddForceAtPosition`. Because the selected nozzle set is not torque-neutral, the command creates angular velocity even when the player only requests translation.

Example: local `+X` translation selects three right-facing nozzles and produces net force near `(19500, 0, 0)` plus torque around `(0, 791, -250)`. SAS is not the cause because from rest the SAS command remains zero.

## Chosen Fix

For the prototype, translation RCS should apply its physical linear force through the ship center of mass, while still marking the selected nozzles active for VFX and diagnostics. This keeps translation readable and playable without pretending we already have a full multi-thruster allocator.

Attitude-control RCS remains unchanged: attitude commands still use nozzle positions and `AddForceAtPosition` to intentionally create torque.

## Why Not A Full Allocator

A realistic RCS allocator would solve paired thruster selection, force distribution, and torque cancellation for arbitrary module layouts. That is valuable later, but too large for this bugfix. The current prototype needs stable controls first. The design keeps the future allocator path open by localizing the neutralized behavior to translation force application.

## Diagnostics

`LastTranslationForce` should continue to show the commanded translation force. `LastTorque` should not report translation torque as applied rotational torque when the translation force is neutralized through COM. Active nozzle IDs and VFX should continue to show which visual nozzles represent the requested movement.

## Risks

- This is an approximation: visual nozzles may imply off-center forces, but the physical translation is COM-neutral.
- Future module placement will need a real allocator if physically exact RCS placement becomes a requirement.
- Existing attitude/SAS behavior must be checked so this fix does not remove intentional torque.
