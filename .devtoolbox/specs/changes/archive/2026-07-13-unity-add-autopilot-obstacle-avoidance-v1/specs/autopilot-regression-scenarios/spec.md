# Capability: autopilot-regression-scenarios

## Requirements

- EditMode tests must cover obstacle detection inside/outside the corridor, ignored projectiles/owners/triggers, state transition into `ObstacleAvoidance`, main-throttle suppression, RCS avoidance force, no-authority failure, clear-time return, and the direct Rigidbody velocity-write guard.
- Test-environment obstacles must be marked with `PrototypeNavigationObstacle` or an obstacle layer/mask so local avoidance can detect them while visual-only markers remain cheap.
- Manual or PlayMode evidence should cover:
  - free waypoint route;
  - blocked route with RCS avoidance;
  - blocked route with no RCS or insufficient authority.
- Evidence must be stored under `.devtoolbox/specs/changes/add-autopilot-obstacle-avoidance-v1/tests/`.

## Scenarios

- A waypoint route with no obstacle behaves like the prior autopilot route.
- A route blocked by a marked obstacle commands lateral physical avoidance and resumes navigation after the corridor clears.
- A route blocked while the ship lacks authority reports a limitation/failure rather than claiming successful arrival.
