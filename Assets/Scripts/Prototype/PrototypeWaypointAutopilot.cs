using UnityEngine;
using UnityEngine.InputSystem;

public enum PrototypeWaypointAutopilotState
{
    Idle,
    TargetSelected,
    FuelCheck,
    AlignForBurn,
    Accelerate,
    FlipForBrake,
    Brake,
    ObstacleAvoidance,
    FinalApproach,
    HoldPosition,
    Complete,
    Aborted,
    FuelInsufficient,
    Failed
}

public enum PrototypeWaypointAutopilotArrivalPhase
{
    LongRangeBurn,
    Brake,
    Avoidance,
    LateralCorrection,
    FinalApproach,
    Hold
}

public struct PrototypeWaypointAutopilotMetrics
{
    public Vector3 directionToTarget;
    public Vector3 lateralVelocity;
    public float distance;
    public float closingSpeed;
    public float lateralSpeed;
    public float relativeSpeed;
    public float maxDeceleration;
    public float stoppingDistance;
    public float etaSeconds;
    public bool shouldBrake;
    public bool isFinite;
}

public struct PrototypeWaypointFuelEstimate
{
    public float availableBurnSeconds;
    public float requiredBurnSeconds;
    public float reserveBurnSeconds;
    public bool isFuelFree;
    public bool isFeasible;
}

[DisallowMultipleComponent]
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(PlayerShipController))]
public class PrototypeWaypointAutopilot : MonoBehaviour
{
    [Header("Navigation")]
    [SerializeField] private PrototypeWaypointManager waypointManager;
    [SerializeField] private PrototypeNavigationTarget currentTarget;
    [SerializeField] private float arrivalDistanceMeters = 10f;
    [SerializeField] private float arrivalSpeedMetersPerSecond = 1f;
    [SerializeField] private float finalApproachDistanceMeters = 60f;
    [SerializeField] private float stoppingSafetyMarginMeters = 25f;
    [SerializeField] private float alignmentAngleDegrees = 12f;
    [SerializeField] private float finalApproachThrottle = 0.25f;
    [SerializeField] private float finalApproachLateralToleranceMetersPerSecond = 0.2f;
    [SerializeField] private float lateralCorrectionSpeed = 6f;
    [SerializeField] private float fuelReserveSeconds = 8f;

    [Header("Obstacle Avoidance")]
    [SerializeField] private bool obstacleAvoidanceEnabled = true;
    [SerializeField] private LayerMask obstacleLayerMask = ~((1 << 2) | (1 << 5));
    [SerializeField] private float obstacleShipRadiusMeters = 4f;
    [SerializeField] private float obstacleClearanceMeters = 6f;
    [SerializeField] private float obstacleDangerDistanceMeters = 8f;
    [SerializeField] private float obstacleMinCastDistanceMeters = 20f;
    [SerializeField] private float obstacleMaxCastDistanceMeters = 260f;
    [SerializeField] private float obstacleSpeedLookAheadSeconds = 2.2f;
    [SerializeField] private float obstacleScanIntervalSeconds = 0.06f;
    [SerializeField] private int obstacleClearFramesRequired = 3;
    [SerializeField] private int obstacleMinimumAvoidanceFrames = 2;
    [SerializeField] private float obstacleClearTimeSeconds = 0.18f;
    [SerializeField] private float obstacleMainAssistThrottle = 0.35f;
    [SerializeField] private float obstacleBlockedTimeoutSeconds = 5f;

    [Header("Runtime")]
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PlayerShipController shipController;

    private bool autopilotEngaged;
    private bool togglePressedLastFrame;
    private bool nextPressedLastFrame;
    private bool previousPressedLastFrame;
    private float manualOverrideGraceUntilTime;
    private PrototypeWaypointAutopilotArrivalPhase arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Hold;
    private string arrivalFailureReason = "none";
    private float requestedMainThrottle;
    private Vector3 requestedRcsTranslation;
    private Vector3 desiredBurnDirection;
    private bool limitedFinalApproachCapability;
    private PrototypeMomentumAssist momentumAssist;
    private readonly RaycastHit[] obstacleHitBuffer = new RaycastHit[16];
    private bool avoidanceActive;
    private string avoidanceReason = "none";
    private string avoidanceTargetName = "none";
    private float avoidanceDistance = float.PositiveInfinity;
    private Vector3 avoidanceVectorWorld;
    private float avoidanceClearanceMeters;
    private RaycastHit lastObstacleHit;
    private Vector3 cachedObstacleDirection;
    private bool cachedObstacleBlocked;
    private float nextObstacleScanTime;
    private float avoidanceStartedTime;
    private float avoidanceClearStartedTime;
    private int avoidanceClearFrameCount;
    private int avoidanceFrameCount;
    private PrototypeWaypointAutopilotArrivalPhase returnPhaseBeforeAvoidance = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;

