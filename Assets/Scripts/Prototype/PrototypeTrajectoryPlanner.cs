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
    public PrototypeManeuverProfile profile;
    public float plannedSwitchDistanceMeters;

    public PrototypeTrajectorySegment(
        PrototypeTrajectorySegmentType type,
        float durationSeconds,
        Vector3 directionWorld,
        float throttle,
        float expectedDeltaV,
        float expectedFuelKg,
        float predictedClosestObstacleDistance,
        float predictedMissDistanceToTarget,
        PrototypeManeuverProfile profile = PrototypeManeuverProfile.Default,
        float plannedSwitchDistanceMeters = 0f)
    {
        this.type = type;
        this.durationSeconds = Mathf.Max(0f, durationSeconds);
        this.directionWorld = directionWorld.sqrMagnitude > 0.0001f ? directionWorld.normalized : Vector3.forward;
        this.throttle = Mathf.Clamp01(throttle);
        this.expectedDeltaV = Mathf.Max(0f, expectedDeltaV);
        this.expectedFuelKg = Mathf.Max(0f, expectedFuelKg);
        this.predictedClosestObstacleDistance = predictedClosestObstacleDistance;
        this.predictedMissDistanceToTarget = Mathf.Max(0f, predictedMissDistanceToTarget);
        this.profile = profile;
        this.plannedSwitchDistanceMeters = Mathf.Max(0f, plannedSwitchDistanceMeters);
    }
}

public struct PrototypeDirectFastTransferSolution
{
    public bool isValid;
    public bool brakeImmediately;
    public Vector3 routeDirectionWorld;
    public Vector3 lateralVelocityWorld;
    public float alignTimeSeconds;
    public float alignDriftMeters;
    public float distanceMeters;
    public float vAlong0MetersPerSecond;
    public float vLat0MetersPerSecond;
    public float burnAccelerationMetersPerSecondSquared;
    public float brakeAccelerationMetersPerSecondSquared;
    public float flipTimeSeconds;
    public float flipDriftMeters;
    public float effectiveDistanceMeters;
    public float vPeakSquared;
    public float tBurnSeconds;
    public float sBurnMeters;
    public float tBrakeSeconds;
    public float sBrakeMeters;
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
    public PrototypeFlightPlan flightPlan;
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
            flightPlan = PrototypeFlightPlan.CreateInvalid(
                "legacy-clear",
                0,
                direction,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "Legacy clear plan only"),
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
    private const float MinimumAttitudeSegmentSeconds = 0.2f;
    private const float MaximumAttitudeSegmentSeconds = 12f;
    private const float AttitudeLatchMarginSeconds = 0.4f;
    private const float DirectFastTransferMinimumMainSeconds = 0.2f;
    private const float DirectFastTransferMinimumDistanceMeters = 1.5f;
    private readonly List<PrototypeTrajectoryCandidateScore> candidateBuffer = new List<PrototypeTrajectoryCandidateScore>(10);

    public PrototypeTrajectoryPlan Plan(PrototypeTrajectorySnapshot snapshot, PrototypeObstacleDetectionResult detection)
    {
        return Plan(
            snapshot,
            detection,
            CreatePlanningSnapshot(snapshot),
            0f,
            TrajectoryPredictor.DefaultFixedDeltaTime,
            false,
            Vector3.zero,
            string.Empty);
    }

    public PrototypeTrajectoryPlan Plan(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float createdAtTimeSeconds = 0f,
        float fixedDeltaTimeSeconds = TrajectoryPredictor.DefaultFixedDeltaTime)
    {
        return Plan(
            snapshot,
            detection,
            shipSnapshot,
            createdAtTimeSeconds,
            fixedDeltaTimeSeconds,
            false,
            Vector3.zero,
            string.Empty);
    }

    public PrototypeTrajectoryPlan Plan(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        bool keepAvoidanceWaypoint,
        Vector3 stableAvoidanceWaypoint,
        string preferredCandidateName)
    {
        return Plan(
            snapshot,
            detection,
            CreatePlanningSnapshot(snapshot),
            0f,
            TrajectoryPredictor.DefaultFixedDeltaTime,
            keepAvoidanceWaypoint,
            stableAvoidanceWaypoint,
            preferredCandidateName);
    }

