# Capability: Prototype UI Readability and Testability

## Requirements

### Requirement: Draggable prototype UI windows

The prototype SHALL render Debug Overlay, Flight Debug Console, Flight HUD/Navball, and Keybind Overlay as draggable IMGUI windows.

#### Scenario: Dragging a window

- GIVEN any prototype UI window is visible
- WHEN the tester drags its title area with the mouse
- THEN the window position changes
- AND the window remains fully reachable inside the visible screen.

#### Scenario: Remembered layout

- GIVEN a window has been moved
- WHEN runtime layout persistence is enabled for that window
- THEN the position MAY be saved in PlayerPrefs
- AND a reset layout action SHALL restore the known default layout.

### Requirement: Compact default startup UI

The prototype SHALL start with a compact flight-testing UI instead of full diagnostics covering the play view.

#### Scenario: Startup view

- GIVEN the prototype scene starts
- WHEN the first frame is rendered
- THEN the UI presents a compact flight view with fuel, speed, throttle, RCS/SAS state, main thrust, and active target available
- AND dense diagnostics and the debug console are hidden or collapsed by default.

#### Scenario: Advanced diagnostics remain available

- GIVEN the tester needs deep telemetry
- WHEN the tester expands diagnostics or selects the Full Diagnostics preset
- THEN the existing diagnostic details and debug actions remain available without changing flight controls.

### Requirement: Function key UI toggles

The prototype SHALL use F1/F2/F3/F4 for major debug UI visibility toggles.

#### Scenario: Keybind help toggle

- WHEN the tester presses F1
- THEN the Keybind Overlay toggles visible or hidden.

#### Scenario: Flight diagnostics toggle

- WHEN the tester presses F2
- THEN the Flight Diagnostics / Debug Overlay window toggles visible or hidden.

#### Scenario: Debug console toggle

- WHEN the tester presses F3
- THEN the Flight Debug Console toggles visible or hidden.

#### Scenario: HUD or debug marker toggle

- WHEN the tester presses F4
- THEN the HUD/Navball or debug marker visibility toggles in a documented, predictable way.

### Requirement: Keybind overlay and documentation parity

The prototype SHALL provide a compact draggable Keybind Overlay whose contents match README controls.

#### Scenario: Keybind categories

- GIVEN the Keybind Overlay is visible
- THEN it groups controls into Flight attitude, Main throttle, RCS translation, SAS/Precision, Camera, Weapons, and Debug.

#### Scenario: German keyboard safe bindings

- GIVEN the keybind help lists major UI toggles
- THEN it uses F1/F2/F3/F4 instead of punctuation or German-keyboard-sensitive symbols
- AND it preserves the Y/Z full throttle note.

### Requirement: Readable navball HUD

The prototype SHALL keep navball text and markers readable in the standard HUD mode.

#### Scenario: Short mode label

- GIVEN the navball is visible in standard mode
- THEN it shows only the active mode label such as `Mode: TARGET`
- AND it does not permanently render the full `WORLD | VELOCITY | TARGET | DOCKING | ORBIT/GRAVITY` list in the navball footer.

#### Scenario: Standard marker set

- GIVEN debug markers are not active
- THEN the navball shows only short, useful labels such as FWD, PRO, RET, and TGT when available
- AND DES, ACT, and RES markers are hidden unless debug marker mode is active.

#### Scenario: Text fit

- GIVEN the navball window is visible at its default size
- THEN text and marker labels are not clipped by the window bounds.

### Requirement: Prototype module color palette

The prototype SHALL render generated primitive ship modules with a consistent role-based color palette.

#### Scenario: Module distinction

- GIVEN any generated prototype ship variant is spawned
- THEN hull, cockpit, fuel tank, main engine, RCS blocks, gun, cargo/utility, and damaged modules are visually distinguishable by color
- AND the palette is applied consistently across variants.

#### Scenario: Primitive-only constraint

- WHEN the palette is applied
- THEN no final asset import or non-primitive ship art dependency is introduced.

### Requirement: UI presets for testing

The prototype SHALL expose Basic, Flight Test, RCS Test, and Full Diagnostics UI presets from the Debug Console.

#### Scenario: Basic preset

- WHEN the tester selects Basic
- THEN the play view is minimally covered and core gameplay remains visible.

#### Scenario: Flight Test preset

- WHEN the tester selects Flight Test
- THEN compact flight diagnostics and the navball are available.

#### Scenario: RCS Test preset

- WHEN the tester selects RCS Test
- THEN RCS diagnostics and marker visibility are configured for allocator testing.

#### Scenario: Full Diagnostics preset

- WHEN the tester selects Full Diagnostics
- THEN existing detailed diagnostics and debug buttons are available, but draggable and collapsible.

### Requirement: Existing behavior preservation

The prototype SHALL preserve existing keyboard control behavior and existing debug actions.

#### Scenario: Existing controls

- GIVEN the UI readability pass is active
- WHEN the tester uses existing flight, throttle, RCS, SAS, camera, weapon, and debug action keys
- THEN the control behavior remains unchanged.

#### Scenario: Existing debug buttons

- GIVEN the Debug Console is expanded or Full Diagnostics is active
- THEN existing debug buttons remain reachable.
