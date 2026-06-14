# Test Protocol

Change: `fix-autopilot-exact-point-arrival-v1`
Date: 2026-06-14

## Evidence Summary

- PASS: Unity MCP `validate_script` for touched runtime and test files reported 0 errors.
- PASS: Focused EditMode tests for terminal arrival, transition gates, planner classification, and flight-plan validation passed: 46/46.
- PASS: Proving Ground evidence generator passed:
  `PrototypeAutopilotProvingGroundPlayModeTests.PlayMode_AutopilotProvingGround_GeneratesScenarioMatrixEvidence`.
- PASS: Proving Ground acceptance gate passed:
  `PrototypeAutopilotProvingGroundPlayModeTests.PlayMode_AutopilotProvingGround_AcceptanceGates`.
- PASS: Focused PlayMode nominal-reacquire regression passed:
  `PrototypeAutopilotNavigationPlayModeTests.PlayMode_DirectFastTransfer_SlowButFarAfterBrakeDoesNotUseNominalReacquire`.
- PASS: `dotnet build "Weltraum Spiel.sln" --no-restore`.
- PASS: DevToolbox `specs_validate` for `fix-autopilot-exact-point-arrival-v1`.

## Refreshed Harness Artifacts

- `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/autopilot-proving-ground-summary.json`
- `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/test-protocol.md`
- `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/*.csv`

## Final Proving Ground Results

Generated summary: `2026-06-14T19:43:59.4915941Z`

| Scenario | Classification | Final state | Final distance | Final relative speed | Safety replans | Disallowed profiles | Post-brake Accelerate transitions |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Direct_Short_100m_NoObstacle | PASS | Complete | 0.243416m | 0.047162m/s | 0 | 0 | 0 |
| Direct_Medium_500m_NoObstacle | PASS | Complete | 0.240253m | 0.047273m/s | 0 | 0 | 0 |
| Direct_Long_2400m_NoObstacle | PASS | Complete | 0.227089m | 0.047481m/s | 0 | 0 | 0 |
| LateralVelocity_500m_NoObstacle | PASS | Complete | 0.515857m | 0.047267m/s | 0 | 0 | 0 |
| OffAxisRotation_500m_NoObstacle | PASS | Complete | 0.485552m | 0.04737m/s | 0 | 0 | 0 |
| ObstacleCorridor_500m_Reacquire | PASS | Complete | 0.504097m | 0.046968m/s | 0 | 0 | 0 |
| NearTarget_Overshoot_InitialVelocity | PASS | Complete | 0.515906m | 0.047367m/s | 0 | 0 | 0 |
| LowRcsAuthority_TerminalCorrection | PASS | Complete | 0.202228m | 0.046831m/s | 0 | 0 | 0 |
| NoRcsAuthority_Negative_NoFalseComplete | PASS | Failed | 1751.105m | 16m/s | 5454 | 0 | 0 |

## Notes

- The no-RCS negative case remains a PASS because it does not false-complete and reports `Failed`.
- The obstacle corridor final summary reports `minimumObstacleClearance = 85.49461m`.
- Build completed with 0 errors and existing Unity/reference warnings.
- Unity script validation reported one existing warning in `PrototypeWaypointAutopilot.cs` about string concatenation in `Update()`; no touched file reported validation errors.
