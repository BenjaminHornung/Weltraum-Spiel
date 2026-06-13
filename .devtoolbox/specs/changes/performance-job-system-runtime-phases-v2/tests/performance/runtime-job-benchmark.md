# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 18.7610 | 0.3575 | 52.48x |
| Phase3.TargetScoring | 262144 | 262144 | 69.9070 | 0.5036 | 138.81x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 182.0464 | 0.5996 | 303.61x |
| Phase5.SensorFiltering | 262144 | 262144 | 59.1370 | 0.2666 | 221.82x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 62.8830 | 0.5323 | 118.13x |

- Aggregate scalar median: 392.7344 ms
- Aggregate job median: 2.2596 ms
- Aggregate speedup: 173.81x
