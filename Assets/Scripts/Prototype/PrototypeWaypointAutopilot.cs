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
[DefaultExecutionOrder(-200)]
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(PlayerShipController))]
public class PrototypeWaypointAutopilot : MonoBehaviour
{
    private const float RcsAuthorityEpsilon = 0.0001f;
    private const float BrakeAlignmentHysteresisDegrees = 5f;
    private const float BrakeHoldMinDurationSeconds = 0.4f;
    private const float BrakeAttitudeDampingGain = 0.35f;
    private const float BrakeHoldReleaseZeroSpeed = 0.05f;
    private const float BrakeHoldReleaseLateralRatio = 1.75f;
    private const float BrakeAlignmentAngularSpeedLimitDegreesPerSecond = 35f;
    private const float BrakeArrivalHoldDistanceMarginMeters = 6f;
    private const float BrakeArrivalHoldLateralSpeedMultiplier = 6f;
    private const float BrakeArrivalHoldMinimumLateralTolerance = 1.2f;
    private const float BrakeArrivalHoldRelativeSpeedMultiplier = 1.8f;
    private const float TerminalOvershootHoldRelativeSpeedMultiplier = 2f;
    private const float TerminalOvershootBrakeRelativeSpeedMultiplier = 1.35f;
    private const float BrakeDirectionMinimumSpeedMetersPerSecond = 0.35f;
    private const float BrakeCommandSpinSoftLimitMultiplier = 0.72f;
    private const float TerminalBrakeDirectionRotateDegreesPerSecond = 45f;
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
    private bool waitingForManualInputReleaseAfterEngage;
    private bool suppressManualInputReleaseCheckThisFrame;
    private bool brakeHoldActive;
    private float brakeHoldStartTime;
    private bool arrivalBrakeCommitted;
    private float autopilotElapsedSeconds;
    private bool brakeAlignmentLocked;
    private Vector3 committedBrakeDirection;
    private bool arrivalTerminalCaptureActive;
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
        if (!autopilotEngaged || shipController == null)
        {
            return;
        }

        bool hasManualFlightInput = shipController.LastManualFlightInput;
        if (waitingForManualInputReleaseAfterEngage)
        {
            if (suppressManualInputReleaseCheckThisFrame)
            {
                suppressManualInputReleaseCheckThisFrame = false;
                return;
            }

            if (!hasManualFlightInput)
            {
                waitingForManualInputReleaseAfterEngage = false;
            }

            return;
        }

        if (hasManualFlightInput && Time.time >= manualOverrideGraceUntilTime)
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

        autopilotElapsedSeconds += Mathf.Max(Time.fixedDeltaTime, 0.02f);

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

        ReassertAutopilotActuators();
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

        if ((ShouldCaptureArrivalHold() || ShouldCaptureArrivalHoldNearArrival() || ShouldCaptureTerminalOvershootHold()) && TryEnterHoldPosition())
        {
            return;
        }

