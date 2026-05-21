using System;
using System.Collections.Generic;
using UnityEngine;

public enum PrototypeTrajectoryPhase
{
    Idle,
    AlignForBurn,
    LongRangeBurn,
    Coast,
    Avoidance,
    AvoidancePlanning,
    ReacquireDirectPath,
    Brake,
    FinalApproach,
    Hold,
    Failed,
    Clear
}

public enum PrototypeAutopilotNavigationPhase
{
    Direct,
    AvoidancePlanning,
    Avoiding,
    ReacquireDirectPath,
    Brake,
    FinalApproach,
    Hold
}

public enum PrototypeTrajectorySegmentType
{
    Align,
    Burn,
    Coast,
    AvoidanceBurn,
    Brake,
    FinalApproach,
    Hold
}

public struct PrototypeTrajectorySegment
{
    public PrototypeTrajectorySegmentType type;
    public float durationSeconds;
    public Vector3 directionWorld;
    public float throttle;
    public float expectedDeltaV;
    public float expectedFuelKg;
    public float predictedClosestObstacleDistance;
    public float predictedMissDistanceToTarget;

    public PrototypeTrajectorySegment(
        PrototypeTrajectorySegmentType type,
        float durationSeconds,
        Vector3 directionWorld,
        float throttle,
        float expectedDeltaV,
        float expectedFuelKg,
        float predictedClosestObstacleDistance,
        float predictedMissDistanceToTarget)
    {
        this.type = type;
        this.durationSeconds = Mathf.Max(0f, durationSeconds);
        this.directionWorld = directionWorld.sqrMagnitude > 0.0001f ? directionWorld.normalized : Vector3.forward;
        this.throttle = Mathf.Clamp01(throttle);
        this.expectedDeltaV = Mathf.Max(0f, expectedDeltaV);
        this.expectedFuelKg = Mathf.Max(0f, expectedFuelKg);
        this.predictedClosestObstacleDistance = predictedClosestObstacleDistance;
        this.predictedMissDistanceToTarget = Mathf.Max(0f, predictedMissDistanceToTarget);
    }
}

public struct PrototypeTrajectoryCandidateScore
{
    public string name;
    public Vector3 directionWorld;
    public Vector3 waypoint;
    public float score;
    public float clearanceMeters;
    public float deltaV;
    public float headingChangeDegrees;
    public float lateralSpeedPenalty;
    public float fuelRemainingKg;
    public bool canBrakeBeforeTarget;
    public float rcsAuthorityMargin;
    public bool collisionPredicted;
    public bool fuelInsufficient;
    public string reason;
}

public struct PrototypeTrajectorySnapshot
{
    public Vector3 position;
    public Vector3 velocity;
    public Vector3 targetPosition;
    public Vector3 forward;
    public float massKg;
    public float maxMainAcceleration;
    public float maxRcsForce;
    public float clearanceRadius;
    public float mainThrustNewtons;
    public float fuelKgPerSecond;
    public float availableFuelKg;
    public float arrivalRadius;
    public float arrivalSpeed;
    public float lateralTolerance;

    public PrototypeTrajectorySnapshot(
        Vector3 position,
        Vector3 velocity,
        Vector3 targetPosition,
        Vector3 forward,
        float massKg,
        float maxMainAcceleration,
        float maxRcsForce,
        float clearanceRadius,
        float mainThrustNewtons = 0f,
        float fuelKgPerSecond = 0f,
        float availableFuelKg = 0f,
        float arrivalRadius = 10f,
        float arrivalSpeed = 1f,
        float lateralTolerance = 0.2f)
    {
        this.position = position;
        this.velocity = velocity;
        this.targetPosition = targetPosition;
        this.forward = forward.sqrMagnitude > 0.0001f ? forward.normalized : Vector3.forward;
        this.massKg = Mathf.Max(0.01f, massKg);
        this.maxMainAcceleration = Mathf.Max(0f, maxMainAcceleration);
        this.maxRcsForce = Mathf.Max(0f, maxRcsForce);
        this.clearanceRadius = Mathf.Max(0.01f, clearanceRadius);
        this.mainThrustNewtons = Mathf.Max(0f, mainThrustNewtons);
        this.fuelKgPerSecond = Mathf.Max(0f, fuelKgPerSecond);
        this.availableFuelKg = Mathf.Max(0f, availableFuelKg);
        this.arrivalRadius = Mathf.Max(0.5f, arrivalRadius);
        this.arrivalSpeed = Mathf.Max(0.01f, arrivalSpeed);
        this.lateralTolerance = Mathf.Max(0.01f, lateralTolerance);
    }

