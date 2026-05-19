# Capability: Reset Flight State

## Requirements

### Requirement: Reset synchronizes Rigidbody and Transform

The prototype reset action SHALL set both the Transform and Rigidbody to the requested position and rotation.

#### Scenario: Reset while moving

- GIVEN the ship has nonzero position, rotation, linear velocity, and angular velocity
- WHEN reset is triggered
- THEN the ship position is origin
- AND the ship rotation is identity
- AND linear velocity is zero
- AND angular velocity is zero

### Requirement: Reset clears active commands

The reset action SHALL clear active throttle and pending debug pulses so the ship does not immediately accelerate again.

#### Scenario: Reset with throttle active

- GIVEN main throttle or debug pulses are active
- WHEN reset is triggered
- THEN main throttle is zero
- AND pending RCS/attitude/debug throttle pulses are zero

### Requirement: Reset synchronizes floating-origin state

If a `FloatingOriginBody` is present, reset SHALL update its absolute position and velocity to match the local reset state.

#### Scenario: Reset with floating origin

- GIVEN the floating-origin manager has a nonzero origin
- WHEN reset sets local position to origin
- THEN absolute position equals manager origin plus local position
- AND absolute velocity is zero

### Requirement: Reset snaps camera

If a `SimpleFollowCamera` is present, reset SHALL request a camera snap so the next camera update follows the reset ship state.
