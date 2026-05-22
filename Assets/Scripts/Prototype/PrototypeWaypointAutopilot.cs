using UnityEngine;
using UnityEngine.InputSystem;

public enum PrototypeWaypointAutopilotState
{
    Idle,
    TargetSelected,
    FuelCheck,
    AlignForBurn,
    Accelerate,
    ObstacleAvoidance,
    FlipForBrake,
    Brake,
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
    LateralCorrection,
    FinalApproach,
    Hold
}

public enum PrototypeWaypointAutopilotNavigationPhase
{
    Direct,
    AvoidancePlanning,
    Avoiding,
    ReacquireDirectPath,
    Brake,
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
    [SerializeField] private float lateralCorrectionDampingSeconds = 2f;
    [SerializeField] private float holdCompletionSpeedMetersPerSecond = 0.12f;
    [SerializeField] private float obstacleClearanceRadiusMeters = 8f;
    [SerializeField] private float navigationPlanIntervalSeconds = 0.2f;
    [SerializeField] private float fuelReserveSeconds = 8f;
    [Header("V2 Navigation Timing")]
    [SerializeField] private float avoidanceLockSeconds = 4f;
    [SerializeField] private float avoidReacquireTimeoutSeconds = 2.5f;
    [SerializeField] private float holdConfirmSeconds = 1.5f;

    [Header("Runtime")]
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private PrototypeObstacleDetector obstacleDetector;

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
    private bool navigationDebugPlanningActive;
    private bool navigationPlanDirty = true;
    private float nextNavigationPlanTime;
    private float avoidanceHoldExpireTime;
    private float holdConfirmUntilTime;
    private bool holdConfirmStarted;
    private float reacquireDirectPathUntilTime;
    private PrototypeWaypointAutopilotNavigationPhase navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
    private Vector3 stableAvoidanceWaypoint;
    private Vector3 stableAvoidanceDirection;
    private bool hasStableAvoidance;
    private PrototypeMomentumAssist momentumAssist;
    private PrototypeTrajectoryPlanner trajectoryPlanner;

