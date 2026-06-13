using System;
using UnityEngine;

public static class PrototypeFlightPlanExecutionConfig
{
    public const float BrakeFlipMaxTurnRateDegreesPerSecond = 58f;
    public const float BrakeFlipMaxAngularAccelerationRadPerSecondSquared = 3f;
    public const float BrakeFlipDampingTimeSeconds = 0.4f;
}

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

[Serializable]
public enum PrototypeManeuverProfile
{
    Default = 0,
    DirectFastTransfer = 10
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
    NonExecutable = 1 << 17,
    InvalidPlanDirection = 1 << 18,
    TrackingDiverged = 1 << 19,
    PlanUnstable = 1 << 20
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
    public PrototypeManeuverProfile profile;
    public float plannedSwitchDistanceMeters;

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
        string label = null,
        PrototypeManeuverProfile profile = PrototypeManeuverProfile.Default,
        float plannedSwitchDistanceMeters = 0f)
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
        this.profile = profile;
        this.plannedSwitchDistanceMeters = Mathf.Max(0f, plannedSwitchDistanceMeters);
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
        && TrajectoryPredictionMath.IsFinite(plannedSwitchDistanceMeters)
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
    public Vector3 arrivalPointWorld;
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
    public PrototypeManeuverProfile profile;

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
        string statusLabel = null,
        Vector3? arrivalPointWorld = null,
        PrototypeManeuverProfile profile = PrototypeManeuverProfile.Default)
    {
        this.planId = string.IsNullOrEmpty(planId) ? "flight-plan" : planId;
        this.revision = Mathf.Max(0, revision);
        this.createdAtTimeSeconds = Mathf.Max(0f, createdAtTimeSeconds);
        this.fixedDeltaTimeSeconds = Mathf.Max(0f, fixedDeltaTimeSeconds);
        this.targetPositionWorld = targetPositionWorld;
        this.arrivalPointWorld = arrivalPointWorld.HasValue ? arrivalPointWorld.Value : targetPositionWorld;
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
        this.profile = profile;
    }

    public int SegmentCount => segments != null ? segments.Length : 0;
    public bool HasSegments => SegmentCount > 0;
    public bool IsValid => isExecutable
        && nonExecutableReasons == PrototypeFlightPlanAbortReplanReason.None
        && HasSegments
        && shipSnapshot.IsFinite
        && TrajectoryPredictionMath.IsFinite(targetPositionWorld)
        && TrajectoryPredictionMath.IsFinite(arrivalPointWorld)
        && TrajectoryPredictionMath.IsFinite(totalDurationSeconds)
        && TrajectoryPredictionMath.IsFinite(totalExpectedFuelKg)
        && TrajectoryPredictionMath.IsFinite(expectedRemainingFuelKg);
    public bool IsDirectFastTransfer => profile == PrototypeManeuverProfile.DirectFastTransfer;

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

[Serializable]
public struct PrototypeFlightPlanTrackerSettings
{
    public float positionKp;
    public float velocityKd;
    public float maxTrackingAccelerationMetersPerSecondSquared;
    public float maxRcsAccelerationMetersPerSecondSquared;
    public float progradeTangentDotMinimum;
    public float directTargetDotMinimum;
    public float brakeVelocityDotMinimum;
    public float errorToleranceMultiplier;

    public PrototypeFlightPlanTrackerSettings(
        float positionKp,
        float velocityKd,
        float maxTrackingAccelerationMetersPerSecondSquared,
        float maxRcsAccelerationMetersPerSecondSquared,
        float progradeTangentDotMinimum,
        float directTargetDotMinimum,
        float brakeVelocityDotMinimum,
        float errorToleranceMultiplier)
    {
        this.positionKp = Mathf.Max(0f, positionKp);
        this.velocityKd = Mathf.Max(0f, velocityKd);
        this.maxTrackingAccelerationMetersPerSecondSquared = Mathf.Max(0f, maxTrackingAccelerationMetersPerSecondSquared);
        this.maxRcsAccelerationMetersPerSecondSquared = Mathf.Max(0f, maxRcsAccelerationMetersPerSecondSquared);
        this.progradeTangentDotMinimum = Mathf.Clamp(progradeTangentDotMinimum, -1f, 1f);
        this.directTargetDotMinimum = Mathf.Clamp(directTargetDotMinimum, -1f, 1f);
        this.brakeVelocityDotMinimum = Mathf.Clamp(brakeVelocityDotMinimum, -1f, 1f);
        this.errorToleranceMultiplier = Mathf.Max(0.1f, errorToleranceMultiplier);
    }

    public static PrototypeFlightPlanTrackerSettings Default => new PrototypeFlightPlanTrackerSettings(
        0.10f,
        0.65f,
        18f,
        3.5f,
        0.05f,
        0.35f,
        0.55f,
        3f);
}