    public PrototypeWaypointAutopilotState CurrentState { get; private set; } = PrototypeWaypointAutopilotState.Idle;
    public PrototypeNavigationTarget CurrentTarget => currentTarget;
    public PrototypeWaypointAutopilotMetrics LastMetrics { get; private set; }
    public PrototypeWaypointFuelEstimate LastFuelEstimate { get; private set; }
    public string ArrivalStatus { get; private set; } = "idle";
    public bool AutopilotEngaged => autopilotEngaged;
    public string TargetName => currentTarget != null ? currentTarget.DisplayName : "none";
    public float DistanceToTarget => LastMetrics.distance;
    public float ClosingSpeed => LastMetrics.closingSpeed;
    public float LateralSpeed => LastMetrics.lateralSpeed;
    public float StoppingDistance => LastMetrics.stoppingDistance;
    public float EtaSeconds => LastMetrics.etaSeconds;
    public float AvailableBurnSeconds => LastFuelEstimate.availableBurnSeconds;
    public float RequiredBurnSeconds => LastFuelEstimate.requiredBurnSeconds;
    public bool FuelFeasible => LastFuelEstimate.isFeasible;
    public PrototypeWaypointAutopilotArrivalPhase ArrivalPhase => arrivalPhase;
    public string ArrivalFailureReason => string.IsNullOrWhiteSpace(arrivalFailureReason) ? "none" : arrivalFailureReason;
    public float RequestedMainThrottle => requestedMainThrottle;
    public Vector3 RequestedRcsTranslation => requestedRcsTranslation;
    public Vector3 DesiredBurnDirection => desiredBurnDirection;
    public bool LimitedFinalApproachCapability => limitedFinalApproachCapability;
    public bool AvoidanceActive => avoidanceActive;
    public string AvoidanceReason => string.IsNullOrWhiteSpace(avoidanceReason) ? "none" : avoidanceReason;
    public string AvoidanceTargetName => string.IsNullOrWhiteSpace(avoidanceTargetName) ? "none" : avoidanceTargetName;
    public float AvoidanceDistance => avoidanceDistance;
    public Vector3 AvoidanceVectorWorld => avoidanceVectorWorld;
    public float AvoidanceClearanceMeters => avoidanceClearanceMeters;
    public RaycastHit LastObstacleHit => lastObstacleHit;

    private void Awake()
    {
        ResolveReferences();
    }

    private void Start()
    {
        ResolveReferences();
        if (waypointManager != null && waypointManager.TargetCount == 0)
        {
            waypointManager.EnsureDefaultWaypoints();
        }

        if (currentTarget == null && waypointManager != null)
        {
            SelectTarget(waypointManager.SelectedTarget);
        }
    }

    public void Bind(PrototypeWaypointManager manager, PlayerShipController controller, ShipStats stats, Rigidbody body)
    {
        waypointManager = manager != null ? manager : waypointManager;
        shipController = controller != null ? controller : shipController;
        shipStats = stats != null ? stats : shipStats;
        shipRigidbody = body != null ? body : shipRigidbody;
        ResolveReferences();
        if (currentTarget == null && waypointManager != null)
        {
            SelectTarget(waypointManager.SelectedTarget);
        }
    }

    private void Update()
    {
        HandleInput();
        if (autopilotEngaged && shipController != null && shipController.LastManualFlightInput && Time.time >= manualOverrideGraceUntilTime)
        {
            Abort("manual override");
        }
    }

    private void FixedUpdate()
    {
        ResolveReferences();
        RefreshDiagnostics();

        if (!autopilotEngaged)
        {
            return;
        }

        if (momentumAssist != null && momentumAssist.IsActive)
        {
            arrivalFailureReason = "momentum assist active";
            Abort("momentum assist active");
            return;
        }

        if (shipRigidbody == null || shipStats == null || shipController == null || currentTarget == null)
        {
            SetState(PrototypeWaypointAutopilotState.Failed, "missing dependency");
            arrivalFailureReason = "missing dependency";
            ClearCommands();
            autopilotEngaged = false;
            return;
        }

        LastFuelEstimate = EstimateFuel(LastMetrics, shipStats, GetMaxAcceleration(), fuelReserveSeconds);
        if (!LastFuelEstimate.isFeasible || (!LastFuelEstimate.isFuelFree && !shipStats.HasFuel))
        {
            SetState(PrototypeWaypointAutopilotState.FuelInsufficient, "fuel insufficient");
            arrivalFailureReason = "FuelInsufficient";
            ClearCommands();
            autopilotEngaged = false;
            return;
        }

        if (!HasAnyNavigationAuthority())
        {
            RaycastHit authorityObstacleHit;
            bool blockedWithoutAuthority = TryScanObstacleCorridor(
                LastMetrics.directionToTarget,
                LastMetrics.shouldBrake ? PrototypeWaypointAutopilotArrivalPhase.Brake : PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn,
                true,
                out authorityObstacleHit);
            arrivalFailureReason = blockedWithoutAuthority ? "NoAvoidanceAuthority" : "NoAuthority";
            SetState(PrototypeWaypointAutopilotState.Failed, blockedWithoutAuthority ? "no avoidance authority" : "no authority");
            ClearCommands();
            autopilotEngaged = false;
            return;
        }

        if (HasArrived())
        {
            SetState(PrototypeWaypointAutopilotState.HoldPosition, "holding");
            ClearCommands();
            ApplyLateralCorrection();
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Hold;
            arrivalFailureReason = string.Empty;
            limitedFinalApproachCapability = false;
            SetState(PrototypeWaypointAutopilotState.Complete, "arrived");
            autopilotEngaged = false;
            return;
        }

        RunAutopilotStep();
    }

    public void ToggleAutopilot()
    {
        if (autopilotEngaged)
        {
            Abort("toggle off");
            return;
        }

        if (currentTarget == null && waypointManager != null)
        {
            SelectTarget(waypointManager.SelectedTarget);
        }

        if (currentTarget == null)
        {
            SetState(PrototypeWaypointAutopilotState.Failed, "no target");
            return;
        }

        ResolveReferences();
        if (shipController == null)
        {
            SetState(PrototypeWaypointAutopilotState.Failed, "missing controller");
            return;
        }

        RefreshDiagnostics();
        LastFuelEstimate = EstimateFuel(LastMetrics, shipStats, GetMaxAcceleration(), fuelReserveSeconds);
        if (!LastFuelEstimate.isFeasible)
        {
            SetState(PrototypeWaypointAutopilotState.FuelInsufficient, "fuel insufficient");
            arrivalFailureReason = "FuelInsufficient";
            return;
        }

        if (!HasAnyNavigationAuthority())
        {
            RaycastHit authorityObstacleHit;
            bool blockedWithoutAuthority = TryScanObstacleCorridor(
                LastMetrics.directionToTarget,
                LastMetrics.shouldBrake ? PrototypeWaypointAutopilotArrivalPhase.Brake : PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn,
                true,
                out authorityObstacleHit);
            arrivalFailureReason = blockedWithoutAuthority ? "NoAvoidanceAuthority" : "NoAuthority";
            SetState(PrototypeWaypointAutopilotState.Failed, blockedWithoutAuthority ? "no avoidance authority" : "no authority");
            return;
        }

        // Waypoint autopilot is a system controller: normalize ship controls before it asks for actuators.
        momentumAssist?.Abort("autopilot engaged");
        shipController.ClearExternalFlightAssistRequest();
        shipController.SetControlMode(FlightControlMode.Normal);
        shipController.SetRcsEnabled(true);
        shipController.SetSasEnabled(true);
        shipController.CaptureSasTargetRotation();
        shipController.SetMainThrottle(0f);
        shipController.ClearManualFlightInputForAssist();
        manualOverrideGraceUntilTime = Time.time + 0.25f;

        autopilotEngaged = true;
        SetState(PrototypeWaypointAutopilotState.FuelCheck, "fuel ok");
        arrivalFailureReason = string.Empty;
        limitedFinalApproachCapability = false;
        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
        ResetAvoidanceDiagnostics(true);
    }

