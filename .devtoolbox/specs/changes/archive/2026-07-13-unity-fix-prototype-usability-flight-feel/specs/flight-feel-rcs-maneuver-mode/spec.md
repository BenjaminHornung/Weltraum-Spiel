# Capability: Flight Feel RCS Maneuver Mode

## Requirements

### Requirement: Explicit FlightControlMode replaces temporary modifier switching

The prototype SHALL expose one explicit `FlightControlMode` runtime enum with values `Normal`, `Precision`, and `Translation`. UI may label `Normal` as `Cruise / normal flight`, `Precision` as `RCS attitude precision`, and `Translation` as `RCS translation mode`.

#### Scenario: Caps Lock cycles control modes

- GIVEN the player is in `Normal` mode
- WHEN Caps Lock is pressed
- THEN `Precision` mode becomes active
- WHEN Caps Lock is pressed again
- THEN `Translation` mode becomes active
- WHEN Caps Lock is pressed again
- THEN `Normal` mode becomes active
- AND HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay show the same active mode name

#### Scenario: HUD and Debug Console can choose the same mode

- GIVEN the HUD/Navball quick actions are visible
- WHEN the player presses the control-mode quick action
- THEN it cycles `Normal -> Precision -> Translation -> Normal`
- AND this is the same state changed by Caps Lock
- GIVEN the Debug Console is visible
- WHEN the player presses `Normal`, `Precision`, or `Translation`
- THEN that exact `FlightControlMode` becomes active

#### Scenario: Left Alt is not the primary mode switch

- GIVEN the player is controlling the ship
- WHEN Left Alt is pressed or released
- THEN it does not act as the primary flight-control mode switch
- AND no required control-mode behavior depends on holding Left Alt

### Requirement: Precision and Translation modes disable surprising main-thrust behavior

Precision and Translation modes SHALL force main-thruster and gimbal commands off while preserving manual RCS, SAS, attitude, and translation control.

#### Scenario: Main throttle cannot increase in Precision or Translation

- GIVEN Precision or Translation mode is active
- WHEN the player holds Left Shift or Left Ctrl
- THEN the persistent main throttle does not increase or decrease
- AND the main-thruster command remains 0
- AND main engine VFX remains off when no main thrust is commanded

#### Scenario: Gimbal is off in Precision or Translation

- GIVEN Precision or Translation mode is active
- WHEN the player applies attitude or translation controls
- THEN gimbal yaw and pitch commands are forced to 0
- AND RCS remains the primary close-range control actuator

#### Scenario: Leaving Precision or Translation is safe

- GIVEN Precision or Translation forced the main-thruster command to 0
- WHEN the player exits to Normal mode
- THEN main throttle remains 0 unless the player or autopilot explicitly commands Cruise thrust afterward

### Requirement: Normal, Precision, and Translation modes have distinct key interpretation

The active control mode SHALL avoid overloading W/S/A/D with rotation and translation at the same time.

#### Scenario: Normal mode is cruise flight

- GIVEN Normal mode is active
- WHEN the player presses W/S/A/D/Q/E
- THEN W/S command pitch
- AND A/D command yaw
- AND Q/E command roll
- AND Left Shift / Left Ctrl adjust persistent main throttle up/down
- AND main thruster is allowed
- AND gimbal behavior follows configured safe default
- AND legacy RCS controls remain available when RCS is enabled

#### Scenario: Precision mode is RCS attitude precision

- GIVEN Precision mode is active
- WHEN the player presses W/S/A/D/Q/E
- THEN W/S command pitch through RCS attitude control
- AND A/D command yaw through RCS attitude control
- AND Q/E command roll through RCS attitude control
- AND W/S/A/D do not command linear translation
- AND main thruster and gimbal commands remain 0
- AND RCS is forced on or automatically enabled when installed

#### Scenario: Translation mode maps movement keys to linear thrust

- GIVEN Translation mode is active
- WHEN W/S is pressed
- THEN W/S commands RCS forward/backward translation and does not command pitch
- WHEN A/D is pressed
- THEN A/D commands RCS left/right translation and does not command yaw
- WHEN H/N is pressed
- THEN H/N commands RCS up/down translation
- AND Q/E may continue to command roll if the implementation keeps that conflict-free
- AND translation commands are hold-to-thrust rather than persistent toggles
- AND main thruster and gimbal commands remain 0
- AND RCS is forced on or automatically enabled when installed

#### Scenario: Legacy RCS aliases remain documented where practical

- GIVEN Normal, Precision, or Translation mode is active
- WHEN J/L or I/K remain available as legacy RCS translation axes
- THEN they are documented as secondary aliases rather than the primary mental model
- AND they do not conflict with W/S/A/D/H/N behavior in Translation mode

#### Scenario: RCS is automatically available

- GIVEN Precision or Translation mode is active and RCS is installed
- WHEN player translation or attitude input is applied
- THEN RCS is forced on or automatically enabled enough for the command to reach the allocator

### Requirement: Cruise Mode remains long-distance mode

Cruise Mode SHALL preserve main-thruster, waypoint autopilot, and existing RCS alias behavior where practical.

#### Scenario: Shift and Ctrl keep Normal throttle behavior

- GIVEN Normal mode is active
- WHEN Left Shift or Left Ctrl is held
- THEN persistent main throttle adjusts up or down as before
- AND waypoint autopilot/main-thruster burn and brake behavior remains available

#### Scenario: Normal attitude controls remain rotational

