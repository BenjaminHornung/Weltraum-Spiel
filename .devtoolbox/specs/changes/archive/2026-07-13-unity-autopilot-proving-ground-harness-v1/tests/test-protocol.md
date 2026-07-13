# Autopilot Proving Ground Test Protocol

Change: `autopilot-proving-ground-harness-v1`

This automated PlayMode harness uses programmatic setup and scripted physics. It intentionally keeps strict point-arrival thresholds so current gameplay-quality failures are visible.
The normal PlayMode test generates evidence and fails only on harness setup problems. The explicit acceptance test applies the same gates as an opt-in future check while current autopilot bugs are still expected.

## Summary

| Scenario | Classification | Final Error | Final Speed | Angular Speed | Replans | Avoidance | Min Obstacle Clearance | Disallowed Profiles | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| `Direct_Short_100m_NoObstacle` | PASS | 0.243416 | 0.047162 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `Direct_Medium_500m_NoObstacle` | PASS | 0.240253 | 0.047273 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `Direct_Long_2400m_NoObstacle` | PASS | 0.227089 | 0.047481 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `LateralVelocity_500m_NoObstacle` | PASS | 0.515857 | 0.047267 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `OffAxisRotation_500m_NoObstacle` | PASS | 0.485552 | 0.04737 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `ObstacleCorridor_500m_Reacquire` | PASS | 0.504097 | 0.046968 | 0 | 0 | avoid=True, reacquire=True, directAfter=True | 85.49461 | 0 | all gates passed |
| `NearTarget_Overshoot_InitialVelocity` | PASS | 0.515906 | 0.047367 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `LowRcsAuthority_TerminalCorrection` | PASS | 0.202228 | 0.046831 | 0 | 0 | not expected | Infinity | 0 | all gates passed |
| `NoRcsAuthority_Negative_NoFalseComplete` | PASS | 1751.105 | 16 | 0 | 5454 | not expected | Infinity | 0 | negative scenario did not false-complete |

## Artifacts

- Summary JSON: `tests/autopilot-proving-ground-summary.json`
- Per-scenario CSV files: `tests/performance/<scenario>.csv`

## Scenarios

### Direct_Short_100m_NoObstacle

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Short_100m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `0.014076m`
- Maximum distance after first entering 2m: `1.987888m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### Direct_Medium_500m_NoObstacle

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Medium_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `0.011127m`
- Maximum distance after first entering 2m: `1.975207m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### Direct_Long_2400m_NoObstacle

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Long_2400m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `0.003247m`
- Maximum distance after first entering 2m: `1.976337m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### LateralVelocity_500m_NoObstacle

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LateralVelocity_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `0.003259m`
- Maximum distance after first entering 2m: `1.999693m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### OffAxisRotation_500m_NoObstacle

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/OffAxisRotation_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `0.030817m`
- Maximum distance after first entering 2m: `1.989116m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### ObstacleCorridor_500m_Reacquire

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/ObstacleCorridor_500m_Reacquire.csv`
- Final state: `Complete`
- Minimum distance: `0.142561m`
- Maximum distance after first entering 2m: `1.971766m`
- Obstacle evidence: `sawAvoidance=True, sawReacquire=True, sawDirectAfterAvoidance=True, minimumObstacleClearance=85.49461m`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### NearTarget_Overshoot_InitialVelocity

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NearTarget_Overshoot_InitialVelocity.csv`
- Final state: `Complete`
- Minimum distance: `0.002739m`
- Maximum distance after first entering 2m: `218.7108m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### LowRcsAuthority_TerminalCorrection

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LowRcsAuthority_TerminalCorrection.csv`
- Final state: `Complete`
- Minimum distance: `0.021385m`
- Maximum distance after first entering 2m: `6.061102m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: all gates passed

### NoRcsAuthority_Negative_NoFalseComplete

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NoRcsAuthority_Negative_NoFalseComplete.csv`
- Final state: `Failed`
- Minimum distance: `140m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: negative scenario did not false-complete

