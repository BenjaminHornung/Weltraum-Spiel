# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 17.4659 | 0.2190 | 79.75x |
| Phase3.TargetScoring | 262144 | 262144 | 68.1544 | 0.6337 | 107.55x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 193.4290 | 0.2370 | 816.16x |
| Phase5.SensorFiltering | 262144 | 262144 | 62.7147 | 0.2201 | 284.94x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 64.3160 | 0.5918 | 108.68x |

- Aggregate scalar median: 406.0800 ms
- Aggregate job median: 1.9016 ms
- Aggregate speedup: 213.55x
