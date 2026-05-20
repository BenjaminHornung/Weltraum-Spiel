using System.Collections.Generic;
using UnityEngine;

public readonly struct PrototypeHudStatusViewModel
{
    public PrototypeHudStatusViewModel(
        float speedMetersPerSecond,
        float throttlePercent,
        float fuelCurrentKg,
        float fuelMaxKg,
        bool hasWarning,
        string warningText)
    {
        SpeedMetersPerSecond = speedMetersPerSecond;
        ThrottlePercent = throttlePercent;
        FuelCurrentKg = fuelCurrentKg;
        FuelMaxKg = fuelMaxKg;
        HasWarning = hasWarning;
        WarningText = warningText;
    }

    public float SpeedMetersPerSecond { get; }
    public float ThrottlePercent { get; }
    public float FuelCurrentKg { get; }
    public float FuelMaxKg { get; }
    public bool HasWarning { get; }
    public string WarningText { get; }
}

public readonly struct PrototypeAutopilotViewModel
{
    public PrototypeAutopilotViewModel(
        bool isAvailable,
        bool isEngaged,
        string targetName,
        string stateLabel,
        string status,
        string arrivalPhase,
        string arrivalFailureReason)
    {
        IsAvailable = isAvailable;
        IsEngaged = isEngaged;
        TargetName = targetName;
        StateLabel = stateLabel;
        Status = status;
        ArrivalPhase = arrivalPhase;
        ArrivalFailureReason = arrivalFailureReason;
    }

    public bool IsAvailable { get; }
    public bool IsEngaged { get; }
    public string TargetName { get; }
    public string StateLabel { get; }
    public string Status { get; }
    public string ArrivalPhase { get; }
    public string ArrivalFailureReason { get; }
}

public readonly struct PrototypeMomentumAssistViewModel
{
    public PrototypeMomentumAssistViewModel(
        bool isAvailable,
        bool isActive,
        PrototypeMomentumAssistState state,
        string status,
        float speedMetersPerSecond,
        float angularSpeed)
    {
        IsAvailable = isAvailable;
        IsActive = isActive;
        State = state;
        Status = status;
        SpeedMetersPerSecond = speedMetersPerSecond;
        AngularSpeed = angularSpeed;
    }

    public bool IsAvailable { get; }
    public bool IsActive { get; }
    public PrototypeMomentumAssistState State { get; }
    public string Status { get; }
    public float SpeedMetersPerSecond { get; }
    public float AngularSpeed { get; }
}

public readonly struct PrototypeHudViewModel
{
    public PrototypeHudViewModel(
        PrototypeHudStatusViewModel status,
        PrototypeAutopilotViewModel autopilot,
        PrototypeMomentumAssistViewModel momentumAssist,
        bool hasVelocityMarker,
        Vector2 forwardMarker,
        Vector2 progradeMarker,
        Vector2 retrogradeMarker,
        bool hasSasMarker,
        Vector2 sasMarker,
        bool hasTargetMarker,
        Vector2 targetMarker,
        bool hasDebugForceMarkers,
        Vector2 desiredForceMarker,
        Vector2 actualForceMarker,
        Vector2 residualForceMarker,
        string modeLabel,
        string modeLabelStructure,
        string controlModeHint,
        string sasLabel)
    {
        Status = status;
        Autopilot = autopilot;
        MomentumAssist = momentumAssist;
        HasVelocityMarker = hasVelocityMarker;
        ForwardMarker = forwardMarker;
        ProgradeMarker = progradeMarker;
        RetrogradeMarker = retrogradeMarker;
        HasSasMarker = hasSasMarker;
        SasMarker = sasMarker;
        HasTargetMarker = hasTargetMarker;
        TargetMarker = targetMarker;
        HasDebugForceMarkers = hasDebugForceMarkers;
        DesiredForceMarker = desiredForceMarker;
        ActualForceMarker = actualForceMarker;
        ResidualForceMarker = residualForceMarker;
        ModeLabel = modeLabel;
        ModeLabelStructure = modeLabelStructure;
        ControlModeHint = controlModeHint;
        SasLabel = sasLabel;
    }

    public PrototypeHudStatusViewModel Status { get; }
    public PrototypeAutopilotViewModel Autopilot { get; }
    public PrototypeMomentumAssistViewModel MomentumAssist { get; }

    public bool HasVelocityMarker { get; }
    public Vector2 ForwardMarker { get; }
    public Vector2 ProgradeMarker { get; }
    public Vector2 RetrogradeMarker { get; }
    public bool HasSasMarker { get; }
    public Vector2 SasMarker { get; }
    public bool HasTargetMarker { get; }
    public Vector2 TargetMarker { get; }
    public bool HasDebugForceMarkers { get; }
    public Vector2 DesiredForceMarker { get; }
    public Vector2 ActualForceMarker { get; }
    public Vector2 ResidualForceMarker { get; }

    public string ModeLabel { get; }
    public string ModeLabelStructure { get; }
    public string ControlModeHint { get; }
    public string SasLabel { get; }
}

