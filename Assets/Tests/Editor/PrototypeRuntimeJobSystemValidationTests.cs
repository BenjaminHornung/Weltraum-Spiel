using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Unity.Collections;
using Unity.Jobs;
using UnityEngine;

public sealed class PrototypeRuntimeJobSystemValidationTests
{
    private const float VectorTolerance = 0.0005f;
    private const float ScoreTolerance = 0.01f;
    private const string ChangeRoot = ".devtoolbox/specs/changes/performance-job-system-runtime-phases-v2";

    [Test]
    public void ProjectileIntegrationJobMatchesScalarPath()
    {
        using (var input = new NativeArray<ProjectileData>(32, Allocator.TempJob))
        using (var scalar = new NativeArray<ProjectileIntegrationResultData>(32, Allocator.TempJob))
        using (var job = new NativeArray<ProjectileIntegrationResultData>(32, Allocator.TempJob))
        {
            FillProjectiles(input);

            PrototypeRuntimeJobSystems.RunProjectileIntegrationScalar(input, scalar, 0.0166667f);
            PrototypeRuntimeJobSystems.ScheduleProjectileIntegration(input, job, 0.0166667f).Complete();

            for (int i = 0; i < input.Length; i++)
            {
                Assert.AreEqual(scalar[i].projectileId, job[i].projectileId);
                Assert.AreEqual(scalar[i].snapshotVersion, job[i].snapshotVersion);
                Assert.AreEqual(scalar[i].isAlive, job[i].isAlive);
                AssertApproximately(scalar[i].age, job[i].age);
                AssertVectorApproximately(scalar[i].position, job[i].position);
                AssertVectorApproximately(scalar[i].previousPosition, job[i].previousPosition);
            }
        }
    }

    [Test]
    public void TargetScoringJobMatchesScalarPath()
    {
        using (var input = new NativeArray<TargetData>(48, Allocator.TempJob))
        using (var scalar = new NativeArray<TargetScoreResultData>(48, Allocator.TempJob))
        using (var job = new NativeArray<TargetScoreResultData>(48, Allocator.TempJob))
        {
            FillTargets(input);
            var settings = new TargetScoreSettingsData
            {
                origin = new Vector3(0f, 0f, -35f),
                forward = Vector3.forward,
                maxRange = 500f,
                fieldOfViewCosine = 0.12f,
                projectileSpeed = 360f,
                maxLeadTime = 2.5f,
                priorityMode = 0
            };

            PrototypeRuntimeJobSystems.RunTargetScoringScalar(input, scalar, settings);
            PrototypeRuntimeJobSystems.ScheduleTargetScoring(input, job, settings).Complete();

            for (int i = 0; i < input.Length; i++)
            {
                Assert.AreEqual(scalar[i].targetId, job[i].targetId);
                Assert.AreEqual(scalar[i].snapshotVersion, job[i].snapshotVersion);
                Assert.AreEqual(scalar[i].isValid, job[i].isValid);
                AssertApproximately(scalar[i].distanceSquared, job[i].distanceSquared, ScoreTolerance);
                AssertApproximately(scalar[i].angleCosine, job[i].angleCosine);
                AssertApproximately(scalar[i].healthFraction, job[i].healthFraction);
                AssertApproximately(scalar[i].priorityScore, job[i].priorityScore, ScoreTolerance);
                AssertVectorApproximately(scalar[i].leadPosition, job[i].leadPosition);
            }
        }
    }

