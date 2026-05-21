# Test Protocol: Job-System Runtime Phases v2

## Artifact Paths

- Logs: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/logs/`
- Screenshots: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/screenshots/`
- Performance: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/performance/`

## Initial Evidence

- Unity MCP connected to `Weltraum Spiel@49c909b3e97ba6e8`.
- Stale console error for `PrototypeIgnoreCameraBounds` was resolved by importing affected scripts and forcing script compilation.
- Unity console returned zero errors/warnings after refresh.
- Local Unity docs were read for Job System, NativeContainer, `IJobFor`, `ProfilerRecorder`, and `RaycastCommand`.

## Baseline Hotpath Summary

- Projectile runtime already uses `PrototypeProjectileSimulation` and pooled visuals; the expensive part that can move to jobs is data-only position/age integration and candidate math. Main-thread hit finalization remains on Unity physics queries.
- Weapon targeting already has a target snapshot/registry path; the sortable scoring work can run over `TargetData` without scene lookups.
- Autopilot trajectory planning is a scalar candidate loop today; candidate evaluation is independent and fits `IJobFor` once obstacle samples are prepared as data.
- Minimap/sensor preparation is a data filtering/ranking problem after positions are snapped on the main thread.
- RCS nozzle discovery is cached from v1; Phase 6 only prepares per-nozzle contribution scores. Actual `Rigidbody` force application stays in `FixedUpdate` on the main thread.

## Build Evidence

- Unity MCP import: `PrototypeRuntimeJobSystems.cs` and `PrototypeRuntimeDataSnapshots.cs` imported successfully.
- Unity MCP script validation: 0 diagnostics for both runtime files.
- `dotnet build "Weltraum Spiel.sln"`: passed with 24 existing warnings and 0 errors.

## Planned Verification

- Targeted Unity EditMode tests:
  - `PrototypeRuntimeJobSystemValidationTests`
  - `PrototypeRuntimeJobSystemPerformanceTests`
- Full Unity EditMode suite if time and editor stability allow.
- `dotnet build "Weltraum Spiel.sln"`.
- `dotnet test "Weltraum Spiel.sln" --no-build`.
- Source guards for job boundary violations.
- Profiler/counter capture through Unity MCP.
- Scene/GameView screenshot through Unity MCP.
