# Capability: Floating Origin Large World

## Requirements

### Requirement: Absolute state separation

Large-world objects SHALL be able to store absolute position separately from Unity local transform position.

#### Scenario: Far ship state

- GIVEN a ship has a large absolute position
- WHEN it is represented in the local Unity scene
- THEN its local transform remains near the active origin

### Requirement: Origin shift preserves relative layout

Origin shifts SHALL preserve relative positions between participating objects.

#### Scenario: Shift threshold exceeded

- GIVEN the focus object exceeds the local distance threshold
- WHEN an origin shift occurs
- THEN participating objects keep the same relative offsets after the shift

### Requirement: Current prototype unaffected

The current small prototype SHALL not require large-world state unless this system is explicitly enabled.