[Serializable]
public struct PrototypeFlightPlanTrackingError
{
    public string planId;
    public int revision;
    public bool hasReferenceSample;
    public int activeSegmentIndex;
    public int activeSampleIndex;
    public PrototypeManeuverPhase activePhase;
    public float elapsedSeconds;
    public float referenceTimeSeconds;
    public Vector3 referencePosition;
    public Vector3 referenceVelocity;
    public Quaternion referenceRotation;
    public Vector3 referenceAngularVelocity;
    public Vector3 positionErrorWorld;
    public Vector3 velocityErrorWorld;
    public float positionErrorMeters;
    public float velocityErrorMetersPerSecond;
    public float crossTrackErrorMeters;
    public float alongTrackErrorMeters;
    public float speedErrorMetersPerSecond;
    public float attitudeErrorDegrees;
    public float angularVelocityErrorRadiansPerSecond;
    public float fuelErrorKg;
    public Vector3 plannedTangentWorld;
    public float plannedTangentDotToTarget;
    public PrototypeFlightPlanAbortReplanReason replanReasons;
    public bool requiresReplan;
    public string statusLabel;

    public PrototypeFlightPlanTrackingError(
        string planId,
        int revision,
        bool hasReferenceSample,
        int activeSegmentIndex,
        int activeSampleIndex,
        PrototypeManeuverPhase activePhase,
        float elapsedSeconds,
        float referenceTimeSeconds,
        Vector3 referencePosition,
        Vector3 referenceVelocity,
        Quaternion referenceRotation,
        Vector3 referenceAngularVelocity,
        Vector3 positionErrorWorld,
        Vector3 velocityErrorWorld,
        float crossTrackErrorMeters,
        float alongTrackErrorMeters,
        float speedErrorMetersPerSecond,
        float attitudeErrorDegrees,
        float angularVelocityErrorRadiansPerSecond,
        float fuelErrorKg,
        Vector3 plannedTangentWorld,
        float plannedTangentDotToTarget,
        PrototypeFlightPlanAbortReplanReason replanReasons,
        bool requiresReplan,
        string statusLabel)
    {
        this.planId = string.IsNullOrEmpty(planId) ? "flight-plan" : planId;
        this.revision = Mathf.Max(0, revision);
        this.hasReferenceSample = hasReferenceSample;
        this.activeSegmentIndex = activeSegmentIndex;
        this.activeSampleIndex = activeSampleIndex;
        this.activePhase = activePhase;
        this.elapsedSeconds = Mathf.Max(0f, elapsedSeconds);
        this.referenceTimeSeconds = Mathf.Max(0f, referenceTimeSeconds);
        this.referencePosition = referencePosition;
        this.referenceVelocity = referenceVelocity;
        this.referenceRotation = referenceRotation;
        this.referenceAngularVelocity = referenceAngularVelocity;
        this.positionErrorWorld = positionErrorWorld;
        this.velocityErrorWorld = velocityErrorWorld;
        this.positionErrorMeters = positionErrorWorld.magnitude;
        this.velocityErrorMetersPerSecond = velocityErrorWorld.magnitude;
        this.crossTrackErrorMeters = Mathf.Abs(crossTrackErrorMeters);
        this.alongTrackErrorMeters = alongTrackErrorMeters;
        this.speedErrorMetersPerSecond = speedErrorMetersPerSecond;
        this.attitudeErrorDegrees = Mathf.Max(0f, attitudeErrorDegrees);
        this.angularVelocityErrorRadiansPerSecond = Mathf.Max(0f, angularVelocityErrorRadiansPerSecond);
        this.fuelErrorKg = Mathf.Abs(fuelErrorKg);
        this.plannedTangentWorld = NormalizeOrZero(plannedTangentWorld);
        this.plannedTangentDotToTarget = Mathf.Clamp(plannedTangentDotToTarget, -1f, 1f);
        this.replanReasons = replanReasons;
        this.requiresReplan = requiresReplan || replanReasons != PrototypeFlightPlanAbortReplanReason.None;
        this.statusLabel = string.IsNullOrEmpty(statusLabel) ? "Tracking" : statusLabel;
    }

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(elapsedSeconds)
        && TrajectoryPredictionMath.IsFinite(referenceTimeSeconds)
        && TrajectoryPredictionMath.IsFinite(referencePosition)
        && TrajectoryPredictionMath.IsFinite(referenceVelocity)
        && TrajectoryPredictionMath.IsFinite(referenceRotation)
        && TrajectoryPredictionMath.IsFinite(referenceAngularVelocity)
        && TrajectoryPredictionMath.IsFinite(positionErrorWorld)
        && TrajectoryPredictionMath.IsFinite(velocityErrorWorld)
        && TrajectoryPredictionMath.IsFinite(positionErrorMeters)
        && TrajectoryPredictionMath.IsFinite(velocityErrorMetersPerSecond)
        && TrajectoryPredictionMath.IsFinite(crossTrackErrorMeters)
        && TrajectoryPredictionMath.IsFinite(alongTrackErrorMeters)
        && TrajectoryPredictionMath.IsFinite(speedErrorMetersPerSecond)
        && TrajectoryPredictionMath.IsFinite(attitudeErrorDegrees)
        && TrajectoryPredictionMath.IsFinite(angularVelocityErrorRadiansPerSecond)
        && TrajectoryPredictionMath.IsFinite(fuelErrorKg)
        && TrajectoryPredictionMath.IsFinite(plannedTangentWorld)
        && TrajectoryPredictionMath.IsFinite(plannedTangentDotToTarget);