    public Vector3 DirectionToTarget
    {
        get
        {
            Vector3 toTarget = targetPosition - position;
            return toTarget.sqrMagnitude > 0.0001f ? toTarget.normalized : forward;
        }
    }

    public float DistanceToTarget => Vector3.Distance(position, targetPosition);
}

public struct PrototypeTrajectoryPlan
{
    public PrototypeTrajectoryPhase phase;
    public PrototypeAutopilotNavigationPhase navigationPhase;
    public PrototypeTrajectorySegmentType activeSegmentType;
    public PrototypeTrajectorySegment activeSegment;
    public PrototypeTrajectorySegment[] segments;
    public PrototypeTrajectoryCandidateScore[] candidateScores;
    public TrajectoryBurnPlan burnPlan;
    public Vector3[] predictedPath;
    public Vector3 desiredBurnDirection;
    public Vector3 desiredBurnDirectionWorld;
    public Vector3 desiredAccelerationWorld;
    public Vector3 requestedRcsForceWorld;
    public Vector3 requestedTorqueLocal;
    public Vector3 avoidanceDirection;
    public Vector3 obstacleDirection;
    public Vector3 avoidanceWaypoint;
    public float mainThrottleLimit;
    public float requestedMainThrottle;
    public bool obstacleDetected;
    public bool isValid;
    public bool avoidanceActive;
    public bool directPathBlocked;
    public bool limitedRcsAuthority;
    public bool fuelInsufficient;
    public bool holdNoAuthority;
    public bool limitedHoldAuthority;
    public string selectedCandidate;
    public string selectedCandidateReason;
    public string obstacleLabel;
    public float obstacleDistance;
    public float plannedStoppingDistance;
    public float plannedEtaSeconds;
    public float predictedClosestObstacleDistance;
    public float predictedMissDistanceToTarget;
    public string failureReason;
    public string warningStatus;
    public string status;
    public string statusLabel;

    public bool RequiresAvoidance => phase == PrototypeTrajectoryPhase.Avoidance || avoidanceActive;

    public static PrototypeTrajectoryPlan Clear(Vector3 desiredDirection)
    {
        Vector3 direction = desiredDirection.sqrMagnitude > 0.0001f ? desiredDirection.normalized : Vector3.forward;
        var burn = TrajectoryBurnPlan.None;
        var segment = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Burn, 0f, direction, 1f, 0f, 0f, float.PositiveInfinity, 0f);
        return new PrototypeTrajectoryPlan
        {
            phase = PrototypeTrajectoryPhase.LongRangeBurn,
            navigationPhase = PrototypeAutopilotNavigationPhase.Direct,
            activeSegmentType = PrototypeTrajectorySegmentType.Burn,
            activeSegment = segment,
            segments = new[] { segment },
            candidateScores = Array.Empty<PrototypeTrajectoryCandidateScore>(),
            burnPlan = burn,
            predictedPath = Array.Empty<Vector3>(),
            desiredBurnDirection = direction,
            desiredBurnDirectionWorld = direction,
            desiredAccelerationWorld = direction,
            requestedRcsForceWorld = Vector3.zero,
            requestedTorqueLocal = Vector3.zero,
            avoidanceDirection = Vector3.zero,
            obstacleDirection = Vector3.zero,
            avoidanceWaypoint = Vector3.zero,
            mainThrottleLimit = 1f,
            requestedMainThrottle = 1f,
            obstacleDetected = false,
            isValid = true,
            avoidanceActive = false,
            directPathBlocked = false,
            limitedRcsAuthority = false,
            fuelInsufficient = false,
            holdNoAuthority = false,
            limitedHoldAuthority = false,
            selectedCandidate = "direct",
            selectedCandidateReason = "direct path clear",
            obstacleLabel = "none",
            obstacleDistance = 0f,
            plannedStoppingDistance = 0f,
            plannedEtaSeconds = float.PositiveInfinity,
            predictedClosestObstacleDistance = float.PositiveInfinity,
            predictedMissDistanceToTarget = 0f,
            failureReason = string.Empty,
            warningStatus = string.Empty,
            status = "clear",
            statusLabel = "clear"
        };
    }
}