    public void Abort(string reason = "aborted")
    {
        autopilotEngaged = false;
        ClearCommands();
        ResetAvoidanceDiagnostics(true);
        arrivalFailureReason = reason;
        SetState(PrototypeWaypointAutopilotState.Aborted, reason);
    }

public void ResetForBootstrap()
    {
        autopilotEngaged = false;
        manualOverrideGraceUntilTime = 0f;
        ClearCommands();
        ResetAvoidanceDiagnostics(true);
        SetState(currentTarget != null ? PrototypeWaypointAutopilotState.TargetSelected : PrototypeWaypointAutopilotState.Idle, currentTarget != null ? "target selected" : "idle");
    }


    public void SelectTarget(PrototypeNavigationTarget target)
    {
        currentTarget = target;
        if (waypointManager != null && target != null)
        {
            waypointManager.SelectTarget(target);
        }

        RefreshDiagnostics();
        if (!autopilotEngaged)
        {
            SetState(target != null ? PrototypeWaypointAutopilotState.TargetSelected : PrototypeWaypointAutopilotState.Idle, target != null ? "target selected" : "idle");
        }
    }

    public PrototypeNavigationTarget SelectNextTarget()
    {
        ResolveReferences();
        PrototypeNavigationTarget target = waypointManager != null ? waypointManager.SelectNextTarget() : null;
        SelectTarget(target);
        return target;
    }

    public PrototypeNavigationTarget SelectPreviousTarget()
    {
        ResolveReferences();
        PrototypeNavigationTarget target = waypointManager != null ? waypointManager.SelectPreviousTarget() : null;
        SelectTarget(target);
        return target;
    }

    public PrototypeWaypointAutopilotMetrics EvaluateMetrics()
    {
        RefreshDiagnostics();
        return LastMetrics;
    }

    public static PrototypeWaypointAutopilotMetrics CalculateMetrics(
        Vector3 shipPosition,
        Vector3 shipVelocity,
        Vector3 targetPosition,
        float maxDeceleration,
        float safetyMargin)
    {
        Vector3 toTarget = targetPosition - shipPosition;
        float distance = toTarget.magnitude;
        Vector3 direction = distance > 0.0001f ? toTarget / distance : Vector3.forward;
        float closingSpeed = Vector3.Dot(shipVelocity, direction);
        Vector3 lateralVelocity = shipVelocity - direction * closingSpeed;
        float relativeSpeed = shipVelocity.magnitude;
        float safeDeceleration = Mathf.Max(0f, maxDeceleration);
        float positiveClosingSpeed = Mathf.Max(0f, closingSpeed);
        float stoppingDistance = positiveClosingSpeed > 0f && safeDeceleration > 0.0001f
            ? (positiveClosingSpeed * positiveClosingSpeed) / (2f * safeDeceleration)
            : 0f;
        float eta = positiveClosingSpeed > 0.0001f ? distance / positiveClosingSpeed : float.PositiveInfinity;
        bool finite = IsFinite(direction)
            && IsFinite(lateralVelocity)
            && IsFinite(distance)
            && IsFinite(closingSpeed)
            && IsFinite(stoppingDistance);

        return new PrototypeWaypointAutopilotMetrics
        {
            directionToTarget = direction,
            lateralVelocity = lateralVelocity,
            distance = distance,
            closingSpeed = closingSpeed,
            lateralSpeed = lateralVelocity.magnitude,
            relativeSpeed = relativeSpeed,
            maxDeceleration = safeDeceleration,
            stoppingDistance = stoppingDistance,
            etaSeconds = eta,
            shouldBrake = stoppingDistance + Mathf.Max(0f, safetyMargin) >= distance && positiveClosingSpeed > 0f,
            isFinite = finite
        };
    }

    public static PrototypeWaypointFuelEstimate EstimateFuel(
        PrototypeWaypointAutopilotMetrics metrics,
        ShipStats stats,
        float maxAcceleration,
        float reserveSeconds)
    {
        float fuelRate = stats != null ? stats.FuelConsumptionKgPerSecond : 0f;
        bool fuelFree = fuelRate <= 0f;
        float available = fuelFree || stats == null ? float.PositiveInfinity : stats.CurrentFuelKg / fuelRate;
        float acceleration = Mathf.Max(0.0001f, maxAcceleration);
        float brakeSeconds = Mathf.Max(0f, metrics.closingSpeed) / acceleration;
        float accelerationSeconds = metrics.distance > 0f ? Mathf.Sqrt((2f * metrics.distance) / acceleration) * 0.5f : 0f;
        float lateralSeconds = metrics.lateralSpeed / acceleration;
        float reserve = Mathf.Max(0f, reserveSeconds);
        float required = brakeSeconds + accelerationSeconds + lateralSeconds + reserve;

        return new PrototypeWaypointFuelEstimate
        {
            availableBurnSeconds = available,
            requiredBurnSeconds = required,
            reserveBurnSeconds = reserve,
            isFuelFree = fuelFree,
            isFeasible = fuelFree || available >= required
        };
    }

