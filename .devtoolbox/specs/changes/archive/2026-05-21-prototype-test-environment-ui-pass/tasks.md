# Tasks: prototype-test-environment-ui-pass

## Spec

- [x] Create DevToolbox change artifacts for proposal, design, test-environment-ui spec, and tasks.
- [x] Validate the new change with `specs_validate` before implementation.

## Discovery

- [x] Review existing prototype UI, bootstrap, target dummy, controls, docs, and prior test-protocol conventions.
- [x] Identify reusable UI/window and primitive-generation patterns before adding new code.

## Implementation

- [x] Wire F1-F5 UI toggles, draggable windows, reset layout, and Basic/Flight Test/RCS Test/Full Diagnostics presets across diagnostics, console, HUD, keybind help, and minimap.
- [x] Improve HUD/Navball readability so compact mode shows the active mode without clipped long legends and debug force markers default off.
- [x] Add `PrototypeTestEnvironment` or equivalent to rebuild a generated primitive test range with origin, axes, rings, multiple targets, beacons, gates, station/hangar, obstacle field, labels, and readable lighting.
- [x] Add `PrototypeMinimapOverlay` or equivalent to draw a draggable top-down radar with ship heading, velocity, rings, zoom, labels, and environment points.
- [x] Update bootstrap wiring so the test environment and minimap are optional, generated without duplicates, and reuse existing target dummy/ship systems.
- [x] Ensure generated ship modules remain visually distinct with existing prototype color/palette conventions and optional labels where practical.
- [x] Update README controls and prototype environment documentation.

## Verification

- [x] Run Unity script validation for changed scripts.
- [x] Refresh Unity/compile and check console for errors.
- [x] Run EditMode tests or the smallest available regression suite.
- [x] Write `.devtoolbox/specs/changes/prototype-test-environment-ui-pass/tests/test-protocol.md` with visual inspection scope, validation evidence, and known limits.
- [x] Run DevToolbox verification for the execution when available.
- [x] Run `tasks_completion_preflight` before toggling completed task items.
