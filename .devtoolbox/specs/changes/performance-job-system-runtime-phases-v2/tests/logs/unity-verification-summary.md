# Unity Verification Summary

## Targeted Job Suite

- Job id: `a9e190b318fd40cab43e485b3fa44db6`
- Result: 7 passed / 0 failed / 0 skipped
- Duration: 4.8973114 s
- Profiler raw capture: `runtime-job-tests.profiler.raw`

## Benchmark Median Results

| Phase | Scalar ms | Job ms | Speedup |
| --- | ---: | ---: | ---: |
| Projectile integration | 17.1319 | 0.5585 | 30.67x |
| Target scoring | 68.5922 | 0.5424 | 126.46x |
| Trajectory evaluation | 187.8394 | 0.6808 | 275.91x |
| Sensor filtering | 59.1424 | 0.5196 | 113.82x |
| RCS nozzle scoring | 65.7580 | 1.0481 | 62.74x |

Aggregate scalar median: 398.4639 ms.
Aggregate job median: 3.3494 ms.
Aggregate speedup: 118.97x.

## Full EditMode Suite

- Initial full run: `5686291877f64bc3a8800c60b9f598aa`, 192/194 passed, 2 failures.
- Focused rerun after fixes: `75f41a112007442e810182476eb8940c`, 2/2 passed.
- Final full run: `444d2813143d4594b55c8c7c6e34eea9`, 194/194 passed, 0 failed, duration 7.243295 s.

## Other Checks

- Unity script validation for runtime job files: 0 diagnostics.
- Unity console after clearing test-runner result logs and final script refresh: 0 compile errors; one unrelated MCP transport warning.
- `dotnet build "Weltraum Spiel.sln"`: passed with 24 existing warnings and 0 errors.
- `dotnet test "Weltraum Spiel.sln" --no-build`: exit code 0.
- OpenSpec validation: passed in temporary `openspec/changes` mirror of `.devtoolbox/specs/changes/performance-job-system-runtime-phases-v2`.
