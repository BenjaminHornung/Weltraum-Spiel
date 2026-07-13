# Performance Job-System Runtime Phases

This document records the v2 implementation that follows the v1 runtime architecture: extract data from MonoBehaviours on the main thread, run math over contiguous value buffers, then apply results back to Unity objects on the main thread.

## Implemented Runtime Job Layer

- `PrototypeRuntimeJobSystems` contains Burst-annotated `IJobFor` jobs and scalar reference paths.
- `PrototypeRuntimeDataSnapshots` now includes result structs for projectile integration, target scoring, trajectory evaluation, sensor filtering, and RCS nozzle scoring.
- Jobs consume and write `NativeArray<T>` value data only.
- Main-thread-only APIs remain outside jobs: no `Transform`, `GameObject`, `Renderer`, `Rigidbody`, hierarchy scans, instantiate/destroy, or direct physics calls inside the job layer.

## Phase Coverage

| Phase | Implemented data job | Main-thread boundary |
| --- | --- | --- |
| Phase 2 | Projectile position/age/alive integration | Hit finalization, damage, physics queries, visuals |
| Phase 3 | Target distance/FOV/health/lead scoring | Registry snapshot creation, turret rotation, firing |
| Phase 4 | Candidate trajectory integration and scoring | Course selection and flight-assist request application |
| Phase 5 | Sensor/minimap contact filtering and priority | UI drawing and Unity object reads |
| Phase 6 | RCS nozzle force/torque contribution scoring | Fuel, spool state, VFX, `Rigidbody` force application |

## Measured Data-Kernel Performance

Benchmark artifacts live under `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/performance/`.

| Phase | Items | Work units | Scalar median | Job median | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Projectile integration | 262144 | 262144 | 17.1319 ms | 0.5585 ms | 30.67x |
| Target scoring | 262144 | 262144 | 68.5922 ms | 0.5424 ms | 126.46x |
| Trajectory evaluation | 32768 | 3145728 | 187.8394 ms | 0.6808 ms | 275.91x |
| Sensor filtering | 262144 | 262144 | 59.1424 ms | 0.5196 ms | 113.82x |
| RCS nozzle scoring | 262144 | 262144 | 65.7580 ms | 1.0481 ms | 62.74x |

Aggregate scalar median was 398.4639 ms. Aggregate job median was 3.3494 ms, giving a 118.97x speedup for the isolated data kernels.

These numbers are kernel benchmarks, not a whole-frame gameplay claim. Whole-frame gains arrive as gameplay systems feed persistent or pooled arrays into these jobs without per-frame allocation and keep Unity object reads/writes at the apply boundary.

## Verification

- Targeted Unity EditMode job suite: 7/7 passed.
- Full Unity EditMode suite after follow-up fixes: 194/194 passed.
- `dotnet build "Weltraum Spiel.sln"` passed with existing warnings and 0 errors.
- `dotnet test "Weltraum Spiel.sln" --no-build` exited 0.
- OpenSpec change validates when mirrored into the upstream CLI's expected `openspec/changes` layout.
- Screenshots and profiler raw capture are stored under `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/`.
