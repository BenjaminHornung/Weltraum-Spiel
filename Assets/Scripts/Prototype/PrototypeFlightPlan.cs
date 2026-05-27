using System;
using UnityEngine;

[Serializable]
public enum PrototypeManeuverPhase
{
    None = 0,
    AlignForBurn = 10,
    ProgradeBurn = 20,
    Coast = 30,
    FlipToRetrograde = 40,
    RetrogradeBurn = 50,
    LateralCorrection = 60,
    AvoidanceBurn = 70,
    ReacquireRoute = 80,
    FinalApproach = 90,
    Hold = 100,
    Abort = 110
}

[Serializable]
public enum PrototypeManeuverCommandMode
{
    None = 0,
    AttitudeOnly = 10,
    MainThrottle = 20,
    RcsTranslation = 30,
    RcsAttitude = 40,
    CombinedMainAndRcs = 50
}

[Flags]
[Serializable]
public enum PrototypeFlightPlanAbortReplanReason
{
    None = 0,
    ManualOverride = 1 << 0,
    MissingDependency = 1 << 1,
    NonFiniteState = 1 << 2,
    TargetMoved = 1 << 3,
    ObstacleDetected = 1 << 4,
    CollisionPredicted = 1 << 5,
    PositionDivergence = 1 << 6,
    VelocityDivergence = 1 << 7,
    AttitudeDivergence = 1 << 8,
    TimeSlip = 1 << 9,
    FuelMismatch = 1 << 10,
    FuelStarved = 1 << 11,
    ActuatorLimited = 1 << 12,
    RcsAllocatorResidual = 1 << 13,
    NoMainThrustAuthority = 1 << 14,
    NoRcsAuthority = 1 << 15,
    PlanExpired = 1 << 16,
    NonExecutable = 1 << 17
}

[Serializable]
public struct PrototypeFlightPlanTolerance
{
    public float positionMeters;
    public float velocityMetersPerSecond;
    public float attitudeDegrees;
    public float angularVelocityRadiansPerSecond;
    public float timingSeconds;
    public float fuelKg;
    public float obstacleClearanceMeters;

    public PrototypeFlightPlanTolerance(
        float positionMeters,
        float velocityMetersPerSecond,
        float attitudeDegrees,
        float angularVelocityRadiansPerSecond,
        float timingSeconds,
        float fuelKg,
        float obstacleClearanceMeters)
    {
        this.positionMeters = Mathf.Max(0f, positionMeters);
        this.velocityMetersPerSecond = Mathf.Max(0f, velocityMetersPerSecond);
        this.attitudeDegrees = Mathf.Max(0f, attitudeDegrees);
        this.angularVelocityRadiansPerSecond = Mathf.Max(0f, angularVelocityRadiansPerSecond);
        this.timingSeconds = Mathf.Max(0f, timingSeconds);
        this.fuelKg = Mathf.Max(0f, fuelKg);
        this.obstacleClearanceMeters = Mathf.Max(0f, obstacleClearanceMeters);
    }

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(positionMeters)
        && TrajectoryPredictionMath.IsFinite(velocityMetersPerSecond)
        && TrajectoryPredictionMath.IsFinite(attitudeDegrees)
        && TrajectoryPredictionMath.IsFinite(angularVelocityRadiansPerSecond)
        && TrajectoryPredictionMath.IsFinite(timingSeconds)
        && TrajectoryPredictionMath.IsFinite(fuelKg)
        && TrajectoryPredictionMath.IsFinite(obstacleClearanceMeters);

    public static PrototypeFlightPlanTolerance Default => new PrototypeFlightPlanTolerance(
        4f,
        0.8f,
        8f,
        0.35f,
        0.2f,
        0.05f,
        5f);
}

[Serializable]
public struct PrototypeShipPlanningSnapshot
{
    public TrajectoryPredictionState initialState;
    public Vector3 worldCenterOfMass;
    public Vector3 localCenterOfMass;
    public Vector3 inertiaTensor;
    public Quaternion inertiaTensorRotation;
    public float rigidbodyMassKg;
    public float currentFuelKg;
    public float maxFuelKg;
    public float mainThrustNewtons;
    public float mainFuelKgPerSecond;
    public float reverseThrustMultiplier;
    public float mainThrottleSpoolUpRate;
    public float mainThrottleSpoolDownRate;
    public float mainGimbalLimitDegrees;
    public float mainGimbalSlewRateDegreesPerSecond;
    public float rcsTranslationForceNewtons;
    public float rcsAttitudeForceNewtons;
    public float rcsNozzleSpoolUpRate;
    public float rcsNozzleSpoolDownRate;
    public bool usesImportedFunctionalSockets;
    public bool usesPhysicalMainNozzleForces;
    public bool usesExperimentalPhysicalRcsNozzles;
    public bool centralGravityEnabled;
    public bool atmosphereEnabled;
    public int mainNozzleCount;
    public int rcsNozzleCount;
    public int massDescriptorCount;

