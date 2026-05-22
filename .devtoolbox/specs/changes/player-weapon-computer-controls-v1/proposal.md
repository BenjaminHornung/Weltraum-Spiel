# player-weapon-computer-controls-v1 Proposal

## Problem

The current Basic Player HUD can show combat state, target health, range, fire status, Auto Fire, and priority, but the player cannot operate the Weapon Computer from the player-facing HUD. The legacy `PrototypeWeaponComputerPanel` is intentionally hidden in Basic and remains a debug/diagnostic window, so combat still feels like status text rather than a usable player system.

## Outcome

Add compact, player-facing Weapon Computer controls inside the existing Combat context panel. The player must be able to cycle combat targets, clear the current selection, toggle Auto Fire, and cycle priority mode without opening the debug Weapon Computer window.

## Scope

- Add HUD controls visible only when Combat context is active.
- Reuse `PrototypeWeaponComputer` target discovery, selection, Auto Fire, priority, and turret status APIs.
- Add small missing gameplay-facing helper APIs to `PrototypeWeaponComputer` when needed, instead of duplicating target-selection logic in the HUD.
- Keep target health, range, fire readiness, Auto Fire state, and priority visible in the Combat context.
- Preserve the old F7/diagnostic `PrototypeWeaponComputerPanel` as developer UI, not Basic default UI.
- Verify non-overlap behavior across the existing HUD aspect-ratio matrix.

## Non-goals

- No new enemy AI, ammo, energy, heat, or weapon inventory UI.
- No final large map/list overlay.
- No removal of the existing debug Weapon Computer panel.
- No projectile, turret physics, recoil, or hit chance gameplay changes.
