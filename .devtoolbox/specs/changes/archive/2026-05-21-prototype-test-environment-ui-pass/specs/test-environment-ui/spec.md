# Spec: Prototype Test Environment UI

## Capability

The prototype shall provide readable movable UI, a primitive orientation test environment, and a simple minimap/radar view that supports manual flight, RCS testing, target practice, and future navigation work.

## Requirements

### Draggable Prototype UI

- Debug Overlay, Debug Console, HUD/Navball, Keybind Help, and Minimap shall be draggable IMGUI windows.
- Windows shall clamp within the current screen bounds.
- Window positions may be persisted with PlayerPrefs.
- A Reset UI Layout action shall restore default positions and visibility/collapse defaults.
- UI presets shall be available: Basic, Flight Test, RCS Test, and Full Diagnostics.
- Presets shall not break existing flight controls, debug buttons, RCS controls, SAS, target dummy, or HUD behavior.

### Keybind Help

- F1 shall toggle a compact Keybind Help overlay.
- The overlay shall be draggable.
- Keybinds shall be grouped by Flight, Main Throttle, RCS, SAS/Precision, Camera, Weapons, Debug, and UI.
- README Controls shall match the overlay for UI toggles and prototype controls.
- F2 shall toggle Flight Diagnostics.
- F3 shall toggle Debug Console.
- F4 shall toggle HUD/Navball.
- F5 shall toggle Minimap.

### HUD/Navball Readability

- Navball text shall not be visibly clipped in the default window size.
- The HUD shall show only the active mode by default, such as `Mode: TARGET`.
- The long mode legend `WORLD | VELOCITY | TARGET | DOCKING | ORBIT/GRAVITY` shall not occupy the compact HUD by default.
- Marker/debug legends may move to keybind help or diagnostics.
- Debug force markers shall default off.
- Marker labels should avoid excessive overlap where practical within the prototype IMGUI implementation.

### Prototype Test Environment

- Bootstrap shall optionally generate a primitive test environment under one root object named `PrototypeEnvironment`.
- Rebuild/Clear behavior shall prevent duplicate generated environment objects.
- The environment shall use Unity primitives, LineRenderer, simple materials, lights, and optional TextMesh labels only.
- No external asset packs shall be imported.
- The environment shall include:
  - Origin Beacon at the world origin with a visible marker and optional `ORIGIN` label.
  - Color-coded X/Y/Z world axes.
  - Range rings around the start area on the XZ plane at approximately 100 m, 250 m, 500 m, and 1000 m.
  - At least five targets at different positions/heights, including close, far, high, lateral, and moving-placeholder variants.
  - Three to five non-hostile navigation beacons with a distinct color from targets.
  - Several approach gates/frames in sequence.
  - A large station or hangar placeholder made from primitives.
  - A primitive asteroid/obstacle field that is visual-only or clearly non-damaging.
  - Lighting and ambient/background settings that make ship and landmarks readable.

### Minimap / Radar v0

- F5 shall toggle a draggable minimap window.
- The minimap shall use a top-down XZ projection centered on the ship.
- The ship shall render as a triangle or clear heading glyph.
- Heading and velocity vector shall be visible.
- Targets, beacons, station, gates, and origin shall be visible.
- Distance rings shall be visible.
- Zoom levels shall include 250 m, 500 m, 1000 m, and 2500 m.
- Zoom shall be controllable by buttons and may also respond to mouse wheel while hovered.
- Labels shall be optional so the map can be decluttered.
- The implementation shall not require a RenderTexture minimap camera, final map menu, mission routes, or waypoint autopilot.

### Ship Visual Readability

- Generated ship modules shall remain color-coded: neutral hull, recognizable cockpit, green fuel tank, blue/orange main thruster, cyan/green RCS, yellow/red gun, distinct cargo/utility, and optional damaged marking.
- Optional module labels may be shown for prototype readability.
- No final assets or ship-builder architecture shall be introduced.

## Acceptance Scenarios

- On startup the scene has visible orientation landmarks, not only an empty default background.
- Multiple targets and beacons are visible and distinguishable.
- The player can orient using origin, axes, rings, beacons, gates, and station placeholder.
- Minimap shows the ship, heading, velocity, and relevant environment points.
- Minimap is draggable and F5 toggleable.
- Keybind overlay is F1 toggleable.
- Debug/HUD windows are draggable and no longer dominate the scene by default.
- Navball text is readable and not clipped.
- Existing flight controls, RCS, SAS, debug controls, projectiles, and target dummy behavior still work.
- README documents UI toggles, minimap, and generated environment landmarks.
- Unity script validation reports no compile errors.
- Existing EditMode tests pass or are not regressed.
