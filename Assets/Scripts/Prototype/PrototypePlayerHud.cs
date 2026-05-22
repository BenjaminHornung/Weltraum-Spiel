using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

public enum PrototypePlayerHudSeverity
{
    Normal,
    Info,
    Warning,
    Danger,
    Disabled
}

public readonly struct PrototypePlayerHudChip
{
    public PrototypePlayerHudChip(string label, PrototypePlayerHudSeverity severity)
    {
        Label = string.IsNullOrWhiteSpace(label) ? string.Empty : label;
        Severity = severity;
    }

    public string Label { get; }
    public PrototypePlayerHudSeverity Severity { get; }
    public bool IsEmpty => string.IsNullOrWhiteSpace(Label);
}

public readonly struct PrototypePlayerFlightSnapshot
{
    public PrototypePlayerFlightSnapshot(
        float speedMetersPerSecond,
        float throttlePercent,
        float fuelCurrentKg,
        float fuelMaxKg,
        string controlModeLabel,
        string controlModeHint,
        string mainEngineLabel,
        string rcsLabel,
        string sasLabel)
    {
        SpeedMetersPerSecond = speedMetersPerSecond;
        ThrottlePercent = Mathf.Clamp(throttlePercent, 0f, 100f);
        FuelCurrentKg = Mathf.Max(0f, fuelCurrentKg);
        FuelMaxKg = Mathf.Max(0f, fuelMaxKg);
        ControlModeLabel = string.IsNullOrWhiteSpace(controlModeLabel) ? "Cruise" : controlModeLabel;
        ControlModeHint = string.IsNullOrWhiteSpace(controlModeHint) ? string.Empty : controlModeHint;
        MainEngineLabel = string.IsNullOrWhiteSpace(mainEngineLabel) ? "Main n/a" : mainEngineLabel;
        RcsLabel = string.IsNullOrWhiteSpace(rcsLabel) ? "RCS n/a" : rcsLabel;
        SasLabel = string.IsNullOrWhiteSpace(sasLabel) ? "SAS n/a" : sasLabel;
    }

    public float SpeedMetersPerSecond { get; }
    public float ThrottlePercent { get; }
    public float FuelCurrentKg { get; }
    public float FuelMaxKg { get; }
    public float FuelPercent => FuelMaxKg > 0.001f ? Mathf.Clamp01(FuelCurrentKg / FuelMaxKg) : 0f;
    public string ControlModeLabel { get; }
    public string ControlModeHint { get; }
    public string MainEngineLabel { get; }
    public string RcsLabel { get; }
    public string SasLabel { get; }
}

public readonly struct PrototypePlayerNavigationSnapshot
{
    public PrototypePlayerNavigationSnapshot(
        bool visible,
        string targetName,
        string targetTypeLabel,
        float distanceMeters,
        float relativeSpeed,
        float closingSpeed,
        float lateralSpeed,
        string etaLabel,
        string stateLabel,
        string phaseLabel,
        string[] warningLabels,
        Vector3[] routeWorldPoints,
        PrototypeTrajectoryPreviewSnapshot trajectoryPreview,
        bool hasAvoidanceCue,
        Vector3 avoidanceWorldPosition,
        string avoidanceLabel)
    {
        Visible = visible;
        TargetName = string.IsNullOrWhiteSpace(targetName) ? "No target" : targetName;
        TargetTypeLabel = string.IsNullOrWhiteSpace(targetTypeLabel) ? "Waypoint" : targetTypeLabel;
        DistanceMeters = Mathf.Max(0f, distanceMeters);
        RelativeSpeed = Mathf.Max(0f, relativeSpeed);
        ClosingSpeed = closingSpeed;
        LateralSpeed = Mathf.Max(0f, lateralSpeed);
        EtaLabel = string.IsNullOrWhiteSpace(etaLabel) ? "--" : etaLabel;
        StateLabel = string.IsNullOrWhiteSpace(stateLabel) ? "Bereit" : stateLabel;
        PhaseLabel = string.IsNullOrWhiteSpace(phaseLabel) ? "Direkter Kurs" : phaseLabel;
        WarningLabels = warningLabels ?? System.Array.Empty<string>();
        RouteWorldPoints = routeWorldPoints ?? System.Array.Empty<Vector3>();
        TrajectoryPreview = trajectoryPreview;
        HasAvoidanceCue = hasAvoidanceCue;
        AvoidanceWorldPosition = avoidanceWorldPosition;
        AvoidanceLabel = string.IsNullOrWhiteSpace(avoidanceLabel) ? string.Empty : avoidanceLabel;
    }

    public bool Visible { get; }
    public string TargetName { get; }
    public string TargetTypeLabel { get; }
    public float DistanceMeters { get; }
    public float RelativeSpeed { get; }
    public float ClosingSpeed { get; }
    public float LateralSpeed { get; }
    public string EtaLabel { get; }
    public string StateLabel { get; }
    public string PhaseLabel { get; }
    public string[] WarningLabels { get; }
    public Vector3[] RouteWorldPoints { get; }
    public PrototypeTrajectoryPreviewSnapshot TrajectoryPreview { get; }
    public bool HasAvoidanceCue { get; }
    public Vector3 AvoidanceWorldPosition { get; }
    public string AvoidanceLabel { get; }
}

public readonly struct PrototypePlayerCombatSnapshot
{
    public PrototypePlayerCombatSnapshot(
        bool visible,
        string targetName,
        float healthPercent,
        string healthLabel,
        float rangeMeters,
        string fireStatusLabel,
        PrototypePlayerHudSeverity fireSeverity,
        string autoFireLabel,
        string priorityLabel)
    {
        Visible = visible;
        TargetName = string.IsNullOrWhiteSpace(targetName) ? "No target" : targetName;
        HealthPercent = Mathf.Clamp01(healthPercent);
        HealthLabel = string.IsNullOrWhiteSpace(healthLabel) ? "--" : healthLabel;
        RangeMeters = Mathf.Max(0f, rangeMeters);
        FireStatusLabel = string.IsNullOrWhiteSpace(fireStatusLabel) ? "Weapon offline" : fireStatusLabel;
        FireSeverity = fireSeverity;
        AutoFireLabel = string.IsNullOrWhiteSpace(autoFireLabel) ? "Auto Fire: Off" : autoFireLabel;
        PriorityLabel = string.IsNullOrWhiteSpace(priorityLabel) ? "ManualOrder" : priorityLabel;
    }

    public bool Visible { get; }
    public string TargetName { get; }
    public float HealthPercent { get; }
    public string HealthLabel { get; }
    public float RangeMeters { get; }
    public string FireStatusLabel { get; }
    public PrototypePlayerHudSeverity FireSeverity { get; }
    public string AutoFireLabel { get; }
    public string PriorityLabel { get; }
}

public readonly struct PrototypePlayerDockingSnapshot
{
    public PrototypePlayerDockingSnapshot(
        bool visible,
        string targetName,
        float distanceMeters,
        float angleErrorDegrees,
        float relativeSpeed,
        float closingSpeed,
        Vector2 lateralOffsetMeters,
        string statusLabel,
        PrototypePlayerHudSeverity statusSeverity,
        string hardLockLabel,
        bool softCaptureRequested,
        string softCaptureLabel,
        bool softCaptureAssistanceRouted,
        string softCaptureAssistLabel,
        float distanceRatio,
        float angleRatio,
        float speedRatio)
    {
        Visible = visible;
        TargetName = string.IsNullOrWhiteSpace(targetName) ? "Docking port" : targetName;
        DistanceMeters = Mathf.Max(0f, distanceMeters);
        AngleErrorDegrees = Mathf.Max(0f, angleErrorDegrees);
        RelativeSpeed = Mathf.Max(0f, relativeSpeed);
        ClosingSpeed = closingSpeed;
        LateralOffsetMeters = lateralOffsetMeters;
        StatusLabel = string.IsNullOrWhiteSpace(statusLabel) ? "Docking n/a" : statusLabel;
        StatusSeverity = statusSeverity;
        HardLockLabel = string.IsNullOrWhiteSpace(hardLockLabel) ? "Prototype: Hard Lock noch nicht verbunden" : hardLockLabel;
        SoftCaptureRequested = softCaptureRequested;
        SoftCaptureLabel = string.IsNullOrWhiteSpace(softCaptureLabel) ? string.Empty : softCaptureLabel;
        SoftCaptureAssistanceRouted = softCaptureAssistanceRouted;
        SoftCaptureAssistLabel = string.IsNullOrWhiteSpace(softCaptureAssistLabel) ? "Assist inaktiv" : softCaptureAssistLabel;
        DistanceRatio = Mathf.Clamp01(distanceRatio);
        AngleRatio = Mathf.Clamp01(angleRatio);
        SpeedRatio = Mathf.Clamp01(speedRatio);
    }

    public bool Visible { get; }
    public string TargetName { get; }
    public float DistanceMeters { get; }
    public float AngleErrorDegrees { get; }
    public float RelativeSpeed { get; }
    public float ClosingSpeed { get; }
    public Vector2 LateralOffsetMeters { get; }
    public string StatusLabel { get; }
    public PrototypePlayerHudSeverity StatusSeverity { get; }
    public string HardLockLabel { get; }
    public bool SoftCaptureRequested { get; }
    public string SoftCaptureLabel { get; }
    public bool SoftCaptureAssistanceRouted { get; }
    public string SoftCaptureAssistLabel { get; }
    public float DistanceRatio { get; }
    public float AngleRatio { get; }
    public float SpeedRatio { get; }
}

public readonly struct PrototypePlayerShipStatusSnapshot
{
    public PrototypePlayerShipStatusSnapshot(
        string fuelLabel,
        string mainEngineLabel,
        string rcsLabel,
        string sasLabel,
        string weaponLabel,
        string damageLabel)
    {
        FuelLabel = string.IsNullOrWhiteSpace(fuelLabel) ? "Fuel n/a" : fuelLabel;
        MainEngineLabel = string.IsNullOrWhiteSpace(mainEngineLabel) ? "Main n/a" : mainEngineLabel;
        RcsLabel = string.IsNullOrWhiteSpace(rcsLabel) ? "RCS n/a" : rcsLabel;
        SasLabel = string.IsNullOrWhiteSpace(sasLabel) ? "SAS n/a" : sasLabel;
        WeaponLabel = string.IsNullOrWhiteSpace(weaponLabel) ? "Weapon n/a" : weaponLabel;
        DamageLabel = string.IsNullOrWhiteSpace(damageLabel) ? "Modules nominal" : damageLabel;
    }

    public string FuelLabel { get; }
    public string MainEngineLabel { get; }
    public string RcsLabel { get; }
    public string SasLabel { get; }
    public string WeaponLabel { get; }
    public string DamageLabel { get; }
}

public readonly struct PrototypePlayerHudSnapshot
{
    public PrototypePlayerHudSnapshot(
        PrototypePlayerFlightSnapshot flight,
        PrototypePlayerNavigationSnapshot navigation,
        PrototypePlayerCombatSnapshot combat,
        PrototypePveArenaSnapshot arena,
        PrototypePlayerDockingSnapshot docking,
        PrototypePlayerShipStatusSnapshot shipStatus,
        PrototypePlayerHudChip[] warnings,
        PrototypePlayerHudChip[] assistChips,
        PrototypeHudViewModel markerModel,
        Vector3 shipWorldPosition,
        Vector3 shipForward,
        Vector3? navigationTargetWorldPosition,
        Vector3? combatTargetWorldPosition)
    {
        Flight = flight;
        Navigation = navigation;
        Combat = combat;
        Arena = arena;
        Docking = docking;
        ShipStatus = shipStatus;
        Warnings = warnings ?? System.Array.Empty<PrototypePlayerHudChip>();
        AssistChips = assistChips ?? System.Array.Empty<PrototypePlayerHudChip>();
        MarkerModel = markerModel;
        ShipWorldPosition = shipWorldPosition;
        ShipForward = shipForward.sqrMagnitude > 0.0001f ? shipForward.normalized : Vector3.forward;
        NavigationTargetWorldPosition = navigationTargetWorldPosition;
        CombatTargetWorldPosition = combatTargetWorldPosition;
    }

    public PrototypePlayerFlightSnapshot Flight { get; }
    public PrototypePlayerNavigationSnapshot Navigation { get; }
    public PrototypePlayerCombatSnapshot Combat { get; }
    public PrototypePveArenaSnapshot Arena { get; }
    public PrototypePlayerDockingSnapshot Docking { get; }
    public PrototypePlayerShipStatusSnapshot ShipStatus { get; }
    public PrototypePlayerHudChip[] Warnings { get; }
    public PrototypePlayerHudChip[] AssistChips { get; }
    public PrototypeHudViewModel MarkerModel { get; }
    public Vector3 ShipWorldPosition { get; }
    public Vector3 ShipForward { get; }
    public Vector3? NavigationTargetWorldPosition { get; }
    public Vector3? CombatTargetWorldPosition { get; }
}

public static class PrototypePlayerHudSnapshotBuilder
{
    public static PrototypePlayerHudSnapshot Build(
        Transform shipRoot,
        Rigidbody shipRigidbody,
        ShipStats stats,
        PlayerShipController controller,
        PrototypeWaypointAutopilot autopilot,
        PrototypeMomentumAssist momentumAssist,
        PrototypeWeaponComputer weaponComputer,
        DockingPort sourceDockingPort,
        DockingPort targetDockingPort,
        PrototypePveArenaLoop arenaLoop = null,
        PrototypeDockingApproachAssist dockingApproachAssist = null,
        PrototypeTrajectoryPreviewNavMap trajectoryPreview = null)
    {
        Transform navTarget = autopilot != null && autopilot.CurrentTarget != null
            ? autopilot.CurrentTarget.transform
            : ResolveFallbackTarget(shipRoot, weaponComputer);
        var markerModel = PrototypeHudViewModelBuilder.Build(
            shipRoot,
            shipRigidbody,
            controller,
            stats,
            navTarget,
            autopilot,
            momentumAssist,
            false,
            false,
            88f,
            0.05f,
            9000f,
            sourceDockingPort != null && targetDockingPort != null
                ? PrototypeFlightHud.HudMode.Docking
                : PrototypeFlightHud.HudMode.World);

        PrototypePlayerFlightSnapshot flight = BuildFlight(shipRigidbody, stats, controller);
        PrototypePlayerNavigationSnapshot navigation = BuildNavigation(autopilot, trajectoryPreview);
        PrototypePlayerCombatSnapshot combat = BuildCombat(weaponComputer);
        PrototypePveArenaSnapshot arena = arenaLoop != null ? arenaLoop.Snapshot : default;
        PrototypePlayerDockingSnapshot docking = BuildDocking(sourceDockingPort, targetDockingPort, shipRigidbody, dockingApproachAssist);
        PrototypePlayerShipStatusSnapshot shipStatus = BuildShipStatus(stats, controller, weaponComputer);
        PrototypePlayerHudChip[] warnings = BuildWarningChips(stats, controller, autopilot, momentumAssist, combat, docking);
        PrototypePlayerHudChip[] assists = BuildAssistChips(autopilot, momentumAssist, navigation, combat, docking, arena);

        return new PrototypePlayerHudSnapshot(
            flight,
            navigation,
            combat,
            arena,
            docking,
            shipStatus,
            warnings,
            assists,
            markerModel,
            shipRoot != null ? shipRoot.position : Vector3.zero,
            shipRoot != null ? shipRoot.forward : Vector3.forward,
            autopilot != null && autopilot.CurrentTarget != null ? autopilot.CurrentTarget.Position : (Vector3?)null,
            weaponComputer != null && weaponComputer.ActiveTargetTransform != null ? weaponComputer.ActiveTargetTransform.position : (Vector3?)null);
    }