public readonly struct PrototypeDebugViewModel
{
    public PrototypeDebugViewModel(
        float speedMetersPerSecond,
        float forwardAcceleration,
        float mainThrottlePercent,
        float rcsThrottle,
        bool rcsEnabled,
        bool sasEnabled,
        bool effectiveSasEnabled,
        float sasAuthority,
        string controlMode,
        bool autopilotEngaged,
        string autopilotState)
    {
        SpeedMetersPerSecond = speedMetersPerSecond;
        ForwardAcceleration = forwardAcceleration;
        MainThrottlePercent = mainThrottlePercent;
        RcsThrottle = rcsThrottle;
        RcsEnabled = rcsEnabled;
        SasEnabled = sasEnabled;
        EffectiveSasEnabled = effectiveSasEnabled;
        SasAuthority = sasAuthority;
        ControlMode = controlMode;
        AutopilotEngaged = autopilotEngaged;
        AutopilotState = autopilotState;
    }

    public float SpeedMetersPerSecond { get; }
    public float ForwardAcceleration { get; }
    public float MainThrottlePercent { get; }
    public float RcsThrottle { get; }
    public bool RcsEnabled { get; }
    public bool SasEnabled { get; }
    public bool EffectiveSasEnabled { get; }
    public float SasAuthority { get; }
    public string ControlMode { get; }
    public bool AutopilotEngaged { get; }
    public string AutopilotState { get; }
}

public readonly struct PrototypeMomentumViewModel
{
    public PrototypeMomentumViewModel(string phase, bool isActive, bool noAuthority)
    {
        Phase = phase;
        IsActive = isActive;
        NoAuthority = noAuthority;
    }

    public string Phase { get; }
    public bool IsActive { get; }
    public bool NoAuthority { get; }
}

public readonly struct PrototypeKeybindSectionViewModel
{
    public PrototypeKeybindSectionViewModel(string title, string[] lines, bool debugOnly)
    {
        Title = title;
        Lines = lines;
        DebugOnly = debugOnly;
    }

    public string Title { get; }
    public string[] Lines { get; }
    public bool DebugOnly { get; }
}

public readonly struct PrototypeKeybindModeBindingViewModel
{
    public PrototypeKeybindModeBindingViewModel(
        FlightControlMode mode,
        bool isActive,
        string label,
        string summary,
        string[] differences)
    {
        Mode = mode;
        IsActive = isActive;
        Label = label;
        Summary = summary;
        Differences = differences;
    }

    public FlightControlMode Mode { get; }
    public bool IsActive { get; }
    public string Label { get; }
    public string Summary { get; }
    public string[] Differences { get; }
}

public readonly struct PrototypeKeybindViewModel
{
    public PrototypeKeybindViewModel(
        FlightControlMode activeFlightControlMode,
        string activeFlightControlModeLabel,
        IReadOnlyList<PrototypeKeybindSectionViewModel> commonSections,
        IReadOnlyList<PrototypeKeybindModeBindingViewModel> modeBindings)
    {
        ActiveFlightControlMode = activeFlightControlMode;
        ActiveFlightControlModeLabel = activeFlightControlModeLabel;
        CommonSections = commonSections;
        ModeBindings = modeBindings;
    }

    public FlightControlMode ActiveFlightControlMode { get; }
    public string ActiveFlightControlModeLabel { get; }
    public IReadOnlyList<PrototypeKeybindSectionViewModel> CommonSections { get; }
    public IReadOnlyList<PrototypeKeybindModeBindingViewModel> ModeBindings { get; }
}