    private static Vector3 NormalizeOrZero(Vector3 value)
    {
        return TrajectoryPredictionMath.IsFinite(value) && value.sqrMagnitude > 0.0001f
            ? value.normalized
            : Vector3.zero;
    }
}

[Serializable]
public struct PrototypeFlightPlanTrackingCommand
{
    public PrototypeFlightPlanTrackingError error;
    public bool hasCommand;
    public bool mainThrottleAllowed;
    public Vector3 desiredAccelerationWorld;
    public Vector3 mainDirectionWorld;
    public float mainThrottle;
    public Vector3 rcsAccelerationWorld;
    public Vector3 rcsForceWorld;
    public float accelerationDotPlannedTangent;
    public float mainDirectionDotVelocityBrake;
    public PrototypeFlightPlanAbortReplanReason replanReasons;
    public bool requiresReplan;
    public string statusLabel;

    public PrototypeFlightPlanTrackingCommand(
        PrototypeFlightPlanTrackingError error,
        bool hasCommand,
        bool mainThrottleAllowed,
        Vector3 desiredAccelerationWorld,
        Vector3 mainDirectionWorld,
        float mainThrottle,
        Vector3 rcsAccelerationWorld,
        Vector3 rcsForceWorld,
        float accelerationDotPlannedTangent,
        float mainDirectionDotVelocityBrake,
        PrototypeFlightPlanAbortReplanReason replanReasons,
        bool requiresReplan,
        string statusLabel)
    {
        this.error = error;
        this.hasCommand = hasCommand;
        this.mainThrottleAllowed = mainThrottleAllowed;
        this.desiredAccelerationWorld = desiredAccelerationWorld;
        this.mainDirectionWorld = NormalizeOrZero(mainDirectionWorld);
        this.mainThrottle = Mathf.Clamp01(mainThrottle);
        this.rcsAccelerationWorld = rcsAccelerationWorld;
        this.rcsForceWorld = rcsForceWorld;
        this.accelerationDotPlannedTangent = Mathf.Clamp(accelerationDotPlannedTangent, -1f, 1f);
        this.mainDirectionDotVelocityBrake = Mathf.Clamp(mainDirectionDotVelocityBrake, -1f, 1f);
        this.replanReasons = replanReasons;
        this.requiresReplan = requiresReplan || replanReasons != PrototypeFlightPlanAbortReplanReason.None || error.requiresReplan;
        this.statusLabel = string.IsNullOrEmpty(statusLabel) ? error.statusLabel : statusLabel;
    }

    public bool IsFinite => error.IsFinite
        && TrajectoryPredictionMath.IsFinite(desiredAccelerationWorld)
        && TrajectoryPredictionMath.IsFinite(mainDirectionWorld)
        && TrajectoryPredictionMath.IsFinite(mainThrottle)
        && TrajectoryPredictionMath.IsFinite(rcsAccelerationWorld)
        && TrajectoryPredictionMath.IsFinite(rcsForceWorld)
        && TrajectoryPredictionMath.IsFinite(accelerationDotPlannedTangent)
        && TrajectoryPredictionMath.IsFinite(mainDirectionDotVelocityBrake);

    public static PrototypeFlightPlanTrackingCommand Blocked(
        PrototypeFlightPlan plan,
        float elapsedSeconds,
        PrototypeFlightPlanAbortReplanReason reasons,
        string statusLabel)
    {
        var error = new PrototypeFlightPlanTrackingError(
            plan.planId,
            plan.revision,
            false,
            -1,
            -1,
            PrototypeManeuverPhase.None,
            elapsedSeconds,
            elapsedSeconds,
            Vector3.zero,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            Vector3.zero,
            Vector3.zero,
            0f,
            0f,
            0f,
            0f,
            0f,
            0f,
            Vector3.zero,
            0f,
            reasons,
            true,
            statusLabel);
        return new PrototypeFlightPlanTrackingCommand(
            error,
            false,
            false,
            Vector3.zero,
            Vector3.zero,
            0f,
            Vector3.zero,
            Vector3.zero,
            0f,
            0f,
            reasons,
            true,
            statusLabel);
    }

    private static Vector3 NormalizeOrZero(Vector3 value)
    {
        return TrajectoryPredictionMath.IsFinite(value) && value.sqrMagnitude > 0.0001f
            ? value.normalized
            : Vector3.zero;
    }
}

public static class PrototypeFlightPlanTracker
{
    private const float DirectionEpsilon = 0.0001f;