    [Test]
    public void TrajectoryEvaluationJobMatchesScalarPath()
    {
        using (var input = new NativeArray<TrajectoryCandidateInputData>(40, Allocator.TempJob))
        using (var scalar = new NativeArray<TrajectoryEvaluationResultData>(40, Allocator.TempJob))
        using (var job = new NativeArray<TrajectoryEvaluationResultData>(40, Allocator.TempJob))
        {
            FillTrajectoryCandidates(input, 48);

            PrototypeRuntimeJobSystems.RunTrajectoryEvaluationScalar(input, scalar);
            PrototypeRuntimeJobSystems.ScheduleTrajectoryEvaluation(input, job).Complete();

            for (int i = 0; i < input.Length; i++)
            {
                Assert.AreEqual(scalar[i].candidateId, job[i].candidateId);
                Assert.AreEqual(scalar[i].snapshotVersion, job[i].snapshotVersion);
                Assert.AreEqual(scalar[i].isValid, job[i].isValid);
                AssertVectorApproximately(scalar[i].finalPosition, job[i].finalPosition);
                AssertVectorApproximately(scalar[i].finalVelocity, job[i].finalVelocity);
                AssertApproximately(scalar[i].targetDistanceSquared, job[i].targetDistanceSquared, ScoreTolerance);
                AssertApproximately(scalar[i].obstacleRisk, job[i].obstacleRisk);
                AssertApproximately(scalar[i].fuelEstimate, job[i].fuelEstimate);
                AssertApproximately(scalar[i].score, job[i].score, ScoreTolerance * 100f);
            }
        }
    }

    [Test]
    public void SensorFilteringJobMatchesScalarPath()
    {
        using (var input = new NativeArray<SensorContactData>(64, Allocator.TempJob))
        using (var scalar = new NativeArray<SensorContactResultData>(64, Allocator.TempJob))
        using (var job = new NativeArray<SensorContactResultData>(64, Allocator.TempJob))
        {
            FillSensorContacts(input);
            var settings = new SensorFilterSettingsData
            {
                origin = Vector3.zero,
                forward = Vector3.forward,
                maxRange = 600f,
                fieldOfViewCosine = -0.2f
            };

            PrototypeRuntimeJobSystems.RunSensorFilteringScalar(input, scalar, settings);
            PrototypeRuntimeJobSystems.ScheduleSensorFiltering(input, job, settings).Complete();

            for (int i = 0; i < input.Length; i++)
            {
                Assert.AreEqual(scalar[i].contactId, job[i].contactId);
                Assert.AreEqual(scalar[i].targetId, job[i].targetId);
                Assert.AreEqual(scalar[i].snapshotVersion, job[i].snapshotVersion);
                Assert.AreEqual(scalar[i].isVisible, job[i].isVisible);
                AssertVectorApproximately(scalar[i].direction, job[i].direction);
                AssertApproximately(scalar[i].distanceSquared, job[i].distanceSquared, ScoreTolerance);
                AssertApproximately(scalar[i].priorityScore, job[i].priorityScore);
            }
        }
    }

    [Test]
    public void RcsNozzleScoringJobMatchesScalarPath()
    {
        using (var input = new NativeArray<RcsNozzleData>(64, Allocator.TempJob))
        using (var scalar = new NativeArray<RcsNozzleAllocationResultData>(64, Allocator.TempJob))
        using (var job = new NativeArray<RcsNozzleAllocationResultData>(64, Allocator.TempJob))
        {
            FillRcsNozzles(input);
            var request = new RcsAllocationRequestData
            {
                desiredForceWorld = new Vector3(4f, 0.5f, 10f),
                desiredTorqueWorld = new Vector3(0.25f, -0.6f, 0.2f),
                centerOfMassWorld = new Vector3(0.1f, -0.05f, 0.2f),
                maxNozzleThrust = 25f,
                forceWeight = 1f,
                torqueWeight = 2.5f
            };

            PrototypeRuntimeJobSystems.RunRcsNozzleScoringScalar(input, scalar, request);
            PrototypeRuntimeJobSystems.ScheduleRcsNozzleScoring(input, job, request).Complete();

            for (int i = 0; i < input.Length; i++)
            {
                Assert.AreEqual(scalar[i].nozzleId, job[i].nozzleId);
                Assert.AreEqual(scalar[i].snapshotVersion, job[i].snapshotVersion);
                Assert.AreEqual(scalar[i].isValid, job[i].isValid);
                AssertVectorApproximately(scalar[i].forceAtRecommendedThrottle, job[i].forceAtRecommendedThrottle);
                AssertVectorApproximately(scalar[i].torqueAtRecommendedThrottle, job[i].torqueAtRecommendedThrottle);
                AssertApproximately(scalar[i].recommendedThrottle, job[i].recommendedThrottle);
                AssertApproximately(scalar[i].contributionScore, job[i].contributionScore);
            }
        }
    }