    public static string TranslateNavigationState(PrototypeWaypointAutopilotState state)
    {
        switch (state)
        {
            case PrototypeWaypointAutopilotState.TargetSelected:
                return "Ziel gewaehlt";
            case PrototypeWaypointAutopilotState.FuelCheck:
                return "Treibstoff pruefen";
            case PrototypeWaypointAutopilotState.AlignForBurn:
                return "Zum Schub ausrichten";
            case PrototypeWaypointAutopilotState.Accelerate:
                return "Beschleunigen";
            case PrototypeWaypointAutopilotState.ObstacleAvoidance:
                return "Ausweichkurs";
            case PrototypeWaypointAutopilotState.FlipForBrake:
                return "Zum Bremsen drehen";
            case PrototypeWaypointAutopilotState.Brake:
                return "Bremsen";
            case PrototypeWaypointAutopilotState.FinalApproach:
                return "Endanflug";
            case PrototypeWaypointAutopilotState.HoldPosition:
                return "Position halten";
            case PrototypeWaypointAutopilotState.Complete:
                return "Angekommen";
            case PrototypeWaypointAutopilotState.Aborted:
                return "Abgebrochen";
            case PrototypeWaypointAutopilotState.FuelInsufficient:
                return "Zu wenig Treibstoff";
            case PrototypeWaypointAutopilotState.Failed:
                return "Autopilot nicht moeglich";
            default:
                return "Autopilot aus";
        }
    }

    public static string TranslateArrivalPhase(PrototypeWaypointAutopilotArrivalPhase phase)
    {
        switch (phase)
        {
            case PrototypeWaypointAutopilotArrivalPhase.Brake:
                return "Bremsphase";
            case PrototypeWaypointAutopilotArrivalPhase.LateralCorrection:
                return "Seitendrift korrigieren";
            case PrototypeWaypointAutopilotArrivalPhase.FinalApproach:
                return "Endanflug";
            case PrototypeWaypointAutopilotArrivalPhase.Hold:
                return "Halten";
            default:
                return "Reiseflug-Burn";
        }
    }

    public static string TranslateNavigationPhase(PrototypeWaypointAutopilotNavigationPhase phase)
    {
        switch (phase)
        {
            case PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning:
                return "Ausweichkurs planen";
            case PrototypeWaypointAutopilotNavigationPhase.Avoiding:
                return "Ausweichen";
            case PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath:
                return "Direktkurs wieder aufnehmen";
            case PrototypeWaypointAutopilotNavigationPhase.Brake:
                return "Bremsen";
            case PrototypeWaypointAutopilotNavigationPhase.FinalApproach:
                return "Endanflug";
            case PrototypeWaypointAutopilotNavigationPhase.Hold:
                return "Halten";
            default:
                return "Direkter Kurs";
        }
    }

    public static string TranslateWarning(string warning)
    {
        if (string.IsNullOrWhiteSpace(warning))
        {
            return string.Empty;
        }

        switch (warning.Trim())
        {
            case "LOW FUEL":
                return "Treibstoff niedrig";
            case "NO RCS":
                return "RCS nicht verfuegbar";
            case "NO AUTHORITY":
                return "Keine Steuerautoritaet";
            case "AUTOPILOT FUEL":
            case "FuelInsufficient":
            case "Fuel Insufficient":
                return "Autopilot: zu wenig Treibstoff";
            case "AUTOPILOT ABORTED":
            case "Aborted":
                return "Autopilot abgebrochen";
            case "No Target":
            case "NO TARGET":
                return "Kein Navigationsziel";
            case "No Authority":
                return "Keine Steuerautoritaet";
            case "LimitedRcsAuthority":
            case "Limited RCS":
                return "RCS limitiert";
            case "LimitedHoldAuthority":
            case "Limited Hold":
                return "Halten limitiert";
            case "Obstacle":
                return "Hindernis";
            case "Avoidance":
                return "Ausweichkurs";
            case "OutOfArc":
                return "Ziel ausserhalb Feuerwinkel";
            case "OutOfRange":
                return "Ziel ausser Reichweite";
            case "Cooldown":
                return "Waffe laedt";
            case "NoMuzzle":
                return "Waffe offline";
            default:
                return TranslateDockingDiagnostic(warning);
        }
    }

    public static string TranslateDockingDiagnostic(string diagnostic)
    {
        switch (diagnostic)
        {
            case "outside-capture-radius":
                return "Ausser Docking-Reichweite";
            case "angle-too-large":
                return "Ausrichtung zu schraeg";
            case "relative-velocity-too-high":
                return "Anflug zu schnell";
            case "soft-capture-disabled":
                return "Soft Capture deaktiviert";
            case "soft-capture-eligible":
                return "Soft Capture bereit";
            case "outside-hard-lock-radius":
                return "Fuer Lock zu weit entfernt";
            case "hard-lock-angle-too-large":
                return "Fuer Lock zu schraeg";
            case "hard-lock-velocity-too-high":
                return "Fuer Lock zu schnell";
            case "hard-lock-eligible":
                return "Lock-Kriterien erfuellt";
            case "hard-lock-placeholder":
            case "hard-lock-joint-not-yet-implemented":
                return "Prototype: Hard Lock noch nicht verbunden";
            case "soft-capture-requested":
                return "Soft Capture bereit";
            case "soft-capture-zero-request":
                return "Soft Capture wartet";
            case "soft-capture-not-eligible":
                return "Soft Capture nicht bereit";
            default:
                return string.IsNullOrWhiteSpace(diagnostic) ? string.Empty : diagnostic;
        }
    }

    public static string TranslateFireStatus(PrototypeTurretFireStatus status)
    {
        if (status.canFire)
        {
            return status.hasSelectedTarget ? "Bereit" : "Boresight bereit";
        }

        switch (status.blockReason)
        {
            case PrototypeTurretFireBlockReason.NoMuzzle:
            case PrototypeTurretFireBlockReason.MissingImportedMarker:
                return "Waffe offline";
            case PrototypeTurretFireBlockReason.NoAuthority:
            case PrototypeTurretFireBlockReason.SafetyDataMissing:
            case PrototypeTurretFireBlockReason.SafetyUnsafe:
                return "Keine Waffenautoritaet";
            case PrototypeTurretFireBlockReason.OutOfArc:
                return "Ausserhalb Feuerwinkel";
            case PrototypeTurretFireBlockReason.Cooldown:
                return "Cooldown " + status.cooldownRemainingSeconds.ToString("0.0") + "s";
            case PrototypeTurretFireBlockReason.OutOfRange:
                return "Ausser Reichweite";
            case PrototypeTurretFireBlockReason.Aligning:
                return "Ausrichten";
            default:
                return string.IsNullOrWhiteSpace(status.message) ? "Waffe wartet" : status.message;
        }
    }

    public static string BuildPlayerHelpText(FlightControlMode activeMode, bool includeDebugControls)
    {
        var lines = new List<string>();
        lines.Add("Modus: " + PrototypeInputBindingCatalog.GetModeLabel(activeMode));
        lines.AddRange(PrototypeInputBindingCatalog.BuildDifference(activeMode));
        if (!includeDebugControls)
        {
            lines.Add("F1: player help");
        }

        PrototypeInputBindingSection[] sections = PrototypeInputBindingCatalog.GlobalSections;
        for (int i = 0; i < sections.Length; i++)
        {
            PrototypeInputBindingSection section = sections[i];
            if (!includeDebugControls && section.Title == "UI")
            {
                continue;
            }

            if (section.DebugOnly && !includeDebugControls)
            {
                continue;
            }

            for (int j = 0; j < section.Lines.Length; j++)
            {
                string line = section.Lines[j];
                if (!includeDebugControls && IsDebugHelpLine(line))
                {
                    continue;
                }

                lines.Add(line);
            }
        }

        return string.Join("\n", lines);
    }

    private static bool IsDebugHelpLine(string line)
    {
        if (string.IsNullOrWhiteSpace(line))
        {
            return true;
        }

        string lower = line.ToLowerInvariant();
        return lower.Contains("debug")
            || lower.Contains("diagnostics")
            || lower.Contains("refill")
            || lower.Contains("des/act/res")
            || lower.Contains("cycle generated/imported")
            || lower.Contains("weapon computer")
            || lower.Contains("hud/navball")
            || lower.Contains("minimap/radar");
    }

    private static PrototypePlayerFlightSnapshot BuildFlight(
        Rigidbody shipRigidbody,
        ShipStats stats,
        PlayerShipController controller)
    {
        PrototypeFlightControlDiagnostics diagnostics = controller != null ? controller.FlightControlDiagnostics : default;
        float speed = shipRigidbody != null ? shipRigidbody.linearVelocity.magnitude : 0f;
        float throttle = controller != null ? controller.MainActualThrottlePercent : (stats != null ? stats.LastThrottle * 100f : 0f);
        string mode = controller != null ? PrototypeInputBindingCatalog.GetModeLabel(controller.ControlMode) : "Cruise";
        string modeHint = controller != null ? PrototypeInputBindingCatalog.GetModeSummary(controller.ControlMode) : string.Empty;
        string main = controller == null
            ? "Main n/a"
            : diagnostics.mainThrusterAllowed ? "Main ready" : "Main disabled by mode";
        if (controller != null && controller.MainThermalOverheated)
        {
            main = "Main overheated";
        }

        string rcs = controller == null
            ? "RCS n/a"
            : !controller.HasRcs ? "RCS no authority" : diagnostics.rcsEnabled ? "RCS ready" : "RCS off";
        string sas = controller == null
            ? "SAS n/a"
            : diagnostics.effectiveSasEnabled ? "SAS on" : diagnostics.sasEnabled ? "SAS inverted" : "SAS off";
        if (controller != null && diagnostics.sasEnabled && !diagnostics.sasHasAuthority)
        {
            sas = "SAS ineffective";
        }

        return new PrototypePlayerFlightSnapshot(
            speed,
            throttle,
            stats != null ? stats.CurrentFuelKg : 0f,
            stats != null ? stats.MaxFuelKg : 0f,
            mode,
            modeHint,
            main,
            rcs,
            sas);
    }

    private static PrototypePlayerNavigationSnapshot BuildNavigation(PrototypeWaypointAutopilot autopilot, PrototypeTrajectoryPreviewNavMap trajectoryPreview)
    {
        PrototypeTrajectoryPreviewSnapshot preview = trajectoryPreview != null
            ? trajectoryPreview.RefreshPreview()
            : PrototypeTrajectoryPreviewSnapshot.Unavailable("Trajectory Preview", 0, 0f);
        if (autopilot == null || autopilot.CurrentTarget == null)
        {
            return new PrototypePlayerNavigationSnapshot(
                preview.HasRenderablePoints,
                preview.HasRenderablePoints ? "Trajectory Preview" : "No target",
                preview.HasRenderablePoints ? "Nav Map" : "Waypoint",
                0f,
                0f,
                0f,
                0f,
                "--",
                "Bereit",
                preview.HasRenderablePoints ? preview.SourceLabel : "Direkter Kurs",
                System.Array.Empty<string>(),
                System.Array.Empty<Vector3>(),
                preview,
                false,
                Vector3.zero,
                string.Empty);
        }

        string eta = FormatNavigationEta(autopilot.EtaSeconds, autopilot.ClosingSpeed);
        string[] sourceWarnings = autopilot.BuildNavigationWarningChips();
        string[] warnings = new string[sourceWarnings.Length];
        for (int i = 0; i < sourceWarnings.Length; i++)
        {
            warnings[i] = TranslateWarning(sourceWarnings[i]);
        }

        Vector3[] routePoints = CopyRoutePoints(autopilot.PredictedRoute, 8);
        bool hasAvoidanceCue = autopilot.AvoidanceActive || autopilot.NavigationObstacleDetected;
        bool visible = autopilot.CurrentTarget != null || autopilot.AutopilotEngaged;
        return new PrototypePlayerNavigationSnapshot(
            visible,
            autopilot.TargetName,
            ResolveNavigationTargetType(autopilot.CurrentTarget),
            autopilot.DistanceToTarget,
            autopilot.LastMetrics.relativeSpeed,
            autopilot.ClosingSpeed,
            autopilot.LateralSpeed,
            eta,
            TranslateNavigationState(autopilot.CurrentState),
            TranslateNavigationPhase(autopilot.NavigationPhase),
            warnings,
            routePoints,
            preview,
            hasAvoidanceCue,
            autopilot.AvoidanceWaypoint,
            hasAvoidanceCue ? BuildAvoidanceLabel(autopilot) : string.Empty);
    }