    private void RunAutopilotStep()
    {
        if (!LastMetrics.isFinite)
        {
            SetState(PrototypeWaypointAutopilotState.Failed, "non-finite metrics");
            arrivalFailureReason = "non-finite metrics";
            ClearCommands();
            autopilotEngaged = false;
            return;
        }

        float finalApproachWindowMeters = Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 3f);
        bool inFinalApproachWindow = LastMetrics.distance <= finalApproachWindowMeters;
        bool requestedFineApproach = inFinalApproachWindow && !LastMetrics.shouldBrake;
        bool hasLowLateralSpeed = LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond);

        if ((LastMetrics.shouldBrake || (LastMetrics.distance <= GetArrivalDistance() && !requestedFineApproach))
            && LastMetrics.distance <= Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 2f))
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
            limitedFinalApproachCapability = false;
            Vector3 brakeDirection = shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f
                ? -shipRigidbody.linearVelocity.normalized
                : -LastMetrics.directionToTarget;
            if (TryHandleObstacleAvoidance(brakeDirection, PrototypeWaypointAutopilotArrivalPhase.Brake, false))
            {
                return;
            }

            float angle = Vector3.Angle(transform.forward, brakeDirection);
            SetState(angle > alignmentAngleDegrees ? PrototypeWaypointAutopilotState.FlipForBrake : PrototypeWaypointAutopilotState.Brake, "braking");
            ApplyAutopilotRequest(brakeDirection, 1f);
            return;
        }

        if (requestedFineApproach)
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "final approach");
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalPhase = LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond
                ? PrototypeWaypointAutopilotArrivalPhase.LateralCorrection
                : PrototypeWaypointAutopilotArrivalPhase.FinalApproach;
            arrivalFailureReason = LimitedFinalApproachCapability
                ? "reduced final approach capability"
                : string.Empty;

            Vector3 finalApproachDirection = LastMetrics.closingSpeed > arrivalSpeedMetersPerSecond ? -shipRigidbody.linearVelocity : LastMetrics.directionToTarget;
            if (TryHandleObstacleAvoidance(finalApproachDirection, arrivalPhase, true))
            {
                return;
            }

            ApplyAutopilotRequest(finalApproachDirection, finalApproachThrottle, true);
            return;
        }

        if (LastMetrics.shouldBrake)
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
            Vector3 brakeDirection = shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f
                ? -shipRigidbody.linearVelocity.normalized
                : -LastMetrics.directionToTarget;
            if (TryHandleObstacleAvoidance(brakeDirection, PrototypeWaypointAutopilotArrivalPhase.Brake, false))
            {
                return;
            }

            float angle = Vector3.Angle(transform.forward, brakeDirection);
            SetState(angle > alignmentAngleDegrees ? PrototypeWaypointAutopilotState.FlipForBrake : PrototypeWaypointAutopilotState.Brake, "braking");
            ApplyAutopilotRequest(brakeDirection, 1f);
            return;
        }

        if (LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond)
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
        }
        else
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
        }

        if (requestedFineApproach)
        {
            arrivalFailureReason = hasLowLateralSpeed ? string.Empty : "reduced final approach capability";
            limitedFinalApproachCapability = !hasLowLateralSpeed;
        }
        else
        {
            arrivalFailureReason = string.Empty;
            limitedFinalApproachCapability = false;
        }

        if (TryHandleObstacleAvoidance(LastMetrics.directionToTarget, arrivalPhase, false))
        {
            return;
        }

        SetState(PrototypeWaypointAutopilotState.Accelerate, "accelerating");
        ApplyAutopilotRequest(LastMetrics.directionToTarget, 1f);
    }

    private bool TryHandleObstacleAvoidance(Vector3 plannedDirection, PrototypeWaypointAutopilotArrivalPhase interruptedPhase, bool finalApproach)
    {
        if (!obstacleAvoidanceEnabled || plannedDirection.sqrMagnitude <= 0.0001f)
        {
            if (avoidanceActive)
            {
                ResetAvoidanceActiveState();
            }

            return false;
        }

        RaycastHit obstacleHit;
        bool blocked = TryScanObstacleCorridor(plannedDirection, interruptedPhase, avoidanceActive, out obstacleHit);
        if (blocked)
        {
            if (!avoidanceActive)
            {
                avoidanceStartedTime = Time.time;
                avoidanceFrameCount = 0;
                returnPhaseBeforeAvoidance = interruptedPhase;
            }

            avoidanceActive = true;
            avoidanceFrameCount++;
            avoidanceClearFrameCount = 0;
            avoidanceClearStartedTime = 0f;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Avoidance;

            if (!HasAvoidanceAuthority())
            {
                FailObstacleAvoidance("NoAvoidanceAuthority");
                return true;
            }

            if (obstacleBlockedTimeoutSeconds > 0f
                && Time.time - avoidanceStartedTime >= obstacleBlockedTimeoutSeconds
                && avoidanceDistance <= Mathf.Max(obstacleDangerDistanceMeters, avoidanceClearanceMeters))
            {
                FailObstacleAvoidance("ObstacleBlocked");
                return true;
            }

            ApplyObstacleAvoidanceRequest(finalApproach);
            return true;
        }

        if (!avoidanceActive)
        {
            return false;
        }

        avoidanceFrameCount++;
        if (avoidanceClearFrameCount == 0)
        {
            avoidanceClearStartedTime = Time.time;
        }

        avoidanceClearFrameCount++;
        bool minimumElapsed = avoidanceFrameCount >= Mathf.Max(1, obstacleMinimumAvoidanceFrames);
        bool clearFramesReached = avoidanceClearFrameCount >= Mathf.Max(1, obstacleClearFramesRequired);
        bool clearTimeReached = obstacleClearTimeSeconds <= 0f || Time.time - avoidanceClearStartedTime >= obstacleClearTimeSeconds;
        if (minimumElapsed && (clearFramesReached || clearTimeReached))
        {
            ResetAvoidanceActiveState();
            arrivalPhase = interruptedPhase != PrototypeWaypointAutopilotArrivalPhase.Avoidance
                ? interruptedPhase
                : returnPhaseBeforeAvoidance;
            return false;
        }

        avoidanceReason = "CorridorClearing";
        arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Avoidance;
        ApplyObstacleAvoidanceRequest(finalApproach);
        return true;
    }

    private void ApplyObstacleAvoidanceRequest(bool finalApproach)
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 avoidanceDirection = avoidanceVectorWorld.sqrMagnitude > 0.0001f
            ? avoidanceVectorWorld.normalized
            : GetStableLateralDirection(cachedObstacleDirection.sqrMagnitude > 0.0001f ? cachedObstacleDirection.normalized : transform.forward);
        Vector3 assistForceWorld = CanUseRcsTranslation()
            ? avoidanceDirection * GetRcsTranslationForceScale()
            : Vector3.zero;
        float mainThrottle = 0f;

        if (assistForceWorld.sqrMagnitude <= 0.0001f && CanUseMainThrottle())
        {
            float alignmentAngle = Vector3.Angle(transform.forward, avoidanceDirection);
            if (alignmentAngle <= alignmentAngleDegrees)
            {
                mainThrottle = Mathf.Clamp01(finalApproach ? obstacleMainAssistThrottle * 0.5f : obstacleMainAssistThrottle);
            }
        }

        requestedMainThrottle = mainThrottle;
        requestedRcsTranslation = assistForceWorld;
        desiredBurnDirection = avoidanceDirection;
        SetState(PrototypeWaypointAutopilotState.ObstacleAvoidance, "obstacle avoidance");
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            assistForceWorld,
            ComputeAttitudeCommand(avoidanceDirection),
            mainThrottle,
            false));
    }

    private bool TryScanObstacleCorridor(
        Vector3 plannedDirection,
        PrototypeWaypointAutopilotArrivalPhase phase,
        bool forceRefresh,
        out RaycastHit obstacleHit)
    {
        obstacleHit = default;
        if (!obstacleAvoidanceEnabled || shipRigidbody == null || plannedDirection.sqrMagnitude <= 0.0001f)
        {
            cachedObstacleBlocked = false;
            return false;
        }

        Vector3 corridorDirection = GetObstacleCastDirection(plannedDirection, phase);
        if (corridorDirection.sqrMagnitude <= 0.0001f)
        {
            cachedObstacleBlocked = false;
            return false;
        }

        corridorDirection.Normalize();
        bool directionChanged = cachedObstacleDirection.sqrMagnitude <= 0.0001f
            || Vector3.Dot(cachedObstacleDirection.normalized, corridorDirection) < 0.995f;
        if (!forceRefresh && Application.isPlaying && !directionChanged && Time.time < nextObstacleScanTime)
        {
            obstacleHit = lastObstacleHit;
            return cachedObstacleBlocked;
        }

        cachedObstacleDirection = corridorDirection;
        nextObstacleScanTime = Time.time + GetObstacleScanIntervalSeconds();
        Vector3 origin = shipRigidbody.worldCenterOfMass;
        float castRadius = GetObstacleCastRadius(phase);
        float castDistance = GetObstacleCastDistance(phase);
        int hitCount = Physics.SphereCastNonAlloc(
            origin,
            castRadius,
            corridorDirection,
            obstacleHitBuffer,
            castDistance,
            obstacleLayerMask.value,
            QueryTriggerInteraction.Ignore);

        bool found = false;
        float nearestDistance = float.PositiveInfinity;
        RaycastHit nearestHit = default;
        PrototypeNavigationObstacle nearestObstacle = null;
        for (int i = 0; i < hitCount; i++)
        {
            RaycastHit hit = obstacleHitBuffer[i];
            PrototypeNavigationObstacle obstacle;
            if (!IsValidObstacleHit(hit, out obstacle))
            {
                continue;
            }

            float distance = Mathf.Max(0f, hit.distance);
            if (distance < nearestDistance)
            {
                found = true;
                nearestDistance = distance;
                nearestHit = hit;
                nearestObstacle = obstacle;
            }
        }

        cachedObstacleBlocked = found;
        if (!found)
        {
            if (!avoidanceActive)
            {
                avoidanceReason = "none";
                avoidanceTargetName = "none";
                avoidanceDistance = float.PositiveInfinity;
                avoidanceVectorWorld = Vector3.zero;
                avoidanceClearanceMeters = obstacleClearanceMeters;
                lastObstacleHit = default;
            }

            return false;
        }

        obstacleHit = nearestHit;
        lastObstacleHit = nearestHit;
        avoidanceDistance = nearestDistance;
        avoidanceClearanceMeters = nearestObstacle != null ? nearestObstacle.ClearanceRadiusMeters : obstacleClearanceMeters;
        avoidanceTargetName = nearestObstacle != null ? nearestObstacle.Label : nearestHit.collider.gameObject.name;
        avoidanceVectorWorld = ComputeAvoidanceVectorWorld(origin, corridorDirection, nearestHit);
        avoidanceReason = nearestDistance <= Mathf.Max(obstacleDangerDistanceMeters, avoidanceClearanceMeters)
            ? "ObstacleDanger"
            : "CorridorBlocked";
        return true;
    }

    private Vector3 GetObstacleCastDirection(Vector3 plannedDirection, PrototypeWaypointAutopilotArrivalPhase phase)
    {
        if (phase == PrototypeWaypointAutopilotArrivalPhase.Brake && shipRigidbody != null && shipRigidbody.linearVelocity.sqrMagnitude > 0.25f)
        {
            return shipRigidbody.linearVelocity.normalized;
        }

        if (phase == PrototypeWaypointAutopilotArrivalPhase.FinalApproach && LastMetrics.directionToTarget.sqrMagnitude > 0.0001f)
        {
            return LastMetrics.directionToTarget;
        }

        return plannedDirection.sqrMagnitude > 0.0001f ? plannedDirection.normalized : Vector3.zero;
    }

    private float GetObstacleCastRadius(PrototypeWaypointAutopilotArrivalPhase phase)
    {
        float radius = Mathf.Max(0.1f, obstacleShipRadiusMeters) + Mathf.Max(0f, obstacleClearanceMeters);
        if (phase == PrototypeWaypointAutopilotArrivalPhase.FinalApproach)
        {
            radius *= 0.65f;
        }

        return Mathf.Max(0.25f, radius);
    }

    private float GetObstacleCastDistance(PrototypeWaypointAutopilotArrivalPhase phase)
    {
        float speed = shipRigidbody != null ? shipRigidbody.linearVelocity.magnitude : 0f;
        float speedLookAhead = speed * Mathf.Max(0.1f, obstacleSpeedLookAheadSeconds);
        float stoppingLookAhead = LastMetrics.stoppingDistance + Mathf.Max(0f, stoppingSafetyMarginMeters);
        float targetLookAhead = LastMetrics.distance + Mathf.Max(0.1f, obstacleShipRadiusMeters);
        float dynamicDistance = Mathf.Max(targetLookAhead, Mathf.Max(speedLookAhead, stoppingLookAhead));
        dynamicDistance += Mathf.Max(0f, obstacleClearanceMeters);
        if (phase == PrototypeWaypointAutopilotArrivalPhase.FinalApproach)
        {
            dynamicDistance = Mathf.Min(dynamicDistance, Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 3f));
        }

        return Mathf.Clamp(dynamicDistance, Mathf.Max(1f, obstacleMinCastDistanceMeters), Mathf.Max(obstacleMinCastDistanceMeters, obstacleMaxCastDistanceMeters));
    }

    private float GetObstacleScanIntervalSeconds()
    {
        float speed = shipRigidbody != null ? shipRigidbody.linearVelocity.magnitude : 0f;
        float speedFactor = Mathf.Clamp(speed / 50f, 0f, 1f);
        return Mathf.Clamp(Mathf.Lerp(obstacleScanIntervalSeconds, obstacleScanIntervalSeconds * 0.5f, speedFactor), 0.02f, 0.1f);
    }

    private bool IsValidObstacleHit(RaycastHit hit, out PrototypeNavigationObstacle obstacle)
    {
        obstacle = null;
        Collider collider = hit.collider;
        if (collider == null || !collider.enabled || collider.isTrigger)
        {
            return false;
        }

        if (shipRigidbody != null && collider.attachedRigidbody == shipRigidbody)
        {
            return false;
        }

        Transform hitTransform = collider.transform;
        if (hitTransform == transform || hitTransform.IsChildOf(transform))
        {
            return false;
        }

        if (((1 << collider.gameObject.layer) & obstacleLayerMask.value) == 0)
        {
            return false;
        }

        if (collider.GetComponentInParent<Projectile>() != null
            || collider.GetComponentInParent<PrototypeNavigationTarget>() != null
            || collider.GetComponentInParent<Canvas>() != null)
        {
            return false;
        }

        if (PrototypeNavigationObstacle.TryGet(collider, out obstacle))
        {
            return true;
        }

        PrototypeNavigationObstacle marker = collider.GetComponentInParent<PrototypeNavigationObstacle>();
        return marker == null;
    }

    private Vector3 ComputeAvoidanceVectorWorld(Vector3 origin, Vector3 corridorDirection, RaycastHit hit)
    {
        Vector3 obstacleCenter = hit.collider != null ? hit.collider.bounds.center : hit.point;
        Vector3 lateralOffset = Vector3.ProjectOnPlane(obstacleCenter - origin, corridorDirection);
        if (lateralOffset.sqrMagnitude > 0.01f)
        {
            return (-lateralOffset).normalized;
        }

        Vector3 lateralNormal = Vector3.ProjectOnPlane(hit.normal, corridorDirection);
        if (lateralNormal.sqrMagnitude > 0.01f)
        {
            return lateralNormal.normalized;
        }

        return GetStableLateralDirection(corridorDirection);
    }

    private Vector3 GetStableLateralDirection(Vector3 corridorDirection)
    {
        Vector3 direction = corridorDirection.sqrMagnitude > 0.0001f ? corridorDirection.normalized : transform.forward;
        Vector3 lateral = Vector3.ProjectOnPlane(transform.right, direction);
        if (lateral.sqrMagnitude > 0.01f)
        {
            return lateral.normalized;
        }

        lateral = Vector3.Cross(direction, Vector3.up);
        if (lateral.sqrMagnitude > 0.01f)
        {
            return lateral.normalized;
        }

        return Vector3.Cross(direction, Vector3.forward).normalized;
    }

    private bool HasAvoidanceAuthority()
    {
        return CanUseRcsTranslation() || CanUseMainThrottle();
    }

    private void FailObstacleAvoidance(string reason)
    {
        avoidanceActive = false;
        avoidanceReason = reason;
        arrivalFailureReason = reason;
        SetState(PrototypeWaypointAutopilotState.Failed, reason);
        ClearCommands();
        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        autopilotEngaged = false;
    }

    private void ResetAvoidanceActiveState()
    {
        avoidanceActive = false;
        avoidanceClearFrameCount = 0;
        avoidanceFrameCount = 0;
        avoidanceClearStartedTime = 0f;
        cachedObstacleBlocked = false;
    }

    private void ResetAvoidanceDiagnostics(bool clearLastHit)
    {
        ResetAvoidanceActiveState();
        avoidanceReason = "none";
        avoidanceTargetName = "none";
        avoidanceDistance = float.PositiveInfinity;
        avoidanceVectorWorld = Vector3.zero;
        avoidanceClearanceMeters = obstacleClearanceMeters;
        cachedObstacleDirection = Vector3.zero;
        nextObstacleScanTime = 0f;
        if (clearLastHit)
        {
            lastObstacleHit = default;
        }
    }

    private void ApplyAutopilotRequest(Vector3 desiredDirection, float throttle, bool finalApproach = false)
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 attitudeCommand = Vector3.zero;
        Vector3 assistForceWorld = ComputeLateralCorrectionForceWorld();
        float requestedMainThrottle = 0f;
        Vector3 desiredDirectionNormalized = Vector3.zero;

        if (desiredDirection.sqrMagnitude > 0.0001f)
        {
            desiredDirectionNormalized = desiredDirection.normalized;
            attitudeCommand = ComputeAttitudeCommand(desiredDirectionNormalized);
            desiredBurnDirection = desiredDirectionNormalized;
            float angle = Vector3.Angle(transform.forward, desiredDirectionNormalized);
            if (angle <= alignmentAngleDegrees)
            {
                requestedMainThrottle = Mathf.Clamp01(throttle);
            }
            else
            {
                if (CurrentState != PrototypeWaypointAutopilotState.FinalApproach && CurrentState != PrototypeWaypointAutopilotState.FlipForBrake)
                {
                    SetState(PrototypeWaypointAutopilotState.AlignForBurn, "aligning");
                }
            }
        }

        if (!finalApproach)
        {
            requestedMainThrottle = Mathf.Min(1f, requestedMainThrottle);
        }
        else
        {
            requestedMainThrottle = Mathf.Clamp01(Mathf.Max(0.02f, requestedMainThrottle));
        }

        requestedMainThrottle = Mathf.Clamp01(requestedMainThrottle);
        this.requestedMainThrottle = requestedMainThrottle;
        this.requestedRcsTranslation = assistForceWorld;
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            assistForceWorld,
            attitudeCommand,
            requestedMainThrottle,
            false));
    }