    public static bool TryInterpolateSample(
        PrototypeFlightPlan plan,
        float elapsedSeconds,
        out PrototypeTrajectoryPredictedSample sample,
        out int sampleIndex,
        out float sampleBlend01)
    {
        sample = default;
        sampleIndex = -1;
        sampleBlend01 = 0f;
        PrototypeTrajectoryPredictedSample[] samples = plan.predictedSamples;
        if (samples == null || samples.Length == 0 || !TrajectoryPredictionMath.IsFinite(elapsedSeconds))
        {
            return false;
        }

        if (elapsedSeconds <= samples[0].elapsedTimeSeconds)
        {
            sample = samples[0];
            sampleIndex = 0;
            return sample.IsFinite;
        }

        int lastIndex = samples.Length - 1;
        if (elapsedSeconds >= samples[lastIndex].elapsedTimeSeconds)
        {
            sample = samples[lastIndex];
            sampleIndex = lastIndex;
            return sample.IsFinite;
        }

        for (int i = 1; i < samples.Length; i++)
        {
            PrototypeTrajectoryPredictedSample next = samples[i];
            if (elapsedSeconds > next.elapsedTimeSeconds)
            {
                continue;
            }

            PrototypeTrajectoryPredictedSample previous = samples[i - 1];
            float span = Mathf.Max(0.0001f, next.elapsedTimeSeconds - previous.elapsedTimeSeconds);
            sampleBlend01 = Mathf.Clamp01((elapsedSeconds - previous.elapsedTimeSeconds) / span);
            sample = new PrototypeTrajectoryPredictedSample(
                elapsedSeconds,
                sampleBlend01 >= 0.5f ? next.segmentIndex : previous.segmentIndex,
                sampleBlend01 >= 0.5f ? next.phase : previous.phase,
                Vector3.Lerp(previous.position, next.position, sampleBlend01),
                Vector3.Lerp(previous.velocity, next.velocity, sampleBlend01),
                Quaternion.Slerp(previous.rotation, next.rotation, sampleBlend01),
                Vector3.Lerp(previous.angularVelocity, next.angularVelocity, sampleBlend01),
                Mathf.Lerp(previous.remainingFuelKg, next.remainingFuelKg, sampleBlend01),
                Mathf.Lerp(previous.expectedMainThrottle, next.expectedMainThrottle, sampleBlend01),
                Vector3.Lerp(previous.expectedRcsForceWorld, next.expectedRcsForceWorld, sampleBlend01));
            sampleIndex = i - 1;
            return sample.IsFinite;
        }

        return false;
    }

    public static PrototypeFlightPlanTrackingCommand Track(
        PrototypeFlightPlan plan,
        float elapsedSeconds,
        Vector3 actualPosition,
        Vector3 actualVelocity,
        Quaternion actualRotation,
        Vector3 actualAngularVelocity,
        float actualFuelKg,
        Vector3 currentTargetPosition,
        float mainAccelerationMetersPerSecondSquared,
        float rcsAccelerationMetersPerSecondSquared,
        float massKg)
    {
        return Track(
            plan,
            elapsedSeconds,
            actualPosition,
            actualVelocity,
            actualRotation,
            actualAngularVelocity,
            actualFuelKg,
            currentTargetPosition,
            mainAccelerationMetersPerSecondSquared,
            rcsAccelerationMetersPerSecondSquared,
            massKg,
            PrototypeFlightPlanTrackerSettings.Default);
    }

    public static PrototypeFlightPlanTrackingCommand Track(
        PrototypeFlightPlan plan,
        float elapsedSeconds,
        Vector3 actualPosition,
        Vector3 actualVelocity,
        Quaternion actualRotation,
        Vector3 actualAngularVelocity,
        float actualFuelKg,
        Vector3 currentTargetPosition,
        float mainAccelerationMetersPerSecondSquared,
        float rcsAccelerationMetersPerSecondSquared,
        float massKg,
        PrototypeFlightPlanTrackerSettings settings)
    {
        if (!plan.IsValid)
        {
            return PrototypeFlightPlanTrackingCommand.Blocked(
                plan,
                elapsedSeconds,
                PrototypeFlightPlanAbortReplanReason.NonExecutable | plan.nonExecutableReasons,
                "PlanInvalid");
        }

        if (!TryInterpolateSample(plan, elapsedSeconds, out PrototypeTrajectoryPredictedSample reference, out int sampleIndex, out _))
        {
            return PrototypeFlightPlanTrackingCommand.Blocked(
                plan,
                elapsedSeconds,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "PlanInvalid: no samples");
        }

        bool hasActiveSegment = plan.TryGetActiveSegment(elapsedSeconds, out PrototypeManeuverSegment activeSegment);
        if (!hasActiveSegment && reference.segmentIndex >= 0 && reference.segmentIndex < plan.SegmentCount)
        {
            activeSegment = plan.segments[reference.segmentIndex];
            hasActiveSegment = true;
        }

        PrototypeManeuverPhase activePhase = hasActiveSegment ? activeSegment.phase : reference.phase;
        Vector3 tangent = ResolvePlannedTangent(plan, sampleIndex, reference, hasActiveSegment ? activeSegment : default, currentTargetPosition, actualPosition);
        Vector3 targetDirection = NormalizeOrZero(currentTargetPosition - actualPosition);
        float tangentDotTarget = tangent.sqrMagnitude > DirectionEpsilon && targetDirection.sqrMagnitude > DirectionEpsilon
            ? Vector3.Dot(tangent, targetDirection)
            : 0f;

        Vector3 positionErrorWorld = reference.position - actualPosition;
        Vector3 velocityErrorWorld = reference.velocity - actualVelocity;
        float alongTrackError = tangent.sqrMagnitude > DirectionEpsilon ? Vector3.Dot(positionErrorWorld, tangent) : 0f;
        Vector3 crossTrackError = tangent.sqrMagnitude > DirectionEpsilon
            ? positionErrorWorld - tangent * alongTrackError
            : positionErrorWorld;
        float attitudeError = Quaternion.Angle(actualRotation, reference.rotation);
        float angularVelocityError = Vector3.Distance(actualAngularVelocity, reference.angularVelocity);
        float speedError = reference.velocity.magnitude - actualVelocity.magnitude;
        float fuelError = Mathf.Abs(Mathf.Max(0f, actualFuelKg) - reference.remainingFuelKg);

        PrototypeFlightPlanAbortReplanReason reasons = PrototypeFlightPlanAbortReplanReason.None;
        PrototypeFlightPlanTolerance tolerance = hasActiveSegment ? activeSegment.tolerance : PrototypeFlightPlanTolerance.Default;
        float positionTolerance = Mathf.Max(0.25f, tolerance.positionMeters * settings.errorToleranceMultiplier);
        float velocityTolerance = Mathf.Max(0.1f, tolerance.velocityMetersPerSecond * settings.errorToleranceMultiplier);
        if (positionErrorWorld.magnitude > positionTolerance)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.PositionDivergence | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
        }