    public PrototypeWaypointAutopilotState CurrentState { get; private set; } = PrototypeWaypointAutopilotState.Idle;
    public PrototypeWaypointManager WaypointManager => waypointManager;
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
    public PrototypeObstacleDetectionResult LastObstacleDetection { get; private set; }
    public PrototypeTrajectoryPlan LastTrajectoryPlan { get; private set; }
    public PrototypeTrajectoryPhase LastTrajectoryPhase => LastTrajectoryPlan.phase;
    public bool NavigationObstacleDetected => LastObstacleDetection.detected;
    public string NavigationPlanStatus => string.IsNullOrWhiteSpace(LastTrajectoryPlan.status) ? "clear" : LastTrajectoryPlan.status;
    public PrototypeTrajectoryPlan CurrentPlan => LastTrajectoryPlan;
    public string ObstacleStatus => LastObstacleDetection.hasObstacle
        ? $"{LastTrajectoryPlan.obstacleLabel} @ {LastObstacleDetection.hitDistance:0.0}m"
        : "clear";
    public Vector3 AvoidanceWaypoint => LastTrajectoryPlan.avoidanceWaypoint;
    public bool AvoidanceActive => LastTrajectoryPlan.avoidanceActive;
    public string AvoidanceReason => LastTrajectoryPlan.avoidanceActive
        ? (string.IsNullOrWhiteSpace(LastTrajectoryPlan.status) ? "avoidance" : LastTrajectoryPlan.status)
        : "clear";
    public string AvoidanceTargetName => string.IsNullOrWhiteSpace(LastTrajectoryPlan.obstacleLabel)
        ? "none"
        : LastTrajectoryPlan.obstacleLabel;
    public float AvoidanceDistance => LastTrajectoryPlan.obstacleDistance;
    public Vector3 AvoidanceVectorWorld => LastTrajectoryPlan.avoidanceDirection;
    public float AvoidanceClearanceMeters => LastObstacleDetection.clearanceRadius;
    public float PlannedEta => LastTrajectoryPlan.plannedEtaSeconds;
    public float PlannedStoppingDistance => LastTrajectoryPlan.plannedStoppingDistance;
    public Vector3 RequestedAcceleration => LastTrajectoryPlan.desiredAccelerationWorld;
    public Vector3 RequestedRcsForce => requestedRcsTranslation;
    public string FailureReason => ArrivalFailureReason;
    public PrototypeWaypointAutopilotNavigationPhase NavigationPhaseV2 => navigationPhaseV2;
    public PrototypeWaypointAutopilotNavigationPhase NavigationPhase => navigationPhaseV2;
    public PrototypeTrajectorySegmentType ActiveSegmentType => LastTrajectoryPlan.activeSegmentType;
    public string ActiveSegmentLabel => LastTrajectoryPlan.activeSegmentType.ToString();
    public PrototypeTrajectoryCandidateScore[] CandidateScores => LastTrajectoryPlan.candidateScores ?? System.Array.Empty<PrototypeTrajectoryCandidateScore>();
    public PrototypeTrajectorySegment[] PlanSegments => LastTrajectoryPlan.segments ?? System.Array.Empty<PrototypeTrajectorySegment>();
    public Vector3[] PredictedRoute => LastTrajectoryPlan.predictedPath ?? System.Array.Empty<Vector3>();
    public string SelectedCandidate => string.IsNullOrWhiteSpace(LastTrajectoryPlan.selectedCandidate) ? "direct" : LastTrajectoryPlan.selectedCandidate;
    public string SelectedCandidateReason => string.IsNullOrWhiteSpace(LastTrajectoryPlan.selectedCandidateReason) ? NavigationPlanStatus : LastTrajectoryPlan.selectedCandidateReason;
    public int NavigationPlanRefreshCount { get; private set; }
    public bool NavigationDebugPlanningActive => navigationDebugPlanningActive;
    public float NavigationPlanIntervalSeconds => Mathf.Clamp(navigationPlanIntervalSeconds, 0.1f, 0.25f);

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
        if (ShouldRefreshNavigationPlanThisTick())
        {
            RefreshNavigationPlan();
        }

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
            arrivalFailureReason = "FuelInsufficient";
            SetState(PrototypeWaypointAutopilotState.FuelInsufficient, "FuelInsufficient");
            ClearCommands();
            autopilotEngaged = false;
            return;
        }

        if (!HasAnyNavigationAuthority())
        {
            arrivalFailureReason = "NoAuthority";
            SetState(PrototypeWaypointAutopilotState.Failed, "NoAuthority");
            ClearCommands();
            autopilotEngaged = false;
            return;
        }
        else if (!CanUseRcsTranslation() && CanUseMainThrottle())
        {
            arrivalFailureReason = "LimitedRcsAuthority";
        }
        else
        {
            arrivalFailureReason = string.Empty;
        }

        if (HasArrived())
        {
            SetState(PrototypeWaypointAutopilotState.HoldPosition, "holding");
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Hold;
            UpdateHoldStatus();
            limitedFinalApproachCapability = false;
            ApplyHoldDamping();
            if (HasHoldConfirmWindowElapsed())
            {
                ClearCommands();
                SetState(PrototypeWaypointAutopilotState.Complete, "arrived");
                autopilotEngaged = false;
            }

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
            arrivalFailureReason = "NoAuthority";
            SetState(PrototypeWaypointAutopilotState.Failed, "NoAuthority");
            return;
        }

        if (!CanUseRcsTranslation() && CanUseMainThrottle())
        {
            arrivalFailureReason = "LimitedRcsAuthority";
        }
        else if (string.IsNullOrWhiteSpace(arrivalFailureReason))
        {
            arrivalFailureReason = string.Empty;
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
        hasStableAvoidance = false;
        stableAvoidanceWaypoint = Vector3.zero;
        stableAvoidanceDirection = Vector3.zero;
        avoidanceHoldExpireTime = 0f;
        reacquireDirectPathUntilTime = 0f;
        holdConfirmUntilTime = 0f;
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        LastObstacleDetection = PrototypeObstacleDetectionResult.Clear(GetObstacleClearanceRadius());
        LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(LastMetrics.directionToTarget.sqrMagnitude > 0.0001f ? LastMetrics.directionToTarget : transform.forward);
        MarkNavigationPlanDirty();
    }

    public void Abort(string reason = "aborted")
    {
        autopilotEngaged = false;
        ClearCommands();
        hasStableAvoidance = false;
        holdConfirmUntilTime = 0f;
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        arrivalFailureReason = reason;
        SetState(PrototypeWaypointAutopilotState.Aborted, reason);
    }

    public void ResetForBootstrap()
    {
        autopilotEngaged = false;
        manualOverrideGraceUntilTime = 0f;
        ClearCommands();
        hasStableAvoidance = false;
        holdConfirmUntilTime = 0f;
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        MarkNavigationPlanDirty();
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
        MarkNavigationPlanDirty();
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

    public void ReplanNow()
    {
        ResolveReferences();
        RefreshDiagnostics();
        MarkNavigationPlanDirty();
        RefreshNavigationPlan();
    }

    public void SetNavigationDebugPlanningActive(bool active)
    {
        if (navigationDebugPlanningActive == active)
        {
            return;
        }

        navigationDebugPlanningActive = active;
        if (active)
        {
            MarkNavigationPlanDirty();
        }
    }

    public string[] BuildNavigationWarningChips()
    {
        string[] chips = new string[8];
        int count = 0;
        if (currentTarget == null)
        {
            chips[count++] = "NO TARGET";
        }

        if (!HasAnyNavigationAuthority())
        {
            chips[count++] = "NO AUTHORITY";
        }

        if (!FuelFeasible || string.Equals(ArrivalFailureReason, "FuelInsufficient", System.StringComparison.OrdinalIgnoreCase))
        {
            chips[count++] = "FUEL INSUFFICIENT";
        }

        if (NavigationObstacleDetected || LastTrajectoryPlan.directPathBlocked)
        {
            chips[count++] = "OBSTACLE";
        }

        if (AvoidanceActive || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding)
        {
            chips[count++] = "AVOIDANCE";
        }

        if (LimitedFinalApproachCapability
            || LastTrajectoryPlan.limitedRcsAuthority
            || string.Equals(ArrivalFailureReason, "LimitedRcsAuthority", System.StringComparison.OrdinalIgnoreCase))
        {
            chips[count++] = "LIMITED RCS";
        }

        if (LastTrajectoryPlan.holdNoAuthority || string.Equals(ArrivalFailureReason, "HoldNoAuthority", System.StringComparison.OrdinalIgnoreCase))
        {
            chips[count++] = "NO AUTHORITY";
        }
        else if (LastTrajectoryPlan.limitedHoldAuthority || string.Equals(ArrivalFailureReason, "LimitedHoldAuthority", System.StringComparison.OrdinalIgnoreCase))
        {
            chips[count++] = "LIMITED HOLD";
        }

        if (navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Hold || CurrentState == PrototypeWaypointAutopilotState.HoldPosition)
        {
            chips[count++] = "HOLDING";
        }

        if (count == chips.Length)
        {
            return chips;
        }

        string[] trimmed = new string[count];
        for (int i = 0; i < count; i++)
        {
            trimmed[i] = chips[i];
        }

        return trimmed;
    }

    public void MarkNavigationPlanDirty()
    {
        navigationPlanDirty = true;
        nextNavigationPlanTime = 0f;
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
        bool currentlyAvoiding = LastTrajectoryPlan.RequiresAvoidance && LastTrajectoryPlan.obstacleDetected;
        bool wasAvoiding = navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
            || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
        bool isReacquiring = !currentlyAvoiding && hasStableAvoidance && Time.time <= reacquireDirectPathUntilTime;

        if (currentlyAvoiding)
        {
            hasStableAvoidance = true;
            stableAvoidanceWaypoint = LastTrajectoryPlan.avoidanceWaypoint;
            stableAvoidanceDirection = LastTrajectoryPlan.avoidanceDirection.sqrMagnitude > 0.0001f
                ? LastTrajectoryPlan.avoidanceDirection.normalized
                : LastTrajectoryPlan.desiredBurnDirection.normalized;
            if (stableAvoidanceDirection.sqrMagnitude <= 0.0001f)
            {
                stableAvoidanceDirection = LastMetrics.directionToTarget;
            }

            avoidanceHoldExpireTime = Time.time + Mathf.Max(0f, avoidanceLockSeconds);
            reacquireDirectPathUntilTime = 0f;
            navigationPhaseV2 = LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.AvoidancePlanning
                ? PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                : PrototypeWaypointAutopilotNavigationPhase.Avoiding;

            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
            limitedFinalApproachCapability = false;
            arrivalFailureReason = string.Empty;
            SetState(PrototypeWaypointAutopilotState.ObstacleAvoidance, "obstacle avoidance");
            ApplyAutopilotRequest(ResolveAvoidanceRequestDirection(), LastTrajectoryPlan.mainThrottleLimit);
            return;
        }

        if (wasAvoiding && !currentlyAvoiding && Time.time <= avoidanceHoldExpireTime + avoidReacquireTimeoutSeconds)
        {
            if (hasStableAvoidance)
            {
                reacquireDirectPathUntilTime = Time.time + avoidReacquireTimeoutSeconds;
                navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
                SetState(PrototypeWaypointAutopilotState.AlignForBurn, "reacquire");
                ApplyAutopilotRequest(LastMetrics.directionToTarget, 1f);
                return;
            }
        }

        if (!currentlyAvoiding && Time.time > avoidanceHoldExpireTime)
        {
            hasStableAvoidance = false;
        }

        if (!currentlyAvoiding && isReacquiring)
        {
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
            SetState(PrototypeWaypointAutopilotState.AlignForBurn, "reacquire");
            ApplyAutopilotRequest(LastMetrics.directionToTarget, 1f);
            return;
        }

        if (!currentlyAvoiding && !isReacquiring)
        {
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        }

        if ((LastMetrics.shouldBrake || (LastMetrics.distance <= GetArrivalDistance() && !requestedFineApproach))
            && LastMetrics.distance <= Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 2f))
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
            limitedFinalApproachCapability = false;
            Vector3 brakeDirection = shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f
                ? -shipRigidbody.linearVelocity.normalized
                : -LastMetrics.directionToTarget;
            float angle = Vector3.Angle(transform.forward, brakeDirection);
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Brake;
            SetState(angle > alignmentAngleDegrees ? PrototypeWaypointAutopilotState.FlipForBrake : PrototypeWaypointAutopilotState.Brake, "braking");
            ApplyAutopilotRequest(brakeDirection, 1f);
            return;
        }

        if (requestedFineApproach)
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "final approach");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalPhase = LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond
                ? PrototypeWaypointAutopilotArrivalPhase.LateralCorrection
                : PrototypeWaypointAutopilotArrivalPhase.FinalApproach;
            arrivalFailureReason = LimitedFinalApproachCapability
                ? "LimitedRcsAuthority"
                : string.Empty;

            ApplyAutopilotRequest(
                LastMetrics.closingSpeed > arrivalSpeedMetersPerSecond ? -shipRigidbody.linearVelocity : LastMetrics.directionToTarget,
                finalApproachThrottle,
                true);
            return;
        }

        if (LastMetrics.shouldBrake)
        {
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
            Vector3 brakeDirection = shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f
                ? -shipRigidbody.linearVelocity.normalized
                : -LastMetrics.directionToTarget;
            float angle = Vector3.Angle(transform.forward, brakeDirection);
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Brake;
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
            arrivalFailureReason = hasLowLateralSpeed ? string.Empty : "LimitedRcsAuthority";
            limitedFinalApproachCapability = !hasLowLateralSpeed;
        }
        else
        {
            arrivalFailureReason = string.Empty;
            limitedFinalApproachCapability = false;
        }

        if (!CanUseRcsTranslation() && CanUseMainThrottle())
        {
            arrivalFailureReason = "LimitedRcsAuthority";
        }

        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        SetState(PrototypeWaypointAutopilotState.Accelerate, "accelerating");
        ApplyAutopilotRequest(LastMetrics.directionToTarget, 1f);
    }

    private Vector3 ResolveAvoidanceRequestDirection()
    {
        if (hasStableAvoidance && stableAvoidanceDirection.sqrMagnitude > 0.0001f)
        {
            return stableAvoidanceDirection;
        }

        return LastTrajectoryPlan.desiredBurnDirection;
    }

    private void ApplyAutopilotRequest(Vector3 desiredDirection, float throttle, bool finalApproach = false)
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 attitudeCommand = Vector3.zero;
        Vector3 desiredRcsForceWorld = LastTrajectoryPlan.requestedRcsForceWorld;
        if (desiredRcsForceWorld.sqrMagnitude > 0.0001f)
        {
            float mass = GetShipMassKg();
            desiredRcsForceWorld = Vector3.ClampMagnitude(desiredRcsForceWorld * Mathf.Clamp01(mass / Mathf.Max(0.01f, mass)), GetRcsTranslationForceScale());
        }

        Vector3 assistForceWorld = CombineRcsForces(ComputeLateralCorrectionForceWorld(), desiredRcsForceWorld);
        bool limitedRcsAuthority = desiredRcsForceWorld.sqrMagnitude > 0.0001f
            && assistForceWorld.magnitude + 0.001f < desiredRcsForceWorld.magnitude;
        float requestedMainThrottle = 0f;
        Vector3 desiredDirectionNormalized = Vector3.zero;

        if (desiredDirection.sqrMagnitude > 0.0001f)
        {
            desiredDirectionNormalized = desiredDirection.normalized;
            attitudeCommand = ComputeAttitudeCommand(desiredDirectionNormalized);
            desiredBurnDirection = desiredDirectionNormalized;
            float angle = Vector3.Angle(transform.forward, desiredDirectionNormalized);
            if (angle <= alignmentAngleDegrees && CanUseMainThrottle())
            {
                requestedMainThrottle = Mathf.Clamp01(throttle);
            }
            else
            {
                if (CurrentState != PrototypeWaypointAutopilotState.FinalApproach
                    && CurrentState != PrototypeWaypointAutopilotState.FlipForBrake
                    && CurrentState != PrototypeWaypointAutopilotState.ObstacleAvoidance)
                {
                    SetState(PrototypeWaypointAutopilotState.AlignForBurn, "aligning");
                }
            }
        }

        if (!finalApproach)
        {
            requestedMainThrottle = Mathf.Min(1f, requestedMainThrottle);
        }

        requestedMainThrottle = Mathf.Clamp01(requestedMainThrottle);
        this.requestedMainThrottle = requestedMainThrottle;
        this.requestedRcsTranslation = assistForceWorld;
        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.requestedMainThrottle = requestedMainThrottle;
        updatedPlan.requestedRcsForceWorld = assistForceWorld;
        updatedPlan.limitedRcsAuthority = updatedPlan.limitedRcsAuthority || limitedRcsAuthority;
        if (updatedPlan.limitedRcsAuthority && string.IsNullOrWhiteSpace(updatedPlan.warningStatus))
        {
            updatedPlan.warningStatus = "LimitedRcsAuthority";
        }

        updatedPlan.desiredBurnDirectionWorld = desiredBurnDirection;
        updatedPlan.desiredBurnDirection = desiredBurnDirection;
        updatedPlan.desiredAccelerationWorld = desiredDirectionNormalized * GetMaxAcceleration() * requestedMainThrottle;
        if (assistForceWorld.sqrMagnitude > 0.0001f)
        {
            updatedPlan.desiredAccelerationWorld += assistForceWorld / GetShipMassKg();
        }

        LastTrajectoryPlan = updatedPlan;
        if (updatedPlan.limitedRcsAuthority && string.IsNullOrWhiteSpace(arrivalFailureReason))
        {
            arrivalFailureReason = "LimitedRcsAuthority";
        }

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

        if (correctionWorld.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        float mass = shipRigidbody != null ? Mathf.Max(0.01f, shipRigidbody.mass) : shipStats != null ? Mathf.Max(0.01f, shipStats.CurrentMass) : 1f;
        float desiredAcceleration = LastMetrics.lateralSpeed / Mathf.Max(0.1f, lateralCorrectionDampingSeconds);
        float shapedForce = mass * desiredAcceleration * Mathf.Clamp01(LastMetrics.lateralSpeed / Mathf.Max(0.1f, lateralCorrectionSpeed));
        return correctionWorld.normalized * Mathf.Min(rcsTranslationScale, shapedForce);
    }

    private Vector3 CombineRcsForces(Vector3 primaryForceWorld, Vector3 plannedForceWorld)
    {
        Vector3 combinedForce = primaryForceWorld + ClampRcsForceWorld(plannedForceWorld);
        return ClampRcsForceWorld(combinedForce);
    }

    private Vector3 ClampRcsForceWorld(Vector3 forceWorld)
    {
        if (forceWorld.sqrMagnitude <= 0.0001f || !CanUseRcsTranslation())
        {
            return Vector3.zero;
        }

        return Vector3.ClampMagnitude(forceWorld, GetRcsTranslationForceScale());
    }

    private void ApplyHoldDamping()
    {
        if (shipController == null || shipRigidbody == null)
        {
            ClearCommands();
            return;
        }

        Vector3 dampingForce = ComputeVelocityDampingForceWorld(shipRigidbody.linearVelocity);
        requestedMainThrottle = 0f;
        requestedRcsTranslation = dampingForce;
        desiredBurnDirection = Vector3.zero;
        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.navigationPhase = PrototypeAutopilotNavigationPhase.Hold;
        updatedPlan.activeSegmentType = PrototypeTrajectorySegmentType.Hold;
        updatedPlan.requestedMainThrottle = 0f;
        updatedPlan.requestedRcsForceWorld = dampingForce;
        updatedPlan.desiredAccelerationWorld = dampingForce / GetShipMassKg();
        if (shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f && dampingForce.sqrMagnitude <= 0.0001f)
        {
            updatedPlan.holdNoAuthority = true;
            updatedPlan.warningStatus = "HoldNoAuthority";
            arrivalFailureReason = "HoldNoAuthority";
        }
        else if (!CanUseRcsTranslation() && shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f)
        {
            updatedPlan.limitedHoldAuthority = true;
            updatedPlan.warningStatus = "LimitedHoldAuthority";
            arrivalFailureReason = "LimitedHoldAuthority";
        }

        LastTrajectoryPlan = updatedPlan;
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            dampingForce,
            Vector3.zero,
            0f,
            false));
    }

    private Vector3 ComputeVelocityDampingForceWorld(Vector3 velocity)
    {
        if (!CanUseRcsTranslation() || velocity.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        float rcsAuthority = GetRcsTranslationForceScale();
        if (rcsAuthority <= 0.0001f)
        {
            return Vector3.zero;
        }

        float mass = GetShipMassKg();
        float desiredForce = mass * (velocity.magnitude / Mathf.Max(0.1f, lateralCorrectionDampingSeconds));
        return -velocity.normalized * Mathf.Min(rcsAuthority, desiredForce);
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

    private void RefreshNavigationPlan()
    {
        if (trajectoryPlanner == null)
        {
            trajectoryPlanner = new PrototypeTrajectoryPlanner();
        }

        if (shipRigidbody == null || currentTarget == null)
        {
            LastObstacleDetection = PrototypeObstacleDetectionResult.Clear(GetObstacleClearanceRadius());
            LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
            CompleteNavigationPlanRefresh();
            return;
        }

        float clearance = GetObstacleClearanceRadius();
        LastObstacleDetection = obstacleDetector != null
            ? obstacleDetector.DetectDirectPath(shipRigidbody, currentTarget.Position, clearance)
            : PrototypeObstacleDetectionResult.Clear(clearance);
        bool keepStableAvoidance = hasStableAvoidance && Time.time < avoidanceHoldExpireTime;
        PrototypeTrajectoryPlan plan = trajectoryPlanner.Plan(
            new PrototypeTrajectorySnapshot(
                shipRigidbody.worldCenterOfMass,
                shipRigidbody.linearVelocity,
                currentTarget.Position,
                transform.forward,
                shipRigidbody.mass,
                GetMaxAcceleration(),
                GetRcsTranslationForceScale(),
                clearance,
                shipStats != null ? shipStats.Thrust : 0f,
                shipStats != null ? shipStats.FuelConsumptionKgPerSecond : 0f,
                shipStats != null ? shipStats.CurrentFuelKg : 0f,
                GetArrivalDistance(),
                arrivalSpeedMetersPerSecond,
                finalApproachLateralToleranceMetersPerSecond),
            LastObstacleDetection,
            keepStableAvoidance,
            stableAvoidanceWaypoint,
            keepStableAvoidance ? "stable" : string.Empty);
        plan.navigationPhase = ConvertNavigationPhase(navigationPhaseV2);
        if (plan.RequiresAvoidance && keepStableAvoidance && stableAvoidanceWaypoint.sqrMagnitude > 0.0001f)
        {
            plan.avoidanceWaypoint = stableAvoidanceWaypoint;
            plan.avoidanceDirection = stableAvoidanceDirection.sqrMagnitude > 0.0001f ? stableAvoidanceDirection.normalized : plan.avoidanceDirection;
            plan.selectedCandidate = "stable";
            plan.selectedCandidateReason = "locked avoidance waypoint";
            plan.navigationPhase = PrototypeAutopilotNavigationPhase.Avoiding;
        }

        LastTrajectoryPlan = plan;
        CompleteNavigationPlanRefresh();
    }

    private bool ShouldRefreshNavigationPlanThisTick()
    {
        if (!autopilotEngaged && !navigationDebugPlanningActive)
        {
            return false;
        }

        if (navigationPlanDirty)
        {
            return true;
        }

        return Time.time >= nextNavigationPlanTime;
    }

    private static PrototypeAutopilotNavigationPhase ConvertNavigationPhase(PrototypeWaypointAutopilotNavigationPhase phase)
    {
        switch (phase)
        {
            case PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning:
                return PrototypeAutopilotNavigationPhase.AvoidancePlanning;
            case PrototypeWaypointAutopilotNavigationPhase.Avoiding:
                return PrototypeAutopilotNavigationPhase.Avoiding;
            case PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath:
                return PrototypeAutopilotNavigationPhase.ReacquireDirectPath;
            case PrototypeWaypointAutopilotNavigationPhase.Brake:
                return PrototypeAutopilotNavigationPhase.Brake;
            case PrototypeWaypointAutopilotNavigationPhase.FinalApproach:
                return PrototypeAutopilotNavigationPhase.FinalApproach;
            case PrototypeWaypointAutopilotNavigationPhase.Hold:
                return PrototypeAutopilotNavigationPhase.Hold;
            default:
                return PrototypeAutopilotNavigationPhase.Direct;
        }
    }

    private void CompleteNavigationPlanRefresh()
    {
        NavigationPlanRefreshCount++;
        navigationPlanDirty = false;
        nextNavigationPlanTime = Time.time + NavigationPlanIntervalSeconds;
    }

    private bool HasArrived()
    {
        float arrivalDistance = GetArrivalDistance();
        return currentTarget != null
            && LastMetrics.distance <= arrivalDistance
            && shipRigidbody != null
            && LastMetrics.relativeSpeed <= Mathf.Max(0.05f, arrivalSpeedMetersPerSecond)
            && LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond);
    }

    private void UpdateHoldStatus()
    {
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Hold;
        if (!HasArrived())
        {
            holdConfirmStarted = false;
            return;
        }

        if (shipRigidbody == null || shipRigidbody.linearVelocity.sqrMagnitude > 0.01f)
        {
            holdConfirmUntilTime = Time.time + Mathf.Max(0f, holdConfirmSeconds);
            holdConfirmStarted = true;
            return;
        }

        if (HasHoldControlAuthority())
        {
            arrivalFailureReason = CanUseRcsTranslation() ? "none" : "LimitedHoldAuthority";
        }
        else
        {
            arrivalFailureReason = "HoldNoAuthority";
        }

        if (HasHoldVelocitySettled())
        {
            if (!holdConfirmStarted)
            {
                holdConfirmUntilTime = Time.time + Mathf.Max(0f, holdConfirmSeconds);
                holdConfirmStarted = true;
            }
        }
        else
        {
            holdConfirmUntilTime = Time.time + Mathf.Max(0f, holdConfirmSeconds);
            holdConfirmStarted = true;
        }
    }

    private bool HasHoldControlAuthority()
    {
        return CanUseRcsTranslation() || CanUseMainThrottle();
    }

    private bool HasHoldVelocitySettled()
    {
        return shipRigidbody == null || shipRigidbody.linearVelocity.magnitude <= Mathf.Max(0.01f, holdCompletionSpeedMetersPerSecond);
    }

    private bool HasHoldConfirmWindowElapsed()
    {
        return HasHoldVelocitySettled()
            && holdConfirmStarted
            && Time.time >= holdConfirmUntilTime
            && holdConfirmUntilTime >= 0f;
    }

    private bool ShouldCompleteHold()
    {
        return HasHoldConfirmWindowElapsed();
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

    private float GetObstacleClearanceRadius()
    {
        float detectorRadius = obstacleDetector != null ? obstacleDetector.DefaultClearanceRadiusMeters : 0f;
        return Mathf.Max(0.01f, obstacleClearanceRadiusMeters, detectorRadius);
    }

    private float GetShipMassKg()
    {
        if (shipRigidbody != null)
        {
            return Mathf.Max(0.01f, shipRigidbody.mass);
        }

        return shipStats != null ? Mathf.Max(0.01f, shipStats.CurrentMass) : 1f;
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
            && shipController.MainThrusterCount > 0)
        {
            return true;
        }

        MainThrusterBank mainThrusterBank = shipController != null ? shipController.GetComponent<MainThrusterBank>() : GetComponent<MainThrusterBank>();
        return mainThrusterBank != null && mainThrusterBank.ThrusterCount > 0;
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
        holdConfirmStarted = false;
        holdConfirmUntilTime = 0f;
        LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(LastMetrics.directionToTarget.sqrMagnitude > 0.0001f ? LastMetrics.directionToTarget : Vector3.forward);
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
        if (obstacleDetector == null)
        {
            obstacleDetector = GetComponent<PrototypeObstacleDetector>();
        }
        if (obstacleDetector == null)
        {
            obstacleDetector = gameObject.AddComponent<PrototypeObstacleDetector>();
        }
        if (trajectoryPlanner == null)
        {
            trajectoryPlanner = new PrototypeTrajectoryPlanner();
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
        lateralCorrectionDampingSeconds = Mathf.Max(0.1f, lateralCorrectionDampingSeconds);
        holdCompletionSpeedMetersPerSecond = Mathf.Max(0.01f, holdCompletionSpeedMetersPerSecond);
        obstacleClearanceRadiusMeters = Mathf.Max(0.01f, obstacleClearanceRadiusMeters);
        navigationPlanIntervalSeconds = Mathf.Clamp(navigationPlanIntervalSeconds, 0.1f, 0.25f);
        fuelReserveSeconds = Mathf.Max(0f, fuelReserveSeconds);
        avoidanceLockSeconds = Mathf.Max(0f, avoidanceLockSeconds);
        avoidReacquireTimeoutSeconds = Mathf.Max(0.1f, avoidReacquireTimeoutSeconds);
        holdConfirmSeconds = Mathf.Max(0.1f, holdConfirmSeconds);
    }
}