    public PrototypeShipPlanningSnapshot(
        TrajectoryPredictionState initialState,
        Vector3 worldCenterOfMass,
        Vector3 localCenterOfMass,
        Vector3 inertiaTensor,
        Quaternion inertiaTensorRotation,
        float rigidbodyMassKg,
        float currentFuelKg,
        float maxFuelKg,
        float mainThrustNewtons,
        float mainFuelKgPerSecond,
        float reverseThrustMultiplier,
        float mainThrottleSpoolUpRate,
        float mainThrottleSpoolDownRate,
        float mainGimbalLimitDegrees,
        float mainGimbalSlewRateDegreesPerSecond,
        float rcsTranslationForceNewtons,
        float rcsAttitudeForceNewtons,
        float rcsNozzleSpoolUpRate,
        float rcsNozzleSpoolDownRate,
        bool usesImportedFunctionalSockets,
        bool usesPhysicalMainNozzleForces,
        bool usesExperimentalPhysicalRcsNozzles,
        bool centralGravityEnabled,
        bool atmosphereEnabled,
        int mainNozzleCount,
        int rcsNozzleCount,
        int massDescriptorCount)
    {
        this.initialState = initialState;
        this.worldCenterOfMass = worldCenterOfMass;
        this.localCenterOfMass = localCenterOfMass;
        this.inertiaTensor = inertiaTensor;
        this.inertiaTensorRotation = inertiaTensorRotation;
        this.rigidbodyMassKg = Mathf.Max(0f, rigidbodyMassKg);
        this.currentFuelKg = Mathf.Max(0f, currentFuelKg);
        this.maxFuelKg = Mathf.Max(0f, maxFuelKg);
        this.mainThrustNewtons = Mathf.Max(0f, mainThrustNewtons);
        this.mainFuelKgPerSecond = Mathf.Max(0f, mainFuelKgPerSecond);
        this.reverseThrustMultiplier = Mathf.Max(0f, reverseThrustMultiplier);
        this.mainThrottleSpoolUpRate = Mathf.Max(0f, mainThrottleSpoolUpRate);
        this.mainThrottleSpoolDownRate = Mathf.Max(0f, mainThrottleSpoolDownRate);
        this.mainGimbalLimitDegrees = Mathf.Max(0f, mainGimbalLimitDegrees);
        this.mainGimbalSlewRateDegreesPerSecond = Mathf.Max(0f, mainGimbalSlewRateDegreesPerSecond);
        this.rcsTranslationForceNewtons = Mathf.Max(0f, rcsTranslationForceNewtons);
        this.rcsAttitudeForceNewtons = Mathf.Max(0f, rcsAttitudeForceNewtons);
        this.rcsNozzleSpoolUpRate = Mathf.Max(0f, rcsNozzleSpoolUpRate);
        this.rcsNozzleSpoolDownRate = Mathf.Max(0f, rcsNozzleSpoolDownRate);
        this.usesImportedFunctionalSockets = usesImportedFunctionalSockets;
        this.usesPhysicalMainNozzleForces = usesPhysicalMainNozzleForces;
        this.usesExperimentalPhysicalRcsNozzles = usesExperimentalPhysicalRcsNozzles;
        this.centralGravityEnabled = centralGravityEnabled;
        this.atmosphereEnabled = atmosphereEnabled;
        this.mainNozzleCount = Mathf.Max(0, mainNozzleCount);
        this.rcsNozzleCount = Mathf.Max(0, rcsNozzleCount);
        this.massDescriptorCount = Mathf.Max(0, massDescriptorCount);
    }

    public bool IsFinite => initialState.IsFinite
        && TrajectoryPredictionMath.IsFinite(worldCenterOfMass)
        && TrajectoryPredictionMath.IsFinite(localCenterOfMass)
        && TrajectoryPredictionMath.IsFinite(inertiaTensor)
        && TrajectoryPredictionMath.IsFinite(inertiaTensorRotation)
        && TrajectoryPredictionMath.IsFinite(rigidbodyMassKg)
        && TrajectoryPredictionMath.IsFinite(currentFuelKg)
        && TrajectoryPredictionMath.IsFinite(maxFuelKg)
        && TrajectoryPredictionMath.IsFinite(mainThrustNewtons)
        && TrajectoryPredictionMath.IsFinite(mainFuelKgPerSecond)
        && TrajectoryPredictionMath.IsFinite(reverseThrustMultiplier)
        && TrajectoryPredictionMath.IsFinite(mainThrottleSpoolUpRate)
        && TrajectoryPredictionMath.IsFinite(mainThrottleSpoolDownRate)
        && TrajectoryPredictionMath.IsFinite(mainGimbalLimitDegrees)
        && TrajectoryPredictionMath.IsFinite(mainGimbalSlewRateDegreesPerSecond)
        && TrajectoryPredictionMath.IsFinite(rcsTranslationForceNewtons)
        && TrajectoryPredictionMath.IsFinite(rcsAttitudeForceNewtons)
        && TrajectoryPredictionMath.IsFinite(rcsNozzleSpoolUpRate)
        && TrajectoryPredictionMath.IsFinite(rcsNozzleSpoolDownRate);

