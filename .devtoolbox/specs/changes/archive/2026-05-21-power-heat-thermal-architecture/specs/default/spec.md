# Capability: Power and Heat Architecture

## Requirements

### Requirement: Module thermal data

Modules SHALL be able to declare heat generation, heat capacity, cooling rate, and maximum temperature.

#### Scenario: Engine heat

- GIVEN an engine module generates heat while firing
- WHEN heat simulation is enabled
- THEN module temperature rises according to generated heat and heat capacity

### Requirement: Cooling

Thermal state SHALL cool over time according to configured cooling or radiator values.

#### Scenario: Idle cooling

- GIVEN a hot module is idle
- WHEN thermal simulation advances
- THEN temperature decreases toward ambient or configured minimum

### Requirement: Overheat hook

Thermal state SHALL be able to affect module efficiency when limits are exceeded.

#### Scenario: Overheated weapon

- GIVEN a weapon exceeds maximum temperature
- WHEN overheat behavior is enabled
- THEN the module is throttled, disabled, or flagged according to configuration
