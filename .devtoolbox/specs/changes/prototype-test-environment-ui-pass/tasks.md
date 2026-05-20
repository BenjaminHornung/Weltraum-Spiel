# Tasks: prototype-test-environment-ui-pass

## Spec

- [x] Create DevToolbox change artifacts for proposal, design, test-environment-ui spec, and tasks.
- [ ] Validate the new change with `specs_validate` before implementation.

## Discovery

- [x] Review existing prototype UI, bootstrap, target dummy, controls, docs, and prior test-protocol conventions.
- [ ] Identify reusable UI/window and primitive-generation patterns before adding new code.

## Implementation

- [ ] Wire F1-F5 UI toggles, draggable windows, reset layout, and Basic/Flight Test/RCS Test/Full Diagnostics presets across diagnostics, console, HUD, keybind help, and minimap.
- [ ] Improve HUD/Navball readability so compact mode shows the active mode without clipped long legends and debug force markers default off.
- [ ] Add `PrototypeTestEnvironment` or equivalent to rebuild a generated primitive test range with origin, axes, rings, multiple targets, beacons, gates, station/hangar, obstacle field, labels, and readable lighting.
- [ ] Add `PrototypeMinimapOverlay` or equivalent to draw a draggable top-down radar with ship heading, velocity, rings, zoom, labels, and environment points.
- [ ] Update bootstrap wiring so the test environment and minimap are optional, generated without duplicates, and reuse existing target dummy/ship systems.
- [ ] Ensure generated ship modules remain visually distinct with existing prototype color/palette conventions and optional labels where practical.
- [ ] Update README controls and prototype environment documentation.

## Verification

- [ ] Run Unity script validation for changed scripts.
- [ ] Refresh Unity/compile and check console for errors.
- [ ] Run EditMode tests or the smallest available regression suite.
- [ ] Write `.devtoolbox/specs/changes/prototype-test-environment-ui-pass/tests/test-protocol.md` with visual inspection scope, validation evidence, and known limits.
- [ ] Run DevToolbox verification for the execution when available.
- [ ] Run `tasks_completion_preflight` before toggling completed task items.
