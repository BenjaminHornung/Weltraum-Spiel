# Proposal - fix-player-hud-basic-debug-window-v1

## Problem

The real GameView verification for the player target indicators showed the legacy IMGUI `Weapon Computer` window visible in the Basic/Player HUD view. That violates the player-facing UI direction: Basic must show the new Player HUD as the normal game interface, while old IMGUI diagnostics remain opt-in developer/prototype layers.

## User Outcome

The default Basic Player view no longer shows the old draggable Weapon Computer window, reducing overlap risk and keeping the screen focused on player HUD, objective, radar, context, and target indicators. Debug/diagnostic presets and F7 still keep access to the prototype Weapon Computer panel.

## Scope

- Fix `PrototypeUiLayoutManager.ApplyPreset` so Basic hides `PrototypeWeaponComputerPanel`.
- Preserve visible/collapsed behavior for FlightTest/RcsTest/FullDiagnostics.
- Add a focused UI architecture regression test.
- Re-capture Player HUD screenshot evidence after the fix.

## Non-Goals

- No redesign of the player combat HUD.
- No removal of `PrototypeWeaponComputerPanel`.
- No weapon targeting gameplay changes.
