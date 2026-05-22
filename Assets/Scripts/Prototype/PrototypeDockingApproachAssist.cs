using UnityEngine;

public readonly struct PrototypeDockingApproachAssistSnapshot
{
    public PrototypeDockingApproachAssistSnapshot(
        bool assistEnabled,
        bool sourceDockingPortBound,
        bool targetDockingPortBound,
        string targetName,
        float distanceMeters,
        float angleErrorDegrees,
        float relativeSpeed,
        float closingSpeed,
        Vector2 lateralOffsetMeters,
        string statusLabel,
        string alignmentLabel,
        string readinessLabel,
        string refusalLabel,
        bool softCaptureRequested,
        bool assistanceRouted,
        bool hardLockRequested,
        bool hardLockJointCreated,
        bool hardLockPlaceholder,
        bool eligibilityValid)
    {
        AssistEnabled = assistEnabled;
        SourceDockingPortBound = sourceDockingPortBound;
        TargetDockingPortBound = targetDockingPortBound;
        TargetName = string.IsNullOrWhiteSpace(targetName) ? "Docking port" : targetName;
        DistanceMeters = Mathf.Max(0f, distanceMeters);
        AngleErrorDegrees = Mathf.Max(0f, angleErrorDegrees);
        RelativeSpeed = Mathf.Max(0f, relativeSpeed);
        ClosingSpeed = closingSpeed;
        LateralOffsetMeters = lateralOffsetMeters;
        StatusLabel = string.IsNullOrWhiteSpace(statusLabel) ? "Docking n/a" : statusLabel;
        AlignmentLabel = string.IsNullOrWhiteSpace(alignmentLabel) ? "--" : alignmentLabel;
        ReadinessLabel = string.IsNullOrWhiteSpace(readinessLabel) ? "--" : readinessLabel;
        RefusalLabel = string.IsNullOrWhiteSpace(refusalLabel) ? "--" : refusalLabel;
        SoftCaptureRequested = softCaptureRequested;
        AssistanceRouted = assistanceRouted;
        HardLockRequested = hardLockRequested;
        HardLockJointCreated = hardLockJointCreated;
        HardLockPlaceholder = hardLockPlaceholder;
        EligibilityValid = eligibilityValid;
    }

    public bool AssistEnabled { get; }
    public bool SourceDockingPortBound { get; }
    public bool TargetDockingPortBound { get; }
    public string TargetName { get; }
    public float DistanceMeters { get; }
    public float AngleErrorDegrees { get; }
    public float RelativeSpeed { get; }
    public float ClosingSpeed { get; }
    public Vector2 LateralOffsetMeters { get; }
    public string StatusLabel { get; }
    public string AlignmentLabel { get; }
    public string ReadinessLabel { get; }
    public string RefusalLabel { get; }
    public bool SoftCaptureRequested { get; }
    public bool AssistanceRouted { get; }
    public bool HardLockRequested { get; }
    public bool HardLockJointCreated { get; }
    public bool HardLockPlaceholder { get; }
    public bool EligibilityValid { get; }

    public static PrototypeDockingApproachAssistSnapshot Empty => new PrototypeDockingApproachAssistSnapshot(
        false,
        false,
        false,
        "Docking port",
        0f,
        0f,
        0f,
        0f,
        Vector2.zero,
        "Unconfigured",
        "--",
        "--",
        "--",
        false,
        false,
        false,
        false,
        false,
        false);
}

[DisallowMultipleComponent]
[DefaultExecutionOrder(-200)]
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(PlayerShipController))]
public class PrototypeDockingApproachAssist : MonoBehaviour
{
    [SerializeField] private bool assistEnabled = true;
    [SerializeField] private PlayerShipController sourceController;
    [SerializeField] private Rigidbody sourceRigidbody;
    [SerializeField] private DockingPort sourceDockingPort;
    [SerializeField] private DockingPort targetDockingPort;
    [SerializeField] private DockingPort[] targetCandidates = new DockingPort[0];

    private PrototypeDockingApproachAssistSnapshot latestSnapshot = PrototypeDockingApproachAssistSnapshot.Empty;

    public bool AssistEnabled => assistEnabled;
    public DockingPort SourceDockingPort => sourceDockingPort;
    public DockingPort TargetDockingPort => targetDockingPort;
    public DockingPort[] TargetCandidates => targetCandidates;
    public PrototypeDockingApproachAssistSnapshot LastSnapshot => latestSnapshot;
    public bool IsAssistanceRouted => latestSnapshot.AssistanceRouted;

    public void Bind(
        PlayerShipController controller,
        Rigidbody body,
        DockingPort sourcePort = null,
        DockingPort targetPort = null,
        DockingPort[] candidateTargets = null)
    {
        sourceController = controller;
        sourceRigidbody = body;
        sourceDockingPort = sourcePort;
        targetDockingPort = targetPort;
        targetCandidates = candidateTargets;
        ResolveReferences();
        latestSnapshot = PrototypeDockingApproachAssistSnapshot.Empty;
    }

