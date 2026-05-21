# Proposal: Job-System Runtime Phases v2

## Goal

Complete the data-oriented runtime migration phases after `performance-data-oriented-runtime-architecture-v1` by adding measurable Unity Job System/Burst-ready compute paths for projectile integration, target scoring, trajectory candidates, sensor/minimap filtering, and optional RCS allocator math.

## Scope

- Add data-only job systems that operate on structs and `NativeArray` data.
- Keep Unity object reads/writes on the main thread.
- Add parity tests between scalar and job paths.
- Add benchmark evidence with machine-readable performance output.
- Capture Unity test logs, profiler/counter evidence, and screenshots where available.

## Non-goals

- No DOTS/ECS rewrite.
- No direct Unity scene API from worker threads.
- No physics `Rigidbody` writes outside the current main-thread apply path.
- No replacement of gameplay behavior before parity and performance evidence exists.

## Acceptance Criteria

- All planned phases have implemented job-ready data paths.
- Unity EditMode tests pass for parity and boundary guards.
- Performance artifacts show scalar vs job timings and speedup ratios.
- Documentation explains what is now job-backed, what remains main-thread apply, and how to reproduce the measurements.
- The repository builds, tests, commits, and pushes.
