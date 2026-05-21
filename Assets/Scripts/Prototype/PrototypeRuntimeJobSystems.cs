using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

public static class PrototypeRuntimeJobSystems
{
    public const int DefaultBatchSize = 64;
    private const float Epsilon = 0.000001f;

    public static JobHandle ScheduleProjectileIntegration(
        NativeArray<ProjectileData> input,
        NativeArray<ProjectileIntegrationResultData> output,
        float deltaTime,
        JobHandle dependency = default,
        int batchSize = DefaultBatchSize)
    {
        var job = new ProjectileIntegrationJob
        {
            input = input,
            output = output,
            deltaTime = math.max(0f, deltaTime)
        };
        return job.ScheduleParallel(input.Length, math.max(1, batchSize), dependency);
    }

    public static void RunProjectileIntegrationScalar(
        NativeArray<ProjectileData> input,
        NativeArray<ProjectileIntegrationResultData> output,
        float deltaTime)
    {
        float dt = math.max(0f, deltaTime);
        for (int i = 0; i < input.Length; i++)
        {
            output[i] = IntegrateProjectile(input[i], dt);
        }
    }

    public static JobHandle ScheduleTargetScoring(
        NativeArray<TargetData> input,
        NativeArray<TargetScoreResultData> output,
        TargetScoreSettingsData settings,
        JobHandle dependency = default,
        int batchSize = DefaultBatchSize)
    {
        var job = new TargetScoringJob
        {
            input = input,
            output = output,
            settings = settings
        };
        return job.ScheduleParallel(input.Length, math.max(1, batchSize), dependency);
    }

    public static void RunTargetScoringScalar(
        NativeArray<TargetData> input,
        NativeArray<TargetScoreResultData> output,
        TargetScoreSettingsData settings)
    {
        for (int i = 0; i < input.Length; i++)
        {
            output[i] = ScoreTarget(input[i], settings);
        }
    }

    public static JobHandle ScheduleTrajectoryEvaluation(
        NativeArray<TrajectoryCandidateInputData> input,
        NativeArray<TrajectoryEvaluationResultData> output,
        JobHandle dependency = default,
        int batchSize = DefaultBatchSize)
    {
        var job = new TrajectoryEvaluationJob
        {
            input = input,
            output = output
        };
        return job.ScheduleParallel(input.Length, math.max(1, batchSize), dependency);
    }

    public static void RunTrajectoryEvaluationScalar(
        NativeArray<TrajectoryCandidateInputData> input,
        NativeArray<TrajectoryEvaluationResultData> output)
    {
        for (int i = 0; i < input.Length; i++)
        {
            output[i] = EvaluateTrajectory(input[i]);
        }
    }

    public static JobHandle ScheduleSensorFiltering(
        NativeArray<SensorContactData> input,
        NativeArray<SensorContactResultData> output,
        SensorFilterSettingsData settings,
        JobHandle dependency = default,
        int batchSize = DefaultBatchSize)
    {
        var job = new SensorFilteringJob
        {
            input = input,
            output = output,
            settings = settings
        };
        return job.ScheduleParallel(input.Length, math.max(1, batchSize), dependency);
    }

    public static void RunSensorFilteringScalar(
        NativeArray<SensorContactData> input,
        NativeArray<SensorContactResultData> output,
        SensorFilterSettingsData settings)
    {
        for (int i = 0; i < input.Length; i++)
        {
            output[i] = FilterSensorContact(input[i], settings);
        }
    }

    public static JobHandle ScheduleRcsNozzleScoring(
        NativeArray<RcsNozzleData> input,
        NativeArray<RcsNozzleAllocationResultData> output,
        RcsAllocationRequestData request,
        JobHandle dependency = default,
        int batchSize = DefaultBatchSize)
    {
        var job = new RcsNozzleScoringJob
        {
            input = input,
            output = output,
            request = request
        };
        return job.ScheduleParallel(input.Length, math.max(1, batchSize), dependency);
    }

