# Capability: Trajectory Preview and Burn Planner

## Requirements

### Requirement: Shared physics assumptions

Trajectory prediction SHALL use the same formulas as real simulation for the forces it claims to include.

#### Scenario: Gravity-only prediction

- GIVEN gravity-only prediction is enabled
- WHEN the real simulation and predictor run from the same state
- THEN short-horizon predicted position remains within configured tolerance

### Requirement: Bounded preview

Prediction SHALL run for a bounded number of fixed steps to remain fast and deterministic.

#### Scenario: Debug preview

- GIVEN a step count and fixed timestep
- WHEN prediction runs
- THEN it returns a finite list of future states

### Requirement: Burn plan data

Burn planning SHALL represent direction, duration, throttle, and estimated fuel use before a full UI is built.
