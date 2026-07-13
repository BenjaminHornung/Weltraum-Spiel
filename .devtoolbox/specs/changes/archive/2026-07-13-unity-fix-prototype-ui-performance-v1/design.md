# Design

## Current Findings

The six prototype windows all use `OnGUI()` and most of them call `PrototypeUiWindowState.SaveToPrefs()` after `GUI.Window()`. The current implementation writes `x`, `y`, `w`, `h`, `visible`, and `collapsed` to `PlayerPrefs` on every repaint. `PrototypeDebugOverlay` also builds a large diagnostics block inside `OnGUI()` and runs `GetComponentsInChildren<PrototypeModuleDamageState>()` even when the Damage section is closed. HUD and keybind overlays rebuild view models during repaint, minimap refreshes references and label candidates inside GUI, and weapon computer panel resolves references during both `Update()` and `OnGUI()`.

## Decisions

### Window State Persistence

Introduce dirty state and throttled persistence in `PrototypeUiWindowState` rather than fixing each caller independently. Window state setters and rect/size helpers will mark dirty only when values actually change. A small storage interface/test hook will wrap `PlayerPrefs` so EditMode tests can prove writes are skipped when there is no state change.

Call sites should use a throttled save method from `OnGUI()`. The method may save immediately for a dirty state change, but must not write repeatedly on unchanged repaints. The throttle window should stay in the 0.5-1.0 second range.

### Sampling and Cached View Models

Keep the existing IMGUI draw code and model builders, but move expensive sampling out of unconditional repaint paths. HUD can refresh once per frame for fast values and keep its last view model for drawing. Debug overlay should keep a lightweight snapshot for the compact header and only collect heavy diagnostics when the advanced window and matching section are open. Damage diagnostics should be sampled separately and only when the damage section is open.

Collapsed windows should remain cheap: they can draw the header and persist changed state, but should not resolve expensive references, discover targets, or build large strings.

### Reference Resolution

Prefer bind/start-time references and resolve only missing references. `PrototypeFlightHud` should not call `FindAnyObjectByType<PrototypeTargetDummy>()` from the GUI/refresh path. `PrototypeWeaponComputerPanel` should not call `ResolveReferences()` every `Update()` and `OnGUI()`; it should rely on `Bind()`/`Start()` and retry only if a required reference is missing.

### Presets

The Flight Test preset should show the minimum useful flight UI: HUD/Navball, minimap, and compact diagnostics. Debug Console and Weapon Computer Panel remain available through F3/F7 and Full Diagnostics, but are not automatically open in the normal startup preset.

## Reuse

This change reuses the existing `PrototypeUiLayoutManager`, `PrototypeUiWindowState`, `PrototypeHudViewModelBuilder`, `PrototypeDebugViewModelBuilder`, and existing NUnit EditMode style. New helper types should stay small and local to prototype UI scripts because the whole IMGUI layer is temporary.

## Verification Strategy

- EditMode tests for dirty/throttled window state persistence.
- EditMode tests for sampling frequency and collapsed-window cheap paths.
- Preset tests proving Flight Test does not open debug console or weapon computer by default.
- Existing HUD/debug/weapon tests continue to prove functional values are preserved.
- Manual Play Mode check recorded in `tests/test-protocol.md`; profiler evidence is optional if Unity MCP profiler support is available.