    public PrototypeTrajectoryPlan Plan(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeObstacleDetectionResult detection,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float createdAtTimeSeconds,
        float fixedDeltaTimeSeconds,
        bool keepAvoidanceWaypoint,
        Vector3 stableAvoidanceWaypoint,
        string preferredCandidateName,
        bool suppressDirectFastTransfer = false)
    {
        PrototypeShipPlanningSnapshot resolvedShipSnapshot = ResolvePlanningSnapshot(snapshot, shipSnapshot);
        Vector3 targetDirection = snapshot.DirectionToTarget;
        bool hasBlockingObstacle = detection.detected && detection.obstacle != null;
        if (!hasBlockingObstacle && !keepAvoidanceWaypoint)
        {
            PrototypeTrajectoryPlan clearPlan = PrototypeTrajectoryPlan.Clear(targetDirection);
            FillDirectDiagnostics(ref clearPlan, snapshot, resolvedShipSnapshot, createdAtTimeSeconds, fixedDeltaTimeSeconds, suppressDirectFastTransfer);
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
        PrototypeTrajectorySegment[] segments = BuildSegments(snapshot, resolvedShipSnapshot, selectedDirection, requestedThrottle, burnPlan, avoidance, selected, suppressDirectFastTransfer);
        burnPlan = ResolvePrimaryBurnPlan(snapshot, segments, burnPlan);
        bool fuelInsufficient = selected.fuelInsufficient || SegmentsRequireMoreFuelThanAvailable(segments, snapshot.fuelKgPerSecond, snapshot.availableFuelKg);
        Vector3[] predictedPath = PredictCandidatePath(snapshot, selectedDirection, requestedRcsForce, requestedThrottle);
        PrototypeFlightPlan flightPlan = BuildFlightPlan(
            snapshot,
            resolvedShipSnapshot,
            createdAtTimeSeconds,
            fixedDeltaTimeSeconds,
            segments,
            requestedRcsForce,
            fuelInsufficient,
            fuelInsufficient ? PrototypeFlightPlanAbortReplanReason.FuelStarved : PrototypeFlightPlanAbortReplanReason.None,
            fuelInsufficient ? "Fuel insufficient" : (avoidance ? "Executable avoidance plan" : "Executable direct plan"));

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
            flightPlan = flightPlan,
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

    private static void FillDirectDiagnostics(
        ref PrototypeTrajectoryPlan clearPlan,
        PrototypeTrajectorySnapshot snapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float createdAtTimeSeconds,
        float fixedDeltaTimeSeconds,
        bool suppressDirectFastTransfer)
    {
        clearPlan.plannedStoppingDistance = EstimateStoppingDistance(snapshot);
        clearPlan.plannedEtaSeconds = EstimateEta(snapshot);
        clearPlan.desiredAccelerationWorld = clearPlan.desiredBurnDirection * snapshot.maxMainAcceleration;
        clearPlan.burnPlan = BuildBurnPlan(snapshot, clearPlan.desiredBurnDirection, 1f);
        clearPlan.segments = BuildSegments(snapshot, shipSnapshot, clearPlan.desiredBurnDirection, 1f, clearPlan.burnPlan, false, default, suppressDirectFastTransfer);
        clearPlan.burnPlan = ResolvePrimaryBurnPlan(snapshot, clearPlan.segments, clearPlan.burnPlan);
        clearPlan.activeSegment = clearPlan.segments.Length > 0 ? clearPlan.segments[0] : default;
        clearPlan.activeSegmentType = clearPlan.activeSegment.type;
        clearPlan.predictedPath = PredictCandidatePath(snapshot, clearPlan.desiredBurnDirection, Vector3.zero, 1f);
        clearPlan.flightPlan = BuildFlightPlan(
            snapshot,
            shipSnapshot,
            createdAtTimeSeconds,
            fixedDeltaTimeSeconds,
            clearPlan.segments,
            Vector3.zero,
            false,
            PrototypeFlightPlanAbortReplanReason.None,
            "Executable direct plan");
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

    private static bool SolveDirectFastTransfer(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        out PrototypeDirectFastTransferSolution solution)
    {
        solution = default;
        Vector3 route = snapshot.targetPosition - snapshot.position;
        float distance = route.magnitude;
        if (distance <= Mathf.Max(DirectFastTransferMinimumDistanceMeters, snapshot.arrivalRadius * 0.5f)
            || ShouldUseFinalOnlySegments(snapshot))
        {
            return false;
        }

        Vector3 routeDirection = route / distance;
        float mass = ResolvePlanMass(shipSnapshot);
        float thrust = shipSnapshot.mainThrustNewtons > 0f
            ? shipSnapshot.mainThrustNewtons
            : snapshot.mainThrustNewtons > 0f
                ? snapshot.mainThrustNewtons
                : snapshot.maxMainAcceleration * mass;
        float burnAcceleration = mass > 0.0001f ? thrust / mass : 0f;
        float brakeAcceleration = burnAcceleration;
        if (burnAcceleration <= 0.0001f || brakeAcceleration <= 0.0001f)
        {
            return false;
        }

        float alignTime = 0f;
        Vector3 alignedPosition = snapshot.position;
        for (int i = 0; i < 3; i++)
        {
            alignTime = EstimateAttitudeSegmentSeconds(shipSnapshot.initialState.rotation, routeDirection, shipSnapshot);
            alignedPosition = snapshot.position + snapshot.velocity * alignTime;
            route = snapshot.targetPosition - alignedPosition;
            distance = route.magnitude;
            if (distance <= Mathf.Max(DirectFastTransferMinimumDistanceMeters, snapshot.arrivalRadius * 0.5f))
            {
                return false;
            }

            routeDirection = route / distance;
        }

        float vAlong0 = Vector3.Dot(snapshot.velocity, routeDirection);
        Vector3 lateralVelocity = snapshot.velocity - routeDirection * vAlong0;
        float vLat0 = lateralVelocity.magnitude;
        Quaternion burnRotation = ResolveLookRotation(routeDirection, shipSnapshot.initialState.rotation);
        float flipTime = EstimateAttitudeSegmentSeconds(burnRotation, -routeDirection, shipSnapshot);
        float effectiveDistance = distance;
        float vPeakSquared = 0f;
        float vPeak = Mathf.Max(0f, vAlong0);
        float flipDrift = 0f;

        for (int i = 0; i < 3; i++)
        {
            float numerator = (2f * burnAcceleration * brakeAcceleration * effectiveDistance)
                + brakeAcceleration * vAlong0 * vAlong0;
            vPeakSquared = Mathf.Max(0f, numerator / (burnAcceleration + brakeAcceleration));
            vPeak = Mathf.Sqrt(vPeakSquared);
            flipDrift = Mathf.Max(0f, vPeak) * flipTime;
            effectiveDistance = Mathf.Max(0f, distance - flipDrift);
        }

        float stoppingDistanceNow = vAlong0 > 0f
            ? (vAlong0 * vAlong0) / (2f * brakeAcceleration) + Mathf.Max(0f, vAlong0) * flipTime
            : 0f;
        bool brakeImmediately = vAlong0 > snapshot.arrivalSpeed
            && (stoppingDistanceNow >= distance || vPeak <= vAlong0 + 0.01f);

        float tBurn = brakeImmediately ? 0f : Mathf.Max(0f, (vPeak - vAlong0) / burnAcceleration);
        float sBurn = brakeImmediately ? 0f : Mathf.Max(0f, (vPeakSquared - vAlong0 * vAlong0) / (2f * burnAcceleration));
        float brakeSpeed = brakeImmediately
            ? Mathf.Max(0f, snapshot.velocity.magnitude)
            : vPeak;
        float tBrake = brakeSpeed / brakeAcceleration;
        float sBrake = brakeImmediately
            ? (brakeSpeed * brakeSpeed) / (2f * brakeAcceleration)
            : vPeakSquared / (2f * brakeAcceleration);

        bool hasMainWork = brakeImmediately
            ? tBrake >= DirectFastTransferMinimumMainSeconds
            : tBurn >= DirectFastTransferMinimumMainSeconds && tBrake >= DirectFastTransferMinimumMainSeconds;
        if (!hasMainWork)
        {
            return false;
        }

        float totalTransferSeconds = Mathf.Max(0f, alignTime) + Mathf.Max(0f, tBurn) + Mathf.Max(0f, flipTime) + Mathf.Max(0f, tBrake);
        if (!IsDirectFastTransferLateralFeasible(snapshot, shipSnapshot, vLat0, totalTransferSeconds))
        {
            return false;
        }

        solution = new PrototypeDirectFastTransferSolution
        {
            isValid = true,
            brakeImmediately = brakeImmediately,
            routeDirectionWorld = routeDirection,
            lateralVelocityWorld = lateralVelocity,
            alignTimeSeconds = alignTime,
            alignDriftMeters = Vector3.Distance(snapshot.position, alignedPosition),
            distanceMeters = distance,
            vAlong0MetersPerSecond = vAlong0,
            vLat0MetersPerSecond = vLat0,
            burnAccelerationMetersPerSecondSquared = burnAcceleration,
            brakeAccelerationMetersPerSecondSquared = brakeAcceleration,
            flipTimeSeconds = flipTime,
            flipDriftMeters = flipDrift,
            effectiveDistanceMeters = effectiveDistance,
            vPeakSquared = vPeakSquared,
            tBurnSeconds = tBurn,
            sBurnMeters = sBurn,
            tBrakeSeconds = tBrake,
            sBrakeMeters = sBrake
        };
        return true;
    }

    private static bool IsDirectFastTransferLateralFeasible(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float lateralSpeedMetersPerSecond,
        float totalTransferSeconds)
    {
        float speedTolerance = Mathf.Max(0.25f, snapshot.arrivalSpeed * 1.25f, snapshot.lateralTolerance * 2f);
        if (lateralSpeedMetersPerSecond <= speedTolerance)
        {
            return true;
        }

        float correctionWindow = Mathf.Max(0f, totalTransferSeconds);
        if (correctionWindow <= 0.0001f)
        {
            return false;
        }

        float lateralForce = shipSnapshot.rcsTranslationForceNewtons > 0.0001f
            ? shipSnapshot.rcsTranslationForceNewtons
            : snapshot.maxRcsForce;
        float mass = ResolvePlanMass(shipSnapshot);
        float lateralAcceleration = mass > 0.0001f ? lateralForce / mass : 0f;
        float driftTolerance = Mathf.Max(
            snapshot.arrivalRadius * 0.8f,
            speedTolerance * Mathf.Max(0.5f, correctionWindow * 0.25f));

        if (lateralAcceleration <= 0.0001f)
        {
            float uncorrectedDrift = lateralSpeedMetersPerSecond * correctionWindow;
            return uncorrectedDrift <= driftTolerance
                && lateralSpeedMetersPerSecond <= speedTolerance * 1.5f;
        }

        float stopTime = lateralSpeedMetersPerSecond / lateralAcceleration;
        float stopDrift = (lateralSpeedMetersPerSecond * lateralSpeedMetersPerSecond) / (2f * lateralAcceleration);
        float returnToRouteTime = (1f + Mathf.Sqrt(2f)) * stopTime;
        if (returnToRouteTime <= correctionWindow)
        {
            return true;
        }

        return stopTime <= correctionWindow * 0.85f
            && stopDrift <= driftTolerance;
    }

    private static bool TryBuildDirectFastTransferSegments(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float closestObstacle,
        float missDistance,
        out PrototypeTrajectorySegment[] segments)
    {
        segments = null;
        if (!SolveDirectFastTransfer(snapshot, shipSnapshot, out PrototypeDirectFastTransferSolution solution)
            || !solution.isValid)
        {
            return false;
        }

        float thrust = shipSnapshot.mainThrustNewtons > 0f
            ? shipSnapshot.mainThrustNewtons
            : snapshot.mainThrustNewtons > 0f
                ? snapshot.mainThrustNewtons
                : snapshot.maxMainAcceleration * snapshot.massKg;
        TrajectoryBurnPlan burnPlan = solution.tBurnSeconds > 0f
            ? TrajectoryBurnPlan.Estimate(
                solution.routeDirectionWorld,
                solution.tBurnSeconds,
                1f,
                thrust,
                snapshot.fuelKgPerSecond,
                snapshot.availableFuelKg,
                snapshot.massKg)
            : TrajectoryBurnPlan.None;
        float fuelAfterBurn = Mathf.Max(0f, snapshot.availableFuelKg - burnPlan.estimatedFuelKg);
        Vector3 brakeDirection = solution.brakeImmediately && snapshot.velocity.sqrMagnitude > 0.0001f
            ? -snapshot.velocity.normalized
            : -solution.routeDirectionWorld;
        TrajectoryBurnPlan brakePlan = TrajectoryBurnPlan.Estimate(
            brakeDirection,
            solution.tBrakeSeconds,
            1f,
            thrust,
            snapshot.fuelKgPerSecond,
            fuelAfterBurn,
            snapshot.massKg);
        var brake = new PrototypeTrajectorySegment(
            PrototypeTrajectorySegmentType.Brake,
            solution.tBrakeSeconds,
            brakeDirection,
            1f,
            brakePlan.estimatedDeltaV,
            brakePlan.estimatedFuelKg,
            closestObstacle,
            snapshot.arrivalRadius,
            PrototypeManeuverProfile.DirectFastTransfer,
            solution.sBurnMeters);
        var hold = new PrototypeTrajectorySegment(
            PrototypeTrajectorySegmentType.Hold,
            0.75f,
            Vector3.zero,
            0f,
            0f,
            0f,
            closestObstacle,
            0f,
            PrototypeManeuverProfile.DirectFastTransfer,
            solution.distanceMeters);

        if (solution.brakeImmediately)
        {
            segments = new[] { brake, hold };
            return true;
        }

        var burn = new PrototypeTrajectorySegment(
            PrototypeTrajectorySegmentType.Burn,
            solution.tBurnSeconds,
            solution.routeDirectionWorld,
            1f,
            burnPlan.estimatedDeltaV,
            burnPlan.estimatedFuelKg,
            closestObstacle,
            missDistance,
            PrototypeManeuverProfile.DirectFastTransfer,
            solution.sBurnMeters);
        segments = new[] { burn, brake, hold };
        return true;
    }

    private static PrototypeTrajectorySegment[] BuildSegments(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        Vector3 direction,
        float throttle,
        TrajectoryBurnPlan burnPlan,
        bool avoidance,
        PrototypeTrajectoryCandidateScore selected,
        bool suppressDirectFastTransfer)
    {
        float missDistance = selected.waypoint.sqrMagnitude > 0.0001f
            ? Vector3.Distance(selected.waypoint, snapshot.targetPosition)
            : 0f;
        float closestObstacle = selected.clearanceMeters > 0f
            ? selected.clearanceMeters
            : float.PositiveInfinity;
        if (!avoidance
            && !suppressDirectFastTransfer
            && TryBuildDirectFastTransferSegments(snapshot, shipSnapshot, closestObstacle, missDistance, out PrototypeTrajectorySegment[] directSegments))
        {
            return directSegments;
        }

        var coast = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Coast, 1f, direction, 0f, 0f, 0f, closestObstacle, missDistance);
        Vector3 brakeDirection = ResolveBrakeDirection(snapshot);
        float brakeDeltaV = ResolveBrakeDeltaV(snapshot);
        var brake = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Brake, EstimateBrakeSeconds(snapshot), brakeDirection, 1f, brakeDeltaV, 0f, closestObstacle, snapshot.arrivalRadius);
        var final = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.FinalApproach, 1f, snapshot.DirectionToTarget, 0.25f, snapshot.arrivalSpeed, 0f, closestObstacle, snapshot.arrivalRadius);
        var hold = new PrototypeTrajectorySegment(PrototypeTrajectorySegmentType.Hold, 0.75f, Vector3.zero, 0f, 0f, 0f, closestObstacle, 0f);
        if (ShouldUseFinalOnlySegments(snapshot))
        {
            return new[] { final, hold };
        }

        var burnSegment = new PrototypeTrajectorySegment(
            avoidance ? PrototypeTrajectorySegmentType.AvoidanceBurn : PrototypeTrajectorySegmentType.Burn,
            burnPlan.durationSeconds,
            direction,
            throttle,
            burnPlan.estimatedDeltaV,
            burnPlan.estimatedFuelKg,
            closestObstacle,
            missDistance);
        if (!avoidance && ShouldStartWithBrakeSegment(snapshot))
        {
            return new[] { brake, final, hold };
        }

        return new[] { burnSegment, coast, brake, final, hold };
    }