    private static PrototypePlayerCombatSnapshot BuildCombat(PrototypeWeaponComputer weaponComputer)
    {
        if (weaponComputer == null)
        {
            return new PrototypePlayerCombatSnapshot(
                false,
                "No target",
                0f,
                "--",
                0f,
                "Weapon offline",
                PrototypePlayerHudSeverity.Disabled,
                "Auto Fire: Off",
                "ManualOrder");
        }

        PrototypeWeaponTarget target = weaponComputer.ActiveTarget;
        PrototypeTurretFireStatus fireStatus = weaponComputer.LastTurretStatus;
        bool hasTarget = target != null && target.IsValid;
        float healthPercent = hasTarget ? target.CurrentHealth / Mathf.Max(1f, target.MaxHealth) : 0f;
        string health = hasTarget ? target.CurrentHealth.ToString("0") + "/" + target.MaxHealth.ToString("0") : "--";
        string autoFire = BuildAutoFireLabel(weaponComputer.AutoFireEnabled, hasTarget, fireStatus);
        string fireLabel = TranslateFireStatus(fireStatus);
        PrototypePlayerHudSeverity severity = fireStatus.canFire
            ? PrototypePlayerHudSeverity.Info
            : FireBlockSeverity(fireStatus.blockReason);

        return new PrototypePlayerCombatSnapshot(
            hasTarget || weaponComputer.AutoFireEnabled,
            hasTarget ? target.Label : "No target",
            healthPercent,
            health,
            fireStatus.distanceMeters,
            fireLabel,
            severity,
            autoFire,
            weaponComputer.PriorityMode.ToString());
    }

    private static PrototypePlayerDockingSnapshot BuildDocking(
        DockingPort source,
        DockingPort target,
        Rigidbody sourceRigidbody,
        PrototypeDockingApproachAssist dockingApproachAssist)
    {
        if (source == null || target == null)
        {
            return new PrototypePlayerDockingSnapshot(
                false,
                "Docking port",
                0f,
                0f,
                0f,
                0f,
                Vector2.zero,
                "Docking n/a",
                PrototypePlayerHudSeverity.Disabled,
                "Prototype: Hard Lock noch nicht verbunden",
                false,
                string.Empty,
                false,
                "Assist inaktiv",
                0f,
                0f,
                0f);
        }

        Rigidbody targetRigidbody = target.GetComponentInParent<Rigidbody>();
        if (!source.TryCalculateRelativeState(target, sourceRigidbody, targetRigidbody, out DockingRelativeState state))
        {
            return new PrototypePlayerDockingSnapshot(
                true,
                target.name,
                0f,
                0f,
                0f,
                0f,
                Vector2.zero,
                TranslateDockingDiagnostic(state.diagnostic),
                PrototypePlayerHudSeverity.Warning,
                "Prototype: Hard Lock noch nicht verbunden",
                false,
                string.Empty,
                false,
                "Assist inaktiv",
                0f,
                0f,
                0f);
        }

        DockingEligibility eligibility = source.EvaluateEligibility(target, state);
        DockingSoftCaptureRequest softCapture = source.BuildSoftCaptureRequest(target, state, eligibility);
        DockingHardLockResult hardLock = source.BuildHardLockPrototype(target, eligibility);
        string hardLockLabel = hardLock.lockRequested && !hardLock.jointCreated
            ? TranslateDockingDiagnostic(hardLock.diagnostic)
            : TranslateDockingDiagnostic(eligibility.diagnostic);
        string softCaptureLabel = softCapture.requested
            ? "Soft Capture bereit"
            : TranslateDockingDiagnostic(softCapture.diagnostic);
        bool assistRouted = dockingApproachAssist != null
            && dockingApproachAssist.IsAssistanceRouted
            && dockingApproachAssist.TargetDockingPort == target;
        string assistLabel = assistRouted ? "Soft Capture Assist aktiv" : "Soft Capture Assist inaktiv";
        PrototypePlayerHudSeverity severity = eligibility.canSoftCapture || eligibility.canHardLock
            ? PrototypePlayerHudSeverity.Info
            : PrototypePlayerHudSeverity.Warning;
        float captureRadius = Mathf.Max(0.001f, Mathf.Min(source.CaptureRadius, target.CaptureRadius));
        float softAngle = Mathf.Max(0.001f, Mathf.Min(source.SoftCaptureAngleDegrees, target.SoftCaptureAngleDegrees));
        float softVelocity = Mathf.Max(0.001f, Mathf.Min(source.SoftCaptureMaxRelativeVelocity, target.SoftCaptureMaxRelativeVelocity));

        return new PrototypePlayerDockingSnapshot(
            true,
            target.name,
            state.distance,
            state.angleErrorDegrees,
            state.relativeSpeed,
            state.closingSpeed,
            new Vector2(state.offsetLocal.x, state.offsetLocal.y),
            TranslateDockingDiagnostic(eligibility.diagnostic),
            severity,
            hardLockLabel,
            softCapture.requested,
            softCaptureLabel,
            assistRouted,
            assistLabel,
            state.distance / captureRadius,
            state.angleErrorDegrees / softAngle,
            state.relativeSpeed / softVelocity);
    }

    private static PrototypePlayerShipStatusSnapshot BuildShipStatus(
        ShipStats stats,
        PlayerShipController controller,
        PrototypeWeaponComputer weaponComputer)
    {
        string fuel = stats != null
            ? "Fuel " + (stats.CurrentFuelKg / Mathf.Max(0.01f, stats.MaxFuelKg) * 100f).ToString("0") + "%"
            : "Fuel n/a";
        string main = controller != null && controller.FlightControlDiagnostics.mainThrusterAllowed
            ? "Main ready"
            : "Main disabled";
        string rcs = controller != null && controller.HasRcs
            ? controller.RcsEnabled ? "RCS ready" : "RCS off"
            : "RCS no authority";
        string sas = controller != null && controller.EffectiveSasEnabled ? "SAS on" : "SAS off";
        string weapon = "Weapon n/a";
        if (weaponComputer != null)
        {
            PrototypeTurretFireStatus fireStatus = weaponComputer.LastTurretStatus;
            bool idleWithoutTarget = weaponComputer.ActiveTarget == null && !weaponComputer.AutoFireEnabled && !fireStatus.hasSelectedTarget;
            weapon = idleWithoutTarget ? "Weapon standby" : TranslateFireStatus(fireStatus);
        }
        string damage = BuildDamageSummary(controller);

        return new PrototypePlayerShipStatusSnapshot(fuel, main, rcs, sas, weapon, damage);
    }

    private static string BuildDamageSummary(PlayerShipController controller)
    {
        if (controller == null)
        {
            return "Modules nominal";
        }

        PrototypeModuleDamageState[] states = controller.GetComponentsInChildren<PrototypeModuleDamageState>(true);
        if (states == null || states.Length == 0)
        {
            return "Modules nominal";
        }

        int damagedCount = 0;
        PrototypeModuleDamageState worst = null;
        float worstIntegrity = 1f;
        for (int i = 0; i < states.Length; i++)
        {
            PrototypeModuleDamageState state = states[i];
            if (state == null)
            {
                continue;
            }

            if (state.IsDamaged)
            {
                damagedCount++;
            }

            if (worst == null || state.IntegrityFraction < worstIntegrity)
            {
                worst = state;
                worstIntegrity = state.IntegrityFraction;
            }
        }

        if (damagedCount == 0 || worst == null)
        {
            return "Modules nominal";
        }

        bool rcsReduced = false;
        RcsThrusterBlock[] rcsBlocks = controller.GetComponentsInChildren<RcsThrusterBlock>(true);
        for (int i = 0; i < rcsBlocks.Length; i++)
        {
            RcsThrusterBlock block = rcsBlocks[i];
            if (block != null && block.DamageState != null && block.DamageState.IsDamaged && block.DamageCapabilityMultiplier < 0.999f)
            {
                rcsReduced = true;
                break;
            }
        }

        string label = damagedCount.ToString() + " modules damaged | "
            + worst.ModuleName + " " + (worst.IntegrityFraction * 100f).ToString("0") + "%";
        if (worst.IntegrityFraction <= 0.25f)
        {
            label += " | Module critical";
        }

        if (rcsReduced)
        {
            label += " | RCS thrust reduced";
        }

        return label;
    }

    private static PrototypePlayerHudChip[] BuildWarningChips(
        ShipStats stats,
        PlayerShipController controller,
        PrototypeWaypointAutopilot autopilot,
        PrototypeMomentumAssist momentumAssist,
        PrototypePlayerCombatSnapshot combat,
        PrototypePlayerDockingSnapshot docking)
    {
        var chips = new List<PrototypePlayerHudChip>();
        if (stats != null)
        {
            float fuelPercent = stats.CurrentFuelKg / Mathf.Max(0.01f, stats.MaxFuelKg);
            if (fuelPercent <= 0.001f)
            {
                AddOrPromoteUnique(chips, "Treibstoff leer", PrototypePlayerHudSeverity.Danger);
            }
            else if (fuelPercent <= 0.1f)
            {
                AddOrPromoteUnique(chips, "Treibstoff niedrig", PrototypePlayerHudSeverity.Warning);
            }
        }

        if (controller != null && !controller.HasRcs && controller.ControlMode != FlightControlMode.Normal)
        {
            AddOrPromoteUnique(chips, "RCS nicht verfuegbar", PrototypePlayerHudSeverity.Danger);
        }

        if (autopilot != null)
        {
            if (autopilot.AutopilotEngaged && !autopilot.FuelFeasible)
            {
                AddOrPromoteUnique(chips, "Autopilot: zu wenig Treibstoff", PrototypePlayerHudSeverity.Warning);
            }

            if (autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted || autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
            {
                AddOrPromoteUnique(chips, "Autopilot abgebrochen", PrototypePlayerHudSeverity.Warning);
            }

            string[] navWarnings = autopilot.BuildNavigationWarningChips();
            for (int i = 0; i < navWarnings.Length; i++)
            {
                string translatedWarning = TranslateWarning(navWarnings[i]);
                AddOrPromoteUnique(chips, translatedWarning, SeverityForWarning(navWarnings[i], translatedWarning));
            }
        }

        if (momentumAssist != null && momentumAssist.CurrentState == PrototypeMomentumAssistState.NoAuthority)
        {
            AddOrPromoteUnique(chips, "Keine Steuerautoritaet", PrototypePlayerHudSeverity.Danger);
        }

        if (combat.Visible && combat.FireSeverity != PrototypePlayerHudSeverity.Info && combat.FireSeverity != PrototypePlayerHudSeverity.Normal)
        {
            AddOrPromoteUnique(chips, combat.FireStatusLabel, combat.FireSeverity);
        }

        if (docking.Visible && docking.StatusSeverity == PrototypePlayerHudSeverity.Warning)
        {
            AddOrPromoteUnique(chips, docking.StatusLabel, PrototypePlayerHudSeverity.Warning);
        }

        SortChipsBySeverity(chips);
        return chips.ToArray();
    }

    private static PrototypePlayerHudChip[] BuildAssistChips(
        PrototypeWaypointAutopilot autopilot,
        PrototypeMomentumAssist momentumAssist,
        PrototypePlayerNavigationSnapshot navigation,
        PrototypePlayerCombatSnapshot combat,
        PrototypePlayerDockingSnapshot docking,
        PrototypePveArenaSnapshot arena)
    {
        var chips = new List<PrototypePlayerHudChip>();
        if (autopilot != null && autopilot.AutopilotEngaged)
        {
            AddOrPromoteUnique(chips, "Autopilot: " + TranslateNavigationState(autopilot.CurrentState), PrototypePlayerHudSeverity.Info);
        }

        if (momentumAssist != null && momentumAssist.IsActive)
        {
            AddOrPromoteUnique(chips, "Kill Momentum: " + TranslateMomentumState(momentumAssist.CurrentState), PrototypePlayerHudSeverity.Info);
        }

        if (navigation.TrajectoryPreview.Enabled && navigation.TrajectoryPreview.IsAvailable)
        {
            AddOrPromoteUnique(chips, navigation.TrajectoryPreview.StatusLabel, navigation.TrajectoryPreview.HasRenderablePoints ? PrototypePlayerHudSeverity.Info : PrototypePlayerHudSeverity.Disabled);
        }

        if (docking.Visible && docking.StatusSeverity == PrototypePlayerHudSeverity.Info)
        {
            AddOrPromoteUnique(chips, docking.SoftCaptureAssistanceRouted ? docking.SoftCaptureAssistLabel : (docking.SoftCaptureRequested ? docking.SoftCaptureLabel : docking.StatusLabel), PrototypePlayerHudSeverity.Info);
        }

        if (combat.Visible && combat.AutoFireLabel.Contains("Armed"))
        {
            AddOrPromoteUnique(chips, "Auto Fire", PrototypePlayerHudSeverity.Info);
        }

        if (arena.IsVisible)
        {
            AddOrPromoteUnique(
                chips,
                arena.Completed ? arena.RewardStubLabel : "Arena " + arena.ProgressLabel,
                arena.Completed ? PrototypePlayerHudSeverity.Info : PrototypePlayerHudSeverity.Normal);
        }

        return chips.ToArray();
    }

    private static string TranslateMomentumState(PrototypeMomentumAssistState state)
    {
        switch (state)
        {
            case PrototypeMomentumAssistState.AlignForBrake:
                return "Ausrichten";
            case PrototypeMomentumAssistState.MainBrake:
                return "Haupttriebwerk bremst";
            case PrototypeMomentumAssistState.RcsDamp:
                return "RCS daempft";
            case PrototypeMomentumAssistState.Complete:
                return "Abgeschlossen";
            case PrototypeMomentumAssistState.Aborted:
                return "Abgebrochen";
            case PrototypeMomentumAssistState.NoAuthority:
                return "Keine Autoritaet";
            case PrototypeMomentumAssistState.FuelInsufficient:
                return "Zu wenig Treibstoff";
            default:
                return "Bereit";
        }
    }

    private static string BuildAutoFireLabel(bool enabled, bool hasTarget, PrototypeTurretFireStatus status)
    {
        if (!enabled)
        {
            return "Auto Fire: Off";
        }

        if (!hasTarget)
        {
            return "Auto Fire: No target";
        }

        return status.canFire
            ? "Auto Fire: Armed"
            : "Auto Fire: Waiting - " + TranslateFireStatus(status);
    }

    private static PrototypePlayerHudSeverity FireBlockSeverity(PrototypeTurretFireBlockReason reason)
    {
        switch (reason)
        {
            case PrototypeTurretFireBlockReason.NoMuzzle:
            case PrototypeTurretFireBlockReason.NoAuthority:
            case PrototypeTurretFireBlockReason.MissingImportedMarker:
            case PrototypeTurretFireBlockReason.SafetyDataMissing:
            case PrototypeTurretFireBlockReason.SafetyUnsafe:
                return PrototypePlayerHudSeverity.Danger;
            case PrototypeTurretFireBlockReason.None:
                return PrototypePlayerHudSeverity.Info;
            default:
                return PrototypePlayerHudSeverity.Warning;
        }
    }

    private static void AddOrPromoteUnique(List<PrototypePlayerHudChip> chips, string label, PrototypePlayerHudSeverity severity)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return;
        }

