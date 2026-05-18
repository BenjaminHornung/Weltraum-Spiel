# fix-rcs-vfx-direction-mapping

## Why

RCS particles sometimes appear on nozzles or directions that do not match the player's input. This makes the prototype hard to debug because visual feedback suggests the wrong thrusters are firing. It may also indicate a deeper mismatch between force/torque vector selection and VFX activation.

## What

Investigate and fix RCS visual direction mapping so particle/VFX activation matches the actual selected RCS nozzle force direction for manual translation, manual attitude control, and SAS counter-thrust.

## Out of Scope

- No new RCS art assets
- No final particle polish
- No full RCS solver rewrite unless the root cause proves the existing vector mapping is wrong
- No keybind changes
- No new ship editor
- No damage, heat, or fuel plumbing for RCS

## Success Criteria

- RCS VFX only plays on nozzles that are actually selected to apply force/torque.
- The VFX direction matches the physical exhaust direction of the selected nozzle.
- Manual translation inputs H/N/I/K/J/L show particles on physically plausible nozzles.
- Manual attitude inputs W/S/A/D/Q/E show particles on nozzles that produce the expected torque direction.
- SAS counter-thrust particles match the nozzles used to brake residual angular velocity.
- Debug evidence can compare requested command, selected nozzles, force direction, and VFX state.
- Unity scripts compile with 0 script errors.
