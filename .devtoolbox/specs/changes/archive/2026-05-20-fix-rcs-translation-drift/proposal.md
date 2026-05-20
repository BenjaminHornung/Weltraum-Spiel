# fix-rcs-translation-drift

## Why

Pure RCS translation currently creates unwanted angular velocity when the ship starts from rest. The debug probe shows translation commands produce the intended linear force, but also non-zero torque because translation forces are applied at off-center nozzle positions. This makes the ship rotate or drift during simple RCS movement, which feels wrong for the prototype and makes later combat/control tuning harder.

## What

Fix the prototype RCS translation path so a translation-only command with no attitude input applies linear acceleration without adding unintended rotation. The visible RCS nozzle feedback should remain useful for debugging, and attitude-control RCS must keep producing torque.

## Out of Scope

- No full RCS thrust allocator
- No final spacecraft physics architecture
- No docking/autopilot/flight computer
- No new input layout
- No new ship editor or module system
- No damage/combat changes
- No art or asset-pack work

## Success Criteria

- From rest, pure RCS translation on local X, Y, or Z accelerates along the commanded axis.
- From rest, pure RCS translation leaves angular velocity near zero with SAS off.
- From rest, pure RCS translation leaves angular velocity near zero with SAS on.
- RCS translation VFX/nozzle selection remains visible for debugging.
- RCS attitude commands still produce intentional torque.
- Diagnostics make it clear that translation torque is neutralized or not applied as rotation.
- Unity MCP script validation and deterministic probes pass.
