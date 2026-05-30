# Runtime Job Benchmark

- Measured from Unity EditMode on the same prepared NativeArray data.
- Times are median milliseconds after two warmup runs.
- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.

| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase2.ProjectileIntegration | 262144 | 262144 | 17.0589 | 0.3231 | 52.80x |
| Phase3.TargetScoring | 262144 | 262144 | 69.5148 | 0.4743 | 146.56x |
| Phase4.TrajectoryEvaluation | 32768 | 3145728 | 185.5860 | 0.3534 | 525.14x |
| Phase5.SensorFiltering | 262144 | 262144 | 59.4778 | 0.3035 | 195.97x |
| Phase6.RcsNozzleScoring | 262144 | 262144 | 64.0925 | 0.5386 | 119.00x |

- Aggregate scalar median: 395.7300 ms
- Aggregate job median: 1.9929 ms
- Aggregate speedup: 198.57x
