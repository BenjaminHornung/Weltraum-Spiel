# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 15.2128 | 0.2534 | 60.03x |
| Phase3.TargetScoring | 262144 | 262144 | 69.0818 | 0.5796 | 119.19x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 186.1837 | 0.3152 | 590.68x |
| Phase5.SensorFiltering | 262144 | 262144 | 58.7284 | 0.2633 | 223.05x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 64.7191 | 0.4670 | 138.58x |

- Aggregate scalar median: 393.9258 ms
- Aggregate job median: 1.8785 ms
- Aggregate speedup: 209.70x
