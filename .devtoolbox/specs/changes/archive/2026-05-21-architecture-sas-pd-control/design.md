# Design: SAS PD Control

## Control Model

SAS should generate a desired torque, not apply forces directly. The desired torque is then allocated through RCS.

For attitude hold:

```text
q_error = targetRotation * inverse(currentRotation)
angularError = axisAngle(q_error)
desiredTorque = Kp * angularError - Kd * angularVelocity
```

For kill rotation, the proportional term can be zero and the derivative term damps angular velocity.

## Integration

Player input remains separate. SAS contributes a desired torque request to the same allocator path as manual attitude control. If RCS is off or unavailable, SAS cannot create real torque.

## Manual Override

Manual input should mask or blend on active axes while SAS remains active on inactive axes. The masking rules must be visible in diagnostics.

## Risks

Incorrect gains can make the ship oscillate or feel weak. Verification needs deterministic angular-velocity stop tests for pitch, yaw, and roll.
