# Design: Prototype UI Readability and Testability Pass

## Approach

Stay on IMGUI for this pass. UI Toolkit or a final menu framework would create a larger migration and is not needed to unblock prototype testing. The implementation should clean up the existing IMGUI surface by giving each prototype UI region a shared window state, compact defaults, and predictable function-key toggles.

## Shared Window State

Introduce small reusable runtime helpers:

- `PrototypeUiWindowState` stores an id, rect, visibility, collapsed state, default rect, and optional PlayerPrefs persistence.
- `PrototypeUiLayoutManager` owns named window states and presets.
- `PrototypeUiPreset` describes Basic, Flight Test, RCS Test, and Full Diagnostics layouts.

The helpers should be lightweight plain C# classes under `Assets/Scripts/Prototype/`. They should not require scene assets or a final UI framework.

## Window Behavior

Each IMGUI owner keeps responsibility for its own content, but delegates placement and common controls to shared window state:

- `PrototypeDebugOverlay` becomes the Flight Diagnostics window.
- `PrototypeFlightDebugConsole` becomes a small collapsed Debug Console by default.
- `PrototypeFlightHud` draws the HUD/Navball in a draggable window.
- A new `PrototypeKeybindOverlay` draws the compact F1 help window.

Windows are clamped to the visible screen after every draw and may remember positions through PlayerPrefs. A reset layout action returns all windows to known defaults.

## Presets

`PrototypeFlightDebugConsole` should expose UI presets because testers need different amounts of UI for different passes:

- Basic: minimal UI and maximum play view visibility.
- Flight Test: compact diagnostics plus HUD/navball.
- RCS Test: RCS diagnostics and debug markers available for allocator testing.
- Full Diagnostics: existing deep telemetry remains available, but movable and collapsible.

Presets must not change flight physics or control bindings. They only change prototype UI visibility, collapsed states, and debug marker visibility.

## Keybinds

Use F1/F2/F3/F4 for prototype UI toggles because these avoid German keyboard symbol ambiguity and do not conflict with the existing RCS, SAS, throttle, or weapon controls.

The runtime keybind overlay and README must present the same binding set and preserve the Y/Z full throttle note.

## Navball Readability

Keep the navball simple and readable:

- Show a short active mode line such as `Mode: TARGET` instead of the long mode list.
- Default visible markers to FWD, PRO, RET, and TGT where available.
- Keep DES, ACT, RES, and marker-heavy diagnostics behind debug marker mode.
- Increase window padding and avoid placing text in the marker circle footer.
- Offset marker labels slightly so multiple labels are less likely to overlap.

## Module Colors

Keep primitive-only generated modules but centralize colors through a `PrototypeModuleColorPalette` or equivalent helper. Reuse the existing role-based module layout instead of introducing assets.

The palette should make module roles visually distinguishable across variants: hull, cockpit, fuel tank, main engine, RCS, gun, cargo/utility, damaged modules, and orientation markers.

## Reuse

Reuse the existing controller, debug action, diagnostic, variant, and primitive construction paths. New code is justified only for shared IMGUI state, keybind rendering, and centralized color selection because those concerns are currently duplicated or missing.

## Verification Strategy

- Validate changed C# scripts through Unity MCP `validate_script`.
- Refresh Unity and check console for compile errors.
- Run Unity EditMode tests through Unity MCP.
- Run explicit `dotnet build` and `dotnet test` against `Weltraum Spiel.sln` as a fallback compile/test check.
- Write `tests/test-protocol.md` with automated verification and manual sight-check notes for draggable windows, default clutter, navball readability, keybind consistency, debug button availability, and module color distinction.
