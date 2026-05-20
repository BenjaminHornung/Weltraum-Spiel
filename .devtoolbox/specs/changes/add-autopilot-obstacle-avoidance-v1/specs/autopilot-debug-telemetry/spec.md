# Capability: autopilot-debug-telemetry

## Requirements

- The autopilot must expose cached diagnostics for obstacle avoidance without doing additional scene searches.
- Diagnostics must include:
  - `AvoidanceActive`
  - `AvoidanceReason`
  - `AvoidanceTargetName`
  - `AvoidanceDistance`
  - `AvoidanceVectorWorld`
  - `AvoidanceClearanceMeters`
  - `LastObstacleHit`
- Diagnostics must update when the sensor runs, when avoidance starts, while avoidance remains active, and when the corridor clears.
- HUD/minimap/debug overlays may read the cached values, but must not trigger extra physics scans or global object searches.
- Test evidence must record the detected obstacle, avoidance vector, request source, and failure reason where applicable.

## Scenarios

- Given an obstacle hit, diagnostics identify the obstacle name/label, distance, clearance, and avoidance vector.
- Given a cleared corridor, diagnostics stop reporting active avoidance while preserving enough last-hit context for debug display.
- Given a limitation/failure, diagnostics expose the obstacle-specific reason for tests and HUD/debug readers.
