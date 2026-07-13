# Task 16 Execution Evidence

## Scope

- Phase 6: tests and evidence for autopilot plan execution fidelity.
- Added/updated EditMode coverage for turn timing, spool-aware predicted samples, DFT tolerance scaling, and existing DFT/navigation hardening cases.
- Added PlayMode DFT fidelity coverage for a distant waypoint: one `FlipToRetrograde` entry, zero forced safety replans, arrival within radius/speed, and duration within the plan window.
- Tightened DFT terminal hold capture so strict DFT handoff uses the plan target arrival speed instead of the looser generic arrival completion multiplier.
- Preserved safety behavior for non-nominal expiry/reacquire cases: far expired DFT plans still force a visible `PlanExpired` replan, while brake-committed DFT terminal ownership can reacquire without falling into the legacy brake loop.

## Evidence

- CSV: `tests/performance/distant-waypoint-plan-execution-regression.csv`
- Screenshot: `tests/screenshots/task16-unity-editor-after-fidelity-tests-1.png`
- Build log: `tests/task16-dotnet-build.log` (ignored by git via `*.log`, kept locally)
- Validation protocol: `tests/task16-unity-validation.md`

## CSV Summary

- Rows: 1562
- First `FlipToRetrograde`: step 570, planElapsed 11.44007.
- First `RetrogradeBurn`: step 877, planElapsed 17.58021.
- Final row: step 1561, time 31.21998, planElapsed 31.26052, phase `Hold`, state `HoldPosition`, distance 6.450788, relativeSpeed 0.385079.
- Plan duration window: total 29.62516, expected min 25.18139, expected max 34.06894.
- Max `flightPlanSafetyReplanCount`: 0
- Rows with `flightPlanRequiresReplan=True`: 0

## Decisions

- The first predicted sample in a spool-ramped segment is expected to occur after the segment start, so the endpoint test validates that samples stay within segment bounds and that the final sample matches the segment end position/velocity.
- Brake-flip timing constants now live in `PrototypeFlightPlanExecutionConfig`; the new EditMode test invokes `EstimateBrakeFlipSegmentSeconds` directly so the runtime-scale and latch-settling model is covered.
- `PlanExpired` now clears stale actuator output only when it actually forces a safety replan; brake-committed DFT terminal ownership remains eligible for the reacquire path.
- DFT terminal hold speed is capped by `targetArrivalSpeedMetersPerSecond * 1.5`, matching the PlayMode acceptance criterion.
- The PlayMode regression now samples 120 frames after first `HoldPosition` unless `Complete` is reached first, so evidence covers settling beyond the first radius entry.
