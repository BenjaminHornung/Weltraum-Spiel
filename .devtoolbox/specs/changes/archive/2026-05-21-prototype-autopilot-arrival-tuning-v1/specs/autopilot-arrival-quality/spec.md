# Capability: Autopilot Arrival Quality

## Requirements

### Requirement: Arrival requires distance, relative speed, and lateral tolerance

The waypoint autopilot SHALL only report successful arrival when the ship is inside the arrival radius, full target-relative speed is at or below the arrival-speed tolerance, and lateral speed is at or below the lateral-speed tolerance.

#### Scenario: Complete only when all arrival tolerances pass

- GIVEN autopilot is approaching a selected waypoint
- WHEN distance is within the configured arrival radius
- AND full relative speed is within the configured arrival speed
- AND lateral speed is within tolerance
- THEN the autopilot may enter `Hold` and complete arrival

#### Scenario: Near but drifting past target

- GIVEN the ship is inside the arrival radius
- AND lateral speed is above tolerance
- WHEN the autopilot evaluates arrival
- THEN it SHALL NOT report complete
- AND it SHALL request lateral correction or report reduced final-approach capability

#### Scenario: Near but too fast

- GIVEN the ship is inside the arrival radius
- AND full relative speed is above tolerance
- WHEN the autopilot evaluates arrival
- THEN it SHALL NOT report complete
- AND it SHALL brake, correct, or expose a failure reason instead of faking success

### Requirement: Explicit arrival phases

The waypoint autopilot SHALL expose explicit arrival phases for diagnostics and tests: `LongRangeBurn`, `Brake`, `LateralCorrection`, `FinalApproach`, and `Hold`.

#### Scenario: Long range burn phase

- GIVEN the target is far enough away
- AND stopping distance plus safety margin is below remaining distance
- WHEN authority and fuel are available
- THEN the phase is `LongRangeBurn`
- AND requested throttle may be above final-approach throttle limits

#### Scenario: Brake phase

- GIVEN current closing speed would overshoot the target
- OR the ship starts too close and too fast
- WHEN the autopilot evaluates the maneuver
- THEN the phase is `Brake`
- AND the desired burn direction opposes target-relative velocity or closing velocity

#### Scenario: Lateral correction phase

- GIVEN lateral speed exceeds tolerance
- WHEN RCS translation authority is available
- THEN the phase can be `LateralCorrection`
- AND the requested RCS translation opposes lateral velocity

#### Scenario: Final approach phase

- GIVEN the ship is near the target and not yet arrived
- WHEN precise correction is needed
- THEN the phase is `FinalApproach`
- AND the autopilot prefers RCS translation and low main throttle

#### Scenario: Hold phase

- GIVEN arrival tolerances are satisfied or nearly satisfied
- WHEN the autopilot damps remaining drift
- THEN the phase is `Hold`
- AND the autopilot SHALL NOT command a high-throttle burn through the target

### Requirement: Final approach prefers RCS and low throttle

The final approach SHALL use RCS translation for precise correction when available and SHALL limit main-throttle requests to low values.

#### Scenario: RCS final approach

- GIVEN RCS is installed and enabled
- AND lateral or relative-speed correction is needed near the waypoint
- WHEN the autopilot is in final approach
- THEN it requests RCS translation through `FlightAssistRequest`
- AND requested main throttle remains at or below the configured final-approach throttle

#### Scenario: Missing RCS reduced capability

- GIVEN RCS is unavailable or disabled
- WHEN final approach requires lateral correction
- THEN the autopilot does not invent direct correction force
- AND it reports reduced final-approach capability
- AND coarse main burn/brake may continue when main-thrust authority exists

### Requirement: Autopilot does not fight active Momentum Assist

The waypoint autopilot SHALL maintain explicit ownership relative to Momentum Assist and SHALL NOT keep competing actuator requests active.

#### Scenario: Engage while Momentum Assist active

- GIVEN Momentum Assist is active
- WHEN waypoint autopilot is engaged
- THEN the autopilot either aborts Momentum Assist before taking ownership or refuses engagement with a visible reason
- AND both systems SHALL NOT send conflicting active requests in the same physics step

#### Scenario: Momentum Assist activates while autopilot active

- GIVEN waypoint autopilot is active
- WHEN Momentum Assist takes ownership
- THEN waypoint autopilot clears its request and reports an abort or ownership-loss reason

### Requirement: Fuel and authority failures are explicit

The autopilot SHALL report why it cannot safely continue rather than silently completing or idling.

#### Scenario: Fuel insufficient

- GIVEN fuel is insufficient for safe burn, brake, and final approach
- WHEN autopilot evaluates the route
- THEN it enters or reports `FuelInsufficient`
- AND requested throttle and RCS translation are cleared or limited to physically available authority

#### Scenario: No authority

- GIVEN neither main thrust nor RCS can affect the needed correction
- WHEN autopilot evaluates the maneuver
- THEN it reports `NoAuthority` or an equivalent stable reason
- AND it does not report successful arrival
