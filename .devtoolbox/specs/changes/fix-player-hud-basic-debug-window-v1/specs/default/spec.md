# Spec - Basic Player HUD Debug Window And Marker Gating

## Requirements

- Basic preset MUST hide the legacy IMGUI `PrototypeWeaponComputerPanel` window.
- Basic preset MUST continue to keep the player-facing HUD available through `PrototypePlayerHudRenderer` and MUST NOT route F1 to the old keybind overlay.
- Non-Basic diagnostic presets MAY show the legacy Weapon Computer panel, but it SHOULD remain collapsed except in FullDiagnostics.
- F7 MAY still toggle the legacy Weapon Computer panel for developer use.
- Screen-space target indicators MUST clamp away from fixed top context UI, side panels, and bottom flight controls.
- The fix MUST NOT mutate flight-control values or weapon gameplay state.

## Expected Behavior

When `PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.Basic, ..., weaponComputer)` is applied, `weaponComputer.IsWindowVisible` is false. When FlightTest is applied, the panel is visible and collapsed. When FullDiagnostics is applied, the panel is visible and expanded.

Offscreen target indicators near the top of the screen clamp below the top context strip instead of covering context title/status text.

## Verification

- EditMode test covers Basic, FlightTest, and FullDiagnostics behavior for `PrototypeWeaponComputerPanel`.
- EditMode target-indicator projection test covers right-panel and top-context safe-area clamping.
- Unity MCP validates the changed scripts and runs focused UI/HUD tests.
- A fresh GameView screenshot confirms the default player view no longer contains the old IMGUI Weapon Computer window and does not place target markers over the top context strip.