    public static PrototypeShipPlanningSnapshot Empty => new PrototypeShipPlanningSnapshot(
        new TrajectoryPredictionState(
            Vector3.zero,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            0f,
            0f),
        Vector3.zero,
        Vector3.zero,
        Vector3.one,
        Quaternion.identity,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        0f,
        false,
        false,
        false,
        false,
        false,
        0,
        0,
        0);
}

[Serializable]
public struct PrototypeTrajectoryPredictedSample
{
    public float elapsedTimeSeconds;
    public int segmentIndex;
    public PrototypeManeuverPhase phase;
    public Vector3 position;
    public Vector3 velocity;
    public Quaternion rotation;
    public Vector3 angularVelocity;
    public float remainingFuelKg;
    public float expectedMainThrottle;
    public Vector3 expectedRcsForceWorld;

    public PrototypeTrajectoryPredictedSample(
        float elapsedTimeSeconds,
        int segmentIndex,
        PrototypeManeuverPhase phase,
        Vector3 position,
        Vector3 velocity,
        Quaternion rotation,
        Vector3 angularVelocity,
        float remainingFuelKg,
        float expectedMainThrottle,
        Vector3 expectedRcsForceWorld)
    {
        this.elapsedTimeSeconds = Mathf.Max(0f, elapsedTimeSeconds);
        this.segmentIndex = Mathf.Max(-1, segmentIndex);
        this.phase = phase;
        this.position = position;
        this.velocity = velocity;
        this.rotation = rotation;
        this.angularVelocity = angularVelocity;
        this.remainingFuelKg = Mathf.Max(0f, remainingFuelKg);
        this.expectedMainThrottle = Mathf.Clamp01(expectedMainThrottle);
        this.expectedRcsForceWorld = expectedRcsForceWorld;
    }

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(elapsedTimeSeconds)
        && TrajectoryPredictionMath.IsFinite(position)
        && TrajectoryPredictionMath.IsFinite(velocity)
        && TrajectoryPredictionMath.IsFinite(rotation)
        && TrajectoryPredictionMath.IsFinite(angularVelocity)
        && TrajectoryPredictionMath.IsFinite(remainingFuelKg)
        && TrajectoryPredictionMath.IsFinite(expectedMainThrottle)
        && TrajectoryPredictionMath.IsFinite(expectedRcsForceWorld);
}

[Serializable]
public struct PrototypeManeuverSegment
{
    public int index;
    public PrototypeManeuverPhase phase;
    public PrototypeManeuverCommandMode commandMode;
    public float startTimeSeconds;
    public float durationSeconds;
    public float endTimeSeconds;
    public Vector3 primaryDirectionWorld;
    public Vector3 expectedStartPosition;
    public Vector3 expectedEndPosition;
    public Vector3 expectedStartVelocity;
    public Vector3 expectedEndVelocity;
    public Quaternion expectedStartRotation;
    public Quaternion expectedEndRotation;
    public Vector3 expectedStartAngularVelocity;
    public Vector3 expectedEndAngularVelocity;
    public float mainThrottle;
    public float rcsTranslationScale;
    public float expectedDeltaV;
    public float expectedMainFuelKg;
    public float expectedRcsFuelKg;
    public PrototypeFlightPlanTolerance tolerance;
    public PrototypeFlightPlanAbortReplanReason replanOn;
    public string label;

