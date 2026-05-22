# Test Protocol: Job-System Runtime Phases v2

## Artifact Paths

- Logs: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/logs/`
- Screenshots: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/screenshots/`
- Performance: `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2/tests/performance/`

## Initial Evidence

- Unity MCP connected to `Weltraum Spiel@49c909b3e97ba6e8`.
- Stale console error for `PrototypeIgnoreCameraBounds` was resolved by importing affected scripts and forcing script compilation.
- Unity console returned zero compile errors after refresh; one MCP transport warning is present and unrelated to project code.
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

## Runtime Job Benchmark Evidence

- Targeted Unity EditMode job `a9e190b318fd40cab43e485b3fa44db6`: 7/7 passed, 0 failed, duration 4.8973114 s.
- Profiler raw capture: `tests/logs/runtime-job-tests.profiler.raw` (26,609,234 bytes).
- Benchmark CSV: `tests/performance/runtime-job-benchmark.csv`.
- Benchmark Markdown: `tests/performance/runtime-job-benchmark.md`.

| Phase | Items | Work units | Scalar median | Job median | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 17.1319 ms | 0.5585 ms | 30.67x |
| Phase3.TargetScoring | 262144 | 262144 | 68.5922 ms | 0.5424 ms | 126.46x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 187.8394 ms | 0.6808 ms | 275.91x |
| Phase5.SensorFiltering | 262144 | 262144 | 59.1424 ms | 0.5196 ms | 113.82x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 65.7580 ms | 1.0481 ms | 62.74x |

- Aggregate scalar median: 398.4639 ms.
- Aggregate job median: 3.3494 ms.
- Aggregate data-kernel speedup: 118.97x.

## Regression and Fix Evidence

- First full Unity EditMode run `5686291877f64bc3a8800c60b9f598aa`: 192/194 passed, 2 failed.
- Fixed `PrototypeSimpleFollowCameraValidationTests.VisualBoundsAnchorFollowsMovingTarget` by snapping camera interpolation when editor-invoked `Time.deltaTime` is zero, so cached local visual bounds follow moved targets during deterministic tests.
- Fixed `PrototypeTestEnvironmentValidationTests.Rebuild_MarksAsteroidsAsNavigationObstacles` by preserving generated asteroid labels on `PrototypeNavigationObstacle`.
- Focused rerun `75f41a112007442e810182476eb8940c`: 2/2 passed.
- Full Unity EditMode rerun `444d2813143d4594b55c8c7c6e34eea9`: 194/194 passed, 0 failed, duration 7.243295 s.

## Screenshot and Profiler Evidence

- Scene View screenshot: `tests/screenshots/unity-scene-view-runtime-job-evidence.png` (292,705 bytes).
- Game View screenshot: `tests/screenshots/unity-game-view-runtime-job-evidence.png` (108,633 bytes).
- Unity MCP frame timing after capture: available, CPU frame time 100.3451 ms, main thread sample 0.0007 ms.
- Rendering stats snapshot after capture: 37 render textures, 162,560,174 render texture bytes, no active draw calls in idle editor view.

## CLI Verification Evidence

- `dotnet build "Weltraum Spiel.sln"`: passed with 24 existing warnings and 0 errors after the job tests and follow-up fixes.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exit code 0, no test output emitted by the generated Unity solution.
- `npx --yes openspec validate performance-job-system-runtime-phases-v2 --type change --json --no-interactive` against the repository root failed because the upstream OpenSpec CLI expects `openspec/changes`, while this project stores changes under `.devtoolbox/specs/changes`.
- The same change mirrored into a temporary OpenSpec-compatible `openspec/changes` layout validated successfully: 1/1 valid, 0 issues.
- Final console check after clearing test-runner result logs and requesting script compilation: 0 compile errors; one unrelated MCP transport warning remains.

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