    [Test]
    public void RuntimeJobSystemsSourceContainsNoUnityObjectHotpathCalls()
    {
        string projectRoot = Directory.GetCurrentDirectory();
        string sourcePath = Path.Combine(projectRoot, "Assets", "Scripts", "Prototype", "PrototypeRuntimeJobSystems.cs");
        string source = File.ReadAllText(sourcePath);
        string[] blocked =
        {
            "Transform",
            "GameObject",
            "Renderer",
            "Rigidbody",
            "Collider",
            "GetComponent",
            "GetComponentsInChildren",
            "FindObjects",
            "Instantiate",
            "Destroy",
            "Physics."
        };

        foreach (string token in blocked)
        {
            Assert.False(source.Contains(token), "Runtime job layer must stay data-only. Blocked token: " + token);
        }
    }

    [Test]
    public void RuntimeJobBenchmarksWriteEvidence()
    {
        var rows = new List<BenchmarkRow>
        {
            MeasureProjectiles(262144, 9),
            MeasureTargets(262144, 9),
            MeasureTrajectories(32768, 7),
            MeasureSensors(262144, 9),
            MeasureRcsNozzles(262144, 9)
        };

        WriteBenchmarkArtifacts(rows);

        double scalarTotal = rows.Sum(row => row.ScalarMedianMs);
        double jobTotal = rows.Sum(row => row.JobMedianMs);
        Assert.Less(jobTotal, scalarTotal, "Aggregate Burst/job median should beat scalar median for benchmark-sized data.");
    }

    private static BenchmarkRow MeasureProjectiles(int count, int repetitions)
    {
        using (var input = new NativeArray<ProjectileData>(count, Allocator.TempJob))
        using (var scalar = new NativeArray<ProjectileIntegrationResultData>(count, Allocator.TempJob))
        using (var job = new NativeArray<ProjectileIntegrationResultData>(count, Allocator.TempJob))
        {
            FillProjectiles(input);
            PrototypeRuntimeJobSystems.RunProjectileIntegrationScalar(input, scalar, 0.0166667f);
            PrototypeRuntimeJobSystems.ScheduleProjectileIntegration(input, job, 0.0166667f).Complete();
            CompareProjectileSamples(scalar, job);

            double scalarMedian = MeasureMedianMs(repetitions, () =>
            {
                PrototypeRuntimeJobSystems.RunProjectileIntegrationScalar(input, scalar, 0.0166667f);
            });
            double jobMedian = MeasureMedianMs(repetitions, () =>
            {
                JobHandle handle = PrototypeRuntimeJobSystems.ScheduleProjectileIntegration(input, job, 0.0166667f);
                handle.Complete();
            });

            return new BenchmarkRow("Phase2.ProjectileIntegration", count, count, scalarMedian, jobMedian);
        }
    }

    private static BenchmarkRow MeasureTargets(int count, int repetitions)
    {
        using (var input = new NativeArray<TargetData>(count, Allocator.TempJob))
        using (var scalar = new NativeArray<TargetScoreResultData>(count, Allocator.TempJob))
        using (var job = new NativeArray<TargetScoreResultData>(count, Allocator.TempJob))
        {
            FillTargets(input);
            var settings = new TargetScoreSettingsData
            {
                origin = new Vector3(0f, 0f, -35f),
                forward = Vector3.forward,
                maxRange = 1000f,
                fieldOfViewCosine = -0.25f,
                projectileSpeed = 420f,
                maxLeadTime = 2.5f,
                priorityMode = 0
            };
            PrototypeRuntimeJobSystems.RunTargetScoringScalar(input, scalar, settings);
            PrototypeRuntimeJobSystems.ScheduleTargetScoring(input, job, settings).Complete();
            CompareTargetSamples(scalar, job);

            double scalarMedian = MeasureMedianMs(repetitions, () =>
            {
                PrototypeRuntimeJobSystems.RunTargetScoringScalar(input, scalar, settings);
            });
            double jobMedian = MeasureMedianMs(repetitions, () =>
            {
                JobHandle handle = PrototypeRuntimeJobSystems.ScheduleTargetScoring(input, job, settings);
                handle.Complete();
            });

            return new BenchmarkRow("Phase3.TargetScoring", count, count, scalarMedian, jobMedian);
        }
    }

