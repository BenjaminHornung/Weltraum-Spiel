# Spec: Autopilot Arrival Terminal Capture Stability

## Capability

Stabilize `DirectFastTransfer` arrival terminal behavior so brake hold capture is predictable and does not repeatedly churn under near-terminal jitter.

## Requirements

### Requirement: Terminal capture is gated by stable entry conditions
`PrototypeWaypointAutopilot` MUST delay terminal capture arm while arrival-to-terminal conditions are unstable.

#### Scenario: Stable signal is required before capture
- GIVEN the ship is in `DirectFastTransfer` terminal phase
- When target distance, speed, and alignment alternate within the terminal boundary
- Then terminal capture remains unarmed until conditions satisfy a short stability window
- And capture does not repeatedly toggle for transient crossings.

### Requirement: Throttle taper and hold are applied conservatively
Brake output during terminal capture must apply a bounded taper and avoid chatter-driven re-acceleration.

#### Scenario: Arrival throttle does not chatter in capture
- Given capture is armed and active
- When small jitter remains after entering terminal band
- Then brake command follows the defined taper profile then hold envelope
- And throttle is not reopened until release criteria are met.

### Requirement: Release is gated until sustained safe state
Capture release must be delayed until safe conditions are sustained.

#### Scenario: Stable release before throttle exit
- Given the ship is in terminal capture hold
- When distance/velocity/alignment leave capture briefly
- Then release is blocked until the same conditions return and stay stable for the release window
- And immediate safety/abort branches bypass this hold gate.

### Constraint: Preserve DFT safety and emergency intent

- High urgency correction paths and hard abort conditions remain immediate and are not softened by capture taper rules.

