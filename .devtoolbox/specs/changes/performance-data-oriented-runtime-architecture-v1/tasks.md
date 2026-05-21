# Tasks: performance-data-oriented-runtime-architecture-v1

## Spec

- [x] 1. Add change folder scaffold at `.devtoolbox/specs/changes/performance-data-oriented-runtime-architecture-v1`.
- [x] 2. Author `proposal.md` with scope, goals, non-goals, and measurable acceptance criteria.
- [x] 3. Author `design.md` with hotpath analysis, main-thread/job-thread rules, data model definitions, and migration phasing.
- [x] 4. Add capability spec `runtime-data-snapshots`.
- [x] 5. Add capability spec `projectile-simulation-data-model`.
- [x] 6. Add capability spec `target-registry-data-model`.
- [x] 7. Add capability spec `camera-rcs-cache-dirty-flags`.
- [x] 8. Add capability spec `job-system-readiness`.
- [x] 9. Add capability spec `main-thread-apply-boundaries`.
- [x] 10. Add `tests/test-protocol.md` and record initial validation constraints.

## Implementation

- [x] 1. Add value-only runtime snapshot models for `ProjectileData`, `TargetData`, `ShipRuntimeState`, `RcsNozzleData`, `TrajectoryCandidateData`, `SensorContactData`, and `CameraVisualBoundsData`.
- [x] 2. Expose camera visual-bounds snapshot and cache diagnostics without adding steady-state hierarchy scans.
- [x] 3. Expose RCS nozzle snapshot and cache diagnostics without adding steady-state hierarchy scans.
- [x] 4. Expose projectile manager snapshot data from the existing pooled/manager path.
- [x] 5. Expose target registry snapshot data from registered targets without enabling debug fallback discovery by default.
- [x] 6. Preserve main-thread apply behavior for Rigidbody, Transform, GameObject, Renderer, UI, and VFX writes.

## Tests

- [x] 1. Add/extend camera dirty-flag and visual-bounds snapshot tests.
- [x] 2. Add/extend RCS nozzle cache/snapshot stability tests.
- [x] 3. Add/extend projectile and target registry snapshot tests.
- [x] 4. Add source-guard coverage for simulation/job-boundary Unity API rules where runtime observation is not practical.

## Documentation

- [x] 1. Add `docs/performance-runtime-architecture.md`.
- [x] 2. Document the current hotpath analysis and which parts must remain on the main thread.
- [x] 3. Document the phased Job System/Burst migration plan and performance budget.
- [x] 4. Record local Unity documentation references used for Job System and Unity API constraints.

## Verification

- [x] 1. Run safe local structure validation for required change files and spec scenarios.
- [x] 2. Record that `npx --yes openspec validate ...` was blocked by the security reviewer because it would download and execute unpinned npm code.
- [x] 3. Run focused compile/test validation available without a Unity Editor session.
- [x] 4. Retry Unity MCP editor validation if a Unity session reconnects.
- [x] 5. Update `tests/test-protocol.md` with executed commands and results.
- [x] 6. Run final review for thread-boundary violations, new hierarchy scans, and missing tests.

## Closeout

- [ ] 1. Commit completed slices with clear messages.
- [ ] 2. Push `main` to `origin/main`.
