# Autopilot Proving Ground Test Protocol

Change: `autopilot-proving-ground-harness-v1`

This automated PlayMode harness uses programmatic setup and scripted physics. It intentionally keeps strict point-arrival thresholds so current gameplay-quality failures are visible.
The normal PlayMode test generates evidence and fails only on harness setup problems. The explicit acceptance test applies the same gates as an opt-in future check while current autopilot bugs are still expected.

## Summary

| Scenario | Classification | Final Error | Final Speed | Angular Speed | Replans | Avoidance | Min Obstacle Clearance | Disallowed Profiles | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| `Direct_Short_100m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 6.304008 | 0.047418 | 0 | 0 | not expected | Infinity | 0 | final exact target error 6.304008m > 0.75m |
| `Direct_Medium_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 6.546758 | 0.04709 | 0 | 0 | not expected | Infinity | 0 | final exact target error 6.546758m > 0.75m |
| `Direct_Long_2400m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 5.816183 | 0.047474 | 0 | 0 | not expected | Infinity | 0 | final exact target error 5.816183m > 0.75m |
| `LateralVelocity_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 5.048399 | 0.047298 | 0 | 29 | not expected | Infinity | 1273 | final exact target error 5.048399m > 0.75m; safety replans 29 > 0; selected disallowed planner profile 1273 time(s); transitions into Accelerate after first brake commit 3 > 0; brake/flip/terminal to Accelerate transitions 1088 > 0 |
| `OffAxisRotation_500m_NoObstacle` | FAIL_EXPECTED_CURRENT_BUG | 5.048829 | 0.047082 | 0 | 0 | not expected | Infinity | 233 | final exact target error 5.048829m > 0.75m; selected disallowed planner profile 233 time(s); transitions into Accelerate after first brake commit 1 > 0; brake/flip/terminal to Accelerate transitions 11 > 0 |
| `ObstacleCorridor_500m_Reacquire` | FAIL_EXPECTED_CURRENT_BUG | 16.00986 | 0.159545 | 0 | 0 | avoid=True, reacquire=True, directAfter=False | -5.288439 | 0 | terminal state was Brake instead of Complete; final exact target error 16.00986m > 1.25m; minimum obstacle clearance -5.288439m < 0m; transitions into Accelerate after first brake commit 14 > 0; brake/flip/terminal to Accelerate transitions 17 > 0; did not reach a terminal state within 260s |
| `NearTarget_Overshoot_InitialVelocity` | FAIL_EXPECTED_CURRENT_BUG | 10.14625 | 0.760084 | 0 | 1 | not expected | Infinity | 3776 | terminal state was HoldPosition instead of Complete; final exact target error 10.14625m > 0.75m; final relative speed 0.760084m/s > 0.15m/s; safety replans 1 > 0; selected disallowed planner profile 3776 time(s); transitions into Accelerate after first brake commit 7 > 0; brake/flip/terminal to Accelerate transitions 50 > 0; did not reach a terminal state within 80s |
| `LowRcsAuthority_TerminalCorrection` | FAIL_EXPECTED_CURRENT_BUG | 11.49976 | 0.009994 | 0 | 860 | not expected | Infinity | 230 | final exact target error 11.49976m > 0.75m; safety replans 860 > 0; selected disallowed planner profile 230 time(s); transitions into Accelerate after first brake commit 1 > 0; brake/flip/terminal to Accelerate transitions 229 > 0 |
| `NoRcsAuthority_Negative_NoFalseComplete` | PASS | 1751.105 | 16 | 0 | 5454 | not expected | Infinity | 0 | negative scenario did not false-complete |

## Artifacts

- Summary JSON: `tests/autopilot-proving-ground-summary.json`
- Per-scenario CSV files: `tests/performance/<scenario>.csv`

## Scenarios

### Direct_Short_100m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Short_100m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `6.304008m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: final exact target error 6.304008m > 0.75m

### Direct_Medium_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Medium_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `6.546758m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: final exact target error 6.546758m > 0.75m

### Direct_Long_2400m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/Direct_Long_2400m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `5.816183m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: final exact target error 5.816183m > 0.75m

### LateralVelocity_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LateralVelocity_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `1.885018m`
- Maximum distance after first entering 2m: `5.048399m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=True, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=False, disallowedProfileCount=1273`
- Failure summary: final exact target error 5.048399m > 0.75m; safety replans 29 > 0; selected disallowed planner profile 1273 time(s); transitions into Accelerate after first brake commit 3 > 0; brake/flip/terminal to Accelerate transitions 1088 > 0

### OffAxisRotation_500m_NoObstacle

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/OffAxisRotation_500m_NoObstacle.csv`
- Final state: `Complete`
- Minimum distance: `2.26159m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=True, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=False, disallowedProfileCount=233`
- Failure summary: final exact target error 5.048829m > 0.75m; selected disallowed planner profile 233 time(s); transitions into Accelerate after first brake commit 1 > 0; brake/flip/terminal to Accelerate transitions 11 > 0

### ObstacleCorridor_500m_Reacquire

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/ObstacleCorridor_500m_Reacquire.csv`
- Final state: `Brake`
- Minimum distance: `15.8159m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=True, sawReacquire=True, sawDirectAfterAvoidance=False, minimumObstacleClearance=-5.288439m`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: terminal state was Brake instead of Complete; final exact target error 16.00986m > 1.25m; minimum obstacle clearance -5.288439m < 0m; transitions into Accelerate after first brake commit 14 > 0; brake/flip/terminal to Accelerate transitions 17 > 0; did not reach a terminal state within 260s

### NearTarget_Overshoot_InitialVelocity

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NearTarget_Overshoot_InitialVelocity.csv`
- Final state: `HoldPosition`
- Minimum distance: `0.300022m`
- Maximum distance after first entering 2m: `287.2m`
- Obstacle evidence: `sawAvoidance=True, sawReacquire=True, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=False, disallowedProfileCount=3776`
- Failure summary: terminal state was HoldPosition instead of Complete; final exact target error 10.14625m > 0.75m; final relative speed 0.760084m/s > 0.15m/s; safety replans 1 > 0; selected disallowed planner profile 3776 time(s); transitions into Accelerate after first brake commit 7 > 0; brake/flip/terminal to Accelerate transitions 50 > 0; did not reach a terminal state within 80s

### LowRcsAuthority_TerminalCorrection

- Classification: `FAIL_EXPECTED_CURRENT_BUG`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/LowRcsAuthority_TerminalCorrection.csv`
- Final state: `Complete`
- Minimum distance: `11.49976m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=True, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=False, disallowedProfileCount=230`
- Failure summary: final exact target error 11.49976m > 0.75m; safety replans 860 > 0; selected disallowed planner profile 230 time(s); transitions into Accelerate after first brake commit 1 > 0; brake/flip/terminal to Accelerate transitions 229 > 0

### NoRcsAuthority_Negative_NoFalseComplete

- Classification: `PASS`
- CSV: `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/performance/NoRcsAuthority_Negative_NoFalseComplete.csv`
- Final state: `Failed`
- Minimum distance: `140m`
- Maximum distance after first entering 2m: `0m`
- Obstacle evidence: `sawAvoidance=False, sawReacquire=False, sawDirectAfterAvoidance=False, minimumObstacleClearance=Infinitym`
- Planner profiles: `selectedProfileAllowed=True, disallowedProfileCount=0`
- Failure summary: negative scenario did not false-complete