public class PrototypeTrajectoryPlanner
{
    private const float AvoidanceBlend = 1.35f;
    private const float CandidateHorizonSeconds = 5f;
    private const float CandidateStepSeconds = 0.25f;
    private readonly List<PrototypeTrajectoryCandidateScore> candidateBuffer = new List<PrototypeTrajectoryCandidateScore>(10);

    public PrototypeTrajectoryPlan Plan(PrototypeTrajectorySnapshot snapshot, PrototypeObstacleDetectionResult detection)
    {
        return Plan(snapshot, detection, false, Vector3.zero, string.Empty);
    }

    public PrototypeTrajectoryPlan Plan(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        bool keepAvoidanceWaypoint,
        Vector3 stableAvoidanceWaypoint,
        string preferredCandidateName)
    {
        Vector3 targetDirection = snapshot.DirectionToTarget;
        bool hasBlockingObstacle = detection.detected && detection.obstacle != null;
        if (!hasBlockingObstacle && !keepAvoidanceWaypoint)
        {
            PrototypeTrajectoryPlan clearPlan = PrototypeTrajectoryPlan.Clear(targetDirection);
            FillDirectDiagnostics(ref clearPlan, snapshot);
            return clearPlan;
        }

        candidateBuffer.Clear();
        BuildCandidates(snapshot, detection, hasBlockingObstacle, keepAvoidanceWaypoint, stableAvoidanceWaypoint, preferredCandidateName, candidateBuffer);
        int bestIndex = SelectBestCandidate(candidateBuffer, preferredCandidateName);
        if (hasBlockingObstacle && IsDirectCandidate(candidateBuffer, bestIndex))
        {
            int avoidanceIndex = SelectBestAvoidanceCandidate(candidateBuffer, preferredCandidateName);
            if (avoidanceIndex >= 0)
            {
                bestIndex = avoidanceIndex;
            }
        }

        PrototypeTrajectoryCandidateScore selected = candidateBuffer[Mathf.Max(0, bestIndex)];
        bool avoidance = selected.name != "direct" || keepAvoidanceWaypoint || hasBlockingObstacle;
        float requestedThrottle = avoidance ? 0.65f : 1f;
        Vector3 selectedDirection = selected.directionWorld.sqrMagnitude > 0.0001f ? selected.directionWorld.normalized : targetDirection;
        Vector3 obstacleDirection = ResolveObstacleDirection(snapshot, detection, targetDirection);
        Vector3 avoidanceDirection = selectedDirection - targetDirection * Vector3.Dot(selectedDirection, targetDirection);
        if (avoidanceDirection.sqrMagnitude <= 0.0001f && avoidance)
        {
            avoidanceDirection = selected.waypoint - snapshot.position;
        }

        avoidanceDirection = avoidanceDirection.sqrMagnitude > 0.0001f ? avoidanceDirection.normalized : Vector3.zero;
        Vector3 requestedRcsForce = ComputeRcsRequest(snapshot, avoidanceDirection, out bool limitedRcsAuthority);
        float closestObstacleDistance = selected.clearanceMeters;
        TrajectoryBurnPlan burnPlan = BuildBurnPlan(snapshot, selectedDirection, requestedThrottle);
        bool fuelInsufficient = selected.fuelInsufficient || (burnPlan.requestedFuelKg > burnPlan.estimatedFuelKg + 0.0001f);
        PrototypeTrajectorySegment[] segments = BuildSegments(snapshot, selectedDirection, requestedThrottle, burnPlan, avoidance, selected);
        Vector3[] predictedPath = PredictCandidatePath(snapshot, selectedDirection, requestedRcsForce, requestedThrottle);

        return new PrototypeTrajectoryPlan
        {
            phase = avoidance ? PrototypeTrajectoryPhase.Avoidance : PrototypeTrajectoryPhase.LongRangeBurn,
            navigationPhase = avoidance ? PrototypeAutopilotNavigationPhase.AvoidancePlanning : PrototypeAutopilotNavigationPhase.Direct,
            activeSegmentType = avoidance ? PrototypeTrajectorySegmentType.AvoidanceBurn : PrototypeTrajectorySegmentType.Burn,
            activeSegment = segments.Length > 0 ? segments[0] : default,
            segments = segments,
            candidateScores = candidateBuffer.ToArray(),
            burnPlan = burnPlan,
            predictedPath = predictedPath,
            desiredBurnDirection = selectedDirection,
            desiredBurnDirectionWorld = selectedDirection,
            desiredAccelerationWorld = selectedDirection * snapshot.maxMainAcceleration * requestedThrottle,
            requestedRcsForceWorld = requestedRcsForce,
            requestedTorqueLocal = Vector3.zero,
            avoidanceDirection = avoidanceDirection,
            obstacleDirection = obstacleDirection,
            avoidanceWaypoint = selected.waypoint,
            mainThrottleLimit = requestedThrottle,
            requestedMainThrottle = requestedThrottle,
            obstacleDetected = hasBlockingObstacle,
            isValid = !fuelInsufficient,
            avoidanceActive = avoidance,
            directPathBlocked = hasBlockingObstacle,
            limitedRcsAuthority = limitedRcsAuthority,
            fuelInsufficient = fuelInsufficient,
            holdNoAuthority = false,
            limitedHoldAuthority = false,
            selectedCandidate = selected.name,
            selectedCandidateReason = selected.reason,
            obstacleLabel = detection.obstacle != null ? detection.obstacle.DisplayName : "none",
            obstacleDistance = detection.distance > 0f ? detection.distance : selected.clearanceMeters,
            plannedStoppingDistance = EstimateStoppingDistance(snapshot),
            plannedEtaSeconds = EstimateEta(snapshot),
            predictedClosestObstacleDistance = closestObstacleDistance,
            predictedMissDistanceToTarget = selected.waypoint == Vector3.zero ? snapshot.DistanceToTarget : Vector3.Distance(selected.waypoint, snapshot.targetPosition),
            failureReason = fuelInsufficient ? "FuelInsufficient" : string.Empty,
            warningStatus = BuildWarningStatus(limitedRcsAuthority, fuelInsufficient, selected),
            status = avoidance ? "avoidance" : "clear",
            statusLabel = avoidance ? $"avoidance {selected.name}" : "clear"
        };
    }