    private static TrajectoryBurnPlan ResolvePrimaryBurnPlan(
        PrototypeTrajectorySnapshot snapshot,
        PrototypeTrajectorySegment[] segments,
        TrajectoryBurnPlan fallback)
    {
        if (segments == null)
        {
            return fallback;
        }

        for (int i = 0; i < segments.Length; i++)
        {
            PrototypeTrajectorySegment segment = segments[i];
            if (segment.type != PrototypeTrajectorySegmentType.Burn
                && segment.type != PrototypeTrajectorySegmentType.AvoidanceBurn)
            {
                continue;
            }

            float thrust = snapshot.mainThrustNewtons > 0f
                ? snapshot.mainThrustNewtons
                : snapshot.maxMainAcceleration * snapshot.massKg;
            return TrajectoryBurnPlan.Estimate(
                segment.directionWorld,
                segment.durationSeconds,
                segment.throttle,
                thrust,
                snapshot.fuelKgPerSecond,
                snapshot.availableFuelKg,
                snapshot.massKg);
        }

        return fallback;
    }

    private static bool SegmentsRequireMoreFuelThanAvailable(
        PrototypeTrajectorySegment[] segments,
        float fuelKgPerSecond,
        float availableFuelKg)
    {
        if (segments == null || segments.Length == 0 || fuelKgPerSecond <= 0f)
        {
            return false;
        }

        float requestedFuel = 0f;
        for (int i = 0; i < segments.Length; i++)
        {
            PrototypeTrajectorySegment segment = segments[i];
            if (segment.type != PrototypeTrajectorySegmentType.Burn
                && segment.type != PrototypeTrajectorySegmentType.AvoidanceBurn
                && segment.type != PrototypeTrajectorySegmentType.Brake
                && segment.type != PrototypeTrajectorySegmentType.FinalApproach)
            {
                continue;
            }

            requestedFuel += fuelKgPerSecond * Mathf.Clamp01(segment.throttle) * Mathf.Max(0f, segment.durationSeconds);
        }

        return requestedFuel > Mathf.Max(0f, availableFuelKg) + 0.0001f;
    }

