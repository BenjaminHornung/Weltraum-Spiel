# Capability: Exact Point Autopilot Arrival

## MODIFIED Requirements

### Requirement: Strict Point Completion
Player waypoint navigation MUST NOT enter `Complete` unless all exact point-arrival conditions are satisfied: target distance is within the configured precise point-arrival tolerance, relative target speed is within the exact arrival speed limit, and angular speed is within the exact arrival angular-speed limit. Proving Ground direct scenarios MUST require `pointArrivalToleranceMeters <= 0.75m`, `pointArrivalSpeedMetersPerSecond <= 0.15m/s`, and final angular speed `<= 0.15rad/s`. Completion MUST NOT use the legacy loose arrival radius as the sole completion gate.

#### Scenario: Direct routes complete only at the exact point
- **WHEN** the direct short, medium, and long no-obstacle Proving Ground routes run
- **THEN** each route completes inside the strict exact-point distance, speed, and angular-speed gates
- **AND** none of those routes pass because of the legacy loose hold radius.

#### Scenario: No-RCS negative route does not false-complete
- **WHEN** the no-RCS negative Proving Ground route runs without translation authority
- **THEN** the route does not enter `Complete` outside the strict exact-point envelope.

### Requirement: Terminal Point Capture Ownership
Once the ship enters the precise terminal envelope or final brake ownership begins near the target, the autopilot MUST use an explicit terminal point-capture control path. That path MUST keep ownership until exact point arrival confirms `Complete`, or until the autopilot reports an explicit limited/no-authority state. Terminal point capture MUST use existing ship-controller and RCS force paths and MUST NOT directly write rigidbody velocity for arrival correction.

#### Scenario: Overshoot remains captured
- **WHEN** a route enters within `2m` of the target with overshoot velocity
- **THEN** terminal capture keeps control until exact arrival or an explicit authority failure
- **AND** the route does not escape to long range or silently settle into loose `HoldPosition`.

#### Scenario: Terminal control uses physical RCS force routing
- **WHEN** terminal point capture applies position and velocity correction
- **THEN** correction is routed through existing RCS request paths
- **AND** arrival is not achieved by direct rigidbody velocity assignment.

### Requirement: Post-Brake Transition Discipline
For non-emergency local waypoint routes, after final brake ownership begins the autopilot MUST NOT nominally transition into `Accelerate` or request positive prograde main throttle as reacquire behavior. Emergency recovery, if introduced later, MUST be classified distinctly and MUST NOT be hidden as nominal acceleration.

#### Scenario: Nominal routes have no post-brake accelerate flapping
- **WHEN** direct, lateral, off-axis, overshoot, low-RCS, and obstacle Proving Ground scenarios run
- **THEN** they report zero post-brake `Accelerate` transitions unless a scenario explicitly permits emergency recovery.

### Requirement: Reacquire Profile Classification
`Reacquire` planner profile reporting MUST only occur after actual avoidance or route-loss conditions, or after an explicit terminal recovery condition. No-obstacle lateral velocity and off-axis rotation scenarios MUST remain in allowed direct or terminal profiles.

#### Scenario: No-obstacle lateral and off-axis routes do not report false Reacquire
- **WHEN** lateral velocity and off-axis rotation Proving Ground scenarios run without obstacles
- **THEN** they do not accumulate disallowed `Reacquire` or avoidance profile samples.

#### Scenario: Obstacle corridor still reports real avoidance and reacquire
- **WHEN** the obstacle corridor route runs through an actual obstacle corridor
- **THEN** avoidance and reacquire profile samples remain available where the route genuinely requires them.

### Requirement: Obstacle Corridor Clearance
Obstacle corridor execution MUST preserve avoidance while maintaining the harness minimum obstacle clearance and reacquiring the direct path after avoidance.

#### Scenario: Corridor maintains clearance and exact-arrives
- **WHEN** the obstacle corridor Proving Ground scenario runs
- **THEN** minimum obstacle clearance is at least `0m`
- **AND** the route reacquires the target path after avoidance
- **AND** it completes exact arrival within scenario thresholds.

### Requirement: Low RCS Authority Outcome
Low translation-RCS terminal correction MUST either complete within exact arrival thresholds or explicitly report `LimitedRcsAuthority` or `NoRcsAuthority` without false `Complete` or excessive safety replan spam.

#### Scenario: Low-RCS correction does not false-complete
- **WHEN** the low-RCS terminal correction Proving Ground scenario runs
- **THEN** it does not complete at roughly `11.5m` target error
- **AND** it either exact-arrives or reports an explicit authority-limited state.

#### Scenario: Low-RCS correction does not replan repeatedly without route change
- **WHEN** low-RCS terminal correction is near the target and no obstacle route change is needed
- **THEN** terminal correction ownership prevents repeated safety replans.
