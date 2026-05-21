# Spec: Hotpath Stability Cleanup

## ADDED Requirements

### Requirement: Autopilot planning is gated and throttled

Autopilot obstacle and trajectory planning SHALL NOT run every `FixedUpdate` while the autopilot is disengaged.

#### Scenario: Disengaged autopilot does not refresh navigation plan in FixedUpdate

- **GIVEN** a waypoint autopilot with a selected target and obstacle detector
- **WHEN** `FixedUpdate` runs while the autopilot is not engaged
- **THEN** navigation plan refresh count SHALL remain unchanged.

#### Scenario: Engaged autopilot refreshes at a bounded cadence

- **GIVEN** an engaged waypoint autopilot
- **WHEN** multiple `FixedUpdate` calls run inside the configured planning interval
- **THEN** navigation planning SHALL refresh at most once until the interval elapses.

### Requirement: Obstacle fallback uses a registry

Colliderless obstacle fallback SHALL use a registry of active `PrototypeNavigationObstacle` components rather than scene-wide object discovery.

#### Scenario: Detector source has no global obstacle discovery

- **GIVEN** the obstacle detector source
- **WHEN** source guards scan it
- **THEN** it SHALL NOT contain `FindObjectsByType<PrototypeNavigationObstacle>` or `FindObjectsOfType<PrototypeNavigationObstacle>`.

### Requirement: RCS allocator avoids steady-state allocations

The RCS allocator SHALL reuse scratch buffers for allocation data and actual throttles in `FixedUpdate`.

#### Scenario: Allocator source avoids per-tick arrays and ToArray

- **GIVEN** the RCS controller source
- **WHEN** source guards scan allocator methods
- **THEN** allocation code SHALL NOT call `ToArray()` or create `new float[]` in the apply/spool paths.

### Requirement: Visual switcher strips only its manager

The visual switcher SHALL NOT remove renderer, collider, or rigidbody components from arbitrary gameplay objects.

#### Scenario: Switcher on gameplay object preserves host components

- **GIVEN** a switcher attached to a gameplay object with rendering, collider, and rigidbody components
- **WHEN** visual mode is applied
- **THEN** those host components SHALL remain intact.

### Requirement: Obstacle avoidance is explicit

The autopilot SHALL expose obstacle avoidance as a first-class state.

#### Scenario: Avoidance plan sets ObstacleAvoidance state

- **GIVEN** an engaged autopilot with an obstacle in the direct route
- **WHEN** the trajectory plan requires avoidance
- **THEN** `CurrentState` SHALL equal `ObstacleAvoidance`.