    private static bool ShouldUseFinalOnlySegments(PrototypeTrajectorySnapshot snapshot)
    {
        float finalDistance = snapshot.arrivalRadius + Mathf.Max(snapshot.arrivalRadius * 0.8f, snapshot.arrivalSpeed * 4f);
        float finalSpeed = Mathf.Max(0.95f, snapshot.arrivalSpeed * 2.2f);
        if (snapshot.DistanceToTarget > finalDistance)
        {
            return false;
        }

        if (snapshot.velocity.magnitude <= finalSpeed)
        {
            return true;
        }

        Vector3 direction = snapshot.DirectionToTarget;
        float closingSpeed = Vector3.Dot(snapshot.velocity, direction);
        Vector3 lateralVelocity = snapshot.velocity - direction * closingSpeed;
        float lateralCorrectionSpeed = Mathf.Max(snapshot.arrivalSpeed * 6f, snapshot.lateralTolerance * 12f);
        return Mathf.Abs(closingSpeed) <= Mathf.Max(0.75f, snapshot.arrivalSpeed * 1.25f)
            && lateralVelocity.magnitude <= lateralCorrectionSpeed;
    }

    private static bool ShouldStartWithBrakeSegment(PrototypeTrajectorySnapshot snapshot)
    {
        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        float brakeSpeed = Mathf.Max(0.35f, snapshot.arrivalSpeed * 1.35f);
        float relativeSpeed = snapshot.velocity.magnitude;
        float terminalBrakeDistance = snapshot.arrivalRadius + Mathf.Max(snapshot.arrivalRadius * 2f, snapshot.arrivalSpeed * 8f);
        bool terminalHighDeltaV = snapshot.DistanceToTarget <= terminalBrakeDistance
            && relativeSpeed > Mathf.Max(0.95f, snapshot.arrivalSpeed * 2.2f);
        if (closingSpeed <= brakeSpeed && !terminalHighDeltaV)
        {
            return false;
        }

        float distanceToArrival = Mathf.Max(0f, snapshot.DistanceToTarget - snapshot.arrivalRadius);
        float alignmentLeadDistance = EstimateBrakeAlignmentLeadDistance(snapshot, ResolveBrakeDirection(snapshot));
        float brakeCommitMargin = Mathf.Max(snapshot.arrivalRadius * 1.5f, closingSpeed * 1.25f);
        return terminalHighDeltaV
            || snapshot.DistanceToTarget <= snapshot.arrivalRadius + brakeCommitMargin
            || EstimateStoppingDistance(snapshot) + alignmentLeadDistance + brakeCommitMargin >= distanceToArrival;
    }

    private static Vector3 ResolveBrakeDirection(PrototypeTrajectorySnapshot snapshot)
    {
        float closingSpeed = Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget);
        Vector3 lateralVelocity = snapshot.velocity - snapshot.DirectionToTarget * closingSpeed;
        if (snapshot.velocity.sqrMagnitude > 0.0001f
            && (closingSpeed <= 0f || lateralVelocity.magnitude > Mathf.Max(0.35f, closingSpeed)))
        {
            return -snapshot.velocity.normalized;
        }