    private static void FillDirectDiagnostics(ref PrototypeTrajectoryPlan clearPlan, PrototypeTrajectorySnapshot snapshot)
    {
        clearPlan.plannedStoppingDistance = EstimateStoppingDistance(snapshot);
        clearPlan.plannedEtaSeconds = EstimateEta(snapshot);
        clearPlan.desiredAccelerationWorld = clearPlan.desiredBurnDirection * snapshot.maxMainAcceleration;
        clearPlan.burnPlan = BuildBurnPlan(snapshot, clearPlan.desiredBurnDirection, 1f);
        clearPlan.segments = BuildSegments(snapshot, clearPlan.desiredBurnDirection, 1f, clearPlan.burnPlan, false, default);
        clearPlan.activeSegment = clearPlan.segments.Length > 0 ? clearPlan.segments[0] : default;
        clearPlan.activeSegmentType = clearPlan.activeSegment.type;
        clearPlan.predictedPath = PredictCandidatePath(snapshot, clearPlan.desiredBurnDirection, Vector3.zero, 1f);
        clearPlan.candidateScores = new[]
        {
            BuildClearDirectCandidate(snapshot, clearPlan.desiredBurnDirection, clearPlan.burnPlan)
        };
        clearPlan.statusLabel = clearPlan.status;
    }