    public static void RunRcsNozzleScoringScalar(
        NativeArray<RcsNozzleData> input,
        NativeArray<RcsNozzleAllocationResultData> output,
        RcsAllocationRequestData request)
    {
        for (int i = 0; i < input.Length; i++)
        {
            output[i] = ScoreRcsNozzle(input[i], request);
        }
    }

    public static int SelectBestTarget(NativeArray<TargetScoreResultData> results)
    {
        int bestIndex = -1;
        float bestScore = float.NegativeInfinity;
        for (int i = 0; i < results.Length; i++)
        {
            TargetScoreResultData result = results[i];
            if (result.isValid == 0 || result.priorityScore <= bestScore)
            {
                continue;
            }

            bestScore = result.priorityScore;
            bestIndex = i;
        }

        return bestIndex;
    }

    public static int SelectBestTrajectory(NativeArray<TrajectoryEvaluationResultData> results)
    {
        int bestIndex = -1;
        float bestScore = float.NegativeInfinity;
        for (int i = 0; i < results.Length; i++)
        {
            TrajectoryEvaluationResultData result = results[i];
            if (result.isValid == 0 || result.score <= bestScore)
            {
                continue;
            }

            bestScore = result.score;
            bestIndex = i;
        }

        return bestIndex;
    }

    [BurstCompile(FloatPrecision.Standard, FloatMode.Fast)]
    public struct ProjectileIntegrationJob : IJobFor
    {
        [ReadOnly] public NativeArray<ProjectileData> input;
        [WriteOnly] public NativeArray<ProjectileIntegrationResultData> output;
        public float deltaTime;

        public void Execute(int index)
        {
            output[index] = IntegrateProjectile(input[index], deltaTime);
        }
    }

    [BurstCompile(FloatPrecision.Standard, FloatMode.Fast)]
    public struct TargetScoringJob : IJobFor
    {
        [ReadOnly] public NativeArray<TargetData> input;
        [WriteOnly] public NativeArray<TargetScoreResultData> output;
        public TargetScoreSettingsData settings;

        public void Execute(int index)
        {
            output[index] = ScoreTarget(input[index], settings);
        }
    }

    [BurstCompile(FloatPrecision.Standard, FloatMode.Fast)]
    public struct TrajectoryEvaluationJob : IJobFor
    {
        [ReadOnly] public NativeArray<TrajectoryCandidateInputData> input;
        [WriteOnly] public NativeArray<TrajectoryEvaluationResultData> output;

        public void Execute(int index)
        {
            output[index] = EvaluateTrajectory(input[index]);
        }
    }

    [BurstCompile(FloatPrecision.Standard, FloatMode.Fast)]
    public struct SensorFilteringJob : IJobFor
    {
        [ReadOnly] public NativeArray<SensorContactData> input;
        [WriteOnly] public NativeArray<SensorContactResultData> output;
        public SensorFilterSettingsData settings;

        public void Execute(int index)
        {
            output[index] = FilterSensorContact(input[index], settings);
        }
    }

    [BurstCompile(FloatPrecision.Standard, FloatMode.Fast)]
    public struct RcsNozzleScoringJob : IJobFor
    {
        [ReadOnly] public NativeArray<RcsNozzleData> input;
        [WriteOnly] public NativeArray<RcsNozzleAllocationResultData> output;
        public RcsAllocationRequestData request;

        public void Execute(int index)
        {
            output[index] = ScoreRcsNozzle(input[index], request);
        }
    }

    private static ProjectileIntegrationResultData IntegrateProjectile(ProjectileData projectile, float deltaTime)
    {
        float age = projectile.age + deltaTime;
        Vector3 nextPosition = projectile.position + projectile.velocity * deltaTime;
        return new ProjectileIntegrationResultData
        {
            projectileId = projectile.projectileId,
            snapshotVersion = projectile.snapshotVersion,
            previousPosition = projectile.position,
            position = nextPosition,
            age = age,
            lifetime = projectile.lifetime,
            isAlive = age < projectile.lifetime ? 1 : 0
        };
    }