        if (velocityErrorWorld.magnitude > velocityTolerance)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.VelocityDivergence | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
        }

        Vector3 feedForwardAcceleration = EstimateFeedForwardAcceleration(
            plan,
            sampleIndex,
            reference,
            hasActiveSegment ? activeSegment : default,
            mainAccelerationMetersPerSecondSquared,
            massKg);
        Vector3 desiredAcceleration = feedForwardAcceleration
            + positionErrorWorld * settings.positionKp
            + velocityErrorWorld * settings.velocityKd;
        float maxAcceleration = Mathf.Max(
            0f,
            settings.maxTrackingAccelerationMetersPerSecondSquared,
            mainAccelerationMetersPerSecondSquared + rcsAccelerationMetersPerSecondSquared);
        desiredAcceleration = ClampMagnitude(desiredAcceleration, maxAcceleration);

        Vector3 mainDirection = ResolveMainDirection(activePhase, hasActiveSegment ? activeSegment : default, tangent, actualVelocity, targetDirection);
        float accelerationDotTangent = desiredAcceleration.sqrMagnitude > DirectionEpsilon && tangent.sqrMagnitude > DirectionEpsilon
            ? Vector3.Dot(desiredAcceleration.normalized, tangent)
            : 0f;
        float brakeDot = mainDirection.sqrMagnitude > DirectionEpsilon && actualVelocity.sqrMagnitude > DirectionEpsilon
            ? Vector3.Dot(mainDirection, -actualVelocity.normalized)
            : 1f;

        bool mainAllowed = CanUseMainForPhase(activePhase, hasActiveSegment ? activeSegment.commandMode : PrototypeManeuverCommandMode.None);
        bool directFastTransferMain = hasActiveSegment
            && activeSegment.profile == PrototypeManeuverProfile.DirectFastTransfer
            && (activePhase == PrototypeManeuverPhase.ProgradeBurn || activePhase == PrototypeManeuverPhase.RetrogradeBurn);
        if (activePhase == PrototypeManeuverPhase.ProgradeBurn || activePhase == PrototypeManeuverPhase.ReacquireRoute)
        {
            float mainDirectionDotTangent = mainDirection.sqrMagnitude > DirectionEpsilon && tangent.sqrMagnitude > DirectionEpsilon
                ? Vector3.Dot(mainDirection, tangent)
                : 1f;
            if (mainAllowed && mainDirectionDotTangent < settings.progradeTangentDotMinimum)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection;
                mainAllowed = false;
            }

            if (!directFastTransferMain
                && desiredAcceleration.sqrMagnitude > DirectionEpsilon
                && accelerationDotTangent < settings.progradeTangentDotMinimum)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection;
                mainAllowed = false;
            }

            if (targetDirection.sqrMagnitude > DirectionEpsilon && tangentDotTarget < settings.directTargetDotMinimum)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection;
                mainAllowed = false;
            }
        }
        else if (activePhase == PrototypeManeuverPhase.RetrogradeBurn)
        {
            bool directFastBrakeDirectionDiverged = directFastTransferMain
                && actualVelocity.magnitude > Mathf.Max(2f, plan.targetArrivalSpeedMetersPerSecond * 2f)
                && brakeDot < 0.7071f;
            bool defaultBrakeDirectionDiverged = !directFastTransferMain
                && actualVelocity.sqrMagnitude > 0.01f
                && brakeDot < settings.brakeVelocityDotMinimum;
            if (directFastBrakeDirectionDiverged || defaultBrakeDirectionDiverged)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection;
                mainAllowed = false;
            }
        }
        else if (activePhase == PrototypeManeuverPhase.Hold
            || activePhase == PrototypeManeuverPhase.LateralCorrection)
        {
            mainAllowed = false;
        }

        float mainAcceleration = Mathf.Max(0.0001f, mainAccelerationMetersPerSecondSquared);
        float mainComponent = mainAllowed && mainDirection.sqrMagnitude > DirectionEpsilon
            ? Mathf.Max(0f, Vector3.Dot(desiredAcceleration, mainDirection))
            : 0f;
        float mainThrottle = mainAllowed ? Mathf.Clamp01(mainComponent / mainAcceleration) : 0f;
        if (mainAllowed && directFastTransferMain)
        {
            mainThrottle = Mathf.Clamp01(activeSegment.mainThrottle);
        }

        if (mainAllowed
            && activePhase == PrototypeManeuverPhase.RetrogradeBurn
            && hasActiveSegment
            && actualVelocity.magnitude > Mathf.Max(0.1f, plan.targetArrivalSpeedMetersPerSecond))
        {
            mainThrottle = Mathf.Max(mainThrottle, activeSegment.mainThrottle);
        }

        Vector3 mainAccelerationWorld = mainDirection * (mainThrottle * mainAcceleration);
        Vector3 rcsAccelerationWorld = desiredAcceleration - mainAccelerationWorld;
        float rcsLimit = Mathf.Max(
            0f,
            rcsAccelerationMetersPerSecondSquared > 0f
                ? rcsAccelerationMetersPerSecondSquared
                : settings.maxRcsAccelerationMetersPerSecondSquared);
        rcsAccelerationWorld = ClampMagnitude(rcsAccelerationWorld, rcsLimit);
        Vector3 rcsForceWorld = rcsAccelerationWorld * Mathf.Max(0f, massKg);

        bool expired = elapsedSeconds > plan.totalDurationSeconds + Mathf.Max(0.05f, tolerance.timingSeconds);
        if (expired)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.PlanExpired;
        }

        bool requiresReplan = reasons != PrototypeFlightPlanAbortReplanReason.None;
        string statusLabel = requiresReplan
            ? "Replan: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons)
            : "Tracking";
        var error = new PrototypeFlightPlanTrackingError(
            plan.planId,
            plan.revision,
            true,
            hasActiveSegment ? activeSegment.index : -1,
            sampleIndex,
            activePhase,
            elapsedSeconds,
            reference.elapsedTimeSeconds,
            reference.position,
            reference.velocity,
            reference.rotation,
            reference.angularVelocity,
            positionErrorWorld,
            velocityErrorWorld,
            crossTrackError.magnitude,
            alongTrackError,
            speedError,
            attitudeError,
            angularVelocityError,
            fuelError,
            tangent,
            tangentDotTarget,
            reasons,
            requiresReplan,
            statusLabel);
        return new PrototypeFlightPlanTrackingCommand(
            error,
            true,
            mainAllowed,
            desiredAcceleration,
            mainDirection,
            mainThrottle,
            rcsAccelerationWorld,
            rcsForceWorld,
            accelerationDotTangent,
            brakeDot,
            reasons,
            requiresReplan,
            statusLabel);
    }

    private static Vector3 ResolvePlannedTangent(
        PrototypeFlightPlan plan,
        int sampleIndex,
        PrototypeTrajectoryPredictedSample reference,
        PrototypeManeuverSegment segment,
        Vector3 currentTargetPosition,
        Vector3 actualPosition)
    {
        PrototypeTrajectoryPredictedSample[] samples = plan.predictedSamples;
        if (samples != null && samples.Length > 1)
        {
            int previousIndex = Mathf.Clamp(sampleIndex, 0, samples.Length - 1);
            int nextIndex = Mathf.Clamp(sampleIndex + 1, 0, samples.Length - 1);
            Vector3 delta = samples[nextIndex].position - samples[previousIndex].position;
            if (delta.sqrMagnitude > DirectionEpsilon)
            {
                return delta.normalized;
            }
        }

        if (reference.velocity.sqrMagnitude > DirectionEpsilon)
        {
            return reference.velocity.normalized;
        }

        if (segment.primaryDirectionWorld.sqrMagnitude > DirectionEpsilon)
        {
            return segment.primaryDirectionWorld.normalized;
        }

        return NormalizeOrZero(currentTargetPosition - actualPosition);
    }

    private static Vector3 EstimateFeedForwardAcceleration(
        PrototypeFlightPlan plan,
        int sampleIndex,
        PrototypeTrajectoryPredictedSample reference,
        PrototypeManeuverSegment segment,
        float mainAccelerationMetersPerSecondSquared,
        float massKg)
    {
        Vector3 segmentFeedForward = EstimateSegmentFeedForwardAcceleration(
            reference,
            segment,
            mainAccelerationMetersPerSecondSquared,
            massKg);
        PrototypeTrajectoryPredictedSample[] samples = plan.predictedSamples;
        if (samples != null && samples.Length > 1)
        {
            int previousIndex = Mathf.Clamp(sampleIndex, 0, samples.Length - 1);
            int nextIndex = Mathf.Clamp(sampleIndex + 1, 0, samples.Length - 1);
            float dt = samples[nextIndex].elapsedTimeSeconds - samples[previousIndex].elapsedTimeSeconds;
            if (dt > 0.0001f)
            {
                Vector3 sampleAcceleration = (samples[nextIndex].velocity - samples[previousIndex].velocity) / dt;
                return sampleAcceleration.sqrMagnitude > DirectionEpsilon || segmentFeedForward.sqrMagnitude <= DirectionEpsilon
                    ? sampleAcceleration
                    : segmentFeedForward;
            }
        }

        return segmentFeedForward;
    }

    private static Vector3 EstimateSegmentFeedForwardAcceleration(
        PrototypeTrajectoryPredictedSample reference,
        PrototypeManeuverSegment segment,
        float mainAccelerationMetersPerSecondSquared,
        float massKg)
    {
        float plannedMainThrottle = segment.phase == PrototypeManeuverPhase.RetrogradeBurn
            ? Mathf.Max(reference.expectedMainThrottle, segment.mainThrottle)
            : reference.expectedMainThrottle;
        Vector3 main = segment.primaryDirectionWorld.sqrMagnitude > DirectionEpsilon
            ? segment.primaryDirectionWorld.normalized * Mathf.Max(0f, mainAccelerationMetersPerSecondSquared) * plannedMainThrottle
            : Vector3.zero;
        Vector3 rcs = massKg > 0.0001f ? reference.expectedRcsForceWorld / massKg : Vector3.zero;
        return main + rcs;
    }

    private static Vector3 ResolveMainDirection(
        PrototypeManeuverPhase phase,
        PrototypeManeuverSegment segment,
        Vector3 plannedTangent,
        Vector3 actualVelocity,
        Vector3 targetDirection)
    {
        if (phase == PrototypeManeuverPhase.RetrogradeBurn || phase == PrototypeManeuverPhase.FlipToRetrograde)
        {
            if (segment.profile == PrototypeManeuverProfile.DirectFastTransfer
                && segment.primaryDirectionWorld.sqrMagnitude > DirectionEpsilon)
            {
                return segment.primaryDirectionWorld.normalized;
            }

            if (actualVelocity.sqrMagnitude > DirectionEpsilon)
            {
                return -actualVelocity.normalized;
            }

            if (segment.primaryDirectionWorld.sqrMagnitude > DirectionEpsilon)
            {
                return segment.primaryDirectionWorld.normalized;
            }

            return -plannedTangent;
        }

        if (segment.primaryDirectionWorld.sqrMagnitude > DirectionEpsilon)
        {
            return segment.primaryDirectionWorld.normalized;
        }

        if (plannedTangent.sqrMagnitude > DirectionEpsilon)
        {
            return plannedTangent.normalized;
        }

        return targetDirection.sqrMagnitude > DirectionEpsilon ? targetDirection.normalized : Vector3.forward;
    }

    private static bool CanUseMainForPhase(PrototypeManeuverPhase phase, PrototypeManeuverCommandMode mode)
    {
        if (mode != PrototypeManeuverCommandMode.MainThrottle
            && mode != PrototypeManeuverCommandMode.CombinedMainAndRcs)
        {
            return false;
        }

        return phase == PrototypeManeuverPhase.ProgradeBurn
            || phase == PrototypeManeuverPhase.AvoidanceBurn
            || phase == PrototypeManeuverPhase.ReacquireRoute
            || phase == PrototypeManeuverPhase.RetrogradeBurn;
    }

    private static Vector3 ClampMagnitude(Vector3 value, float maxMagnitude)
    {
        if (maxMagnitude <= 0f)
        {
            return Vector3.zero;
        }

        return value.sqrMagnitude > maxMagnitude * maxMagnitude
            ? value.normalized * maxMagnitude
            : value;
    }

    private static Vector3 NormalizeOrZero(Vector3 value)
    {
        return TrajectoryPredictionMath.IsFinite(value) && value.sqrMagnitude > DirectionEpsilon
            ? value.normalized
            : Vector3.zero;
    }
}

