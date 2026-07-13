# Draft Spec: prototype-ship-validation-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/prototype-ship-validation-v0/` before implementation.

## Purpose

Once ships are generated from blueprint data, invalid ships must be detected early. Validation prevents confusing physics bugs caused by missing cockpit, missing thrusters, missing fuel, overlapping modules, or unusable RCS layouts.

## In Scope

- Prototype-only ship blueprint validation.
- Errors and warnings as separate categories.
- Validation result shown in debug overlay or console.
- Validation used by bootstrap before enabling flight where practical.
- Documentation of validation rules and limits.

## Out of Scope

- No final balance system.
- No full structural integrity simulation.
- No power/heat/cooling model unless only as warnings.
- No inventory validation.
- No multiplayer/anti-cheat validation.

## Initial Validation Rules

Errors:

- Blueprint has no modules.
- No cockpit/control module.
- No usable propulsion source: no main thruster and no RCS fallback.
- Main thruster exists but fuel capacity is zero and thruster consumes fuel.
- Duplicate module instance ids.
- Unknown module definition ids.
- Multiple modules occupying the same grid/local placement slot if grid placement exists.
- Invalid negative masses, fuel, thrust, or fire rates.

Warnings:

- No gun/weapon module.
- No RCS modules, final approach/navigation may be limited.
- Very low thrust-to-mass ratio.
- Fuel likely too low for typical navigation tests.
- RCS nozzles missing or unevenly placed.
- High projectile speed may not collide reliably without raycast/sweep logic.

## Acceptance Criteria

- Valid default blueprint passes validation.
- Blueprint without cockpit fails.
- Blueprint without propulsion fails.
- Blueprint with fuel-consuming engine and no fuel capacity fails.
- Duplicate instances fail.
- Unknown module definition fails.
- Blueprint without weapons produces warning, not error.
- Blueprint without RCS produces warning, not error.
- Validation result is visible enough for agents/developers to diagnose invalid generated ships.
- Validation does not introduce final gameplay architecture.

## Risks

- Strict validation can slow prototyping. Keep first rules practical and allow warnings for non-critical gaps.
- Validation should not block manual experiments unless errors make the ship unusable.
