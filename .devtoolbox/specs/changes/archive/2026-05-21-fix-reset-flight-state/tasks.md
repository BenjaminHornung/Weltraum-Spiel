# Tasks: fix-reset-flight-state

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect current reset, floating-origin, and camera APIs
- [x] Add robust PlayerShipController ResetFlightState helper
- [x] Make ResetPosition delegate to ResetFlightState origin/identity
- [x] Add FloatingOriginBody reset helper
- [x] Add SimpleFollowCamera public snap helper
- [x] Update or add validation probe/test coverage for reset state
- [x] Add test evidence under this spec

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify reset clears position, rotation, linear velocity, angular velocity, throttle, and debug pulses
- [x] Verify floating-origin absolute state is synchronized
- [x] Verify camera snap helper is called/available
- [x] Run focused EditMode tests or deterministic probe
- [x] Commit implementation with spec title and changelog
- [x] Push branch