    private static PrototypeTrajectoryCandidateScore BuildClearDirectCandidate(
        PrototypeTrajectorySnapshot snapshot,
        Vector3 direction,
        TrajectoryBurnPlan burnPlan)
    {
        return new PrototypeTrajectoryCandidateScore
        {
            name = "direct",
            directionWorld = direction,
            waypoint = snapshot.targetPosition,
            score = 1000f,
            clearanceMeters = float.PositiveInfinity,
            deltaV = burnPlan.estimatedDeltaV,
            headingChangeDegrees = Vector3.Angle(snapshot.forward, direction),
            lateralSpeedPenalty = EstimateLateralPenalty(snapshot, direction),
            fuelRemainingKg = Mathf.Max(0f, snapshot.availableFuelKg - burnPlan.estimatedFuelKg),
            canBrakeBeforeTarget = CanBrakeBeforeTarget(snapshot),
            rcsAuthorityMargin = snapshot.maxRcsForce,
            collisionPredicted = false,
            fuelInsufficient = false,
            reason = "direct path clear"
        };
    }

    private static void BuildCandidates(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        bool directBlocked,
        bool keepAvoidanceWaypoint,
        Vector3 stableAvoidanceWaypoint,
        string preferredCandidateName,
        List<PrototypeTrajectoryCandidateScore> candidates)
    {
        Vector3 targetDirection = snapshot.DirectionToTarget;
        Vector3 right = Vector3.Cross(Vector3.up, targetDirection);
        if (right.sqrMagnitude <= 0.0001f)
        {
            right = Vector3.Cross(Vector3.right, targetDirection);
        }

        right.Normalize();
        Vector3 up = Vector3.Cross(targetDirection, right).normalized;
        AddCandidate(candidates, snapshot, detection, "direct", targetDirection, directBlocked, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "left", Blend(targetDirection, -right), false, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "right", Blend(targetDirection, right), false, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "up", Blend(targetDirection, up), false, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "down", Blend(targetDirection, -up), false, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "up-left", Blend(targetDirection, (up - right).normalized), false, preferredCandidateName);
        AddCandidate(candidates, snapshot, detection, "up-right", Blend(targetDirection, (up + right).normalized), false, preferredCandidateName);

        if (keepAvoidanceWaypoint && stableAvoidanceWaypoint.sqrMagnitude > 0.0001f)
        {
            Vector3 stableDirection = stableAvoidanceWaypoint - snapshot.position;
            stableDirection = stableDirection.sqrMagnitude > 0.0001f ? stableDirection.normalized : targetDirection;
            AddCandidate(candidates, snapshot, detection, string.IsNullOrWhiteSpace(preferredCandidateName) ? "stable" : preferredCandidateName, stableDirection, false, preferredCandidateName, stableAvoidanceWaypoint);
        }
    }

    private static Vector3 Blend(Vector3 targetDirection, Vector3 lateralDirection)
    {
        Vector3 blended = targetDirection + lateralDirection * AvoidanceBlend;
        return blended.sqrMagnitude > 0.0001f ? blended.normalized : targetDirection;
    }

