# Browser Autopilot Proving Ground Specification

## Capability

Browser autopilot proving ground v2 provides deterministic, evidence-friendly browser scenarios for validating course selection, speed profile semantics, obstacle/terminal behavior, and scenario classification after terminal capture v1.

## Requirements

### Course Catalog

- The browser proving ground MUST expose a named course catalog with stable course IDs.
- Catalog entries MUST be additive and MUST NOT remove existing terminal capture v1 scenarios.
- Catalog entries SHOULD include enough metadata for tests and evidence to identify the selected course, target, arrival envelope, expected stress level, and relevant obstacles.
- The catalog MUST preserve GLBLoaded/procedural fallback/TestBridge query gating.

### Speed Profile Semantics

- The browser proving ground MUST support `Safe`, `Balanced`, and `Fast` speed profiles.
- Speed profiles MAY change non-terminal segment `desiredSpeed` and brake margin.
- Speed profiles MUST NOT weaken terminal arrival gates.
- `terminalSpeed` and `StopWithinEnvelope` MUST remain hard gates for capture/holding and scenario pass criteria.

### Terminal Capture and Executor Invariants

- The executor MUST NOT claim arrival by snapping position.
- The executor MUST NOT claim arrival through a velocity-zero shortcut.
- The executor MUST NOT silently replan a locked route.
- Equivalent planning inputs MUST produce a stable deterministic `planHash`.
- HUD snapshot/ViewModel consumer behavior MUST remain the browser UI contract.

### Scenario Metrics

- Scenario output MUST include course ID, selected speed profile, final status/classification, terminal envelope result, obstacle clearance when obstacles are present, and `planHash`.
- Obstacle clearance MUST be computed as distance from the ship/segment to the obstacle center minus obstacle radius and padding, or from the closest sampled ship position minus obstacle safety radius when only sampled runtime positions are available.
- Metrics SHOULD be suitable for direct unit and Playwright/TestBridge assertions.

### Scenario Classification

- Scenario classification MUST distinguish nominal successful runs from hard failures.
- Scenario classification MUST support `KnownStress` for documented planner limits.
- `KnownStress` MUST be used when the scenario intentionally exposes current limitations, including the current planner's one-blocking-obstacle handling limit.
- `KnownStress` MUST NOT hide regressions in terminal capture hard gates.

### E2E and Evidence

- Browser E2E evidence MUST record course ID, profile, classification, terminal envelope result, obstacle clearance where applicable, and `planHash` stability.
- Evidence MUST explicitly state which verification commands were run and which were not run.
- Evidence MUST remain browser-only for this change.

## Non-Functional Constraints

- No Unity work.
- No `Assets/**` changes.
- No render smoothing, jitter, VFX, or nozzle work.
- No Cargo, Surface, Economy, or unrelated simulation features.
- Preserve terminal capture v1 behavior and its evidence trail.
