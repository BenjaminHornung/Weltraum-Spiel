# prototype-module-configs

## Why

The prototype now has multiple module-like systems: fuel tank, main thruster, RCS blocks, guns, and projectile values. Many values are still tightly coupled to bootstrap or component defaults. Before a real ship editor exists, we need a small data-driven step so prototype modules can be tuned without hiding every value in code.

## What

Introduce lightweight prototype module configuration for the generated ship. The goal is configurable values, not a final modular ship architecture.

## Included

- Simple data containers for prototype module values.
- Generated ship continues to use primitives.
- Main thruster, RCS, gun, fuel, and camera-related values can be inspected or configured more clearly.
- Existing bootstrap remains able to create a working default ship.

## Out of Scope

- Real ship editor.
- Inventory/crafting.
- Save/load.
- Final module inheritance architecture.
- Asset Store or final 3D assets.
- Economy/progression.

## Success Criteria

- Prototype module values are easier to tune without hunting through unrelated code.
- Bootstrap can still create the same playable default ship.
- No final architecture is forced prematurely.
- Unity scripts compile and existing prototype behavior remains intact.