- GIVEN Normal mode is active
- WHEN the player presses W/S/A/D/Q/E
- THEN W/S/A/D/Q/E command pitch, yaw, and roll as documented
- AND they do not switch to linear translation without Translation mode being active

#### Scenario: RCS aliases remain usable in Normal mode

- GIVEN Normal mode is active
- WHEN the player presses H/N or other existing RCS translation keys
- THEN legacy RCS translation behavior remains available unless explicitly replaced by a documented conflict-free mapping

### Requirement: RCS command strength is simple by default

Keyboard RCS in Precision and Translation modes SHALL use clear full-strength hold commands by default.

#### Scenario: Full command while held

- GIVEN Translation mode is active
- WHEN a keyboard RCS translation key is held
- THEN the requested axis command is full-strength for the held duration
- AND the command returns to 0 when released
- AND no analog keyboard scaling is required by default

### Requirement: UI state has a single source of truth

HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay SHALL read SAS, RCS, control mode, autopilot, and Momentum Assist state from the same runtime source, preferably `PlayerShipController` or one read-only diagnostics snapshot.

#### Scenario: Diagnostics snapshot exposes flight-control state

- GIVEN UI needs to render flight-control state
- WHEN state is requested
- THEN a read-only `PrototypeFlightControlDiagnostics` struct or equivalent method exposes `rcsEnabled`, `sasEnabled`, `effectiveSasEnabled`, `controlMode`, `mainThrottle`, `mainThrusterAllowed`, `gimbalAllowed`, `autopilotState`, and `momentumAssistState`
- AND UI components do not keep stale local copies of these states

#### Scenario: SAS/RCS/mode display is consistent

- GIVEN HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay are visible
- WHEN SAS, RCS, or control mode changes
- THEN all visible UI surfaces show identical state values

### Requirement: Gimbal assist is calmer and mode-gated

Default gimbal behavior SHALL stop making raw manual WASD input feel over-amplified while retaining experimental modes for diagnostics.

#### Scenario: Gimbal assist mode exists

- GIVEN the controller or main thruster exposes gimbal behavior
- WHEN gimbal settings are inspected
- THEN `GimbalAssistMode` supports Off, Low, Manual, AutopilotOnly, and ExperimentalFull or equivalent documented values
- AND the default is AutopilotOnly or Low

#### Scenario: Default gimbal parameters are safer

- GIVEN default prototype values are loaded
- WHEN gimbal parameters are inspected
- THEN gimbal limit is in the 8 to 12 degree range unless a documented reason chooses otherwise
- AND response scalar is in the 0.10 to 0.18 range unless a documented reason chooses otherwise
- AND slew rate is in the 20 to 45 degrees-per-second range unless a documented reason chooses otherwise

#### Scenario: Debug console can tune gimbal behavior

- GIVEN the debug console is visible
- WHEN Control Calibration or related tuning controls are shown
- THEN the user can inspect or change gimbal mode/strength without rebuilding the project
- AND ExperimentalFull remains available for prototype testing but is not the normal default

### Requirement: Control calibration diagnostics

The debug console SHALL expose a Control Calibration section for key interpretation verification.

#### Scenario: Calibration diagnostics show active interpretation

- GIVEN the debug console is visible
- WHEN Control Calibration is expanded
- THEN it shows the current control mode
- AND in Normal or Precision mode it shows rotation labels: W nose down, S nose up, A yaw left, D yaw right, Q roll left, E roll right
- AND in Translation mode it shows translation labels: W forward, S backward, A left, D right, H up, N down
- AND it shows whether the current keypress is interpreted as Rotation or Translation
- AND it shows current attitude command and actual local angular velocity

#### Scenario: Prototype inversion toggles exist

- GIVEN Control Calibration is visible
- WHEN inversion controls are shown
- THEN prototype toggles exist for invert keyboard pitch, invert keyboard yaw, invert keyboard roll, and invert gamepad pitch
- AND these toggles are diagnostics/prototype controls rather than a final settings UI

### Requirement: Documentation matches controls

README and relevant flight-model docs SHALL document the new default controls and mode rules.

#### Scenario: README reflects explicit control modes

- GIVEN implementation is complete
- WHEN README is reviewed
- THEN it documents Normal, Precision, and Translation modes, Caps Lock mode cycling, HUD/Debug Console mode controls, Shift/Ctrl as Normal-mode throttle controls, gimbal defaults, and control calibration expectations

## Acceptance

- Caps Lock cycles Normal, Precision, Translation, and back to Normal.
- HUD/Navball quick action cycles the same mode.
- Debug Console has explicit Normal, Precision, and Translation buttons.
- No required behavior depends on Left Alt.
- HUD/Navball, Flight Diagnostics, Debug Console, and Keybind Overlay show identical SAS/RCS/control mode state.
- In Normal mode, W/S/A/D/Q/E rotate as documented and Shift/Ctrl adjust main throttle.
- In Precision mode, W/S/A/D/Q/E rotate as documented through RCS while main thruster and gimbal remain off.
- In Translation mode, W/S/A/D move the ship linearly and do not rotate it.
- In Translation mode, H/N moves up/down.
- Shift/Ctrl do not change main throttle in Precision or Translation.
- Main thruster and gimbal stay off in Precision and Translation.
- Six-degree manual RCS/attitude control is available across Precision and Translation where conflict-free.
- Normal mode remains useful for long-distance flight and autopilot.
- Default control feel is less jumpy.
- Keybind overlay, HUD/debug UI, and Control Calibration show the active mode and key command routing.
