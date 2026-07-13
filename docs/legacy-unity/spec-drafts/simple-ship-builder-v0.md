# Draft Spec: simple-ship-builder-v0

Status: draft only. Promote to `.devtoolbox/specs/changes/simple-ship-builder-v0/` before implementation.

## Purpose

Create the first player-facing proof of the main game idea: build a ship from functional modules and immediately feel the difference in flight and combat behavior.

This should come after `prototype-ship-blueprint-v0` and `prototype-ship-validation-v0`, because the builder should edit a data model rather than directly manipulating hardcoded scene objects.

## In Scope

- A minimal builder mode or hangar prototype.
- Small module palette, e.g. Cockpit, Hull, FuelTank, MainThruster, RCSBlock, Gun.
- Place module at simple grid/snap positions.
- Rotate module in fixed increments.
- Remove module.
- Rebuild generated ship from blueprint.
- Show stats after each change: mass, fuel, thrust, RCS nozzle count, projectile values, estimated acceleration.
- Validation errors/warnings visible.
- Two or more example builds that fly differently.

## Out of Scope

- No final UI/UX.
- No inventory.
- No currency or unlocks.
- No save/load unless trivial temporary JSON helps testing.
- No final 3D assets.
- No interiors.
- No multiplayer.
- No complex structural rules.

## Suggested Interaction

The first implementation may use debug controls instead of polished UI:

- Number keys select module type.
- Mouse or keyboard moves a ghost placement cursor.
- `R` rotates selected module if not conflicting with existing RCS control in builder mode.
- `Enter` places.
- `Delete` removes.
- `Tab` toggles between builder and flight mode.

Actual key choices should avoid conflicts with existing flight controls, or builder mode should consume its own input context.

## Acceptance Criteria

- Player can enter a builder/hangar mode.
- Player can place at least one module from each initial category.
- Player can remove a module.
- Player can rotate a module.
- Stats update after placement/removal.
- Invalid ships are detected before flight.
- Two different ship configurations produce different mass/acceleration/fuel/weapon behavior.
- The flight prototype still works after leaving builder mode.
- The implementation remains prototype-only and does not introduce inventory/economy/save systems prematurely.

## Risks

- UI work can expand quickly. Keep the first version ugly and functional.
- Snapping rules should stay simple until the desired module grid is clearer.
- Do not add final art requirements here; primitives are acceptable.
