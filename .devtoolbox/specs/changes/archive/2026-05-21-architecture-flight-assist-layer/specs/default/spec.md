# Capability: Flight Assist Layer

## Requirements

### Requirement: Assist is explicit

Flight assist SHALL be represented as a named control layer rather than hidden Rigidbody damping.

#### Scenario: Assist disabled

- GIVEN assist mode is Simulation Mode
- WHEN no thrust or RCS is active
- THEN linear and angular momentum persist except for real collisions or environment forces

### Requirement: Assist routes through physics core

Assist SHALL express desired force and torque through the ship physics request path.

#### Scenario: Velocity assist

- GIVEN a velocity-assist behavior requests braking force
- WHEN the request is processed
- THEN the resulting application is constrained by available actuators or explicitly marked debug-only

### Requirement: Diagnostics separate request sources

Diagnostics SHALL distinguish manual input, SAS, and flight-assist requests.

#### Scenario: Overlay inspection

- GIVEN assist is enabled
- WHEN the debug overlay is visible
- THEN assist force/torque requests are visible separately from manual and SAS requests
