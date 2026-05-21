# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 18.0224 | 0.3799 | 47.44x |
| Phase3.TargetScoring | 262144 | 262144 | 68.5353 | 0.5972 | 114.76x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 186.5038 | 0.3522 | 529.54x |
| Phase5.SensorFiltering | 262144 | 262144 | 60.1373 | 0.2743 | 219.24x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 66.6190 | 0.5908 | 112.76x |

- Aggregate scalar median: 399.8178 ms
- Aggregate job median: 2.1944 ms
- Aggregate speedup: 182.20x