    private static BenchmarkRow MeasureTrajectories(int count, int repetitions)
    {
        using (var input = new NativeArray<TrajectoryCandidateInputData>(count, Allocator.TempJob))
        using (var scalar = new NativeArray<TrajectoryEvaluationResultData>(count, Allocator.TempJob))
        using (var job = new NativeArray<TrajectoryEvaluationResultData>(count, Allocator.TempJob))
        {
            FillTrajectoryCandidates(input, 96);
            PrototypeRuntimeJobSystems.RunTrajectoryEvaluationScalar(input, scalar);
            PrototypeRuntimeJobSystems.ScheduleTrajectoryEvaluation(input, job).Complete();
            CompareTrajectorySamples(scalar, job);

            double scalarMedian = MeasureMedianMs(repetitions, () =>
            {
                PrototypeRuntimeJobSystems.RunTrajectoryEvaluationScalar(input, scalar);
            });
            double jobMedian = MeasureMedianMs(repetitions, () =>
            {
                JobHandle handle = PrototypeRuntimeJobSystems.ScheduleTrajectoryEvaluation(input, job);
                handle.Complete();
            });

            return new BenchmarkRow("Phase4.TrajectoryEvaluation", count, count * 96, scalarMedian, jobMedian);
        }
    }

    private static BenchmarkRow MeasureSensors(int count, int repetitions)
    {
        using (var input = new NativeArray<SensorContactData>(count, Allocator.TempJob))
        using (var scalar = new NativeArray<SensorContactResultData>(count, Allocator.TempJob))
        using (var job = new NativeArray<SensorContactResultData>(count, Allocator.TempJob))
        {
            FillSensorContacts(input);
            var settings = new SensorFilterSettingsData
            {
                origin = Vector3.zero,
                forward = Vector3.forward,
                maxRange = 900f,
                fieldOfViewCosine = -0.35f
            };
            PrototypeRuntimeJobSystems.RunSensorFilteringScalar(input, scalar, settings);
            PrototypeRuntimeJobSystems.ScheduleSensorFiltering(input, job, settings).Complete();
            CompareSensorSamples(scalar, job);

            double scalarMedian = MeasureMedianMs(repetitions, () =>
            {
                PrototypeRuntimeJobSystems.RunSensorFilteringScalar(input, scalar, settings);
            });
            double jobMedian = MeasureMedianMs(repetitions, () =>
            {
                JobHandle handle = PrototypeRuntimeJobSystems.ScheduleSensorFiltering(input, job, settings);
                handle.Complete();
            });

            return new BenchmarkRow("Phase5.SensorFiltering", count, count, scalarMedian, jobMedian);
        }
    }

    private static BenchmarkRow MeasureRcsNozzles(int count, int repetitions)
    {
        using (var input = new NativeArray<RcsNozzleData>(count, Allocator.TempJob))
        using (var scalar = new NativeArray<RcsNozzleAllocationResultData>(count, Allocator.TempJob))
        using (var job = new NativeArray<RcsNozzleAllocationResultData>(count, Allocator.TempJob))
        {
            FillRcsNozzles(input);
            var request = new RcsAllocationRequestData
            {
                desiredForceWorld = new Vector3(5f, -0.75f, 12f),
                desiredTorqueWorld = new Vector3(0.4f, -0.3f, 0.2f),
                centerOfMassWorld = new Vector3(0.1f, -0.05f, 0.2f),
                maxNozzleThrust = 25f,
                forceWeight = 1f,
                torqueWeight = 2.5f
            };
            PrototypeRuntimeJobSystems.RunRcsNozzleScoringScalar(input, scalar, request);
            PrototypeRuntimeJobSystems.ScheduleRcsNozzleScoring(input, job, request).Complete();
            CompareRcsSamples(scalar, job);

            double scalarMedian = MeasureMedianMs(repetitions, () =>
            {
                PrototypeRuntimeJobSystems.RunRcsNozzleScoringScalar(input, scalar, request);
            });
            double jobMedian = MeasureMedianMs(repetitions, () =>
            {
                JobHandle handle = PrototypeRuntimeJobSystems.ScheduleRcsNozzleScoring(input, job, request);
                handle.Complete();
            });

            return new BenchmarkRow("Phase6.RcsNozzleScoring", count, count, scalarMedian, jobMedian);
        }
    }