public static class PrototypeHudViewModelBuilder
{
    public static PrototypeHudViewModel Build(
        Transform target,
        Rigidbody targetRigidbody,
        PlayerShipController shipController,
        ShipStats targetStats,
        Transform trackedTarget,
        PrototypeWaypointAutopilot waypointAutopilot,
        PrototypeMomentumAssist momentumAssist,
        bool debugVectorsEnabled,
        bool showDebugForceMarkers,
        float navballRadius,
        float velocityMarkerThreshold,
        float forceMarkerReferenceNewton,
        PrototypeFlightHud.HudMode hudMode)
    {
        Vector3 velocity = targetRigidbody != null ? targetRigidbody.linearVelocity : Vector3.zero;
        Vector2 forwardMarker = ProjectDirectionToMarker(target, Vector3.forward, navballRadius);
        Vector2 progradeMarker = Vector2.zero;
        Vector2 retrogradeMarker = Vector2.zero;
        Vector2 sasMarker = Vector2.zero;
        Vector2 targetMarker = Vector2.zero;
        Vector2 desiredMarker = Vector2.zero;
        Vector2 actualMarker = Vector2.zero;
        Vector2 residualMarker = Vector2.zero;

        bool hasVelocity = velocity.magnitude > velocityMarkerThreshold;
        if (hasVelocity)
        {
            progradeMarker = ProjectDirectionToMarker(target, velocity, navballRadius);
            retrogradeMarker = ProjectDirectionToMarker(target, -velocity, navballRadius);
        }

        bool hasSasMarker = shipController != null && shipController.HasSasTargetRotation;
        if (hasSasMarker)
        {
            sasMarker = ProjectDirectionToMarker(target, shipController.SasTargetRotation * Vector3.forward, navballRadius);
        }

        bool hasTargetMarker = target != null && trackedTarget != null && (trackedTarget.position - target.position).sqrMagnitude > 0.0001f;
        if (hasTargetMarker)
        {
            targetMarker = ProjectDirectionToMarker(target, trackedTarget.position - target.position, navballRadius);
        }

        bool hasDebugForceMarkers = false;
        if (shipController != null)
        {
            hasDebugForceMarkers = ShouldShowDebugForceMarkers(showDebugForceMarkers, debugVectorsEnabled, shipController);
        }

        if (hasDebugForceMarkers)
        {
            desiredMarker = ProjectForceVectorToMarker(target, shipController != null ? shipController.LastRcsDesiredForceWorld : Vector3.zero, navballRadius, forceMarkerReferenceNewton);
            actualMarker = ProjectForceVectorToMarker(target, shipController != null ? shipController.LastRcsActualForceWorld : Vector3.zero, navballRadius, forceMarkerReferenceNewton);
            residualMarker = ProjectForceVectorToMarker(target, shipController != null ? shipController.LastRcsResidualForceWorld : Vector3.zero, navballRadius, forceMarkerReferenceNewton);
        }

        PrototypeFlightControlDiagnostics diagnostics = shipController != null ? shipController.FlightControlDiagnostics : default;
        string controlModeHint = ResolveControlModeHint(shipController);
        bool gravityMode = shipController != null && shipController.GravityEnabled;

        PrototypeAutopilotViewModel autopilot = new PrototypeAutopilotViewModel(
            waypointAutopilot != null,
            shipController != null && diagnostics.autopilotEngaged,
            waypointAutopilot != null ? waypointAutopilot.TargetName : "none",
            waypointAutopilot != null ? waypointAutopilot.CurrentState.ToString() : "N/A",
            shipController != null ? diagnostics.autopilotStatus : "unavailable",
            waypointAutopilot != null ? waypointAutopilot.ArrivalPhase.ToString() : string.Empty,
            waypointAutopilot != null ? waypointAutopilot.ArrivalFailureReason : string.Empty);

        PrototypeMomentumAssistViewModel momentum = new PrototypeMomentumAssistViewModel(
            momentumAssist != null,
            momentumAssist != null && momentumAssist.IsActive,
            momentumAssist != null ? momentumAssist.CurrentState : PrototypeMomentumAssistState.Idle,
            momentumAssist != null ? momentumAssist.StatusLabel : "unavailable",
            momentumAssist != null ? momentumAssist.SpeedMetersPerSecond : 0f,
            momentumAssist != null ? momentumAssist.AngularSpeed : 0f);

        float speed = velocity.magnitude;
        float throttle = shipController != null ? shipController.MainActualThrottlePercent : (targetStats != null ? targetStats.LastThrottle * 100f : 0f);
        float fuelCurrent = targetStats != null ? targetStats.CurrentFuelKg : 0f;
        float fuelMax = targetStats != null ? targetStats.MaxFuelKg : 0f;
        float warningFuelThreshold = fuelMax > 0f ? fuelMax * 0.1f : 0f;
        string warningText = ResolveWarningText(targetStats, fuelCurrent, warningFuelThreshold, shipController, waypointAutopilot, momentumAssist);
        bool hasWarning = !string.IsNullOrWhiteSpace(warningText);

        var status = new PrototypeHudStatusViewModel(
            speed,
            throttle,
            fuelCurrent,
            fuelMax,
            hasWarning,
            warningText);

        string modeLabel = ResolveModeLabel(hudMode, velocity, gravityMode, hasTargetMarker, velocityMarkerThreshold);

        return new PrototypeHudViewModel(
            status,
            autopilot,
            momentum,
            hasVelocity,
            forwardMarker,
            progradeMarker,
            retrogradeMarker,
            hasSasMarker,
            sasMarker,
            hasTargetMarker,
            targetMarker,
            hasDebugForceMarkers,
            desiredMarker,
            actualMarker,
            residualMarker,
            modeLabel,
            BuildModeLabelStructure(),
            controlModeHint,
            ResolveSasLabel(shipController));
    }