    public PrototypeManeuverSegment(
        int index,
        PrototypeManeuverPhase phase,
        PrototypeManeuverCommandMode commandMode,
        float startTimeSeconds,
        float durationSeconds,
        Vector3 primaryDirectionWorld,
        Vector3 expectedStartPosition,
        Vector3 expectedEndPosition,
        Vector3 expectedStartVelocity,
        Vector3 expectedEndVelocity,
        Quaternion expectedStartRotation,
        Quaternion expectedEndRotation,
        Vector3 expectedStartAngularVelocity,
        Vector3 expectedEndAngularVelocity,
        float mainThrottle,
        float rcsTranslationScale,
        float expectedDeltaV,
        float expectedMainFuelKg,
        float expectedRcsFuelKg,
        PrototypeFlightPlanTolerance tolerance,
        PrototypeFlightPlanAbortReplanReason replanOn,
        string label = null)
    {
        float clampedStartTime = Mathf.Max(0f, startTimeSeconds);
        float clampedDuration = Mathf.Max(0f, durationSeconds);

        this.index = Mathf.Max(0, index);
        this.phase = phase;
        this.commandMode = commandMode;
        this.startTimeSeconds = clampedStartTime;
        this.durationSeconds = clampedDuration;
        this.endTimeSeconds = clampedStartTime + clampedDuration;
        this.primaryDirectionWorld = NormalizeDirection(primaryDirectionWorld);
        this.expectedStartPosition = expectedStartPosition;
        this.expectedEndPosition = expectedEndPosition;
        this.expectedStartVelocity = expectedStartVelocity;
        this.expectedEndVelocity = expectedEndVelocity;
        this.expectedStartRotation = expectedStartRotation;
        this.expectedEndRotation = expectedEndRotation;
        this.expectedStartAngularVelocity = expectedStartAngularVelocity;
        this.expectedEndAngularVelocity = expectedEndAngularVelocity;
        this.mainThrottle = Mathf.Clamp01(mainThrottle);
        this.rcsTranslationScale = Mathf.Clamp01(rcsTranslationScale);
        this.expectedDeltaV = Mathf.Max(0f, expectedDeltaV);
        this.expectedMainFuelKg = Mathf.Max(0f, expectedMainFuelKg);
        this.expectedRcsFuelKg = Mathf.Max(0f, expectedRcsFuelKg);
        this.tolerance = tolerance.IsFinite ? tolerance : PrototypeFlightPlanTolerance.Default;
        this.replanOn = replanOn == PrototypeFlightPlanAbortReplanReason.None
            ? DefaultReplanReasons
            : replanOn;
        this.label = string.IsNullOrEmpty(label) ? phase.ToString() : label;
    }

    public float ExpectedFuelKg => expectedMainFuelKg + expectedRcsFuelKg;
    public bool IsTimed => durationSeconds > 0f;
    public bool IsCommanded => phase != PrototypeManeuverPhase.None
        && phase != PrototypeManeuverPhase.Abort
        && commandMode != PrototypeManeuverCommandMode.None;

    public bool IsExecutable => IsFinite
        && IsCommanded
        && endTimeSeconds >= startTimeSeconds;
    public static PrototypeFlightPlanAbortReplanReason DefaultReplanReasons =>
        PrototypeFlightPlanAbortReplanReason.PositionDivergence
        | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
        | PrototypeFlightPlanAbortReplanReason.AttitudeDivergence
        | PrototypeFlightPlanAbortReplanReason.FuelMismatch
        | PrototypeFlightPlanAbortReplanReason.TimeSlip
        | PrototypeFlightPlanAbortReplanReason.ActuatorLimited;

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(startTimeSeconds)
        && TrajectoryPredictionMath.IsFinite(durationSeconds)
        && TrajectoryPredictionMath.IsFinite(endTimeSeconds)
        && TrajectoryPredictionMath.IsFinite(primaryDirectionWorld)
        && TrajectoryPredictionMath.IsFinite(expectedStartPosition)
        && TrajectoryPredictionMath.IsFinite(expectedEndPosition)
        && TrajectoryPredictionMath.IsFinite(expectedStartVelocity)
        && TrajectoryPredictionMath.IsFinite(expectedEndVelocity)
        && TrajectoryPredictionMath.IsFinite(expectedStartRotation)
        && TrajectoryPredictionMath.IsFinite(expectedEndRotation)
        && TrajectoryPredictionMath.IsFinite(expectedStartAngularVelocity)
        && TrajectoryPredictionMath.IsFinite(expectedEndAngularVelocity)
        && TrajectoryPredictionMath.IsFinite(mainThrottle)
        && TrajectoryPredictionMath.IsFinite(rcsTranslationScale)
        && TrajectoryPredictionMath.IsFinite(expectedDeltaV)
        && TrajectoryPredictionMath.IsFinite(expectedMainFuelKg)
        && TrajectoryPredictionMath.IsFinite(expectedRcsFuelKg)
        && tolerance.IsFinite;

    public bool ContainsTime(float elapsedSeconds)
    {
        return elapsedSeconds >= startTimeSeconds && elapsedSeconds <= endTimeSeconds;
    }

    public float ProgressAt(float elapsedSeconds)
    {
        if (durationSeconds <= 0f)
        {
            return elapsedSeconds >= startTimeSeconds ? 1f : 0f;
        }

        return Mathf.Clamp01((elapsedSeconds - startTimeSeconds) / durationSeconds);
    }

