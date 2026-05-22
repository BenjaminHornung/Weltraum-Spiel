using System;
using UnityEngine;

public enum PrototypeTrajectoryPreviewStatus
{
    Disabled,
    Unavailable,
    Empty,
    Valid,
    Truncated
}

public readonly struct PrototypeTrajectoryPreviewSnapshot
{
    public PrototypeTrajectoryPreviewSnapshot(
        bool enabled,
        PrototypeTrajectoryPreviewStatus status,
        string sourceLabel,
        Vector3[] points,
        int sourcePointCount,
        int stepLimit,
        float horizonSeconds,
        bool usedAutopilotRoute,
        bool usedPredictor,
        bool usedCentralGravity,
        bool usedBurnPlan,
        bool nonFiniteDetected,
        TrajectoryBurnPlan burnPlan)
    {
        Enabled = enabled;
        Status = status;
        SourceLabel = string.IsNullOrWhiteSpace(sourceLabel) ? "Trajectory Preview" : sourceLabel;
        Points = points ?? Array.Empty<Vector3>();
        SourcePointCount = Mathf.Max(0, sourcePointCount);
        StepLimit = Mathf.Max(0, stepLimit);
        HorizonSeconds = Mathf.Max(0f, horizonSeconds);
        UsedAutopilotRoute = usedAutopilotRoute;
        UsedPredictor = usedPredictor;
        UsedCentralGravity = usedCentralGravity;
        UsedBurnPlan = usedBurnPlan;
        NonFiniteDetected = nonFiniteDetected;
        BurnPlan = burnPlan;
    }

    public bool Enabled { get; }
    public PrototypeTrajectoryPreviewStatus Status { get; }
    public string SourceLabel { get; }
    public Vector3[] Points { get; }
    public int SourcePointCount { get; }
    public int StepLimit { get; }
    public float HorizonSeconds { get; }
    public bool UsedAutopilotRoute { get; }
    public bool UsedPredictor { get; }
    public bool UsedCentralGravity { get; }
    public bool UsedBurnPlan { get; }
    public bool NonFiniteDetected { get; }
    public TrajectoryBurnPlan BurnPlan { get; }

    public bool HasRenderablePoints => Enabled && Points.Length > 1 && (Status == PrototypeTrajectoryPreviewStatus.Valid || Status == PrototypeTrajectoryPreviewStatus.Truncated);
    public bool IsAvailable => Status != PrototypeTrajectoryPreviewStatus.Disabled && Status != PrototypeTrajectoryPreviewStatus.Unavailable;

    public string StatusLabel
    {
        get
        {
            switch (Status)
            {
                case PrototypeTrajectoryPreviewStatus.Disabled:
                    return "Trajectory Preview: Off";
                case PrototypeTrajectoryPreviewStatus.Unavailable:
                    return "Trajectory Preview: Unavailable";
                case PrototypeTrajectoryPreviewStatus.Empty:
                    return "Trajectory Preview: Empty";
                case PrototypeTrajectoryPreviewStatus.Truncated:
                    return "Trajectory Preview: Truncated";
                default:
                    return "Trajectory Preview: On";
            }
        }
    }

    public static PrototypeTrajectoryPreviewSnapshot Disabled(int stepLimit, float horizonSeconds)
    {
        return new PrototypeTrajectoryPreviewSnapshot(
            false,
            PrototypeTrajectoryPreviewStatus.Disabled,
            "Trajectory Preview",
            Array.Empty<Vector3>(),
            0,
            stepLimit,
            horizonSeconds,
            false,
            false,
            false,
            false,
            false,
            TrajectoryBurnPlan.None);
    }

    public static PrototypeTrajectoryPreviewSnapshot Unavailable(string sourceLabel, int stepLimit, float horizonSeconds)
    {
        return new PrototypeTrajectoryPreviewSnapshot(
            true,
            PrototypeTrajectoryPreviewStatus.Unavailable,
            sourceLabel,
            Array.Empty<Vector3>(),
            0,
            stepLimit,
            horizonSeconds,
            false,
            false,
            false,
            false,
            false,
            TrajectoryBurnPlan.None);
    }
}