    private static void AddCandidate(
        List<PrototypeTrajectoryCandidateScore> candidates,
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        string name,
        Vector3 direction,
        bool directBlocked,
        string preferredCandidateName,
        Vector3 forcedWaypoint = default)
    {
        direction = direction.sqrMagnitude > 0.0001f ? direction.normalized : snapshot.DirectionToTarget;
        float pathDistance = Mathf.Max(snapshot.DistanceToTarget, snapshot.clearanceRadius * 4f);
        Vector3 waypoint = forcedWaypoint.sqrMagnitude > 0.0001f
            ? forcedWaypoint
            : snapshot.position + direction * Mathf.Min(pathDistance, Mathf.Max(snapshot.clearanceRadius * 5f, detection.distance > 0f ? detection.distance + snapshot.clearanceRadius * 2f : pathDistance * 0.5f));

        float clearance = EstimateCandidateClearance(snapshot, detection, direction);
        bool collisionPredicted = directBlocked || clearance < 0f;
        TrajectoryBurnPlan burn = BuildBurnPlan(snapshot, direction, name == "direct" ? 1f : 0.65f);
        float headingChange = Vector3.Angle(snapshot.forward, direction);
        float lateralPenalty = EstimateLateralPenalty(snapshot, direction);
        bool canBrake = CanBrakeBeforeTarget(snapshot);
        float rcsMargin = EstimateRcsAuthorityMargin(snapshot, direction);
        bool fuelInsufficient = burn.requestedFuelKg > burn.estimatedFuelKg + 0.0001f;

        float score = 1000f;
        score -= Mathf.Max(0f, -clearance) * 25f;
        score -= collisionPredicted ? 850f : 0f;
        score -= burn.estimatedDeltaV * 1.5f;
        score -= headingChange * 1.2f;
        score -= lateralPenalty;
        score -= canBrake ? 0f : 300f;
        score -= rcsMargin < 0f ? Mathf.Abs(rcsMargin) * 0.04f : 0f;
        score -= fuelInsufficient ? 1000f : 0f;
        if (name == preferredCandidateName)
        {
            score += 125f;
        }

        candidates.Add(new PrototypeTrajectoryCandidateScore
        {
            name = name,
            directionWorld = direction,
            waypoint = waypoint,
            score = score,
            clearanceMeters = clearance,
            deltaV = burn.estimatedDeltaV,
            headingChangeDegrees = headingChange,
            lateralSpeedPenalty = lateralPenalty,
            fuelRemainingKg = Mathf.Max(0f, snapshot.availableFuelKg - burn.estimatedFuelKg),
            canBrakeBeforeTarget = canBrake,
            rcsAuthorityMargin = rcsMargin,
            collisionPredicted = collisionPredicted,
            fuelInsufficient = fuelInsufficient,
            reason = BuildCandidateReason(name, collisionPredicted, clearance, canBrake, fuelInsufficient, rcsMargin)
        });
    }