    private static Vector3 NormalizeDirection(Vector3 direction)
    {
        return TrajectoryPredictionMath.IsFinite(direction) && direction.sqrMagnitude > 0.0001f
            ? direction.normalized
            : Vector3.forward;
    }
}

[Serializable]
public struct PrototypeFlightPlan
{
    private const float TimeEpsilon = 0.0001f;

    public string planId;
    public int revision;
    public float createdAtTimeSeconds;
    public float fixedDeltaTimeSeconds;
    public Vector3 targetPositionWorld;
    public float targetArrivalRadiusMeters;
    public float targetArrivalSpeedMetersPerSecond;
    public PrototypeShipPlanningSnapshot shipSnapshot;
    public PrototypeManeuverSegment[] segments;
    public PrototypeTrajectoryPredictedSample[] predictedSamples;
    public float totalDurationSeconds;
    public float totalExpectedFuelKg;
    public float expectedRemainingFuelKg;
    public bool isExecutable;
    public PrototypeFlightPlanAbortReplanReason nonExecutableReasons;
    public string statusLabel;

    public PrototypeFlightPlan(
        string planId,
        int revision,
        float createdAtTimeSeconds,
        float fixedDeltaTimeSeconds,
        Vector3 targetPositionWorld,
        float targetArrivalRadiusMeters,
        float targetArrivalSpeedMetersPerSecond,
        PrototypeShipPlanningSnapshot shipSnapshot,
        PrototypeManeuverSegment[] segments,
        PrototypeTrajectoryPredictedSample[] predictedSamples,
        bool isExecutable = true,
        PrototypeFlightPlanAbortReplanReason nonExecutableReasons = PrototypeFlightPlanAbortReplanReason.None,
        string statusLabel = null)
    {
        this.planId = string.IsNullOrEmpty(planId) ? "flight-plan" : planId;
        this.revision = Mathf.Max(0, revision);
        this.createdAtTimeSeconds = Mathf.Max(0f, createdAtTimeSeconds);
        this.fixedDeltaTimeSeconds = Mathf.Max(0f, fixedDeltaTimeSeconds);
        this.targetPositionWorld = targetPositionWorld;
        this.targetArrivalRadiusMeters = Mathf.Max(0f, targetArrivalRadiusMeters);
        this.targetArrivalSpeedMetersPerSecond = Mathf.Max(0f, targetArrivalSpeedMetersPerSecond);
        this.shipSnapshot = shipSnapshot;
        this.segments = CopySegments(segments);
        this.predictedSamples = CopySamples(predictedSamples);
        this.totalDurationSeconds = ComputeTotalDurationSeconds(this.segments);
        this.totalExpectedFuelKg = ComputeTotalExpectedFuelKg(this.segments);
        this.expectedRemainingFuelKg = Mathf.Max(0f, shipSnapshot.currentFuelKg - this.totalExpectedFuelKg);

        PrototypeFlightPlanAbortReplanReason validationReasons = Validate(
            this.fixedDeltaTimeSeconds,
            this.targetPositionWorld,
            this.targetArrivalRadiusMeters,
            this.targetArrivalSpeedMetersPerSecond,
            this.shipSnapshot,
            this.segments,
            this.predictedSamples,
            this.totalExpectedFuelKg);

        this.nonExecutableReasons = nonExecutableReasons | validationReasons;
        if (!isExecutable && this.nonExecutableReasons == PrototypeFlightPlanAbortReplanReason.None)
        {
            this.nonExecutableReasons |= PrototypeFlightPlanAbortReplanReason.NonExecutable;
        }

        this.isExecutable = isExecutable && this.nonExecutableReasons == PrototypeFlightPlanAbortReplanReason.None;
        this.statusLabel = string.IsNullOrEmpty(statusLabel)
            ? (this.isExecutable ? "Executable" : "Not executable")
            : statusLabel;
    }

    public int SegmentCount => segments != null ? segments.Length : 0;
    public bool HasSegments => SegmentCount > 0;
    public bool IsValid => isExecutable
        && nonExecutableReasons == PrototypeFlightPlanAbortReplanReason.None
        && HasSegments
        && shipSnapshot.IsFinite
        && TrajectoryPredictionMath.IsFinite(targetPositionWorld)
        && TrajectoryPredictionMath.IsFinite(totalDurationSeconds)
        && TrajectoryPredictionMath.IsFinite(totalExpectedFuelKg)
        && TrajectoryPredictionMath.IsFinite(expectedRemainingFuelKg);

    public bool TryGetActiveSegment(float elapsedSeconds, out PrototypeManeuverSegment activeSegment)
    {
        activeSegment = default;
        if (segments == null || segments.Length == 0 || !TrajectoryPredictionMath.IsFinite(elapsedSeconds))
        {
            return false;
        }

        float clampedElapsed = Mathf.Max(0f, elapsedSeconds);
        for (int i = 0; i < segments.Length; i++)
        {
            if (segments[i].ContainsTime(clampedElapsed))
            {
                activeSegment = segments[i];
                return true;
            }
        }

        return false;
    }

