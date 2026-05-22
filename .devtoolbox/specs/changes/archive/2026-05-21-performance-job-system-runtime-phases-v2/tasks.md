# Tasks: performance-job-system-runtime-phases-v2

## Baseline

- [x] 1. Confirm Unity MCP session and clear stale compile diagnostics.
- [x] 2. Read Unity local documentation for Job System, NativeContainer, `IJobFor`, `ProfilerRecorder`, and `RaycastCommand`.
- [x] 3. Create change folder and test artifact folders.
- [x] 4. Capture baseline code/hotpath summary.

## Implementation

- [x] 1. Add data-only result structs and job-system implementations.
- [x] 2. Implement Phase 2 projectile integration job path.
- [x] 3. Implement Phase 3 target scoring job path.
- [x] 4. Implement Phase 4 trajectory candidate evaluation job path.
- [x] 5. Implement Phase 5 sensor/minimap filtering job path.
- [x] 6. Implement Phase 6 RCS allocator scoring job path.
- [x] 7. Add source guards that jobs do not call Unity hierarchy APIs.

## Measurement

- [x] 1. Add deterministic benchmark harness.
- [x] 2. Write scalar/job timing CSV.
- [x] 3. Write benchmark summary markdown with speedup ratios.
- [x] 4. Capture Unity profiler/counter evidence.
- [x] 5. Capture screenshots proving editor/test scene is alive.

## Verification

- [x] 1. Run targeted Unity EditMode parity/performance tests.
- [x] 2. Run full Unity EditMode suite or record concrete blocker.
- [x] 3. Run `dotnet build "Weltraum Spiel.sln"`.
- [x] 4. Run `dotnet test "Weltraum Spiel.sln" --no-build`.
- [x] 5. Update test protocol with commands, logs, screenshots, and artifacts.
- [x] 6. Review implementation for main-thread/job-thread boundary violations.

## Closeout

- [x] 1. Commit implementation and evidence.
- [x] 2. Push `main` to `origin/main`.
