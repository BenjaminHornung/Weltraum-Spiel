# Capability: Physical Momentum Assist

## Requirements

### Requirement: Kill Momentum is a physical assist

The prototype SHALL add a Kill Momentum assist that reduces ship linear and angular motion by commanding existing physical actuators instead of directly resetting Rigidbody state.

#### Scenario: Direct velocity zeroing is forbidden

- GIVEN Kill Momentum is active
- WHEN the assist reduces motion
- THEN it does not assign `Rigidbody.linearVelocity = Vector3.zero`
- AND it does not assign `Rigidbody.angularVelocity = Vector3.zero`
- AND it does not teleport the transform or call reset helpers to achieve braking
- AND existing explicit debug reset buttons may remain separate from Kill Momentum

#### Scenario: Physical force routes are used

- GIVEN Kill Momentum needs to damp motion
- WHEN main, RCS, SAS, or assist authority is available
- THEN commands route through existing RCS allocator, SAS/RCS torque path, main-thruster/autopilot control request path, or a physical `FlightAssistRequest` path
- AND Unity physics integrates the resulting force or torque

### Requirement: Momentum assist state is visible

The assist SHALL expose clear state for UI, tests, and diagnostics.

#### Scenario: Required states exist

- GIVEN Momentum Assist is implemented
- WHEN state is inspected
- THEN it exposes Idle, AlignForBrake, MainBrake, RcsDamp, Complete, Aborted, FuelInsufficient, and NoAuthority or equivalent documented states

#### Scenario: Status is shown near HUD controls

- GIVEN the HUD/Navball quick action row is visible
- WHEN Kill Momentum is idle or active
- THEN the button or nearby status shows Idle, Braking, RCS Damp, Complete, No Fuel, No RCS, or an equivalent concise state

### Requirement: Kill Momentum UI action

The HUD SHALL expose a Kill Momentum button near or under the navball.

#### Scenario: Button toggles assist

- GIVEN the HUD/Navball quick actions are visible
- WHEN the user presses Kill Momentum
- THEN Momentum Assist starts if idle and authority is available
- AND pressing it again aborts or toggles off according to the documented behavior
- AND the status changes are visible in HUD or diagnostics

#### Scenario: Missing assist is created and bound

- GIVEN a prototype ship is spawned by `PrototypeBootstrap`
- WHEN HUD/Navball, Debug Console, PlayerShipController, or diagnostics need Momentum Assist state
- THEN a `PrototypeMomentumAssist` or equivalent component exists and is bound next to the ship controller, waypoint autopilot, HUD, and Debug Console

#### Scenario: Complete can re-engage after movement resumes

- GIVEN Momentum Assist reached Complete
- AND ship linear or angular motion becomes non-zero again
- WHEN the player presses Kill Momentum
- THEN Momentum Assist engages again instead of remaining inert

### Requirement: High-speed braking uses main engine when appropriate

Momentum Assist SHALL use main-engine braking when speed is high and main thrust is allowed.

#### Scenario: Align and brake with main thrust

- GIVEN the ship has high speed and main thrust is allowed with sufficient fuel
- WHEN Kill Momentum is active
- THEN the assist computes a braking direction opposite velocity
- AND it requests brake orientation before or during main thrust
- AND it requests main throttle through the normal main-thruster control path
- AND it switches out of main braking in time to avoid intentional overshoot where practical

### Requirement: Low-speed or RCS-mode damping uses RCS

Momentum Assist SHALL use RCS-only damping when Precision or Translation mode is active, when speed is low, or when main thrust is unavailable.

#### Scenario: RCS damps linear velocity

- GIVEN RCS is installed and has authority
- WHEN Kill Momentum runs in RCS damping
- THEN it requests RCS desired force opposite current velocity
- AND lateral/linear residual velocity decreases through allocator output rather than direct velocity assignment

#### Scenario: SAS or RCS damps angular velocity

- GIVEN SAS or RCS torque authority is available
- WHEN angular velocity is non-zero
- THEN the assist requests damping torque through the existing SAS/RCS path

### Requirement: Failure states are honest

Momentum Assist SHALL report failure or degraded states instead of faking success.

#### Scenario: Fuel insufficient

- GIVEN main-engine braking is needed and available fuel is insufficient
- WHEN Kill Momentum evaluates the maneuver
- THEN it enters FuelInsufficient or equivalent state
- AND it stops commanding unavailable main thrust
- AND it does not zero velocity directly

#### Scenario: No authority

- GIVEN RCS is unavailable and main braking is disabled or unavailable
- WHEN Kill Momentum is requested
- THEN it enters NoAuthority or equivalent state
- AND diagnostics explain that no physical braking authority is available

### Requirement: Integration with Precision and Translation modes

Kill Momentum SHALL support the intended cruise-to-close-control flow.

#### Scenario: Typical flow is supported

- GIVEN the player has flown with Cruise/Main-Thruster mode
- WHEN Kill Momentum completes physical braking
- THEN the ship is near 0 m/s within configured tolerance
- AND the player can switch to Precision or Translation mode for fine control
- AND the assist does not automatically switch modes unless that behavior is clearly documented

### Requirement: Debug Console exposes Momentum Assist diagnostics

The Debug Console SHALL include a Momentum Assist section with actionable controls and status.

#### Scenario: Engage abort and status are visible

- GIVEN the Debug Console is visible
- WHEN the Momentum Assist section is shown
- THEN it has Engage/Abort controls
- AND it shows state, speed, angular speed, brake direction, RCS desired force, main throttle request, and NoAuthority/FuelInsufficient reason when applicable

### Requirement: Control request ownership is explicit

Autopilot and Momentum Assist SHALL avoid hidden command conflicts.

#### Scenario: Assist command source is inspectable

- GIVEN Momentum Assist or Autopilot owns a control request
- WHEN diagnostics or tests inspect command source
- THEN the source can be identified as Manual, Autopilot, MomentumAssist, Debug, or equivalent
- AND priority/ownership prevents lower-priority commands from unexpectedly overriding manual input

#### Scenario: Manual input can abort assist

- GIVEN Momentum Assist is active
- WHEN the player applies manual flight input
- THEN the assist aborts or yields according to the documented priority rule
- AND status reports the manual override

### Requirement: Tests prevent reset-style implementation

Verification SHALL include tests or code inspection probes for physical-only behavior.

#### Scenario: Kill Momentum path avoids direct velocity assignment

- GIVEN the implementation is complete
- WHEN tests or a code inspection probe analyze the Kill Momentum path
- THEN direct linear/angular velocity assignment is absent except in explicit debug reset methods

#### Scenario: Assist requests expected physical commands

- GIVEN RCS is available and ship velocity is non-zero
- WHEN the assist updates
- THEN it creates a non-zero RCS desired force opposite velocity

#### Scenario: Main braking request exists at high speed

- GIVEN main thrust is allowed, fuel is available, and speed is high
- WHEN the assist updates
- THEN it requests brake orientation or main throttle rather than teleporting or directly setting velocity

## Acceptance

- Kill Momentum button is visible near or under the navball.
- Kill Momentum never stops by direct velocity set.
- Kill Momentum uses RCS, main thrust, SAS, or physical assist paths.
- Successful braking leaves the ship near 0 m/s.
- Precision or Translation mode can be used afterward for fine control.
- No-fuel and no-authority states are visible and honest.
