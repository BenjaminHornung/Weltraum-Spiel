# Capability: UI Environment Declutter

## Requirements

### Requirement: Scrollable keybind overlay

The F1 keybind overlay SHALL be scrollable and screen-clamped so all content remains reachable at common Game View sizes.

#### Scenario: Long keybind content fits the screen

- GIVEN the keybind overlay is visible
- WHEN the overlay contains all required categories
- THEN the window height is clamped to the available screen height
- AND the content is rendered inside a `GUILayout.BeginScrollView`/`GUILayout.EndScrollView` pair
- AND the user can scroll to every category without clipped text

#### Scenario: Required keybind categories are present

- GIVEN the keybind overlay is visible
- WHEN the user reviews controls
- THEN it groups controls under UI, Flight, Normal / Main Throttle, Precision Mode, Translation Mode, Navigation / Autopilot, Momentum Assist, SAS / Assist, Camera, Weapons, and Debug

### Requirement: Navigation, control modes, and momentum controls documented in UI

The keybind overlay SHALL describe runtime navigation/autopilot controls, explicit Normal/Precision/Translation control modes, and Momentum Assist controls.

#### Scenario: Autopilot controls are visible

- GIVEN the keybind overlay is visible
- WHEN the user opens the Navigation / Autopilot section
- THEN Tab is listed as next waypoint
- AND B is listed as previous waypoint
- AND G is listed as toggle waypoint autopilot
- AND the overlay explains that autopilot uses Normal/Main-Thruster mode while Precision and Translation are close-range manual control modes

#### Scenario: Control mode controls are visible

- GIVEN the keybind overlay is visible
- WHEN the user opens the control mode sections
- THEN Caps Lock is listed as cycling Normal / Precision / Translation
- AND Normal mode is documented with W/S pitch, A/D yaw, Q/E roll, and Shift/Ctrl main throttle
- AND Precision mode is documented with W/S pitch, A/D yaw, Q/E roll through RCS and main thruster disabled
- AND Translation mode is documented with W/S forward/back, A/D left/right, H/N up/down, Q/E roll if kept, and main thruster disabled
- AND Left Alt is not documented as the primary translation-mode switch
- AND Shift/Ctrl are not described as the primary RCS forward/back solution
- AND the overlay states that main thruster and gimbal stay off in Precision and Translation

#### Scenario: Momentum assist controls are visible

- GIVEN the keybind overlay is visible
- WHEN the user opens the Momentum Assist section
- THEN the HUD Kill Momentum button is documented
- AND any optional keyboard binding is documented only if it is conflict-free
- AND K is not reused for Kill Momentum because K is already RCS up/down
- AND the overlay states that Kill Momentum is not a direct velocity reset

### Requirement: Environment display modes

The prototype SHALL expose environment display modes `Minimal`, `Training`, and `Full Debug`.

#### Scenario: Default display mode is quiet

- GIVEN the prototype starts with default settings
- WHEN the environment is generated
- THEN the active display mode is Training or Minimal
- AND Full Debug is not the default
- AND debug-only clutter remains available through Full Debug

### Requirement: Reduced world labels

World-space labels SHALL provide orientation without dominating the view.

#### Scenario: Default labels are limited

- GIVEN the default display mode is active
- WHEN the generated environment is visible
- THEN default labels are limited to ORIGIN, selected target or selected waypoint, nearest target or beacon, and station/hangar when present
- AND gate labels and range-ring labels are hidden or much smaller by default
- AND large sideways TextMesh labels do not dominate the camera view
- AND labels are smaller and aligned for readability where practical

#### Scenario: Full Debug can show more diagnostics

- GIVEN Full Debug display mode is active
- WHEN the generated environment is visible
- THEN additional gate, range, target, beacon, obstacle, and diagnostic labels may be shown
- AND the default quiet mode can be restored without regenerating unrelated gameplay state

### Requirement: Minimap clutter controls

The minimap SHALL default to readable labels-off behavior and expose filters for environment point types.

#### Scenario: Default minimap is readable

- GIVEN the minimap is visible with default settings
- WHEN labels are not explicitly enabled
- THEN `showLabels` defaults to false
- AND map points remain useful without text overlap

#### Scenario: Minimap filters are available

- GIVEN the minimap settings are visible
- WHEN the user changes filters
- THEN Targets, Beacons, Gates, Station, Obstacles, and Labels can be toggled independently
- AND an opacity control may be exposed if practical

#### Scenario: Label-on minimap remains bounded

- GIVEN minimap labels are enabled
- WHEN many environment points exist
- THEN labels are limited to the selected target, origin, station, and at most three nearest relevant points
- AND labels avoid complete overlap where practical

### Requirement: Debug diagnostics remain reachable

Decluttering SHALL NOT remove existing debug capability.

#### Scenario: Full diagnostics remain available

- GIVEN the user switches to Full Debug or opens the debug console
- WHEN diagnostics are requested
- THEN existing flight, RCS, environment, target, and debug UI data remains reachable
- AND the quiet default does not permanently disable diagnostic rendering

## Acceptance

- Keybind overlay is scrollable and not clipped.
- Autopilot, Normal/Precision/Translation modes, and Momentum Assist controls are visible in keybind help.
- Default scene is calmer and no longer filled with huge labels.
- Minimap defaults are readable and labels-off.
- Full diagnostics remain available when explicitly enabled.
