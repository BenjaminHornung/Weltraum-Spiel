# Tasks

## 1. Trace Harness Invariants

- [x] Extend the DirectFastTransfer PlayMode trace with revision, transition, flip-throttle, brake-angle, and terminal-state invariant counters.
- [x] Parameterize soft tracking injection for none, burn, brake, and repeated burn correction scenarios.
- [x] Apply shared nominal DirectFastTransfer invariant assertions to existing DFT PlayMode tests.

## 2. Regression Scenarios

- [x] Add PlayMode coverage for burn-to-brake throttle continuity.
- [x] Add PlayMode coverage for brake-phase soft tracking correction.
- [x] Add PlayMode coverage for consecutive soft tracking corrections.
- [x] Add PlayMode coverage for 135-degree start rotation and initial angular velocity latch delay.

## 3. EditMode Boundaries

- [x] Add soft-reason mix and hard-mix DirectFastTransfer classification assertions.
- [x] Add non-DirectFastTransfer brake timing divergence guard coverage.

## 4. Verification and Review

- [x] Run dotnet build, focused EditMode tests, and focused PlayMode tests.
- [ ] Run reviewer review for missing regression cases and test flakiness.
- [x] Run Z.AI review for missing regression cases and test flakiness.
- [x] Save verification logs and invariant trace evidence under `tests/`.