        for (int i = 0; i < chips.Count; i++)
        {
            if (chips[i].Label == label)
            {
                if (SeverityRank(severity) < SeverityRank(chips[i].Severity))
                {
                    chips[i] = new PrototypePlayerHudChip(label, severity);
                }

                return;
            }
        }

        chips.Add(new PrototypePlayerHudChip(label, severity));
    }

    private static PrototypePlayerHudSeverity SeverityForWarning(string sourceWarning, string translatedWarning)
    {
        string source = string.IsNullOrWhiteSpace(sourceWarning) ? string.Empty : sourceWarning.ToLowerInvariant();
        string translated = string.IsNullOrWhiteSpace(translatedWarning) ? string.Empty : translatedWarning.ToLowerInvariant();
        if (source.Contains("authority") || translated.Contains("autoritaet") || translated.Contains("nicht verfuegbar"))
        {
            return PrototypePlayerHudSeverity.Danger;
        }

        if (source.Contains("aborted") || source.Contains("failed"))
        {
            return PrototypePlayerHudSeverity.Warning;
        }

        return PrototypePlayerHudSeverity.Warning;
    }

    private static void SortChipsBySeverity(List<PrototypePlayerHudChip> chips)
    {
        chips.Sort((left, right) => SeverityRank(left.Severity).CompareTo(SeverityRank(right.Severity)));
    }

    private static int SeverityRank(PrototypePlayerHudSeverity severity)
    {
        switch (severity)
        {
            case PrototypePlayerHudSeverity.Danger:
                return 0;
            case PrototypePlayerHudSeverity.Warning:
                return 1;
            case PrototypePlayerHudSeverity.Info:
                return 2;
            case PrototypePlayerHudSeverity.Normal:
                return 3;
            case PrototypePlayerHudSeverity.Disabled:
                return 4;
            default:
                return 5;
        }
    }

    private static string FormatEta(float eta)
    {
        if (float.IsNaN(eta) || float.IsInfinity(eta) || eta <= 0f)
        {
            return "--";
        }

        if (eta >= 60f)
        {
            int minutes = Mathf.FloorToInt(eta / 60f);
            int seconds = Mathf.RoundToInt(eta - (minutes * 60f));
            return minutes + "m " + seconds.ToString("00") + "s";
        }

        return eta.ToString("0") + "s";
    }

    private static string FormatNavigationEta(float eta, float closingSpeed)
    {
        if ((float.IsNaN(eta) || float.IsInfinity(eta) || eta <= 0f) && closingSpeed <= 0.05f)
        {
            return "nicht auf Kurs";
        }

        return FormatEta(eta);
    }

    private static Vector3[] CopyRoutePoints(Vector3[] source, int maxPoints)
    {
        if (source == null || source.Length == 0 || maxPoints <= 0)
        {
            return System.Array.Empty<Vector3>();
        }

        int count = Mathf.Min(source.Length, maxPoints);
        var points = new Vector3[count];
        for (int i = 0; i < count; i++)
        {
            points[i] = source[i];
        }

        return points;
    }

    private static string BuildAvoidanceLabel(PrototypeWaypointAutopilot autopilot)
    {
        if (autopilot == null)
        {
            return string.Empty;
        }

        if (autopilot.AvoidanceActive)
        {
            return "Ausweichkurs: " + autopilot.AvoidanceTargetName;
        }

        if (autopilot.NavigationObstacleDetected)
        {
            return "Hindernis: " + autopilot.AvoidanceTargetName;
        }

        return string.Empty;
    }

    private static string ResolveNavigationTargetType(PrototypeNavigationTarget target)
    {
        if (target == null)
        {
            return "Waypoint";
        }

        Transform root = target.transform;
        if (root.GetComponentInParent<DockingPort>() != null || root.GetComponentInChildren<DockingPort>() != null)
        {
            return "Docking";
        }

        if (root.GetComponentInParent<PrototypeModuleDamageState>() != null
            || root.GetComponentInChildren<PrototypeModuleDamageState>() != null
            || root.GetComponentInParent<PrototypeTargetDummy>() != null
            || root.GetComponentInChildren<PrototypeTargetDummy>() != null)
        {
            return "Combat";
        }

        string lowerName = target.DisplayName.ToLowerInvariant();
        if (lowerName.Contains("station"))
        {
            return "Station";
        }

        if (lowerName.Contains("beacon"))
        {
            return "Beacon";
        }

        if (lowerName.Contains("gate"))
        {
            return "Gate";
        }

        return "Waypoint";
    }

    private static Transform ResolveFallbackTarget(Transform shipRoot, PrototypeWeaponComputer weaponComputer)
    {
        if (weaponComputer != null && weaponComputer.ActiveTargetTransform != null)
        {
            return weaponComputer.ActiveTargetTransform;
        }

        PrototypeTargetDummy dummy = UnityEngine.Object.FindAnyObjectByType<PrototypeTargetDummy>();
        if (dummy != null && (shipRoot == null || !dummy.transform.IsChildOf(shipRoot)))
        {
            return dummy.transform;
        }

        return null;
    }
}

[RequireComponent(typeof(Camera))]
public class PrototypePlayerHudRenderer : MonoBehaviour
{
    private const float MarkerRadius = 88f;
    private const float CanvasReferenceWidth = 1280f;
    private const float CanvasReferenceHeight = 720f;

    [SerializeField] private Transform shipRoot;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PlayerShipController controller;
    [SerializeField] private PrototypeWaypointAutopilot autopilot;
    [SerializeField] private PrototypeMomentumAssist momentumAssist;
    [SerializeField] private PrototypeWeaponComputer weaponComputer;
    [SerializeField] private PrototypePveArenaLoop arenaLoop;
    [SerializeField] private PrototypeDockingApproachAssist dockingApproachAssist;
    [SerializeField] private PrototypeTrajectoryPreviewNavMap trajectoryPreview;
    [SerializeField] private DockingPort sourceDockingPort;
    [SerializeField] private DockingPort targetDockingPort;
    [SerializeField] private bool showPlayerHud = true;
    [SerializeField] private bool includeDebugHelp;

    private Canvas canvas;
    private CanvasScaler canvasScaler;
    private PrototypePlayerHudOverlayGraphic overlayGraphic;
    private PrototypePlayerHudRadarGraphic radarGraphic;
    private RectTransform topStripRect;
    private RectTransform bottomBarRect;
    private RectTransform systemPanelRect;
    private RectTransform contextPanelRect;
    private RectTransform radarPanelRect;
    private Text topWarningText;
    private readonly List<Text> assistTexts = new List<Text>();
    private Text speedText;
    private Text throttleText;
    private Text fuelText;
    private Image throttleFill;
    private Image fuelFill;
    private Text modeText;
    private Text modeHintText;
    private Text rcsText;
    private Text sasText;
    private Text systemText;
    private Text contextTitleText;
    private Text contextBodyText;
    private readonly List<Image> contextGaugeFills = new List<Image>();
    private readonly List<Text> contextGaugeLabels = new List<Text>();
    private Text radarText;
    private Text helpText;
    private GameObject helpPanel;
    private Button killMomentumButton;
    private Text killMomentumButtonText;
    private readonly List<Text> markerLabels = new List<Text>();
    private PrototypePlayerHudSnapshot lastSnapshot;
    private int lastLayoutWidth = -1;
    private int lastLayoutHeight = -1;
    private FlightControlMode cachedHelpMode;
    private bool cachedHelpIncludesDebug;
    private string cachedHelpText;
    private bool hasCachedHelpText;

    public bool ShowPlayerHud => showPlayerHud;
    public PrototypeTrajectoryPreviewNavMap TrajectoryPreview => trajectoryPreview;
    public PrototypePlayerHudSnapshot LastSnapshot => lastSnapshot;

    private void Awake()
    {
        ResolveReferences();
        EnsureUi();
    }

    private void Start()
    {
        ResolveReferences();
        RefreshNow();
    }

    private void Update()
    {
        if (UnityEngine.InputSystem.Keyboard.current != null
            && UnityEngine.InputSystem.Keyboard.current.f1Key.wasPressedThisFrame)
        {
            SetHelpVisible(helpPanel == null || !helpPanel.activeSelf);
        }

        RefreshNow();
    }

    public void Bind(Transform root, ShipStats stats, Rigidbody body)
    {
        shipRoot = root != null ? root : shipRoot;
        shipStats = stats != null ? stats : shipStats;
        shipRigidbody = body != null ? body : shipRigidbody;
        ResolveReferences();
        EnsureUi();
        RefreshNow();
    }

    public void SetTargetDockingPort(DockingPort dockingPort)
    {
        targetDockingPort = dockingPort;
    }

    public void BindTrajectoryPreview(PrototypeTrajectoryPreviewNavMap preview)
    {
        trajectoryPreview = preview != null ? preview : trajectoryPreview;
        RefreshNow();
    }

    public void SetPlayerHudVisible(bool visible)
    {
        showPlayerHud = visible;
        if (canvas != null)
        {
            canvas.enabled = visible;
        }
    }

    public void RefreshNow()
    {
        ResolveReferences();
        EnsureUi();
        lastSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
            shipRoot,
            shipRigidbody,
            shipStats,
            controller,
            autopilot,
            momentumAssist,
            weaponComputer,
            sourceDockingPort,
            targetDockingPort,
            arenaLoop,
            dockingApproachAssist,
            trajectoryPreview);
        ApplySnapshot(lastSnapshot);
    }

    private void ResolveReferences()
    {
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

            if (controller == null)
            {
                controller = shipRoot.GetComponent<PlayerShipController>();
            }

            if (autopilot == null)
            {
                autopilot = shipRoot.GetComponent<PrototypeWaypointAutopilot>();
            }

            if (momentumAssist == null)
            {
                momentumAssist = shipRoot.GetComponent<PrototypeMomentumAssist>();
            }

            if (weaponComputer == null)
            {
                weaponComputer = shipRoot.GetComponent<PrototypeWeaponComputer>();
            }

            if (arenaLoop == null)
            {
                arenaLoop = UnityEngine.Object.FindAnyObjectByType<PrototypePveArenaLoop>();
            }

            if (dockingApproachAssist == null)
            {
                dockingApproachAssist = shipRoot.GetComponent<PrototypeDockingApproachAssist>();
            }

            if (trajectoryPreview == null)
            {
                trajectoryPreview = shipRoot.GetComponent<PrototypeTrajectoryPreviewNavMap>();
            }

            if (sourceDockingPort == null)
            {
                sourceDockingPort = shipRoot.GetComponentInChildren<DockingPort>();
            }
        }

        if (weaponComputer != null)
        {
            weaponComputer.UpdateActiveTargetAndStatus();
        }
    }

    private void EnsureUi()
    {
        if (canvas != null)
        {
            if (canvasScaler == null)
            {
                canvasScaler = canvas.GetComponent<CanvasScaler>();
            }

            return;
        }

        if (TryBindExistingUi())
        {
            canvas.enabled = showPlayerHud;
            return;
        }

        GameObject canvasObject = new GameObject("PrototypePlayerHudCanvas");
        canvasObject.transform.SetParent(transform, false);
        canvas = canvasObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 30;
        canvas.enabled = showPlayerHud;

        canvasScaler = canvasObject.AddComponent<CanvasScaler>();
        canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvasScaler.referenceResolution = new Vector2(CanvasReferenceWidth, CanvasReferenceHeight);
        canvasScaler.matchWidthOrHeight = 0.5f;
        canvasObject.AddComponent<GraphicRaycaster>();

        EnsureEventSystem();

        CreateTopStrip(canvasObject.transform);
        CreateBottomBar(canvasObject.transform);
        CreateSystemPanel(canvasObject.transform);
        CreateContextPanel(canvasObject.transform);
        CreateRadarPanel(canvasObject.transform);

        overlayGraphic = CreateGraphic<PrototypePlayerHudOverlayGraphic>("FlightMarkers", canvasObject.transform, StretchFull());
        overlayGraphic.raycastTarget = false;

        CreateMarkerLabels(canvasObject.transform);
        CreateHelpPanel(canvasObject.transform);
    }

    private bool TryBindExistingUi()
    {
        Canvas existingCanvas = null;
        int playerHudCanvasCount = 0;
        Canvas[] canvases = GetComponentsInChildren<Canvas>(true);
        for (int i = 0; i < canvases.Length; i++)
        {
            if (canvases[i] != null && canvases[i].gameObject.name == "PrototypePlayerHudCanvas")
            {
                existingCanvas = canvases[i];
                playerHudCanvasCount++;
            }
        }

        if (playerHudCanvasCount == 0)
        {
            return false;
        }

        if (playerHudCanvasCount > 1)
        {
            DestroyExistingPlayerHudCanvases();
            return false;
        }

        canvas = existingCanvas;
        canvasScaler = canvas.GetComponent<CanvasScaler>();
        overlayGraphic = FindHudComponent<PrototypePlayerHudOverlayGraphic>("FlightMarkers");
        radarGraphic = FindHudComponent<PrototypePlayerHudRadarGraphic>("RadarGraphic");
        topStripRect = FindHudComponent<RectTransform>("AlertAssistStrip");
        bottomBarRect = FindHudComponent<RectTransform>("FlightStatusBar");
        systemPanelRect = FindHudComponent<RectTransform>("ShipSystems");
        contextPanelRect = FindHudComponent<RectTransform>("ContextPanel");
        radarPanelRect = FindHudComponent<RectTransform>("RadarPanel");
        topWarningText = FindHudComponent<Text>("PrimaryWarning");
        speedText = FindHudComponent<Text>("Speed");
        throttleText = FindHudComponent<Text>("Throttle");
        fuelText = FindHudComponent<Text>("Fuel");
        throttleFill = FindHudComponent<Image>("ThrottleBarFill");
        fuelFill = FindHudComponent<Image>("FuelBarFill");
        modeText = FindHudComponent<Text>("Mode");
        modeHintText = FindHudComponent<Text>("ModeHint");
        rcsText = FindHudComponent<Text>("Rcs");
        sasText = FindHudComponent<Text>("Sas");
        systemText = FindHudComponent<Text>("SystemsText");
        contextTitleText = FindHudComponent<Text>("ContextTitle");
        contextBodyText = FindHudComponent<Text>("ContextBody");
        radarText = FindHudComponent<Text>("RadarText");
        helpText = FindHudComponent<Text>("HelpText");
        helpPanel = helpText != null ? helpText.transform.parent.gameObject : null;
        killMomentumButton = FindHudComponent<Button>("KillMomentum");
        killMomentumButtonText = FindHudComponent<Text>("KillMomentumText");

        assistTexts.Clear();
        for (int i = 0; i < 3; i++)
        {
            Text chip = FindHudComponent<Text>("AssistChip" + (i + 1));
            if (chip != null)
            {
                assistTexts.Add(chip);
            }
        }

        contextGaugeLabels.Clear();
        contextGaugeFills.Clear();
        for (int i = 0; i < 3; i++)
        {
            Text label = FindHudComponent<Text>("GaugeLabel" + i);
            Image fill = FindHudComponent<Image>("GaugeFill" + i);
            if (label != null && fill != null)
            {
                contextGaugeLabels.Add(label);
                contextGaugeFills.Add(fill);
            }
        }

        markerLabels.Clear();
        string[] labels = { "FWD", "PRO", "RET", "TGT" };
        for (int i = 0; i < labels.Length; i++)
        {
            Text label = FindHudComponent<Text>("Marker_" + labels[i]);
            if (label != null)
            {
                markerLabels.Add(label);
            }
        }

        bool complete = canvasScaler != null
            && overlayGraphic != null
            && radarGraphic != null
            && topStripRect != null
            && bottomBarRect != null
            && systemPanelRect != null
            && contextPanelRect != null
            && radarPanelRect != null
            && topWarningText != null
            && speedText != null
            && throttleText != null
            && fuelText != null
            && throttleFill != null
            && fuelFill != null
            && modeText != null
            && modeHintText != null
            && rcsText != null
            && sasText != null
            && systemText != null
            && contextTitleText != null
            && contextBodyText != null
            && radarText != null
            && helpText != null
            && helpPanel != null
            && killMomentumButton != null
            && killMomentumButtonText != null
            && assistTexts.Count == 3
            && contextGaugeLabels.Count == 3
            && contextGaugeFills.Count == 3
            && markerLabels.Count == 4;

        if (!complete)
        {
            DestroyExistingPlayerHudCanvases();
            ClearUiReferences();
            return false;
        }

        return true;
    }

    private T FindHudComponent<T>(string objectName) where T : Component
    {
        T[] components = GetComponentsInChildren<T>(true);
        for (int i = 0; i < components.Length; i++)
        {
            if (components[i] != null && components[i].gameObject.name == objectName)
            {
                return components[i];
            }
        }

        return null;
    }

    private void DestroyExistingPlayerHudCanvases()
    {
        Canvas[] canvases = GetComponentsInChildren<Canvas>(true);
        for (int i = 0; i < canvases.Length; i++)
        {
            if (canvases[i] != null && canvases[i].gameObject.name == "PrototypePlayerHudCanvas")
            {
                DestroyGeneratedObject(canvases[i].gameObject);
            }
        }
    }

    private void ClearUiReferences()
    {
        canvas = null;
        canvasScaler = null;
        overlayGraphic = null;
        radarGraphic = null;
        topStripRect = null;
        bottomBarRect = null;
        systemPanelRect = null;
        contextPanelRect = null;
        radarPanelRect = null;
        topWarningText = null;
        assistTexts.Clear();
        speedText = null;
        throttleText = null;
        fuelText = null;
        throttleFill = null;
        fuelFill = null;
        modeText = null;
        modeHintText = null;
        rcsText = null;
        sasText = null;
        systemText = null;
        contextTitleText = null;
        contextBodyText = null;
        contextGaugeFills.Clear();
        contextGaugeLabels.Clear();
        radarText = null;
        helpText = null;
        helpPanel = null;
        killMomentumButton = null;
        killMomentumButtonText = null;
        markerLabels.Clear();
        hasCachedHelpText = false;
    }

    private static void DestroyGeneratedObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

