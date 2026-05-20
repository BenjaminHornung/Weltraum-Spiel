# Capability: Navigation Computer Obstacle Trajectory

## Requirements

### Requirement: Detect Direct-Path Obstacles
The Navigation Computer must detect obstacles that intersect the planned corridor from ship to target.

#### Scenario: Collider obstacle blocks direct path
- GIVEN a ship with a current target and an obstacle collider on the direct route
- WHEN obstacle detection runs for the current trajectory
- THEN the result reports an obstacle
- AND the result includes a hit distance, clearance radius, obstacle label, and avoidance direction.

#### Scenario: Obstacle component without collider blocks direct path
- GIVEN a `PrototypeNavigationObstacle` without a collider near the direct route
- WHEN fallback geometric detection runs
- THEN the obstacle is still detected if its effective clearance radius overlaps the corridor.

#### Scenario: Own colliders are ignored
- GIVEN the ship has child colliders
- WHEN obstacle detection runs from the ship center
- THEN the detector ignores the ship and child colliders.

### Requirement: Plan Avoidance Trajectory
The planner must produce an avoidance plan when the direct path is blocked.

#### Scenario: Direct path blocked
- GIVEN an obstacle detection result for the direct route
- WHEN the trajectory planner evaluates the snapshot
- THEN the plan phase is `Avoidance`
- AND `avoidanceActive` is true
- AND the plan contains an avoidance waypoint outside the obstacle clearance.

#### Scenario: Main burn not into obstacle
- GIVEN an obstacle directly between the ship and target
- WHEN a plan is produced
- THEN requested main throttle is not used to accelerate directly into the blocked corridor.

### Requirement: Use Physical Propulsion Requests
The autopilot must control the ship through physical flight-assist requests.

#### Scenario: RCS force scales with mass
- GIVEN two identical trajectory states with different Rigidbody masses
- WHEN lateral correction is requested
- THEN the heavier ship requests proportionally larger force before authority clamping.

#### Scenario: Main thrust requires alignment
- GIVEN the ship is outside the allowed alignment angle from the desired burn direction
- WHEN the plan requests a main burn
- THEN the autopilot commands alignment torque/RCS only and requests zero main throttle.

#### Scenario: No direct Rigidbody motion writes
- GIVEN the runtime autopilot source file
- WHEN static validation scans the source
- THEN it finds no direct assignment to Rigidbody position, rotation, linear velocity, or angular velocity.

### Requirement: Arrive and Hold Stably
Waypoint completion must depend on the full arrival envelope and remain stable before completing.

#### Scenario: Small drift away inside envelope
- GIVEN the ship is inside arrival radius with low full relative speed
- WHEN closing speed is slightly negative
- THEN arrival is allowed.

#### Scenario: Hold dampens residual velocity
- GIVEN the ship has arrived with small residual drift
- WHEN the autopilot enters Hold
- THEN it requests RCS damping force
- AND completes only after the configured hold confirmation duration is stable.

### Requirement: Report Honest Failures
The Navigation Computer must surface propulsion failures rather than hiding them behind nonphysical motion.

#### Scenario: No authority
- GIVEN no main thrust or RCS authority is available
- WHEN a burn is required
- THEN the plan fails or reports no authority
- AND the flight-assist request commands no fake motion.

#### Scenario: Fuel insufficient
- GIVEN fuel estimate exceeds available fuel
- WHEN the planner evaluates a burn
- THEN the plan reports fuel insufficient before commanding the burn.

### Requirement: Present Navigation Diagnostics
The player-facing HUD and debug tools must expose navigation state.

#### Scenario: HUD panel
- GIVEN the HUD is visible
- WHEN autopilot diagnostics update
- THEN a compact Navigation Computer panel shows target, phase, distance, relative speed, autopilot state, obstacle state, avoidance state, ETA, and main/RCS request summary.

#### Scenario: Debug console details
- GIVEN the debug console is open
- WHEN the Navigation Computer foldout is expanded
- THEN it shows plan status, burn direction, desired acceleration, throttle, RCS force, obstacle hit, avoidance waypoint, fuel estimate, stopping distance, and arrival envelope.

#### Scenario: Minimap route
- GIVEN the minimap is visible
- WHEN an avoidance waypoint is active
- THEN it displays obstacles and the route from ship to avoidance waypoint to target.