    public void SetAssistEnabled(bool enabled)
    {
        assistEnabled = enabled;
        if (!enabled)
        {
            ClearDockingRequestIfOwned();
        }
    }

    public void SetSourceController(PlayerShipController controller)
    {
        sourceController = controller;
    }

    public void SetSourceRigidbody(Rigidbody body)
    {
        sourceRigidbody = body;
    }

    public void SetSourceDockingPort(DockingPort dockingPort)
    {
        sourceDockingPort = dockingPort;
    }

    public void SetTargetDockingPort(DockingPort dockingPort)
    {
        targetDockingPort = dockingPort;
    }

    public void SetTargetCandidates(DockingPort[] candidates)
    {
        targetCandidates = candidates ?? new DockingPort[0];
    }

    public void ResetForBootstrap()
    {
        if (sourceController != null)
        {
            ClearDockingRequestIfOwned();
        }
    }

    private void FixedUpdate()
    {
        ResolveReferences();

        if (!assistEnabled)
        {
            ClearDockingRequestIfOwned();
            latestSnapshot = new PrototypeDockingApproachAssistSnapshot(
                false,
                sourceDockingPort != null,
                targetDockingPort != null,
                targetDockingPort != null ? targetDockingPort.name : "Docking port",
                latestSnapshot.DistanceMeters,
                latestSnapshot.AngleErrorDegrees,
                latestSnapshot.RelativeSpeed,
                latestSnapshot.ClosingSpeed,
                latestSnapshot.LateralOffsetMeters,
                "Disabled",
                "--",
                "No route",
                latestSnapshot.RefusalLabel,
                false,
                false,
                false,
                false,
                latestSnapshot.HardLockPlaceholder,
                false);
            return;
        }

        if (sourceController == null || sourceRigidbody == null)
        {
            ClearDockingRequestIfOwned();
            latestSnapshot = new PrototypeDockingApproachAssistSnapshot(
                true,
                sourceDockingPort != null,
                targetDockingPort != null,
                targetDockingPort != null ? targetDockingPort.name : "Docking port",
                0f,
                0f,
                0f,
                0f,
                Vector2.zero,
                "Missing source references",
                "--",
                "No route",
                "--",
                false,
                false,
                false,
                false,
                false,
                false);
            return;
        }

        if (sourceDockingPort == null)
        {
            sourceDockingPort = sourceController.GetComponentInChildren<DockingPort>();
            if (sourceDockingPort == null)
            {
                sourceDockingPort = GetComponentInChildren<DockingPort>();
            }
        }

        if (sourceDockingPort == null)
        {
            ClearDockingRequestIfOwned();
            latestSnapshot = new PrototypeDockingApproachAssistSnapshot(
                true,
                false,
                targetDockingPort != null,
                targetDockingPort != null ? targetDockingPort.name : "Docking port",
                0f,
                0f,
                0f,
                0f,
                Vector2.zero,
                "Missing source docking port",
                "Unbound",
                "No route",
                "--",
                false,
                false,
                false,
                false,
                false,
                false);
            return;
        }

        DockingPort resolvedTargetPort = ResolveTargetPort();
        targetDockingPort = resolvedTargetPort;
        if (resolvedTargetPort == null)
        {
            ClearDockingRequestIfOwned();
            latestSnapshot = new PrototypeDockingApproachAssistSnapshot(
                true,
                true,
                false,
                "Docking port",
                0f,
                0f,
                0f,
                0f,
                Vector2.zero,
                "Missing target docking port",
                "--",
                "No target",
                "--",
                false,
                false,
                false,
                false,
                false,
                false);
            return;
        }

        Rigidbody targetRigidbody = resolvedTargetPort.GetComponentInParent<Rigidbody>();
        if (!sourceDockingPort.TryCalculateRelativeState(resolvedTargetPort, sourceRigidbody, targetRigidbody, out DockingRelativeState state))
        {
            ClearDockingRequestIfOwned();
            latestSnapshot = new PrototypeDockingApproachAssistSnapshot(
                true,
                true,
                true,
                resolvedTargetPort.name,
                state.distance,
                state.angleErrorDegrees,
                state.relativeSpeed,
                state.closingSpeed,
                new Vector2(state.offsetLocal.x, state.offsetLocal.y),
                "Relative state invalid",
                "Invalid",
                "No route",
                state.diagnostic,
                false,
                false,
                false,
                false,
                false,
                false);
            return;
        }

        DockingEligibility eligibility = sourceDockingPort.EvaluateEligibility(resolvedTargetPort, state);
        DockingSoftCaptureRequest softCaptureRequest = sourceDockingPort.BuildSoftCaptureRequest(
            resolvedTargetPort,
            state,
            eligibility);

        DockingHardLockResult hardLockResult = sourceDockingPort.BuildHardLockPrototype(resolvedTargetPort, eligibility);
        bool routed = false;
        if (eligibility.canSoftCapture && softCaptureRequest.requested)
        {
            sourceController.SetExternalFlightAssistRequest(softCaptureRequest.assistRequest);
            routed = true;
        }
        else
        {
            ClearDockingRequestIfOwned();
        }

        latestSnapshot = BuildSnapshot(
            state,
            resolvedTargetPort.name,
            eligibility,
            softCaptureRequest,
            hardLockResult,
            routed);
    }

