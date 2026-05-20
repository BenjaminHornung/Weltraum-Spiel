# Design: prototype-test-environment-ui-pass

## Reuse Strategy

The project already has prototype IMGUI overlays and newly introduced shared UI state helpers. This change reuses those helpers instead of creating parallel UI systems:

- `PrototypeUiWindowState` owns draggable rects, clamp-to-screen, collapsed/visible state, and optional PlayerPrefs persistence.
- `PrototypeUiLayoutManager` owns global function-key routing and UI presets.
- `PrototypeFlightHud`, `PrototypeDebugOverlay`, `PrototypeFlightDebugConsole`, and `PrototypeKeybindOverlay` keep their existing responsibilities and move through the shared window helper.
- `PrototypeTargetDummy` remains the target hit-feedback component; additional test targets are primitive instances with the same component.
- `PrototypeBootstrap` remains the central prototype scene composer and wires generated environment/UI helpers onto the bootstrap host.

New code is justified only where there is no existing component: a primitive environment manager and a minimap/radar overlay. Both are prototype-scoped and do not introduce final gameplay architecture.

## UI Design

All prototype UI surfaces are IMGUI windows for consistency with the existing debug tooling. The default layout should keep the scene visible: diagnostics and console can be collapsed or hidden by presets, HUD/navball is compact, keybind help is off until F1, and minimap is small enough to live in a corner.

Function keys are centralized:

- F1: keybind help
- F2: flight diagnostics
- F3: debug console
- F4: HUD/navball
- F5: minimap

Presets apply visibility/collapse/debug detail state across the same windows: Basic, Flight Test, RCS Test, and Full Diagnostics. Reset Layout returns windows to defaults and clears persisted rects.

## Environment Design

`PrototypeTestEnvironment` generates one root object named `PrototypeEnvironment`. Rebuild first clears the previous root so repeated bootstrap runs do not duplicate objects. Geometry uses Unity primitives, LineRenderer rings/axes, simple materials, and optional TextMesh labels. Colliders are removed or disabled where geometry is visual-only. Targets keep colliders and `PrototypeTargetDummy` for weapon testing.

Environment points are exposed as lightweight runtime records so the minimap can draw targets, beacons, station, gates, origin, and obstacle-field hints without parsing scene names.

## Minimap Design

`PrototypeMinimapOverlay` is a draggable IMGUI radar, not a camera. It draws a top-down XZ projection centered on the ship. Ship heading, velocity, range rings, origin, targets, beacons, station, gates, and obstacle landmarks are drawn with simple GUI primitives. Zoom levels are fixed at 250 m, 500 m, 1000 m, and 2500 m. Labels can be toggled to control clutter.

This keeps the slice lightweight and directly reusable by future waypoint/autopilot work without committing to a final map UI.

## Visual Readability

The existing generated ship module coloring is preserved and normalized through the prototype palette: hull neutral, cockpit red/orange, fuel green, main thrusters blue/orange, RCS cyan/green, guns yellow/red, and utility/cargo distinct. Optional prototype module labels can be attached as small TextMesh markers, but no ship-builder data model is introduced.

## Verification

Verification should include script validation for changed scripts, Unity refresh/compile console checks, EditMode tests, and a written `tests/test-protocol.md` with visual inspection scope and known prototype limits. DevToolbox task completion must run preflight before toggling tasks.