private void ApplyLateralCorrection()
    {
        Vector3 forceWorld = ComputeLateralCorrectionForceWorld();
        if (shipController == null || forceWorld.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        FlightAssistRequest existing = shipController.HasExternalFlightAssistRequest
            ? shipController.LastExternalFlightAssistRequest
            : FlightAssistRequest.None;
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            existing.forceWorld + forceWorld,
            existing.torqueLocal,
            existing.mainThrottle,
            false));
    }

private Vector3 ComputeLateralCorrectionForceWorld()
    {
        if (shipController == null || !CanUseRcsTranslation() || LastMetrics.lateralSpeed <= 0.05f)
        {
            return Vector3.zero;
        }

        Vector3 correctionWorld = -LastMetrics.lateralVelocity;
        float rcsTranslationScale = GetRcsTranslationForceScale();
        if (rcsTranslationScale <= 0.0001f)
        {
            return Vector3.zero;
        }

        return correctionWorld.sqrMagnitude > 0.0001f
            ? correctionWorld.normalized * Mathf.Clamp01(LastMetrics.lateralSpeed / Mathf.Max(0.1f, lateralCorrectionSpeed)) * rcsTranslationScale
            : Vector3.zero;
    }

    private Vector3 ComputeAttitudeCommand(Vector3 desiredDirection)
    {
        Vector3 localDirection = transform.InverseTransformDirection(desiredDirection.normalized);
        return Vector3.ClampMagnitude(new Vector3(-localDirection.y, localDirection.x, 0f), 1f);
    }

    private void RefreshDiagnostics()
    {
        if (shipRigidbody == null || currentTarget == null)
        {
            LastMetrics = default;
            LastFuelEstimate = EstimateFuel(LastMetrics, shipStats, GetMaxAcceleration(), fuelReserveSeconds);
            ArrivalStatus = currentTarget == null ? "no target" : "missing rigidbody";
            return;
        }

        LastMetrics = CalculateMetrics(
            shipRigidbody.worldCenterOfMass,
            shipRigidbody.linearVelocity,
            currentTarget.Position,
            GetMaxDeceleration(),
            stoppingSafetyMarginMeters);
        if (!LastMetrics.isFinite)
        {
            ArrivalStatus = "non-finite metrics";
            return;
        }

        LastFuelEstimate = EstimateFuel(LastMetrics, shipStats, GetMaxAcceleration(), fuelReserveSeconds);
        ArrivalStatus = HasArrived() ? "arrived" : LastMetrics.shouldBrake ? "brake" : "en route";
    }

    private bool HasArrived()
    {
        float arrivalDistance = GetArrivalDistance();
        return currentTarget != null
            && LastMetrics.distance <= arrivalDistance
            && shipRigidbody != null
            && LastMetrics.relativeSpeed <= Mathf.Max(0.05f, arrivalSpeedMetersPerSecond)
            && LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond)
            && LastMetrics.closingSpeed >= 0f;
    }

    private float GetArrivalDistance()
    {
        float targetRadius = currentTarget != null ? currentTarget.ArrivalRadius : arrivalDistanceMeters;
        return Mathf.Max(0.5f, Mathf.Max(arrivalDistanceMeters, targetRadius));
    }

    private float GetMaxAcceleration()
    {
        if (shipStats == null)
        {
            return 0f;
        }

        float throttleScale = shipController != null && shipController.MainThrottleScale > 0f ? shipController.MainThrottleScale : 1f;
        return shipStats.CurrentMass > 0f ? (shipStats.Thrust * throttleScale) / shipStats.CurrentMass : 0f;
    }

    private float GetMaxDeceleration()
    {
        float acceleration = GetMaxAcceleration();
        float reverseScalar = shipStats != null ? Mathf.Clamp(shipStats.ReverseThrustMultiplier, 0.1f, 1f) : 0.35f;
        return acceleration * reverseScalar;
    }

    private bool CanUseRcsTranslation()
    {
        if (shipController != null && !shipController.RcsEnabled)
        {
            return false;
        }

        float rcsScale = GetRcsTranslationForceScale();
        return rcsScale > 0.0001f;
    }

    private float GetRcsTranslationForceScale()
    {
        if (shipController != null && shipController.HasRcs && shipController.RcsTranslationForceSetting > 0.0001f)
        {
            return shipController.RcsTranslationForceSetting;
        }

        RcsThrusterController rcsThrusters = shipController != null ? shipController.GetComponent<RcsThrusterController>() : GetComponent<RcsThrusterController>();
        if (rcsThrusters == null || !rcsThrusters.RcsEnabled)
        {
            return 0f;
        }

        return rcsThrusters.InstalledNozzleCount > 0 && rcsThrusters.TranslationForce > 0.0001f
            ? rcsThrusters.TranslationForce
            : 0f;
    }

    private bool HasAnyNavigationAuthority()
    {
        return CanUseMainThrottle() || CanUseRcsTranslation();
    }

    private bool CanUseMainThrottle()
    {
        if (shipController != null
            && shipController.MainThrusterAllowed
            && shipController.HasMainThruster
            && shipController.MainThrusterCount > 0
            && GetMaxAcceleration() > 0.0001f)
        {
            return true;
        }

        MainThrusterBank mainThrusterBank = shipController != null ? shipController.GetComponent<MainThrusterBank>() : GetComponent<MainThrusterBank>();
        return mainThrusterBank != null && mainThrusterBank.ThrusterCount > 0 && GetMaxAcceleration() > 0.0001f;
    }