    public int GetActiveSegmentIndex(float elapsedSeconds)
    {
        return TryGetActiveSegment(elapsedSeconds, out PrototypeManeuverSegment activeSegment)
            ? activeSegment.index
            : -1;
    }

    public float ExpectedFuelAt(float elapsedSeconds)
    {
        if (segments == null || segments.Length == 0)
        {
            return Mathf.Max(0f, shipSnapshot.currentFuelKg);
        }

        float clampedElapsed = Mathf.Max(0f, elapsedSeconds);
        float consumedFuel = 0f;
        for (int i = 0; i < segments.Length; i++)
        {
            PrototypeManeuverSegment segment = segments[i];
            if (clampedElapsed >= segment.endTimeSeconds)
            {
                consumedFuel += segment.ExpectedFuelKg;
                continue;
            }

            if (clampedElapsed >= segment.startTimeSeconds)
            {
                consumedFuel += segment.ExpectedFuelKg * segment.ProgressAt(clampedElapsed);
            }

            break;
        }

        return Mathf.Max(0f, shipSnapshot.currentFuelKg - consumedFuel);
    }

    public static PrototypeFlightPlan CreateInvalid(
        string planId,
        int revision,
        Vector3 targetPositionWorld,
        PrototypeFlightPlanAbortReplanReason reason,
        string statusLabel)
    {
        PrototypeFlightPlanAbortReplanReason safeReason = reason == PrototypeFlightPlanAbortReplanReason.None
            ? PrototypeFlightPlanAbortReplanReason.NonExecutable
            : reason;

        return new PrototypeFlightPlan(
            planId,
            revision,
            0f,
            0.02f,
            targetPositionWorld,
            0f,
            0f,
            PrototypeShipPlanningSnapshot.Empty,
            Array.Empty<PrototypeManeuverSegment>(),
            Array.Empty<PrototypeTrajectoryPredictedSample>(),
            false,
            safeReason,
            statusLabel);
    }

    private static PrototypeManeuverSegment[] CopySegments(PrototypeManeuverSegment[] source)
    {
        if (source == null || source.Length == 0)
        {
            return Array.Empty<PrototypeManeuverSegment>();
        }

        var copy = new PrototypeManeuverSegment[source.Length];
        Array.Copy(source, copy, source.Length);
        return copy;
    }

    private static PrototypeTrajectoryPredictedSample[] CopySamples(PrototypeTrajectoryPredictedSample[] source)
    {
        if (source == null || source.Length == 0)
        {
            return Array.Empty<PrototypeTrajectoryPredictedSample>();
        }

        var copy = new PrototypeTrajectoryPredictedSample[source.Length];
        Array.Copy(source, copy, source.Length);
        return copy;
    }

    private static float ComputeTotalDurationSeconds(PrototypeManeuverSegment[] planSegments)
    {
        if (planSegments == null || planSegments.Length == 0)
        {
            return 0f;
        }

        float total = 0f;
        for (int i = 0; i < planSegments.Length; i++)
        {
            total = Mathf.Max(total, planSegments[i].endTimeSeconds);
        }

        return total;
    }

    private static float ComputeTotalExpectedFuelKg(PrototypeManeuverSegment[] planSegments)
    {
        if (planSegments == null || planSegments.Length == 0)
        {
            return 0f;
        }

        float total = 0f;
        for (int i = 0; i < planSegments.Length; i++)
        {
            total += planSegments[i].ExpectedFuelKg;
        }

        return total;
    }

    private static PrototypeFlightPlanAbortReplanReason Validate(
        float fixedDeltaTimeSeconds,
        Vector3 targetPositionWorld,
        float targetArrivalRadiusMeters,
        float targetArrivalSpeedMetersPerSecond,
        PrototypeShipPlanningSnapshot shipSnapshot,
        PrototypeManeuverSegment[] planSegments,
        PrototypeTrajectoryPredictedSample[] samples,
        float totalExpectedFuelKg)
    {
        PrototypeFlightPlanAbortReplanReason reasons = PrototypeFlightPlanAbortReplanReason.None;

        if (!TrajectoryPredictionMath.IsFinite(fixedDeltaTimeSeconds) || fixedDeltaTimeSeconds <= 0f)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.TimeSlip;
        }

