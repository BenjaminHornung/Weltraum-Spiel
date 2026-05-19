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
- [ ] Inspect current reset, floating-origin, and camera APIs
- [ ] Add robust PlayerShipController ResetFlightState helper
- [ ] Make ResetPosition delegate to ResetFlightState origin/identity
- [ ] Add FloatingOriginBody reset helper
- [ ] Add SimpleFollowCamera public snap helper
- [ ] Update or add validation probe/test coverage for reset state
- [ ] Add test evidence under this spec

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify reset clears position, rotation, linear velocity, angular velocity, throttle, and debug pulses
- [ ] Verify floating-origin absolute state is synchronized
- [ ] Verify camera snap helper is called/available
- [ ] Run focused EditMode tests or deterministic probe
- [ ] Commit implementation with spec title and changelog
- [ ] Push branch