    private static int SelectBestCandidate(List<PrototypeTrajectoryCandidateScore> candidates, string preferredCandidateName)
    {
        int bestIndex = 0;
        float bestScore = float.NegativeInfinity;
        for (int i = 0; i < candidates.Count; i++)
        {
            PrototypeTrajectoryCandidateScore candidate = candidates[i];
            float score = candidate.score;
            if (!string.IsNullOrWhiteSpace(preferredCandidateName) && candidate.name == preferredCandidateName)
            {
                score += 10f;
            }

            if (score > bestScore)
            {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    private static bool IsDirectCandidate(List<PrototypeTrajectoryCandidateScore> candidates, int index)
    {
        return index >= 0
            && index < candidates.Count
            && candidates[index].name == "direct";
    }

    private static int SelectBestAvoidanceCandidate(List<PrototypeTrajectoryCandidateScore> candidates, string preferredCandidateName)
    {
        int bestIndex = -1;
        float bestScore = float.NegativeInfinity;
        for (int i = 0; i < candidates.Count; i++)
        {
            PrototypeTrajectoryCandidateScore candidate = candidates[i];
            if (candidate.name == "direct")
            {
                continue;
            }

            float score = candidate.score;
            if (!string.IsNullOrWhiteSpace(preferredCandidateName) && candidate.name == preferredCandidateName)
            {
                score += 10f;
            }

            if (score > bestScore)
            {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    private static Vector3 ComputeRcsRequest(PrototypeTrajectorySnapshot snapshot, Vector3 avoidanceDirection, out bool limitedRcsAuthority)
    {
        limitedRcsAuthority = false;
        if (avoidanceDirection.sqrMagnitude <= 0.0001f || snapshot.maxRcsForce <= 0.0001f)
        {
            limitedRcsAuthority = avoidanceDirection.sqrMagnitude > 0.0001f;
            return Vector3.zero;
        }

        float desiredAcceleration = Mathf.Clamp(snapshot.maxMainAcceleration * 0.35f, 0.35f, 2.5f);
        Vector3 requested = avoidanceDirection.normalized * snapshot.massKg * desiredAcceleration;
        limitedRcsAuthority = requested.magnitude > snapshot.maxRcsForce + 0.001f;
        return Vector3.ClampMagnitude(requested, snapshot.maxRcsForce);
    }

    private static TrajectoryBurnPlan BuildBurnPlan(PrototypeTrajectorySnapshot snapshot, Vector3 direction, float throttle)
    {
        float distance = Mathf.Max(0f, snapshot.DistanceToTarget - snapshot.arrivalRadius);
        float acceleration = Mathf.Max(0.0001f, snapshot.maxMainAcceleration * Mathf.Clamp01(throttle));
        float duration = Mathf.Clamp(Mathf.Sqrt((2f * distance) / acceleration) * 0.35f, 0.25f, CandidateHorizonSeconds);
        float thrust = snapshot.mainThrustNewtons > 0f ? snapshot.mainThrustNewtons : snapshot.maxMainAcceleration * snapshot.massKg;
        return TrajectoryBurnPlan.Estimate(direction, duration, throttle, thrust, snapshot.fuelKgPerSecond, snapshot.availableFuelKg, snapshot.massKg);
    }

    private static PrototypeTrajectorySegment[] BuildSegments(
        PrototypeTrajectorySnapshot snapshot,
        Vector3 direction,
        float throttle,
        TrajectoryBurnPlan burnPlan,
        bool avoidance,
        PrototypeTrajectoryCandidateScore selected)
    {
        float missDistance = selected.waypoint.sqrMagnitude > 0.0001f
            ? Vector3.Distance(selected.waypoint, snapshot.targetPosition)
            : 0f;
        float closestObstacle = selected.clearanceMeters;
        var burnSegment = new PrototypeTrajectorySegment(
            avoidance ? PrototypeTrajectorySegmentType.AvoidanceBurn : PrototypeTrajectorySegmentType.Burn,
            burnPlan.durationSeconds,
            direction,
            throttle,
            burnPlan.estimatedDeltaV,
            burnPlan.estimatedFuelKg,
            closestObstacle,
            missDistance);
        var coast = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Coast, 1f, direction, 0f, 0f, 0f, closestObstacle, missDistance);
        var brake = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Brake, EstimateBrakeSeconds(snapshot), -snapshot.DirectionToTarget, 1f, Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget)), 0f, closestObstacle, snapshot.arrivalRadius);
        var final = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.FinalApproach, 1f, snapshot.DirectionToTarget, 0.25f, snapshot.arrivalSpeed, 0f, closestObstacle, snapshot.arrivalRadius);
        var hold = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Hold, 0.75f, Vector3.zero, 0f, 0f, 0f, closestObstacle, 0f);
        return avoidance
            ? new[] { burnSegment, coast, brake, final, hold }
            : new[] { burnSegment, coast, brake, final, hold };
    }

    private static Vector3[] PredictCandidatePath(PrototypeTrajectorySnapshot snapshot, Vector3 direction, Vector3 rcsForce, float throttle)
    {
        var initial = new TrajectoryPredictionState(
            snapshot.position,
            snapshot.velocity,
            Quaternion.LookRotation(snapshot.forward.sqrMagnitude > 0.0001f ? snapshot.forward : Vector3.forward),
            Vector3.zero,
            0f,
            snapshot.availableFuelKg);
        var settings = new TrajectoryPredictionSettings(
            Mathf.CeilToInt(CandidateHorizonSeconds / CandidateStepSeconds),
            CandidateStepSeconds,
            false,
            direction,
            snapshot.maxMainAcceleration * Mathf.Clamp01(throttle),
            rcsForce / Mathf.Max(0.01f, snapshot.massKg),
            snapshot.fuelKgPerSecond * Mathf.Clamp01(throttle));
        TrajectoryPredictionState[] states = TrajectoryPredictor.Predict(initial, null, settings);
        var points = new Vector3[states.Length];
        for (int i = 0; i < states.Length; i++)
        {
            points[i] = states[i].position;
        }

        return points;
    }

