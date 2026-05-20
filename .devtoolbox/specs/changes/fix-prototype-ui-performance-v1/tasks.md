# Tasks

## 1. Spec and Analysis
- [x] Record the Prototype IMGUI performance findings for `OnGUI`, PlayerPrefs writes, reference lookups, string/view-model churn, and default visible windows.
- [x] Create capability specs for UI Performance, Diagnostics Sampling, and Window State Persistence.
- [x] Validate the DevToolbox change.

## 2. Window State Persistence
- [x] Add dirty-state tracking and throttled persistence to `PrototypeUiWindowState`.
- [x] Replace repaint-time `SaveToPrefs()` calls with throttled save calls in all prototype windows.
- [x] Add EditMode tests proving unchanged repaint saves do not write and rect/visibility/collapsed changes mark dirty.

## 3. IMGUI Sampling and Cheap Collapsed Paths
- [x] Cache HUD view models and remove target discovery from HUD GUI refresh paths.
- [x] Move Debug Overlay diagnostics into sampled snapshots and compute heavy sections only when visible/open.
- [x] Make Weapon Computer Panel resolve references only at bind/start or when missing, and keep collapsed rendering cheap.
- [x] Reduce avoidable keybind/minimap rebuild work while preserving controls and labels.

## 4. Presets and Documentation
- [x] Update Flight Test preset so Debug Console and Weapon Computer Panel are not automatically open.
- [x] Keep Full Diagnostics and F1-F7 toggles available.
- [x] Update README and flight model docs with preset/performance guidance.

## 5. Verification
- [x] Run targeted Unity EditMode tests for UI performance behavior.
- [x] Run or record broader relevant EditMode verification.
- [ ] Manually inspect Play Mode responsiveness and record evidence in `tests/test-protocol.md`.
