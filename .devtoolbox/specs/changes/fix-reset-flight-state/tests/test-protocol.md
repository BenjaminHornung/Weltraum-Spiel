# Test Protocol: fix-reset-flight-state

## 2026-05-19

### Unity MCP script validation

- `Assets/Scripts/Prototype/PlayerShipController.cs`: 0 errors, 1 existing Update string-concat warning.
- `Assets/Scripts/Prototype/FloatingOriginBody.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/SimpleFollowCamera.cs`: 0 errors, 1 existing Update string-concat warning.
- `Assets/Tests/Editor/ResetFlightStateValidationTests.cs`: 0 errors, 0 warnings.

### Focused coverage

- Added `ResetFlightStateValidationTests.ResetFlightStateClearsMotionThrottleDebugPulsesAndFloatingOriginState`.
- The test covers reset position, rotation, Rigidbody linear/angular velocity, main throttle, pending debug pulses, floating-origin absolute position/velocity, and availability of the camera snap helper.

### Focused EditMode verification

- Unity MCP `run_tests`, EditMode, targeted test:
  `ResetFlightStateValidationTests.ResetFlightStateClearsMotionThrottleDebugPulsesAndFloatingOriginState`
- Job `6a66e6d714bb40db97771ff8bb3ace62`: 1 total, 1 passed, 0 failed, 0 skipped.