#if UNITY_EDITOR
        DestroyImmediate(target);
#else
        Destroy(target);
#endif
    }

    private void CreateTopStrip(Transform parent)
    {
        RectTransform strip = CreatePanel("AlertAssistStrip", parent, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(620f, 42f), new Vector2(0f, -24f));
        topStripRect = strip;
        topWarningText = CreateText("PrimaryWarning", strip, 13, TextAnchor.MiddleCenter, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-20f, 18f), new Vector2(0f, -2f)));
        for (int i = 0; i < 3; i++)
        {
            Text chip = CreateText("AssistChip" + (i + 1), strip, 11, TextAnchor.MiddleCenter, PrototypeUiStyle.ActiveColor, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(160f, 18f), new Vector2(14f + (i * 166f), 3f)));
            assistTexts.Add(chip);
        }
    }

    private void CreateBottomBar(Transform parent)
    {
        RectTransform bar = CreatePanel("FlightStatusBar", parent, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(760f, 76f), new Vector2(0f, 36f));
        bottomBarRect = bar;
        speedText = CreateText("Speed", bar, 19, TextAnchor.MiddleLeft, Color.white, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(138f, -12f), new Vector2(16f, 0f)));
        throttleText = CreateText("Throttle", bar, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(160f, 30f), new Vector2(158f, 12f)));
        fuelText = CreateText("Fuel", bar, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(160f, 30f), new Vector2(338f, 12f)));
        throttleFill = CreateBar("ThrottleBar", bar, new Vector2(158f, -14f));
        fuelFill = CreateBar("FuelBar", bar, new Vector2(338f, -14f));
        modeText = CreateText("Mode", bar, 14, TextAnchor.MiddleCenter, Color.white, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(132f, 28f), new Vector2(-188f, 14f)));
        modeHintText = CreateText("ModeHint", bar, 10, TextAnchor.MiddleCenter, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(220f, 18f), new Vector2(-170f, -36f)));
        rcsText = CreateText("Rcs", bar, 12, TextAnchor.MiddleCenter, PrototypeUiStyle.ActiveColor, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(104f, 22f), new Vector2(-194f, -16f)));
        sasText = CreateText("Sas", bar, 12, TextAnchor.MiddleCenter, PrototypeUiStyle.ActiveColor, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(104f, 22f), new Vector2(-82f, -16f)));
        killMomentumButton = CreateButton("KillMomentum", bar, "Kill Momentum", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(124f, 24f), new Vector2(-72f, 16f)));
        killMomentumButtonText = killMomentumButton.GetComponentInChildren<Text>(true);
    }

    private void CreateSystemPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("ShipSystems", parent, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(248f, 128f), new Vector2(24f, 24f));
        systemPanelRect = panel;
        systemText = CreateText("SystemsText", panel, 12, TextAnchor.UpperLeft, Color.white, StretchFull(12f, 10f));
    }

    private void CreateContextPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("ContextPanel", parent, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(356f, 194f), new Vector2(-24f, 24f));
        contextPanelRect = panel;
        contextTitleText = CreateText("ContextTitle", panel, 14, TextAnchor.UpperLeft, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-22f, 26f), new Vector2(0f, -16f)));
        contextBodyText = CreateText("ContextBody", panel, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-22f, -112f), new Vector2(0f, 6f)));
        CreateContextGaugePanel(panel);
    }

    private void CreateContextGaugePanel(Transform parent)
    {
        RectTransform panel = CreateRect("ContextGauges", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 58f), new Vector2(0f, 12f)));
        for (int i = 0; i < 3; i++)
        {
            CreateContextGaugeRow(panel, i);
        }
    }

    private void CreateContextGaugeRow(Transform parent, int index)
    {
        float y = 42f - (index * 18f);
        Text label = CreateText("GaugeLabel" + index, parent, 10, TextAnchor.MiddleLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0.5f), new Vector2(92f, 16f), new Vector2(0f, y)));
        RectTransform background = CreatePanel("GaugeBar" + index, parent, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0.5f), new Vector2(-108f, 6f), new Vector2(54f, y));
        background.GetComponent<Image>().color = new Color(0.08f, 0.1f, 0.13f, 0.95f);
        Image fill = CreateGraphic<Image>("GaugeFill" + index, background, StretchFull());
        fill.color = PrototypeUiStyle.ActiveColor;
        contextGaugeLabels.Add(label);
        contextGaugeFills.Add(fill);
    }

    private void CreateRadarPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("RadarPanel", parent, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(170f, 170f), new Vector2(-24f, -24f));
        radarPanelRect = panel;
        radarGraphic = CreateGraphic<PrototypePlayerHudRadarGraphic>("RadarGraphic", panel, StretchFull(8f, 8f));
        radarGraphic.raycastTarget = false;
        radarText = CreateText("RadarText", panel, 10, TextAnchor.LowerCenter, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-12f, 18f), new Vector2(0f, 10f)));
    }

    private void CreateHelpPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("PlayerHelp", parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(620f, 390f), Vector2.zero);
        helpPanel = panel.gameObject;
        helpText = CreateText("HelpText", panel, 12, TextAnchor.UpperLeft, Color.white, StretchFull(18f, 16f));
        helpPanel.SetActive(false);
    }

    private void CreateMarkerLabels(Transform parent)
    {
        string[] labels = { "FWD", "PRO", "RET", "TGT" };
        for (int i = 0; i < labels.Length; i++)
        {
            Text label = CreateText("Marker_" + labels[i], parent, 10, TextAnchor.MiddleCenter, Color.white, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(44f, 18f), Vector2.zero));
            markerLabels.Add(label);
        }
    }

    private void ApplySnapshot(PrototypePlayerHudSnapshot snapshot)
    {
        if (canvas != null)
        {
            canvas.enabled = showPlayerHud;
        }

        if (!showPlayerHud)
        {
            return;
        }

        ApplyResponsiveLayout();
        topWarningText.text = BuildWarningStrip(snapshot);
        for (int i = 0; i < assistTexts.Count; i++)
        {
            bool visible = i < snapshot.AssistChips.Length && !snapshot.AssistChips[i].IsEmpty;
            assistTexts[i].gameObject.SetActive(visible);
            if (visible)
            {
                assistTexts[i].text = snapshot.AssistChips[i].Label;
                assistTexts[i].color = ColorForSeverity(snapshot.AssistChips[i].Severity);
            }
        }

        speedText.text = snapshot.Flight.SpeedMetersPerSecond.ToString("0") + " m/s";
        throttleText.text = "Throttle " + snapshot.Flight.ThrottlePercent.ToString("0") + "%";
        fuelText.text = "Fuel " + (snapshot.Flight.FuelPercent * 100f).ToString("0") + "%";
        SetBar(throttleFill, snapshot.Flight.ThrottlePercent / 100f, PrototypeModuleColorPalette.MainThruster);
        SetBar(fuelFill, snapshot.Flight.FuelPercent, snapshot.Flight.FuelPercent <= 0.1f ? PrototypeUiStyle.WarningColor : PrototypeModuleColorPalette.FuelTankCue);
        modeText.text = snapshot.Flight.ControlModeLabel;
        modeHintText.text = snapshot.Flight.ControlModeHint;
        rcsText.text = snapshot.Flight.RcsLabel;
        sasText.text = snapshot.Flight.SasLabel;

        systemText.text =
            snapshot.ShipStatus.FuelLabel + "\n"
            + snapshot.ShipStatus.MainEngineLabel + "\n"
            + snapshot.ShipStatus.RcsLabel + "\n"
            + snapshot.ShipStatus.SasLabel + "\n"
            + snapshot.ShipStatus.WeaponLabel + "\n"
            + snapshot.ShipStatus.DamageLabel
            + BuildArenaSystemLine(snapshot.Arena);

        ApplyContext(snapshot);
        radarText.text = "Range 1 km";
        if (helpText != null && helpPanel != null && helpPanel.activeSelf)
        {
            FlightControlMode activeMode = controller != null ? controller.ControlMode : FlightControlMode.Normal;
            if (!hasCachedHelpText || cachedHelpMode != activeMode || cachedHelpIncludesDebug != includeDebugHelp)
            {
                cachedHelpMode = activeMode;
                cachedHelpIncludesDebug = includeDebugHelp;
                cachedHelpText = PrototypePlayerHudSnapshotBuilder.BuildPlayerHelpText(activeMode, includeDebugHelp);
                hasCachedHelpText = true;
            }

            helpText.text = cachedHelpText;
        }

        ConfigureKillMomentumButton();

        overlayGraphic.SetSnapshot(snapshot);
        if (radarGraphic != null)
        {
            radarGraphic.SetSnapshot(snapshot);
        }
        UpdateMarkerLabels(snapshot);
    }

    private void ConfigureKillMomentumButton()
    {
        if (killMomentumButton == null)
        {
            return;
        }

        killMomentumButton.onClick.RemoveAllListeners();
        if (momentumAssist == null)
        {
            SetKillMomentumButtonState("Assist n/a", false);
            return;
        }

        if (momentumAssist.IsActive)
        {
            SetKillMomentumButtonState("Abort Assist", true);
            killMomentumButton.onClick.AddListener(() => momentumAssist.Abort("button"));
            return;
        }

        if (momentumAssist.CurrentState == PrototypeMomentumAssistState.NoAuthority)
        {
            SetKillMomentumButtonState("No Authority", false);
            return;
        }

        if (momentumAssist.CurrentState == PrototypeMomentumAssistState.FuelInsufficient)
        {
            SetKillMomentumButtonState("No Fuel", false);
            return;
        }

        SetKillMomentumButtonState("Kill Momentum", true);
        killMomentumButton.onClick.AddListener(() => momentumAssist.ActivateFromUi());
    }

    private void SetKillMomentumButtonState(string label, bool interactable)
    {
        if (killMomentumButtonText != null)
        {
            killMomentumButtonText.text = label;
        }

        killMomentumButton.interactable = interactable;
    }

    public void ApplyResponsiveLayoutForTests(int width, int height)
    {
        ApplyResponsiveLayout(width, height, true);
    }

    private void ApplyResponsiveLayout()
    {
        float match = ApplyCanvasScalePolicy(Screen.width, Screen.height);
        float scale = CalculateCanvasScaleFactor(Screen.width, Screen.height, match);
        int width = Mathf.RoundToInt(Screen.width / scale);
        int height = Mathf.RoundToInt(Screen.height / scale);
        ApplyResponsiveLayout(width, height, false);
    }

    private void ApplyResponsiveLayout(int width, int height, bool force)
    {
        if (topStripRect == null || bottomBarRect == null || systemPanelRect == null || contextPanelRect == null || radarPanelRect == null)
        {
            return;
        }

        if (force && canvas != null)
        {
            if (canvasScaler != null)
            {
                canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
                canvasScaler.scaleFactor = 1f;
            }

            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            if (canvasRect != null)
            {
                canvasRect.anchorMin = Vector2.zero;
                canvasRect.anchorMax = Vector2.zero;
                canvasRect.pivot = Vector2.zero;
                canvasRect.sizeDelta = new Vector2(width, height);
                canvasRect.anchoredPosition = Vector2.zero;
            }
        }

        if (!force && width == lastLayoutWidth && height == lastLayoutHeight)
        {
            return;
        }

        lastLayoutWidth = width;
        lastLayoutHeight = height;

        float safeWidth = Mathf.Max(640f, width);
        float safeHeight = Mathf.Max(480f, height);
        bool narrow = safeWidth < 980f;
        bool shortScreen = safeHeight < 620f;
        float margin = narrow ? 16f : 24f;
        float gap = narrow ? 12f : 16f;
        float bottomHeight = narrow ? 82f : 76f;
        float bottomOffset = narrow ? 26f : 36f;
        float bottomWidth = Mathf.Clamp(safeWidth - (margin * 2f), 608f, 760f);
        float sideBottom = bottomOffset + bottomHeight + (shortScreen ? 10f : gap);
        float systemHeight = shortScreen ? 112f : 128f;
        float contextHeight = shortScreen ? 160f : 194f;
        float radarSize = narrow ? (shortScreen ? 112f : 144f) : 170f;
        float availableRadarHeight = safeHeight - margin - (sideBottom + contextHeight) - gap;
        if (availableRadarHeight < radarSize)
        {
            radarSize = Mathf.Clamp(availableRadarHeight, 96f, radarSize);
        }

        float sideAvailableWidth = safeWidth - (margin * 2f) - gap;
        float systemWidth = narrow ? 220f : 248f;
        float contextWidth = narrow ? 306f : 356f;
        if (systemWidth + contextWidth > sideAvailableWidth)
        {
            systemWidth = Mathf.Clamp(sideAvailableWidth * 0.42f, 156f, systemWidth);
            contextWidth = Mathf.Clamp(sideAvailableWidth - systemWidth - gap, 220f, contextWidth);
        }

        float radarLeft = safeWidth - margin - radarSize;
        bool dockTopLeft = safeWidth < 1040f || shortScreen;
        float topWidth = dockTopLeft
            ? Mathf.Clamp(radarLeft - margin - gap, 300f, 620f)
            : Mathf.Clamp(safeWidth - 360f, 420f, 620f);

        if (dockTopLeft)
        {
            ApplyRect(topStripRect, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(topWidth, 42f), new Vector2(margin, -margin));
        }
        else
        {
            ApplyRect(topStripRect, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(topWidth, 42f), new Vector2(0f, -margin));
        }

        ApplyAssistChipLayout(topWidth);
        ApplyRect(bottomBarRect, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(bottomWidth, bottomHeight), new Vector2(0f, bottomOffset));
        ApplyBottomBarChildLayout(bottomWidth, narrow);
        ApplyRect(systemPanelRect, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(systemWidth, systemHeight), new Vector2(margin, sideBottom));
        ApplyRect(contextPanelRect, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(contextWidth, contextHeight), new Vector2(-margin, sideBottom));
        ApplyRect(radarPanelRect, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(radarSize, radarSize), new Vector2(-margin, -margin));
    }

    private float ApplyCanvasScalePolicy(int screenWidth, int screenHeight)
    {
        float aspect = screenHeight > 0 ? screenWidth / (float)screenHeight : CanvasReferenceWidth / CanvasReferenceHeight;
        float match = 0.5f;
        if (aspect < 1.55f)
        {
            match = 0f;
        }
        else if (aspect > 2.15f)
        {
            match = 1f;
        }

        if (canvasScaler != null)
        {
            canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasScaler.referenceResolution = new Vector2(CanvasReferenceWidth, CanvasReferenceHeight);
            canvasScaler.matchWidthOrHeight = match;
        }

        return match;
    }

    private static float CalculateCanvasScaleFactor(int screenWidth, int screenHeight, float matchWidthOrHeight)
    {
        float widthScale = Mathf.Max(0.001f, screenWidth / CanvasReferenceWidth);
        float heightScale = Mathf.Max(0.001f, screenHeight / CanvasReferenceHeight);
        float logWidth = Mathf.Log(widthScale, 2f);
        float logHeight = Mathf.Log(heightScale, 2f);
        return Mathf.Pow(2f, Mathf.Lerp(logWidth, logHeight, Mathf.Clamp01(matchWidthOrHeight)));
    }

    private void ApplyAssistChipLayout(float topWidth)
    {
        float chipGap = 8f;
        float chipWidth = Mathf.Clamp((topWidth - 28f - (chipGap * 2f)) / 3f, 86f, 160f);
        for (int i = 0; i < assistTexts.Count; i++)
        {
            RectTransform rect = assistTexts[i].rectTransform;
            ApplyRect(rect, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(chipWidth, 18f), new Vector2(14f + (i * (chipWidth + chipGap)), 3f));
            assistTexts[i].fontSize = chipWidth < 118f ? 9 : 11;
        }
    }

    private void ApplyBottomBarChildLayout(float bottomWidth, bool narrow)
    {
        bool compact = narrow || bottomWidth < 700f;
        RectTransform throttleBar = throttleFill != null ? throttleFill.transform.parent as RectTransform : null;
        RectTransform fuelBar = fuelFill != null ? fuelFill.transform.parent as RectTransform : null;
        RectTransform buttonRect = killMomentumButton != null ? killMomentumButton.GetComponent<RectTransform>() : null;

        if (compact)
        {
            speedText.fontSize = 16;
            throttleText.fontSize = 10;
            fuelText.fontSize = 10;
            modeText.fontSize = 12;
            modeHintText.fontSize = 9;
            rcsText.fontSize = 10;
            sasText.fontSize = 10;
            ApplyRect(speedText.rectTransform, new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(96f, -12f), new Vector2(12f, 0f));
            ApplyRect(throttleText.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(112f, 24f), new Vector2(118f, 12f));
            ApplyRect(fuelText.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(104f, 24f), new Vector2(240f, 12f));
            ApplyRect(throttleBar, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(104f, 6f), new Vector2(118f, -14f));
            ApplyRect(fuelBar, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(96f, 6f), new Vector2(240f, -14f));
            ApplyRect(modeText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(92f, 24f), new Vector2(-110f, 16f));
            ApplyRect(modeHintText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(156f, 16f), new Vector2(-126f, -36f));
            ApplyRect(rcsText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(66f, 20f), new Vector2(-176f, -14f));
            ApplyRect(sasText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(66f, 20f), new Vector2(-102f, -14f));
            ApplyRect(buttonRect, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(92f, 24f), new Vector2(-10f, 16f));
            return;
        }

        speedText.fontSize = 19;
        throttleText.fontSize = 12;
        fuelText.fontSize = 12;
        modeText.fontSize = 14;
        modeHintText.fontSize = 10;
        rcsText.fontSize = 12;
        sasText.fontSize = 12;
        ApplyRect(speedText.rectTransform, new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(132f, -12f), new Vector2(16f, 0f));
        ApplyRect(throttleText.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(144f, 30f), new Vector2(158f, 12f));
        ApplyRect(fuelText.rectTransform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(144f, 30f), new Vector2(314f, 12f));
        ApplyRect(throttleBar, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(134f, 6f), new Vector2(158f, -14f));
        ApplyRect(fuelBar, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(134f, 6f), new Vector2(314f, -14f));
        ApplyRect(modeText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(132f, 28f), new Vector2(-152f, 14f));
        ApplyRect(modeHintText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(260f, 18f), new Vector2(-152f, -36f));
        ApplyRect(rcsText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(104f, 22f), new Vector2(-180f, -16f));
        ApplyRect(sasText.rectTransform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(104f, 22f), new Vector2(-70f, -16f));
        ApplyRect(buttonRect, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(124f, 24f), new Vector2(-16f, 16f));
    }

    private static void ApplyRect(RectTransform rect, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 sizeDelta, Vector2 anchoredPosition)
    {
        if (rect == null)
        {
            return;
        }

        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.pivot = pivot;
        rect.sizeDelta = sizeDelta;
        rect.anchoredPosition = anchoredPosition;
    }

    private void ApplyContext(PrototypePlayerHudSnapshot snapshot)
    {
        if (snapshot.Arena.Completed)
        {
            contextTitleText.text = "Arena: " + snapshot.Arena.ObjectiveName;
            contextBodyText.text =
                snapshot.Arena.StatusLabel + " | Targets " + snapshot.Arena.ProgressLabel + "\n"
                + snapshot.Arena.RewardStubLabel + "\n"
                + "Reset arena to replay";
            contextBodyText.color = PrototypeUiStyle.ActiveColor;
            SetContextGauge(0, "Objective", snapshot.Arena.ProgressFraction, PrototypeUiStyle.ActiveColor, true);
            SetContextGauge(1, string.Empty, 0f, Color.white, false);
            SetContextGauge(2, string.Empty, 0f, Color.white, false);
            return;
        }

        if (snapshot.Docking.Visible)
        {
            contextTitleText.text = "Docking: " + snapshot.Docking.TargetName;
            contextBodyText.text =
                "Dist " + FormatDistance(snapshot.Docking.DistanceMeters) + " | Angle " + snapshot.Docking.AngleErrorDegrees.ToString("0.0") + " deg\n"
                + "Rel " + snapshot.Docking.RelativeSpeed.ToString("0.0") + " m/s | Closing " + snapshot.Docking.ClosingSpeed.ToString("0.0") + " m/s\n"
                + "Offset " + snapshot.Docking.LateralOffsetMeters.x.ToString("0.0") + " / " + snapshot.Docking.LateralOffsetMeters.y.ToString("0.0") + " m\n"
                + (snapshot.Docking.SoftCaptureRequested ? snapshot.Docking.SoftCaptureLabel : snapshot.Docking.StatusLabel) + "\n"
                + snapshot.Docking.SoftCaptureAssistLabel + "\n"
                + snapshot.Docking.HardLockLabel;
            contextBodyText.color = ColorForSeverity(snapshot.Docking.StatusSeverity);
            SetContextGauge(0, "Distance", 1f - snapshot.Docking.DistanceRatio, ColorForSeverity(snapshot.Docking.StatusSeverity), true);
            SetContextGauge(1, "Align", 1f - snapshot.Docking.AngleRatio, ColorForSeverity(snapshot.Docking.StatusSeverity), true);
            SetContextGauge(2, "Speed", 1f - snapshot.Docking.SpeedRatio, ColorForSeverity(snapshot.Docking.StatusSeverity), true);
            return;
        }

        if (snapshot.Combat.Visible)
        {
            contextTitleText.text = "Combat: " + snapshot.Combat.TargetName;
            contextBodyText.text =
                "Health " + snapshot.Combat.HealthLabel + " | Range " + FormatDistance(snapshot.Combat.RangeMeters) + "\n"
                + snapshot.Combat.FireStatusLabel + "\n"
                + snapshot.Combat.AutoFireLabel + "\n"
                + "Priority " + snapshot.Combat.PriorityLabel;
            contextBodyText.color = ColorForSeverity(snapshot.Combat.FireSeverity);
            SetContextGauge(0, "Integrity", snapshot.Combat.HealthPercent, ColorForSeverity(snapshot.Combat.FireSeverity), true);
            SetContextGauge(1, string.Empty, 0f, Color.white, false);
            SetContextGauge(2, string.Empty, 0f, Color.white, false);
            return;
        }

        if (snapshot.Navigation.Visible)
        {
            contextTitleText.text = "Navigation: " + snapshot.Navigation.TargetName;
            contextBodyText.text =
                snapshot.Navigation.TargetTypeLabel + " | Dist " + FormatDistance(snapshot.Navigation.DistanceMeters) + " | ETA " + snapshot.Navigation.EtaLabel + "\n"
                + "Closing " + snapshot.Navigation.ClosingSpeed.ToString("0.0") + " m/s | Lateral " + snapshot.Navigation.LateralSpeed.ToString("0.0") + " m/s\n"
                + snapshot.Navigation.StateLabel + "\n"
                + snapshot.Navigation.PhaseLabel
                + (string.IsNullOrWhiteSpace(snapshot.Navigation.AvoidanceLabel) ? string.Empty : "\n" + snapshot.Navigation.AvoidanceLabel)
                + (snapshot.Navigation.TrajectoryPreview.Enabled ? "\n" + snapshot.Navigation.TrajectoryPreview.StatusLabel : string.Empty);
            contextBodyText.color = PrototypeUiStyle.MutedColor;
            SetContextGauge(0, snapshot.Navigation.RouteWorldPoints.Length > 1 ? "Route" : string.Empty, snapshot.Navigation.RouteWorldPoints.Length > 1 ? 1f : 0f, PrototypeModuleColorPalette.Target, snapshot.Navigation.RouteWorldPoints.Length > 1);
            SetContextGauge(1, snapshot.Navigation.HasAvoidanceCue ? "Avoid" : string.Empty, snapshot.Navigation.HasAvoidanceCue ? 1f : 0f, PrototypeUiStyle.WarningColor, snapshot.Navigation.HasAvoidanceCue);
            SetContextGauge(2, snapshot.Navigation.TrajectoryPreview.HasRenderablePoints ? "Preview" : string.Empty, snapshot.Navigation.TrajectoryPreview.HasRenderablePoints ? 1f : 0f, new Color(1f, 0.72f, 0.22f, 0.95f), snapshot.Navigation.TrajectoryPreview.HasRenderablePoints);
            return;
        }

        contextTitleText.text = "Navigation";
        contextBodyText.text = "Kein Navigationsziel";
        contextBodyText.color = PrototypeUiStyle.MutedColor;
        HideContextGauges();
    }

    private static string BuildArenaSystemLine(PrototypePveArenaSnapshot arena)
    {
        if (!arena.IsVisible)
        {
            return string.Empty;
        }

        string line = "\nArena: " + arena.ObjectiveName + " " + arena.ProgressLabel + " " + arena.StatusLabel;
        return arena.Completed ? line + " | " + arena.RewardStubLabel : line;
    }

    private void HideContextGauges()
    {
        for (int i = 0; i < contextGaugeFills.Count; i++)
        {
            SetContextGauge(i, string.Empty, 0f, Color.white, false);
        }
    }

    private void SetContextGauge(int index, string label, float normalized, Color color, bool visible)
    {
        if (index < 0 || index >= contextGaugeFills.Count || index >= contextGaugeLabels.Count)
        {
            return;
        }

        contextGaugeLabels[index].gameObject.SetActive(visible);
        contextGaugeFills[index].transform.parent.gameObject.SetActive(visible);
        if (!visible)
        {
            return;
        }

        contextGaugeLabels[index].text = label;
        SetBar(contextGaugeFills[index], normalized, color);
    }

    private void UpdateMarkerLabels(PrototypePlayerHudSnapshot snapshot)
    {
        if (markerLabels.Count < 4)
        {
            return;
        }

        SetMarkerLabel(markerLabels[0], snapshot.MarkerModel.ForwardMarker, true, Color.white);
        SetMarkerLabel(markerLabels[1], snapshot.MarkerModel.ProgradeMarker, snapshot.MarkerModel.HasVelocityMarker, PrototypeUiStyle.OkColor);
        SetMarkerLabel(markerLabels[2], snapshot.MarkerModel.RetrogradeMarker, snapshot.MarkerModel.HasVelocityMarker, PrototypeUiStyle.DangerColor);
        SetMarkerLabel(markerLabels[3], snapshot.MarkerModel.TargetMarker, snapshot.MarkerModel.HasTargetMarker, PrototypeModuleColorPalette.Target);
    }

    private void SetMarkerLabel(Text label, Vector2 markerOffset, bool visible, Color color)
    {
        label.gameObject.SetActive(visible);
        label.color = color;
        RectTransform rect = label.rectTransform;
        Vector2 clamped = Vector2.ClampMagnitude(markerOffset, MarkerRadius);
        rect.anchoredPosition = new Vector2(clamped.x, clamped.y - 86f);
    }

    private static string BuildWarningStrip(PrototypePlayerHudSnapshot snapshot)
    {
        if (snapshot.Warnings.Length == 0)
        {
            return "Flight nominal";
        }

        int chipCount = Mathf.Min(3, snapshot.Warnings.Length);
        var parts = new string[chipCount];
        for (int i = 0; i < chipCount; i++)
        {
            parts[i] = snapshot.Warnings[i].Label;
        }

        return string.Join("  |  ", parts);
    }

    private static Image CreateBar(string name, Transform parent, Vector2 anchoredPosition)
    {
        RectTransform bg = CreatePanel(name + "Background", parent, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(146f, 6f), anchoredPosition);
        bg.GetComponent<Image>().color = new Color(0.09f, 0.11f, 0.15f, 0.94f);
        Image fill = CreateGraphic<Image>(name + "Fill", bg, StretchFull());
        fill.color = Color.white;
        return fill;
    }

    private static Button CreateButton(string name, Transform parent, string label, RectPreset preset)
    {
        RectTransform rect = CreateRect(name, parent, preset);
        Image image = rect.gameObject.AddComponent<Image>();
        image.color = new Color(0.13f, 0.16f, 0.21f, 0.94f);
        Button button = rect.gameObject.AddComponent<Button>();
        ColorBlock colors = button.colors;
        colors.normalColor = image.color;
        colors.highlightedColor = new Color(0.18f, 0.22f, 0.28f, 0.98f);
        colors.pressedColor = new Color(0.09f, 0.12f, 0.16f, 1f);
        colors.selectedColor = colors.highlightedColor;
        colors.disabledColor = new Color(0.08f, 0.09f, 0.11f, 0.6f);
        button.colors = colors;
        CreateText(name + "Text", rect, 11, TextAnchor.MiddleCenter, Color.white, StretchFull(4f, 2f)).text = label;
        return button;
    }

    private static RectTransform CreatePanel(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 size, Vector2 anchoredPosition)
    {
        RectTransform rect = CreateRect(name, parent, new RectPreset(anchorMin, anchorMax, pivot, size, anchoredPosition));
        Image image = rect.gameObject.AddComponent<Image>();
        image.color = new Color(0.022f, 0.027f, 0.039f, 0.76f);
        return rect;
    }

    private static Text CreateText(string name, Transform parent, int fontSize, TextAnchor alignment, Color color, RectPreset preset)
    {
        Text text = CreateGraphic<Text>(name, parent, preset);
        text.font = ResolveRuntimeFont();
        text.fontSize = fontSize;
        text.alignment = alignment;
        text.color = color;
        text.horizontalOverflow = HorizontalWrapMode.Wrap;
        text.verticalOverflow = VerticalWrapMode.Truncate;
        text.raycastTarget = false;
        return text;
    }

    private static T CreateGraphic<T>(string name, Transform parent, RectPreset preset) where T : Graphic
    {
        RectTransform rect = CreateRect(name, parent, preset);
        return rect.gameObject.AddComponent<T>();
    }

    private static RectTransform CreateRect(string name, Transform parent, RectPreset preset)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        RectTransform rect = go.AddComponent<RectTransform>();
        rect.anchorMin = preset.AnchorMin;
        rect.anchorMax = preset.AnchorMax;
        rect.pivot = preset.Pivot;
        rect.sizeDelta = preset.SizeDelta;
        rect.anchoredPosition = preset.AnchoredPosition;
        return rect;
    }

    private static void SetBar(Image fill, float normalized, Color color)
    {
        if (fill == null)
        {
            return;
        }

        normalized = Mathf.Clamp01(normalized);
        fill.color = color;
        RectTransform rect = fill.rectTransform;
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = new Vector2(normalized, 1f);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
    }

    private static void EnsureEventSystem()
    {
        EventSystem[] eventSystems = UnityEngine.Object.FindObjectsByType<EventSystem>(FindObjectsInactive.Exclude);
        if (eventSystems != null && eventSystems.Length > 0)
        {
            EnsureCompatibleInputModule(eventSystems[0]);
            return;
        }

        GameObject eventSystemObject = new GameObject("PrototypePlayerHudEventSystem");
        eventSystemObject.AddComponent<EventSystem>();
        eventSystemObject.AddComponent<InputSystemUIInputModule>();
    }

    private static void EnsureCompatibleInputModule(EventSystem eventSystem)
    {
        if (eventSystem == null || eventSystem.GetComponent<InputSystemUIInputModule>() != null)
        {
            return;
        }

        eventSystem.gameObject.AddComponent<InputSystemUIInputModule>();
    }

    private void SetHelpVisible(bool visible)
    {
        if (helpPanel != null)
        {
            helpPanel.SetActive(visible);
        }
    }

    private static string FormatDistance(float meters)
    {
        if (meters >= 1000f)
        {
            return (meters / 1000f).ToString("0.0") + " km";
        }

        return meters.ToString("0") + " m";
    }

    private static Color ColorForSeverity(PrototypePlayerHudSeverity severity)
    {
        switch (severity)
        {
            case PrototypePlayerHudSeverity.Info:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerHudSeverity.Warning:
                return PrototypeUiStyle.WarningColor;
            case PrototypePlayerHudSeverity.Danger:
                return PrototypeUiStyle.DangerColor;
            case PrototypePlayerHudSeverity.Disabled:
                return PrototypeUiStyle.DisabledColor;
            default:
                return Color.white;
        }
    }

    private static Font ResolveRuntimeFont()
    {
        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        if (font == null)
        {
            font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        return font;
    }

    private static void DrawRadarGui(Rect rect, PrototypePlayerHudSnapshot snapshot)
    {
        Vector2 center = rect.center;
        float radius = Mathf.Min(rect.width, rect.height) * 0.36f;
        Color ringColor = new Color(0.25f, 0.85f, 1f, 0.95f);
        DrawCircleGui(center, radius, ringColor, 1.6f, 48);
        DrawCircleGui(center, radius * 0.5f, ringColor, 1f, 48);
        DrawLineGui(center + Vector2.left * radius, center + Vector2.right * radius, ringColor, 1f);
        DrawLineGui(center + Vector2.up * radius, center + Vector2.down * radius, ringColor, 1f);

        Vector2 heading = new Vector2(snapshot.ShipForward.x, -snapshot.ShipForward.z);
        if (heading.sqrMagnitude <= 0.001f)
        {
            heading = Vector2.up;
        }

        heading.Normalize();
        Vector2 right = new Vector2(heading.y, -heading.x);
        DrawLineGui(center + heading * 12f, center - heading * 8f - right * 7f, Color.white, 1.5f);
        DrawLineGui(center - heading * 8f - right * 7f, center - heading * 8f + right * 7f, Color.white, 1.5f);
        DrawLineGui(center - heading * 8f + right * 7f, center + heading * 12f, Color.white, 1.5f);

        if (snapshot.NavigationTargetWorldPosition.HasValue)
        {
            Vector2 target = WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, snapshot.NavigationTargetWorldPosition.Value);
            DrawLineGui(center, target, PrototypeModuleColorPalette.Target, 1f);
            DrawBlipGui(target, PrototypeModuleColorPalette.Target);
        }

        Vector3[] route = snapshot.Navigation.RouteWorldPoints;
        if (route != null && route.Length > 1)
        {
            Vector2 previous = WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, route[0]);
            for (int i = 1; i < route.Length; i++)
            {
                Vector2 next = WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, route[i]);
                DrawLineGui(previous, next, PrototypeModuleColorPalette.Target, 1f);
                previous = next;
            }
        }

        Vector3[] previewRoute = snapshot.Navigation.TrajectoryPreview.Points;
        if (snapshot.Navigation.TrajectoryPreview.HasRenderablePoints && previewRoute != null && previewRoute.Length > 1)
        {
            Color previewColor = new Color(1f, 0.72f, 0.22f, 0.95f);
            Vector2 previous = WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, previewRoute[0]);
            for (int i = 1; i < previewRoute.Length; i++)
            {
                Vector2 next = WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, previewRoute[i]);
                DrawLineGui(previous, next, previewColor, 1.3f);
                previous = next;
            }
        }

        if (snapshot.Navigation.HasAvoidanceCue)
        {
            DrawBlipGui(WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, snapshot.Navigation.AvoidanceWorldPosition), PrototypeUiStyle.WarningColor);
        }

        if (snapshot.CombatTargetWorldPosition.HasValue)
        {
            DrawBlipGui(WorldToRadarGui(center, radius, snapshot.ShipWorldPosition, snapshot.CombatTargetWorldPosition.Value), PrototypeModuleColorPalette.Gun);
        }
    }

    private static Vector2 WorldToRadarGui(Vector2 center, float radius, Vector3 origin, Vector3 target)
    {
        Vector3 delta = target - origin;
        Vector2 flat = new Vector2(delta.x, -delta.z) / 1000f * radius;
        return center + Vector2.ClampMagnitude(flat, radius);
    }

    private static void DrawBlipGui(Vector2 point, Color color)
    {
        DrawLineGui(point + Vector2.left * 4f, point + Vector2.right * 4f, color, 2f);
        DrawLineGui(point + Vector2.up * 4f, point + Vector2.down * 4f, color, 2f);
    }

    private static void DrawCircleGui(Vector2 center, float radius, Color color, float thickness, int segments)
    {
        Vector2 previous = center + Vector2.right * radius;
        for (int i = 1; i <= segments; i++)
        {
            float angle = Mathf.PI * 2f * i / segments;
            Vector2 next = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
            DrawLineGui(previous, next, color, thickness);
            previous = next;
        }
    }

    private static void DrawLineGui(Vector2 start, Vector2 end, Color color, float thickness)
    {
        Vector2 delta = end - start;
        if (delta.sqrMagnitude < 0.001f)
        {
            return;
        }

        Matrix4x4 oldMatrix = GUI.matrix;
        Color oldColor = GUI.color;
        GUI.color = color;
        GUIUtility.RotateAroundPivot(Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg, start);
        GUI.DrawTexture(new Rect(start.x, start.y - (thickness * 0.5f), delta.magnitude, thickness), Texture2D.whiteTexture);
        GUI.matrix = oldMatrix;
        GUI.color = oldColor;
    }

    private static RectPreset StretchFull(float insetX = 0f, float insetY = 0f)
    {
        return new RectPreset(
            Vector2.zero,
            Vector2.one,
            new Vector2(0.5f, 0.5f),
            new Vector2(-insetX * 2f, -insetY * 2f),
            Vector2.zero);
    }
}