        return -snapshot.DirectionToTarget;
    }

    private static float ResolveBrakeDeltaV(PrototypeTrajectorySnapshot snapshot)
    {
        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        float relativeSpeed = snapshot.velocity.magnitude;
        bool terminalHighDeltaV = snapshot.DistanceToTarget <= snapshot.arrivalRadius + Mathf.Max(snapshot.arrivalRadius * 2f, snapshot.arrivalSpeed * 8f)
            && relativeSpeed > Mathf.Max(0.95f, snapshot.arrivalSpeed * 2.2f);
        return terminalHighDeltaV ? relativeSpeed : closingSpeed;
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

    private static PrototypeFlightPlan BuildFlightPlan(
        PrototypeTrajectorySnapshot trajectorySnapshot,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float createdAtTimeSeconds,
        float fixedDeltaTimeSeconds,
        PrototypeTrajectorySegment[] legacySegments,
        Vector3 requestedRcsForceWorld,
        bool forceNonExecutable,
        PrototypeFlightPlanAbortReplanReason forcedReason,
        string statusLabel)
    {
        PrototypeTrajectorySegment[] sourceSegments = legacySegments ?? Array.Empty<PrototypeTrajectorySegment>();
        if (sourceSegments.Length == 0)
        {
            return PrototypeFlightPlan.CreateInvalid(
                BuildPlanId(trajectorySnapshot, "empty"),
                0,
                trajectorySnapshot.targetPosition,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "No maneuver segments");
        }

        float fixedDelta = fixedDeltaTimeSeconds > 0f && TrajectoryPredictionMath.IsFinite(fixedDeltaTimeSeconds)
            ? fixedDeltaTimeSeconds
            : TrajectoryPredictor.DefaultFixedDeltaTime;
        var maneuvers = new List<PrototypeManeuverSegment>(sourceSegments.Length + 2);
        var samples = new List<PrototypeTrajectoryPredictedSample>(64);
        TrajectoryPredictionState current = CreateInitialPredictionState(trajectorySnapshot, shipSnapshot);
        float cursorSeconds = 0f;
        float mainAcceleration = ResolveMainAcceleration(trajectorySnapshot, shipSnapshot);
        float mainFuelRate = ResolveMainFuelRate(trajectorySnapshot, shipSnapshot);
        PrototypeFlightPlanTolerance tolerance = CreateFlightPlanTolerance(trajectorySnapshot);
        bool isDirectFastTransfer = IsDirectFastTransferPlan(sourceSegments);

        AddPredictedSample(samples, current, -1, PrototypeManeuverPhase.None, 0f, Vector3.zero);
        for (int i = 0; i < sourceSegments.Length; i++)
        {
            PrototypeTrajectorySegment legacy = sourceSegments[i];
            if (IsNoOpLegacySegment(legacy))
            {
                continue;
            }

            Vector3 direction = legacy.directionWorld.sqrMagnitude > 0.0001f
                ? legacy.directionWorld.normalized
                : trajectorySnapshot.DirectionToTarget;

            if ((legacy.type == PrototypeTrajectorySegmentType.Burn || legacy.type == PrototypeTrajectorySegmentType.AvoidanceBurn)
                && maneuvers.Count == 0)
            {
                float alignSeconds = EstimateAttitudeSegmentSeconds(current.rotation, direction, shipSnapshot);
                AddManeuverSegment(
                    maneuvers,
                    samples,
                    ref current,
                    ref cursorSeconds,
                    PrototypeManeuverPhase.AlignForBurn,
                    PrototypeManeuverCommandMode.AttitudeOnly,
                    alignSeconds,
                    direction,
                    0f,
                    0f,
                    Vector3.zero,
                    0f,
                    0f,
                    0f,
                    tolerance,
                    "Align burn",
                    shipSnapshot,
                    fixedDelta,
                    mainAcceleration,
                    mainFuelRate,
                    true,
                    legacy.profile,
                    legacy.plannedSwitchDistanceMeters);
            }

            if (legacy.type == PrototypeTrajectorySegmentType.Brake)
            {
                float flipSeconds = EstimateAttitudeSegmentSeconds(current.rotation, direction, shipSnapshot);
                AddManeuverSegment(
                    maneuvers,
                    samples,
                    ref current,
                    ref cursorSeconds,
                    PrototypeManeuverPhase.FlipToRetrograde,
                    PrototypeManeuverCommandMode.AttitudeOnly,
                    flipSeconds,
                    direction,
                    0f,
                    0f,
                    Vector3.zero,
                    0f,
                    0f,
                    0f,
                    tolerance,
                    "Flip retrograde",
                    shipSnapshot,
                    fixedDelta,
                    mainAcceleration,
                    mainFuelRate,
                    true,
                    legacy.profile,
                    legacy.plannedSwitchDistanceMeters);
            }

            bool isReacquireAfterAvoidance = legacy.type == PrototypeTrajectorySegmentType.Coast
                && i > 0
                && sourceSegments[i - 1].type == PrototypeTrajectorySegmentType.AvoidanceBurn;
            PrototypeManeuverPhase phase = isReacquireAfterAvoidance
                ? PrototypeManeuverPhase.ReacquireRoute
                : MapManeuverPhase(legacy.type);
            PrototypeManeuverCommandMode mode = MapCommandMode(legacy.type, legacy.throttle, requestedRcsForceWorld);
            Vector3 rcsForce = UsesRcsTranslation(mode) ? requestedRcsForceWorld : Vector3.zero;
            float rcsScale = ResolveRcsTranslationScale(rcsForce, shipSnapshot);
            float mainFuel = ResolveExpectedMainFuel(legacy, mode, mainFuelRate);
            AddManeuverSegment(
                maneuvers,
                samples,
                ref current,
                ref cursorSeconds,
                phase,
                mode,
                legacy.durationSeconds,
                direction,
                legacy.throttle,
                rcsScale,
                rcsForce,
                legacy.expectedDeltaV,
                mainFuel,
                0f,
                tolerance,
                isReacquireAfterAvoidance ? "Reacquire route" : BuildManeuverLabel(legacy.type, legacy.profile),
                shipSnapshot,
                fixedDelta,
                mainAcceleration,
                mainFuelRate,
                mode == PrototypeManeuverCommandMode.RcsAttitude,
                legacy.profile,
                legacy.plannedSwitchDistanceMeters);

        }

        if (maneuvers.Count == 0)
        {
            return PrototypeFlightPlan.CreateInvalid(
                BuildPlanId(trajectorySnapshot, "empty"),
                0,
                trajectorySnapshot.targetPosition,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "No executable maneuvers");
        }

        PrototypeFlightPlanAbortReplanReason reasons = forcedReason | BuildAuthorityReasons(shipSnapshot, maneuvers);
        bool executable = !forceNonExecutable && reasons == PrototypeFlightPlanAbortReplanReason.None;
        return new PrototypeFlightPlan(
            BuildPlanId(trajectorySnapshot, sourceSegments[0].type.ToString()),
            0,
            createdAtTimeSeconds,
            fixedDelta,
            trajectorySnapshot.targetPosition,
            trajectorySnapshot.arrivalRadius,
            trajectorySnapshot.arrivalSpeed,
            shipSnapshot,
            maneuvers.ToArray(),
            samples.ToArray(),
            executable,
            reasons,
            statusLabel,
            trajectorySnapshot.targetPosition,
            isDirectFastTransfer ? PrototypeManeuverProfile.DirectFastTransfer : PrototypeManeuverProfile.Default);
    }

    private static void AddManeuverSegment(
        List<PrototypeManeuverSegment> maneuvers,
        List<PrototypeTrajectoryPredictedSample> samples,
        ref TrajectoryPredictionState current,
        ref float cursorSeconds,
        PrototypeManeuverPhase phase,
        PrototypeManeuverCommandMode mode,
        float durationSeconds,
        Vector3 direction,
        float mainThrottle,
        float rcsTranslationScale,
        Vector3 rcsForceWorld,
        float expectedDeltaV,
        float expectedMainFuelKg,
        float expectedRcsFuelKg,
        PrototypeFlightPlanTolerance tolerance,
        string label,
        PrototypeShipPlanningSnapshot shipSnapshot,
        float fixedDeltaTimeSeconds,
        float mainAccelerationMetersPerSecondSquared,
        float mainFuelKgPerSecond,
        bool rotateToDirection,
        PrototypeManeuverProfile profile = PrototypeManeuverProfile.Default,
        float plannedSwitchDistanceMeters = 0f)
    {
        float duration = Mathf.Max(0f, durationSeconds);
        int index = maneuvers.Count;
        Quaternion startRotation = current.rotation;
        Quaternion endRotation = rotateToDirection
            ? ResolveLookRotation(direction, startRotation)
            : startRotation;
        if (duration <= 0f && mode == PrototypeManeuverCommandMode.AttitudeOnly)
        {
            current = new TrajectoryPredictionState(
                current.position,
                current.velocity,
                endRotation,
                Vector3.zero,
                cursorSeconds,
                current.remainingFuelKg);
            return;
        }

        Vector3 startAngularVelocity = current.angularVelocity;
        Vector3 endAngularVelocity = rotateToDirection ? Vector3.zero : current.angularVelocity;
        TrajectoryPredictionState start = new TrajectoryPredictionState(
            current.position,
            current.velocity,
            startRotation,
            current.angularVelocity,
            cursorSeconds,
            current.remainingFuelKg);
        TrajectoryPredictionState end = PredictManeuverEnd(
            start,
            duration,
            fixedDeltaTimeSeconds,
            direction,
            mainThrottle,
            UsesMainThrottle(mode) ? mainAccelerationMetersPerSecondSquared : 0f,
            UsesRcsTranslation(mode) ? rcsForceWorld : Vector3.zero,
            ResolvePlanMass(shipSnapshot),
            UsesMainThrottle(mode) ? mainFuelKgPerSecond : 0f,
            out TrajectoryPredictionState[] states);
        end = new TrajectoryPredictionState(
            end.position,
            end.velocity,
            endRotation,
            endAngularVelocity,
            cursorSeconds + duration,
            end.remainingFuelKg);

        PrototypeFlightPlanAbortReplanReason replanOn = ResolveManeuverReplanReasons(profile);
        var segment = new PrototypeManeuverSegment(
            index,
            phase,
            mode,
            cursorSeconds,
            duration,
            direction,
            start.position,
            end.position,
            start.velocity,
            end.velocity,
            startRotation,
            endRotation,
            startAngularVelocity,
            endAngularVelocity,
            UsesMainThrottle(mode) ? mainThrottle : 0f,
            rcsTranslationScale,
            expectedDeltaV,
            expectedMainFuelKg,
            expectedRcsFuelKg,
            tolerance,
            replanOn,
            label,
            profile,
            plannedSwitchDistanceMeters);
        maneuvers.Add(segment);

        for (int i = 1; i < states.Length; i++)
        {
            float progress = duration > 0f ? Mathf.Clamp01((states[i].elapsedTime - cursorSeconds) / duration) : 1f;
            Quaternion sampleRotation = Quaternion.Slerp(startRotation, endRotation, progress);
            AddPredictedSample(
                samples,
                new TrajectoryPredictionState(
                    states[i].position,
                    states[i].velocity,
                    sampleRotation,
                    Vector3.Lerp(startAngularVelocity, endAngularVelocity, progress),
                    states[i].elapsedTime,
                    states[i].remainingFuelKg),
                index,
                phase,
                UsesMainThrottle(mode) ? mainThrottle : 0f,
                UsesRcsTranslation(mode) ? rcsForceWorld : Vector3.zero);
        }

        current = end;
        cursorSeconds = segment.endTimeSeconds;
    }

    private static PrototypeFlightPlanAbortReplanReason ResolveManeuverReplanReasons(PrototypeManeuverProfile profile)
    {
        PrototypeFlightPlanAbortReplanReason reasons = PrototypeManeuverSegment.DefaultReplanReasons;
        if (profile == PrototypeManeuverProfile.DirectFastTransfer)
        {
            reasons &= ~PrototypeFlightPlanAbortReplanReason.FuelMismatch;
        }

        return reasons;
    }

    private static TrajectoryPredictionState PredictManeuverEnd(
        TrajectoryPredictionState start,
        float durationSeconds,
        float fixedDeltaTimeSeconds,
        Vector3 direction,
        float throttle,
        float mainAccelerationMetersPerSecondSquared,
        Vector3 rcsForceWorld,
        float massKg,
        float mainFuelKgPerSecond,
        out TrajectoryPredictionState[] states)
    {
        if (durationSeconds <= 0f)
        {
            states = new[] { start };
            return start;
        }

        int steps = Mathf.Clamp(Mathf.CeilToInt(durationSeconds / Mathf.Max(0.0001f, fixedDeltaTimeSeconds)), 1, TrajectoryPredictor.MaxStepCount);
        float stepSeconds = durationSeconds / steps;
        Vector3 rcsAcceleration = massKg > 0.0001f ? rcsForceWorld / massKg : Vector3.zero;
        var settings = new TrajectoryPredictionSettings(
            steps,
            stepSeconds,
            false,
            direction,
            Mathf.Max(0f, mainAccelerationMetersPerSecondSquared) * Mathf.Clamp01(throttle),
            rcsAcceleration,
            Mathf.Max(0f, mainFuelKgPerSecond) * Mathf.Clamp01(throttle));
        states = TrajectoryPredictor.Predict(start, null, settings);
        return states.Length > 0 ? states[states.Length - 1] : start;
    }

    private static void AddPredictedSample(
        List<PrototypeTrajectoryPredictedSample> samples,
        TrajectoryPredictionState state,
        int segmentIndex,
        PrototypeManeuverPhase phase,
        float mainThrottle,
        Vector3 rcsForceWorld)
    {
        samples.Add(new PrototypeTrajectoryPredictedSample(
            state.elapsedTime,
            segmentIndex,
            phase,
            state.position,
            state.velocity,
            state.rotation,
            state.angularVelocity,
            state.remainingFuelKg,
            mainThrottle,
            rcsForceWorld));
    }

    private static PrototypeShipPlanningSnapshot CreatePlanningSnapshot(PrototypeTrajectorySnapshot snapshot)
    {
        float mainThrust = snapshot.mainThrustNewtons > 0f
            ? snapshot.mainThrustNewtons
            : snapshot.maxMainAcceleration * snapshot.massKg;
        return new PrototypeShipPlanningSnapshot(
            new TrajectoryPredictionState(
                snapshot.position,
                snapshot.velocity,
                Quaternion.LookRotation(snapshot.forward.sqrMagnitude > 0.0001f ? snapshot.forward : Vector3.forward),
                Vector3.zero,
                0f,
                snapshot.availableFuelKg),
            snapshot.position,
            Vector3.zero,
            Vector3.one,
            Quaternion.identity,
            snapshot.massKg,
            snapshot.availableFuelKg,
            snapshot.availableFuelKg,
            mainThrust,
            snapshot.fuelKgPerSecond,
            0.35f,
            0f,
            0f,
            0f,
            0f,
            snapshot.maxRcsForce,
            snapshot.maxRcsForce,
            0f,
            0f,
            false,
            false,
            false,
            false,
            false,
            mainThrust > 0f ? 1 : 0,
            snapshot.maxRcsForce > 0f ? 1 : 0,
            0);
    }

    private static PrototypeShipPlanningSnapshot ResolvePlanningSnapshot(
        PrototypeTrajectorySnapshot trajectorySnapshot,
        PrototypeShipPlanningSnapshot shipSnapshot)
    {
        return shipSnapshot.IsFinite && shipSnapshot.rigidbodyMassKg > 0.0001f
            ? shipSnapshot
            : CreatePlanningSnapshot(trajectorySnapshot);
    }

    private static TrajectoryPredictionState CreateInitialPredictionState(
        PrototypeTrajectorySnapshot trajectorySnapshot,
        PrototypeShipPlanningSnapshot shipSnapshot)
    {
        if (shipSnapshot.initialState.IsFinite && shipSnapshot.rigidbodyMassKg > 0.0001f)
        {
            return new TrajectoryPredictionState(
                shipSnapshot.initialState.position,
                shipSnapshot.initialState.velocity,
                shipSnapshot.initialState.rotation,
                shipSnapshot.initialState.angularVelocity,
                0f,
                shipSnapshot.currentFuelKg);
        }

        return new TrajectoryPredictionState(
            trajectorySnapshot.position,
            trajectorySnapshot.velocity,
            Quaternion.LookRotation(trajectorySnapshot.forward.sqrMagnitude > 0.0001f ? trajectorySnapshot.forward : Vector3.forward),
            Vector3.zero,
            0f,
            trajectorySnapshot.availableFuelKg);
    }

    private static float ResolvePlanMass(PrototypeShipPlanningSnapshot shipSnapshot)
    {
        return Mathf.Max(0.01f, shipSnapshot.rigidbodyMassKg);
    }

    private static float ResolveMainAcceleration(PrototypeTrajectorySnapshot trajectorySnapshot, PrototypeShipPlanningSnapshot shipSnapshot)
    {
        float mass = ResolvePlanMass(shipSnapshot);
        return shipSnapshot.mainThrustNewtons > 0f
            ? shipSnapshot.mainThrustNewtons / mass
            : Mathf.Max(0f, trajectorySnapshot.maxMainAcceleration);
    }

    private static float ResolveMainFuelRate(PrototypeTrajectorySnapshot trajectorySnapshot, PrototypeShipPlanningSnapshot shipSnapshot)
    {
        return shipSnapshot.mainFuelKgPerSecond > 0f
            ? shipSnapshot.mainFuelKgPerSecond
            : Mathf.Max(0f, trajectorySnapshot.fuelKgPerSecond);
    }

    private static float ResolveExpectedMainFuel(PrototypeTrajectorySegment segment, PrototypeManeuverCommandMode mode, float mainFuelRate)
    {
        if (!UsesMainThrottle(mode))
        {
            return 0f;
        }

        float estimated = mainFuelRate * Mathf.Clamp01(segment.throttle) * Mathf.Max(0f, segment.durationSeconds);
        return Mathf.Max(segment.expectedFuelKg, estimated);
    }

    private static float ResolveRcsTranslationScale(Vector3 rcsForceWorld, PrototypeShipPlanningSnapshot shipSnapshot)
    {
        if (shipSnapshot.rcsTranslationForceNewtons <= 0.0001f)
        {
            return rcsForceWorld.sqrMagnitude > 0.0001f ? 1f : 0f;
        }

        return Mathf.Clamp01(rcsForceWorld.magnitude / shipSnapshot.rcsTranslationForceNewtons);
    }

    private static float EstimateAttitudeSegmentSeconds(
        Quaternion currentRotation,
        Vector3 desiredForward,
        PrototypeShipPlanningSnapshot shipSnapshot)
    {
        if (desiredForward.sqrMagnitude <= 0.0001f)
        {
            return 0f;
        }

        Vector3 currentForward = currentRotation * Vector3.forward;
        float angle = Vector3.Angle(currentForward, desiredForward);
        if (angle <= 1f)
        {
            return 0f;
        }

        float angleRad = angle * Mathf.Deg2Rad;
        float rateRad = PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * Mathf.Deg2Rad;
        float accel = PrototypeFlightPlanExecutionConfig.BrakeFlipMaxAngularAccelerationRadPerSecondSquared;
        float seconds;
        if (rateRad > 0.0001f && accel > 0.0001f)
        {
            float triangularThreshold = (rateRad * rateRad) / accel;
            seconds = angleRad <= triangularThreshold
                ? 2f * Mathf.Sqrt(angleRad / accel)
                : (angleRad / rateRad) + (rateRad / accel);
        }
        else
        {
            seconds = angle / 90f;
        }

        seconds += PrototypeFlightPlanExecutionConfig.BrakeFlipDampingTimeSeconds + AttitudeLatchMarginSeconds;
        return Mathf.Clamp(seconds, MinimumAttitudeSegmentSeconds, MaximumAttitudeSegmentSeconds);
    }

    private static Quaternion ResolveLookRotation(Vector3 forward, Quaternion fallback)
    {
        if (forward.sqrMagnitude <= 0.0001f)
        {
            return fallback;
        }

        Vector3 up = Vector3.up;
        if (Mathf.Abs(Vector3.Dot(forward.normalized, up)) > 0.98f)
        {
            up = Vector3.right;
        }

        return Quaternion.LookRotation(forward.normalized, up);
    }

    private static PrototypeFlightPlanTolerance CreateFlightPlanTolerance(PrototypeTrajectorySnapshot trajectorySnapshot)
    {
        return new PrototypeFlightPlanTolerance(
            Mathf.Max(PrototypeFlightPlanTolerance.Default.positionMeters, trajectorySnapshot.arrivalRadius * 0.5f),
            Mathf.Max(PrototypeFlightPlanTolerance.Default.velocityMetersPerSecond, trajectorySnapshot.arrivalSpeed),
            PrototypeFlightPlanTolerance.Default.attitudeDegrees,
            PrototypeFlightPlanTolerance.Default.angularVelocityRadiansPerSecond,
            PrototypeFlightPlanTolerance.Default.timingSeconds,
            PrototypeFlightPlanTolerance.Default.fuelKg,
            Mathf.Max(PrototypeFlightPlanTolerance.Default.obstacleClearanceMeters, trajectorySnapshot.clearanceRadius));
    }

    private static PrototypeManeuverPhase MapManeuverPhase(PrototypeTrajectorySegmentType type)
    {
        switch (type)
        {
            case PrototypeTrajectorySegmentType.Align:
                return PrototypeManeuverPhase.AlignForBurn;
            case PrototypeTrajectorySegmentType.Burn:
                return PrototypeManeuverPhase.ProgradeBurn;
            case PrototypeTrajectorySegmentType.Coast:
                return PrototypeManeuverPhase.Coast;
            case PrototypeTrajectorySegmentType.AvoidanceBurn:
                return PrototypeManeuverPhase.AvoidanceBurn;
            case PrototypeTrajectorySegmentType.Brake:
                return PrototypeManeuverPhase.RetrogradeBurn;
            case PrototypeTrajectorySegmentType.FinalApproach:
                return PrototypeManeuverPhase.FinalApproach;
            case PrototypeTrajectorySegmentType.Hold:
                return PrototypeManeuverPhase.Hold;
            default:
                return PrototypeManeuverPhase.None;
        }
    }

    private static PrototypeManeuverCommandMode MapCommandMode(
        PrototypeTrajectorySegmentType type,
        float throttle,
        Vector3 requestedRcsForceWorld)
    {
        switch (type)
        {
            case PrototypeTrajectorySegmentType.Align:
                return PrototypeManeuverCommandMode.AttitudeOnly;
            case PrototypeTrajectorySegmentType.Burn:
            case PrototypeTrajectorySegmentType.Brake:
                return PrototypeManeuverCommandMode.MainThrottle;
            case PrototypeTrajectorySegmentType.AvoidanceBurn:
                return requestedRcsForceWorld.sqrMagnitude > 0.0001f
                    ? PrototypeManeuverCommandMode.CombinedMainAndRcs
                    : PrototypeManeuverCommandMode.MainThrottle;
            case PrototypeTrajectorySegmentType.Coast:
                return PrototypeManeuverCommandMode.RcsAttitude;
            case PrototypeTrajectorySegmentType.FinalApproach:
                return throttle > 0.01f
                    ? PrototypeManeuverCommandMode.MainThrottle
                    : PrototypeManeuverCommandMode.RcsTranslation;
            case PrototypeTrajectorySegmentType.Hold:
                return PrototypeManeuverCommandMode.RcsTranslation;
            default:
                return PrototypeManeuverCommandMode.None;
        }
    }

    private static bool UsesMainThrottle(PrototypeManeuverCommandMode mode)
    {
        return mode == PrototypeManeuverCommandMode.MainThrottle
            || mode == PrototypeManeuverCommandMode.CombinedMainAndRcs;
    }

    private static bool UsesRcsTranslation(PrototypeManeuverCommandMode mode)
    {
        return mode == PrototypeManeuverCommandMode.RcsTranslation
            || mode == PrototypeManeuverCommandMode.CombinedMainAndRcs;
    }

    private static PrototypeFlightPlanAbortReplanReason BuildAuthorityReasons(
        PrototypeShipPlanningSnapshot shipSnapshot,
        List<PrototypeManeuverSegment> segments)
    {
        PrototypeFlightPlanAbortReplanReason reasons = PrototypeFlightPlanAbortReplanReason.None;
        if (!shipSnapshot.IsFinite)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NonFiniteState;
        }

        bool needsMain = false;
        bool needsRcs = false;
        for (int i = 0; i < segments.Count; i++)
        {
            needsMain |= UsesMainThrottle(segments[i].commandMode);
            needsRcs |= segments[i].commandMode == PrototypeManeuverCommandMode.AttitudeOnly
                || segments[i].commandMode == PrototypeManeuverCommandMode.RcsAttitude
                || segments[i].commandMode == PrototypeManeuverCommandMode.RcsTranslation
                || segments[i].commandMode == PrototypeManeuverCommandMode.CombinedMainAndRcs;
        }

        if (needsMain && shipSnapshot.mainThrustNewtons <= 0.0001f)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority;
        }

        if (needsRcs
            && shipSnapshot.rcsTranslationForceNewtons <= 0.0001f
            && shipSnapshot.rcsAttitudeForceNewtons <= 0.0001f)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NoRcsAuthority;
        }

        return reasons;
    }

    private static bool IsNoOpLegacySegment(PrototypeTrajectorySegment segment)
    {
        return segment.durationSeconds <= 0.0001f
            && segment.expectedDeltaV <= 0.0001f
            && segment.expectedFuelKg <= 0.0001f;
    }

    private static bool IsDirectFastTransferPlan(PrototypeTrajectorySegment[] segments)
    {
        if (segments == null || segments.Length == 0)
        {
            return false;
        }

        bool hasDirectFastTransferSegment = false;
        for (int i = 0; i < segments.Length; i++)
        {
            if (segments[i].profile == PrototypeManeuverProfile.DirectFastTransfer)
            {
                hasDirectFastTransferSegment = true;
                continue;
            }

            if (segments[i].type != PrototypeTrajectorySegmentType.Hold)
            {
                return false;
            }
        }

        return hasDirectFastTransferSegment;
    }

    private static string BuildManeuverLabel(PrototypeTrajectorySegmentType type, PrototypeManeuverProfile profile)
    {
        if (profile == PrototypeManeuverProfile.DirectFastTransfer)
        {
            switch (type)
            {
                case PrototypeTrajectorySegmentType.Burn:
                    return "Direct fast burn";
                case PrototypeTrajectorySegmentType.Brake:
                    return "Direct fast brake";
                case PrototypeTrajectorySegmentType.Hold:
                    return "RCS final hold";
            }
        }

        switch (type)
        {
            case PrototypeTrajectorySegmentType.Burn:
                return "Main burn";
            case PrototypeTrajectorySegmentType.AvoidanceBurn:
                return "Avoidance burn";
            case PrototypeTrajectorySegmentType.Coast:
                return "Coast";
            case PrototypeTrajectorySegmentType.Brake:
                return "Brake burn";
            case PrototypeTrajectorySegmentType.FinalApproach:
                return "Final approach";
            case PrototypeTrajectorySegmentType.Hold:
                return "Hold";
            default:
                return type.ToString();
        }
    }

    private static string BuildPlanId(PrototypeTrajectorySnapshot snapshot, string suffix)
    {
        return "trajectory-"
            + Mathf.RoundToInt(snapshot.targetPosition.x) + "-"
            + Mathf.RoundToInt(snapshot.targetPosition.y) + "-"
            + Mathf.RoundToInt(snapshot.targetPosition.z) + "-"
            + suffix;
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
        return EstimateStoppingDistance(snapshot)
            + EstimateBrakeAlignmentLeadDistance(snapshot, ResolveBrakeDirection(snapshot))
            <= remainingDistance;
    }

    private static float EstimateBrakeAlignmentLeadDistance(PrototypeTrajectorySnapshot snapshot, Vector3 brakeDirection)
    {
        if (snapshot.velocity.sqrMagnitude <= 0.0001f || brakeDirection.sqrMagnitude <= 0.0001f)
        {
            return 0f;
        }

        float speedTowardBrake = Mathf.Max(
            Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget)),
            snapshot.velocity.magnitude * 0.35f);
        if (speedTowardBrake <= 0.0001f)
        {
            return 0f;
        }

        float neededAngle = Vector3.Angle(snapshot.forward, brakeDirection.normalized);
        if (neededAngle <= 2f)
        {
            return 0f;
        }

        float normalizedAngle = Mathf.Clamp01(neededAngle / 180f);
        float turnLeadSeconds = Mathf.Lerp(0.6f, 3.8f, normalizedAngle);
        return Mathf.Clamp(speedTowardBrake * turnLeadSeconds, 0f, snapshot.arrivalRadius * 8f);
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
            ? ResolveBrakeDeltaV(snapshot) / snapshot.maxMainAcceleration
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
