# fix-rcs-attitude-linear-drift

## Why

The previous RCS translation fix removed torque from pure translation commands, but the ship still drifts when using WASD attitude controls. Q/E roll behaves acceptably, so the remaining bug is specific to pitch/yaw attitude thrust selection or force application.

A player expects pitch/yaw from rest to rotate the ship in place. If WASD adds visible linear drift, aiming and KSP-like handling feel wrong and the debug readings become misleading.

## What

Fix RCS attitude control so W/S pitch and A/D yaw produce intentional rotation without meaningful linear movement from rest. Preserve Q/E roll behavior, RCS VFX/nozzle diagnostics, SAS behavior, and the existing COM-neutral translation fix.

## Out of Scope

- No full RCS allocation optimizer.
- No new keybindings.
- No camera changes.
- No main-thruster/gimbal changes.
- No ship editor or configurable RCS placement UI.
- No final physics architecture.
- No new assets or packages.

## Success Criteria

- A deterministic Unity MCP probe reproduces the current WASD pitch/yaw linear drift before the fix.
- Pure pitch commands from rest create angular velocity/torque but near-zero linear velocity.
- Pure yaw commands from rest create angular velocity/torque but near-zero linear velocity.
- Pure roll commands still create angular velocity/torque and remain near-zero linear velocity.
- Pure RCS translation remains COM-neutral and keeps active nozzle/VFX diagnostics.
- SAS can counter pitch/yaw/roll angular velocity without adding linear drift.
- Unity MCP script validation and console checks report no compile errors.
