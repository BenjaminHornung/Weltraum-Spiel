# prototype-rcs-force-allocator

## Why

External physics review correctly identified that the current RCS implementation is still a command-by-command force applicator, not a real allocator. Translation, attitude, and SAS can select the same nozzle multiple times in one physics step, exceed per-nozzle thrust, produce different net force depending on how many nozzles match an axis, and require COM counter-force patches to avoid drift.

The prototype now needs one central RCS allocation step so the ship behaves predictably when commands combine and when nozzle placement changes.

## What

Introduce a prototype RCS force allocator inside the existing Unity prototype. It should collect translation, attitude, and SAS demands into one desired wrench per physics step, then assign a single throttle value per nozzle within `[0, 1]`.

The allocator should target:

- requested net translation force,
- requested attitude/SAS torque,
- minimal unintended torque for pure translation,
- minimal unintended force for pure attitude/SAS,
- no per-nozzle thrust oversubscription.

This is a prototype allocator, not the final modular ship flight computer.

## Out of Scope

- No final RCS flight computer architecture.
- No offline optimizer dependency or external math package.
- No UI ship editor.
- No new keybindings.
- No camera changes.
- No main engine/gimbal rewrite.
- No fuel, projectile, recoil, or COM-from-module-mass changes in this spec.
- No Asset Store or new package import.

## Success Criteria

- A single RCS physics step computes at most one force application per nozzle.
- No nozzle exceeds its configured thrust budget.
- Full translation on `+/-X`, `+/-Y`, and `+/-Z` produces comparable target net force independent of matching nozzle count.
- Pure translation leaves angular velocity and torque near zero in the default prototype ship.
- Pure pitch/yaw/roll creates angular velocity with near-zero net linear drift.
- Combined translation + attitude does not exceed per-nozzle budgets.
- SAS uses the same allocator path and does not add linear drift by itself.
- Existing RCS VFX/debug nozzle selection remains visible.
- Unity MCP validation/probes pass and evidence is stored under this spec.