[DisallowMultipleComponent]
public class PrototypeTrajectoryPreviewNavMap : MonoBehaviour
{
    public const int DefaultStepCount = 96;
    public const int DefaultMaxPointCount = 16;
    public const int MaxPreviewPointCount = 64;
    public const float DefaultFixedDeltaTime = 0.1f;
    public const float DefaultPreviewBurnDurationSeconds = 1.5f;
    public const float DefaultPreviewBurnThrottle = 0.25f;

    [Header("Preview")]
    [SerializeField] private bool previewEnabled = true;
    [SerializeField] private bool preferAutopilotRoute = true;
    [SerializeField] private int stepCount = DefaultStepCount;
    [SerializeField] private int maxPointCount = DefaultMaxPointCount;
    [SerializeField] private float fixedDeltaTime = DefaultFixedDeltaTime;
    [SerializeField] private bool includeCentralGravity = true;

    [Header("Burn Estimate")]
    [SerializeField] private float previewBurnDurationSeconds = DefaultPreviewBurnDurationSeconds;
    [SerializeField] private float previewBurnThrottle = DefaultPreviewBurnThrottle;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private PrototypeWaypointAutopilot autopilot;

    public bool PreviewEnabled => previewEnabled;
    public bool PreferAutopilotRoute => preferAutopilotRoute;
    public int StepCount => Mathf.Clamp(stepCount, 0, TrajectoryPredictor.MaxStepCount);
    public int MaxPointCount => Mathf.Clamp(maxPointCount, 2, MaxPreviewPointCount);
    public float FixedDeltaTime => fixedDeltaTime > 0f && TrajectoryPredictionMath.IsFinite(fixedDeltaTime)
        ? fixedDeltaTime
        : DefaultFixedDeltaTime;
    public bool IncludeCentralGravity => includeCentralGravity;
    public float HorizonSeconds => StepCount * FixedDeltaTime;
    public PrototypeTrajectoryPreviewSnapshot LastSnapshot { get; private set; } = PrototypeTrajectoryPreviewSnapshot.Disabled(DefaultStepCount, DefaultStepCount * DefaultFixedDeltaTime);

    private void Awake()
    {
        ResolveReferences();
    }

    private void Start()
    {
        RefreshPreview();
    }

    private void OnValidate()
    {
        stepCount = Mathf.Clamp(stepCount, 0, TrajectoryPredictor.MaxStepCount);
        maxPointCount = Mathf.Clamp(maxPointCount, 2, MaxPreviewPointCount);
        fixedDeltaTime = fixedDeltaTime > 0f && TrajectoryPredictionMath.IsFinite(fixedDeltaTime)
            ? fixedDeltaTime
            : DefaultFixedDeltaTime;
        previewBurnDurationSeconds = Mathf.Max(0f, previewBurnDurationSeconds);
        previewBurnThrottle = Mathf.Clamp01(previewBurnThrottle);
    }

    public void Bind(Transform shipRoot, Rigidbody body, ShipStats stats, ShipPhysicsCore core, PrototypeWaypointAutopilot waypointAutopilot)
    {
        shipRigidbody = body != null ? body : shipRigidbody;
        shipStats = stats != null ? stats : shipStats;
        physicsCore = core != null ? core : physicsCore;
        autopilot = waypointAutopilot != null ? waypointAutopilot : autopilot;

        if (shipRoot != null)
        {
            if (shipRigidbody == null)
            {
                shipRigidbody = shipRoot.GetComponent<Rigidbody>();
            }

            if (shipStats == null)
            {
                shipStats = shipRoot.GetComponent<ShipStats>();
            }

            if (physicsCore == null)
            {
                physicsCore = shipRoot.GetComponent<ShipPhysicsCore>();
            }

            if (autopilot == null)
            {
                autopilot = shipRoot.GetComponent<PrototypeWaypointAutopilot>();
            }
        }

        RefreshPreview();
    }

    public void SetPreviewEnabled(bool enabled)
    {
        previewEnabled = enabled;
        RefreshPreview();
    }

    public void TogglePreview()
    {
        SetPreviewEnabled(!previewEnabled);
    }

    public void ConfigureForTests(bool enabled, int maxPoints, int steps, float deltaTime, bool gravityEnabled, bool preferRoute)
    {
        previewEnabled = enabled;
        maxPointCount = Mathf.Clamp(maxPoints, 2, MaxPreviewPointCount);
        stepCount = Mathf.Clamp(steps, 0, TrajectoryPredictor.MaxStepCount);
        fixedDeltaTime = deltaTime > 0f && TrajectoryPredictionMath.IsFinite(deltaTime)
            ? deltaTime
            : DefaultFixedDeltaTime;
        includeCentralGravity = gravityEnabled;
        preferAutopilotRoute = preferRoute;
    }

