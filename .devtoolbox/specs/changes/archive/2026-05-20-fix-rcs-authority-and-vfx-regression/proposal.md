# fix-rcs-authority-and-vfx-regression

## Why

After the latest SAS and RCS VFX fixes, playtesting shows two regressions and one missing modeling detail:

- Movement with SAS enabled feels much slower than movement with SAS disabled.
- RCS particles are no longer visible in play mode.
- RCS thrust should be represented as a value on each installed RCS thruster block instead of being treated as an invisible hardcoded global detail.

For the prototype, SAS should stabilize the ship without reducing the player's active control authority. RCS visuals must stay visible because they are essential debug feedback for force and torque behavior.

## What

Fix RCS/SAS authority and VFX behavior while keeping the current control layout and physics-first direction model.

This change adds explicit thrust values to the four installed RCS blocks and uses those values when applying force from their nozzles. It also ensures SAS does not fight or scale down active player input on the same axis, and restores visible RCS particles/exhaust for selected nozzles.

## Out of Scope

- No full RCS part inventory
- No ship editor
- No multiple RCS variants beyond inspector-ready values
- No reaction wheels
- No autopilot target tracking
- No new keybinds
- No final VFX art polish
- No full RCS solver rewrite unless required to fix the regression

## Success Criteria

- Manual attitude/translation input with SAS enabled has comparable authority to the same input with SAS disabled.
- SAS still damps residual rotation when input is released.
- Each of the four generated RCS blocks exposes an inspector-adjustable thrust value.
- Force applied by a selected RCS nozzle uses its parent RCS block thrust value.
- RCS particles are visible again for selected nozzles.
- RCS VFX still represents exhaust opposite the force direction.
- Unity scripts compile with 0 script errors.
- Documentation records the RCS block thrust and SAS/manual-input interaction rules.
