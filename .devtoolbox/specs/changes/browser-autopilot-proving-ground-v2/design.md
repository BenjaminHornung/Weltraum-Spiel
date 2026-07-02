# Browser Autopilot Proving Ground v2 Design

## Approach

The change is additive. Existing terminal capture behavior remains the safety baseline, and the proving ground gains a named catalog of browser courses, speed profiles, run metrics, and evidence classifications.

## Course Catalog

- Courses are introduced as catalog entries instead of hard-coded one-off test routes.
- Each course should define stable IDs, start/target data, arrival envelope, optional obstacles, expected classification, and evidence labels.
- Existing courses remain compatible; new catalog entries should not change GLBLoaded/procedural fallback/TestBridge query gating.

## Speed Profiles

Profiles are limited to non-terminal route shaping:

- `Safe`
- `Balanced`
- `Fast`

`Safe`, `Balanced`, and `Fast` may affect non-terminal segment `desiredSpeed` and brake margin only. They must not weaken terminal safety. `terminalSpeed` and `StopWithinEnvelope` remain hard gates for final capture/holding and E2E assertions.

## Terminal Capture Invariants

The implementation must preserve terminal capture v1:

- no position snap to claim arrival;
- no velocity zero shortcut;
- no silent replan in the executor;
- stable deterministic `planHash`;
- HUD snapshot/ViewModel consumer behavior remains the UI contract.

## Planner Limit Documentation

The current planner handles one blocking obstacle. v2 should expose this honestly through scenario classification instead of pretending all stress cases are solved. `KnownStress` documents cases that are valuable evidence but outside the current planner's full capability, such as multiple blocking obstacles or catalog cases that intentionally demonstrate a limit.

## Scenario Metrics and Classification

Runs should capture metrics that can be asserted in unit/E2E tests and copied into evidence:

- terminal arrival status and terminal speed envelope result;
- route completion state;
- obstacle clearance;
- selected profile and course ID;
- deterministic `planHash`;
- scenario classification such as nominal pass, hard failure, or `KnownStress`.

Obstacle clearance must be computed from the relevant geometry, not from arbitrary visual distance. The minimum obstacle clearance formula is the distance from the ship/segment to the obstacle center minus obstacle radius and padding, or the closest sampled ship position minus the obstacle safety radius when only sampled runtime positions are available.

## Deterministic Plan Hash

`planHash` must be deterministic for equivalent course/profile/planner inputs. Evidence and tests should fail if repeated planning of the same inputs produces different hashes.

## Evidence Strategy

Evidence is browser-only. Planned evidence should include Playwright/TestBridge output, scenario metric summaries, and markdown records under `apps/weltraum-browser/evidence/`. Unity validation is out of scope for this change.