    private static double MeasureMedianMs(int repetitions, Action action)
    {
        action();
        action();
        var samples = new List<double>(repetitions);
        for (int i = 0; i < repetitions; i++)
        {
            var stopwatch = Stopwatch.StartNew();
            action();
            stopwatch.Stop();
            samples.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        samples.Sort();
        return samples[samples.Count / 2];
    }

    private static void WriteBenchmarkArtifacts(IReadOnlyList<BenchmarkRow> rows)
    {
        string root = Path.Combine(Directory.GetCurrentDirectory(), ChangeRoot, "tests", "performance");
        Directory.CreateDirectory(root);
        string csvPath = Path.Combine(root, "runtime-job-benchmark.csv");
        string markdownPath = Path.Combine(root, "runtime-job-benchmark.md");

        var csvLines = new List<string>
        {
            "phase,item_count,work_units,scalar_median_ms,job_median_ms,speedup"
        };
        foreach (BenchmarkRow row in rows)
        {
            csvLines.Add(string.Join(
                ",",
                row.Phase,
                row.ItemCount.ToString(CultureInfo.InvariantCulture),
                row.WorkUnits.ToString(CultureInfo.InvariantCulture),
                row.ScalarMedianMs.ToString("F4", CultureInfo.InvariantCulture),
                row.JobMedianMs.ToString("F4", CultureInfo.InvariantCulture),
                row.Speedup.ToString("F3", CultureInfo.InvariantCulture)));
        }

        File.WriteAllLines(csvPath, csvLines);

        double scalarTotal = rows.Sum(row => row.ScalarMedianMs);
        double jobTotal = rows.Sum(row => row.JobMedianMs);
        double aggregateSpeedup = scalarTotal / Math.Max(0.0001d, jobTotal);
        var markdown = new List<string>
        {
            "# Runtime Job Benchmark",
            string.Empty,
            "- Measured from Unity EditMode on the same prepared NativeArray data.",
            "- Times are median milliseconds after two warmup runs.",
            "- Job path uses Burst-annotated `IJobFor.ScheduleParallel`; Unity object APIs are outside the measured jobs.",
            string.Empty,
            "| Phase | Items | Work units | Scalar median ms | Job median ms | Speedup |",
            "| --- | ---: | ---: | ---: | ---: | ---: |"
        };
        foreach (BenchmarkRow row in rows)
        {
            markdown.Add(string.Format(
                CultureInfo.InvariantCulture,
                "| {0} | {1} | {2} | {3:F4} | {4:F4} | {5:F2}x |",
                row.Phase,
                row.ItemCount,
                row.WorkUnits,
                row.ScalarMedianMs,
                row.JobMedianMs,
                row.Speedup));
        }

        markdown.Add(string.Empty);
        markdown.Add(string.Format(CultureInfo.InvariantCulture, "- Aggregate scalar median: {0:F4} ms", scalarTotal));
        markdown.Add(string.Format(CultureInfo.InvariantCulture, "- Aggregate job median: {0:F4} ms", jobTotal));
        markdown.Add(string.Format(CultureInfo.InvariantCulture, "- Aggregate speedup: {0:F2}x", aggregateSpeedup));
        File.WriteAllLines(markdownPath, markdown);
    }

    private static void FillProjectiles(NativeArray<ProjectileData> input)
    {
        for (int i = 0; i < input.Length; i++)
        {
            float t = i * 0.017f;
            input[i] = new ProjectileData
            {
                projectileId = i + 1,
                ownerTargetId = i % 11,
                snapshotVersion = 3,
                previousPosition = new Vector3(t, t * 0.5f, -t),
                position = new Vector3((i % 101) * 0.5f, (i % 29) * 0.25f, (i % 211) * 0.75f),
                direction = Vector3.forward,
                velocity = new Vector3(25f + (i % 17), -3f + (i % 5), 180f + (i % 31)),
                radius = 0.1f,
                mass = 0.25f,
                lifetime = 4f + (i % 7) * 0.25f,
                age = (i % 97) * 0.005f,
                damagePerImpulse = 1f,
                applyImpactDamageFlag = 1,
                applyImpactImpulseFlag = 1
            };
        }
    }

    private static void FillTargets(NativeArray<TargetData> input)
    {
        for (int i = 0; i < input.Length; i++)
        {
            input[i] = new TargetData
            {
                targetId = i + 1000,
                snapshotVersion = 5,
                position = new Vector3((i % 251) - 125f, ((i * 3) % 67) - 20f, 30f + (i % 389)),
                rotation = Quaternion.identity,
                forward = Vector3.forward,
                up = Vector3.up,
                linearVelocity = new Vector3((i % 13) - 6f, (i % 7) - 3f, (i % 19) * 0.5f),
                isActiveInHierarchy = i % 23 == 0 ? 0 : 1,
                hasRigidbody = 1,
                hasDamageState = 1,
                currentHealth = 50f + (i % 100),
                maxHealth = 160f
            };
        }
    }

    private static void FillTrajectoryCandidates(NativeArray<TrajectoryCandidateInputData> input, int steps)
    {
        for (int i = 0; i < input.Length; i++)
        {
            float sign = i % 2 == 0 ? 1f : -1f;
            input[i] = new TrajectoryCandidateInputData
            {
                candidateId = i + 2000,
                snapshotVersion = 7,
                origin = new Vector3(0f, 0f, 0f),
                velocity = new Vector3((i % 11) * 0.1f, sign * ((i % 9) * 0.15f), 12f + (i % 17) * 0.2f),
                acceleration = new Vector3(sign * (0.4f + (i % 5) * 0.05f), ((i % 7) - 3f) * 0.03f, -0.08f * (i % 3)),
                targetPosition = new Vector3(12f, -4f, 220f),
                obstaclePosition = new Vector3((i % 31) - 15f, 0f, 90f + (i % 41)),
                obstacleRadius = 18f,
                duration = 3.2f,
                fixedDeltaTime = 0.02f,
                fuelCostPerSecond = 0.65f,
                steps = steps
            };
        }
    }

    private static void FillSensorContacts(NativeArray<SensorContactData> input)
    {
        for (int i = 0; i < input.Length; i++)
        {
            input[i] = new SensorContactData
            {
                contactId = i + 3000,
                targetId = 5000 + (i % 4096),
                snapshotVersion = 11,
                point = new Vector3((i % 701) - 350f, ((i * 5) % 151) - 75f, 10f + (i % 997)),
                normal = Vector3.up,
                relativeVelocity = new Vector3((i % 17) - 8f, 0f, (i % 23) - 11f),
                distance = i % 1000,
                confidence = 0.35f + (i % 101) / 150f,
                hasCollider = 1,
                hasRigidbody = i % 3 == 0 ? 1 : 0
            };
        }
    }

    private static void FillRcsNozzles(NativeArray<RcsNozzleData> input)
    {
        for (int i = 0; i < input.Length; i++)
        {
            float yaw = (i % 360) * Mathf.Deg2Rad;
            Vector3 forward = new Vector3(Mathf.Sin(yaw), ((i % 9) - 4f) * 0.04f, Mathf.Cos(yaw)).normalized;
            input[i] = new RcsNozzleData
            {
                nozzleId = i + 4000,
                shipId = 1,
                snapshotVersion = 13,
                isActive = i % 29 == 0 ? 0 : 1,
                isSpooling = 1,
                localPosition = new Vector3((i % 17) - 8f, ((i * 3) % 11) - 5f, ((i * 5) % 19) - 9f),
                worldPosition = new Vector3((i % 17) - 8f, ((i * 3) % 11) - 5f, ((i * 5) % 19) - 9f),
                localForward = forward,
                localUp = Vector3.up,
                localRight = Vector3.right,
                baseVfxScale = Vector3.one,
                actualThrottle = 0f,
                cacheVersion = 2,
                isCacheDirty = 0
            };
        }
    }

    private static void CompareProjectileSamples(NativeArray<ProjectileIntegrationResultData> scalar, NativeArray<ProjectileIntegrationResultData> job)
    {
        foreach (int index in SampleIndices(scalar.Length))
        {
            AssertVectorApproximately(scalar[index].position, job[index].position);
            AssertApproximately(scalar[index].age, job[index].age);
            Assert.AreEqual(scalar[index].isAlive, job[index].isAlive);
        }
    }

    private static void CompareTargetSamples(NativeArray<TargetScoreResultData> scalar, NativeArray<TargetScoreResultData> job)
    {
        foreach (int index in SampleIndices(scalar.Length))
        {
            AssertApproximately(scalar[index].priorityScore, job[index].priorityScore, ScoreTolerance);
            AssertVectorApproximately(scalar[index].leadPosition, job[index].leadPosition);
            Assert.AreEqual(scalar[index].isValid, job[index].isValid);
        }
    }

    private static void CompareTrajectorySamples(NativeArray<TrajectoryEvaluationResultData> scalar, NativeArray<TrajectoryEvaluationResultData> job)
    {
        foreach (int index in SampleIndices(scalar.Length))
        {
            AssertVectorApproximately(scalar[index].finalPosition, job[index].finalPosition);
            AssertVectorApproximately(scalar[index].finalVelocity, job[index].finalVelocity);
            AssertApproximately(scalar[index].score, job[index].score, ScoreTolerance * 100f);
        }
    }

    private static void CompareSensorSamples(NativeArray<SensorContactResultData> scalar, NativeArray<SensorContactResultData> job)
    {
        foreach (int index in SampleIndices(scalar.Length))
        {
            AssertVectorApproximately(scalar[index].direction, job[index].direction);
            AssertApproximately(scalar[index].priorityScore, job[index].priorityScore);
            Assert.AreEqual(scalar[index].isVisible, job[index].isVisible);
        }
    }

    private static void CompareRcsSamples(NativeArray<RcsNozzleAllocationResultData> scalar, NativeArray<RcsNozzleAllocationResultData> job)
    {
        foreach (int index in SampleIndices(scalar.Length))
        {
            AssertVectorApproximately(scalar[index].forceAtRecommendedThrottle, job[index].forceAtRecommendedThrottle);
            AssertVectorApproximately(scalar[index].torqueAtRecommendedThrottle, job[index].torqueAtRecommendedThrottle);
            AssertApproximately(scalar[index].recommendedThrottle, job[index].recommendedThrottle);
        }
    }

    private static IEnumerable<int> SampleIndices(int length)
    {
        yield return 0;
        yield return length / 7;
        yield return length / 3;
        yield return length / 2;
        yield return length - 1;
    }

    private static void AssertVectorApproximately(Vector3 expected, Vector3 actual)
    {
        AssertApproximately(expected.x, actual.x);
        AssertApproximately(expected.y, actual.y);
        AssertApproximately(expected.z, actual.z);
    }

    private static void AssertApproximately(float expected, float actual, float tolerance = VectorTolerance)
    {
        if (float.IsNegativeInfinity(expected) || float.IsPositiveInfinity(expected))
        {
            Assert.AreEqual(expected, actual);
            return;
        }

        Assert.That(actual, Is.EqualTo(expected).Within(tolerance));
    }

    private readonly struct BenchmarkRow
    {
        public BenchmarkRow(string phase, int itemCount, int workUnits, double scalarMedianMs, double jobMedianMs)
        {
            Phase = phase;
            ItemCount = itemCount;
            WorkUnits = workUnits;
            ScalarMedianMs = scalarMedianMs;
            JobMedianMs = jobMedianMs;
        }

        public string Phase { get; }
        public int ItemCount { get; }
        public int WorkUnits { get; }
        public double ScalarMedianMs { get; }
        public double JobMedianMs { get; }
        public double Speedup
        {
            get { return ScalarMedianMs / Math.Max(0.0001d, JobMedianMs); }
        }
    }
}
