# Spec: Autopilot Obstacle Replan Stability

## Capability

Prevent repeated obstacle-based replans caused by launch-corridor event flicker while running `PrototypeBootstrapHost`.

## Requirements

### Requirement: Chatter from repeated obstacle flicker is reduced
`PrototypeWaypointAutopilot` MUST avoid repeated `SafetyReplan` triggers when launch-corridor obstacle signals flicker without introducing new urgent risk.

#### Scenario: Flickering obstacle edge
- Given launch-corridor risk alternates rapidly between blocked and clear for less than the stable window
- When `ObstacleDetected` / `CollisionPredicted` events continue
- Then no additional `SafetyReplan` is emitted for each flicker edge
- And replan frequency is limited by the stability window.

### Requirement: New or urgent risks still replan immediately
Immediate replans must remain for genuinely new or near-collision risks even with prior debounce state.

#### Scenario: New obstacle risk
- Given no current obstacle risk is active
- When a new non-continuous obstacle risk appears
- Then `SafetyReplan` is triggered immediately.

#### Scenario: Near collision threshold crossed
- Given current risk is non-urgent
- When risk becomes near-collision urgent
- Then `SafetyReplan` is triggered immediately and bypasses debounce suppression.

### Requirement: Stability reset on safe corridor
Stable clear state must be required before risk-armed replan suppression is relaxed.

#### Scenario: Long clear period
- Given an obstacle previously triggered risk suppression
- When corridor is clear for the clear stability window
- Then host risk state transitions to clear and replan suppression no longer blocks future genuine triggers.

## Constraints

- Do not remove global immediate semantics of `ObstacleDetected` / `CollisionPredicted`.
- Do not modify arrival terminal overshoot behavior.
- Do not include Phase-7 executor extraction in this scope.
