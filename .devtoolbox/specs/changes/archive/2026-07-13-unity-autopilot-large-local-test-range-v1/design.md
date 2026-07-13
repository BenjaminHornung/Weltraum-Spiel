# Design: Autopilot Large Local Test Range v1

## Status

Draft only. This change must not modify runtime code, tests, scenes, assets, or current autopilot harness files.

## Chosen Shape

The future range should be a separate deterministic PlayMode-style range, built programmatically like the existing proving-ground pattern but isolated from `autopilot-proving-ground-harness-v1`. The existing harness remains the short-range exact-arrival authority; this range extends coverage after that authority is green.

## Reuse Strategy

Reuse concepts, not files, during this draft:

- deterministic programmatic setup
- fixed scenario definitions
- per-step metrics
- suite-level summaries
- markdown evidence

Future implementation may extract shared utilities only in its own change, after the exact-arrival prerequisite passes and after the current harness is protected by tests.

## Scenario Groups

The future matrix should include these groups at minimum:

| Group | Purpose |
| --- | --- |
| 1km direct | Prove exact arrival remains stable beyond the current short and medium cases. |
| 5km direct | Expose planner timing, speed shaping, and terminal capture drift at mid-scale local distance. |
| 10km direct | Probe local coordinate precision, UI unit formatting, and long-run phase stability. |
| Lateral starts | Start off-axis with lateral velocity and verify the ship removes sideways motion before final hold. |
| Obstacle corridors | Force deterministic avoid/reacquire behavior without turning this into orbital pathfinding. |
| Return-to-origin | Navigate away, then back to the local origin without accumulating offset or residual velocity. |
| Floating Origin readiness | Measure local coordinate magnitude and origin-shift assumptions without implementing origin shifts. |
| UI readability | Verify kilometer-range labels and planner/radar readouts remain readable at common viewport sizes. |

## Determinism

The future range should use fixed scenario data, explicit seeds only when randomness is unavoidable, stable physics-step sampling, and programmatic object construction. Scenario names, starting state, target positions, obstacle positions, authority settings, and expected gates should be part of the scenario definition.

## Metrics And Evidence

Each scenario should record:

- exact target distance and minimum distance reached
- final relative speed, lateral speed, closing speed, and angular speed
- autopilot state, navigation phase, flight-plan phase, and active segment
- requested main throttle, requested RCS force, and authority limits
- obstacle detection, avoid, reacquire, and direct-after-reacquire status
- distance from local origin and maximum local coordinate magnitude
- return-to-origin offset and residual velocity when applicable
- UI distance text, unit formatting, overlap/readability result, and screenshot reference when applicable

The suite should produce per-scenario CSV traces, one summary JSON file, and one markdown protocol under the future change's `tests/` folder.

## Floating Origin Readiness

The range should not implement Floating Origin behavior. It should instead reveal whether the autopilot and UI can tolerate local-space distances that approach a future shift threshold. Readiness evidence should call out:

- maximum local coordinate magnitude
- any precision-sensitive arrival drift
- any assumption that target, ship, obstacle, camera, or UI data must eventually split absolute and local state
- whether a future origin shift would need scenario reset hooks, metrics translation, or UI label changes

## UI Readability

UI checks should focus on existing player-facing readouts used during autopilot navigation. The future range should verify that kilometer-scale distances format consistently, remain legible, and do not overlap critical planner, radar, target, or arrival-status text. These checks should use existing UI surfaces and should not create a new map or visual asset.

## Tradeoffs

- A 10km local-space run can be slow, so the future implementation should separate fast smoke scenarios from full acceptance scenarios.
- Local-space 10km coverage is useful for precision and UX checks, but it is not proof of a large-world architecture.
- Keeping this range separate avoids destabilizing the current exact-arrival harness while exact arrival is still being fixed.

## Verification Boundary

For this spec-only change, verification is `specs_validate autopilot-large-local-test-range-v1` only. No Unity tests should be run for this draft.