        if (!TrajectoryPredictionMath.IsFinite(targetPositionWorld)
            || !TrajectoryPredictionMath.IsFinite(targetArrivalRadiusMeters)
            || !TrajectoryPredictionMath.IsFinite(targetArrivalSpeedMetersPerSecond)
            || !shipSnapshot.IsFinite)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NonFiniteState;
        }

        if (planSegments == null || planSegments.Length == 0)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NonExecutable;
            return reasons;
        }

        float previousEndTime = 0f;
        for (int i = 0; i < planSegments.Length; i++)
        {
            PrototypeManeuverSegment segment = planSegments[i];
            if (!segment.IsFinite)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.NonFiniteState;
            }

            if (!segment.IsExecutable)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.NonExecutable;
            }

            if (i > 0 && segment.startTimeSeconds + TimeEpsilon < previousEndTime)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.TimeSlip;
            }

            previousEndTime = Mathf.Max(previousEndTime, segment.endTimeSeconds);
        }

        if (TrajectoryPredictionMath.IsFinite(totalExpectedFuelKg)
            && totalExpectedFuelKg > shipSnapshot.currentFuelKg + PrototypeFlightPlanTolerance.Default.fuelKg)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.FuelStarved;
        }

        if (samples != null && samples.Length > 0)
        {
            float previousSampleTime = 0f;
            for (int i = 0; i < samples.Length; i++)
            {
                PrototypeTrajectoryPredictedSample sample = samples[i];
                if (!sample.IsFinite)
                {
                    reasons |= PrototypeFlightPlanAbortReplanReason.NonFiniteState;
                }

                if (i > 0 && sample.elapsedTimeSeconds + TimeEpsilon < previousSampleTime)
                {
                    reasons |= PrototypeFlightPlanAbortReplanReason.TimeSlip;
                }

                if (sample.segmentIndex >= planSegments.Length)
                {
                    reasons |= PrototypeFlightPlanAbortReplanReason.NonExecutable;
                }

                previousSampleTime = Mathf.Max(previousSampleTime, sample.elapsedTimeSeconds);
            }
        }

        return reasons;
    }
}

[Serializable]
public struct PrototypeFlightPlanExecutionState
{
    public string planId;
    public int revision;
    public bool hasActiveSegment;
    public int activeSegmentIndex;
    public PrototypeManeuverPhase activePhase;
    public float elapsedSeconds;
    public float activeElapsedSeconds;
    public float activeProgress01;
    public float positionErrorMeters;
    public float velocityErrorMetersPerSecond;
    public float attitudeErrorDegrees;
    public float angularVelocityErrorRadiansPerSecond;
    public float fuelErrorKg;
    public bool requiresReplan;
    public PrototypeFlightPlanAbortReplanReason replanReasons;
    public string statusLabel;

    public PrototypeFlightPlanExecutionState(
        string planId,
        int revision,
        bool hasActiveSegment,
        int activeSegmentIndex,
        PrototypeManeuverPhase activePhase,
        float elapsedSeconds,
        float activeElapsedSeconds,
        float activeProgress01,
        float positionErrorMeters,
        float velocityErrorMetersPerSecond,
        float attitudeErrorDegrees,
        float angularVelocityErrorRadiansPerSecond,
        float fuelErrorKg,
        bool requiresReplan,
        PrototypeFlightPlanAbortReplanReason replanReasons,
        string statusLabel)
    {
        this.planId = string.IsNullOrEmpty(planId) ? "flight-plan" : planId;
        this.revision = Mathf.Max(0, revision);
        this.hasActiveSegment = hasActiveSegment;
        this.activeSegmentIndex = activeSegmentIndex;
        this.activePhase = activePhase;
        this.elapsedSeconds = Mathf.Max(0f, elapsedSeconds);
        this.activeElapsedSeconds = Mathf.Max(0f, activeElapsedSeconds);
        this.activeProgress01 = Mathf.Clamp01(activeProgress01);
        this.positionErrorMeters = Mathf.Max(0f, positionErrorMeters);
        this.velocityErrorMetersPerSecond = Mathf.Max(0f, velocityErrorMetersPerSecond);
        this.attitudeErrorDegrees = Mathf.Max(0f, attitudeErrorDegrees);
        this.angularVelocityErrorRadiansPerSecond = Mathf.Max(0f, angularVelocityErrorRadiansPerSecond);
        this.fuelErrorKg = Mathf.Max(0f, fuelErrorKg);
        this.requiresReplan = requiresReplan;
        this.replanReasons = replanReasons;
        this.statusLabel = string.IsNullOrEmpty(statusLabel) ? "Idle" : statusLabel;
    }

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(elapsedSeconds)
        && TrajectoryPredictionMath.IsFinite(activeElapsedSeconds)
        && TrajectoryPredictionMath.IsFinite(activeProgress01)
        && TrajectoryPredictionMath.IsFinite(positionErrorMeters)
        && TrajectoryPredictionMath.IsFinite(velocityErrorMetersPerSecond)
        && TrajectoryPredictionMath.IsFinite(attitudeErrorDegrees)
        && TrajectoryPredictionMath.IsFinite(angularVelocityErrorRadiansPerSecond)
        && TrajectoryPredictionMath.IsFinite(fuelErrorKg);

