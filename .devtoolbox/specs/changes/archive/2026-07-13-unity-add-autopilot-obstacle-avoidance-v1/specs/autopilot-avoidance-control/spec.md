# Capability: autopilot-avoidance-control

## Requirements

- When the planned corridor is blocked, the autopilot must enter `ObstacleAvoidance` and expose the mode through state and diagnostics.
- Avoidance must reduce or disable main throttle while the obstacle remains dangerous.
- Avoidance must calculate a lateral world-space escape vector that does not point through the obstacle along the blocked corridor.
- Avoidance must use existing physical control paths: `FlightAssistRequest.forceWorld`, `FlightAssistRequest.torqueLocal`, and bounded `mainThrottle` through `PlayerShipController`.
- Avoidance must not directly assign Rigidbody position, rotation, velocity, angular velocity, or `linearVelocity` for navigation.
- Avoidance must prefer RCS translation when available and may request a short side/diagonal main-thrust assist only when alignment is safe.
- Avoidance must apply hysteresis with minimum active time plus clear frames or clear time before returning to the previous autopilot phase.
- If no practical avoidance authority exists or the obstacle remains unresolved inside danger range, the autopilot must set a clear failure or limitation reason such as `NoAvoidanceAuthority` or `ObstacleBlocked`.

## Scenarios

- Given an obstacle in the burn corridor and available RCS, the autopilot enters `ObstacleAvoidance`, commands lateral RCS force, and suppresses main throttle toward the obstacle.
- Given clear sensor results after the configured clear time, the autopilot returns to long-range burn, brake, or final approach based on the phase it interrupted.
- Given no RCS/main authority and a blocking obstacle, the autopilot fails/aborts with an obstacle-specific reason rather than continuing through the obstacle.