    public PrototypeTrajectoryPreviewSnapshot RefreshPreview()
    {
        ResolveReferences();
        if (!previewEnabled)
        {
            LastSnapshot = PrototypeTrajectoryPreviewSnapshot.Disabled(StepCount, HorizonSeconds);
            return LastSnapshot;
        }

        TrajectoryBurnPlan burnPlan = ResolveBurnPlan();
        if (preferAutopilotRoute && TryGetAutopilotRoute(out Vector3[] route, out int sourceCount))
        {
            LastSnapshot = BuildSnapshotFromRoute(
                route,
                true,
                MaxPointCount,
                "Autopilot route",
                sourceCount,
                StepCount,
                HorizonSeconds,
                usedAutopilotRoute: true,
                usedPredictor: false,
                usedCentralGravity: false,
                usedBurnPlan: burnPlan.HasBurn,
                burnPlan: burnPlan);
            return LastSnapshot;
        }

        if (shipRigidbody == null)
        {
            LastSnapshot = PrototypeTrajectoryPreviewSnapshot.Unavailable("Missing Rigidbody", StepCount, HorizonSeconds);
            return LastSnapshot;
        }

        TrajectoryPredictionState initialState = TrajectoryPredictionState.FromRigidbody(shipRigidbody, shipStats);
        if (!initialState.IsFinite)
        {
            LastSnapshot = BuildSnapshotFromRoute(
                Array.Empty<Vector3>(),
                true,
                MaxPointCount,
                "Non-finite ship state",
                0,
                StepCount,
                HorizonSeconds,
                usedAutopilotRoute: false,
                usedPredictor: true,
                usedCentralGravity: includeCentralGravity && physicsCore != null,
                usedBurnPlan: burnPlan.HasBurn,
                burnPlan: burnPlan,
                forceNonFiniteDetected: true);
            return LastSnapshot;
        }

        float massKg = ResolveMassKg();
        float acceleration = burnPlan.HasBurn && shipStats != null
            ? (shipStats.Thrust * burnPlan.throttle * burnPlan.appliedFuelFraction) / massKg
            : 0f;
        float fuelUse = burnPlan.HasBurn && shipStats != null
            ? shipStats.FuelConsumptionKgPerSecond * burnPlan.throttle
            : 0f;
        var settings = new TrajectoryPredictionSettings(
            StepCount,
            FixedDeltaTime,
            includeCentralGravity,
            burnPlan.directionWorld,
            acceleration,
            Vector3.zero,
            fuelUse);

        TrajectoryPredictionState[] states = TrajectoryPredictor.Predict(initialState, physicsCore, settings);
        Vector3[] predictedRoute = new Vector3[states.Length];
        for (int i = 0; i < states.Length; i++)
        {
            predictedRoute[i] = states[i].position;
        }

        LastSnapshot = BuildSnapshotFromRoute(
            predictedRoute,
            true,
            MaxPointCount,
            "Predictor",
            states.Length,
            StepCount,
            HorizonSeconds,
            usedAutopilotRoute: false,
            usedPredictor: true,
            usedCentralGravity: includeCentralGravity && physicsCore != null,
            usedBurnPlan: burnPlan.HasBurn,
            burnPlan: burnPlan);
        return LastSnapshot;
    }