    private static float EstimateCandidateClearance(PrototypeTrajectorySnapshot snapshot, PrototypeObstacleDetectionResult detection, Vector3 direction)
    {
        if (detection.obstacle == null)
        {
            return float.PositiveInfinity;
        }

        Vector3 toObstacle = detection.obstacle.WorldPosition - snapshot.position;
        float maxDistance = Mathf.Max(snapshot.DistanceToTarget, detection.distance);
        float projected = Mathf.Clamp(Vector3.Dot(toObstacle, direction), 0f, Mathf.Max(0.01f, maxDistance));
        Vector3 closest = snapshot.position + direction * projected;
        float obstacleRadius = detection.obstacle.EffectiveClearanceRadius + snapshot.clearanceRadius;
        return Vector3.Distance(detection.obstacle.WorldPosition, closest) - obstacleRadius;
    }

    private static float EstimateLateralPenalty(PrototypeTrajectorySnapshot snapshot, Vector3 direction)
    {
        float along = Vector3.Dot(snapshot.velocity, direction);
        Vector3 lateral = snapshot.velocity - direction * along;
        return lateral.magnitude * 4f;
    }

    private static bool CanBrakeBeforeTarget(PrototypeTrajectorySnapshot snapshot)
    {
        float remainingDistance = Mathf.Max(0f, snapshot.DistanceToTarget - snapshot.arrivalRadius);
        return EstimateStoppingDistance(snapshot) <= remainingDistance;
    }

    private static float EstimateRcsAuthorityMargin(PrototypeTrajectorySnapshot snapshot, Vector3 direction)
    {
        float lateralAcceleration = EstimateLateralPenalty(snapshot, direction) * 0.25f;
        float requiredForce = snapshot.massKg * lateralAcceleration;
        return snapshot.maxRcsForce - requiredForce;
    }

    private static Vector3 ResolveObstacleDirection(PrototypeTrajectorySnapshot snapshot, PrototypeObstacleDetectionResult detection, Vector3 fallback)
    {
        if (detection.obstacle == null)
        {
            return fallback;
        }

        Vector3 direction = detection.obstacle.WorldPosition - snapshot.position;
        return direction.sqrMagnitude > 0.0001f ? direction.normalized : fallback;
    }

    private static string BuildCandidateReason(string name, bool collisionPredicted, float clearance, bool canBrake, bool fuelInsufficient, float rcsMargin)
    {
        if (fuelInsufficient)
        {
            return name + " rejected: fuel";
        }

        if (collisionPredicted)
        {
            return name + " collision clearance " + clearance.ToString("0.0") + "m";
        }

        if (!canBrake)
        {
            return name + " limited brake margin";
        }

        if (rcsMargin < 0f)
        {
            return name + " limited RCS";
        }

        return name + " feasible";
    }

    private static string BuildWarningStatus(bool limitedRcsAuthority, bool fuelInsufficient, PrototypeTrajectoryCandidateScore selected)
    {
        if (fuelInsufficient)
        {
            return "FuelInsufficient";
        }

        if (limitedRcsAuthority || selected.rcsAuthorityMargin < 0f)
        {
            return "LimitedRcsAuthority";
        }

        if (!selected.canBrakeBeforeTarget)
        {
            return "BrakeLimited";
        }

        return string.Empty;
    }

    private static float EstimateStoppingDistance(PrototypeTrajectorySnapshot snapshot)
    {
        if (snapshot.maxMainAcceleration <= 0.0001f)
        {
            return 0f;
        }

        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        return (closingSpeed * closingSpeed) / (2f * snapshot.maxMainAcceleration);
    }

    private static float EstimateBrakeSeconds(PrototypeTrajectorySnapshot snapshot)
    {
        return snapshot.maxMainAcceleration > 0.0001f
            ? Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget)) / snapshot.maxMainAcceleration
            : 0f;
    }

    private static float EstimateEta(PrototypeTrajectorySnapshot snapshot)
    {
        float distance = snapshot.DistanceToTarget;
        if (distance <= 0.0001f)
        {
            return 0f;
        }

        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        return closingSpeed > 0.0001f ? distance / closingSpeed : float.PositiveInfinity;
    }
}
