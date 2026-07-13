# Tasks

- [ ] 1. Define obstacle metadata and spec evidence
  - Add `PrototypeNavigationObstacle` with label, clearance radius, danger radius, and helper accessors.
  - Mark or generate test-environment obstacles without turning visual-only markers into global hot-path searches.
  - Verify specs validate after capability artifacts are present.

- [ ] 2. Implement autopilot obstacle detection and diagnostics
  - Add `ObstacleAvoidance` state/phase and cached diagnostics.
  - Add reusable non-alloc cast buffer, configurable mask/radius/length/cadence, own-ship/projectile/trigger filtering, and nearest valid obstacle selection.
  - Verify detection inside/outside corridor and ignored hit cases with EditMode tests.

- [ ] 3. Implement physical avoidance control and recovery/failure behavior
  - Integrate corridor checks before burn/brake/final-approach requests in `RunAutopilotStep()`.
  - Request RCS translation/attitude/main-throttle changes only through `FlightAssistRequest` and existing controller paths.
  - Add hysteresis, clear-time return, and `ObstacleBlocked`/`NoAvoidanceAuthority` failure reasons.
  - Verify state transition, throttle suppression, force request, failure, recovery, and no Rigidbody velocity-write tests.

- [ ] 4. Update docs, test evidence, and manual regression notes
  - Update README/docs for v1 local reactive obstacle avoidance and known limits.
  - Add `.devtoolbox/specs/changes/add-autopilot-obstacle-avoidance-v1/tests/test-protocol.md` with Unity/dotnet/manual verification notes.
  - Run Unity EditMode tests, dotnet build/test for `Weltraum Spiel.sln`, specs validation, and optional Unity profiler sanity check when available.
