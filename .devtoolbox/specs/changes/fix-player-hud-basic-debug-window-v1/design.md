# Design - fix-player-hud-basic-debug-window-v1

## Decision

Reuse the existing `PrototypeUiLayoutManager` preset boundary instead of adding new per-panel conditionals in `PrototypeWeaponComputerPanel`. Presets already decide which IMGUI prototype windows belong to Basic versus diagnostic views, so the smallest correct fix is to make Weapon Computer follow the same Basic gating as Diagnostics/HUD/Minimap.

## Tradeoff

The old Weapon Computer panel remains available in diagnostic views and through F7, which preserves developer workflow while removing it from the default player-facing screenshot. This does not yet build the final player weapon computer controls; that remains a later `player-weapon-computer-controls-v1` slice.

## Reuse

No new UI system is introduced. The fix reuses the existing window state, preset, and architecture tests.
