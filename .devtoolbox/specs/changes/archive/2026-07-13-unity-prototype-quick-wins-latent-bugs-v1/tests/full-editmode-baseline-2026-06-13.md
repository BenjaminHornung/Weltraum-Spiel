# Full EditMode Baseline - 2026-06-13

Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`

Unity MCP job: `a91f5fc3a23340a4b3e16c825f9eb6e5`

Result: `failed`

Tests completed: `482 / 482`

Failures reported by MCP: `25`

Note: The user-requested baseline referenced 21 remaining failures. This fresh
MCP run on the current working tree reported 25 failures, so this file records
the current authoritative list for triage.

Build gate:

```text
dotnet build "Weltraum Spiel.sln" --no-restore
0 errors, 2 warnings
```

The Unity-generated `C:\Users\benni\AppData\LocalLow\DefaultCompany\Weltraum Spiel\TestResults.xml`
was not used as the full-suite artifact because it contained only a stale
single-test manifest run despite the editor console pointing at that path.

## Failing Tests

1. `PrototypeAutopilotMomentumStartupStateTests.BootstrapAutopilotFlipsAndMainBrakesWithoutManualAlignment`
   - `bootstrap main thruster force should oppose the approach velocity during decel`
   - Expected: `True`; actual: `False`
2. `PrototypeAutopilotMomentumStartupStateTests.FinalApproachLateralSpeedCreatesExternalForceRequest`
   - Expected: `FinalApproach`; actual: `AlignForBurn`
3. `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_FlightPlanDivergenceNewObstacleReplansWithVisibleReason`
   - Expected: `True`; actual: `False`
4. `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_HoldRequiresStableVelocityWindow`
   - Expected: `HoldPosition`; actual: `ObstacleAvoidance`
5. `PrototypeAutopilotNavigationComputerV2ValidationTests.Autopilot_ReacquiresDirectPathAfterAvoidance`
   - Expected: `False`; actual: `True`
6. `PrototypeAutopilotNavigationComputerV2ValidationTests.ObstacleDetector_MultipleObstacles_SelectsNearestBlocking`
   - Expected: `AutopilotV2ValidationNear`; actual: `Launch_Obstacle_1`
7. `PrototypeAutopilotNavigationComputerV2ValidationTests.ObstacleDetector_NonBlockingObstacle_IsIgnored`
   - Expected: `True`; actual: `False`
8. `PrototypeAutopilotNavigationComputerV2ValidationTests.ObstacleDetector_TriggersAreDetected`
   - Expected: `AutopilotV2ValidationTrigger`; actual: `Launch_Obstacle_1`
9. `PrototypeControlModeValidationTests.SasAuthorityProperty_UsesAuthorityNotDerivativeGain`
   - Expected: `(0.00, 0.00, 0.00) +/- 1.0f`; actual: `(0.00, 0.00, 0.00)`
10. `PrototypeHeadlessScenarioValidationTests.HeadlessAutopilotTicksControllerAndReducesDistance`
    - Expected: `greater than 0.5f`; actual: `0.0f`
11. `PrototypePerformancePlayModeEvidenceTests.PrototypeBootstrapHostRunsThirtySecondsWithHotpathEvidence`
    - `RCS cache refreshes may be dirtied by visual rebuilds, but must stay bounded to switch events rather than FixedUpdate frames.`
    - Expected: `<= 29`; actual: `30`
12. `PrototypePlayerHudEvidenceManifestValidationTests.PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders`
    - Missing or invalid screenshot header:
      `.devtoolbox\specs\changes\player-ui-regression-controls-autopilot-rcs-v1\tests\screenshots\player-ui-regression-radar-normal-1280x720.png`
13. `PrototypeShipVariantValidationTests.BuiltInVariantsExposeExpectedPrototypeCases`
    - Expected: `6`; actual: `8`
14. `PrototypeShipVariantValidationTests.OneSidedRcsVariantReportsResidualForUnsupportedTranslation`
    - Expected: `greater than 1000.0f`; actual: `0.0f`
15. `PrototypeWaypointAutopilotValidationTests.ArrivalAllowsSlightNegativeClosingSpeedAndHoldDampensResidualVelocity`
    - Expected: `HoldPosition`; actual: `FinalApproach`
16. `PrototypeWaypointAutopilotValidationTests.AutopilotAlignedBrakeDampsResidualSpinBeforeMainDecelBurn`
    - Expected: `Brake`; actual: `FlipForBrake`
17. `PrototypeWaypointAutopilotValidationTests.AutopilotBrakeAlignmentReassertsRcsAndSasAuthority`
    - `RCS-only waypoint autopilot should re-enable RCS before the authority gate`
    - Expected: `True`; actual: `False`
18. `PrototypeWaypointAutopilotValidationTests.AutopilotBrakeFailsWhenRcsAttitudeAuthorityMissing`
    - Expected: `Failed`; actual: `Aborted`
19. `PrototypeWaypointAutopilotValidationTests.AutopilotClosedLoopApproachBrakesWithoutManualAlignment`
    - `main thruster should only become active after the ship is near retrograde alignment`
    - Expected: `True`; actual: `False`
20. `PrototypeWaypointAutopilotValidationTests.AutopilotFastApproachFlipsBeforeMainDecelBurn`
    - Expected: `Brake`; actual: `FlipForBrake`
21. `PrototypeWaypointAutopilotValidationTests.AutopilotLateralVelocityRequestsCorrection`
    - Expected: `LateralCorrection`; actual: `Hold`
22. `PrototypeWaypointAutopilotValidationTests.AutopilotNoRcsAllowsCoarseBurnAndReportsLimitedApproach`
    - Expected: `FinalApproach`; actual: `Hold`
23. `PrototypeWaypointAutopilotValidationTests.DirectObstaclePlansAvoidanceAndAutopilotDoesNotBurnIntoObstacle`
    - Expected: `Avoidance`; actual: `AlignForBurn`
24. `PrototypeWaypointAutopilotValidationTests.LateralCorrectionForceScalesWithMassAndClampsToAuthority`
    - Expected: `greater than 20000.0f`; actual: `10000.0f`
25. `PrototypeWaypointAutopilotValidationTests.ToggleAutopilotUsesExternalAssistTorqueBeforeBrakeWhenHoldAttitudeWasActive`
    - Expected: `Brake`; actual: `FlipForBrake`