private void ClearCommands()
    {
        if (shipController != null)
        {
            shipController.SetMainThrottle(0f);
            shipController.ClearExternalFlightAssistRequest();
        }

        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
    }

    private void HandleInput()
    {
        Keyboard keyboard = Keyboard.current;
        if (keyboard == null)
        {
            togglePressedLastFrame = false;
            nextPressedLastFrame = false;
            previousPressedLastFrame = false;
            return;
        }

        bool togglePressed = keyboard.gKey.isPressed;
        bool nextPressed = keyboard.tabKey.isPressed;
        bool previousPressed = keyboard.bKey.isPressed;

        if (togglePressed && !togglePressedLastFrame)
        {
            ToggleAutopilot();
        }

        if (nextPressed && !nextPressedLastFrame)
        {
            SelectNextTarget();
        }

        if (previousPressed && !previousPressedLastFrame)
        {
            SelectPreviousTarget();
        }

        togglePressedLastFrame = togglePressed;
        nextPressedLastFrame = nextPressed;
        previousPressedLastFrame = previousPressed;
    }

    private void SetState(PrototypeWaypointAutopilotState state, string status)
    {
        CurrentState = state;
        ArrivalStatus = string.IsNullOrWhiteSpace(status) ? state.ToString() : status;
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }

        if (shipStats == null)
        {
            shipStats = GetComponent<ShipStats>();
        }

        if (shipController == null)
        {
            shipController = GetComponent<PlayerShipController>();
        }



        if (momentumAssist == null)
        {
            momentumAssist = GetComponent<PrototypeMomentumAssist>();
        }
        if (waypointManager == null)
        {
            waypointManager = GetComponent<PrototypeWaypointManager>();
        }
    }

    private static bool IsFinite(Vector3 value)
    {
        return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    }

    private static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }

    private void OnValidate()
    {
        arrivalDistanceMeters = Mathf.Max(0.5f, arrivalDistanceMeters);
        arrivalSpeedMetersPerSecond = Mathf.Max(0.05f, arrivalSpeedMetersPerSecond);
        finalApproachDistanceMeters = Mathf.Max(1f, finalApproachDistanceMeters);
        stoppingSafetyMarginMeters = Mathf.Max(0f, stoppingSafetyMarginMeters);
        alignmentAngleDegrees = Mathf.Clamp(alignmentAngleDegrees, 1f, 60f);
        finalApproachThrottle = Mathf.Clamp01(finalApproachThrottle);
        finalApproachLateralToleranceMetersPerSecond = Mathf.Max(0.01f, finalApproachLateralToleranceMetersPerSecond);
        lateralCorrectionSpeed = Mathf.Max(0.1f, lateralCorrectionSpeed);
        fuelReserveSeconds = Mathf.Max(0f, fuelReserveSeconds);
        obstacleShipRadiusMeters = Mathf.Max(0.1f, obstacleShipRadiusMeters);
        obstacleClearanceMeters = Mathf.Max(0f, obstacleClearanceMeters);
        obstacleDangerDistanceMeters = Mathf.Max(0f, obstacleDangerDistanceMeters);
        obstacleMinCastDistanceMeters = Mathf.Max(1f, obstacleMinCastDistanceMeters);
        obstacleMaxCastDistanceMeters = Mathf.Max(obstacleMinCastDistanceMeters, obstacleMaxCastDistanceMeters);
        obstacleSpeedLookAheadSeconds = Mathf.Max(0.1f, obstacleSpeedLookAheadSeconds);
        obstacleScanIntervalSeconds = Mathf.Clamp(obstacleScanIntervalSeconds, 0.02f, 0.1f);
        obstacleClearFramesRequired = Mathf.Max(1, obstacleClearFramesRequired);
        obstacleMinimumAvoidanceFrames = Mathf.Max(1, obstacleMinimumAvoidanceFrames);
        obstacleClearTimeSeconds = Mathf.Max(0f, obstacleClearTimeSeconds);
        obstacleMainAssistThrottle = Mathf.Clamp01(obstacleMainAssistThrottle);
        obstacleBlockedTimeoutSeconds = Mathf.Max(0f, obstacleBlockedTimeoutSeconds);
    }
}