public sealed class PrototypePlayerHudOverlayGraphic : MaskableGraphic
{
    private PrototypePlayerHudSnapshot snapshot;

    public void SetSnapshot(PrototypePlayerHudSnapshot value)
    {
        snapshot = value;
        SetVerticesDirty();
    }

    protected override void OnPopulateMesh(VertexHelper vh)
    {
        vh.Clear();
        Rect rect = rectTransform.rect;
        Vector2 center = rect.center + new Vector2(0f, -86f);
        DrawCircle(vh, center, 88f, new Color(0.35f, 0.62f, 0.88f, 0.72f), 1.5f, 64);
        DrawLine(vh, center + Vector2.left * 18f, center + Vector2.right * 18f, Color.white, 1.4f);
        DrawLine(vh, center + Vector2.up * 18f, center + Vector2.down * 18f, Color.white, 1.4f);
        DrawMarker(vh, center, snapshot.MarkerModel.ForwardMarker, Color.white, 10f);

        if (snapshot.MarkerModel.HasVelocityMarker)
        {
            DrawMarker(vh, center, snapshot.MarkerModel.ProgradeMarker, PrototypeUiStyle.OkColor, 9f);
            DrawMarker(vh, center, snapshot.MarkerModel.RetrogradeMarker, PrototypeUiStyle.DangerColor, 9f);
        }

        if (snapshot.MarkerModel.HasTargetMarker)
        {
            DrawMarker(vh, center, snapshot.MarkerModel.TargetMarker, PrototypeModuleColorPalette.Target, 10f);
        }

        if (snapshot.Docking.Visible)
        {
            DrawDockingDirector(vh, center, snapshot.Docking);
        }

        if (snapshot.Combat.Visible && snapshot.MarkerModel.HasTargetMarker)
        {
            DrawCombatBracket(vh, center + Vector2.ClampMagnitude(snapshot.MarkerModel.TargetMarker, 88f), ColorForSeverity(snapshot.Combat.FireSeverity));
        }

    }

