# Change: prototype-ship-visual-kit-v0

## Problem

The current prototype ship can read as one bright block in flight. Critical module roles such as cockpit, hull, fuel, main thruster, RCS, gun, and utility/cargo are hard to distinguish at gameplay distance, especially in the dark prototype test environment.

## Goal

Make the prototype ship visually readable without external asset packs. The ship should have distinguishable low-poly module archetypes, clearer front/back orientation, targeted engine/RCS VFX, and a small metadata foundation that can later support ship-builder parts.

## Scope

- Add a procedural or helper-driven visual kit for prototype ship parts.
- Map existing prototype layout entries to visual archetypes and lightweight part metadata.
- Improve module colors/materials so hull is not pure white and emissive elements are intentional.
- Preserve existing gameplay transforms and behavior for mass, main thrust, RCS, weapons, and tests.
- Update documentation and verification evidence for the prototype visual kit.

## Non-Goals

- No final ship builder.
- No inventory, unlock, save/load, or economy systems.
- No external asset packs.
- No gameplay rebalance except what is required to keep existing transforms and VFX readable.

## Dependency

This change starts after `fix-autopilot-momentum-startup-state`, which is already completed on `main` at commit `a33d20a`. Existing unrelated camera/HUD work in the worktree must be preserved and not reverted.

## Success Criteria

- The default prototype ship no longer appears as a single bright block.
- Cockpit, hull, fuel tank, main thruster, RCS pods, gun, and cargo/utility modules are visually distinguishable.
- `MainThrusterNozzle`, `RCS_Nozzle_*`, and `Muzzle` gameplay transforms retain their names and functional roles.
- Unity script validation, editor refresh/console check, Unity tests, and visual screenshot inspection are documented under this change's `tests/` folder.
