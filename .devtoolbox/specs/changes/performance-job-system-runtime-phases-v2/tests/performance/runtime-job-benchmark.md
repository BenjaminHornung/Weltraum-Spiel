# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 21.5620 | 0.2601 | 82.90x |
| Phase3.TargetScoring | 262144 | 262144 | 69.3738 | 0.6773 | 102.43x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 186.6839 | 0.3930 | 475.02x |
| Phase5.SensorFiltering | 262144 | 262144 | 61.9925 | 0.2169 | 285.81x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 63.5789 | 0.4086 | 155.60x |

- Aggregate scalar median: 403.1911 ms
- Aggregate job median: 1.9559 ms
- Aggregate speedup: 206.14x
