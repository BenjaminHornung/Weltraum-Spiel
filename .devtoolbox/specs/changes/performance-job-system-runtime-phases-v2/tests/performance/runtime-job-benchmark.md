# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 18.3250 | 0.5700 | 32.15x |
| Phase3.TargetScoring | 262144 | 262144 | 68.3616 | 0.9409 | 72.66x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 182.8032 | 0.5528 | 330.69x |
| Phase5.SensorFiltering | 262144 | 262144 | 59.4725 | 0.5059 | 117.56x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 64.4738 | 0.7473 | 86.28x |

- Aggregate scalar median: 393.4361 ms
- Aggregate job median: 3.3169 ms
- Aggregate speedup: 118.62x
