# player-ui-regression-controls-autopilot-rcs-v1

## Why

The current player HUD checkpoint still exposes several prototype-era paths during normal play: F7 can open the legacy IMGUI weapon computer, navigation planning is only a compact context-row action, Kill Momentum lacks a keyboard action and can fail to request main thrust in RCS control modes, and RCS VFX direction needs renewed proof against the imported and generated ship paths.

## What

- Keep Basic player view on uGUI player-facing controls instead of legacy IMGUI weapon/minimap windows.
- Restore visible player minimap content in real HUD screenshots with grid, route/blip markers, and runtime pixel evidence.
- Add player-facing navigation and combat computer popups that reuse the existing autopilot and weapon computer APIs.
- Add a Kill Momentum keybind and allow assist-owned main-brake thrust while preserving manual main-thrust lockout in Precision/Translation.
- Recheck autopilot brake/avoidance behavior with focused tests.
- Fix and verify RCS VFX exhaust placement/direction relative to nozzle force direction.

## Out Of Scope

- Full route editor, multi-leg map editing, gravity/orbit planning, and final key-remapping UI.
- Replacing the old developer IMGUI panels; they remain available in debug/prototype presets.
