# Design: Job-System Runtime Phases v2

## Verified Unity Documentation

- `E:\Unity\Documentation\en\Manual\job-system-overview.html`: Unity jobs use worker threads to use available CPU cores; Burst is recommended for improved code generation and performance.
- `E:\Unity\Documentation\en\Manual\job-system-thread-safe-types.html`: Burst jobs require unmanaged/blittable data or `NativeContainer` types.
- `E:\Unity\Documentation\en\Manual\job-system-native-container.html`: `NativeArray` is the core unmanaged data container; `[ReadOnly]` enables parallel reads; `TempJob` allocations must be disposed quickly.
- `E:\Unity\Documentation\en\ScriptReference\Unity.Jobs.IJobFor.html`: `IJobFor.ScheduleParallel` distributes independent iterations across worker threads; indices have no guaranteed order.
- `E:\Unity\Documentation\en\ScriptReference\Unity.Profiling.ProfilerRecorder.html`: `ProfilerRecorder` records profiler counters and timing data for Editor and Player evidence.
- `E:\Unity\Documentation\en\ScriptReference\RaycastCommand.html`: batched raycasts can run asynchronously and in parallel, but results must not be read until completion.

## Architecture

The implementation keeps the v1 boundary:

- Main thread builds `ProjectileData`, `TargetData`, `TrajectoryCandidateData`, `SensorContactData`, and `RcsNozzleData` snapshots.
- Jobs consume only value structs in `NativeArray` buffers.
- Jobs write value-result structs.
- Main thread applies results to `Transform`, `Rigidbody`, VFX, UI, and gameplay objects.

## Phase Implementation Plan

### Phase 2: Projectile integration

Integrate position, previous position, age, and alive status for many projectiles in parallel. Hits and Unity physics remain in the main-thread apply/finalization path until a later batched `RaycastCommand`/shape-query pass is implemented.

### Phase 3: Target scoring

Compute per-target distance, angle alignment, health fraction, lead estimate, and priority scores from target snapshots. The weapon computer can use this output to choose targets without per-target hierarchy discovery.

### Phase 4: Trajectory candidates

Evaluate independent trajectory candidates with simple forward integration, fuel estimate, target distance, and obstacle-risk scoring. Candidate selection remains a deterministic main-thread reduction.

### Phase 5: Sensor/minimap filtering

Filter contacts by range/FOV and compute display priority, normalized direction, and squared distance in parallel. UI drawing remains on the main thread.

### Phase 6: RCS allocator math

Compute independent nozzle contribution scores and recommended throttle per nozzle from cached nozzle vectors. Final fuel use, spool state, `AddForce`, and VFX application remain on the main thread.

## Measurement Strategy

Benchmarks use deterministic synthetic workloads large enough to expose parallel speedups:

- Projectile integration: tens of thousands of projectiles.
- Target scoring: tens of thousands of targets.
- Trajectory candidates: thousands of candidate trajectories with multiple steps each.
- Sensor filtering: tens of thousands of contacts.
- RCS scoring: repeated batches of many cached nozzles.

Each benchmark performs warmup, scalar timing, job timing, parity checks, and writes CSV/Markdown artifacts under:

`.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/performance/`

## Measured Results

Unity EditMode benchmark run `a9e190b318fd40cab43e485b3fa44db6` completed 7/7 tests. Median timings after warmup:

| Phase | Items | Work units | Scalar median | Job median | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase 2 Projectile integration | 262144 | 262144 | 17.1319 ms | 0.5585 ms | 30.67x |
| Phase 3 Target scoring | 262144 | 262144 | 68.5922 ms | 0.5424 ms | 126.46x |
| Phase 4 Trajectory evaluation | 32768 | 3145728 | 187.8394 ms | 0.6808 ms | 275.91x |
| Phase 5 Sensor filtering | 262144 | 262144 | 59.1424 ms | 0.5196 ms | 113.82x |
| Phase 6 RCS nozzle scoring | 262144 | 262144 | 65.7580 ms | 1.0481 ms | 62.74x |

Aggregate scalar median was 398.4639 ms. Aggregate job median was 3.3494 ms, for a 118.97x data-kernel speedup.

## Safety Rules

- Job structs must not contain `Transform`, `GameObject`, `Renderer`, `Rigidbody`, `Component`, `Collider`, or `string`.
- Job implementation source must not call `GetComponent`, `GetComponentsInChildren`, `FindObjectsByType`, `Instantiate`, `Destroy`, or direct `Physics.*` APIs.
- `RaycastCommand` is allowed only as a future data-prepared batched physics path; this change does not introduce gameplay hit finalization in jobs.
