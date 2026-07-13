# Direct Fast Transfer Specification

## Capability

Direct free local waypoint routes use an analytical bang-bang FlightPlan and execute it without arbitrary Coast or soft-throttle pulsing.

## Requirements

### Requirement: DirectFastTransfer profile selection

The planner shall select DirectFastTransfer for normal local waypoint routes only when all of these are true:

- the route is free of blocking obstacle constraints,
- main thrust authority is available,
- the target is outside the near-target envelope,
- no docking, obstacle, wait/intercept, timewarp, or special route mode owns the route.

The planner shall use existing heuristic, obstacle, docking, final-only, or limited-authority behavior when those conditions are not satisfied.

### Requirement: Analytical bang-bang solution

The planner shall compute a DirectFastTransfer solution from ship center of mass, current world velocity, arrival point, arrival radius, arrival speed, main-thrust acceleration, flip time, and safety margin.

The solution shall calculate route direction, along-track velocity, lateral velocity, effective distance, peak speed, burn duration/distance, flip duration/drift, and brake duration/distance using the analytical switch equation:

`vPeakSquared = (2 * aBurn * aBrake * D + aBrake * v0 * v0) / (aBurn + aBrake)`

If the current speed toward the target is already too high for the remaining distance, the solution shall start brake immediately after alignment/flip. If the target is very near, the solution shall avoid a full-main pulse and use final hold or a short safe brake fallback.

### Requirement: Segment sequence

A DirectFastTransfer FlightPlan shall contain this logical sequence:

- AlignForBurn
- FullMainBurn or equivalent full-throttle prograde segment
- FlipToRetrograde
- FullMainBrake or equivalent full-throttle retrograde segment
- RcsFinalHold or equivalent hold segment

The FlightPlan shall not include a Coast segment in a direct free route unless a real speed cap, obstacle, wait/intercept, timewarp, or explicit safety constraint requires it.

### Requirement: Predicted samples match executable segments

Predicted samples shall include the analytical switch point and shall map to the same segment indices/phases that the executor uses.

The last brake sample shall be near the planned arrival point, measured from ship center of mass to `arrivalPointWorld`.

### Requirement: Full-throttle burn and brake authority

During DirectFastTransfer full burn and full brake windows, the executor/tracker shall command main throttle near 1.0 while the relevant alignment guard is satisfied.

RCS correction may correct cross-track error and velocity but shall not reduce main throttle merely because the PD position/velocity error is small.

Direction guards and tracking divergence replanning shall remain active.

### Requirement: Direct terminal brake commitment

In DirectFastTransfer terminal behavior, once full brake is committed, the autopilot shall not return to prograde acceleration in the terminal window.

Full main brake shall remain authoritative until relative speed is within the brake-end envelope, subject to alignment and emergency safety gates. After that, main throttle shall be zero and RCS-only final hold shall stabilize position and velocity until the hold confirmation duration is satisfied.

Existing terminal redirect, lateral correction, terminal velocity brake, and hold-commit helper functions shall be fallback behavior for DirectFastTransfer, not primary routing decisions that preempt planned full brake.

### Requirement: Arrival point consistency

Planner, executor, debug data, and tests shall use one arrival point definition for direct waypoints: center of mass to `arrivalPointWorld`, with `arrivalPointWorld` equal to `currentTarget.Position` unless a future docking/approach offset is explicitly supplied.

Debug/evidence shall make COM position, target position, planned stop point, and final stop error inspectable.

### Requirement: Limited authority fallback

If main thrust is unavailable, DirectFastTransfer shall not be selected. If RCS is unavailable, main bang-bang may still execute, but final precision shall be reported or handled as limited.

## Scenarios

### Scenario: Stationary target ahead

Given a free waypoint ahead and zero initial velocity, when the planner builds a route, then the plan contains full burn, flip, full brake, and RCS hold with no arbitrary Coast segment.

### Scenario: High initial velocity toward target

Given a free waypoint ahead and high initial velocity toward it, when the planner builds a route, then it starts brake immediately or much earlier and does not add a prograde full-burn pulse.

### Scenario: Initial velocity away from target

Given a free waypoint ahead and initial velocity away from it, when the planner builds a route, then the full burn window is longer before switching to brake.

### Scenario: Near target

Given a target inside or just outside the near-target envelope, when the planner builds a route, then it avoids full-main pulsing and uses RCS final hold or a safe short brake path.

### Scenario: Obstacle route

Given a blocking obstacle in the path, when the planner builds a route, then DirectFastTransfer is not selected and existing obstacle route behavior remains in control.

### Scenario: Overshoot

Given a ship that has overshot or is too fast near the arrival point, when DirectFastTransfer terminal brake commits, then the autopilot does not return to prograde acceleration before final hold.
