# player-weapon-computer-controls-v1 Design

## Decision

Implement the first player-facing Weapon Computer controls inside the existing `PrototypePlayerHudRenderer` Combat context panel. This mirrors the Navigation Computer control-row pattern already in the HUD and avoids adding another default window.

## Reuse Strategy

`PrototypeWeaponComputerPanel` already demonstrates the required operations, but it is an IMGUI debug/developer panel and contains tuning/debug values that must not be copied into Basic HUD. The Player HUD should instead call gameplay APIs on `PrototypeWeaponComputer`.

If target cycling or priority cycling is missing as a reusable API, add small helper methods to `PrototypeWeaponComputer`:

- `SelectNextTarget()`
- `SelectPreviousTarget()`
- `ClearSelection()` already exists
- `SetAutoFireEnabled(bool)` already exists
- `CyclePriorityMode()`

This keeps target ordering, pruning, active-target resolution, and priority semantics in the Weapon Computer instead of reimplementing them in UI code.

## Layout

Use one compact row below the Combat context body and above the gauge area:

- Prev
- Next
- Clear
- Auto Fire state
- Priority mode

The row uses the existing simple HUD button style and fixed dimensions. The Combat context body/gauge layout gets the same kind of dynamic spacing used by Navigation controls so viewport changes do not cause overlaps.

## Constraints

- No decorative panel stack or new large window in Basic.
- No debug-only weapon values in the player context.
- No target-selection logic duplicated in the HUD renderer.
- No changes to turret fire physics or projectile behavior.

## Risk

`PrototypeWeaponComputer` currently tracks selected targets by stable id. The helper methods must call existing refresh/prune/update paths so destroyed or invalid targets do not become stale active targets.
