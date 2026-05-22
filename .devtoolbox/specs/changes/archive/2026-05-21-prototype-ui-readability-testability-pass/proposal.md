# prototype-ui-readability-testability-pass

## Why

The current prototype debug and HUD UI is useful but too large and too static for everyday flight testing. Dense diagnostics and fixed IMGUI blocks can cover the play view, obscure ship behavior, and slow down follow-up work on waypoint autopilot, ship blueprint, builder, and combat features.

This change is a fast prototype UI readability and testability pass. It keeps IMGUI and primitive-only prototype visuals, but makes the UI easier to hide, move, collapse, and use during manual testing.

## What

Build a prototype-facing UI pass that:

- Makes Debug Overlay, Flight Debug Console, Flight HUD/Navball, and Keybind Overlay draggable IMGUI windows.
- Keeps windows clamped to the visible screen and optionally remembers their positions.
- Adds a reset layout action and UI presets for Basic, Flight Test, RCS Test, and Full Diagnostics.
- Defaults startup to a compact flight view instead of a screen-covering diagnostics view.
- Adds F1/F2/F3/F4 toggles for keybind help, flight diagnostics, debug console, and HUD/navball or debug markers.
- Improves navball readability by removing long permanent mode text, keeping short labels, adding padding, and reducing marker clutter.
- Adds a consistent prototype module color palette for generated primitive ship modules.
- Updates README keybind documentation to match the runtime keybind overlay.

## Out of Scope

- No final UI Toolkit migration.
- No final game HUD, main menu, settings menu, or remapping UI.
- No imported final art assets.
- No changes to existing flight controls, physics behavior, or debug action semantics.
- No waypoint autopilot, ship blueprint, builder, or combat implementation in this change.

## Success Criteria

- Startup UI no longer covers half the screen.
- Each prototype UI window can be dragged with the mouse and remains visible on screen.
- F1 toggles keybind help.
- F2 toggles flight diagnostics.
- F3 toggles the debug console.
- F4 toggles HUD/navball or debug marker visibility in a predictable way.
- Navball text is not clipped and default labels are short and readable.
- Debug force markers are not noisy by default.
- Ship modules are visually distinguishable by module role while staying primitive-only.
- README keybinds match the runtime keybind overlay.
- Existing keyboard controls and debug buttons remain available.
- Unity script validation and tests finish without compile errors.
