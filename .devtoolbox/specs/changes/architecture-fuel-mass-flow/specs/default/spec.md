# Capability: Fuel Mass Flow

## Requirements

### Requirement: Fuel consumption follows applied thrust

Fuel-consuming thrusters SHALL consume fuel proportional to actual applied thrust or allocated nozzle throttle.

#### Scenario: Half throttle main engine

- GIVEN a main engine with fuel cost
- WHEN it fires at half throttle for one second
- THEN consumed fuel is half of the full-throttle one-second fuel cost

### Requirement: Partial fuel limits thrust

Thrusters SHALL scale applied thrust when remaining fuel cannot cover the whole physics step.

#### Scenario: Almost empty tank

- GIVEN less fuel remains than requested for the current step
- WHEN the engine fires
- THEN applied thrust is reduced by the available fuel fraction
- AND fuel reaches zero without becoming negative

### Requirement: RCS consumes fuel once per allocated nozzle

RCS fuel use SHALL follow the final bounded allocator output.

#### Scenario: Combined translation and attitude

- GIVEN one nozzle contributes to multiple desired effects through the allocator
- WHEN final nozzle throttle is calculated
- THEN fuel is consumed once for that final throttle, not once per command source

### Requirement: Zero fuel cost mode

A configured fuel rate of zero SHALL mean fuel-free thrust, not disabled thrust.