[Serializable]
public struct PrototypeFlightPlanDivergenceReport
{
    public PrototypeFlightPlanAbortReplanReason reasons;
    public bool requiresReplan;
    public bool requiresAbort;
    public string statusLabel;

    public PrototypeFlightPlanDivergenceReport(
        PrototypeFlightPlanAbortReplanReason reasons,
        bool requiresReplan,
        bool requiresAbort,
        string statusLabel)
    {
        this.reasons = reasons;
        this.requiresAbort = requiresAbort;
        this.requiresReplan = requiresReplan && !requiresAbort;
        this.statusLabel = string.IsNullOrEmpty(statusLabel) ? "Replan: none" : statusLabel;
    }

    public bool HasDivergence => reasons != PrototypeFlightPlanAbortReplanReason.None;
    public bool RequiresAction => requiresReplan || requiresAbort;

    public static PrototypeFlightPlanDivergenceReport Clear => new PrototypeFlightPlanDivergenceReport(
        PrototypeFlightPlanAbortReplanReason.None,
        false,
        false,
        "Replan: none");
}

public static class PrototypeFlightPlanDivergenceMonitor
{
    public static PrototypeFlightPlanDivergenceReport Evaluate(
        PrototypeFlightPlan plan,
        PrototypeFlightPlanExecutionState executionState,
        Vector3 currentTargetPosition,
        bool obstacleDetected,
        bool collisionPredicted,
        bool missingDependency,
        bool nonFiniteState,
        bool fuelStarved,
        bool actuatorLimited,
        bool noMainThrustAuthority,
        bool noRcsAuthority,
        bool planExpired,
        float targetMoveToleranceMeters)
    {
        PrototypeFlightPlanAbortReplanReason reasons = executionState.replanReasons;
        if (missingDependency)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.MissingDependency;
        }