    public static string BuildModeLabelStructure()
    {
        return "WORLD | VELOCITY | TARGET | DOCKING | ORBIT/GRAVITY";
    }

    public static PrototypeDebugViewModel BuildDebug(
        ShipStats targetStats,
        Rigidbody targetRigidbody,
        PlayerShipController shipController)
    {
        float speed = targetRigidbody != null ? targetRigidbody.linearVelocity.magnitude : 0f;
        float forwardAcceleration = 0f;
        float throttle = shipController != null ? shipController.MainActualThrottlePercent : (targetStats != null ? targetStats.LastThrottle * 100f : 0f);
        float rcsThrottle = shipController != null ? shipController.RcsTranslationForceSetting : 0f;
        bool rcsEnabled = shipController != null && shipController.FlightControlDiagnostics.rcsEnabled;
        bool sasEnabled = shipController != null && shipController.FlightControlDiagnostics.sasEnabled;
        bool effectiveSas = shipController != null && shipController.FlightControlDiagnostics.effectiveSasEnabled;
        float sasAuthority = shipController != null ? shipController.RcsSasAuthority : 0f;
        string mode = shipController != null ? shipController.FlightControlDiagnostics.controlModeLabel : "unknown";

        if (shipController != null)
        {
            forwardAcceleration = shipController.FlightControlDiagnostics.controlMode == FlightControlMode.Normal
                ? shipController.LastForwardAcceleration
                : 0f;
        }

        return new PrototypeDebugViewModel(
            speed,
            forwardAcceleration,
            throttle,
            rcsThrottle,
            rcsEnabled,
            sasEnabled,
            effectiveSas,
            sasAuthority,
            mode,
            shipController != null && shipController.FlightControlDiagnostics.autopilotEngaged,
            shipController != null ? shipController.FlightControlDiagnostics.autopilotStatus : "unavailable");
    }

    public static string ResolveModeLabel(
        PrototypeFlightHud.HudMode hudMode,
        Vector3 velocity,
        bool gravityEnabled,
        bool hasTargetMarker,
        float velocityMarkerThreshold = 0.05f)
    {
        if (hudMode == PrototypeFlightHud.HudMode.OrbitGravity || gravityEnabled)
        {
            return "ORBIT/GRAVITY";
        }

        if (hudMode == PrototypeFlightHud.HudMode.Docking)
        {
            return "DOCKING";
        }

        if (hudMode == PrototypeFlightHud.HudMode.Target || hasTargetMarker)
        {
            return "TARGET";
        }

        if (hudMode == PrototypeFlightHud.HudMode.Velocity || velocity.magnitude > velocityMarkerThreshold)
        {
            return "VELOCITY";
        }

        return "WORLD";
    }

    private static Vector2 ProjectDirectionToMarker(Transform target, Vector3 worldDirection, float navballRadius)
    {
        if (target == null || worldDirection.sqrMagnitude <= Mathf.Epsilon)
        {
            return Vector2.zero;
        }

        Vector3 localDirection = target.InverseTransformDirection(worldDirection.normalized);
        Vector2 projected = new Vector2(localDirection.x, -localDirection.y) * navballRadius;
        return Vector2.ClampMagnitude(projected, navballRadius);
    }

