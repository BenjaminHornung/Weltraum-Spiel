# Task 12 Focused EditMode Tests

Date: 2026-06-13

Unity MCP `run_tests`, mode `EditMode`.

Job id: `07ec51bff0364270be5ddfe66b3797fb`

## Tests

- `PrototypeWaypointAutopilotValidationTests.FlightPlanSoftDivergenceRequiresHalfSecondConfirmation`
- `PrototypeWaypointAutopilotValidationTests.FlightPlanSafetyReplanCooldownBlocksSoftRepeatUntilTwoSeconds`
- `PrototypeWaypointAutopilotValidationTests.FlightPlanHardDivergenceBypassesConfirmationAndCooldown`
- `PrototypeWaypointAutopilotValidationTests.FlightPlanSafetyReplanCooldownThrottlesSoftReplanIntegration`
- `PrototypeWaypointAutopilotValidationTests.FlightPlanSafetyReplanMixedHardReasonBypassesCooldownIntegration`

## Result

Passed: 5
Failed: 0
Skipped: 0
Duration: 0.1814149 seconds

Notes:
- The hard/immediate bypass assertion uses `NoRcsAuthority`, which was not covered by the old narrow cooldown bypass mask.
- The integration assertions invoke `ForceFlightPlanSafetyReplan` and verify `FlightPlanSafetyReplanCount` for the soft cooldown and mixed hard-reason bypass paths.
- Unity console still contains unrelated Unity Asset Manager serialization exception entries from editor packages; the focused test job itself had no failures.
