# Capability: player-flight-control-regression

## Requirement
The prototype SHALL provide a PlayMode regression path that drives the real `PlayerShipController` input-to-physics route over multiple fixed steps and proves idle, translation, attitude, SAS, and main-thrust behavior are stable.

## Scenarios
- Idle with RCS on, SAS on, zero main throttle, and no external assist keeps linear and angular velocity near zero for at least three seconds.
- Translation Mode W/S/A/D produces non-zero translation commands, non-zero desired and actual RCS force, velocity growth in the expected direction, bounded residuals, and bounded angular velocity.
- Normal Mode W/S/A/D/Q/E produces controlled torque without large unintended translation or high-frequency jitter.
- SAS enabled damps angular velocity after input release; SAS disabled allows physical drift without spin or jitter explosion.
- Main thrust accelerates forward with stable angular velocity and plausible diagnostics.

## Constraints
- The regression path must use `PlayerShipController` command construction and `FixedUpdate`, not only direct `RcsThrusterController.ApplyControls`.
- The regression path must step multiple Unity physics frames.
- Single-step probes and isolated physics validation helpers are not sufficient evidence.
