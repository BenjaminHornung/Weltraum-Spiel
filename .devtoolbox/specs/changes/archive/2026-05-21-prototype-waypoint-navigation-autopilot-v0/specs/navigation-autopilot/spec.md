# Capability: Navigation Autopilot

## Requirements

### Requirement: Visible waypoint targets

The prototype SHALL expose navigation targets as visible scene objects with a target component such as `PrototypeNavigationTarget`.

#### Scenario: Default waypoint generation

- GIVEN the generated prototype scene starts without configured navigation targets
- WHEN `PrototypeWaypointManager` initializes
- THEN at least three visible primitive waypoint objects are created
- AND each created waypoint has a stable display name
- AND each created waypoint can be selected as a navigation target

### Requirement: Target selection controls

The prototype SHALL allow the player to select the next and previous navigation target without opening a map UI.

#### Scenario: Cycle selected target

- GIVEN at least three waypoint targets exist
- WHEN the player presses the next-target control
- THEN the selected target advances to the next waypoint
- AND the debug overlay reports the selected target name

#### Scenario: Previous target selection

- GIVEN at least three waypoint targets exist
- WHEN the player presses the previous-target control
- THEN the selected target moves to the previous waypoint when practical

### Requirement: Autopilot state machine

`PrototypeWaypointAutopilot` SHALL expose the following states exactly for diagnostics and tests: `Idle`, `TargetSelected`, `FuelCheck`, `AlignForBurn`, `Accelerate`, `FlipForBrake`, `Brake`, `FinalApproach`, `HoldPosition`, `Complete`, `Aborted`, `FuelInsufficient`, `Failed`.

#### Scenario: Toggle autopilot with selected target

- GIVEN a waypoint target is selected
- WHEN autopilot is toggled on
- THEN the autopilot transitions through `FuelCheck` before commanding maneuver thrust

#### Scenario: Manual abort

- GIVEN autopilot is actively commanding a maneuver
- WHEN the player applies manual throttle, attitude, or an explicit abort control
- THEN the autopilot enters `Aborted`
- AND autopilot-owned main-thrust and RCS requests are cleared

### Requirement: Physics-only maneuver control

The autopilot SHALL maneuver through existing physical flight systems and SHALL NOT teleport the ship or directly set runtime Rigidbody position, rotation, linear velocity, or angular velocity to achieve navigation.

#### Scenario: Main thrust uses existing fuel and force path

- GIVEN the autopilot is accelerating or braking
- WHEN main thrust is required
- THEN the command is routed through the existing `PlayerShipController` and main-thruster path
- AND main thrust consumes fuel through `ShipStats`
- AND force is applied through `ShipPhysicsCore`

#### Scenario: Runtime movement avoids direct state writes

- GIVEN the autopilot is active outside test or reset setup
- WHEN it updates controls
- THEN it does not assign `Rigidbody.position`, `Rigidbody.rotation`, `Rigidbody.linearVelocity`, `Rigidbody.angularVelocity`, or call `Transform.SetPositionAndRotation`

### Requirement: Continuous stopping-distance decision

The autopilot SHALL continuously recompute stopping distance from current target-relative velocity and conservative available deceleration.

#### Scenario: Stopping distance formula

- GIVEN a selected target and a ship velocity
- WHEN the autopilot evaluates the maneuver
- THEN it computes `closingSpeed = dot(shipVelocity, directionToTarget)`
- AND it computes `stoppingDistance = closingSpeed^2 / (2 * maxDeceleration)` when closing speed and max deceleration are positive
- AND it switches from acceleration toward braking when `stoppingDistance + safetyMargin >= remainingDistance`

#### Scenario: Forward initial velocity affects braking

- GIVEN the ship starts with non-zero velocity toward the target
- WHEN the autopilot evaluates stopping distance
- THEN the braking decision occurs earlier than it would from rest at the same distance

#### Scenario: Moving away from target

- GIVEN the ship velocity points away from the target
- WHEN the autopilot evaluates stopping distance
- THEN negative closing speed does not produce a negative stopping distance
- AND the autopilot prioritizes recovery, alignment, or acceleration instead of braking on invalid math

### Requirement: Lateral velocity awareness

The autopilot SHALL measure and report lateral target-relative velocity and attempt lateral correction when RCS is available.

#### Scenario: Lateral velocity diagnostics

- GIVEN the ship has velocity perpendicular to the selected target direction
- WHEN the autopilot updates
- THEN lateral speed is reported separately from closing speed
- AND the debug overlay shows lateral speed

#### Scenario: RCS-assisted correction

- GIVEN RCS is installed and enabled
- WHEN lateral correction is needed during final approach or hold
- THEN the autopilot requests lateral correction through the existing RCS/SAS/flight-assist path

#### Scenario: Missing RCS degradation

- GIVEN RCS is unavailable or disabled
- WHEN lateral correction is needed
- THEN the autopilot does not invent non-physical correction force
- AND diagnostics report reduced final-approach capability or failure risk

### Requirement: Conservative fuel feasibility

The autopilot SHALL estimate whether the maneuver is feasible with current fuel before committing and during flight.

#### Scenario: Preflight fuel estimate

- GIVEN a selected target and a fuel-consuming main thruster
- WHEN autopilot is toggled on
- THEN it estimates available burn seconds from `ShipStats.CurrentFuelKg / ShipStats.FuelConsumptionKgPerSecond`
- AND it estimates required burn time for acceleration, braking, and a final-approach reserve
- AND it enters `FuelInsufficient` if fuel is unlikely to be enough

#### Scenario: Zero fuel consumption remains valid

- GIVEN `ShipStats.FuelConsumptionKgPerSecond` is zero
- WHEN fuel feasibility is evaluated
- THEN the autopilot treats main thrust as fuel-free rather than automatically insufficient

#### Scenario: Fuel loss during maneuver

- GIVEN autopilot is active
- WHEN fuel becomes insufficient or fuel-consuming thrust can no longer be applied
- THEN the autopilot stops commanding main thrust
- AND it exposes `FuelInsufficient` or `Failed` with diagnostics

### Requirement: Arrival criteria

The autopilot SHALL only report arrival when both distance and relative velocity tolerances are satisfied.

#### Scenario: Complete arrival

- GIVEN the ship is near the selected target
- WHEN distance is within the configured arrival radius and relative speed is below the configured velocity tolerance
- THEN the autopilot may enter `HoldPosition` and `Complete`

#### Scenario: Near but too fast

- GIVEN the ship is within the distance tolerance but still moving faster than the velocity tolerance
- WHEN the autopilot evaluates arrival
- THEN it does not report `Complete`
- AND it continues braking or final approach when feasible

### Requirement: Debug overlay telemetry

The debug overlay SHALL include selected target name, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status.

#### Scenario: Overlay reports active target

- GIVEN a target is selected
- WHEN the overlay is visible
- THEN it shows the selected target name and target-relative metrics

### Requirement: Documentation and verification evidence

The change SHALL update README controls and known limits and SHALL store verification evidence under the active change.

#### Scenario: README documents controls and limits

- GIVEN implementation is complete
- WHEN README is reviewed
- THEN it documents target selection, autopilot toggle, manual override, fuel behavior, no map UI on `M`, no gravity/slingshot planning, and the physics-only movement constraint

#### Scenario: Test protocol exists

- GIVEN verification has run
- WHEN the change is reviewed
- THEN `.devtoolbox/specs/changes/prototype-waypoint-navigation-autopilot-v0/tests/test-protocol.md` records `specs_validate`, Unity MCP script validation, Unity refresh/compile, and EditMode test results