    public static PrototypeTrajectoryPreviewSnapshot BuildSnapshotFromRoute(
        Vector3[] route,
        bool enabled,
        int maxPoints,
        string sourceLabel,
        int sourcePointCount,
        int stepLimit,
        float horizonSeconds,
        bool usedAutopilotRoute,
        bool usedPredictor,
        bool usedCentralGravity,
        bool usedBurnPlan,
        TrajectoryBurnPlan burnPlan,
        bool forceNonFiniteDetected = false)
    {
        int safeMax = Mathf.Clamp(maxPoints, 2, MaxPreviewPointCount);
        Vector3[] points = CopyFiniteRoutePoints(route, safeMax, out bool truncated, out bool nonFiniteDetected);
        bool detectedNonFinite = nonFiniteDetected || forceNonFiniteDetected;
        PrototypeTrajectoryPreviewStatus status;
        if (!enabled)
        {
            status = PrototypeTrajectoryPreviewStatus.Disabled;
        }
        else if (points.Length <= 1)
        {
            status = PrototypeTrajectoryPreviewStatus.Empty;
        }
        else if (truncated || detectedNonFinite)
        {
            status = PrototypeTrajectoryPreviewStatus.Truncated;
        }
        else
        {
            status = PrototypeTrajectoryPreviewStatus.Valid;
        }

        return new PrototypeTrajectoryPreviewSnapshot(
            enabled,
            status,
            sourceLabel,
            enabled ? points : Array.Empty<Vector3>(),
            Mathf.Max(sourcePointCount, route != null ? route.Length : 0),
            stepLimit,
            horizonSeconds,
            usedAutopilotRoute,
            usedPredictor,
            usedCentralGravity,
            usedBurnPlan,
            detectedNonFinite,
            burnPlan.IsFinite ? burnPlan : TrajectoryBurnPlan.None);
    }

    public static Vector3[] CopyFiniteRoutePoints(Vector3[] route, int maxPoints, out bool truncated, out bool nonFiniteDetected)
    {
        truncated = false;
        nonFiniteDetected = false;
        if (route == null || route.Length == 0 || maxPoints <= 0)
        {
            return Array.Empty<Vector3>();
        }

        int safeMax = Mathf.Clamp(maxPoints, 1, MaxPreviewPointCount);
        var points = new Vector3[Mathf.Min(route.Length, safeMax)];
        int count = 0;
        for (int i = 0; i < route.Length; i++)
        {
            Vector3 point = route[i];
            if (!TrajectoryPredictionMath.IsFinite(point))
            {
                nonFiniteDetected = true;
                truncated = true;
                break;
            }

            if (count >= safeMax)
            {
                truncated = true;
                break;
            }

            points[count] = point;
            count++;
        }

        if (count != points.Length)
        {
            Array.Resize(ref points, count);
        }

        return points;
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            TryGetComponent(out shipRigidbody);
        }

        if (shipStats == null)
        {
            TryGetComponent(out shipStats);
        }

        if (physicsCore == null)
        {
            TryGetComponent(out physicsCore);
        }

        if (autopilot == null)
        {
            TryGetComponent(out autopilot);
        }
    }

    private bool TryGetAutopilotRoute(out Vector3[] route, out int sourceCount)
    {
        route = Array.Empty<Vector3>();
        sourceCount = 0;
        if (autopilot == null)
        {
            return false;
        }

        Vector3[] predictedRoute = autopilot.PredictedRoute;
        sourceCount = predictedRoute.Length;
        if (predictedRoute.Length <= 1)
        {
            return false;
        }

        route = predictedRoute;
        return true;
    }

    private TrajectoryBurnPlan ResolveBurnPlan()
    {
        if (autopilot != null)
        {
            TrajectoryBurnPlan activePlan = autopilot.CurrentPlan.burnPlan;
            if (activePlan.IsFinite && activePlan.HasBurn)
            {
                return activePlan;
            }
        }

        Vector3 direction = ResolvePreviewDirection();
        float massKg = ResolveMassKg();
        return TrajectoryBurnPlan.EstimateMainBurn(
            direction,
            previewBurnDurationSeconds,
            previewBurnThrottle,
            shipStats,
            massKg);
    }

    private Vector3 ResolvePreviewDirection()
    {
        if (autopilot != null)
        {
            Vector3 direction = autopilot.DesiredBurnDirection;
            if (direction.sqrMagnitude > 0.0001f && TrajectoryPredictionMath.IsFinite(direction))
            {
                return direction.normalized;
            }
        }

        return transform != null && TrajectoryPredictionMath.IsFinite(transform.forward)
            ? transform.forward
            : Vector3.forward;
    }

    private float ResolveMassKg()
    {
        if (shipRigidbody != null && shipRigidbody.mass > 0f && TrajectoryPredictionMath.IsFinite(shipRigidbody.mass))
        {
            return Mathf.Max(0.1f, shipRigidbody.mass);
        }

        if (shipStats != null)
        {
            return Mathf.Max(0.1f, shipStats.CurrentMass);
        }

        return 1f;
    }
}
