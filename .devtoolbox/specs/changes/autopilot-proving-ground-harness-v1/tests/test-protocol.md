# Autopilot Proving Ground Test Protocol

Change: `autopilot-proving-ground-harness-v1`

This automated PlayMode harness uses programmatic setup and scripted physics. It intentionally keeps strict point-arrival thresholds so current gameplay-quality failures are visible.

## Summary

| Scenario | Classification | Final Error | Final Speed | Angular Speed | Replans | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `Direct_Short_100m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 6.304008 | 0.047418 | 0 | 0 | final exact target error 6.304008m > 0.75m |
| `Direct_Medium_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 6.546758 | 0.04709 | 0 | 0 | final exact target error 6.546758m > 0.75m |
| `Direct_Long_2400m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 5.816183 | 0.047474 | 0 | 0 | final exact target error 5.816183m > 0.75m |
| `LateralVelocity_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 6.546758 | 0.04709 | 0 | 0 | final exact target error 6.546758m > 0.75m |
| `OffAxisRotation_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 5.048829 | 0.047082 | 0 | 0 | final exact target error 5.048829m > 0.75m |
| `ObstacleCorridor_500m_Reacquire` | FAIL_EXPECTED_CURRENT_BUG | 16.00986 | 0.159545 | 0 | 0 | terminal state was Brake instead of Complete; final exact target error 16.00986m > 1.25m; did not reach a terminal state within 260s |
| `NearTarget_Overshoot_InitialVelocity` | FAIL_EXPECTED_CURRENT_BUG | 5.794921 | 0.047422 | 0 | 0 | final exact target error 5.794921m > 0.75m |
| `LowRcsAuthority_TerminalCorrection` | FAIL_EXPECTED_CURRENT_BUG | 472.9289 | 25.06592 | 0 | 0 | terminal state was Failed instead of Complete; final exact target error 472.9289m > 0.75m; final relative speed 25.06592m/s > 0.15m/s |
| `NoRcsAuthority_Negative_NoFalseComplete` | PASS | 140 | 0 | 0 | 0 | negative scenario did not false-complete |

## Artifacts

- Summary JSON: `tests/autopilot-proving-ground-summary.json`
- Per-scenario CSV files: `tests/performance/<scenario>.csv`

## Scenarios

### Direct_Short_100m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Short_100m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `6.304008m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 6.304008m > 0.75m

### Direct_Medium_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Medium_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `6.546758m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 6.546758m > 0.75m

### Direct_Long_2400m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Long_2400m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `5.816183m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 5.816183m > 0.75m

### LateralVelocity_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LateralVelocity_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `6.546758m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 6.546758m > 0.75m

### OffAxisRotation_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/OffAxisRotation_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `2.26159m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 5.048829m > 0.75m

### ObstacleCorridor_500m_Reacquire

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/ObstacleCorridor_500m_Reacquire.csv`
- Final state: `Brake`
- Minimum distance: `15.8159m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: terminal state was Brake instead of Complete; final exact target error 16.00986m > 1.25m; did not reach a terminal state within 260s

### NearTarget_Overshoot_InitialVelocity

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NearTarget_Overshoot_InitialVelocity.csv`
- Final state: `Complete`
- Minimum distance: `5.794921m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: final exact target error 5.794921m > 0.75m

### LowRcsAuthority_TerminalCorrection

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LowRcsAuthority_TerminalCorrection.csv`
- Final state: `Failed`
- Minimum distance: `472.9289m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: terminal state was Failed instead of Complete; final exact target error 472.9289m > 0.75m; final relative speed 25.06592m/s > 0.15m/s

### NoRcsAuthority_Negative_NoFalseComplete

- Classification: `PASS`
- CSV: `E:/Unity/Weltraum Spiel/Weltraum Spiel/.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NoRcsAuthority_Negative_NoFalseComplete.csv`
- Final state: `Failed`
- Minimum distance: `140m`
- Maximum distance after first entering 2m: `0m`
- Failure summary: negative scenario did not false-complete