    private static void DrawDockingDirector(VertexHelper vh, Vector2 center, PrototypePlayerDockingSnapshot docking)
    {
        float offsetScale = 8f;
        Vector2 offset = Vector2.ClampMagnitude(docking.LateralOffsetMeters * offsetScale, 48f);
        Color color = ColorForSeverity(docking.StatusSeverity);
        DrawCircle(vh, center, 48f, new Color(color.r, color.g, color.b, 0.5f), 1f, 40);
        DrawLine(vh, center + offset + Vector2.left * 12f, center + offset + Vector2.right * 12f, color, 1.8f);
        DrawLine(vh, center + offset + Vector2.up * 12f, center + offset + Vector2.down * 12f, color, 1.8f);
    }

    private static void DrawCombatBracket(VertexHelper vh, Vector2 center, Color color)
    {
        const float outer = 26f;
        const float inner = 14f;
        DrawLine(vh, center + new Vector2(-outer, -outer), center + new Vector2(-inner, -outer), color, 2f);
        DrawLine(vh, center + new Vector2(-outer, -outer), center + new Vector2(-outer, -inner), color, 2f);
        DrawLine(vh, center + new Vector2(outer, -outer), center + new Vector2(inner, -outer), color, 2f);
        DrawLine(vh, center + new Vector2(outer, -outer), center + new Vector2(outer, -inner), color, 2f);
        DrawLine(vh, center + new Vector2(-outer, outer), center + new Vector2(-inner, outer), color, 2f);
        DrawLine(vh, center + new Vector2(-outer, outer), center + new Vector2(-outer, inner), color, 2f);
        DrawLine(vh, center + new Vector2(outer, outer), center + new Vector2(inner, outer), color, 2f);
        DrawLine(vh, center + new Vector2(outer, outer), center + new Vector2(outer, inner), color, 2f);
    }

