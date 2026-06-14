# Autopilot Proving Ground Specification

## Capability

The project shall provide an automated proving ground for waypoint-autopilot gameplay-quality navigation.

## Requirements

### Requirement: Deterministic Scenario Harness

The harness SHALL create the ship, target, optional obstacles, and initial runtime state programmatically for every scenario.

The harness SHALL use scripted physics and SHALL NOT rely on manual Game View observation.

### Requirement: Scenario Matrix

The harness SHALL run these v1 scenarios:

- Direct_Short_100m_NoObstacle
- Direct_Medium_500m_NoObstacle
- Direct_Long_2400m_NoObstacle
- LateralVelocity_500m_NoObstacle
- OffAxisRotation_500m_NoObstacle
- ObstacleCorridor_500m_Reacquire
- NearTarget_Overshoot_InitialVelocity
- LowRcsAuthority_TerminalCorrection
- NoRcsAuthority_Negative_NoFalseComplete

### Requirement: Objective Metrics

The harness SHALL sample every FixedUpdate and write CSV rows containing ship motion, target-distance, planner, command, obstacle, terminal, transition, and arrival-quality metrics.

The harness SHALL write one summary JSON and one markdown protocol for the suite.

### Requirement: Strict Arrival Gates

Direct no-obstacle scenarios SHALL require exact target error <= 0.75m and final relative speed <= 0.15m/s.

Obstacle/reacquire scenarios SHALL require exact target error <= 1.25m and final relative speed <= 0.25m/s.

All positive scenarios SHALL require final angular speed <= 0.15 rad/s and terminal state `Complete`.

The no-RCS negative scenario SHALL NOT report false `Complete`.

### Requirement: Post-Brake Re-Acceleration Detection

The harness SHALL count transitions back into `Accelerate` after final brake ownership and SHALL fail near-target prograde re-acceleration unless a scenario explicitly allows emergency recovery.