    public static PrototypeFlightPlanExecutionState FromPlan(
        PrototypeFlightPlan plan,
        float elapsedSeconds,
        Vector3 actualPosition,
        Vector3 actualVelocity,
        Quaternion actualRotation,
        Vector3 actualAngularVelocity,
        float actualFuelKg)
    {
        PrototypeFlightPlanAbortReplanReason reasons = plan.nonExecutableReasons;
        bool requiresReplan = !plan.IsValid;
        float clampedElapsed = Mathf.Max(0f, elapsedSeconds);

        if (!plan.TryGetActiveSegment(clampedElapsed, out PrototypeManeuverSegment activeSegment))
        {
            if (plan.IsValid && clampedElapsed > plan.totalDurationSeconds)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.PlanExpired;
                requiresReplan = true;
            }

            return new PrototypeFlightPlanExecutionState(
                plan.planId,
                plan.revision,
                false,
                -1,
                PrototypeManeuverPhase.None,
                clampedElapsed,
                0f,
                0f,
                0f,
                0f,
                0f,
                0f,
                0f,
                requiresReplan,
                reasons,
                requiresReplan ? "Replan required" : "No active segment");
        }

        float progress = activeSegment.ProgressAt(clampedElapsed);
        Vector3 expectedPosition = Vector3.Lerp(activeSegment.expectedStartPosition, activeSegment.expectedEndPosition, progress);
        Vector3 expectedVelocity = Vector3.Lerp(activeSegment.expectedStartVelocity, activeSegment.expectedEndVelocity, progress);
        Quaternion expectedRotation = Quaternion.Slerp(activeSegment.expectedStartRotation, activeSegment.expectedEndRotation, progress);
        Vector3 expectedAngularVelocity = Vector3.Lerp(activeSegment.expectedStartAngularVelocity, activeSegment.expectedEndAngularVelocity, progress);
        float expectedFuelKg = plan.ExpectedFuelAt(clampedElapsed);

        float positionError = Vector3.Distance(actualPosition, expectedPosition);
        float velocityError = Vector3.Distance(actualVelocity, expectedVelocity);
        float attitudeError = Quaternion.Angle(actualRotation, expectedRotation);
        float angularVelocityError = Vector3.Distance(actualAngularVelocity, expectedAngularVelocity);
        float fuelError = Mathf.Abs(Mathf.Max(0f, actualFuelKg) - expectedFuelKg);

        AddToleranceReason(positionError, activeSegment.tolerance.positionMeters, PrototypeFlightPlanAbortReplanReason.PositionDivergence, activeSegment.replanOn, ref reasons);
        AddToleranceReason(velocityError, activeSegment.tolerance.velocityMetersPerSecond, PrototypeFlightPlanAbortReplanReason.VelocityDivergence, activeSegment.replanOn, ref reasons);
        AddToleranceReason(attitudeError, activeSegment.tolerance.attitudeDegrees, PrototypeFlightPlanAbortReplanReason.AttitudeDivergence, activeSegment.replanOn, ref reasons);
        AddToleranceReason(angularVelocityError, activeSegment.tolerance.angularVelocityRadiansPerSecond, PrototypeFlightPlanAbortReplanReason.AttitudeDivergence, activeSegment.replanOn, ref reasons);
        AddToleranceReason(fuelError, activeSegment.tolerance.fuelKg, PrototypeFlightPlanAbortReplanReason.FuelMismatch, activeSegment.replanOn, ref reasons);
        requiresReplan = requiresReplan || reasons != PrototypeFlightPlanAbortReplanReason.None;

        return new PrototypeFlightPlanExecutionState(
            plan.planId,
            plan.revision,
            true,
            activeSegment.index,
            activeSegment.phase,
            clampedElapsed,
            Mathf.Max(0f, clampedElapsed - activeSegment.startTimeSeconds),
            progress,
            positionError,
            velocityError,
            attitudeError,
            angularVelocityError,
            fuelError,
            requiresReplan,
            reasons,
            requiresReplan ? "Replan required" : activeSegment.label);
    }

    private static void AddToleranceReason(
        float error,
        float tolerance,
        PrototypeFlightPlanAbortReplanReason reason,
        PrototypeFlightPlanAbortReplanReason enabledReasons,
        ref PrototypeFlightPlanAbortReplanReason reasons)
    {
        if ((enabledReasons & reason) != 0 && TrajectoryPredictionMath.IsFinite(error) && error > tolerance)
        {
            reasons |= reason;
        }
    }
}