    private void OnDisable()
    {
        ClearDockingRequestIfOwned();
        latestSnapshot = PrototypeDockingApproachAssistSnapshot.Empty;
    }

    private void ResolveReferences()
    {
        if (sourceController == null)
        {
            sourceController = GetComponent<PlayerShipController>();
        }

        if (sourceRigidbody == null)
        {
            sourceRigidbody = GetComponent<Rigidbody>();
        }
    }

    private DockingPort ResolveTargetPort()
    {
        if (targetDockingPort != null && targetDockingPort != sourceDockingPort)
        {
            return targetDockingPort;
        }

        if (targetCandidates != null)
        {
            for (int i = 0; i < targetCandidates.Length; i++)
            {
                DockingPort candidate = targetCandidates[i];
                if (IsUsableTargetPort(candidate))
                {
                    return candidate;
                }
            }
        }

        DockingPort[] allPorts = Object.FindObjectsByType<DockingPort>(FindObjectsInactive.Exclude);
        for (int i = 0; i < allPorts.Length; i++)
        {
            DockingPort candidate = allPorts[i];
            if (IsUsableTargetPort(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private bool IsUsableTargetPort(DockingPort candidate)
    {
        if (candidate == null || candidate == sourceDockingPort)
        {
            return false;
        }

        return sourceDockingPort == null || candidate.transform.root != sourceDockingPort.transform.root;
    }

    private void ClearDockingRequestIfOwned()
    {
        bool requestBelongsToDocking = sourceController != null
            && sourceController.HasExternalFlightAssistRequest
            && sourceController.LastExternalFlightAssistRequest.source == FlightAssistRequestSource.Docking;

        if (requestBelongsToDocking)
        {
            sourceController.ClearExternalFlightAssistRequest();
        }

    }

    private static string BuildAlignmentLabel(DockingEligibility eligibility, DockingRelativeState state)
    {
        if (!eligibility.validState)
        {
            return "Invalid";
        }

        return eligibility.withinSoftCaptureAngle ? "Aligned" : "Misaligned (" + state.angleErrorDegrees.ToString("0.0") + "°)";
    }

    private static string BuildReadinessLabel(DockingEligibility eligibility, bool routed, bool softRequested)
    {
        if (!eligibility.validState)
        {
            return "No state";
        }

        if (routed && softRequested)
        {
            return "Routed";
        }

        if (softRequested)
        {
            return "Soft capture ready";
        }

        return "Not ready";
    }

    private static string BuildRefusalLabel(DockingEligibility eligibility, DockingRelativeState state)
    {
        if (!eligibility.validState)
        {
            return state.diagnostic;
        }

        return eligibility.diagnostic;
    }

    private static string BuildStatusLabel(DockingEligibility eligibility, bool routed)
    {
        if (!eligibility.validState)
        {
            return "Relative state invalid";
        }

        if (routed)
        {
            return "Soft capture routed";
        }

        if (eligibility.canSoftCapture)
        {
            return "Soft capture ready";
        }

        return "Docking not ready";
    }

    private static PrototypeDockingApproachAssistSnapshot BuildSnapshot(
        DockingRelativeState state,
        string targetName,
        DockingEligibility eligibility,
        DockingSoftCaptureRequest softCaptureRequest,
        DockingHardLockResult hardLockResult,
        bool routed)
    {
        return new PrototypeDockingApproachAssistSnapshot(
            true,
            true,
            true,
            targetName,
            state.distance,
            state.angleErrorDegrees,
            state.relativeSpeed,
            state.closingSpeed,
            new Vector2(state.offsetLocal.x, state.offsetLocal.y),
            BuildStatusLabel(eligibility, routed),
            BuildAlignmentLabel(eligibility, state),
            BuildReadinessLabel(eligibility, routed, softCaptureRequest.requested),
            BuildRefusalLabel(eligibility, state),
            softCaptureRequest.requested,
            routed,
            hardLockResult.lockRequested,
            hardLockResult.jointCreated,
            hardLockResult.placeholder,
            eligibility.canSoftCapture && softCaptureRequest.requested && routed);
    }
}
