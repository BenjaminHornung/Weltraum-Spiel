# Spec: DirectFastTransfer Execution Smoothness

## Capability

DirectFastTransfer waypoint execution must keep nominal burn, flip, brake, and hold behavior smooth and visibly stable.

## Requirements

### Requirement: Soft tracking divergence is corrective

During active DirectFastTransfer segments, if replan reasons are limited to `PositionDivergence`, `VelocityDivergence`, `AttitudeDivergence`, and `TrackingDiverged`, the executor MUST continue applying the current segment command and MUST NOT clear actuator output or create a new plan revision.

#### Scenario: Position or velocity error during full burn

- **Given** a DirectFastTransfer prograde burn is active
- **When** the tracker reports only soft divergence
- **Then** status is `Tracking correction`
- **And** `FlightPlanReplan` is not added to the arrival failure reason
- **And** main/RCS output is not cleared

### Requirement: Hard reasons still replan or abort

Target movement, obstacle detection, collision prediction, fuel starvation, missing main or RCS authority, invalid plan direction, non-finite state, and true expiration after the terminal hold window MUST still trigger hard safety handling.

### Requirement: Conservative brake safety does not override analytic DirectFastTransfer switch

The conservative live brake timing check MUST NOT flag normal DirectFastTransfer align, burn, flip, or brake phases as velocity divergence.

### Requirement: Main throttle has DirectFastTransfer hysteresis

DirectFastTransfer full burn and full brake MUST use latch behavior so small angle or angular-rate oscillations do not pulse planned full throttle to zero. Waiting for latch MUST present an alignment/latch status, not replan status.

### Requirement: Initial align drift is included in the direct solve

The DirectFastTransfer solver MUST estimate the initial align duration, propagate initial position by current velocity during that time, and solve the bang-bang transfer from the aligned state.

### Requirement: Planned brake direction is authoritative

For DirectFastTransfer flip and retrograde burn, the tracker MUST prefer the segment's planned brake direction. Minor lateral velocity MUST be corrected with RCS instead of rotating the main brake vector every frame.
