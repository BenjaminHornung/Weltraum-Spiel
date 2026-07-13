# Fix Prototype UI Performance v1

## Problem

The temporary IMGUI prototype UI keeps normal Play Mode too busy. Several windows persist their window state from `OnGUI()` on every repaint, and the heavier overlays rebuild diagnostics, strings, target lists, or component references even when collapsed or not needed. With multiple windows visible, this makes the Flight Test preview feel slow and unresponsive.

## Outcome

The default Flight Test preset stays responsive while keeping the same prototype UI controls available. HUD and minimap can remain visible, but expensive diagnostics, console controls, target discovery, and weapon computer details should only run when the relevant window and section are open or when explicitly requested through debug presets/hotkeys.

## Scope

- Optimize the existing IMGUI prototype windows without removing features.
- Add throttled dirty persistence for `PrototypeUiWindowState`.
- Add sampling/cached view models for HUD, diagnostics, minimap/keybind helpers where useful, and weapon computer panel.
- Make Flight Test defaults cheaper by hiding the debug console and weapon computer panel unless requested.
- Add EditMode coverage for persistence, sampling, collapsed paths, presets, and retained view-model behavior.
- Update README/docs and capture verification evidence.

## Non-Goals

- Migrating the prototype UI to UI Toolkit.
- Removing Full Diagnostics or debug controls.
- Changing flight physics, weapon behavior, or input bindings.
- Replacing IMGUI layout entirely; this is a performance containment pass for temporary prototype tooling.