    private static void DrawRadar(VertexHelper vh, Rect rect, PrototypePlayerHudSnapshot value)
    {
        Vector2 radarCenter = new Vector2(rect.xMax - 109f, rect.yMax - 109f);
        const float radius = 68f;
        Color ringColor = new Color(0.35f, 0.62f, 0.88f, 0.58f);
        DrawCircle(vh, radarCenter, radius, ringColor, 1.2f, 48);
        DrawCircle(vh, radarCenter, radius * 0.5f, ringColor, 0.9f, 48);
        DrawLine(vh, radarCenter + Vector2.left * radius, radarCenter + Vector2.right * radius, ringColor, 0.8f);
        DrawLine(vh, radarCenter + Vector2.up * radius, radarCenter + Vector2.down * radius, ringColor, 0.8f);

        Vector2 heading = new Vector2(value.ShipForward.x, value.ShipForward.z);
        if (heading.sqrMagnitude <= 0.001f)
        {
            heading = Vector2.up;
        }

        heading.Normalize();
        Vector2 right = new Vector2(heading.y, -heading.x);
        DrawLine(vh, radarCenter + heading * 13f, radarCenter - heading * 9f - right * 7f, Color.white, 1.5f);
        DrawLine(vh, radarCenter - heading * 9f - right * 7f, radarCenter - heading * 9f + right * 7f, Color.white, 1.5f);
        DrawLine(vh, radarCenter - heading * 9f + right * 7f, radarCenter + heading * 13f, Color.white, 1.5f);

        if (value.NavigationTargetWorldPosition.HasValue)
        {
            DrawRadarBlip(vh, radarCenter, radius, value.ShipWorldPosition, value.NavigationTargetWorldPosition.Value, PrototypeModuleColorPalette.Target);
            DrawLine(vh, radarCenter, ClampRadarPoint(radarCenter, radius, value.ShipWorldPosition, value.NavigationTargetWorldPosition.Value), PrototypeModuleColorPalette.Target, 1f);
        }

        Vector3[] route = value.Navigation.RouteWorldPoints;
        if (route != null && route.Length > 1)
        {
            Vector2 previous = ClampRadarPoint(radarCenter, radius, value.ShipWorldPosition, route[0]);
            for (int i = 1; i < route.Length; i++)
            {
                Vector2 next = ClampRadarPoint(radarCenter, radius, value.ShipWorldPosition, route[i]);
                DrawLine(vh, previous, next, PrototypeModuleColorPalette.Target, 1f);
                previous = next;
            }
        }

        Vector3[] previewRoute = value.Navigation.TrajectoryPreview.Points;
        if (value.Navigation.TrajectoryPreview.HasRenderablePoints && previewRoute != null && previewRoute.Length > 1)
        {
            Color previewColor = new Color(1f, 0.72f, 0.22f, 0.95f);
            Vector2 previous = ClampRadarPoint(radarCenter, radius, value.ShipWorldPosition, previewRoute[0]);
            for (int i = 1; i < previewRoute.Length; i++)
            {
                Vector2 next = ClampRadarPoint(radarCenter, radius, value.ShipWorldPosition, previewRoute[i]);
                DrawLine(vh, previous, next, previewColor, 1.2f);
                previous = next;
            }
        }

        if (value.Navigation.HasAvoidanceCue)
        {
            DrawRadarBlip(vh, radarCenter, radius, value.ShipWorldPosition, value.Navigation.AvoidanceWorldPosition, PrototypeUiStyle.WarningColor);
        }

        if (value.CombatTargetWorldPosition.HasValue)
        {
            DrawRadarBlip(vh, radarCenter, radius, value.ShipWorldPosition, value.CombatTargetWorldPosition.Value, PrototypeModuleColorPalette.Gun);
        }
    }

    private static void DrawRadarBlip(VertexHelper vh, Vector2 radarCenter, float radius, Vector3 origin, Vector3 target, Color color)
    {
        Vector2 point = ClampRadarPoint(radarCenter, radius, origin, target);
        DrawLine(vh, point + Vector2.left * 4f, point + Vector2.right * 4f, color, 2f);
        DrawLine(vh, point + Vector2.up * 4f, point + Vector2.down * 4f, color, 2f);
    }

    private static Vector2 ClampRadarPoint(Vector2 radarCenter, float radius, Vector3 origin, Vector3 target)
    {
        Vector3 delta = target - origin;
        Vector2 flat = new Vector2(delta.x, delta.z) / 1000f * radius;
        return radarCenter + Vector2.ClampMagnitude(new Vector2(flat.x, flat.y), radius);
    }

    private static void DrawMarker(VertexHelper vh, Vector2 center, Vector2 markerOffset, Color color, float size)
    {
        Vector2 position = center + Vector2.ClampMagnitude(markerOffset, 88f);
        DrawLine(vh, position + Vector2.left * size, position + Vector2.right * size, color, 1.8f);
        DrawLine(vh, position + Vector2.up * size, position + Vector2.down * size, color, 1.8f);
    }

    private static void DrawCircle(VertexHelper vh, Vector2 center, float radius, Color color, float thickness, int segments)
    {
        Vector2 previous = center + Vector2.right * radius;
        for (int i = 1; i <= segments; i++)
        {
            float angle = Mathf.PI * 2f * i / segments;
            Vector2 next = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
            DrawLine(vh, previous, next, color, thickness);
            previous = next;
        }
    }

    private static void DrawLine(VertexHelper vh, Vector2 start, Vector2 end, Color color, float thickness)
    {
        Vector2 delta = end - start;
        if (delta.sqrMagnitude < 0.001f)
        {
            return;
        }

        Vector2 normal = new Vector2(-delta.y, delta.x).normalized * (thickness * 0.5f);
        int index = vh.currentVertCount;
        UIVertex vertex = UIVertex.simpleVert;
        vertex.color = color;
        vertex.position = start - normal;
        vh.AddVert(vertex);
        vertex.position = start + normal;
        vh.AddVert(vertex);
        vertex.position = end + normal;
        vh.AddVert(vertex);
        vertex.position = end - normal;
        vh.AddVert(vertex);
        vh.AddTriangle(index, index + 1, index + 2);
        vh.AddTriangle(index, index + 2, index + 3);
    }

    private static Color ColorForSeverity(PrototypePlayerHudSeverity severity)
    {
        switch (severity)
        {
            case PrototypePlayerHudSeverity.Info:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerHudSeverity.Warning:
                return PrototypeUiStyle.WarningColor;
            case PrototypePlayerHudSeverity.Danger:
                return PrototypeUiStyle.DangerColor;
            case PrototypePlayerHudSeverity.Disabled:
                return PrototypeUiStyle.DisabledColor;
            default:
                return Color.white;
        }
    }
}

public sealed class PrototypePlayerHudRadarGraphic : MaskableGraphic
{
    private PrototypePlayerHudSnapshot snapshot;

    public void SetSnapshot(PrototypePlayerHudSnapshot value)
    {
        snapshot = value;
        SetVerticesDirty();
    }

    protected override void OnPopulateMesh(VertexHelper vh)
    {
        vh.Clear();
        Rect rect = rectTransform.rect;
        Vector2 center = rect.center;
        float radius = Mathf.Min(rect.width, rect.height) * 0.42f;
        Color ringColor = new Color(0.25f, 0.85f, 1f, 0.95f);

        DrawCircle(vh, center, radius, ringColor, 1.8f, 48);
        DrawCircle(vh, center, radius * 0.5f, ringColor, 1.2f, 48);
        DrawLine(vh, center + Vector2.left * radius, center + Vector2.right * radius, ringColor, 1.1f);
        DrawLine(vh, center + Vector2.up * radius, center + Vector2.down * radius, ringColor, 1.1f);

        Vector2 heading = new Vector2(snapshot.ShipForward.x, snapshot.ShipForward.z);
        if (heading.sqrMagnitude <= 0.001f)
        {
            heading = Vector2.up;
        }

        heading.Normalize();
        Vector2 right = new Vector2(heading.y, -heading.x);
        DrawLine(vh, center + heading * 13f, center - heading * 9f - right * 7f, Color.white, 1.5f);
        DrawLine(vh, center - heading * 9f - right * 7f, center - heading * 9f + right * 7f, Color.white, 1.5f);
        DrawLine(vh, center - heading * 9f + right * 7f, center + heading * 13f, Color.white, 1.5f);

        if (snapshot.NavigationTargetWorldPosition.HasValue)
        {
            Vector2 target = ClampRadarPoint(center, radius, snapshot.ShipWorldPosition, snapshot.NavigationTargetWorldPosition.Value);
            DrawLine(vh, center, target, PrototypeModuleColorPalette.Target, 1f);
            DrawBlip(vh, target, PrototypeModuleColorPalette.Target);
        }

        Vector3[] route = snapshot.Navigation.RouteWorldPoints;
        if (route != null && route.Length > 1)
        {
            Vector2 previous = ClampRadarPoint(center, radius, snapshot.ShipWorldPosition, route[0]);
            for (int i = 1; i < route.Length; i++)
            {
                Vector2 next = ClampRadarPoint(center, radius, snapshot.ShipWorldPosition, route[i]);
                DrawLine(vh, previous, next, PrototypeModuleColorPalette.Target, 1f);
                previous = next;
            }
        }

        if (snapshot.Navigation.HasAvoidanceCue)
        {
            DrawBlip(vh, ClampRadarPoint(center, radius, snapshot.ShipWorldPosition, snapshot.Navigation.AvoidanceWorldPosition), PrototypeUiStyle.WarningColor);
        }

        if (snapshot.CombatTargetWorldPosition.HasValue)
        {
            DrawBlip(vh, ClampRadarPoint(center, radius, snapshot.ShipWorldPosition, snapshot.CombatTargetWorldPosition.Value), PrototypeModuleColorPalette.Gun);
        }
    }

    private static void DrawBlip(VertexHelper vh, Vector2 point, Color color)
    {
        DrawLine(vh, point + Vector2.left * 4f, point + Vector2.right * 4f, color, 2f);
        DrawLine(vh, point + Vector2.up * 4f, point + Vector2.down * 4f, color, 2f);
    }

    private static Vector2 ClampRadarPoint(Vector2 center, float radius, Vector3 origin, Vector3 target)
    {
        Vector3 delta = target - origin;
        Vector2 flat = new Vector2(delta.x, delta.z) / 1000f * radius;
        return center + Vector2.ClampMagnitude(flat, radius);
    }

    private static void DrawCircle(VertexHelper vh, Vector2 center, float radius, Color color, float thickness, int segments)
    {
        Vector2 previous = center + Vector2.right * radius;
        for (int i = 1; i <= segments; i++)
        {
            float angle = Mathf.PI * 2f * i / segments;
            Vector2 next = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
            DrawLine(vh, previous, next, color, thickness);
            previous = next;
        }
    }

    private static void DrawLine(VertexHelper vh, Vector2 start, Vector2 end, Color color, float thickness)
    {
        Vector2 delta = end - start;
        if (delta.sqrMagnitude < 0.001f)
        {
            return;
        }

        Vector2 normal = new Vector2(-delta.y, delta.x).normalized * (thickness * 0.5f);
        int index = vh.currentVertCount;
        UIVertex vertex = UIVertex.simpleVert;
        vertex.color = color;
        vertex.position = start - normal;
        vh.AddVert(vertex);
        vertex.position = start + normal;
        vh.AddVert(vertex);
        vertex.position = end + normal;
        vh.AddVert(vertex);
        vertex.position = end - normal;
        vh.AddVert(vertex);
        vh.AddTriangle(index, index + 1, index + 2);
        vh.AddTriangle(index, index + 2, index + 3);
    }
}

public readonly struct RectPreset
{
    public RectPreset(Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 sizeDelta, Vector2 anchoredPosition)
    {
        AnchorMin = anchorMin;
        AnchorMax = anchorMax;
        Pivot = pivot;
        SizeDelta = sizeDelta;
        AnchoredPosition = anchoredPosition;
    }

    public Vector2 AnchorMin { get; }
    public Vector2 AnchorMax { get; }
    public Vector2 Pivot { get; }
    public Vector2 SizeDelta { get; }
    public Vector2 AnchoredPosition { get; }
}