    private static TargetScoreResultData ScoreTarget(TargetData target, TargetScoreSettingsData settings)
    {
        Vector3 toTarget = target.position - settings.origin;
        float distanceSquared = SqrMagnitude(toTarget);
        float distance = math.sqrt(math.max(0f, distanceSquared));
        Vector3 direction = NormalizeOrZero(toTarget);
        Vector3 forward = NormalizeOrZero(settings.forward);
        float angleCosine = Dot(direction, forward);
        float maxRange = math.max(0f, settings.maxRange);
        bool inRange = maxRange <= Epsilon || distanceSquared <= maxRange * maxRange;
        bool inView = settings.fieldOfViewCosine <= -1f || angleCosine >= settings.fieldOfViewCosine;
        bool active = target.isActiveInHierarchy != 0;
        float healthFraction = target.maxHealth > Epsilon ? math.clamp(target.currentHealth / target.maxHealth, 0f, 1f) : 1f;
        float projectileSpeed = math.max(0f, settings.projectileSpeed);
        float leadTime = projectileSpeed > Epsilon ? math.min(distance / projectileSpeed, math.max(0f, settings.maxLeadTime)) : 0f;
        Vector3 leadPosition = target.position + target.linearVelocity * leadTime;
        float score;
        switch (settings.priorityMode)
        {
            case 1:
                score = -distanceSquared;
                break;
            case 2:
                score = healthFraction;
                break;
            case 3:
                score = 1f - healthFraction;
                break;
            default:
                score = angleCosine * 0.5f - distanceSquared * 0.00001f + (1f - healthFraction) * 0.25f;
                break;
        }

        int isValid = active && inRange && inView ? 1 : 0;
        if (isValid == 0)
        {
            score = float.NegativeInfinity;
        }

        return new TargetScoreResultData
        {
            targetId = target.targetId,
            snapshotVersion = target.snapshotVersion,
            leadPosition = leadPosition,
            distanceSquared = distanceSquared,
            angleCosine = angleCosine,
            healthFraction = healthFraction,
            priorityScore = score,
            isValid = isValid
        };
    }

    private static TrajectoryEvaluationResultData EvaluateTrajectory(TrajectoryCandidateInputData candidate)
    {
        int steps = math.max(1, candidate.steps);
        float duration = math.max(0f, candidate.duration);
        float dt = candidate.fixedDeltaTime > Epsilon ? candidate.fixedDeltaTime : duration / steps;
        Vector3 position = candidate.origin;
        Vector3 velocity = candidate.velocity;
        float closestObstacleDistanceSquared = float.PositiveInfinity;
        for (int i = 0; i < steps; i++)
        {
            velocity += candidate.acceleration * dt;
            position += velocity * dt;
            float obstacleDistanceSquared = SqrMagnitude(position - candidate.obstaclePosition);
            closestObstacleDistanceSquared = math.min(closestObstacleDistanceSquared, obstacleDistanceSquared);
        }

        float targetDistanceSquared = SqrMagnitude(position - candidate.targetPosition);
        float obstacleRadius = math.max(0f, candidate.obstacleRadius);
        float obstacleRisk = obstacleRadius > Epsilon
            ? math.saturate(1f - (math.sqrt(math.max(0f, closestObstacleDistanceSquared)) / obstacleRadius))
            : 0f;
        float accelerationMagnitude = Magnitude(candidate.acceleration);
        float fuelEstimate = accelerationMagnitude * math.max(0f, candidate.fuelCostPerSecond) * dt * steps;
        float score = -targetDistanceSquared - obstacleRisk * 100000f - fuelEstimate * 10f;
        return new TrajectoryEvaluationResultData
        {
            candidateId = candidate.candidateId,
            snapshotVersion = candidate.snapshotVersion,
            finalPosition = position,
            finalVelocity = velocity,
            targetDistanceSquared = targetDistanceSquared,
            obstacleRisk = obstacleRisk,
            fuelEstimate = fuelEstimate,
            score = score,
            isValid = steps > 0 ? 1 : 0
        };
    }

