# Capability: Exact Point Autopilot Arrival

## Requirement: Strict Point Completion
Player waypoint navigation must not enter `Complete` unless all exact point-arrival conditions are satisfied:

- target distance is within the configured precise point-arrival tolerance, with Proving Ground direct scenarios at or below `0.75m`;
- relative target speed is at or below `0.15m/s` for direct scenarios;
- final angular speed is at or below `0.15rad/s` for direct scenarios;
- obstacle and low-authority scenarios may use their explicit harness thresholds, but must not use the legacy loose arrival radius as the sole completion gate.

### Scenarios
- Direct short, medium, and long no-obstacle routes finish at the requested exact point and do not pass because of a loose hold radius.
- The no-RCS negative scenario does not false-complete when precise arrival cannot be physically controlled.

## Requirement: Terminal Point Capture Ownership
Once the ship enters the precise terminal envelope or final brake ownership begins near the target, the autopilot must enter an explicit terminal point-capture control path. That path must keep ownership until either exact point arrival confirms `Complete`, or the autopilot reports an explicit limited/no-authority state.

### Scenarios
- A ship that enters within `2m` of the target with overshoot velocity remains captured and does not escape to long range.
- Terminal point capture uses RCS position and velocity damping through existing ship-controller/RCS force paths, not direct rigidbody velocity writes.
- Terminal capture does not silently fall back to loose `HoldPosition` while target error remains outside the strict arrival threshold.

## Requirement: Post-Brake Transition Discipline
For non-emergency local waypoint routes, after final brake ownership begins the autopilot must not nominally transition into `Accelerate` or request positive prograde main throttle as reacquire behavior.

### Scenarios
- Direct, lateral, off-axis, overshoot, low-RCS, and obstacle Proving Ground scenarios report zero post-brake Accelerate transitions unless a scenario explicitly permits emergency recovery.
- Emergency recovery, if introduced later, is reported distinctly and is not hidden as nominal acceleration.

## Requirement: Reacquire Profile Classification
`Reacquire` planner profile must only be emitted after actual avoidance/route-loss conditions or an explicit terminal recovery condition. Lateral velocity and off-axis rotation without obstacles must remain in allowed direct/terminal profiles.

### Scenarios
- No-obstacle lateral and off-axis scenarios do not accumulate disallowed Reacquire or avoidance profile samples.
- Obstacle corridor routes still use avoidance and reacquire where the obstacle route genuinely requires it.

## Requirement: Obstacle Corridor Clearance
Obstacle corridor execution must preserve avoidance while maintaining the harness minimum obstacle clearance and reacquiring the direct path after avoidance.

### Scenarios
- The obstacle corridor scenario has minimum obstacle clearance at least `0m` and preferably above `0.25m`.
- After avoidance, the ship reacquires the target route and completes exact arrival within the scenario thresholds.

## Requirement: Low RCS Authority Outcome
Low translation-RCS terminal correction must either complete within exact arrival thresholds or explicitly report `LimitedRcsAuthority` without false Complete or excessive replan spam.

### Scenarios
- Low-RCS terminal correction does not complete at roughly `11.5m` target error.
- Low-RCS correction does not repeatedly trigger safety replans while no obstacle route change is needed.