        RunAutopilotStep();
    }

    private bool TryEnterHoldPosition()
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

        return true;
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
        shipController.SetSasMode(SasControlMode.KillRotation);
        shipController.SetSasEnabled(true);
        shipController.CaptureSasTargetRotation();
        shipController.SetMainThrottle(0f);
        waitingForManualInputReleaseAfterEngage = shipController.LastManualFlightInput;
        suppressManualInputReleaseCheckThisFrame = waitingForManualInputReleaseAfterEngage;
        shipController.ClearManualFlightInputForAssist();
        manualOverrideGraceUntilTime = Time.time + 0.25f;

        autopilotEngaged = true;
        SetState(PrototypeWaypointAutopilotState.FuelCheck, "fuel ok");
        arrivalFailureReason = string.Empty;
        limitedFinalApproachCapability = false;
        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
        autopilotElapsedSeconds = 0f;
        hasStableAvoidance = false;
        stableAvoidanceWaypoint = Vector3.zero;
        stableAvoidanceDirection = Vector3.zero;
        avoidanceHoldExpireTime = 0f;
        reacquireDirectPathUntilTime = 0f;
        brakeAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        brakeHoldStartTime = 0f;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
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
        waitingForManualInputReleaseAfterEngage = false;
        suppressManualInputReleaseCheckThisFrame = false;
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Direct;
        arrivalFailureReason = reason;
        SetState(PrototypeWaypointAutopilotState.Aborted, reason);
    }

    public void ResetForBootstrap()
    {
        autopilotEngaged = false;
        manualOverrideGraceUntilTime = 0f;
        waitingForManualInputReleaseAfterEngage = false;
        suppressManualInputReleaseCheckThisFrame = false;
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
        brakeAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
        ReleaseBrakeHold();
        holdConfirmStarted = false;
        holdConfirmUntilTime = 0f;
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

        if (string.Equals(ArrivalFailureReason, "NoAttitudeAuthority", System.StringComparison.OrdinalIgnoreCase))
        {
            chips[count++] = "NO ATTITUDE";
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
        bool settledFineApproachReacquire = inFinalApproachWindow
            && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
        bool nearArrivalSettleWindow = LastMetrics.distance <= Mathf.Max(
            finalApproachWindowMeters,
            GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters);
        bool shouldSettleAfterBrakeCommit = arrivalBrakeCommitted
            && nearArrivalSettleWindow
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
        bool shouldUseTerminalLateralCorrection = ShouldUseTerminalLateralCorrection();
        bool requestedFineApproach = inFinalApproachWindow
            && (!LastMetrics.shouldBrake || settledFineApproachReacquire || shouldSettleAfterBrakeCommit)
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
        requestedFineApproach |= shouldSettleAfterBrakeCommit;
        bool currentlyAvoiding = IsAvoidancePlanActive();
        bool wasAvoiding = navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
            || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
        bool isReacquiring = !currentlyAvoiding && hasStableAvoidance && Time.time <= reacquireDirectPathUntilTime;
        bool hasLowLateralSpeed = LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond);
        bool shouldActivateArrivalTerminalCapture = ShouldActivateArrivalTerminalCapture();
        arrivalTerminalCaptureActive = arrivalTerminalCaptureActive || shouldActivateArrivalTerminalCapture;
        if (ShouldReleaseArrivalTerminalCapture())
        {
            arrivalTerminalCaptureActive = false;
        }

        bool requestBrake = ShouldRequestBrake();

        if (requestBrake && (!currentlyAvoiding || LastMetrics.shouldBrake))
        {
            ApplyBrakeRequest();
            return;
        }

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

        if (!shouldUseTerminalLateralCorrection && ShouldCaptureArrivalHoldNearArrival())
        {
            TryEnterHoldPosition();
            return;
        }

        if (shouldUseTerminalLateralCorrection)
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "lateral correction");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
            return;
        }

        bool terminalBrakeCommitFallback = arrivalBrakeCommitted
            && !shouldUseTerminalLateralCorrection
            && IsWithinArrivalTerminalRange()
            && !IsInArrivalCompletionWindow()
            && !ShouldCaptureArrivalHold()
            && !requestedFineApproach;
        if ((requestBrake || terminalBrakeCommitFallback || (LastMetrics.distance <= GetArrivalDistance() && !requestedFineApproach))
            && LastMetrics.distance <= Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 2f))
        {
            ApplyBrakeRequest();
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

        if (!currentlyAvoiding && arrivalTerminalCaptureActive && IsWithinArrivalTerminalRange())
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "terminal settle");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
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

    private void ApplyBrakeRequest()
    {
        arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
        limitedFinalApproachCapability = false;
        arrivalBrakeCommitted = true;
        Vector3 brakeDirection = ResolveBrakeDirection();
        float angle = Vector3.Angle(transform.forward, brakeDirection);
        float angularSpeed = GetAngularSpeedRadiansPerSecond();
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Brake;
        bool brakeAlignmentReady = UpdateBrakeAlignmentLock(angle, angularSpeed);
        SetState(brakeAlignmentReady ? PrototypeWaypointAutopilotState.Brake : PrototypeWaypointAutopilotState.FlipForBrake, "braking");
        ApplyAutopilotRequest(brakeDirection, 1f, false, brakeAlignmentReady);
    }

    private bool IsAvoidancePlanActive()
    {
        return LastTrajectoryPlan.RequiresAvoidance && LastTrajectoryPlan.obstacleDetected;
    }

    private bool ShouldActivateArrivalTerminalCapture()
    {
        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        return IsWithinArrivalTerminalRange()
            && (LastMetrics.shouldBrake
                || LastMetrics.relativeSpeed > GetArrivalCompletionSpeedLimit()
                || LastMetrics.lateralSpeed > GetArrivalCompletionLateralTolerance()
                || arrivalBrakeCommitted
                || brakeHoldActive
                || ShouldKeepTerminalBrakeCommitted()
                || ShouldCaptureArrivalHold()
                || ShouldCaptureArrivalHoldNearArrival()
                || ShouldCaptureTerminalOvershootHold());
    }

    private bool ShouldReleaseArrivalTerminalCapture()
    {
        if (!arrivalTerminalCaptureActive || IsWithinArrivalTerminalRange())
        {
            return false;
        }

        return LastMetrics.distance > GetArrivalTerminalRangeDistance() + BrakeArrivalHoldDistanceMarginMeters;
    }

    private bool ShouldRequestBrake()
    {
        if (brakeHoldActive && autopilotElapsedSeconds < brakeHoldStartTime + BrakeHoldMinDurationSeconds)
        {
            return true;
        }

        if (ShouldReleaseBrakeHoldForSettledOvershoot())
        {
            ReleaseBrakeHold();
            return false;
        }

        if (brakeHoldActive
            && arrivalBrakeCommitted
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit()
            && LastMetrics.distance <= GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters)
        {
            ReleaseBrakeHold();
            return false;
        }

        if (!LastMetrics.shouldBrake)
        {
            if (ShouldKeepTerminalBrakeCommitted())
            {
                if (!brakeHoldActive)
                {
                    brakeHoldActive = true;
                    brakeHoldStartTime = autopilotElapsedSeconds;
                }

                arrivalBrakeCommitted = true;
                return true;
            }

            if (arrivalBrakeCommitted
                && IsWithinArrivalTerminalRange()
                && (LastMetrics.relativeSpeed > GetArrivalCompletionSpeedLimit()
                    || LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed))
            {
                if (!ShouldUseTerminalLateralCorrection())
                {
                    if (!brakeHoldActive)
                    {
                        brakeHoldActive = true;
                        brakeHoldStartTime = autopilotElapsedSeconds;
                        arrivalBrakeCommitted = true;
                    }

                    return true;
                }

                if (brakeHoldActive)
                {
                    ReleaseBrakeHold();
                }
            }

            if (ShouldUseTerminalLateralCorrection())
            {
                if (brakeHoldActive)
                {
                    ReleaseBrakeHold();
                }

                return false;
            }

            if (arrivalBrakeCommitted
                && IsWithinArrivalTerminalRange()
                && LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed
                && LastMetrics.relativeSpeed > GetArrivalCompletionSpeedLimit())
            {
                return true;
            }

            if (brakeHoldActive && LastMetrics.relativeSpeed > GetArrivalCompletionSpeedLimit())
            {
                return true;
            }

            if (brakeHoldActive)
            {
                ReleaseBrakeHold();
            }

            return false;
        }

        if (!brakeHoldActive)
        {
            brakeHoldActive = true;
            brakeHoldStartTime = autopilotElapsedSeconds;
            arrivalBrakeCommitted = true;
        }

        return true;
    }

    private bool ShouldReleaseBrakeHoldForSettledOvershoot()
    {
        if (IsInArrivalCompletionWindow())
        {
            return false;
        }

        if (LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed)
        {
            return false;
        }

        float completionDistance = GetArrivalCompletionDistance();
        if (LastMetrics.distance <= completionDistance)
        {
            return false;
        }

        float completionLateralTolerance = GetArrivalCompletionLateralTolerance();
        if (LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit()
            && LastMetrics.lateralSpeed <= completionLateralTolerance)
        {
            return true;
        }

        float releaseLateralTolerance = completionLateralTolerance * BrakeHoldReleaseLateralRatio;
        return (LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed || LastMetrics.relativeSpeed <= BrakeHoldReleaseZeroSpeed)
            && LastMetrics.lateralSpeed <= releaseLateralTolerance;
    }

    private float GetArrivalCompletionDistance()
    {
        float arrivalDistance = GetArrivalDistance();
        float speedMargin = Mathf.Min(4f, Mathf.Sqrt(Mathf.Max(0.0001f, LastMetrics.relativeSpeed * LastMetrics.relativeSpeed + LastMetrics.lateralSpeed * LastMetrics.lateralSpeed)));
        float stopMargin = Mathf.Min(3f, LastMetrics.stoppingDistance * 0.4f);
        float etaMargin = (!float.IsInfinity(LastMetrics.etaSeconds) && LastMetrics.etaSeconds > 0f)
            ? Mathf.Clamp(2f - Mathf.Clamp(LastMetrics.etaSeconds / 2f, 0f, 2f), 0f, 2f)
            : 0f;

        return arrivalDistance + 1f + speedMargin + stopMargin + etaMargin;
    }

    private float GetArrivalCompletionSpeedLimit()
    {
        return Mathf.Max(arrivalSpeedMetersPerSecond * 2.2f, 0.95f);
    }

    private float GetArrivalCompletionLateralTolerance()
    {
        return Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond * 1.5f);
    }

    private bool IsInArrivalCompletionWindow()
    {
        float completionDistance = GetArrivalCompletionDistance();
        float completionSpeed = GetArrivalCompletionSpeedLimit();
        return currentTarget != null
            && shipRigidbody != null
            && LastMetrics.distance <= completionDistance
            && LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.lateralSpeed <= GetArrivalCompletionLateralTolerance();
    }

    private bool UpdateBrakeAlignmentLock(float angle, float angularSpeedRadiansPerSecond)
    {
        bool angularRateReady = IsBrakeAttitudeRateWithinMainThrottleGate(angularSpeedRadiansPerSecond);
        if (!brakeAlignmentLocked && angle <= alignmentAngleDegrees + BrakeAlignmentHysteresisDegrees && angularRateReady)
        {
            brakeAlignmentLocked = true;
        }
        else if (brakeAlignmentLocked
            && (angle >= alignmentAngleDegrees + BrakeAlignmentHysteresisDegrees * 2f
                || angularSpeedRadiansPerSecond > Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond * 1.35f))
        {
            brakeAlignmentLocked = false;
        }

        return angularRateReady && (brakeAlignmentLocked || angle <= alignmentAngleDegrees);
    }

    private bool IsBrakeAlignmentLockedForMainThrottle(float angle)
    {
        if (CurrentState != PrototypeWaypointAutopilotState.Brake && CurrentState != PrototypeWaypointAutopilotState.FlipForBrake)
        {
            brakeAlignmentLocked = false;
            return false;
        }

        return UpdateBrakeAlignmentLock(angle, GetAngularSpeedRadiansPerSecond());
    }

    private bool IsBrakeAttitudeRateWithinMainThrottleGate(float angularSpeedRadiansPerSecond)
    {
        return angularSpeedRadiansPerSecond <= Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond;
    }

    private float GetAngularSpeedRadiansPerSecond()
    {
        return shipRigidbody != null ? shipRigidbody.angularVelocity.magnitude : 0f;
    }

    private bool IsWithinArrivalTerminalRange()
    {
        return LastMetrics.distance <= GetArrivalTerminalRangeDistance();
    }

    private bool ShouldKeepTerminalBrakeCommitted()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseMainThrottle())
        {
            return false;
        }

        float holdCaptureDistance = Mathf.Max(
            GetArrivalTerminalRangeDistance(),
            GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters * 2f);
        if (LastMetrics.distance > holdCaptureDistance)
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        if (LastMetrics.relativeSpeed <= completionSpeed * TerminalOvershootBrakeRelativeSpeedMultiplier)
        {
            return false;
        }

        return arrivalBrakeCommitted || LastMetrics.distance <= GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters;
    }

    private bool ShouldCaptureTerminalOvershootHold()
    {
        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        if (!CanUseRcsTranslation())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalRange())
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        return LastMetrics.relativeSpeed <= completionSpeed * TerminalOvershootHoldRelativeSpeedMultiplier;
    }

    private float GetArrivalTerminalRangeDistance()
    {
        return Mathf.Max(
            GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters * 0.8f,
            GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters * 0.5f);
    }

    private bool ShouldUseTerminalLateralCorrection()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseRcsTranslation())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalRange())
        {
            return false;
        }

        if (LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond))
        {
            return false;
        }

        if (ShouldKeepTerminalBrakeCommitted())
        {
            return false;
        }

        float terminalSpeedLimit = Mathf.Max(lateralCorrectionSpeed, GetArrivalCompletionSpeedLimit() * 2f);
        return LastMetrics.relativeSpeed <= terminalSpeedLimit;
    }

    private bool ShouldUseTerminalBrakeDirectionSmoothing()
    {
        if (!IsWithinArrivalTerminalRange())
        {
            return false;
        }

        return arrivalBrakeCommitted
            || arrivalTerminalCaptureActive
            || brakeHoldActive
            || ShouldCaptureArrivalHold()
            || ShouldCaptureArrivalHoldNearArrival()
            || ShouldCaptureTerminalOvershootHold();
    }

    private Vector3 ResolveBrakeDirection()
    {
        Vector3 fallback = LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? -LastMetrics.directionToTarget
            : -transform.forward;
        bool useSmoothing = ShouldUseTerminalBrakeDirectionSmoothing();

        if (shipRigidbody == null)
        {
            if (committedBrakeDirection.sqrMagnitude > 0.0001f)
            {
                return committedBrakeDirection.normalized;
            }

            committedBrakeDirection = fallback.normalized;
            return committedBrakeDirection;
        }

        Vector3 velocity = shipRigidbody.linearVelocity;
        if (velocity.magnitude < BrakeDirectionMinimumSpeedMetersPerSecond)
        {
            if (committedBrakeDirection.sqrMagnitude > 0.0001f)
            {
                return committedBrakeDirection.normalized;
            }

            committedBrakeDirection = fallback.normalized;
            return committedBrakeDirection;
        }

        Vector3 observedBrakeDirection = -velocity.normalized;
        if (!useSmoothing)
        {
            committedBrakeDirection = observedBrakeDirection;
            return committedBrakeDirection;
        }

        if (committedBrakeDirection.sqrMagnitude <= 0.0001f)
        {
            committedBrakeDirection = observedBrakeDirection;
            return committedBrakeDirection;
        }

        float maxRotateRadians = Mathf.Deg2Rad * TerminalBrakeDirectionRotateDegreesPerSecond * Mathf.Max(Time.fixedDeltaTime, 0.02f);
        committedBrakeDirection = Vector3.RotateTowards(
            committedBrakeDirection.normalized,
            observedBrakeDirection,
            maxRotateRadians,
            0f);
        return committedBrakeDirection.normalized;
    }

    private Vector3 ResolveAvoidanceRequestDirection()
    {
        if (hasStableAvoidance && stableAvoidanceDirection.sqrMagnitude > 0.0001f)
        {
            return stableAvoidanceDirection;
        }

        return LastTrajectoryPlan.desiredBurnDirection;
    }

    private void ApplyAutopilotRequest(Vector3 desiredDirection, float throttle, bool finalApproach = false, bool? brakeAlignmentReadyOverride = null)
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 attitudeTorqueLocal = Vector3.zero;
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
            ApplyAutopilotAttitudeTarget(desiredDirectionNormalized);
            attitudeTorqueLocal = ComputeAttitudeTorqueLocal(desiredDirectionNormalized);
            desiredBurnDirection = desiredDirectionNormalized;
            float angle = Vector3.Angle(transform.forward, desiredDirectionNormalized);
            bool isBrakeState = CurrentState == PrototypeWaypointAutopilotState.Brake;
            bool isFlipForBrakeState = CurrentState == PrototypeWaypointAutopilotState.FlipForBrake;
            float angularSpeed = GetAngularSpeedRadiansPerSecond();
            bool canApplyMainThrottle = CanUseMainThrottle()
                && !isFlipForBrakeState
                && (!isBrakeState
                    ? angle <= alignmentAngleDegrees
                    : (brakeAlignmentReadyOverride ?? IsBrakeAlignmentLockedForMainThrottle(angle))
                        && IsBrakeAttitudeRateWithinMainThrottleGate(angularSpeed));

            if (canApplyMainThrottle)
            {
                requestedMainThrottle = ShapeMainThrottleForState(Mathf.Clamp01(throttle));
            }
            else
            {
                if (CurrentState == PrototypeWaypointAutopilotState.FlipForBrake && !CanUseRcsAttitude())
                {
                    arrivalFailureReason = "NoAttitudeAuthority";
                    ClearCommands();
                    autopilotEngaged = false;
                    SetState(PrototypeWaypointAutopilotState.Failed, "NoAttitudeAuthority");
                    return;
                }

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
            attitudeTorqueLocal,
            requestedMainThrottle,
            false));
    }

    private float ShapeMainThrottleForState(float throttle)
    {
        if (CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            return 0f;
        }

        if (CurrentState != PrototypeWaypointAutopilotState.Brake)
        {
            return throttle;
        }

        if (IsInArrivalCompletionWindow())
        {
            return 0f;
        }

        if (!IsWithinArrivalTerminalRange())
        {
            return throttle;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        if (LastMetrics.relativeSpeed <= completionSpeed * 1.1f)
        {
            return 0f;
        }

        float speedScale = Mathf.InverseLerp(completionSpeed * 1.1f, completionSpeed * 3f, LastMetrics.relativeSpeed);
        float distanceScale = Mathf.InverseLerp(GetArrivalCompletionDistance(), GetArrivalTerminalRangeDistance(), LastMetrics.distance);
        return throttle * Mathf.Clamp01(Mathf.Max(speedScale, distanceScale));
    }

    private void ApplyLateralCorrection()
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 desiredForceWorld;
        Vector3 forceWorld = ComputeLateralCorrectionForceWorld(out desiredForceWorld);
        bool limitedRcsAuthority = desiredForceWorld.sqrMagnitude > 0.0001f
            && forceWorld.sqrMagnitude + 0.000001f < desiredForceWorld.sqrMagnitude;
        requestedMainThrottle = 0f;
        requestedRcsTranslation = forceWorld;
        desiredBurnDirection = Vector3.zero;

        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.phase = PrototypeTrajectoryPhase.FinalApproach;
        updatedPlan.navigationPhase = PrototypeAutopilotNavigationPhase.FinalApproach;
        updatedPlan.activeSegmentType = PrototypeTrajectorySegmentType.FinalApproach;
        updatedPlan.requestedMainThrottle = 0f;
        updatedPlan.requestedRcsForceWorld = forceWorld;
        updatedPlan.desiredBurnDirection = Vector3.zero;
        updatedPlan.desiredBurnDirectionWorld = Vector3.zero;
        updatedPlan.desiredAccelerationWorld = forceWorld / GetShipMassKg();
        updatedPlan.status = "lateral correction";
        updatedPlan.statusLabel = "lateral correction";
        if (LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond && limitedRcsAuthority)
        {
            updatedPlan.limitedRcsAuthority = true;
            updatedPlan.warningStatus = "LimitedRcsAuthority";
            arrivalFailureReason = "LimitedRcsAuthority";
        }

        LastTrajectoryPlan = updatedPlan;
        shipController.SetSasMode(SasControlMode.KillRotation);
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            forceWorld,
            Vector3.zero,
            0f,
            false));
    }

    private Vector3 ComputeLateralCorrectionForceWorld()
    {
        return ComputeLateralCorrectionForceWorld(out _);
    }

    private Vector3 ComputeLateralCorrectionForceWorld(out Vector3 desiredForceWorld)
    {
        desiredForceWorld = Vector3.zero;
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
        desiredForceWorld = correctionWorld.normalized * shapedForce;
        return Vector3.ClampMagnitude(desiredForceWorld, rcsTranslationScale);
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

        Vector3 desiredDampingForce;
        Vector3 dampingForce = ComputeVelocityDampingForceWorld(shipRigidbody.linearVelocity, out desiredDampingForce);
        bool limitedHoldAuthority = desiredDampingForce.sqrMagnitude > 0.0001f
            && dampingForce.magnitude + 0.001f < desiredDampingForce.magnitude;
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
        else if (limitedHoldAuthority)
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

    private void ApplyAutopilotAttitudeTarget(Vector3 desiredDirection)
    {
        if (shipController == null || desiredDirection.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        ReassertAutopilotActuators();
        Vector3 forward = desiredDirection.normalized;
        Vector3 up = Vector3.ProjectOnPlane(transform.up, forward);
        if (up.sqrMagnitude <= 0.0001f)
        {
            up = Vector3.ProjectOnPlane(Vector3.up, forward);
        }

        if (up.sqrMagnitude <= 0.0001f)
        {
            up = Vector3.ProjectOnPlane(transform.right, forward);
        }

        if (up.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        Quaternion targetRotation = Quaternion.LookRotation(forward, up.normalized);
        if (!TrajectoryPredictionMath.IsFinite(targetRotation))
        {
            return;
        }

        if (CurrentState == PrototypeWaypointAutopilotState.Brake
            || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            shipController.SetSasMode(SasControlMode.KillRotation);
            return;
        }

        shipController.SetSasMode(SasControlMode.HoldAttitude);
        shipController.SetSasTargetRotation(targetRotation);
    }

    private void ReassertAutopilotActuators()
    {
        if (shipController == null)
        {
            return;
        }

        shipController.SetRcsEnabled(true);
        shipController.SetSasEnabled(true);
    }

    private Vector3 ComputeVelocityDampingForceWorld(Vector3 velocity)
    {
        return ComputeVelocityDampingForceWorld(velocity, out _);
    }

    private Vector3 ComputeVelocityDampingForceWorld(Vector3 velocity, out Vector3 desiredForceWorld)
    {
        desiredForceWorld = Vector3.zero;
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
        desiredForceWorld = -velocity.normalized * desiredForce;
        return Vector3.ClampMagnitude(desiredForceWorld, rcsAuthority);
    }

    private Vector3 ComputeAttitudeCommand(Vector3 desiredDirection)
    {
        Vector3 localDirection = transform.InverseTransformDirection(desiredDirection.normalized);
        if (localDirection.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        Vector3 turnAxisLocal = Vector3.Cross(Vector3.forward, localDirection.normalized);
        if (turnAxisLocal.sqrMagnitude <= 0.0004f && localDirection.z < 0f)
        {
            // Retrograde is an unstable reference in this projection; prefer a deterministic pitch-axis command.
            Vector3 retrogradeCommand = Vector3.right;
            if (CurrentState == PrototypeWaypointAutopilotState.Brake
                || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                retrogradeCommand = ApplyBrakeApproachDamping(retrogradeCommand);
            }

            return retrogradeCommand;
        }

        if (turnAxisLocal.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        float angleDegrees = Vector3.Angle(Vector3.forward, localDirection);
        float commandMagnitude = Mathf.Clamp01(angleDegrees / 45f);
        Vector3 command = Vector3.ClampMagnitude(turnAxisLocal.normalized * commandMagnitude, 1f);

        if (CurrentState == PrototypeWaypointAutopilotState.Brake
            || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            command = ApplyBrakeApproachDamping(command);
        }

        return command;
    }

    private Vector3 ComputeAttitudeTorqueLocal(Vector3 desiredDirection)
    {
        Vector3 attitudeCommand = ComputeAttitudeCommand(desiredDirection);
        float torqueAuthority = GetRcsAttitudeTorqueAuthority();
        return torqueAuthority > 0.0001f ? attitudeCommand * torqueAuthority : Vector3.zero;
    }

    private Vector3 ApplyBrakeApproachDamping(Vector3 attitudeCommand)
    {
        if (shipRigidbody == null)
        {
            return attitudeCommand;
        }

        Vector3 angularVelocityLocal = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        if (angularVelocityLocal.sqrMagnitude <= 0.0001f)
        {
            return attitudeCommand;
        }

        float angularSpeed = angularVelocityLocal.magnitude;
        float angularSpeedLimit = Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond;
        float spinRate = Mathf.InverseLerp(
            0f,
            angularSpeedLimit,
            angularSpeed);
        float commandScale = Mathf.Lerp(1f, 0.55f, spinRate);
        float outputLimit = Mathf.Lerp(1f, 0.85f, spinRate);
        if (angularSpeed > angularSpeedLimit)
        {
            float spinOverRate = Mathf.InverseLerp(
                angularSpeedLimit,
                angularSpeedLimit * 1.8f,
                angularSpeed);
            commandScale = Mathf.Lerp(0.55f, 0.25f, spinOverRate);
            outputLimit = Mathf.Lerp(0.85f, BrakeCommandSpinSoftLimitMultiplier, spinOverRate);
        }

        Vector3 spinDamping = angularVelocityLocal * BrakeAttitudeDampingGain;
        Vector3 dampedCommand = attitudeCommand * commandScale - spinDamping;
        return Vector3.ClampMagnitude(dampedCommand, outputLimit);
    }

    private void ReleaseBrakeHold()
    {
        brakeHoldActive = false;
        brakeHoldStartTime = 0f;
    }

    private float GetRcsAttitudeTorqueAuthority()
    {
        if (shipController != null && !shipController.RcsEnabled)
        {
            return 0f;
        }

        RcsThrusterController rcsThrusters = shipController != null ? shipController.GetComponent<RcsThrusterController>() : GetComponent<RcsThrusterController>();
        if (rcsThrusters == null || !rcsThrusters.RcsEnabled)
        {
            return 0f;
        }

        return Mathf.Max(0f, rcsThrusters.ComputeEffectiveTorqueAuthorityForDiagnostics());
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

        Vector3 shipPosition = shipRigidbody.worldCenterOfMass;
        Vector3 shipVelocity = shipRigidbody.linearVelocity;
        Vector3 toTarget = currentTarget.Position - shipPosition;
        float distanceToTarget = toTarget.magnitude;
        Vector3 directionToTarget = distanceToTarget > 0.0001f ? toTarget / distanceToTarget : Vector3.forward;
        float positiveClosingSpeed = Mathf.Max(0f, Vector3.Dot(shipVelocity, directionToTarget));
        float alignmentSafetyLead = EstimateAlignmentLeadDistance(shipVelocity, positiveClosingSpeed);
        float safetyMargin = EstimateBrakeSafetyMargin(positiveClosingSpeed, alignmentSafetyLead);

        LastMetrics = CalculateMetrics(
            shipPosition,
            shipVelocity,
            currentTarget.Position,
            GetMaxDeceleration(),
            safetyMargin);
        if (!LastMetrics.isFinite)
        {
            ArrivalStatus = "non-finite metrics";
            return;
        }

        LastFuelEstimate = EstimateFuel(LastMetrics, shipStats, GetMaxAcceleration(), fuelReserveSeconds);
        ArrivalStatus = HasArrived() ? "arrived" : LastMetrics.shouldBrake ? "brake" : "en route";
    }

    private float EstimateBrakeSafetyMargin(float closingSpeed, float alignmentSafetyLead)
    {
        float arrivalDistance = GetArrivalDistance();
        float slowBrakeLead = Mathf.Clamp(arrivalDistance * 0.15f, 0.75f, 2f);
        float slowSpeed = Mathf.Max(0.8f, arrivalSpeedMetersPerSecond * 1.2f);
        float fastSpeed = Mathf.Max(8f, arrivalSpeedMetersPerSecond * 8f);
        float speedScale = Mathf.InverseLerp(slowSpeed, fastSpeed, Mathf.Max(0f, closingSpeed));
        float velocitySafetyLead = Mathf.Lerp(slowBrakeLead, stoppingSafetyMarginMeters, speedScale);
        return arrivalDistance + velocitySafetyLead + Mathf.Max(0f, alignmentSafetyLead);
    }

    private float EstimateAlignmentLeadDistance(Vector3 shipVelocity, float closingSpeed)
    {
        if (closingSpeed <= 0.01f || shipRigidbody == null)
        {
            return 0f;
        }

        Vector3 linearVelocity = shipVelocity;
        if (linearVelocity.sqrMagnitude <= 0.0001f)
        {
            return 0f;
        }

        float alignmentAngle = Vector3.Angle(transform.forward, -linearVelocity.normalized);
        float neededAngle = Mathf.Max(0f, alignmentAngle - alignmentAngleDegrees);
        if (neededAngle <= 2f)
        {
            return 0f;
        }

        float rcsTorqueAuthority = GetRcsAttitudeTorqueAuthority();
        if (rcsTorqueAuthority <= 0.0001f)
        {
            return Mathf.Min(closingSpeed * 0.4f, 6f);
        }

        Vector3 inertiaTensor = shipRigidbody.inertiaTensor;
        float inertiaEstimate = Mathf.Max(Mathf.Max(inertiaTensor.x, inertiaTensor.y), inertiaTensor.z);
        inertiaEstimate = Mathf.Max(0.25f, inertiaEstimate);
        float angularAcceleration = rcsTorqueAuthority / inertiaEstimate;
        angularAcceleration = Mathf.Max(0.25f, angularAcceleration);

        float alignTimeSeconds = Mathf.Sqrt((2f * Mathf.Deg2Rad * neededAngle) / angularAcceleration);
        float conservativeTurnTime = Mathf.Lerp(0.5f, 3.4f, Mathf.Clamp01(neededAngle / 180f));
        float leadTimeSeconds = Mathf.Max(alignTimeSeconds + 0.25f, conservativeTurnTime);
        return Mathf.Clamp(closingSpeed * leadTimeSeconds, 0f, 220f);
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
        return currentTarget != null
            && shipRigidbody != null
            && LastMetrics.distance <= GetArrivalFinishedDistance()
            && LastMetrics.relativeSpeed <= Mathf.Max(arrivalSpeedMetersPerSecond, holdCompletionSpeedMetersPerSecond * 4f)
            && LastMetrics.lateralSpeed <= Mathf.Max(0.1f, finalApproachLateralToleranceMetersPerSecond * 1.25f);
    }

    private float GetArrivalFinishedDistance()
    {
        return Mathf.Max(
            GetArrivalDistance() + 2f,
            GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters * 0.5f);
    }

    private bool ShouldCaptureArrivalHold()
    {
        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        if (IsInArrivalCompletionWindow())
        {
            return true;
        }

        if (!CanUseRcsTranslation() && !arrivalBrakeCommitted)
        {
            return false;
        }

        if (LastMetrics.distance > GetArrivalTerminalRangeDistance())
        {
            return false;
        }

        float completionLateralTolerance = Mathf.Max(
            BrakeArrivalHoldMinimumLateralTolerance,
            GetArrivalCompletionLateralTolerance() * BrakeArrivalHoldLateralSpeedMultiplier);

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        return LastMetrics.relativeSpeed <= completionSpeed * BrakeArrivalHoldRelativeSpeedMultiplier
            && LastMetrics.lateralSpeed <= completionLateralTolerance;
    }

    private bool ShouldCaptureArrivalHoldNearArrival()
    {
        if (!CanUseRcsTranslation() && !arrivalBrakeCommitted)
        {
            return false;
        }

        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        float arrivalCompletionDistance = Mathf.Max(
            GetArrivalDistance(),
            GetArrivalCompletionDistance());
        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float completionLateralTolerance = GetArrivalCompletionLateralTolerance();

        return LastMetrics.distance <= arrivalCompletionDistance
            && LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.lateralSpeed <= completionLateralTolerance;
    }

    private void UpdateHoldStatus()
    {
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Hold;
        if (!ShouldCaptureArrivalHold())
        {
            holdConfirmStarted = false;
            return;
        }

        if (shipRigidbody == null || shipRigidbody.linearVelocity.sqrMagnitude > 0.01f)
        {
            holdConfirmUntilTime = autopilotElapsedSeconds + Mathf.Max(0f, holdConfirmSeconds);
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
                holdConfirmUntilTime = autopilotElapsedSeconds + Mathf.Max(0f, holdConfirmSeconds);
                holdConfirmStarted = true;
            }
        }
        else
        {
            holdConfirmUntilTime = autopilotElapsedSeconds + Mathf.Max(0f, holdConfirmSeconds);
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
            && HasArrived()
            && holdConfirmStarted
            && autopilotElapsedSeconds >= holdConfirmUntilTime
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

    private bool CanUseRcsAttitude()
    {
        return GetRcsAttitudeTorqueAuthority() > RcsAuthorityEpsilon;
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
            shipController.SetSasMode(SasControlMode.KillRotation);
        }

        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
        brakeAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        brakeHoldStartTime = 0f;
        brakeHoldActive = false;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
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