    private static SensorContactResultData FilterSensorContact(SensorContactData contact, SensorFilterSettingsData settings)
    {
        Vector3 toContact = contact.point - settings.origin;
        float distanceSquared = SqrMagnitude(toContact);
        float maxRange = math.max(0f, settings.maxRange);
        Vector3 direction = NormalizeOrZero(toContact);
        Vector3 forward = NormalizeOrZero(settings.forward);
        float angleCosine = Dot(direction, forward);
        bool inRange = maxRange <= Epsilon || distanceSquared <= maxRange * maxRange;
        bool inView = settings.fieldOfViewCosine <= -1f || angleCosine >= settings.fieldOfViewCosine;
        int visible = inRange && inView ? 1 : 0;
        float normalizedDistance = maxRange > Epsilon ? math.saturate(1f - math.sqrt(math.max(0f, distanceSquared)) / maxRange) : 1f;
        float priority = visible != 0 ? normalizedDistance * math.max(0f, contact.confidence) : 0f;
        return new SensorContactResultData
        {
            contactId = contact.contactId,
            targetId = contact.targetId,
            snapshotVersion = contact.snapshotVersion,
            direction = direction,
            distanceSquared = distanceSquared,
            priorityScore = priority,
            isVisible = visible
        };
    }

    private static RcsNozzleAllocationResultData ScoreRcsNozzle(RcsNozzleData nozzle, RcsAllocationRequestData request)
    {
        Vector3 forceDirection = NormalizeOrZero(nozzle.localForward);
        float maxThrust = math.max(0f, request.maxNozzleThrust);
        Vector3 forceAtFull = forceDirection * maxThrust;
        Vector3 lever = nozzle.worldPosition - request.centerOfMassWorld;
        Vector3 torqueAtFull = Cross(lever, forceAtFull);
        float forceWeight = math.max(Epsilon, request.forceWeight);
        float torqueWeight = math.max(Epsilon, request.torqueWeight);
        float denominator = WeightedMagnitudeSquared(forceAtFull, torqueAtFull, forceWeight, torqueWeight);
        float numerator = forceWeight * Dot(request.desiredForceWorld, forceAtFull)
            + torqueWeight * Dot(request.desiredTorqueWorld, torqueAtFull);
        float throttle = denominator > Epsilon ? math.clamp(numerator / denominator, 0f, 1f) : 0f;
        Vector3 recommendedForce = forceAtFull * throttle;
        Vector3 recommendedTorque = torqueAtFull * throttle;
        return new RcsNozzleAllocationResultData
        {
            nozzleId = nozzle.nozzleId,
            snapshotVersion = nozzle.snapshotVersion,
            forceAtRecommendedThrottle = recommendedForce,
            torqueAtRecommendedThrottle = recommendedTorque,
            recommendedThrottle = throttle,
            contributionScore = throttle > Epsilon ? math.max(0f, numerator) / math.max(Epsilon, denominator) : 0f,
            isValid = nozzle.isActive != 0 && maxThrust > Epsilon ? 1 : 0
        };
    }

    private static float WeightedMagnitudeSquared(Vector3 force, Vector3 torque, float forceWeight, float torqueWeight)
    {
        return SqrMagnitude(force) * forceWeight + SqrMagnitude(torque) * torqueWeight;
    }

    private static Vector3 NormalizeOrZero(Vector3 value)
    {
        float lengthSquared = SqrMagnitude(value);
        return lengthSquared > Epsilon ? value * math.rsqrt(lengthSquared) : new Vector3(0f, 0f, 0f);
    }

    private static float Magnitude(Vector3 value)
    {
        return math.sqrt(math.max(0f, SqrMagnitude(value)));
    }

    private static float SqrMagnitude(Vector3 value)
    {
        return value.x * value.x + value.y * value.y + value.z * value.z;
    }

    private static float Dot(Vector3 left, Vector3 right)
    {
        return left.x * right.x + left.y * right.y + left.z * right.z;
    }

    private static Vector3 Cross(Vector3 left, Vector3 right)
    {
        return new Vector3(
            left.y * right.z - left.z * right.y,
            left.z * right.x - left.x * right.z,
            left.x * right.y - left.y * right.x);
    }
}