        if (nonFiniteState || !plan.IsValid || !executionState.IsFinite)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NonFiniteState;
        }

        if (plan.HasSegments && TrajectoryPredictionMath.IsFinite(currentTargetPosition))
        {
            float targetTolerance = Mathf.Max(0.5f, targetMoveToleranceMeters);
            if (Vector3.Distance(plan.targetPositionWorld, currentTargetPosition) > targetTolerance)
            {
                reasons |= PrototypeFlightPlanAbortReplanReason.TargetMoved;
            }
        }

        if (obstacleDetected)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.ObstacleDetected;
        }

        if (collisionPredicted)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.CollisionPredicted;
        }

        if (fuelStarved)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.FuelStarved;
        }

        if (actuatorLimited)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.ActuatorLimited;
        }

        if (noMainThrustAuthority)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority;
        }

        if (noRcsAuthority)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.NoRcsAuthority;
        }

        if (planExpired)
        {
            reasons |= PrototypeFlightPlanAbortReplanReason.PlanExpired;
        }

        bool requiresAbort = HasAnyReason(
            reasons,
            PrototypeFlightPlanAbortReplanReason.MissingDependency
                | PrototypeFlightPlanAbortReplanReason.NonFiniteState
                | PrototypeFlightPlanAbortReplanReason.FuelStarved
                | PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority
                | PrototypeFlightPlanAbortReplanReason.NoRcsAuthority);
        bool requiresReplan = reasons != PrototypeFlightPlanAbortReplanReason.None && !requiresAbort;
        string prefix = requiresAbort ? "Abort: " : requiresReplan ? "Replan: " : "Replan: none";
        string reasonLabel = FormatReasons(reasons);
        return new PrototypeFlightPlanDivergenceReport(
            reasons,
            requiresReplan,
            requiresAbort,
            reasons == PrototypeFlightPlanAbortReplanReason.None ? prefix : prefix + reasonLabel);
    }

    public static string FormatReasons(PrototypeFlightPlanAbortReplanReason reasons)
    {
        if (reasons == PrototypeFlightPlanAbortReplanReason.None)
        {
            return "none";
        }

        string label = string.Empty;
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.ManualOverride, "ManualOverride");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.MissingDependency, "MissingDependency");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.NonFiniteState, "NonFiniteState");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.TargetMoved, "TargetMoved");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.ObstacleDetected, "ObstacleDetected");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.CollisionPredicted, "CollisionPredicted");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.PositionDivergence, "PositionDivergence");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.VelocityDivergence, "VelocityDivergence");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.AttitudeDivergence, "AttitudeDivergence");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.TimeSlip, "TimeSlip");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.FuelMismatch, "FuelMismatch");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.FuelStarved, "FuelStarved");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.ActuatorLimited, "ActuatorLimited");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.RcsAllocatorResidual, "RcsAllocatorResidual");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority, "NoMainThrustAuthority");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.NoRcsAuthority, "NoRcsAuthority");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.PlanExpired, "PlanExpired");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.NonExecutable, "NonExecutable");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection, "InvalidPlanDirection");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.TrackingDiverged, "TrackingDiverged");
        AppendReason(ref label, reasons, PrototypeFlightPlanAbortReplanReason.PlanUnstable, "PlanUnstable");
        return string.IsNullOrEmpty(label) ? reasons.ToString() : label;
    }

    private static bool HasAnyReason(
        PrototypeFlightPlanAbortReplanReason reasons,
        PrototypeFlightPlanAbortReplanReason mask)
    {
        return (reasons & mask) != 0;
    }

    private static void AppendReason(
        ref string label,
        PrototypeFlightPlanAbortReplanReason reasons,
        PrototypeFlightPlanAbortReplanReason reason,
        string text)
    {
        if ((reasons & reason) == 0)
        {
            return;
        }

        label = string.IsNullOrEmpty(label) ? text : label + "," + text;
    }
}
