# Design: DirectFastTransfer Execution Smoothness

## Approach

DirectFastTransfer already owns the analytic burn and brake schedule. The fix keeps that schedule authoritative during nominal execution and narrows replan behavior to hard safety conditions.

## Decisions

1. Treat DirectFastTransfer soft tracking divergence as correction, not plan replacement.
   `PositionDivergence`, `VelocityDivergence`, `AttitudeDivergence`, and `TrackingDiverged` are expected in a high-authority bang-bang transfer while the tracker and RCS correct. They should update status and diagnostics without calling `ForceFlightPlanSafetyReplan()`.

2. Remove conservative brake timing from the DirectFastTransfer normal path.
   The existing conservative check predates the analytic switch point. For DirectFastTransfer burn, flip, and brake phases, the planned switch point is the source of truth. Hard emergency checks remain separate.

3. Add DirectFastTransfer-specific main-throttle hysteresis.
   Full burn and full brake should latch after alignment is achieved and remain latched through small angle/rate oscillations. When not latched, the plan clock may pause and status should say alignment/latch wait instead of replan.

4. Include initial align drift in the direct solver.
   `BuildFlightPlan()` inserts `AlignForBurn` before burn, so the solver should propagate position by current velocity during estimated align time and solve bang-bang from that aligned state.

5. Prefer planned brake direction during DirectFastTransfer.
   Lateral correction belongs to RCS. The main brake direction should not chase minor lateral velocity changes every tick.

## Verification Strategy

- EditMode tests for solver align drift, DirectFastTransfer brake safety suppression, soft tracking status, hard invalid direction, and planned brake direction.
- PlayMode tests for no nominal replan, continuous full burn/brake after latch, alignment wait status, soft tracking not clearing output, 90 degree start rotation, and planned brake direction.
- Unity EditMode and PlayMode focused suites plus `dotnet build`.