    private static Vector2 ProjectForceVectorToMarker(Transform target, Vector3 force, float navballRadius, float referenceNewton)
    {
        if (force.sqrMagnitude <= 0.0001f)
        {
            return Vector2.zero;
        }

        Vector2 marker = ProjectDirectionToMarker(target, force, navballRadius);
        float magnitudeScale = Mathf.Clamp01(force.magnitude / Mathf.Max(1f, referenceNewton));
        return marker * Mathf.Lerp(0.35f, 1f, magnitudeScale);
    }

    private static string ResolveWarningText(
        ShipStats targetStats,
        float fuelCurrent,
        float warningFuelThreshold,
        PlayerShipController shipController,
        PrototypeWaypointAutopilot waypointAutopilot,
        PrototypeMomentumAssist momentumAssist)
    {
        if (shipController != null && !shipController.HasRcs && shipController.ControlMode != FlightControlMode.Normal)
        {
            return "NO RCS";
        }

        if (waypointAutopilot != null && waypointAutopilot.AutopilotEngaged && !waypointAutopilot.FuelFeasible)
        {
            return "AUTOPILOT FUEL";
        }

        if (waypointAutopilot != null
            && waypointAutopilot.AutopilotEngaged
            && waypointAutopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
        {
            return "AUTOPILOT ABORTED";
        }

        if (momentumAssist != null && momentumAssist.CurrentState == PrototypeMomentumAssistState.NoAuthority)
        {
            return "NO AUTHORITY";
        }

        if (targetStats != null && fuelCurrent <= warningFuelThreshold)
        {
            return "LOW FUEL";
        }

        return string.Empty;
    }

    private static string ResolveControlModeHint(PlayerShipController shipController)
    {
        if (shipController == null)
        {
            return "Mode: n/a";
        }

        return shipController.ControlMode switch
        {
            FlightControlMode.Precision => "Mode: Precision",
            FlightControlMode.Translation => "Mode: Translation",
            _ => "Mode: Cruise"
        };
    }

    private static string ResolveSasLabel(PlayerShipController shipController)
    {
        if (shipController == null)
        {
            return "SAS n/a";
        }

        return shipController.FlightControlDiagnostics.effectiveSasEnabled ? "SAS Eff On" : "SAS Eff Off";
    }

    private static bool ShouldShowDebugForceMarkers(bool showDebugForceMarkers, bool debugVectorsEnabled, PlayerShipController shipController)
    {
        return showDebugForceMarkers || debugVectorsEnabled || shipController.FlightAssistMode == FlightAssistMode.DebugAssist;
    }
}

public static class PrototypeDebugViewModelBuilder
{
    public static PrototypeDebugViewModel Build(ShipStats targetStats, Rigidbody targetRigidbody, PlayerShipController shipController)
    {
        return PrototypeHudViewModelBuilder.BuildDebug(targetStats, targetRigidbody, shipController);
    }
}

public static class PrototypeKeybindViewModelBuilder
{
    public static PrototypeKeybindViewModel Build(FlightControlMode activeFlightControlMode)
    {
        var commonSections = new List<PrototypeKeybindSectionViewModel>(PrototypeInputBindingCatalog.GlobalSections.Length);
        for (int i = 0; i < PrototypeInputBindingCatalog.GlobalSections.Length; i++)
        {
            PrototypeInputBindingSection source = PrototypeInputBindingCatalog.GlobalSections[i];
            commonSections.Add(new PrototypeKeybindSectionViewModel(source.Title, source.Lines, source.DebugOnly));
        }

        var modeBindings = new List<PrototypeKeybindModeBindingViewModel>(3)
        {
            BuildModeBinding(FlightControlMode.Normal, activeFlightControlMode),
            BuildModeBinding(FlightControlMode.Precision, activeFlightControlMode),
            BuildModeBinding(FlightControlMode.Translation, activeFlightControlMode)
        };

        return new PrototypeKeybindViewModel(
            activeFlightControlMode,
            PrototypeInputBindingCatalog.GetModeLabel(activeFlightControlMode),
            commonSections,
            modeBindings);
    }

    private static PrototypeKeybindModeBindingViewModel BuildModeBinding(FlightControlMode mode, FlightControlMode activeMode)
    {
        string[] differences = PrototypeInputBindingCatalog.BuildDifference(mode);
        return new PrototypeKeybindModeBindingViewModel(
            mode,
            mode == activeMode,
            PrototypeInputBindingCatalog.GetModeLabel(mode),
            PrototypeInputBindingCatalog.GetModeSummary(mode),
            differences);
    }
}
