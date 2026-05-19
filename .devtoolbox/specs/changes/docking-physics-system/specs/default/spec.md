# Capability: Docking Physics System

## Requirements

### Requirement: Docking port definition

Docking candidates SHALL be represented by docking ports with local alignment and capture settings.

#### Scenario: Port discovery

- GIVEN a ship has a docking port component
- WHEN docking diagnostics run
- THEN the port reports world position, world forward, capture radius, and angle limit

### Requirement: Docking eligibility

Docking SHALL require position, orientation, and relative velocity checks.

#### Scenario: Too fast approach

- GIVEN two ports are aligned but closing too fast
- WHEN docking eligibility is evaluated
- THEN hard lock is rejected with a diagnostic reason

### Requirement: Soft capture is physical

Soft capture SHALL request bounded force/torque rather than teleporting objects.

#### Scenario: Soft capture active

- GIVEN ports are within capture range
- WHEN soft capture is enabled
- THEN assist requests move them toward alignment within configured limits
