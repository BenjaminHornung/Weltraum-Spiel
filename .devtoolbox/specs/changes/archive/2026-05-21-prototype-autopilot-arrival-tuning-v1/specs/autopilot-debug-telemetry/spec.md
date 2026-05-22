# Capability: Autopilot Debug Telemetry

## Requirements

### Requirement: Debug Console shows full autopilot telemetry

The runtime Debug Console Autopilot panel SHALL show the complete diagnostic surface needed to understand arrival decisions and failures.

#### Scenario: Full active-autopilot telemetry

- GIVEN the Debug Console Autopilot panel is visible
- WHEN a target is selected or autopilot is active
- THEN the panel shows state
- AND target
- AND distance
- AND closing speed
- AND lateral speed
- AND stopping distance
- AND desired burn direction
- AND requested throttle
- AND requested RCS translation

#### Scenario: Failure and limitation reason

- GIVEN autopilot cannot safely continue
- WHEN the Debug Console Autopilot panel is visible
- THEN it shows a stable reason for failed, no fuel, no authority, manual override, Momentum Assist ownership, or reduced RCS capability

### Requirement: HUD remains compact

The flight HUD SHALL show a compact autopilot status instead of duplicating full debug-console telemetry.

#### Scenario: Compact HUD status

- GIVEN the HUD is visible
- WHEN a target is selected or autopilot is active
- THEN the HUD shows compact target and autopilot status
- AND it may show phase or short failure reason
- AND it does not become a dense table of all autopilot metrics

### Requirement: Debug overlay remains consistent

The debug overlay MAY show selected autopilot metrics, but any shown values SHALL be consistent with the authoritative autopilot diagnostics.

#### Scenario: Overlay values match autopilot diagnostics

- GIVEN the debug overlay shows autopilot metrics
- WHEN autopilot diagnostics update
- THEN overlay values use the same target, state, distance, closing speed, lateral speed, stopping distance, fuel, and status surfaces as the debug console

### Requirement: README documents arrival tuning and limits

README SHALL document the tuned waypoint autopilot behavior, compact HUD status, full Debug Console panel, failure reasons, and non-goals.

#### Scenario: README updated

- GIVEN the change is complete
- WHEN README is reviewed
- THEN it documents that arrival requires distance, relative speed, and lateral-speed tolerance
- AND it documents `FuelInsufficient`, `NoAuthority` or reduced capability reporting
- AND it documents that the system is not an orbital planner, slingshot planner, docking assist, map UI, or mission router
