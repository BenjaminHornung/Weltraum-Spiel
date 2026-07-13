# Main-Thread Apply Boundaries

## ADDED Requirements

### Requirement: Explicit apply boundary for Unity object writes

All writes to scene objects, component properties, or transforms SHALL go through a bounded main-thread apply boundary.

#### Scenario: Apply-only mutation

- GIVEN a worker computes updated runtime values
- WHEN those values affect gameplay-visible state
- THEN changes SHALL be committed in a main-thread apply pass.

### Requirement: Read/write segregation

The architecture SHALL keep worker data read-only for the compute phase and apply-only for game object mutation.

#### Scenario: Read-only worker phase

- GIVEN a job candidate is running
- WHEN the worker reads simulation inputs
- THEN it SHALL not directly read/write Unity component methods that require main thread.

### Requirement: Ownership and conflict resolution

Ownership of a runtime participant for a frame SHALL be single-writer at the apply boundary.

#### Scenario: Single apply source

- GIVEN multiple workers update the same participant in one frame
- WHEN merging occurs
- THEN a single serialized apply ordering SHALL be used and documented.

### Requirement: Testable boundaries

Each apply boundary SHALL be observable for verification and regression checks.

#### Scenario: Boundary instrumentation

- GIVEN debug/verification runs
- WHEN boundary commits happen
- THEN there SHALL be a visible marker for which values were applied by main-thread pass versus worker output.
