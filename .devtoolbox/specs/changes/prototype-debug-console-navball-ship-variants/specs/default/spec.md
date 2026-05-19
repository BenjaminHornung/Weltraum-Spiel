# Capability: Debug Console, Navball, and Ship Variants

## Requirements

### Requirement: Flight debug console

The prototype SHALL provide a runtime debug console for existing flight and debug actions.

#### Scenario: Toggle flight systems from UI

- GIVEN the prototype is running
- WHEN the user toggles RCS, SAS, precision controls, assist mode, or main thrust mode from the debug console
- THEN the same runtime state changes as the existing controller path
- AND keyboard controls remain functional.

#### Scenario: Run debug actions

- GIVEN the debug console is visible
- WHEN the user presses Refuel, Cut Throttle, Full Throttle, Reset Velocity, Reset Angular Velocity, Reset Position, or Spawn Target
- THEN the action is applied through existing controller or debug methods
- AND the result is visible in telemetry.

#### Scenario: Trigger test pulses

- GIVEN the debug console is visible
- WHEN the user triggers an RCS, attitude, main-thrust, or gimbal test pulse
- THEN the prototype applies a short deterministic request through the same physics/control path used by live controls
- AND telemetry records the requested and achieved result.

### Requirement: Runtime diagnostics toggles

The debug console SHALL expose runtime toggles for visual diagnostics.

#### Scenario: Toggle force vectors

- GIVEN force or torque vector drawing is available
- WHEN the user toggles it from the console
- THEN the vectors appear or disappear without requiring inspector changes.

#### Scenario: Toggle diagnostic groups

- GIVEN detailed telemetry is visible
- WHEN the user expands or collapses a system group
- THEN only that telemetry group changes visibility
- AND flight controls continue unaffected.

### Requirement: RCS desired actual residual diagnostics

RCS allocator telemetry SHALL distinguish requested output from physically achieved output.

#### Scenario: Limited one-sided RCS

- GIVEN a one-sided RCS ship variant
- WHEN a pure translation test pulse is requested
- THEN desired force, actual force, residual force, desired torque, actual torque, residual torque, max nozzle throttle, saturated nozzle count, and allocator status are visible.

#### Scenario: Fuel-starved RCS

- GIVEN RCS fuel availability limits the requested command
- WHEN an RCS command is applied
- THEN the allocator status indicates fuel limitation or reduced output
- AND actual force/torque differs from desired force/torque instead of being reported as the desired value.

### Requirement: Navball-light HUD

The prototype SHALL provide a simple navball-light HUD for orientation and motion.

#### Scenario: Velocity markers

- GIVEN the ship has nonzero velocity
- WHEN the navball is visible
- THEN prograde and retrograde markers are shown relative to ship orientation.

#### Scenario: SAS marker

- GIVEN SAS has a hold direction or target attitude
- WHEN the navball is visible
- THEN the SAS marker indicates the held direction or is clearly unavailable.

#### Scenario: Optional target marker

- GIVEN a target exists
- WHEN the navball is visible
- THEN the target direction marker is shown relative to ship orientation.

### Requirement: Ship variants

The prototype SHALL support selectable generated test ship variants.

#### Scenario: Spawn selected variant

- GIVEN a variant is selected in the debug console
- WHEN the user presses Spawn Selected Variant
- THEN the current prototype ship is replaced or rebuilt using the selected layout
- AND camera, controller, physics core, HUD, and debug console remain connected.

#### Scenario: Multiple main thrusters

- GIVEN the Dual Main Thruster variant is spawned
- WHEN both engines fire equally
- THEN net unintended torque remains near zero in the symmetric case
- AND disabling one engine produces visible torque.

#### Scenario: Off-center main thruster

- GIVEN the Off-Center Main Thruster variant is spawned
- WHEN COM-safe main thrust mode is active
- THEN throttle-only flight does not create unintended torque
- WHEN fully physical main thrust mode is active
- THEN throttle-only flight creates torque from the offset engine position.

#### Scenario: One-sided RCS limitation

- GIVEN the One-Sided RCS variant is spawned
- WHEN RCS translation is requested
- THEN the allocator reports residual force or torque rather than hiding the limitation.

#### Scenario: No-RCS limitation

- GIVEN the No-RCS variant is spawned
- WHEN RCS or SAS requests require RCS authority
- THEN actual RCS force/torque remains zero
- AND the UI indicates missing RCS authority.

### Requirement: Scope boundary

This change SHALL NOT implement a final ship editor, final HUD art, final navball shader, multiplayer UI, or full docking/orbit navball modes.
