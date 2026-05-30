# Design

## Decision

Add a mode split instead of further tuning the current heuristic route builder.

DirectFastTransfer owns free local waypoint routes with no blocking obstacle, available main thrust, distance outside the near-target envelope, and no docking or special route mode. Existing heuristic, obstacle, and final-only behavior remains the fallback for cases that are not safe or meaningful for direct bang-bang transfer.

## Existing Reuse

The implementation should reuse the current FlightPlan execution path:

- `PrototypeTrajectoryPlanner.BuildFlightPlan` remains the conversion point from planner segments to executable `PrototypeManeuverSegment` values and predicted samples.
- `PrototypeFlightPlanTracker` remains the route-tracking component, but DirectFastTransfer burn and brake segments become authority segments whose main throttle is commanded from segment intent, not softened by PD error.
- `PrototypeWaypointAutopilot.ApplyFlightPlanSegment` remains the executor surface, with terminal fallbacks made subordinate to DirectFastTransfer brake commitment.
- Existing final-only, brake-first, obstacle, and validation helpers stay in place.

New code is justified because the existing `BuildBurnPlan` and `BuildSegments` logic is intentionally heuristic: it clamps burn duration and inserts Coast/FinalApproach phases that conflict with fastest direct transfer.

## Flight Profile

Introduce a planner profile such as `PrototypeTrajectoryProfile.DirectFastTransfer`, alongside safe heuristic and obstacle/docking categories as needed by the existing architecture.

For DirectFastTransfer, the planned sequence is:

1. `AlignForBurn`, throttle 0.
2. `FullMainBurn` represented either by a new explicit segment type or an existing prograde segment with a full-throttle/direct-fast marker.
3. `FlipToRetrograde`, throttle 0.
4. `FullMainBrake` represented either by a new explicit segment type or an existing retrograde segment with a full-throttle/direct-fast marker.
5. `RcsFinalHold`, throttle 0.

There must be no Coast segment in this profile unless a real speed cap, obstacle, wait/intercept, timewarp, or explicit safety constraint is present.

## Analytical Solver

Add `SolveDirectFastTransfer(...)` near the planner's current burn-plan helpers. The solver computes a one-dimensional solution along the route from the ship center of mass to the arrival point.

Inputs include snapshot, ship planning data, arrival radius, arrival speed, estimated flip time, and safety margin. It computes:

- `route = normalize(arrivalPointWorld - shipCenterOfMass)`
- `distance = max(0, magnitude - arrivalRadius)`
- `vAlong0 = dot(linearVelocity, route)`
- lateral velocity and cross-track terms for RCS correction
- burn and brake acceleration from main thrust and mass
- flip drift as `vPeak * flipTimeSeconds`
- effective distance after flip drift and safety margin
- `vPeakSquared = (2 * aBurn * aBrake * D + aBrake * v0 * v0) / (aBurn + aBrake)`
- burn time/distance and brake time/distance

If the initial velocity toward the target is already too high for remaining distance, the solver emits an immediate flip/brake profile. If the target is inside the near-target envelope or main thrust is unavailable, DirectFastTransfer is not used and the route falls back to final hold or existing safe behavior.

## Tracker Contract

DirectFastTransfer burn and brake segments are authority segments:

- Full burn commands main throttle near 1.0 while the alignment guard is satisfied.
- Full brake commands main throttle near 1.0 while the retrograde guard is satisfied and relative speed is above the brake-end threshold.
- RCS handles cross-track position/velocity correction without reducing planned main throttle.
- Direction guards and divergence replanning remain active.

This preserves safety while preventing the existing PD acceleration solve from turning a full-throttle segment into a pulse train.

## Terminal Contract

DirectFastTransfer terminal behavior is stateful:

- Once brake is committed, do not return to prograde acceleration in the terminal window.
- Keep full main brake authoritative until relative speed is within the brake-end envelope, subject to alignment and emergency safety gates.
- After brake-end, turn main throttle off and use RCS-only final hold.
- Completion requires stable position and velocity for the configured hold confirmation duration.

Existing terminal redirect and lateral correction functions remain as fallback behavior for other profiles or emergency cases.

## Arrival Point

The DirectFastTransfer stop point is explicitly the arrival point in world space. For normal waypoints this is `currentTarget.Position`. Later docking or approach offsets can replace that input, but planner, executor, debug, and tests should consistently measure center of mass to `arrivalPointWorld`.

## Documentation Check

Unity 6.4 local docs were checked:

- `E:\Unity\Documentation\en\ScriptReference\Rigidbody-linearVelocity.html`: `linearVelocity` is world-space and should not be modified every physics step for normal movement.
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`: force application is accumulated and applied by physics; ForceMode defines mass/timestep behavior.
- `E:\Unity\Documentation\en\ScriptReference\Vector3.ProjectOnPlane.html`: projection helper is valid for cross-track components.

This supports the constraint to continue through force/request based flight control and avoid direct Rigidbody state writes.

## Risks

- Existing tests may assume Burn/Coast/Brake/Final/Hold sequence for direct routes.
- Predicted samples and executable segment indices can diverge if the solver only changes high-level segments.
- Terminal suppress/redirect gates can still interrupt DirectFastTransfer unless profile information is available at execution time.
- Near-target cases need careful thresholds to avoid replacing a small RCS hold with a one-frame full-throttle pulse.
- No-RCS and no-main cases need explicit fallback reporting so the profile is not selected incorrectly.
