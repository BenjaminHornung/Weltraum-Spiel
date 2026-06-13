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
    private const float BrakeHoldReleaseZeroSpeed = 0.05f;
    private const float BrakeHoldReleaseLateralRatio = 1.75f;
    private const float BrakeAlignmentAngularSpeedLimitDegreesPerSecond = 35f;
    private const float BrakeMainThrottleAngularSpeedLockDegreesPerSecond = 20f;
    private const float BrakeMainThrottleAngularSpeedReleaseDegreesPerSecond = 30f;
    private const float BrakeMainThrottleRetrogradeAlignmentDegrees = 30f;
    private const float BrakeSettledAngularSpeedLimitDegreesPerSecond = 4f;
    private const float BrakeArrivalHoldDistanceMarginMeters = 6f;
    private const float BrakeArrivalHoldLateralSpeedMultiplier = 6f;
    private const float BrakeArrivalHoldMinimumLateralTolerance = 1.2f;
    private const float BrakeArrivalHoldRelativeSpeedMultiplier = 1.8f;
    private const float TerminalOvershootHoldRelativeSpeedMultiplier = 1.25f;
    private const float TerminalOvershootBrakeRelativeSpeedMultiplier = 1.35f;
    private const float BrakeDirectionMinimumSpeedMetersPerSecond = 0.35f;
    private const float TerminalBrakeDirectionRotateDegreesPerSecond = 36f;
    private const float BrakeAlignedTorqueDeadbandDegrees = 2.5f;
    private const float FlightPlanDivergenceConfirmSeconds = 0.3f;
    private const float FlightPlanDivergenceReplanCooldownSeconds = 0.45f;
    private const float FlightPlanDivergenceStatusHoldSeconds = 2f;
    private const float FlightPlanSafetyRefreshIntervalSeconds = 0.75f;
    private const float DirectFastTransferMainAuthorityBlockedTimeoutSeconds = 6f;
    private const float DirectFastTransferBurnLatchEngageDegrees = 8f;
    private const float DirectFastTransferBurnLatchKeepDegrees = 18f;
    private const float DirectFastTransferBurnLatchReleaseDegrees = 22f;
    private const float DirectFastTransferBrakeLatchEngageDegrees = 12f;
    private const float DirectFastTransferBrakeLatchKeepDegrees = 30f;
    private const float DirectFastTransferBrakeLatchReleaseDegrees = 36f;
    private const float DirectFastTransferMainLatchEngageAngularSpeedDegreesPerSecond = 20f;
    private const float DirectFastTransferMainLatchKeepAngularSpeedDegreesPerSecond = 45f;
    private const float DirectFastTransferMainLatchReleaseAngularSpeedDegreesPerSecond = 60f;
    private const float DirectFastTransferTerminalReacquireTimeoutSeconds = 45f;
    private const PrototypeFlightPlanAbortReplanReason DirectFastTransferNominalExecutionReasons =
        PrototypeFlightPlanAbortReplanReason.PositionDivergence
        | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
        | PrototypeFlightPlanAbortReplanReason.AttitudeDivergence
        | PrototypeFlightPlanAbortReplanReason.TrackingDiverged
        | PrototypeFlightPlanAbortReplanReason.FuelMismatch;

    private static float AutopilotTickSeconds => Time.fixedDeltaTime > 0f ? Time.fixedDeltaTime : 0.02f;

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
    [SerializeField] private bool useFlightPlanExecutor = true;
    [SerializeField] private bool strictFlightPlanExecution = true;

    [Header("Runtime")]
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private PrototypeObstacleDetector obstacleDetector;
    [SerializeField] private FloatingOriginManager floatingOriginManager;

    private bool thrusterComponentCacheInitialized;
    private PlayerShipController cachedThrusterLookupController;
    private GameObject cachedThrusterLookupGameObject;
    private RcsThrusterController cachedRcsThrusters;
    private MainThrusterBank cachedMainThrusterBank;
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
    private bool brakeMainThrottleAlignmentLocked;
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
    private string activeFlightPlanId = string.Empty;
    private int activeFlightPlanRevision = -1;
    private float flightPlanElapsedSeconds;
    private bool flightPlanExecutorActive;
    private PrototypeFlightPlanExecutionState lastFlightPlanExecutionState;
    private PrototypeFlightPlanDivergenceReport lastFlightPlanDivergenceReport = PrototypeFlightPlanDivergenceReport.Clear;
    private float flightPlanDivergenceStartedAtTime = -1f;
    private float lastFlightPlanDivergenceAtTime = -1000f;
    private float lastFlightPlanSafetyReplanAtTime = -1000f;
    private float nextFlightPlanSafetyRefreshTime;
    private int flightPlanRevisionCounter;
    private int flightPlanSafetyReplanCount;
    private string lastAssignedFlightPlanId = string.Empty;
    private bool forceNextFlightPlanRevision;
    private PrototypeFlightPlanTrackingCommand lastFlightPlanTrackingCommand;
    private int directFastTransferAuthorityBlockedPlanRevision = -1;
    private int directFastTransferAuthorityBlockedSegmentIndex = -1;
    private float directFastTransferAuthorityBlockedSeconds;
    private bool directFastMainThrottleLatched;
    private int directFastMainLatchPlanRevision = -1;
    private int directFastMainLatchSegmentIndex = -1;
    private string directFastMainThrottleLatchStatus = string.Empty;
    private bool directFastTransferBrakeCommitted;
    private bool directFastTransferTerminalCaptureActive;
    private bool directFastTransferTerminalReacquireActive;
    private float directFastTransferTerminalReacquireStartedAtTime = -1f;
    private PrototypeMomentumAssist momentumAssist;
    private PrototypeTrajectoryPlanner trajectoryPlanner;
    private FloatingOriginManager subscribedFloatingOriginManager;
    private bool floatingOriginManagerLookupAttempted;

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
    public PrototypeFlightPlan CurrentFlightPlan => LastTrajectoryPlan.flightPlan;
    public bool HasExecutableFlightPlan => CurrentFlightPlan.IsValid;
    public PrototypeManeuverSegment[] FlightPlanSegments => CurrentFlightPlan.segments ?? System.Array.Empty<PrototypeManeuverSegment>();
    public PrototypeTrajectoryPredictedSample[] FlightPlanSamples => CurrentFlightPlan.predictedSamples ?? System.Array.Empty<PrototypeTrajectoryPredictedSample>();
    public bool FlightPlanExecutorEnabled => useFlightPlanExecutor;
    public bool StrictFlightPlanExecution => strictFlightPlanExecution;
    public bool FlightPlanExecutorActive => flightPlanExecutorActive;
    public float FlightPlanExecutorElapsedSeconds => flightPlanElapsedSeconds;
    public PrototypeFlightPlanExecutionState CurrentFlightPlanExecutionState => lastFlightPlanExecutionState;
    public PrototypeFlightPlanTrackingCommand CurrentFlightPlanTrackingCommand => lastFlightPlanTrackingCommand;
    public PrototypeFlightPlanTrackingError CurrentFlightPlanTrackingError => lastFlightPlanTrackingCommand.error;
    public string FlightPlanTrackingStatusLabel => string.IsNullOrWhiteSpace(lastFlightPlanTrackingCommand.statusLabel)
        ? "Tracking: idle"
        : lastFlightPlanTrackingCommand.statusLabel;
    public PrototypeFlightPlanDivergenceReport CurrentFlightPlanDivergenceReport => IsFlightPlanDivergenceStatusVisible()
        ? lastFlightPlanDivergenceReport
        : PrototypeFlightPlanDivergenceReport.Clear;
    public PrototypeFlightPlanAbortReplanReason FlightPlanDivergenceReasons => CurrentFlightPlanDivergenceReport.reasons;
    public bool FlightPlanRequiresReplan => CurrentFlightPlanDivergenceReport.requiresReplan;
    public bool FlightPlanRequiresAbort => CurrentFlightPlanDivergenceReport.requiresAbort;
    public string FlightPlanDivergenceStatusLabel => CurrentFlightPlanDivergenceReport.statusLabel;
    public int FlightPlanSafetyReplanCount => flightPlanSafetyReplanCount;
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
    public Vector3[] PredictedRoute => CurrentFlightPlan.predictedSamples != null && CurrentFlightPlan.predictedSamples.Length > 0
        ? CopyFlightPlanSamplePositions(CurrentFlightPlan.predictedSamples, 96)
        : (LastTrajectoryPlan.predictedPath ?? System.Array.Empty<Vector3>());
    public string SelectedCandidate => string.IsNullOrWhiteSpace(LastTrajectoryPlan.selectedCandidate) ? "direct" : LastTrajectoryPlan.selectedCandidate;
    public string SelectedCandidateReason => string.IsNullOrWhiteSpace(LastTrajectoryPlan.selectedCandidateReason) ? NavigationPlanStatus : LastTrajectoryPlan.selectedCandidateReason;
    public bool TerminalRcsOnlyCorrectionActive
    {
        get
        {
            if (currentTarget == null || shipRigidbody == null)
            {
                return false;
            }

            if (CurrentState == PrototypeWaypointAutopilotState.ObstacleAvoidance)
            {
                return false;
            }

            if (!IsWithinArrivalTerminalCaptureRange())
            {
                return false;
            }

            return LastMetrics.distance <= GetFineArrivalRcsOnlyDistanceLimit()
                && LastMetrics.relativeSpeed <= TerminalRcsOnlySpeedLimit
                && Mathf.Abs(LastMetrics.closingSpeed) <= GetFineArrivalRcsOnlyClosingSpeedLimit()
                && LastMetrics.lateralSpeed <= GetFineArrivalRcsOnlyLateralSpeedLimit();
        }
    }

    public float TerminalRcsOnlySpeedLimit
    {
        get
        {
            return Mathf.Min(
                GetArrivalCompletionSpeedLimit(),
                Mathf.Max(0.75f, arrivalSpeedMetersPerSecond * 1.25f));
        }
    }
    public int NavigationPlanRefreshCount { get; private set; }
    public bool NavigationDebugPlanningActive => navigationDebugPlanningActive;
    public float NavigationPlanIntervalSeconds => Mathf.Clamp(navigationPlanIntervalSeconds, 0.1f, 0.25f);

    private void Awake()
    {
        ResolveReferences();
    }

    private void OnEnable()
    {
        floatingOriginManagerLookupAttempted = false;
        ResolveFloatingOriginManagerSubscription();
    }

    private void OnDisable()
    {
        UnsubscribeFromFloatingOriginShift();
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
        ResolveReferences(forceThrusterComponentCacheRefresh: true);
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

        autopilotElapsedSeconds += AutopilotTickSeconds;

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

        bool strictDirectFastTransferActive = IsStrictDirectFastTransferExecutionActive();
        if (!strictDirectFastTransferActive
            && !ShouldProtectDirectFastTransferBrakeSegmentFromTerminalHold()
            && (ShouldMaintainArrivalHold()
                || (ShouldCaptureAnyArrivalHold() && !IsAvoidancePlanActive()))
            && TryEnterHoldPosition())
        {
            return;
        }

        if (TryRunFlightPlanExecutor())
        {
            return;
        }

        if (TryBlockLegacyLiveGatesForActiveFlightPlan())
        {
            return;
        }

        if (strictDirectFastTransferActive)
        {
            PrototypeFlightPlanExecutionState state = BuildFlightPlanExecutionState(CurrentFlightPlan, flightPlanElapsedSeconds);
            FailStrictDirectFastTransferExecution(
                state,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "direct fast transfer executor unavailable");
            return;
        }

        RunAutopilotStep();
    }

    private bool TryEnterHoldPosition()
    {
        if (IsWithinArrivalTerminalCaptureRange())
        {
            arrivalTerminalCaptureActive = true;
        }

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
        ResetFlightPlanExecutorClock();
        flightPlanRevisionCounter = 0;
        flightPlanSafetyReplanCount = 0;
        lastAssignedFlightPlanId = string.Empty;
        forceNextFlightPlanRevision = true;
        hasStableAvoidance = false;
        stableAvoidanceWaypoint = Vector3.zero;
        stableAvoidanceDirection = Vector3.zero;
        avoidanceHoldExpireTime = 0f;
        reacquireDirectPathUntilTime = 0f;
        brakeAlignmentLocked = false;
        brakeMainThrottleAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        brakeHoldStartTime = 0f;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
        ResetDirectFastTransferTerminalOwnership();
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
        ResetFlightPlanExecutorClock();
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
        ResetFlightPlanExecutorClock();
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
        brakeMainThrottleAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
        ResetDirectFastTransferTerminalOwnership();
        ResetFlightPlanExecutorClock();
        flightPlanRevisionCounter = 0;
        flightPlanSafetyReplanCount = 0;
        lastAssignedFlightPlanId = string.Empty;
        forceNextFlightPlanRevision = true;
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

    public void SetFlightPlanExecutorEnabledForTests(bool enabled)
    {
        useFlightPlanExecutor = enabled;
        ResetFlightPlanExecutorClock();
    }

    public void SetStrictFlightPlanExecutionForTests(bool enabled)
    {
        strictFlightPlanExecution = enabled;
        ResetFlightPlanExecutorClock();
        MarkNavigationPlanDirty();
    }

    public void ReplanNow()
    {
        ResolveReferences();
        RefreshDiagnostics();
        forceNextFlightPlanRevision = true;
        MarkNavigationPlanDirty();
        RefreshNavigationPlan();
    }

    public void ClearActiveFlightPlanForDebug()
    {
        ResetFlightPlanExecutorClock();
        lastAssignedFlightPlanId = string.Empty;
        forceNextFlightPlanRevision = true;
        ClearFlightPlanActuatorOutput("FlightPlan cleared by debug console");
        LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? LastMetrics.directionToTarget
            : Vector3.forward);
        MarkNavigationPlanDirty();
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
        string[] chips = new string[10];
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

        if (FlightPlanRequiresAbort)
        {
            chips[count++] = "PLAN ABORT";
        }
        else if (FlightPlanRequiresReplan)
        {
            chips[count++] = "REPLAN";
        }

        if (AvoidanceActive || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding)
        {
            chips[count++] = "AVOIDANCE";
        }

        if (LimitedFinalApproachCapability
            || LastTrajectoryPlan.limitedRcsAuthority
            || HasTerminalNoRcsFlightPlanLimitation()
            || (FlightPlanDivergenceReasons & PrototypeFlightPlanAbortReplanReason.NoRcsAuthority) != 0
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
        nextFlightPlanSafetyRefreshTime = 0f;
    }

    private void HandleOriginShifted(FloatingOriginShift shift)
    {
        if (shift.LocalShift.sqrMagnitude <= 0.000001f)
        {
            return;
        }

        forceNextFlightPlanRevision = true;
        hasStableAvoidance = false;
        stableAvoidanceWaypoint = Vector3.zero;
        stableAvoidanceDirection = Vector3.zero;
        avoidanceHoldExpireTime = 0f;
        reacquireDirectPathUntilTime = 0f;
        ResetFlightPlanExecutorClock();
        LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? LastMetrics.directionToTarget
            : transform.forward);
        MarkNavigationPlanDirty();
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

    private bool TryRunFlightPlanExecutor()
    {
        flightPlanExecutorActive = false;
        if (!useFlightPlanExecutor || !LastMetrics.isFinite || shipRigidbody == null || shipController == null)
        {
            return false;
        }

        if (ShouldDeferFlightPlanExecutorToLegacyFallback())
        {
            return false;
        }

        PrototypeFlightPlan plan = CurrentFlightPlan;
        if (!plan.IsValid)
        {
            if (strictFlightPlanExecution && plan.HasSegments)
            {
                PrototypeFlightPlanAbortReplanReason reasons = plan.nonExecutableReasons == PrototypeFlightPlanAbortReplanReason.None
                    ? PrototypeFlightPlanAbortReplanReason.NonExecutable
                    : plan.nonExecutableReasons;
                var report = new PrototypeFlightPlanDivergenceReport(
                    reasons,
                    true,
                    false,
                    "Replan: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons));
                PrototypeFlightPlanExecutionState invalidState = BuildFlightPlanExecutionState(plan, flightPlanElapsedSeconds);
                invalidState.replanReasons |= reasons;
                invalidState.requiresReplan = true;
                invalidState.statusLabel = report.statusLabel;
                lastFlightPlanExecutionState = invalidState;
                if (IsStrictDirectFastTransferPlan(plan))
                {
                    return FailStrictDirectFastTransferExecution(
                        invalidState,
                        reasons,
                        "direct fast transfer plan invalid");
                }

                return ForceFlightPlanSafetyReplan(report, "flight plan invalid");
            }

            return false;
        }

        PrototypeObstacleDetectionResult liveObstacle = DetectFlightPlanObstacle(plan);
        if (liveObstacle.hasObstacle)
        {
            LastObstacleDetection = liveObstacle;
        }

        TrackActiveFlightPlan(plan);
        if (!plan.TryGetActiveSegment(flightPlanElapsedSeconds, out PrototypeManeuverSegment segment))
        {
            PrototypeFlightPlanExecutionState expiredState = BuildFlightPlanExecutionState(plan, flightPlanElapsedSeconds);
            PrototypeFlightPlanDivergenceReport expiredReport = EvaluateFlightPlanDivergence(plan, expiredState, liveObstacle, default, true);
            bool strictDirectFastTransfer = IsStrictDirectFastTransferPlan(plan);
            if (strictDirectFastTransfer
                && flightPlanElapsedSeconds > plan.totalDurationSeconds
                && TryRunDirectFastTransferTerminalCaptureOrReacquire())
            {
                flightPlanExecutorActive = true;
                expiredState.requiresReplan = false;
                expiredState.replanReasons &= ~PrototypeFlightPlanAbortReplanReason.PlanExpired;
                expiredState.statusLabel = directFastTransferTerminalReacquireActive ? "Reacquire" : "Terminal capture";
                lastFlightPlanExecutionState = expiredState;
                flightPlanElapsedSeconds += AutopilotTickSeconds;
                return true;
            }

            if (!strictDirectFastTransfer
                && flightPlanElapsedSeconds > plan.totalDurationSeconds
                && TryRunFlightPlanTerminalSafety())
            {
                flightPlanExecutorActive = true;
                lastFlightPlanExecutionState = expiredState;
                flightPlanElapsedSeconds += AutopilotTickSeconds;
                return true;
            }

            if (plan.IsDirectFastTransfer
                && flightPlanElapsedSeconds > plan.totalDurationSeconds
                && expiredReport.reasons == PrototypeFlightPlanAbortReplanReason.PlanExpired)
            {
                SetFlightPlanDivergenceReport(PrototypeFlightPlanDivergenceReport.Clear);
                flightPlanExecutorActive = true;
                lastFlightPlanExecutionState = expiredState;
                arrivalFailureReason = string.Empty;
                return TryEnterHoldPosition();
            }

            if (TryHandleFlightPlanDivergence(plan, expiredState, expiredReport))
            {
                return true;
            }

            if (expiredReport.RequiresAction)
            {
                return ForceFlightPlanSafetyReplan(expiredReport, "flight plan expired");
            }

            return BlockFlightPlanLegacyFallback(
                expiredState,
                PrototypeFlightPlanAbortReplanReason.PlanExpired,
                "flight plan expired");
        }

        PrototypeFlightPlanExecutionState executionState = BuildFlightPlanExecutionState(plan, flightPlanElapsedSeconds);
        PrototypeFlightPlanTrackingCommand trackingCommand = BuildFlightPlanTrackingCommand(plan);
        lastFlightPlanTrackingCommand = trackingCommand;
        ApplyTrackingErrorToExecutionState(trackingCommand, ref executionState);
        bool handledSoftTrackingCorrection = TryHandleDirectFastTransferSoftTrackingCorrection(
            segment,
            ref trackingCommand,
            ref executionState);
        if (handledSoftTrackingCorrection)
        {
            lastFlightPlanTrackingCommand = trackingCommand;
        }
        else if (trackingCommand.requiresReplan)
        {
            if (HandleFlightPlanTrackingReplan(trackingCommand, executionState))
            {
                return true;
            }
        }

        PrototypeFlightPlanDivergenceReport divergenceReport = EvaluateFlightPlanDivergence(plan, executionState, liveObstacle, segment, false);
        if (TryHandleFlightPlanDivergence(plan, executionState, divergenceReport))
        {
            return true;
        }

        if (!ApplyFlightPlanSegment(segment, trackingCommand))
        {
            return BlockFlightPlanLegacyFallback(
                executionState,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "flight plan segment blocked");
        }

        flightPlanExecutorActive = true;
        lastFlightPlanExecutionState = executionState;
        float flightPlanTickSeconds = AutopilotTickSeconds;
        if (ShouldHoldDirectFastTransferSegmentClock(segment, trackingCommand, out string holdStatus, out bool useAuthorityTimeout))
        {
            lastFlightPlanExecutionState.statusLabel = holdStatus;
            if (!useAuthorityTimeout)
            {
                ResetDirectFastTransferMainAuthorityBlock();
            }

            if (useAuthorityTimeout
                && TryTimeoutDirectFastTransferMainAuthorityBlock(segment, ref executionState, flightPlanTickSeconds))
            {
                return true;
            }
        }
        else
        {
            ResetDirectFastTransferMainAuthorityBlock();
            flightPlanElapsedSeconds += flightPlanTickSeconds;
        }

        return true;
    }

    private PrototypeFlightPlanExecutionState BuildFlightPlanExecutionState(PrototypeFlightPlan plan, float elapsedSeconds)
    {
        return PrototypeFlightPlanExecutionState.FromPlan(
            plan,
            elapsedSeconds,
            shipRigidbody != null ? shipRigidbody.worldCenterOfMass : Vector3.zero,
            shipRigidbody != null ? shipRigidbody.linearVelocity : Vector3.zero,
            shipRigidbody != null ? shipRigidbody.rotation : Quaternion.identity,
            shipRigidbody != null ? shipRigidbody.angularVelocity : Vector3.zero,
            shipStats != null ? shipStats.CurrentFuelKg : 0f);
    }

    private PrototypeFlightPlanTrackingCommand BuildFlightPlanTrackingCommand(PrototypeFlightPlan plan)
    {
        float massKg = GetShipMassKg();
        float rcsAcceleration = massKg > 0.0001f ? GetRcsTranslationForceScale() / massKg : 0f;
        PrototypeFlightPlanTrackerSettings settings = BuildRuntimeFlightPlanTrackerSettings(massKg, rcsAcceleration);
        return PrototypeFlightPlanTracker.Track(
            plan,
            flightPlanElapsedSeconds,
            shipRigidbody != null ? shipRigidbody.worldCenterOfMass : Vector3.zero,
            shipRigidbody != null ? shipRigidbody.linearVelocity : Vector3.zero,
            shipRigidbody != null ? shipRigidbody.rotation : Quaternion.identity,
            shipRigidbody != null ? shipRigidbody.angularVelocity : Vector3.zero,
            shipStats != null ? shipStats.CurrentFuelKg : 0f,
            currentTarget != null ? currentTarget.Position : plan.targetPositionWorld,
            GetMaxAcceleration(),
            rcsAcceleration,
            massKg,
            settings);
    }

    private PrototypeFlightPlanTrackerSettings BuildRuntimeFlightPlanTrackerSettings(float massKg, float rcsAcceleration)
    {
        PrototypeFlightPlanTrackerSettings settings = PrototypeFlightPlanTrackerSettings.Default;
        settings.maxTrackingAccelerationMetersPerSecondSquared = Mathf.Max(
            settings.maxTrackingAccelerationMetersPerSecondSquared,
            GetMaxAcceleration() + rcsAcceleration);
        settings.maxRcsAccelerationMetersPerSecondSquared = Mathf.Max(
            settings.maxRcsAccelerationMetersPerSecondSquared,
            rcsAcceleration);
        settings.errorToleranceMultiplier = Mathf.Max(settings.errorToleranceMultiplier, 20f);
        return settings;
    }

    private static void ApplyTrackingErrorToExecutionState(
        PrototypeFlightPlanTrackingCommand trackingCommand,
        ref PrototypeFlightPlanExecutionState executionState)
    {
        if (!trackingCommand.error.hasReferenceSample)
        {
            return;
        }

        executionState.positionErrorMeters = trackingCommand.error.positionErrorMeters;
        executionState.velocityErrorMetersPerSecond = trackingCommand.error.velocityErrorMetersPerSecond;
        executionState.attitudeErrorDegrees = trackingCommand.error.attitudeErrorDegrees;
        executionState.angularVelocityErrorRadiansPerSecond = trackingCommand.error.angularVelocityErrorRadiansPerSecond;
        executionState.fuelErrorKg = trackingCommand.error.fuelErrorKg;
        if (!trackingCommand.requiresReplan)
        {
            const PrototypeFlightPlanAbortReplanReason softTrackingReasons =
                PrototypeFlightPlanAbortReplanReason.PositionDivergence
                | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
                | PrototypeFlightPlanAbortReplanReason.AttitudeDivergence
                | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
            executionState.replanReasons &= ~softTrackingReasons;
            executionState.requiresReplan = executionState.replanReasons != PrototypeFlightPlanAbortReplanReason.None;
            if (!executionState.requiresReplan)
            {
                executionState.statusLabel = trackingCommand.statusLabel;
            }
        }

        executionState.replanReasons |= trackingCommand.replanReasons;
        executionState.requiresReplan = executionState.requiresReplan || trackingCommand.requiresReplan;
        if (trackingCommand.requiresReplan)
        {
            executionState.statusLabel = trackingCommand.statusLabel;
        }
    }

    private bool HandleFlightPlanTrackingReplan(
        PrototypeFlightPlanTrackingCommand trackingCommand,
        PrototypeFlightPlanExecutionState executionState)
    {
        PrototypeFlightPlanAbortReplanReason reasons = trackingCommand.replanReasons != PrototypeFlightPlanAbortReplanReason.None
            ? trackingCommand.replanReasons
            : PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
        var report = new PrototypeFlightPlanDivergenceReport(
            reasons,
            true,
            false,
            "Replan: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons));
        if (IsStrictDirectFastTransferExecutionActive())
        {
            report = new PrototypeFlightPlanDivergenceReport(
                reasons,
                false,
                true,
                "Plan invalidated: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons));
        }

        SetFlightPlanDivergenceReport(report);
        executionState.replanReasons |= reasons;
        executionState.requiresReplan = !IsStrictDirectFastTransferExecutionActive();
        executionState.statusLabel = report.statusLabel;
        lastFlightPlanExecutionState = executionState;

        if (IsStrictDirectFastTransferExecutionActive()
            && ShouldRecoverStrictDirectFastTransferTerminalDivergence(reasons)
            && TryRunDirectFastTransferTerminalCaptureOrReacquire())
        {
            executionState.replanReasons &= ~reasons;
            executionState.requiresReplan = false;
            executionState.statusLabel = directFastTransferTerminalReacquireActive ? "Reacquire" : "Terminal capture";
            lastFlightPlanExecutionState = executionState;
            return true;
        }

        if (!IsImmediateFlightPlanDivergence(reasons) && !IsFlightPlanDivergenceConfirmed(report))
        {
            return false;
        }

        if (IsStrictDirectFastTransferExecutionActive())
        {
            return FailStrictDirectFastTransferExecution(
                executionState,
                reasons,
                "direct fast transfer tracking failed");
        }

        return ForceFlightPlanSafetyReplan(report, "flight plan tracking replan");
    }

    private bool TryHandleDirectFastTransferSoftTrackingCorrection(
        PrototypeManeuverSegment segment,
        ref PrototypeFlightPlanTrackingCommand trackingCommand,
        ref PrototypeFlightPlanExecutionState executionState)
    {
        PrototypeFlightPlanAbortReplanReason reasons = executionState.replanReasons | trackingCommand.replanReasons;
        if (!IsDirectFastTransferSoftTrackingOnly(segment, reasons))
        {
            return false;
        }

        var report = new PrototypeFlightPlanDivergenceReport(
            reasons,
            false,
            false,
            "Tracking correction: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons));
        SetFlightPlanDivergenceReport(report);

        executionState.replanReasons &= ~DirectFastTransferNominalExecutionReasons;
        executionState.requiresReplan = executionState.replanReasons != PrototypeFlightPlanAbortReplanReason.None;
        executionState.statusLabel = report.statusLabel;
        lastFlightPlanExecutionState = executionState;

        PrototypeFlightPlanTrackingError error = trackingCommand.error;
        error.replanReasons &= ~DirectFastTransferNominalExecutionReasons;
        error.requiresReplan = error.replanReasons != PrototypeFlightPlanAbortReplanReason.None;
        error.statusLabel = report.statusLabel;
        trackingCommand.error = error;
        trackingCommand.replanReasons &= ~DirectFastTransferNominalExecutionReasons;
        trackingCommand.requiresReplan = trackingCommand.replanReasons != PrototypeFlightPlanAbortReplanReason.None
            || trackingCommand.error.requiresReplan;
        trackingCommand.statusLabel = report.statusLabel;
        return true;
    }

    private PrototypeFlightPlanDivergenceReport EvaluateFlightPlanDivergence(
        PrototypeFlightPlan plan,
        PrototypeFlightPlanExecutionState executionState,
        PrototypeObstacleDetectionResult liveObstacle,
        PrototypeManeuverSegment activeSegment,
        bool planExpired)
    {
        bool missingDependency = shipRigidbody == null || shipStats == null || shipController == null || currentTarget == null;
        bool nonFiniteState = !LastMetrics.isFinite
            || (shipRigidbody != null
                && (!IsFinite(shipRigidbody.worldCenterOfMass)
                    || !IsFinite(shipRigidbody.linearVelocity)
                    || !IsFinite(shipRigidbody.angularVelocity)));
        bool segmentNeedsMain = FlightPlanSegmentNeedsMainThrottle(activeSegment);
        bool segmentNeedsRcsTranslation = FlightPlanSegmentNeedsRcsTranslation(activeSegment);
        bool segmentNeedsRcsAttitude = FlightPlanSegmentNeedsRcsAttitude(activeSegment);
        bool noMainAuthority = segmentNeedsMain && !CanUseMainThrottle();
        bool noRcsAuthority = (segmentNeedsRcsTranslation && !CanUseRcsTranslation()) || (segmentNeedsRcsAttitude && !CanUseRcsAttitude());
        bool actuatorLimited = noMainAuthority || noRcsAuthority;
        bool fuelStarved = shipStats != null
            && !shipStats.HasFuel
            && segmentNeedsMain
            && activeSegment.mainThrottle > 0.01f;
        bool unplannedObstacle = liveObstacle.detected && !LastTrajectoryPlan.RequiresAvoidance;
        float targetMoveTolerance = Mathf.Max(0.75f, plan.targetArrivalRadiusMeters * 0.25f);
        PrototypeFlightPlanDivergenceReport report = PrototypeFlightPlanDivergenceMonitor.Evaluate(
            plan,
            executionState,
            currentTarget != null ? currentTarget.Position : plan.targetPositionWorld,
            unplannedObstacle,
            unplannedObstacle || (LastTrajectoryPlan.directPathBlocked && !LastTrajectoryPlan.RequiresAvoidance),
            missingDependency,
            nonFiniteState,
            fuelStarved,
            actuatorLimited,
            noMainAuthority,
            noRcsAuthority,
            planExpired,
            targetMoveTolerance);
        if (ShouldFlagFlightPlanBrakeTimingDivergence(activeSegment))
        {
            PrototypeFlightPlanAbortReplanReason reasons =
                report.reasons | PrototypeFlightPlanAbortReplanReason.VelocityDivergence;
            report = new PrototypeFlightPlanDivergenceReport(
                reasons,
                !report.requiresAbort,
                report.requiresAbort,
                (report.requiresAbort ? "Abort: " : "Replan: ")
                    + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons));
        }

        return report;
    }

    private bool TryHandleFlightPlanDivergence(
        PrototypeFlightPlan plan,
        PrototypeFlightPlanExecutionState executionState,
        PrototypeFlightPlanDivergenceReport report)
    {
        if (IsStrictDirectFastTransferPlan(plan) && report.HasDivergence)
        {
            if (IsDirectFastTransferNominalExecutionOnly(report.reasons))
            {
                var correctionReport = new PrototypeFlightPlanDivergenceReport(
                    report.reasons,
                    false,
                    false,
                    "Tracking correction: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(report.reasons));
                SetFlightPlanDivergenceReport(correctionReport);
                executionState.replanReasons &= ~DirectFastTransferNominalExecutionReasons;
                executionState.requiresReplan = false;
                executionState.statusLabel = correctionReport.statusLabel;
                lastFlightPlanExecutionState = executionState;
                return false;
            }

            if (report.reasons == PrototypeFlightPlanAbortReplanReason.PlanExpired
                && TryRunDirectFastTransferTerminalCaptureOrReacquire())
            {
                ClearFlightPlanDivergenceReportNow();
                return true;
            }

            if (ShouldRecoverStrictDirectFastTransferTerminalDivergence(report.reasons)
                && TryRunDirectFastTransferTerminalCaptureOrReacquire())
            {
                ClearFlightPlanDivergenceReportNow();
                executionState.replanReasons &= ~report.reasons;
                executionState.requiresReplan = false;
                executionState.statusLabel = directFastTransferTerminalReacquireActive ? "Reacquire" : "Terminal capture";
                lastFlightPlanExecutionState = executionState;
                return true;
            }

            var invalidatedReport = new PrototypeFlightPlanDivergenceReport(
                report.reasons,
                false,
                true,
                "Plan invalidated: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(report.reasons));
            SetFlightPlanDivergenceReport(invalidatedReport);
            executionState.replanReasons |= report.reasons;
            executionState.requiresReplan = false;
            executionState.statusLabel = invalidatedReport.statusLabel;
            lastFlightPlanExecutionState = executionState;
            if (!IsImmediateFlightPlanDivergence(report.reasons)
                && !IsFlightPlanDivergenceConfirmed(invalidatedReport))
            {
                return false;
            }

            return FailStrictDirectFastTransferExecution(
                executionState,
                report.reasons,
                "direct fast transfer failed");
        }

        SetFlightPlanDivergenceReport(report);
        if (report.HasDivergence)
        {
            executionState.replanReasons |= report.reasons;
            executionState.requiresReplan = report.RequiresAction;
            executionState.statusLabel = report.statusLabel;
            lastFlightPlanExecutionState = executionState;
        }

        if (!report.RequiresAction)
        {
            return false;
        }

        if (report.requiresAbort)
        {
            if (!IsFlightPlanDivergenceConfirmed(report))
            {
                return false;
            }

            PrototypeFlightPlanDivergenceReport abortReport = report;
            Abort("flight plan abort: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(report.reasons));
            lastFlightPlanDivergenceReport = abortReport;
            lastFlightPlanDivergenceAtTime = Time.time;
            return true;
        }

        if (ShouldUseFlightPlanTerminalSafetyForDivergence(report.reasons)
            && TryRunFlightPlanTerminalSafety())
        {
            return true;
        }

        if (!IsImmediateFlightPlanDivergence(report.reasons)
            && report.reasons == PrototypeFlightPlanAbortReplanReason.PlanExpired)
        {
            return false;
        }

        if (!IsFlightPlanDivergenceConfirmed(report))
        {
            return false;
        }

        return ForceFlightPlanSafetyReplan(report, "flight plan replan");
    }

    private bool ForceFlightPlanSafetyReplan(PrototypeFlightPlanDivergenceReport report, string status)
    {
        if (CurrentFlightPlan.IsDirectFastTransfer)
        {
            ResetDirectFastTransferTerminalOwnership();
        }

        bool bypassCooldown = (report.reasons
            & (PrototypeFlightPlanAbortReplanReason.PlanExpired
                | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
                | PrototypeFlightPlanAbortReplanReason.TargetMoved
                | PrototypeFlightPlanAbortReplanReason.ObstacleDetected
                | PrototypeFlightPlanAbortReplanReason.CollisionPredicted)) != 0;
        if (!bypassCooldown && Time.time < lastFlightPlanSafetyReplanAtTime + FlightPlanDivergenceReplanCooldownSeconds)
        {
            if (ShouldClearActuatorOutputForSafetyReplan(report.reasons))
            {
                ClearFlightPlanActuatorOutput(status + " cooldown");
            }
            else
            {
                HoldFlightPlanActuatorOutputForReplan(status + " cooldown");
            }

            return true;
        }

        lastFlightPlanSafetyReplanAtTime = Time.time;
        flightPlanSafetyReplanCount++;
        arrivalFailureReason = "FlightPlanReplan:" + PrototypeFlightPlanDivergenceMonitor.FormatReasons(report.reasons);
        if (ShouldClearActuatorOutputForSafetyReplan(report.reasons))
        {
            ClearFlightPlanActuatorOutput(status);
        }
        else
        {
            HoldFlightPlanActuatorOutputForReplan(status);
        }

        forceNextFlightPlanRevision = true;
        MarkNavigationPlanDirty();
        RefreshNavigationPlan();
        flightPlanExecutorActive = false;
        return true;
    }

    private bool FailStrictDirectFastTransferExecution(
        PrototypeFlightPlanExecutionState executionState,
        PrototypeFlightPlanAbortReplanReason reasons,
        string status)
    {
        if (reasons == PrototypeFlightPlanAbortReplanReason.None)
        {
            reasons = PrototypeFlightPlanAbortReplanReason.NonExecutable;
        }

        string reasonLabel = PrototypeFlightPlanDivergenceMonitor.FormatReasons(reasons);
        var report = new PrototypeFlightPlanDivergenceReport(
            reasons,
            false,
            true,
            "Plan invalidated: " + reasonLabel);
        SetFlightPlanDivergenceReport(report);
        executionState.replanReasons |= reasons;
        executionState.requiresReplan = false;
        executionState.statusLabel = report.statusLabel;
        lastFlightPlanExecutionState = executionState;

        arrivalFailureReason = "FlightPlanInvalidated:" + reasonLabel;
        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
        flightPlanExecutorActive = false;
        ResetDirectFastTransferMainThrottleLatch();
        ResetDirectFastTransferTerminalOwnership();
        if (shipController != null)
        {
            shipController.SetMainThrottle(0f);
            shipController.ClearExternalFlightAssistRequest();
            shipController.SetSasMode(SasControlMode.KillRotation);
        }

        SetState(PrototypeWaypointAutopilotState.Failed, string.IsNullOrWhiteSpace(status) ? "direct fast transfer failed" : status);
        autopilotEngaged = false;
        return true;
    }

    private void ClearFlightPlanDivergenceReportNow()
    {
        flightPlanDivergenceStartedAtTime = -1f;
        lastFlightPlanDivergenceReport = PrototypeFlightPlanDivergenceReport.Clear;
        lastFlightPlanDivergenceAtTime = -1000f;
    }

    private void SetFlightPlanDivergenceReport(PrototypeFlightPlanDivergenceReport report)
    {
        if (!report.HasDivergence)
        {
            flightPlanDivergenceStartedAtTime = -1f;
            if (!IsFlightPlanDivergenceStatusVisible())
            {
                lastFlightPlanDivergenceReport = PrototypeFlightPlanDivergenceReport.Clear;
            }

            return;
        }

        if (report.reasons != lastFlightPlanDivergenceReport.reasons)
        {
            flightPlanDivergenceStartedAtTime = Time.time;
        }

        lastFlightPlanDivergenceReport = report;
        lastFlightPlanDivergenceAtTime = Time.time;

        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.warningStatus = report.statusLabel;
        updatedPlan.status = report.requiresAbort
            ? "flight plan abort"
            : report.requiresReplan
                ? "flight plan replan"
                : "flight plan tracking";
        updatedPlan.statusLabel = report.statusLabel;
        LastTrajectoryPlan = updatedPlan;
    }

    private bool IsFlightPlanDivergenceStatusVisible()
    {
        return lastFlightPlanDivergenceReport.HasDivergence
            && Time.time <= lastFlightPlanDivergenceAtTime + FlightPlanDivergenceStatusHoldSeconds;
    }

    private bool IsFlightPlanDivergenceConfirmed(PrototypeFlightPlanDivergenceReport report)
    {
        if (IsImmediateFlightPlanDivergence(report.reasons))
        {
            return true;
        }

        if (flightPlanDivergenceStartedAtTime < 0f)
        {
            flightPlanDivergenceStartedAtTime = Time.time;
        }

        return Time.time >= flightPlanDivergenceStartedAtTime + FlightPlanDivergenceConfirmSeconds;
    }

    private static bool IsImmediateFlightPlanDivergence(PrototypeFlightPlanAbortReplanReason reasons)
    {
        const PrototypeFlightPlanAbortReplanReason immediateReasons =
            PrototypeFlightPlanAbortReplanReason.MissingDependency
            | PrototypeFlightPlanAbortReplanReason.NonFiniteState
            | PrototypeFlightPlanAbortReplanReason.TargetMoved
            | PrototypeFlightPlanAbortReplanReason.ObstacleDetected
            | PrototypeFlightPlanAbortReplanReason.CollisionPredicted
            | PrototypeFlightPlanAbortReplanReason.FuelStarved
            | PrototypeFlightPlanAbortReplanReason.ActuatorLimited
            | PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority
            | PrototypeFlightPlanAbortReplanReason.NoRcsAuthority
            | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
            | PrototypeFlightPlanAbortReplanReason.PlanUnstable
            | PrototypeFlightPlanAbortReplanReason.PlanExpired
            | PrototypeFlightPlanAbortReplanReason.NonExecutable;
        return (reasons & immediateReasons) != 0;
    }

    private static bool ShouldUseFlightPlanTerminalSafetyForDivergence(PrototypeFlightPlanAbortReplanReason reasons)
    {
        const PrototypeFlightPlanAbortReplanReason terminalSafetyReasons =
            PrototypeFlightPlanAbortReplanReason.PositionDivergence
            | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
            | PrototypeFlightPlanAbortReplanReason.AttitudeDivergence
            | PrototypeFlightPlanAbortReplanReason.TimeSlip
            | PrototypeFlightPlanAbortReplanReason.PlanExpired;
        return (reasons & terminalSafetyReasons) != 0;
    }

    private PrototypeObstacleDetectionResult DetectFlightPlanObstacle(PrototypeFlightPlan plan)
    {
        if (obstacleDetector == null || shipRigidbody == null || currentTarget == null)
        {
            return PrototypeObstacleDetectionResult.Clear(GetObstacleClearanceRadius());
        }

        return obstacleDetector.DetectDirectPath(shipRigidbody, currentTarget.Position, GetObstacleClearanceRadius());
    }

    private static bool FlightPlanSegmentNeedsMainThrottle(PrototypeManeuverSegment segment)
    {
        return segment.mainThrottle > 0.01f
            || segment.commandMode == PrototypeManeuverCommandMode.MainThrottle
            || segment.commandMode == PrototypeManeuverCommandMode.CombinedMainAndRcs;
    }

    private static bool FlightPlanSegmentNeedsRcsTranslation(PrototypeManeuverSegment segment)
    {
        return segment.rcsTranslationScale > 0.01f
            || segment.commandMode == PrototypeManeuverCommandMode.RcsTranslation
            || segment.commandMode == PrototypeManeuverCommandMode.CombinedMainAndRcs
            || segment.phase == PrototypeManeuverPhase.LateralCorrection
            || segment.phase == PrototypeManeuverPhase.FinalApproach
            || segment.phase == PrototypeManeuverPhase.Hold;
    }

    private static bool FlightPlanSegmentNeedsRcsAttitude(PrototypeManeuverSegment segment)
    {
        return segment.commandMode == PrototypeManeuverCommandMode.AttitudeOnly
            || segment.commandMode == PrototypeManeuverCommandMode.RcsAttitude
            || segment.phase == PrototypeManeuverPhase.AlignForBurn
            || segment.phase == PrototypeManeuverPhase.FlipToRetrograde;
    }

    private bool ShouldFlagFlightPlanBrakeTimingDivergence(PrototypeManeuverSegment segment)
    {
        if (IsDirectFastTransferSegment(segment))
        {
            return false;
        }

        if (!ShouldUseConservativeFlightPlanBrakeSafety())
        {
            return false;
        }

        return segment.phase != PrototypeManeuverPhase.FlipToRetrograde
            && segment.phase != PrototypeManeuverPhase.RetrogradeBurn;
    }

    private bool ShouldUseConservativeFlightPlanBrakeSafety()
    {
        if (shipRigidbody == null || LastMetrics.closingSpeed <= BrakeDirectionMinimumSpeedMetersPerSecond)
        {
            return false;
        }

        if (LastMetrics.shouldBrake)
        {
            return true;
        }

        float conservativeDeceleration = GetMaxDeceleration() * 0.45f;
        if (conservativeDeceleration <= 0.0001f)
        {
            return false;
        }

        float relativeSpeed = Mathf.Max(0f, LastMetrics.relativeSpeed);
        float stoppingDistance = (relativeSpeed * relativeSpeed) / (2f * conservativeDeceleration);
        float alignmentLead = EstimateAlignmentLeadDistance(
            shipRigidbody.linearVelocity,
            Mathf.Max(0f, LastMetrics.closingSpeed));
        float captureBuffer = GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters * 2f;
        return stoppingDistance + alignmentLead + captureBuffer >= LastMetrics.distance;
    }

    private void ClearFlightPlanActuatorOutput(string status)
    {
        requestedMainThrottle = 0f;
        requestedRcsTranslation = Vector3.zero;
        desiredBurnDirection = Vector3.zero;
        flightPlanExecutorActive = false;
        ResetDirectFastTransferMainThrottleLatch();
        navigationPhaseV2 = LastTrajectoryPlan.RequiresAvoidance
            ? PrototypeWaypointAutopilotNavigationPhase.Avoiding
            : PrototypeWaypointAutopilotNavigationPhase.Direct;
        SetState(PrototypeWaypointAutopilotState.AlignForBurn, status);
        if (shipController == null)
        {
            return;
        }

        shipController.SetMainThrottle(0f);
        shipController.SetSasMode(SasControlMode.KillRotation);
        shipController.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            Vector3.zero,
            Vector3.zero,
            0f,
            false));
    }

    private void HoldFlightPlanActuatorOutputForReplan(string status)
    {
        flightPlanExecutorActive = false;
        navigationPhaseV2 = LastTrajectoryPlan.RequiresAvoidance
            ? PrototypeWaypointAutopilotNavigationPhase.Avoiding
            : PrototypeWaypointAutopilotNavigationPhase.Direct;
        SetState(PrototypeWaypointAutopilotState.AlignForBurn, status);
    }

    private static bool ShouldClearActuatorOutputForSafetyReplan(PrototypeFlightPlanAbortReplanReason reasons)
    {
        const PrototypeFlightPlanAbortReplanReason clearReasons =
            PrototypeFlightPlanAbortReplanReason.MissingDependency
            | PrototypeFlightPlanAbortReplanReason.NonFiniteState
            | PrototypeFlightPlanAbortReplanReason.FuelStarved
            | PrototypeFlightPlanAbortReplanReason.ActuatorLimited
            | PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority
            | PrototypeFlightPlanAbortReplanReason.NoRcsAuthority;
        return (reasons & clearReasons) != 0;
    }

    private bool TryBlockLegacyLiveGatesForActiveFlightPlan()
    {
        if (!ShouldUseFlightPlanAsPrimaryAuthority())
        {
            return false;
        }

        if (!LastMetrics.isFinite)
        {
            SetState(PrototypeWaypointAutopilotState.Failed, "non-finite metrics");
            arrivalFailureReason = "non-finite metrics";
            ClearCommands();
            autopilotEngaged = false;
            return true;
        }

        PrototypeFlightPlan plan = CurrentFlightPlan;
        PrototypeFlightPlanExecutionState state = BuildFlightPlanExecutionState(plan, flightPlanElapsedSeconds);
        if (IsStrictDirectFastTransferExecutionActive())
        {
            return FailStrictDirectFastTransferExecution(
                state,
                PrototypeFlightPlanAbortReplanReason.NonExecutable,
                "direct fast transfer legacy fallback blocked");
        }

        return BlockFlightPlanLegacyFallback(
            state,
            PrototypeFlightPlanAbortReplanReason.NonExecutable,
            "flight plan legacy blocked");
    }

    private bool BlockFlightPlanLegacyFallback(
        PrototypeFlightPlanExecutionState executionState,
        PrototypeFlightPlanAbortReplanReason reason,
        string status)
    {
        PrototypeFlightPlanDivergenceReport report = new PrototypeFlightPlanDivergenceReport(
            reason,
            true,
            false,
            "Replan: " + PrototypeFlightPlanDivergenceMonitor.FormatReasons(reason));
        SetFlightPlanDivergenceReport(report);
        executionState.replanReasons |= reason;
        executionState.requiresReplan = true;
        executionState.statusLabel = report.statusLabel;
        lastFlightPlanExecutionState = executionState;
        return ForceFlightPlanSafetyReplan(report, status);
    }

    private bool IsVisibleLegacySafetyFallbackActive()
    {
        if (IsAvoidancePlanActive())
        {
            return true;
        }

        return hasStableAvoidance && Time.time <= avoidanceHoldExpireTime + avoidReacquireTimeoutSeconds;
    }

    private bool ShouldUseFlightPlanAsPrimaryAuthority()
    {
        if (strictFlightPlanExecution)
        {
            return useFlightPlanExecutor
                && autopilotEngaged;
        }

        return useFlightPlanExecutor
            && CurrentFlightPlan.IsValid
            && !IsVisibleLegacySafetyFallbackActive();
    }

    private bool TryRunExpiredFlightPlanTerminalHold()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseRcsTranslation())
        {
            return false;
        }

        if (!ShouldSettleFlightPlanBrakeSegment() && !ShouldCaptureAnyArrivalHold())
        {
            return false;
        }

        arrivalTerminalCaptureActive = true;
        return TryEnterHoldPosition();
    }

    private bool TryRunFlightPlanTerminalSafety()
    {
        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        if (IsStrictDirectFastTransferExecutionActive())
        {
            return TryRunDirectFastTransferTerminalCaptureOrReacquire();
        }

        if (TryRunExpiredFlightPlanTerminalHold())
        {
            return true;
        }

        if (arrivalBrakeCommitted
            && !IsWithinArrivalTerminalCaptureRange()
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier)
        {
            ReleaseBrakeHold();
            arrivalBrakeCommitted = false;
            arrivalTerminalCaptureActive = false;
            return false;
        }

        bool shouldUseSafetyBrakeRange = ShouldUseConservativeFlightPlanBrakeSafety();
        if (!arrivalBrakeCommitted && !IsWithinArrivalTerminalCaptureRange() && !shouldUseSafetyBrakeRange)
        {
            return false;
        }

        arrivalTerminalCaptureActive = arrivalTerminalCaptureActive || IsWithinArrivalTerminalCaptureRange();
        if (ShouldUseTerminalLateralCorrection())
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "flight plan expired lateral");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
            return true;
        }

        if (arrivalBrakeCommitted || shouldUseSafetyBrakeRange || ShouldUseTerminalVelocityBrake() || ShouldRequestBrake())
        {
            ApplyBrakeRequest();
            return true;
        }

        return false;
    }

    private bool TryRunDirectFastTransferTerminalCaptureOrReacquire()
    {
        if (!IsStrictDirectFastTransferExecutionActive() || currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        ClearFlightPlanDivergenceReportNow();
        arrivalFailureReason = string.Empty;

        if (arrivalTerminalCaptureActive
            && LastMetrics.distance <= GetArrivalTerminalRangeDistance() + BrakeArrivalHoldDistanceMarginMeters * 2f
            && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed)
        {
            directFastTransferTerminalCaptureActive = true;
            directFastTransferTerminalReacquireActive = false;
            directFastTransferTerminalReacquireStartedAtTime = -1f;
            if (ShouldCaptureAnyArrivalHold() || IsInArrivalCompletionWindow())
            {
                SetDirectFastTransferExecutionStatus("flight plan terminal capture", "Terminal capture");
                return TryEnterHoldPosition();
            }

            SetState(PrototypeWaypointAutopilotState.FinalApproach, "Terminal capture");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.FinalApproach;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            ApplyHoldDamping();
            SetDirectFastTransferExecutionStatus("flight plan terminal capture", "Terminal capture");
            return true;
        }

        if (IsWithinArrivalTerminalCaptureRange())
        {
            directFastTransferTerminalCaptureActive = true;
            arrivalTerminalCaptureActive = true;
            directFastTransferTerminalReacquireActive = false;
            directFastTransferTerminalReacquireStartedAtTime = -1f;
            float terminalBrakeSpeedLimit = GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier;
            if (!ShouldCaptureAnyArrivalHold()
                && !IsInArrivalCompletionWindow()
                && LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed
                && LastMetrics.relativeSpeed > terminalBrakeSpeedLimit)
            {
                ApplyDirectFastTransferTerminalBrake();
                return true;
            }

            directFastTransferBrakeCommitted = false;
            if (ShouldCaptureAnyArrivalHold() || IsInArrivalCompletionWindow())
            {
                SetDirectFastTransferExecutionStatus("flight plan terminal capture", "Terminal capture");
                return TryEnterHoldPosition();
            }

            SetState(PrototypeWaypointAutopilotState.FinalApproach, "Terminal capture");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.FinalApproach;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            if (ShouldUseTerminalLateralCorrection())
            {
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
                ApplyLateralCorrection();
            }
            else
            {
                ApplyHoldDamping();
            }

            SetDirectFastTransferExecutionStatus("flight plan terminal capture", "Terminal capture");
            return true;
        }

        directFastTransferTerminalCaptureActive = false;
        directFastTransferBrakeCommitted = false;
        if (!directFastTransferTerminalReacquireActive)
        {
            directFastTransferTerminalReacquireStartedAtTime = autopilotElapsedSeconds;
        }

        directFastTransferTerminalReacquireActive = true;
        arrivalTerminalCaptureActive = false;
        ReleaseBrakeHold();
        if (ShouldFailDirectFastTransferTerminalReacquire())
        {
            PrototypeFlightPlanExecutionState state = BuildFlightPlanExecutionState(CurrentFlightPlan, flightPlanElapsedSeconds);
            return FailStrictDirectFastTransferExecution(
                state,
                PrototypeFlightPlanAbortReplanReason.TimeSlip,
                "direct fast transfer terminal reacquire timeout");
        }

        ApplyDirectFastTransferTerminalReacquire();
        return true;
    }

    private void ApplyDirectFastTransferTerminalReacquire()
    {
        Vector3 direction = LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? LastMetrics.directionToTarget.normalized
            : transform.forward;
        SetState(PrototypeWaypointAutopilotState.Accelerate, "Reacquire");
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
        arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
        limitedFinalApproachCapability = false;
        arrivalFailureReason = string.Empty;
        float reacquireSpeedLimit = GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier;
        float reacquireCruiseSpeed = Mathf.Max(reacquireSpeedLimit * 1.75f, arrivalSpeedMetersPerSecond * 6f);
        float reacquireThrottle = LastMetrics.closingSpeed < reacquireCruiseSpeed * 0.75f
            && LastMetrics.relativeSpeed < reacquireCruiseSpeed * 0.95f
                ? 0.65f
                : 0f;
        ApplyAutopilotRequest(direction, reacquireThrottle, false, null, Vector3.zero, true);
        SetDirectFastTransferExecutionStatus("flight plan reacquire", "Reacquire");
    }

    private bool ShouldFailDirectFastTransferTerminalReacquire()
    {
        if (!directFastTransferTerminalReacquireActive
            || directFastTransferTerminalReacquireStartedAtTime < 0f)
        {
            return false;
        }

        if (LastMetrics.distance <= GetArrivalTerminalRangeDistance() + BrakeArrivalHoldDistanceMarginMeters)
        {
            return false;
        }

        return autopilotElapsedSeconds >= directFastTransferTerminalReacquireStartedAtTime + DirectFastTransferTerminalReacquireTimeoutSeconds;
    }

    private void ApplyDirectFastTransferTerminalBrake()
    {
        directFastTransferBrakeCommitted = true;
        directFastTransferTerminalReacquireActive = false;
        directFastTransferTerminalReacquireStartedAtTime = -1f;
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Brake;
        arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
        limitedFinalApproachCapability = false;
        arrivalFailureReason = string.Empty;
        Vector3 brakeDirection = ResolveBrakeDirection();
        if (shipRigidbody != null
            && shipRigidbody.linearVelocity.sqrMagnitude > BrakeDirectionMinimumSpeedMetersPerSecond * BrakeDirectionMinimumSpeedMetersPerSecond
            && Vector3.Dot(brakeDirection.normalized, shipRigidbody.linearVelocity.normalized) > 0.15f)
        {
            committedBrakeDirection = -shipRigidbody.linearVelocity.normalized;
            brakeDirection = committedBrakeDirection;
        }

        float angle = Vector3.Angle(transform.forward, brakeDirection);
        float angularSpeed = GetAngularSpeedRadiansPerSecond();
        bool brakeAlignmentReady = UpdateBrakeAlignmentLock(angle, angularSpeed);
        SetState(brakeAlignmentReady ? PrototypeWaypointAutopilotState.Brake : PrototypeWaypointAutopilotState.FlipForBrake, "Terminal capture");
        if (!brakeAlignmentReady)
        {
            brakeMainThrottleAlignmentLocked = false;
        }

        ApplyAutopilotRequest(brakeDirection, 1f, false, brakeAlignmentReady);
        SetDirectFastTransferExecutionStatus("flight plan terminal capture", "Terminal capture");
    }

    private void SetDirectFastTransferExecutionStatus(string status, string statusLabel)
    {
        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.status = status;
        updatedPlan.statusLabel = statusLabel;
        if (string.Equals(updatedPlan.warningStatus, "Replan: none", System.StringComparison.Ordinal)
            || (updatedPlan.warningStatus != null && updatedPlan.warningStatus.StartsWith("Replan:", System.StringComparison.Ordinal)))
        {
            updatedPlan.warningStatus = string.Empty;
        }

        LastTrajectoryPlan = updatedPlan;
    }

    private void TrackActiveFlightPlan(PrototypeFlightPlan plan)
    {
        if (activeFlightPlanRevision >= 0 && activeFlightPlanRevision == plan.revision)
        {
            return;
        }

        activeFlightPlanId = plan.planId;
        activeFlightPlanRevision = plan.revision;
        flightPlanElapsedSeconds = 0f;
        lastFlightPlanExecutionState = default;
        lastFlightPlanTrackingCommand = default;
        lastFlightPlanDivergenceReport = PrototypeFlightPlanDivergenceReport.Clear;
        flightPlanDivergenceStartedAtTime = -1f;
        lastFlightPlanDivergenceAtTime = -1000f;
        if (arrivalFailureReason.StartsWith("FlightPlanReplan", System.StringComparison.Ordinal))
        {
            arrivalFailureReason = string.Empty;
        }

        ResetDirectFastTransferTerminalOwnership();
        ResetDirectFastTransferMainAuthorityBlock();
    }

    private void ResetFlightPlanExecutorClock()
    {
        activeFlightPlanId = string.Empty;
        activeFlightPlanRevision = -1;
        flightPlanElapsedSeconds = 0f;
        flightPlanExecutorActive = false;
        lastFlightPlanExecutionState = default;
        lastFlightPlanTrackingCommand = default;
        lastFlightPlanDivergenceReport = PrototypeFlightPlanDivergenceReport.Clear;
        flightPlanDivergenceStartedAtTime = -1f;
        lastFlightPlanDivergenceAtTime = -1000f;
        ResetDirectFastTransferTerminalOwnership();
        ResetDirectFastTransferMainAuthorityBlock();
    }

    private void ResetDirectFastTransferTerminalOwnership()
    {
        directFastTransferBrakeCommitted = false;
        directFastTransferTerminalCaptureActive = false;
        directFastTransferTerminalReacquireActive = false;
        directFastTransferTerminalReacquireStartedAtTime = -1f;
    }

    private bool ShouldDeferFlightPlanExecutorToLegacyFallback()
    {
        if (ShouldDeferTerminalNoRcsFlightPlanToLegacyFallback())
        {
            return true;
        }

        if (strictFlightPlanExecution)
        {
            return false;
        }

        bool currentlyAvoiding = IsAvoidancePlanActive();
        if (currentlyAvoiding)
        {
            navigationPhaseV2 = LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.AvoidancePlanning
                ? PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                : PrototypeWaypointAutopilotNavigationPhase.Avoiding;
            return true;
        }

        if (!currentlyAvoiding
            && hasStableAvoidance
            && Time.time <= avoidanceHoldExpireTime + avoidReacquireTimeoutSeconds)
        {
            if (navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Direct)
            {
                navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Avoiding;
            }

            return true;
        }

        return false;
    }

    private bool ShouldDeferTerminalNoRcsFlightPlanToLegacyFallback()
    {
        if (!HasTerminalNoRcsFlightPlanLimitation())
        {
            return false;
        }

        if (activeFlightPlanRevision == CurrentFlightPlan.revision
            && flightPlanElapsedSeconds > AutopilotTickSeconds * 2f)
        {
            return false;
        }

        return true;
    }

    private bool HasTerminalNoRcsFlightPlanLimitation()
    {
        return !CanUseRcsTranslation()
            && IsWithinArrivalTerminalCaptureRange()
            && IsTerminalOnlyFlightPlan(CurrentFlightPlan);
    }

    private static bool IsTerminalOnlyFlightPlan(PrototypeFlightPlan plan)
    {
        if (!plan.IsValid || !plan.HasSegments)
        {
            return false;
        }

        for (int i = 0; i < plan.segments.Length; i++)
        {
            PrototypeManeuverPhase phase = plan.segments[i].phase;
            if (phase != PrototypeManeuverPhase.FinalApproach
                && phase != PrototypeManeuverPhase.Hold)
            {
                return false;
            }
        }

        return true;
    }

    private bool ApplyFlightPlanSegment(PrototypeManeuverSegment segment, PrototypeFlightPlanTrackingCommand trackingCommand)
    {
        Vector3 direction = trackingCommand.mainDirectionWorld.sqrMagnitude > 0.0001f
            ? trackingCommand.mainDirectionWorld.normalized
            : ResolveFlightPlanSegmentDirection(segment);
        UpdateFlightPlanSegmentDiagnostics(segment, direction, trackingCommand);
        if (ShouldSuppressFlightPlanTransferBurnInTerminalCapture(segment))
        {
            if (ShouldSettleFlightPlanBrakeSegment() || ShouldCaptureAnyArrivalHold())
            {
                return TryEnterHoldPosition();
            }

            SetState(PrototypeWaypointAutopilotState.FinalApproach, "flight plan terminal capture");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
            return true;
        }

        if (ShouldRedirectFlightPlanBrakeToTerminalRcs(segment))
        {
            if (ShouldCaptureAnyArrivalHold())
            {
                return TryEnterHoldPosition();
            }

            SetState(PrototypeWaypointAutopilotState.FinalApproach, "flight plan terminal lateral correction");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
            return true;
        }

        switch (segment.phase)
        {
            case PrototypeManeuverPhase.AlignForBurn:
                if (TrySkipCompletedFlightPlanAlignSegment(segment, direction))
                {
                    return true;
                }

                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
                bool alignReacquireWindow = reacquireDirectPathUntilTime > 0f && Time.time <= reacquireDirectPathUntilTime;
                navigationPhaseV2 = LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.ReacquireDirectPath
                    || alignReacquireWindow
                    ? PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath
                    : LastTrajectoryPlan.RequiresAvoidance
                        ? PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                        : PrototypeWaypointAutopilotNavigationPhase.Direct;
                if (LastTrajectoryPlan.RequiresAvoidance)
                {
                    hasStableAvoidance = true;
                    stableAvoidanceDirection = direction;
                    stableAvoidanceWaypoint = LastTrajectoryPlan.avoidanceWaypoint.sqrMagnitude > 0.0001f
                        ? LastTrajectoryPlan.avoidanceWaypoint
                        : segment.expectedEndPosition;
                    avoidanceHoldExpireTime = Time.time + Mathf.Max(0f, avoidanceLockSeconds);
                }

                limitedFinalApproachCapability = false;
                arrivalFailureReason = string.Empty;
                SetState(
                    LastTrajectoryPlan.RequiresAvoidance
                        ? PrototypeWaypointAutopilotState.ObstacleAvoidance
                        : PrototypeWaypointAutopilotState.AlignForBurn,
                    LastTrajectoryPlan.RequiresAvoidance ? "flight plan avoidance align" : "flight plan align");
                ApplyAutopilotRequest(
                    direction,
                    0f,
                    false,
                    null,
                    trackingCommand.rcsForceWorld,
                    true);
                return true;

            case PrototypeManeuverPhase.ProgradeBurn:
            case PrototypeManeuverPhase.ReacquireRoute:
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
                bool burnReacquireWindow = reacquireDirectPathUntilTime > 0f && Time.time <= reacquireDirectPathUntilTime;
                navigationPhaseV2 = segment.phase == PrototypeManeuverPhase.ReacquireRoute
                    || LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.ReacquireDirectPath
                    || burnReacquireWindow
                        ? PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath
                        : PrototypeWaypointAutopilotNavigationPhase.Direct;
                limitedFinalApproachCapability = false;
                arrivalFailureReason = string.Empty;
                SetState(PrototypeWaypointAutopilotState.Accelerate, "flight plan burn");
                ApplyAutopilotRequest(
                    direction,
                    trackingCommand.mainThrottle,
                    false,
                    null,
                    trackingCommand.rcsForceWorld,
                    true,
                    IsDirectFastTransferSegment(segment),
                    segment);
                return true;

            case PrototypeManeuverPhase.AvoidanceBurn:
                hasStableAvoidance = true;
                stableAvoidanceDirection = direction;
                stableAvoidanceWaypoint = segment.expectedEndPosition;
                avoidanceHoldExpireTime = Time.time + Mathf.Max(0f, avoidanceLockSeconds);
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
                navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Avoiding;
                limitedFinalApproachCapability = false;
                arrivalFailureReason = string.Empty;
                SetState(PrototypeWaypointAutopilotState.ObstacleAvoidance, "flight plan avoidance");
                ApplyAutopilotRequest(
                    direction,
                    trackingCommand.mainThrottle,
                    false,
                    null,
                    trackingCommand.rcsForceWorld,
                    true,
                    IsDirectFastTransferSegment(segment));
                return true;

            case PrototypeManeuverPhase.Coast:
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn;
                limitedFinalApproachCapability = false;
                arrivalFailureReason = string.Empty;
                SetState(PrototypeWaypointAutopilotState.AlignForBurn, "flight plan coast");
                ApplyAutopilotRequest(
                    direction,
                    0f,
                    false,
                    null,
                    trackingCommand.rcsForceWorld,
                    true);
                return true;

            case PrototypeManeuverPhase.FlipToRetrograde:
                if (TrySkipCompletedFlightPlanBrakeFlipSegment(segment, direction))
                {
                    return true;
                }

                ApplyFlightPlanBrakeSegment(segment, direction, false, trackingCommand);
                return true;

            case PrototypeManeuverPhase.RetrogradeBurn:
                ApplyFlightPlanBrakeSegment(segment, direction, true, trackingCommand);
                return true;

            case PrototypeManeuverPhase.LateralCorrection:
                SetState(PrototypeWaypointAutopilotState.FinalApproach, "flight plan lateral");
                navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
                arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
                limitedFinalApproachCapability = !CanUseRcsTranslation();
                arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
                ApplyAutopilotRequest(
                    direction,
                    0f,
                    true,
                    null,
                    trackingCommand.rcsForceWorld,
                    true);
                return true;

            case PrototypeManeuverPhase.FinalApproach:
                SetState(PrototypeWaypointAutopilotState.FinalApproach, "flight plan final");
                navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
                arrivalPhase = LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond
                    ? PrototypeWaypointAutopilotArrivalPhase.LateralCorrection
                    : PrototypeWaypointAutopilotArrivalPhase.FinalApproach;
                limitedFinalApproachCapability = !CanUseRcsTranslation();
                arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
                if (trackingCommand.mainThrottle <= 0.01f)
                {
                    ApplyAutopilotRequest(
                        direction,
                        0f,
                        true,
                        null,
                        trackingCommand.rcsForceWorld,
                        true);
                }
                else
                {
                    ApplyAutopilotRequest(
                        direction,
                        trackingCommand.mainThrottle,
                        true,
                        null,
                        trackingCommand.rcsForceWorld,
                        true);
                }

                return true;

            case PrototypeManeuverPhase.Hold:
                if (IsStrictDirectFastTransferExecutionActive() && IsDirectFastTransferSegment(segment))
                {
                    return TryRunDirectFastTransferTerminalCaptureOrReacquire();
                }

                return TryEnterHoldPosition();

            default:
                return false;
        }
    }

    private bool TrySkipCompletedFlightPlanAlignSegment(PrototypeManeuverSegment segment, Vector3 direction)
    {
        if (segment.phase != PrototypeManeuverPhase.AlignForBurn
            || !CurrentFlightPlan.IsValid
            || shipRigidbody == null)
        {
            return false;
        }

        float angle = direction.sqrMagnitude > 0.0001f ? Vector3.Angle(transform.forward, direction) : 180f;
        float angularSpeed = GetAngularSpeedRadiansPerSecond();
        float angularSpeedLimit = Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond;
        if (angle > Mathf.Max(2f, alignmentAngleDegrees) || angularSpeed > angularSpeedLimit)
        {
            return false;
        }

        float nextElapsed = Mathf.Max(flightPlanElapsedSeconds, segment.endTimeSeconds + 0.001f);
        if (!CurrentFlightPlan.TryGetActiveSegment(nextElapsed, out PrototypeManeuverSegment nextSegment)
            || nextSegment.index == segment.index)
        {
            return false;
        }

        flightPlanElapsedSeconds = nextElapsed;
        PrototypeFlightPlanTrackingCommand nextCommand = BuildFlightPlanTrackingCommand(CurrentFlightPlan);
        lastFlightPlanTrackingCommand = nextCommand;
        return ApplyFlightPlanSegment(nextSegment, nextCommand);
    }

    private bool TrySkipCompletedFlightPlanBrakeFlipSegment(PrototypeManeuverSegment segment, Vector3 direction)
    {
        if (segment.phase != PrototypeManeuverPhase.FlipToRetrograde
            || !CurrentFlightPlan.IsValid
            || shipRigidbody == null)
        {
            return false;
        }

        float angle = direction.sqrMagnitude > 0.0001f ? Vector3.Angle(transform.forward, direction) : 180f;
        float angularSpeed = GetAngularSpeedRadiansPerSecond();
        if (angle > BrakeMainThrottleRetrogradeAlignmentDegrees
            || !IsBrakeAttitudeRateWithinMainThrottleGate(angularSpeed))
        {
            return false;
        }

        return TryAdvanceToNextFlightPlanSegment(segment);
    }

    private bool TryAdvanceToNextFlightPlanSegment(PrototypeManeuverSegment segment)
    {
        float nextElapsed = Mathf.Max(flightPlanElapsedSeconds, segment.endTimeSeconds + 0.001f);
        if (!CurrentFlightPlan.TryGetActiveSegment(nextElapsed, out PrototypeManeuverSegment nextSegment)
            || nextSegment.index == segment.index)
        {
            return false;
        }

        flightPlanElapsedSeconds = nextElapsed;
        PrototypeFlightPlanTrackingCommand nextCommand = BuildFlightPlanTrackingCommand(CurrentFlightPlan);
        lastFlightPlanTrackingCommand = nextCommand;
        return ApplyFlightPlanSegment(nextSegment, nextCommand);
    }

    private static bool IsDirectFastTransferSegment(PrototypeManeuverSegment segment)
    {
        return segment.profile == PrototypeManeuverProfile.DirectFastTransfer;
    }

    private bool IsStrictDirectFastTransferExecutionActive()
    {
        PrototypeFlightPlan plan = CurrentFlightPlan;
        return autopilotEngaged
            && strictFlightPlanExecution
            && useFlightPlanExecutor
            && plan.IsDirectFastTransfer
            && plan.HasSegments
            && activeFlightPlanRevision == plan.revision;
    }

    private bool IsStrictDirectFastTransferPlan(PrototypeFlightPlan plan)
    {
        return autopilotEngaged
            && strictFlightPlanExecution
            && useFlightPlanExecutor
            && plan.IsDirectFastTransfer
            && plan.HasSegments;
    }

    private static bool IsDirectFastTransferNominalExecutionOnly(PrototypeFlightPlanAbortReplanReason reasons)
    {
        return reasons != PrototypeFlightPlanAbortReplanReason.None
            && (reasons & ~DirectFastTransferNominalExecutionReasons) == PrototypeFlightPlanAbortReplanReason.None;
    }

    private bool ShouldRecoverStrictDirectFastTransferTerminalDivergence(PrototypeFlightPlanAbortReplanReason reasons)
    {
        const PrototypeFlightPlanAbortReplanReason terminalRecoverableReasons =
            PrototypeFlightPlanAbortReplanReason.PlanExpired
            | PrototypeFlightPlanAbortReplanReason.PositionDivergence
            | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
            | PrototypeFlightPlanAbortReplanReason.AttitudeDivergence
            | PrototypeFlightPlanAbortReplanReason.TimeSlip
            | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
        bool hasInvalidPlanDirection = (reasons & PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection) != 0;
        PrototypeFlightPlanAbortReplanReason recoverableMask = hasInvalidPlanDirection
            ? terminalRecoverableReasons | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
            : terminalRecoverableReasons;
        if (reasons == PrototypeFlightPlanAbortReplanReason.None
            || (reasons & ~recoverableMask) != PrototypeFlightPlanAbortReplanReason.None)
        {
            return false;
        }

        if (hasInvalidPlanDirection && !directFastTransferTerminalReacquireActive)
        {
            bool terminalCaptureCanOwnInvalidDirection = IsWithinArrivalTerminalCaptureRange();
            bool brakeSettledCanHandOffToReacquire = directFastTransferBrakeCommitted
                && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed;
            bool slowOvershootCanHandOffToReacquire = LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
                && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier;
            if (!terminalCaptureCanOwnInvalidDirection
                && !brakeSettledCanHandOffToReacquire
                && !slowOvershootCanHandOffToReacquire)
            {
                return false;
            }
        }

        if (directFastTransferBrakeCommitted
            || directFastTransferTerminalCaptureActive
            || directFastTransferTerminalReacquireActive
            || IsWithinArrivalTerminalCaptureRange())
        {
            return true;
        }

        PrototypeFlightPlan plan = CurrentFlightPlan;
        float terminalLeadSeconds = AutopilotTickSeconds * 2f;
        if (plan.IsDirectFastTransfer
            && plan.totalDurationSeconds > 0f
            && flightPlanElapsedSeconds >= plan.totalDurationSeconds - terminalLeadSeconds)
        {
            return true;
        }

        float reacquireSpeedLimit = GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier;
        return LastMetrics.relativeSpeed <= reacquireSpeedLimit;
    }

    private static bool IsDirectFastTransferSoftTrackingOnly(
        PrototypeManeuverSegment segment,
        PrototypeFlightPlanAbortReplanReason reasons)
    {
        return IsDirectFastTransferSegment(segment)
            && IsDirectFastTransferNominalExecutionOnly(reasons);
    }

    private static bool IsDirectFastTransferMainThrottleSegment(PrototypeManeuverSegment segment)
    {
        return IsDirectFastTransferSegment(segment)
            && (segment.phase == PrototypeManeuverPhase.ProgradeBurn
                || segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
    }

    private bool ShouldHoldDirectFastTransferMainSegmentClock(
        PrototypeManeuverSegment segment,
        PrototypeFlightPlanTrackingCommand trackingCommand)
    {
        if (!IsDirectFastTransferSegment(segment)
            || (segment.phase != PrototypeManeuverPhase.ProgradeBurn
                && segment.phase != PrototypeManeuverPhase.RetrogradeBurn))
        {
            return false;
        }

        float plannedThrottle = Mathf.Max(segment.mainThrottle, trackingCommand.mainThrottle);
        if (plannedThrottle <= 0.01f
            || CurrentState == PrototypeWaypointAutopilotState.FinalApproach
            || CurrentState == PrototypeWaypointAutopilotState.HoldPosition)
        {
            return false;
        }

        return requestedMainThrottle <= Mathf.Max(0.01f, plannedThrottle * 0.1f);
    }

    private bool ShouldHoldDirectFastTransferSegmentClock(
        PrototypeManeuverSegment segment,
        PrototypeFlightPlanTrackingCommand trackingCommand,
        out string status,
        out bool useAuthorityTimeout)
    {
        status = string.Empty;
        useAuthorityTimeout = false;
        if (!IsDirectFastTransferSegment(segment))
        {
            return false;
        }

        if (ShouldHoldDirectFastTransferAttitudeSegmentClock(segment, out status))
        {
            return true;
        }

        if (ShouldHoldDirectFastTransferMainSegmentClock(segment, trackingCommand))
        {
            status = GetDirectFastTransferMainHoldStatus(segment);
            useAuthorityTimeout = true;
            return true;
        }

        return false;
    }

    private bool ShouldHoldDirectFastTransferAttitudeSegmentClock(
        PrototypeManeuverSegment segment,
        out string status)
    {
        status = string.Empty;
        bool align = segment.phase == PrototypeManeuverPhase.AlignForBurn;
        bool flip = segment.phase == PrototypeManeuverPhase.FlipToRetrograde;
        if (!align && !flip)
        {
            return false;
        }

        Vector3 direction = ResolveFlightPlanSegmentDirection(segment);
        if (direction.sqrMagnitude <= 0.0001f)
        {
            return false;
        }

        float angle = Vector3.Angle(transform.forward, direction.normalized);
        float angularSpeedDegrees = GetAngularSpeedRadiansPerSecond() * Mathf.Rad2Deg;
        float angleLimit = align
            ? DirectFastTransferBurnLatchEngageDegrees
            : DirectFastTransferBrakeLatchEngageDegrees;
        float angularSpeedLimit = DirectFastTransferMainLatchEngageAngularSpeedDegreesPerSecond;
        bool waiting = angle > angleLimit || angularSpeedDegrees > angularSpeedLimit;
        if (waiting)
        {
            status = align ? "Aligning for planned burn" : "Brake latch waiting";
        }

        return waiting;
    }

    private bool UpdateDirectFastTransferMainThrottleLatch(
        PrototypeManeuverSegment segment,
        float angleDegrees,
        float angularSpeedRadiansPerSecond,
        out string status)
    {
        bool brake = segment.phase == PrototypeManeuverPhase.RetrogradeBurn;
        status = brake ? "Brake latch waiting" : "Aligning for planned burn";
        int planRevision = CurrentFlightPlan.revision;
        if (directFastMainLatchPlanRevision != planRevision
            || directFastMainLatchSegmentIndex != segment.index)
        {
            directFastMainThrottleLatched = false;
            directFastMainLatchPlanRevision = planRevision;
            directFastMainLatchSegmentIndex = segment.index;
        }

        float angularSpeedDegrees = angularSpeedRadiansPerSecond * Mathf.Rad2Deg;
        float engageAngle = brake ? DirectFastTransferBrakeLatchEngageDegrees : DirectFastTransferBurnLatchEngageDegrees;
        float keepAngle = brake ? DirectFastTransferBrakeLatchKeepDegrees : DirectFastTransferBurnLatchKeepDegrees;
        float releaseAngle = brake ? DirectFastTransferBrakeLatchReleaseDegrees : DirectFastTransferBurnLatchReleaseDegrees;
        if (!directFastMainThrottleLatched)
        {
            directFastMainThrottleLatched = angleDegrees <= engageAngle
                && angularSpeedDegrees <= DirectFastTransferMainLatchEngageAngularSpeedDegreesPerSecond;
        }
        else if (angleDegrees > releaseAngle
            || angularSpeedDegrees > DirectFastTransferMainLatchReleaseAngularSpeedDegreesPerSecond)
        {
            directFastMainThrottleLatched = false;
        }

        if (directFastMainThrottleLatched
            && angleDegrees <= keepAngle
            && angularSpeedDegrees <= DirectFastTransferMainLatchKeepAngularSpeedDegreesPerSecond)
        {
            status = brake ? "Full brake" : "Full burn";
            directFastMainThrottleLatchStatus = status;
            return true;
        }

        if (directFastMainThrottleLatched
            && angleDegrees <= releaseAngle
            && angularSpeedDegrees <= DirectFastTransferMainLatchReleaseAngularSpeedDegreesPerSecond)
        {
            status = brake ? "Full brake" : "Full burn";
            directFastMainThrottleLatchStatus = status;
            return true;
        }

        directFastMainThrottleLatchStatus = status;
        return false;
    }

    private string GetDirectFastTransferMainHoldStatus(PrototypeManeuverSegment segment)
    {
        if (!string.IsNullOrEmpty(directFastMainThrottleLatchStatus))
        {
            return directFastMainThrottleLatchStatus;
        }

        return segment.phase == PrototypeManeuverPhase.RetrogradeBurn
            ? "Brake latch waiting"
            : "Aligning for planned burn";
    }

    private bool TryTimeoutDirectFastTransferMainAuthorityBlock(
        PrototypeManeuverSegment segment,
        ref PrototypeFlightPlanExecutionState executionState,
        float deltaSeconds)
    {
        int planRevision = CurrentFlightPlan.revision;
        if (directFastTransferAuthorityBlockedPlanRevision != planRevision
            || directFastTransferAuthorityBlockedSegmentIndex != segment.index)
        {
            directFastTransferAuthorityBlockedPlanRevision = planRevision;
            directFastTransferAuthorityBlockedSegmentIndex = segment.index;
            directFastTransferAuthorityBlockedSeconds = 0f;
        }

        directFastTransferAuthorityBlockedSeconds += Mathf.Max(0f, deltaSeconds);
        if (directFastTransferAuthorityBlockedSeconds < DirectFastTransferMainAuthorityBlockedTimeoutSeconds)
        {
            return false;
        }

        PrototypeFlightPlanAbortReplanReason reason = !CanUseMainThrottle() || !CanUseRcsAttitude()
            ? PrototypeFlightPlanAbortReplanReason.ActuatorLimited
            : PrototypeFlightPlanAbortReplanReason.AttitudeDivergence;
        ResetDirectFastTransferMainAuthorityBlock();
        if (IsStrictDirectFastTransferExecutionActive())
        {
            return FailStrictDirectFastTransferExecution(
                executionState,
                reason,
                "direct fast transfer main authority timeout");
        }

        return BlockFlightPlanLegacyFallback(
            executionState,
            reason,
            "direct fast transfer main authority timeout");
    }

    private void ResetDirectFastTransferMainAuthorityBlock()
    {
        directFastTransferAuthorityBlockedPlanRevision = -1;
        directFastTransferAuthorityBlockedSegmentIndex = -1;
        directFastTransferAuthorityBlockedSeconds = 0f;
    }

    private void ResetDirectFastTransferMainThrottleLatch()
    {
        directFastMainThrottleLatched = false;
        directFastMainLatchPlanRevision = -1;
        directFastMainLatchSegmentIndex = -1;
        directFastMainThrottleLatchStatus = string.Empty;
    }

    private bool ShouldProtectDirectFastTransferBrakeSegmentFromTerminalHold()
    {
        if (!CurrentFlightPlan.IsValid)
        {
            return false;
        }

        return CurrentFlightPlan.TryGetActiveSegment(flightPlanElapsedSeconds, out PrototypeManeuverSegment segment)
            && IsDirectFastTransferBrakeSegment(segment)
            && !IsWithinDirectFastTransferBrakeEndEnvelope(segment);
    }

    private static bool IsDirectFastTransferBrakeSegment(PrototypeManeuverSegment segment)
    {
        return IsDirectFastTransferSegment(segment)
            && (segment.phase == PrototypeManeuverPhase.FlipToRetrograde
                || segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
    }

    private bool IsWithinDirectFastTransferBrakeEndEnvelope(PrototypeManeuverSegment segment)
    {
        float endEnvelopeSeconds = Mathf.Max(AutopilotTickSeconds * 2f, 0.08f);
        return flightPlanElapsedSeconds >= segment.endTimeSeconds - endEnvelopeSeconds;
    }

    private bool ShouldSuppressFlightPlanTransferBurnInTerminalCapture(PrototypeManeuverSegment segment)
    {
        if (!arrivalTerminalCaptureActive || !IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        if (IsDirectFastTransferSegment(segment))
        {
            return false;
        }

        PrototypeManeuverPhase phase = segment.phase;
        return phase == PrototypeManeuverPhase.AlignForBurn
            || phase == PrototypeManeuverPhase.ProgradeBurn
            || phase == PrototypeManeuverPhase.AvoidanceBurn
            || phase == PrototypeManeuverPhase.ReacquireRoute;
    }

    private bool ShouldRedirectFlightPlanBrakeToTerminalRcs(PrototypeManeuverSegment segment)
    {
        PrototypeManeuverPhase phase = segment.phase;
        if (phase != PrototypeManeuverPhase.FlipToRetrograde
            && phase != PrototypeManeuverPhase.RetrogradeBurn)
        {
            return false;
        }

        if (IsDirectFastTransferSegment(segment))
        {
            return false;
        }

        return ShouldUseTerminalLateralCorrection();
    }

    private void ApplyFlightPlanBrakeSegment(
        PrototypeManeuverSegment segment,
        Vector3 direction,
        bool allowMainThrottle,
        PrototypeFlightPlanTrackingCommand trackingCommand)
    {
        arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.Brake;
        limitedFinalApproachCapability = false;
        bool directFastTransferSegment = IsDirectFastTransferSegment(segment);
        if (directFastTransferSegment)
        {
            directFastTransferBrakeCommitted = true;
            directFastTransferTerminalReacquireActive = false;
            if (allowMainThrottle && direction.sqrMagnitude > 0.0001f && committedBrakeDirection.sqrMagnitude <= 0.0001f)
            {
                committedBrakeDirection = direction.normalized;
            }
        }
        else
        {
            arrivalBrakeCommitted = true;
        }

        if (directFastTransferSegment
            && IsStrictDirectFastTransferExecutionActive()
            && ShouldCaptureDirectFastTransferBrakeTerminalHandoff())
        {
            TryRunDirectFastTransferTerminalCaptureOrReacquire();
            return;
        }

        if (ShouldSettleFlightPlanBrakeSegment())
        {
            if (directFastTransferSegment && IsStrictDirectFastTransferExecutionActive())
            {
                TryRunDirectFastTransferTerminalCaptureOrReacquire();
                return;
            }

            arrivalTerminalCaptureActive = true;
            TryEnterHoldPosition();
            return;
        }

        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Brake;
        float angle = Vector3.Angle(transform.forward, direction);
        float angularSpeed = GetAngularSpeedRadiansPerSecond();
        bool brakeAlignmentReady = allowMainThrottle && UpdateBrakeAlignmentLock(angle, angularSpeed);
        SetState(brakeAlignmentReady ? PrototypeWaypointAutopilotState.Brake : PrototypeWaypointAutopilotState.FlipForBrake, "flight plan brake");
        if (!brakeAlignmentReady)
        {
            brakeMainThrottleAlignmentLocked = false;
        }

        Vector3 brakeRcsForceWorld = FilterFlightPlanBrakeRcsForce(
            segment,
            direction,
            trackingCommand.rcsForceWorld,
            allowMainThrottle,
            brakeAlignmentReady);
        ApplyAutopilotRequest(
            direction,
            allowMainThrottle ? trackingCommand.mainThrottle : 0f,
            false,
            brakeAlignmentReady,
            brakeRcsForceWorld,
            true,
            directFastTransferSegment,
            segment);
    }

    private Vector3 FilterFlightPlanBrakeRcsForce(
        PrototypeManeuverSegment segment,
        Vector3 brakeDirection,
        Vector3 requestedForceWorld,
        bool allowMainThrottle,
        bool brakeAlignmentReady)
    {
        if (requestedForceWorld.sqrMagnitude <= 0.0001f
            || brakeDirection.sqrMagnitude <= 0.0001f
            || LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit() * 1.25f)
        {
            return requestedForceWorld;
        }

        if (segment.phase != PrototypeManeuverPhase.FlipToRetrograde
            && segment.phase != PrototypeManeuverPhase.RetrogradeBurn)
        {
            return requestedForceWorld;
        }

        Vector3 normalizedBrakeDirection = brakeDirection.normalized;
        Vector3 filteredForce = requestedForceWorld;
        float alongBrakeForce = Vector3.Dot(filteredForce, normalizedBrakeDirection);
        if (alongBrakeForce > 0f)
        {
            filteredForce -= normalizedBrakeDirection * alongBrakeForce;
        }

        if (!brakeAlignmentReady
            && shipRigidbody != null
            && shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f)
        {
            Vector3 velocityDirection = shipRigidbody.linearVelocity.normalized;
            float alongVelocityForce = Vector3.Dot(filteredForce, velocityDirection);
            if (alongVelocityForce < 0f)
            {
                filteredForce -= velocityDirection * alongVelocityForce;
            }
        }

        return allowMainThrottle && brakeAlignmentReady
            ? filteredForce
            : Vector3.ClampMagnitude(filteredForce, GetRcsTranslationForceScale() * 0.75f);
    }

    private bool ShouldSettleFlightPlanBrakeSegment()
    {
        if (ShouldProtectDirectFastTransferBrakeSegmentFromTerminalHold())
        {
            return false;
        }

        if (currentTarget == null || shipRigidbody == null || !CanUseRcsTranslation())
        {
            return false;
        }

        float settleDistance = Mathf.Max(GetArrivalFinishedDistance(), GetArrivalTerminalRangeDistance());
        if (LastMetrics.distance > settleDistance)
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        return LastMetrics.relativeSpeed <= completionSpeed
            && Mathf.Abs(LastMetrics.closingSpeed) <= Mathf.Max(completionSpeed, arrivalSpeedMetersPerSecond * 1.25f);
    }

    private bool ShouldCaptureDirectFastTransferBrakeTerminalHandoff()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseRcsTranslation())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float lateralLimit = Mathf.Max(
            BrakeArrivalHoldMinimumLateralTolerance,
            GetArrivalCompletionLateralTolerance() * BrakeArrivalHoldLateralSpeedMultiplier);
        return LastMetrics.relativeSpeed <= completionSpeed * BrakeArrivalHoldRelativeSpeedMultiplier
            && LastMetrics.lateralSpeed <= lateralLimit;
    }

    private Vector3 ResolveFlightPlanSegmentDirection(PrototypeManeuverSegment segment)
    {
        if (segment.primaryDirectionWorld.sqrMagnitude > 0.0001f)
        {
            return segment.primaryDirectionWorld.normalized;
        }

        if (LastMetrics.directionToTarget.sqrMagnitude > 0.0001f)
        {
            return LastMetrics.directionToTarget.normalized;
        }

        return transform.forward.sqrMagnitude > 0.0001f ? transform.forward.normalized : Vector3.forward;
    }

    private void UpdateFlightPlanSegmentDiagnostics(
        PrototypeManeuverSegment segment,
        Vector3 direction,
        PrototypeFlightPlanTrackingCommand trackingCommand)
    {
        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.phase = MapFlightPlanPhase(segment.phase);
        updatedPlan.navigationPhase = MapFlightPlanNavigationPhase(segment.phase);
        updatedPlan.activeSegmentType = MapFlightPlanSegmentType(segment.phase);
        updatedPlan.activeSegment = new PrototypeTrajectorySegment(
            updatedPlan.activeSegmentType,
            segment.durationSeconds,
            direction,
            trackingCommand.mainThrottle,
            segment.expectedDeltaV,
            segment.ExpectedFuelKg,
            updatedPlan.predictedClosestObstacleDistance,
            updatedPlan.predictedMissDistanceToTarget);
        updatedPlan.requestedMainThrottle = trackingCommand.mainThrottle;
        updatedPlan.requestedRcsForceWorld = trackingCommand.rcsForceWorld;
        updatedPlan.desiredBurnDirectionWorld = direction;
        updatedPlan.desiredBurnDirection = direction;
        updatedPlan.desiredAccelerationWorld = trackingCommand.desiredAccelerationWorld;
        updatedPlan.status = "flight plan";
        updatedPlan.statusLabel = trackingCommand.requiresReplan
            ? trackingCommand.statusLabel
            : "flight plan " + segment.label
                + " | track "
                + trackingCommand.error.crossTrackErrorMeters.ToString("0.0")
                + "m";
        if (trackingCommand.requiresReplan)
        {
            updatedPlan.warningStatus = trackingCommand.statusLabel;
        }

        LastTrajectoryPlan = updatedPlan;
    }

    private static PrototypeTrajectoryPhase MapFlightPlanPhase(PrototypeManeuverPhase phase)
    {
        switch (phase)
        {
            case PrototypeManeuverPhase.AlignForBurn:
                return PrototypeTrajectoryPhase.AlignForBurn;
            case PrototypeManeuverPhase.ProgradeBurn:
            case PrototypeManeuverPhase.ReacquireRoute:
                return PrototypeTrajectoryPhase.LongRangeBurn;
            case PrototypeManeuverPhase.AvoidanceBurn:
                return PrototypeTrajectoryPhase.Avoidance;
            case PrototypeManeuverPhase.Coast:
                return PrototypeTrajectoryPhase.Coast;
            case PrototypeManeuverPhase.FlipToRetrograde:
            case PrototypeManeuverPhase.RetrogradeBurn:
                return PrototypeTrajectoryPhase.Brake;
            case PrototypeManeuverPhase.LateralCorrection:
            case PrototypeManeuverPhase.FinalApproach:
                return PrototypeTrajectoryPhase.FinalApproach;
            case PrototypeManeuverPhase.Hold:
                return PrototypeTrajectoryPhase.Hold;
            default:
                return PrototypeTrajectoryPhase.Failed;
        }
    }

    private static PrototypeAutopilotNavigationPhase MapFlightPlanNavigationPhase(PrototypeManeuverPhase phase)
    {
        switch (phase)
        {
            case PrototypeManeuverPhase.AvoidanceBurn:
                return PrototypeAutopilotNavigationPhase.Avoiding;
            case PrototypeManeuverPhase.FlipToRetrograde:
            case PrototypeManeuverPhase.RetrogradeBurn:
                return PrototypeAutopilotNavigationPhase.Brake;
            case PrototypeManeuverPhase.LateralCorrection:
            case PrototypeManeuverPhase.FinalApproach:
                return PrototypeAutopilotNavigationPhase.FinalApproach;
            case PrototypeManeuverPhase.Hold:
                return PrototypeAutopilotNavigationPhase.Hold;
            default:
                return PrototypeAutopilotNavigationPhase.Direct;
        }
    }

    private static PrototypeTrajectorySegmentType MapFlightPlanSegmentType(PrototypeManeuverPhase phase)
    {
        switch (phase)
        {
            case PrototypeManeuverPhase.AlignForBurn:
                return PrototypeTrajectorySegmentType.Align;
            case PrototypeManeuverPhase.ProgradeBurn:
            case PrototypeManeuverPhase.ReacquireRoute:
                return PrototypeTrajectorySegmentType.Burn;
            case PrototypeManeuverPhase.AvoidanceBurn:
                return PrototypeTrajectorySegmentType.AvoidanceBurn;
            case PrototypeManeuverPhase.Coast:
                return PrototypeTrajectorySegmentType.Coast;
            case PrototypeManeuverPhase.FlipToRetrograde:
            case PrototypeManeuverPhase.RetrogradeBurn:
                return PrototypeTrajectorySegmentType.Brake;
            case PrototypeManeuverPhase.LateralCorrection:
            case PrototypeManeuverPhase.FinalApproach:
                return PrototypeTrajectorySegmentType.FinalApproach;
            case PrototypeManeuverPhase.Hold:
                return PrototypeTrajectorySegmentType.Hold;
            default:
                return PrototypeTrajectorySegmentType.Coast;
        }
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
        float terminalControlWindowMeters = Mathf.Max(
            GetArrivalTerminalRangeDistance(),
            GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters * 2f);
        bool inTerminalControlWindow = LastMetrics.distance <= terminalControlWindowMeters;
        bool settledFineApproachReacquire = inFinalApproachWindow
            && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
        bool nearArrivalSettleWindow = LastMetrics.distance <= Mathf.Max(
            terminalControlWindowMeters,
            GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters);
        bool shouldSettleAfterBrakeCommit = arrivalBrakeCommitted
            && nearArrivalSettleWindow
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit()
            && LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed;
        bool shouldUseTerminalLateralCorrection = ShouldUseTerminalLateralCorrection();
        bool requestedFineApproach = inTerminalControlWindow
            && (!LastMetrics.shouldBrake || settledFineApproachReacquire || shouldSettleAfterBrakeCommit)
            && LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
        requestedFineApproach |= shouldSettleAfterBrakeCommit;
        bool currentlyAvoiding = IsAvoidancePlanActive();
        bool wasAvoiding = navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
            || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
        bool isReacquiring = !currentlyAvoiding && hasStableAvoidance && Time.time <= reacquireDirectPathUntilTime;
        bool hasLowLateralSpeed = LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond);
        bool shouldUseTerminalVelocityBrake = ShouldUseTerminalVelocityBrake();
        bool shouldActivateArrivalTerminalCapture = ShouldActivateArrivalTerminalCapture();
        arrivalTerminalCaptureActive = arrivalTerminalCaptureActive || shouldActivateArrivalTerminalCapture;
        if (ShouldReleaseArrivalTerminalCapture())
        {
            arrivalTerminalCaptureActive = false;
            shouldUseTerminalVelocityBrake = false;
        }

        bool requestBrake = ShouldRequestBrake();
        bool holdApproachBrakeCommit = ShouldHoldApproachBrakeCommit();
        bool holdBrakeCommitUntilSettled = ShouldHoldTerminalBrakeCommitUntilSettled();

        if ((requestBrake || holdApproachBrakeCommit || holdBrakeCommitUntilSettled) && (!currentlyAvoiding || LastMetrics.shouldBrake))
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
            float terminalHoldSpeedLimit = GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier;
            float terminalHoldLateralTolerance = Mathf.Max(
                BrakeArrivalHoldMinimumLateralTolerance,
                GetArrivalCompletionLateralTolerance() * BrakeArrivalHoldLateralSpeedMultiplier);
            if (ShouldCaptureAnyArrivalHold()
                || (LastMetrics.distance <= GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters
                    && LastMetrics.relativeSpeed <= terminalHoldSpeedLimit
                    && LastMetrics.lateralSpeed <= terminalHoldLateralTolerance))
            {
                TryEnterHoldPosition();
            }
            return;
        }

        bool terminalBrakeCommitFallback = (arrivalBrakeCommitted || shouldUseTerminalVelocityBrake)
            && !shouldUseTerminalLateralCorrection
            && IsWithinArrivalTerminalRange()
            && !IsInArrivalCompletionWindow()
            && !ShouldCaptureAnyArrivalHold()
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

        if (!currentlyAvoiding && arrivalTerminalCaptureActive && IsWithinArrivalTerminalCaptureRange())
        {
            SetState(PrototypeWaypointAutopilotState.FinalApproach, "terminal settle");
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.FinalApproach;
            arrivalPhase = PrototypeWaypointAutopilotArrivalPhase.LateralCorrection;
            limitedFinalApproachCapability = !CanUseRcsTranslation();
            arrivalFailureReason = limitedFinalApproachCapability ? "LimitedRcsAuthority" : string.Empty;
            ApplyLateralCorrection();
            return;
        }

        if (!currentlyAvoiding && arrivalBrakeCommitted && IsWithinArrivalTerminalCaptureRange())
        {
            arrivalTerminalCaptureActive = true;
            if (ShouldCaptureAnyArrivalHold())
            {
                TryEnterHoldPosition();
                return;
            }

            ApplyBrakeRequest();
            return;
        }

        bool isLateralCorrectionPhase = LastMetrics.lateralSpeed > finalApproachLateralToleranceMetersPerSecond;
        if (isLateralCorrectionPhase)
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

        bool shouldMaintainTerminalBrakePath = ShouldUseTerminalVelocityBrake()
            || ShouldKeepTerminalBrakeCommitted()
            || ShouldHoldTerminalBrakeCommitUntilSettled()
            || brakeHoldActive
            || arrivalTerminalCaptureActive;

        if (isLateralCorrectionPhase
            && LastMetrics.distance > GetArrivalTerminalRangeDistance() + BrakeArrivalHoldDistanceMarginMeters
            && !ShouldCaptureAnyArrivalHold()
            && !IsInArrivalCompletionWindow())
        {
            if (shouldMaintainTerminalBrakePath)
            {
                ApplyBrakeRequest();
                return;
            }

            // We are still too far from the terminal window to commit to a lateral-correction
            // settle path. Let the normal transfer logic keep the route moving instead of
            // freezing the state in FinalApproach outside the real deadzone.
        }

        if (shouldMaintainTerminalBrakePath)
        {
            ApplyBrakeRequest();
            return;
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
        if (!brakeAlignmentReady)
        {
            brakeMainThrottleAlignmentLocked = false;
        }

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
                || directFastTransferBrakeCommitted
                || brakeHoldActive
                || ShouldUseTerminalVelocityBrake()
                || ShouldKeepTerminalBrakeCommitted()
                || ShouldCaptureAnyArrivalHold());
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

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float completionDistance = GetArrivalCompletionDistance();
        float completionLateralTolerance = GetArrivalCompletionLateralTolerance();
        if (brakeHoldActive
            && arrivalBrakeCommitted
            && LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.distance <= completionDistance + BrakeArrivalHoldDistanceMarginMeters
            && LastMetrics.lateralSpeed <= completionLateralTolerance
            && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
            )
        {
            ReleaseBrakeHold();
            return false;
        }

        if (!LastMetrics.shouldBrake)
        {
            if (ShouldUseTerminalVelocityBrake())
            {
                if (!brakeHoldActive)
                {
                    brakeHoldActive = true;
                    brakeHoldStartTime = autopilotElapsedSeconds;
                }

                arrivalBrakeCommitted = true;
                return true;
            }

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
                && (LastMetrics.relativeSpeed > completionSpeed
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
                && LastMetrics.relativeSpeed > completionSpeed)
            {
                return true;
            }

            if (brakeHoldActive && LastMetrics.relativeSpeed > completionSpeed)
            {
                return true;
            }

            if (arrivalBrakeCommitted
                && (ShouldHoldApproachBrakeCommit()
                    || ShouldHoldTerminalBrakeCommitUntilSettled()
                    || LastMetrics.shouldBrake))
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

    private bool ShouldUseTerminalVelocityBrake()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseMainThrottle())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalRange())
        {
            return false;
        }

        if (ShouldCaptureAnyArrivalHold())
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        if (LastMetrics.relativeSpeed <= completionSpeed * TerminalOvershootBrakeRelativeSpeedMultiplier)
        {
            return false;
        }

        if (ShouldPreferTerminalLateralCorrectionOverBrake(completionSpeed))
        {
            return false;
        }

        float maxDeceleration = GetMaxDeceleration();
        if (maxDeceleration <= 0.0001f)
        {
            return false;
        }

        float fullVelocityStoppingDistance = (LastMetrics.relativeSpeed * LastMetrics.relativeSpeed) / (2f * maxDeceleration);
        float captureBuffer = GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters;
        bool plannedStopReachesCaptureZone = fullVelocityStoppingDistance + captureBuffer >= LastMetrics.distance;
        bool terminalBrakeAlreadyCaptured = arrivalBrakeCommitted
            || directFastTransferBrakeCommitted
            || arrivalTerminalCaptureActive
            || directFastTransferTerminalCaptureActive
            || brakeHoldActive;
        bool closeEnoughToCommit = LastMetrics.distance <= GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters;
        return terminalBrakeAlreadyCaptured || plannedStopReachesCaptureZone || closeEnoughToCommit;
    }

    private bool ShouldPreferTerminalLateralCorrectionOverBrake(float completionSpeed)
    {
        if (!CanUseRcsTranslation())
        {
            return false;
        }

        float closingLimit = Mathf.Max(BrakeHoldReleaseZeroSpeed, completionSpeed * 0.5f);
        if (LastMetrics.closingSpeed > closingLimit)
        {
            return false;
        }

        float lateralDominanceThreshold = Mathf.Max(
            GetArrivalCompletionLateralTolerance() * 2f,
            Mathf.Abs(LastMetrics.closingSpeed) * 1.2f);
        if (LastMetrics.lateralSpeed < lateralDominanceThreshold)
        {
            return false;
        }

        float rcsOnlySpeedLimit = Mathf.Max(lateralCorrectionSpeed, completionSpeed * 2f);
        return LastMetrics.relativeSpeed <= rcsOnlySpeedLimit;
    }

    private bool ShouldReleaseBrakeHoldForSettledOvershoot()
    {
        if (IsInArrivalCompletionWindow())
        {
            return false;
        }

        if (!IsBrakeAngularVelocitySettled(GetAngularSpeedRadiansPerSecond()))
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

    private float GetFineArrivalRcsOnlyDistanceLimit()
    {
        return GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters;
    }

    private float GetFineArrivalRcsOnlyClosingSpeedLimit()
    {
        return Mathf.Max(0.35f, arrivalSpeedMetersPerSecond * 0.75f);
    }

    private float GetFineArrivalRcsOnlyLateralSpeedLimit()
    {
        return Mathf.Min(
            TerminalRcsOnlySpeedLimit,
            Mathf.Max(
                BrakeArrivalHoldMinimumLateralTolerance,
                GetArrivalCompletionLateralTolerance() * BrakeArrivalHoldLateralSpeedMultiplier));
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
        if (!brakeAlignmentLocked && angle <= BrakeMainThrottleRetrogradeAlignmentDegrees && angularRateReady)
        {
            brakeAlignmentLocked = true;
        }
        else if (brakeAlignmentLocked
            && (angle >= BrakeMainThrottleRetrogradeAlignmentDegrees + BrakeAlignmentHysteresisDegrees
                || angularSpeedRadiansPerSecond > Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond * 1.35f))
        {
            brakeAlignmentLocked = false;
            brakeMainThrottleAlignmentLocked = false;
        }

        if (!brakeAlignmentLocked)
        {
            brakeMainThrottleAlignmentLocked = false;
        }

        return angularRateReady && (brakeAlignmentLocked || angle <= BrakeMainThrottleRetrogradeAlignmentDegrees);
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

    private bool IsBrakeMainThrottleGateReady(float angle, float angularSpeedRadiansPerSecond, bool brakeAlignmentReady)
    {
        if (!brakeAlignmentReady)
        {
            brakeMainThrottleAlignmentLocked = false;
            return false;
        }

        float lockLimit = Mathf.Deg2Rad * BrakeMainThrottleAngularSpeedLockDegreesPerSecond;
        float releaseLimit = Mathf.Deg2Rad * BrakeMainThrottleAngularSpeedReleaseDegreesPerSecond;
        float dynamicLockLimit = angle <= alignmentAngleDegrees ? lockLimit : releaseLimit;
        if (!brakeMainThrottleAlignmentLocked
            && angle <= BrakeMainThrottleRetrogradeAlignmentDegrees
            && angularSpeedRadiansPerSecond <= dynamicLockLimit)
        {
            brakeMainThrottleAlignmentLocked = true;
        }
        else if (brakeMainThrottleAlignmentLocked
            && (angle >= BrakeMainThrottleRetrogradeAlignmentDegrees + BrakeAlignmentHysteresisDegrees
                || angularSpeedRadiansPerSecond > releaseLimit))
        {
            brakeMainThrottleAlignmentLocked = false;
        }

        return brakeMainThrottleAlignmentLocked && angularSpeedRadiansPerSecond <= releaseLimit;
    }

    private bool IsBrakeAttitudeRateWithinMainThrottleGate(float angularSpeedRadiansPerSecond)
    {
        return angularSpeedRadiansPerSecond <= Mathf.Deg2Rad * BrakeAlignmentAngularSpeedLimitDegreesPerSecond;
    }

    private bool IsBrakeAngularVelocitySettled(float angularSpeedRadiansPerSecond)
    {
        return angularSpeedRadiansPerSecond <= Mathf.Deg2Rad * BrakeSettledAngularSpeedLimitDegreesPerSecond;
    }

    private float GetAngularSpeedRadiansPerSecond()
    {
        return shipRigidbody != null ? shipRigidbody.angularVelocity.magnitude : 0f;
    }

    private bool IsWithinArrivalTerminalRange()
    {
        return LastMetrics.distance <= GetArrivalTerminalRangeDistance();
    }

    private bool IsWithinArrivalTerminalCaptureRange()
    {
        return LastMetrics.distance <= GetArrivalTerminalRangeDistance() + BrakeArrivalHoldDistanceMarginMeters;
    }

    private bool ShouldKeepTerminalBrakeCommitted()
    {
        if (currentTarget == null || shipRigidbody == null || !CanUseMainThrottle())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalRange())
        {
            return false;
        }

        if (ShouldCaptureAnyArrivalHold())
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        if (LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.lateralSpeed <= GetArrivalCompletionLateralTolerance()
            && LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
            && arrivalBrakeCommitted)
        {
            return false;
        }

        return arrivalBrakeCommitted
            && LastMetrics.distance <= GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters;
    }

    private bool ShouldHoldTerminalBrakeCommitUntilSettled()
    {
        if (!arrivalBrakeCommitted || currentTarget == null || shipRigidbody == null || !CanUseMainThrottle())
        {
            return false;
        }

        if (!IsWithinArrivalTerminalCaptureRange() || IsInArrivalCompletionWindow())
        {
            return false;
        }

        if (ShouldCaptureAnyArrivalHold())
        {
            return false;
        }

        if (ShouldUseTerminalLateralCorrection())
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float completionLateralTolerance = GetArrivalCompletionLateralTolerance();

        return LastMetrics.closingSpeed > BrakeHoldReleaseZeroSpeed
            || LastMetrics.relativeSpeed > completionSpeed
            || LastMetrics.lateralSpeed > completionLateralTolerance;
    }

    private bool ShouldHoldApproachBrakeCommit()
    {
        if (!arrivalBrakeCommitted || currentTarget == null || shipRigidbody == null || !CanUseMainThrottle())
        {
            return false;
        }

        if (IsWithinArrivalTerminalCaptureRange() || ShouldCaptureAnyArrivalHold())
        {
            return false;
        }

        float approachBrakeWindow = Mathf.Max(finalApproachDistanceMeters, GetArrivalDistance() * 4f);
        if (LastMetrics.distance > approachBrakeWindow)
        {
            return false;
        }

        float minimumClosingSpeed = Mathf.Max(BrakeHoldReleaseZeroSpeed, arrivalSpeedMetersPerSecond * 0.5f);
        if (LastMetrics.closingSpeed <= minimumClosingSpeed)
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        if (LastMetrics.relativeSpeed <= completionSpeed)
        {
            return false;
        }

        float plannedStopReach = LastMetrics.stoppingDistance + GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters;
        return plannedStopReach >= LastMetrics.distance;
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

        if (LastMetrics.distance > GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters)
        {
            return false;
        }

        float completionSpeed = GetArrivalCompletionSpeedLimit();
        return LastMetrics.relativeSpeed <= completionSpeed * TerminalOvershootHoldRelativeSpeedMultiplier;
    }

    private bool ShouldCaptureAnyArrivalHold()
    {
        if (ShouldProtectDirectFastTransferBrakeSegmentFromTerminalHold())
        {
            return false;
        }

        return ShouldCaptureArrivalHold()
            || ShouldCaptureArrivalHoldNearArrival()
            || ShouldCaptureTerminalOvershootHold();
    }

    private float GetArrivalTerminalRangeDistance()
    {
        return Mathf.Max(
            GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters * 2f,
            GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters);
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

        if (LastMetrics.lateralSpeed <= Mathf.Max(0.05f, finalApproachLateralToleranceMetersPerSecond * 3f))
        {
            return false;
        }

        float terminalSpeedLimit = Mathf.Max(lateralCorrectionSpeed, GetArrivalCompletionSpeedLimit() * 2f);
        float lateralDominanceThreshold = Mathf.Max(
            GetArrivalCompletionLateralTolerance() * 2f,
            Mathf.Abs(LastMetrics.closingSpeed) * 1.2f);
        bool lateralDominatesTerminalMotion = (arrivalBrakeCommitted || directFastTransferBrakeCommitted)
            && LastMetrics.lateralSpeed >= lateralDominanceThreshold
            && LastMetrics.closingSpeed <= Mathf.Max(BrakeHoldReleaseZeroSpeed, GetArrivalCompletionSpeedLimit() * 0.5f)
            && LastMetrics.relativeSpeed <= Mathf.Max(terminalSpeedLimit, lateralCorrectionSpeed * 2f);
        if (lateralDominatesTerminalMotion)
        {
            return true;
        }

        if (ShouldKeepTerminalBrakeCommitted())
        {
            return false;
        }

        if (ShouldUseTerminalVelocityBrake())
        {
            return false;
        }

        return LastMetrics.relativeSpeed <= terminalSpeedLimit;
    }

    private bool ShouldUseTerminalBrakeDirectionSmoothing()
    {
        if (!IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        if (brakeHoldActive)
        {
            return true;
        }

        if (arrivalBrakeCommitted
            || directFastTransferBrakeCommitted
            || CurrentState == PrototypeWaypointAutopilotState.Brake
            || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            return true;
        }

        if (ShouldUseTerminalLateralCorrection())
        {
            return true;
        }

        if (!IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        return arrivalBrakeCommitted
            || directFastTransferBrakeCommitted
            || arrivalTerminalCaptureActive
            || directFastTransferTerminalCaptureActive
            || ShouldCaptureAnyArrivalHold();
    }

    private Vector3 ResolveBrakeDirection()
    {
        Vector3 fallback = LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? -LastMetrics.directionToTarget
            : -transform.forward;
        bool useTerminalSmoothing = ShouldUseTerminalBrakeDirectionSmoothing();
        bool useSmoothing = useTerminalSmoothing;

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
        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float completionLateralTolerance = GetArrivalCompletionLateralTolerance();
        bool isLinearlySettledForBrakeDirection =
            LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.lateralSpeed <= completionLateralTolerance;
        if (LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
            && LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            && (isLinearlySettledForBrakeDirection || ShouldCaptureAnyArrivalHold()))
        {
            observedBrakeDirection = LastMetrics.directionToTarget.normalized;
        }
        if (!useSmoothing)
        {
            committedBrakeDirection = observedBrakeDirection;
            return committedBrakeDirection;
        }

        bool settledForBrakeDirectionFreeze =
            LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit() * BrakeArrivalHoldRelativeSpeedMultiplier
            && Mathf.Abs(LastMetrics.closingSpeed) <= Mathf.Max(
                GetArrivalCompletionSpeedLimit(),
                arrivalSpeedMetersPerSecond * BrakeArrivalHoldRelativeSpeedMultiplier);
        float terminalRelatchSpeed = Mathf.Max(
            GetArrivalCompletionSpeedLimit() * 3f,
            lateralCorrectionSpeed * 2f);
        bool belowTerminalRelatchThreshold =
            LastMetrics.relativeSpeed <= terminalRelatchSpeed
            && Mathf.Abs(LastMetrics.closingSpeed) <= terminalRelatchSpeed;
        bool shouldFreezeBrakeDirection = IsWithinArrivalTerminalCaptureRange()
            && (brakeHoldActive
                || ShouldCaptureAnyArrivalHold()
                || ((arrivalTerminalCaptureActive
                        || arrivalBrakeCommitted
                        || directFastTransferTerminalCaptureActive
                        || directFastTransferBrakeCommitted)
                    && (settledForBrakeDirectionFreeze || belowTerminalRelatchThreshold)));
        if (useTerminalSmoothing
            && shouldFreezeBrakeDirection
            && committedBrakeDirection.sqrMagnitude > 0.0001f)
        {
            return committedBrakeDirection.normalized;
        }

        if (committedBrakeDirection.sqrMagnitude <= 0.0001f)
        {
            committedBrakeDirection = observedBrakeDirection;
            return committedBrakeDirection;
        }

        float directionRotateDegreesPerSecond = useTerminalSmoothing
            ? TerminalBrakeDirectionRotateDegreesPerSecond
            : PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * 0.8f;
        float maxRotateRadians = Mathf.Deg2Rad * directionRotateDegreesPerSecond * AutopilotTickSeconds;
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

    private void ApplyAutopilotRequest(
        Vector3 desiredDirection,
        float throttle,
        bool finalApproach = false,
        bool? brakeAlignmentReadyOverride = null,
        Vector3 trackedRcsForceWorld = default,
        bool useTrackedRcsForce = false,
        bool forcePlannedMainThrottle = false,
        PrototypeManeuverSegment plannedMainSegment = default)
    {
        if (shipController == null)
        {
            ClearCommands();
            return;
        }

        Vector3 attitudeTorqueLocal = Vector3.zero;
        bool suppressMainThrottle = TerminalRcsOnlyCorrectionActive && !forcePlannedMainThrottle;
        Vector3 desiredRcsForceWorld = useTrackedRcsForce
            ? trackedRcsForceWorld
            : LastTrajectoryPlan.requestedRcsForceWorld;
        if (desiredRcsForceWorld.sqrMagnitude > 0.0001f)
        {
            float mass = GetShipMassKg();
            desiredRcsForceWorld = Vector3.ClampMagnitude(desiredRcsForceWorld * Mathf.Clamp01(mass / Mathf.Max(0.01f, mass)), GetRcsTranslationForceScale());
        }

        Vector3 desiredCorrectionForceWorld;
        Vector3 correctionForceWorld = suppressMainThrottle
            ? ComputeTerminalRcsCorrectionForceWorld(out desiredCorrectionForceWorld)
            : ComputeLateralCorrectionForceWorld(out desiredCorrectionForceWorld);
        Vector3 desiredCombinedRcsForceWorld = desiredCorrectionForceWorld + desiredRcsForceWorld;
        Vector3 assistForceWorld = CombineRcsForces(correctionForceWorld, desiredRcsForceWorld);
        bool limitedRcsAuthority = desiredCombinedRcsForceWorld.sqrMagnitude > 0.0001f
            && assistForceWorld.magnitude + 0.001f < desiredCombinedRcsForceWorld.magnitude;
        float requestedMainThrottle = 0f;
        Vector3 desiredDirectionNormalized = Vector3.zero;
        string directFastLatchStatus = string.Empty;

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
            float finalApproachAlignmentAngle = finalApproach
                ? Mathf.Max(alignmentAngleDegrees, BrakeMainThrottleRetrogradeAlignmentDegrees)
                : alignmentAngleDegrees;
            bool finalApproachMainThrottleReady = !finalApproach
                || LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit();
            bool brakeVelocityAlignmentReady = !isBrakeState
                || shipRigidbody == null
                || shipRigidbody.linearVelocity.sqrMagnitude <= 0.0001f
                || Vector3.Angle(transform.forward, -shipRigidbody.linearVelocity.normalized) <= BrakeMainThrottleRetrogradeAlignmentDegrees
                || (LastMetrics.closingSpeed <= BrakeHoldReleaseZeroSpeed
                    && angle <= BrakeMainThrottleRetrogradeAlignmentDegrees);
            bool brakeAlignmentReady = !isBrakeState
                || (brakeAlignmentReadyOverride ?? IsBrakeAlignmentLockedForMainThrottle(angle));
            bool brakeMainThrottleReady = !isBrakeState
                || IsBrakeMainThrottleGateReady(angle, angularSpeed, brakeAlignmentReady);
            bool canApplyMainThrottle = CanUseMainThrottle()
                && !isFlipForBrakeState
                && (!isBrakeState
                    ? angle <= finalApproachAlignmentAngle && finalApproachMainThrottleReady
                    : brakeMainThrottleReady && brakeVelocityAlignmentReady);
            bool directFastPlannedMainThrottle = forcePlannedMainThrottle
                && IsDirectFastTransferMainThrottleSegment(plannedMainSegment)
                && throttle > 0.01f;
            if (directFastPlannedMainThrottle)
            {
                canApplyMainThrottle = CanUseMainThrottle()
                    && !isFlipForBrakeState
                    && UpdateDirectFastTransferMainThrottleLatch(
                        plannedMainSegment,
                        angle,
                        angularSpeed,
                        out directFastLatchStatus);
            }

            if (canApplyMainThrottle && !suppressMainThrottle)
            {
                requestedMainThrottle = forcePlannedMainThrottle
                    ? Mathf.Clamp01(throttle)
                    : ShapeMainThrottleForState(Mathf.Clamp01(throttle));
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
                    && CurrentState != PrototypeWaypointAutopilotState.Brake
                    && CurrentState != PrototypeWaypointAutopilotState.FlipForBrake
                    && CurrentState != PrototypeWaypointAutopilotState.ObstacleAvoidance)
                {
                    SetState(PrototypeWaypointAutopilotState.AlignForBurn, string.IsNullOrEmpty(directFastLatchStatus) ? "aligning" : directFastLatchStatus);
                }
                else if (!string.IsNullOrEmpty(directFastLatchStatus))
                {
                    SetState(CurrentState, directFastLatchStatus);
                }
            }
        }

        if (!finalApproach)
        {
            requestedMainThrottle = Mathf.Min(1f, requestedMainThrottle);
        }

        requestedMainThrottle = Mathf.Clamp01(requestedMainThrottle);
        assistForceWorld = FilterHighDeltaVBrakeAssistForce(
            assistForceWorld,
            desiredDirectionNormalized,
            requestedMainThrottle);
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

        if (!string.IsNullOrEmpty(directFastLatchStatus))
        {
            updatedPlan.status = "flight plan";
            updatedPlan.statusLabel = directFastLatchStatus;
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

    private Vector3 FilterHighDeltaVBrakeAssistForce(
        Vector3 assistForceWorld,
        Vector3 desiredDirectionNormalized,
        float mainThrottle)
    {
        bool brakeState = CurrentState == PrototypeWaypointAutopilotState.Brake
            || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake;
        if (!brakeState
            || assistForceWorld.sqrMagnitude <= 0.0001f
            || shipRigidbody == null
            || shipRigidbody.linearVelocity.sqrMagnitude <= 0.0001f
            || LastMetrics.relativeSpeed <= GetArrivalCompletionSpeedLimit() * 1.25f
            || mainThrottle > 0.01f)
        {
            return assistForceWorld;
        }

        Vector3 filteredForce = assistForceWorld;
        if (desiredDirectionNormalized.sqrMagnitude > 0.0001f)
        {
            float alongBrakeForce = Vector3.Dot(filteredForce, desiredDirectionNormalized.normalized);
            if (alongBrakeForce > 0f)
            {
                filteredForce -= desiredDirectionNormalized.normalized * alongBrakeForce;
            }
        }

        Vector3 velocityDirection = shipRigidbody.linearVelocity.normalized;
        float alongVelocityForce = Vector3.Dot(filteredForce, velocityDirection);
        if (alongVelocityForce < 0f)
        {
            filteredForce -= velocityDirection * alongVelocityForce;
        }

        return Vector3.ClampMagnitude(filteredForce, GetRcsTranslationForceScale() * 0.75f);
    }

    private float ShapeMainThrottleForState(float throttle)
    {
        if (CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            return 0f;
        }

        if (TerminalRcsOnlyCorrectionActive)
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

    private Vector3 ComputeTerminalRcsCorrectionForceWorld(out Vector3 desiredForceWorld)
    {
        desiredForceWorld = Vector3.zero;
        if (shipRigidbody == null)
        {
            return Vector3.zero;
        }

        Vector3 velocityDampingForce = Vector3.zero;
        if (shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f)
        {
            Vector3 velocity = shipRigidbody.linearVelocity;
            float desiredVelocityForce = GetShipMassKg() * (velocity.magnitude / Mathf.Max(0.1f, lateralCorrectionDampingSeconds));
            velocityDampingForce = -velocity.normalized * desiredVelocityForce;
        }

        desiredForceWorld = velocityDampingForce + ComputeTerminalRcsPositionCorrectionForceWorld();
        return ClampRcsForceWorld(desiredForceWorld);
    }

    private Vector3 ComputeTerminalRcsPositionCorrectionForceWorld()
    {
        if (currentTarget == null || LastMetrics.directionToTarget.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        float correctionStartDistance = GetArrivalDistance() + BrakeArrivalHoldDistanceMarginMeters;
        float excessDistance = LastMetrics.distance - correctionStartDistance;
        if (excessDistance <= 0.01f)
        {
            return Vector3.zero;
        }

        float dampingSeconds = Mathf.Max(0.1f, lateralCorrectionDampingSeconds);
        float desiredApproachSpeed = Mathf.Min(GetArrivalCompletionSpeedLimit(), excessDistance / dampingSeconds);
        float desiredAcceleration = desiredApproachSpeed / dampingSeconds;
        return LastMetrics.directionToTarget.normalized * GetShipMassKg() * desiredAcceleration;
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
        Vector3 desiredPositionCorrectionForce = ComputeHoldPositionCorrectionForceWorld(dampingForce.magnitude);
        Vector3 desiredHoldForce = desiredDampingForce + desiredPositionCorrectionForce;
        Vector3 holdForce = ClampRcsForceWorld(dampingForce + desiredPositionCorrectionForce);
        bool limitedHoldAuthority = desiredHoldForce.sqrMagnitude > 0.0001f
            && holdForce.magnitude + 0.001f < desiredHoldForce.magnitude;
        requestedMainThrottle = 0f;
        requestedRcsTranslation = holdForce;
        desiredBurnDirection = Vector3.zero;
        PrototypeTrajectoryPlan updatedPlan = LastTrajectoryPlan;
        updatedPlan.navigationPhase = PrototypeAutopilotNavigationPhase.Hold;
        updatedPlan.activeSegmentType = PrototypeTrajectorySegmentType.Hold;
        updatedPlan.requestedMainThrottle = 0f;
        updatedPlan.requestedRcsForceWorld = holdForce;
        updatedPlan.desiredAccelerationWorld = holdForce / GetShipMassKg();
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
            holdForce,
            Vector3.zero,
            0f,
            false));
    }

    private Vector3 ComputeHoldPositionCorrectionForceWorld(float dampingForceMagnitude)
    {
        if (shipController == null
            || shipRigidbody == null
            || currentTarget == null
            || !CanUseRcsTranslation())
        {
            return Vector3.zero;
        }

        float holdCorrectionDistance = GetArrivalDistance() + 1.5f;
        if (LastMetrics.distance <= holdCorrectionDistance)
        {
            return Vector3.zero;
        }

        Vector3 towardTarget = LastMetrics.directionToTarget.sqrMagnitude > 0.0001f
            ? LastMetrics.directionToTarget.normalized
            : (currentTarget.Position - shipRigidbody.position).normalized;
        if (towardTarget.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        float excessDistance = LastMetrics.distance - holdCorrectionDistance;
        float correctionScale = Mathf.Clamp01(excessDistance / 5f);
        float dampingSeconds = Mathf.Max(0.1f, lateralCorrectionDampingSeconds);
        float desiredPositionForce = GetShipMassKg() * (excessDistance / (dampingSeconds * dampingSeconds));
        float minimumCorrectionForce = GetRcsTranslationForceScale() * 0.08f;
        float correctionMagnitude = Mathf.Min(
            Mathf.Max(dampingForceMagnitude * 0.55f, desiredPositionForce * 0.5f, minimumCorrectionForce),
            GetRcsTranslationForceScale() * 0.45f) * correctionScale;
        if (correctionMagnitude <= 0.00001f)
        {
            return Vector3.zero;
        }

        return towardTarget * correctionMagnitude;
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
            return Vector3.right;
        }

        if (turnAxisLocal.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        float angleDegrees = Vector3.Angle(Vector3.forward, localDirection);
        float commandMagnitude = Mathf.Clamp01(angleDegrees / 45f);
        Vector3 command = Vector3.ClampMagnitude(turnAxisLocal.normalized * commandMagnitude, 1f);

        return command;
    }

    private Vector3 ComputeAttitudeTorqueLocal(Vector3 desiredDirection)
    {
        if (CurrentState == PrototypeWaypointAutopilotState.Brake
            || CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
        {
            return ComputeBrakeAttitudeTorqueLocal(desiredDirection);
        }

        Vector3 attitudeCommand = ComputeAttitudeCommand(desiredDirection);
        float torqueAuthority = GetRcsAttitudeTorqueAuthority();
        return torqueAuthority > 0.0001f ? attitudeCommand * torqueAuthority : Vector3.zero;
    }

    private Vector3 ComputeBrakeAttitudeTorqueLocal(Vector3 desiredDirection)
    {
        if (shipRigidbody == null || desiredDirection.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        float torqueAuthority = GetRcsAttitudeTorqueAuthority();
        if (torqueAuthority <= 0.0001f)
        {
            return Vector3.zero;
        }

        Vector3 angularVelocityLocal = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        Vector3 angularErrorLocal = ComputeBrakeAngularErrorLocal(desiredDirection.normalized);
        float angleDegrees = angularErrorLocal.magnitude * Mathf.Rad2Deg;
        if (CurrentState == PrototypeWaypointAutopilotState.Brake
            && angleDegrees <= BrakeAlignedTorqueDeadbandDegrees
            && IsBrakeAngularVelocitySettled(angularVelocityLocal.magnitude))
        {
            return Vector3.zero;
        }

        float flipTurnRateScale = CurrentState == PrototypeWaypointAutopilotState.FlipForBrake ? 0.9f : 0.7f;
        float maxTurnRate = Mathf.Deg2Rad * PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * flipTurnRateScale;
        Vector3 desiredAngularVelocityLocal = Vector3.ClampMagnitude(
            angularErrorLocal / Mathf.Max(0.05f, PrototypeFlightPlanExecutionConfig.BrakeFlipDampingTimeSeconds),
            maxTurnRate);
        Vector3 desiredAngularAccelerationLocal = (desiredAngularVelocityLocal - angularVelocityLocal)
            / Mathf.Max(0.05f, PrototypeFlightPlanExecutionConfig.BrakeFlipDampingTimeSeconds);
        desiredAngularAccelerationLocal = Vector3.ClampMagnitude(
            desiredAngularAccelerationLocal,
            PrototypeFlightPlanExecutionConfig.BrakeFlipMaxAngularAccelerationRadPerSecondSquared);
        Vector3 desiredTorqueLocal = TransformLocalAngularAccelerationToTorque(desiredAngularAccelerationLocal);
        return Vector3.ClampMagnitude(desiredTorqueLocal, torqueAuthority);
    }

    private Vector3 ComputeBrakeAngularErrorLocal(Vector3 desiredDirection)
    {
        Vector3 localDirection = transform.InverseTransformDirection(desiredDirection.normalized);
        if (localDirection.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        localDirection.Normalize();
        float angleRadians = Mathf.Acos(Mathf.Clamp(localDirection.z, -1f, 1f));
        if (angleRadians <= 0.0001f)
        {
            return Vector3.zero;
        }

        Vector3 turnAxisLocal = Vector3.Cross(Vector3.forward, localDirection);
        if (turnAxisLocal.sqrMagnitude <= 0.0004f && localDirection.z < 0f)
        {
            // Retrograde is an unstable reference in this projection; prefer a deterministic pitch-axis command.
            turnAxisLocal = Vector3.right;
        }
        else if (turnAxisLocal.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }
        else
        {
            turnAxisLocal.Normalize();
        }

        return turnAxisLocal * angleRadians;
    }

    private Vector3 TransformLocalAngularAccelerationToTorque(Vector3 localAngularAcceleration)
    {
        if (shipRigidbody == null || localAngularAcceleration.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        Vector3 inertia = shipRigidbody.inertiaTensor;
        if (!IsFinitePositive(inertia.x) || !IsFinitePositive(inertia.y) || !IsFinitePositive(inertia.z))
        {
            return Vector3.zero;
        }

        Quaternion inertiaRotation = shipRigidbody.inertiaTensorRotation;
        Vector3 principalAcceleration = Quaternion.Inverse(inertiaRotation) * localAngularAcceleration;
        Vector3 principalTorque = new Vector3(
            principalAcceleration.x * inertia.x,
            principalAcceleration.y * inertia.y,
            principalAcceleration.z * inertia.z);
        return inertiaRotation * principalTorque;
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

        RcsThrusterController rcsThrusters = GetCachedRcsThrusters();
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

        bool requestedReplan = forceNextFlightPlanRevision;
        PrototypeFlightPlan preservedFlightPlan = LastTrajectoryPlan.flightPlan;
        bool preserveActiveFlightPlan = ShouldPreserveActiveFlightPlan(preservedFlightPlan, requestedReplan);
        if (shipRigidbody == null || currentTarget == null)
        {
            LastObstacleDetection = PrototypeObstacleDetectionResult.Clear(GetObstacleClearanceRadius());
            LastTrajectoryPlan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
            CompleteNavigationPlanRefresh();
            return;
        }

        float clearance = GetObstacleClearanceRadius();
        bool reacquireWindowActive = reacquireDirectPathUntilTime > 0f && Time.time <= reacquireDirectPathUntilTime;
        bool wasAvoidanceRoute = reacquireWindowActive
            || hasStableAvoidance
            || LastTrajectoryPlan.RequiresAvoidance
            || LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.AvoidancePlanning
            || LastTrajectoryPlan.navigationPhase == PrototypeAutopilotNavigationPhase.Avoiding
            || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
            || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
        LastObstacleDetection = obstacleDetector != null
            ? obstacleDetector.DetectDirectPath(shipRigidbody, currentTarget.Position, clearance)
            : PrototypeObstacleDetectionResult.Clear(clearance);
        bool releasedAvoidanceRoute = wasAvoidanceRoute && !LastObstacleDetection.hasObstacle;
        bool keepStableAvoidance = hasStableAvoidance
            && Time.time < avoidanceHoldExpireTime
            && LastObstacleDetection.hasObstacle;
        if (releasedAvoidanceRoute || (reacquireWindowActive && !LastObstacleDetection.hasObstacle))
        {
            reacquireDirectPathUntilTime = Time.time + avoidReacquireTimeoutSeconds;
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
        }

        bool suppressDirectFastTransferForReacquire = releasedAvoidanceRoute
            || (reacquireWindowActive && !LastObstacleDetection.hasObstacle);
        PrototypeShipPlanningSnapshot shipPlanningSnapshot = PrototypeShipPlanningSnapshotBuilder.Build(
            transform,
            shipRigidbody,
            shipStats,
            shipController,
            GetComponent<ShipPhysicsCore>(),
            GetCachedMainThrusterBank(),
            GetCachedRcsThrusters());
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
            shipPlanningSnapshot,
            Time.time,
            Time.fixedDeltaTime,
            keepStableAvoidance,
            stableAvoidanceWaypoint,
            keepStableAvoidance ? "stable" : string.Empty,
            suppressDirectFastTransferForReacquire);
        plan.navigationPhase = ConvertNavigationPhase(navigationPhaseV2);
        if (plan.RequiresAvoidance && keepStableAvoidance && stableAvoidanceWaypoint.sqrMagnitude > 0.0001f)
        {
            plan.avoidanceWaypoint = stableAvoidanceWaypoint;
            plan.avoidanceDirection = stableAvoidanceDirection.sqrMagnitude > 0.0001f ? stableAvoidanceDirection.normalized : plan.avoidanceDirection;
            plan.selectedCandidate = "stable";
            plan.selectedCandidateReason = "locked avoidance waypoint";
            plan.navigationPhase = PrototypeAutopilotNavigationPhase.Avoiding;
        }
        else if (!plan.RequiresAvoidance
            && (releasedAvoidanceRoute
                || (reacquireWindowActive && !LastObstacleDetection.hasObstacle)
                || (keepStableAvoidance
                    && (navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                        || navigationPhaseV2 == PrototypeWaypointAutopilotNavigationPhase.Avoiding))))
        {
            plan.navigationPhase = PrototypeAutopilotNavigationPhase.ReacquireDirectPath;
        }

        if (releasedAvoidanceRoute)
        {
            preserveActiveFlightPlan = false;
            requestedReplan = true;
        }

        if (preserveActiveFlightPlan)
        {
            plan.flightPlan = preservedFlightPlan;
        }
        else
        {
            plan = AssignFlightPlanRevision(plan, requestedReplan);
        }

        LastTrajectoryPlan = plan;
        if (releasedAvoidanceRoute && !LastTrajectoryPlan.RequiresAvoidance)
        {
            navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
            PrototypeTrajectoryPlan reacquirePlan = LastTrajectoryPlan;
            reacquirePlan.navigationPhase = PrototypeAutopilotNavigationPhase.ReacquireDirectPath;
            LastTrajectoryPlan = reacquirePlan;
        }

        CompleteNavigationPlanRefresh();
    }

    private bool ShouldPreserveActiveFlightPlan(PrototypeFlightPlan preservedFlightPlan, bool requestedReplan)
    {
        if (!autopilotEngaged
            || !useFlightPlanExecutor
            || !preservedFlightPlan.IsValid
            || requestedReplan)
        {
            return false;
        }

        if (!strictFlightPlanExecution)
        {
            return true;
        }

        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        float targetTolerance = Mathf.Max(0.75f, preservedFlightPlan.targetArrivalRadiusMeters * 0.25f);
        if (Vector3.Distance(preservedFlightPlan.targetPositionWorld, currentTarget.Position) > targetTolerance)
        {
            return false;
        }

        float massKg = GetShipMassKg();
        float rcsAcceleration = massKg > 0.0001f ? GetRcsTranslationForceScale() / massKg : 0f;
        PrototypeFlightPlanTrackerSettings settings = BuildRuntimeFlightPlanTrackerSettings(massKg, rcsAcceleration);
        PrototypeFlightPlanTrackingCommand trackingCommand = PrototypeFlightPlanTracker.Track(
            preservedFlightPlan,
            flightPlanElapsedSeconds,
            shipRigidbody.worldCenterOfMass,
            shipRigidbody.linearVelocity,
            shipRigidbody.rotation,
            shipRigidbody.angularVelocity,
            shipStats != null ? shipStats.CurrentFuelKg : 0f,
            currentTarget.Position,
            GetMaxAcceleration(),
            rcsAcceleration,
            massKg,
            settings);
        const PrototypeFlightPlanAbortReplanReason nonPreservableReasons =
            PrototypeFlightPlanAbortReplanReason.MissingDependency
            | PrototypeFlightPlanAbortReplanReason.NonFiniteState
            | PrototypeFlightPlanAbortReplanReason.TargetMoved
            | PrototypeFlightPlanAbortReplanReason.ObstacleDetected
            | PrototypeFlightPlanAbortReplanReason.CollisionPredicted
            | PrototypeFlightPlanAbortReplanReason.FuelStarved
            | PrototypeFlightPlanAbortReplanReason.ActuatorLimited
            | PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority
            | PrototypeFlightPlanAbortReplanReason.NoRcsAuthority
            | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
            | PrototypeFlightPlanAbortReplanReason.PlanUnstable
            | PrototypeFlightPlanAbortReplanReason.PlanExpired
            | PrototypeFlightPlanAbortReplanReason.NonExecutable;
        if ((trackingCommand.replanReasons & nonPreservableReasons) != 0)
        {
            return false;
        }

        return true;
    }

    private PrototypeTrajectoryPlan AssignFlightPlanRevision(PrototypeTrajectoryPlan plan, bool requestedReplan)
    {
        if (!plan.flightPlan.HasSegments)
        {
            return plan;
        }

        PrototypeFlightPlan flightPlan = plan.flightPlan;
        flightPlanRevisionCounter++;

        lastAssignedFlightPlanId = flightPlan.planId;
        flightPlan.revision = Mathf.Max(1, flightPlanRevisionCounter);
        plan.flightPlan = flightPlan;
        forceNextFlightPlanRevision = false;
        return plan;
    }

    private bool ShouldRefreshNavigationPlanThisTick()
    {
        if (!autopilotEngaged && !navigationDebugPlanningActive)
        {
            return false;
        }

        if (IsStrictDirectFastTransferExecutionActive())
        {
            return false;
        }

        if (navigationPlanDirty)
        {
            return true;
        }

        if (autopilotEngaged && useFlightPlanExecutor && CurrentFlightPlan.IsValid)
        {
            return strictFlightPlanExecution && Time.time >= nextFlightPlanSafetyRefreshTime;
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
        nextFlightPlanSafetyRefreshTime = Time.time + FlightPlanSafetyRefreshIntervalSeconds;
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

        if (!CanUseRcsTranslation() && !arrivalBrakeCommitted && !directFastTransferBrakeCommitted)
        {
            return false;
        }

        if (!IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        if (LastMetrics.distance > GetArrivalFinishedDistance())
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

    private bool ShouldMaintainArrivalHold()
    {
        if (CurrentState != PrototypeWaypointAutopilotState.HoldPosition)
        {
            return false;
        }

        if (currentTarget == null || shipRigidbody == null || !CanUseRcsTranslation())
        {
            return false;
        }

        if (LastMetrics.distance > GetArrivalFinishedDistance())
        {
            return false;
        }

        float holdSpeedLimit = Mathf.Max(
            lateralCorrectionSpeed,
            GetArrivalCompletionSpeedLimit() * TerminalOvershootHoldRelativeSpeedMultiplier);
        return LastMetrics.relativeSpeed <= holdSpeedLimit;
    }

    private bool ShouldCaptureArrivalHoldNearArrival()
    {
        if (!CanUseRcsTranslation() && !arrivalBrakeCommitted && !directFastTransferBrakeCommitted)
        {
            return false;
        }

        if (!IsWithinArrivalTerminalCaptureRange())
        {
            return false;
        }

        if (currentTarget == null || shipRigidbody == null)
        {
            return false;
        }

        float arrivalCompletionDistance = GetArrivalCompletionDistance() + BrakeArrivalHoldDistanceMarginMeters;
        float completionSpeed = GetArrivalCompletionSpeedLimit();
        float completionLateralTolerance = GetArrivalCompletionLateralTolerance() * 1.1f;

        return LastMetrics.distance <= arrivalCompletionDistance
            && LastMetrics.relativeSpeed <= completionSpeed
            && LastMetrics.lateralSpeed <= completionLateralTolerance;
    }

    private void UpdateHoldStatus()
    {
        navigationPhaseV2 = PrototypeWaypointAutopilotNavigationPhase.Hold;
        if (!ShouldCaptureAnyArrivalHold())
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

        RcsThrusterController rcsThrusters = GetCachedRcsThrusters();
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

        MainThrusterBank mainThrusterBank = GetCachedMainThrusterBank();
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
        brakeMainThrottleAlignmentLocked = false;
        committedBrakeDirection = Vector3.zero;
        brakeHoldStartTime = 0f;
        brakeHoldActive = false;
        arrivalBrakeCommitted = false;
        arrivalTerminalCaptureActive = false;
        ResetDirectFastTransferTerminalOwnership();
        holdConfirmStarted = false;
        holdConfirmUntilTime = 0f;
        flightPlanExecutorActive = false;
        ResetDirectFastTransferMainAuthorityBlock();
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

    private RcsThrusterController GetCachedRcsThrusters()
    {
        RefreshThrusterComponentCache();
        return cachedRcsThrusters;
    }

    private MainThrusterBank GetCachedMainThrusterBank()
    {
        RefreshThrusterComponentCache();
        return cachedMainThrusterBank;
    }

    private void RefreshThrusterComponentCache(bool forceRefresh = false)
    {
        GameObject lookupGameObject = shipController != null ? shipController.gameObject : gameObject;
        if (!forceRefresh
            && thrusterComponentCacheInitialized
            && cachedThrusterLookupController == shipController
            && cachedThrusterLookupGameObject == lookupGameObject)
        {
            return;
        }

        thrusterComponentCacheInitialized = true;
        cachedThrusterLookupController = shipController;
        cachedThrusterLookupGameObject = lookupGameObject;
        cachedRcsThrusters = lookupGameObject != null ? lookupGameObject.GetComponent<RcsThrusterController>() : null;
        cachedMainThrusterBank = lookupGameObject != null ? lookupGameObject.GetComponent<MainThrusterBank>() : null;
    }

    private void ResolveReferences(bool forceThrusterComponentCacheRefresh = false)
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

        RefreshThrusterComponentCache(forceThrusterComponentCacheRefresh);
        ResolveFloatingOriginManagerSubscription();
    }

    private void ResolveFloatingOriginManagerSubscription()
    {
        if (floatingOriginManager == null && !floatingOriginManagerLookupAttempted)
        {
            floatingOriginManager = FindAnyObjectByType<FloatingOriginManager>();
            floatingOriginManagerLookupAttempted = true;
        }

        if (subscribedFloatingOriginManager == floatingOriginManager)
        {
            return;
        }

        UnsubscribeFromFloatingOriginShift();
        if (floatingOriginManager == null)
        {
            return;
        }

        floatingOriginManager.OriginShifted += HandleOriginShifted;
        subscribedFloatingOriginManager = floatingOriginManager;
    }

    private void UnsubscribeFromFloatingOriginShift()
    {
        if (subscribedFloatingOriginManager == null)
        {
            return;
        }

        subscribedFloatingOriginManager.OriginShifted -= HandleOriginShifted;
        subscribedFloatingOriginManager = null;
    }

    private static bool IsFinite(Vector3 value)
    {
        return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    }

    private static Vector3[] CopyFlightPlanSamplePositions(PrototypeTrajectoryPredictedSample[] samples, int maxPoints)
    {
        if (samples == null || samples.Length == 0 || maxPoints <= 0)
        {
            return System.Array.Empty<Vector3>();
        }

        int count = Mathf.Min(samples.Length, maxPoints);
        var points = new Vector3[count];
        if (count == 1)
        {
            points[0] = samples[0].position;
            return points;
        }

        for (int i = 0; i < count; i++)
        {
            int sampleIndex = Mathf.RoundToInt((samples.Length - 1) * (i / (float)(count - 1)));
            points[i] = samples[Mathf.Clamp(sampleIndex, 0, samples.Length - 1)].position;
        }

        return points;
    }

    private static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }

    private static bool IsFinitePositive(float value)
    {
        return IsFinite(value) && value > 0.000001f;
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
