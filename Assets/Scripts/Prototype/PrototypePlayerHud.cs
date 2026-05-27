using System.Collections.Generic;
using TMPro;
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
        string routeModeLabel,
        string maneuverIntentLabel,
        float stoppingDistanceMeters,
        float requiredBurnSeconds,
        float availableBurnSeconds,
        string[] warningLabels,
        Vector3[] routeWorldPoints,
        PrototypeTrajectoryPreviewSnapshot trajectoryPreview,
        bool hasAvoidanceCue,
        Vector3 avoidanceWorldPosition,
        string avoidanceLabel,
        int targetIndex,
        int targetCount,
        string planAuthorityLabel = null,
        string activeSegmentLabel = null,
        string replanStatusLabel = null,
        float totalPlanDurationSeconds = 0f,
        float totalPlanFuelKg = 0f,
        string[] maneuverStepRows = null,
        int activeObstacleCount = 0,
        string obstacleSummaryLabel = null)
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
        RouteModeLabel = string.IsNullOrWhiteSpace(routeModeLabel) ? "Route: Direkt" : routeModeLabel;
        ManeuverIntentLabel = string.IsNullOrWhiteSpace(maneuverIntentLabel) ? StateLabel : maneuverIntentLabel;
        StoppingDistanceMeters = Mathf.Max(0f, stoppingDistanceMeters);
        RequiredBurnSeconds = Mathf.Max(0f, requiredBurnSeconds);
        AvailableBurnSeconds = availableBurnSeconds;
        WarningLabels = warningLabels ?? System.Array.Empty<string>();
        RouteWorldPoints = routeWorldPoints ?? System.Array.Empty<Vector3>();
        TrajectoryPreview = trajectoryPreview;
        HasAvoidanceCue = hasAvoidanceCue;
        AvoidanceWorldPosition = avoidanceWorldPosition;
        AvoidanceLabel = string.IsNullOrWhiteSpace(avoidanceLabel) ? string.Empty : avoidanceLabel;
        TargetIndex = targetIndex > 0 && targetCount > 0 ? Mathf.Min(targetIndex, targetCount) : 0;
        TargetCount = Mathf.Max(0, targetCount);
        PlanAuthorityLabel = string.IsNullOrWhiteSpace(planAuthorityLabel) ? "Authority: Legacy live gates" : planAuthorityLabel;
        ActiveSegmentLabel = string.IsNullOrWhiteSpace(activeSegmentLabel) ? "Active: " + PhaseLabel : activeSegmentLabel;
        ReplanStatusLabel = string.IsNullOrWhiteSpace(replanStatusLabel) ? "Replan: none" : replanStatusLabel;
        TotalPlanDurationSeconds = Mathf.Max(0f, totalPlanDurationSeconds);
        TotalPlanFuelKg = Mathf.Max(0f, totalPlanFuelKg);
        ManeuverStepRows = maneuverStepRows ?? System.Array.Empty<string>();
        ActiveObstacleCount = Mathf.Max(0, activeObstacleCount);
        ObstacleSummaryLabel = string.IsNullOrWhiteSpace(obstacleSummaryLabel)
            ? (ActiveObstacleCount > 0 ? ActiveObstacleCount + " active | no blocking cue" : "0 active | no obstacle cue")
            : obstacleSummaryLabel;
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
    public string RouteModeLabel { get; }
    public string ManeuverIntentLabel { get; }
    public float StoppingDistanceMeters { get; }
    public float RequiredBurnSeconds { get; }
    public float AvailableBurnSeconds { get; }
    public string[] WarningLabels { get; }
    public Vector3[] RouteWorldPoints { get; }
    public PrototypeTrajectoryPreviewSnapshot TrajectoryPreview { get; }
    public bool HasAvoidanceCue { get; }
    public Vector3 AvoidanceWorldPosition { get; }
    public string AvoidanceLabel { get; }
    public int TargetIndex { get; }
    public int TargetCount { get; }
    public string PlanAuthorityLabel { get; }
    public string ActiveSegmentLabel { get; }
    public string ReplanStatusLabel { get; }
    public float TotalPlanDurationSeconds { get; }
    public float TotalPlanFuelKg { get; }
    public string[] ManeuverStepRows { get; }
    public int ActiveObstacleCount { get; }
    public string ObstacleSummaryLabel { get; }
    public string TargetListLabel => TargetIndex > 0 && TargetCount > 0
        ? "Target " + TargetIndex + "/" + TargetCount
        : "Target --";
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

public enum PrototypePlayerRadarBlipKind
{
    Navigation,
    SelectedNavigation,
    Combat,
    SelectedCombat,
    Objective,
    Docking,
    Beacon,
    Gate,
    Station,
    Hazard
}

public readonly struct PrototypePlayerRadarBlip
{
    public PrototypePlayerRadarBlip(
        PrototypePlayerRadarBlipKind kind,
        string label,
        Vector3 worldPosition,
        float radiusMeters = 0f)
    {
        Kind = kind;
        Label = string.IsNullOrWhiteSpace(label) ? kind.ToString() : label;
        WorldPosition = worldPosition;
        RadiusMeters = Mathf.Max(0f, radiusMeters);
    }

    public PrototypePlayerRadarBlipKind Kind { get; }
    public string Label { get; }
    public Vector3 WorldPosition { get; }
    public float RadiusMeters { get; }
    public bool IsSelected => Kind == PrototypePlayerRadarBlipKind.SelectedNavigation
        || Kind == PrototypePlayerRadarBlipKind.SelectedCombat;
}

public readonly struct PrototypePlayerRadarSnapshot
{
    public PrototypePlayerRadarSnapshot(
        float rangeMeters,
        string rangeLabel,
        Vector3 shipWorldPosition,
        Vector3 shipForward,
        PrototypePlayerRadarBlip[] blips,
        Vector3[] routeWorldPoints,
        Vector3[] trajectoryPreviewWorldPoints,
        bool hasAvoidanceWaypoint,
        Vector3 avoidanceWorldPosition)
    {
        RangeMeters = Mathf.Max(1f, rangeMeters);
        RangeLabel = string.IsNullOrWhiteSpace(rangeLabel) ? "Range --" : rangeLabel;
        ShipWorldPosition = shipWorldPosition;
        ShipForward = shipForward.sqrMagnitude > 0.0001f ? shipForward.normalized : Vector3.forward;
        Blips = blips ?? System.Array.Empty<PrototypePlayerRadarBlip>();
        RouteWorldPoints = routeWorldPoints ?? System.Array.Empty<Vector3>();
        TrajectoryPreviewWorldPoints = trajectoryPreviewWorldPoints ?? System.Array.Empty<Vector3>();
        HasAvoidanceWaypoint = hasAvoidanceWaypoint;
        AvoidanceWorldPosition = avoidanceWorldPosition;
    }

    public float RangeMeters { get; }
    public string RangeLabel { get; }
    public Vector3 ShipWorldPosition { get; }
    public Vector3 ShipForward { get; }
    public PrototypePlayerRadarBlip[] Blips { get; }
    public Vector3[] RouteWorldPoints { get; }
    public Vector3[] TrajectoryPreviewWorldPoints { get; }
    public bool HasAvoidanceWaypoint { get; }
    public Vector3 AvoidanceWorldPosition { get; }
}

public enum PrototypePlayerTargetIndicatorKind
{
    Navigation,
    Combat,
    Docking,
    Objective
}

public readonly struct PrototypePlayerTargetIndicator
{
    public PrototypePlayerTargetIndicator(
        PrototypePlayerTargetIndicatorKind kind,
        string label,
        string statusLabel,
        Vector3 worldPosition,
        float distanceMeters,
        PrototypePlayerHudSeverity severity,
        float healthFraction,
        bool selected,
        bool showLabel)
    {
        Kind = kind;
        Label = string.IsNullOrWhiteSpace(label) ? kind.ToString() : label;
        StatusLabel = string.IsNullOrWhiteSpace(statusLabel) ? string.Empty : statusLabel;
        WorldPosition = worldPosition;
        DistanceMeters = Mathf.Max(0f, distanceMeters);
        Severity = severity;
        HealthFraction = Mathf.Clamp01(healthFraction);
        Selected = selected;
        ShowLabel = showLabel;
    }

    public PrototypePlayerTargetIndicatorKind Kind { get; }
    public string Label { get; }
    public string StatusLabel { get; }
    public Vector3 WorldPosition { get; }
    public float DistanceMeters { get; }
    public PrototypePlayerHudSeverity Severity { get; }
    public float HealthFraction { get; }
    public bool Selected { get; }
    public bool ShowLabel { get; }
}

public readonly struct PrototypePlayerTargetIndicatorSnapshot
{
    public PrototypePlayerTargetIndicatorSnapshot(PrototypePlayerTargetIndicator[] indicators)
    {
        Indicators = indicators ?? System.Array.Empty<PrototypePlayerTargetIndicator>();
    }

    public PrototypePlayerTargetIndicator[] Indicators { get; }
}

public readonly struct PrototypePlayerProjectedTargetIndicator
{
    public PrototypePlayerProjectedTargetIndicator(
        PrototypePlayerTargetIndicator indicator,
        Vector2 canvasPosition,
        bool offscreen,
        bool labelVisible)
    {
        Indicator = indicator;
        CanvasPosition = canvasPosition;
        Offscreen = offscreen;
        LabelVisible = labelVisible;
    }

    public PrototypePlayerTargetIndicator Indicator { get; }
    public Vector2 CanvasPosition { get; }
    public bool Offscreen { get; }
    public bool LabelVisible { get; }
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
        PrototypePlayerRadarSnapshot radar,
        PrototypePlayerTargetIndicatorSnapshot targetIndicators,
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
        Radar = radar;
        TargetIndicators = targetIndicators;
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
    public PrototypePlayerRadarSnapshot Radar { get; }
    public PrototypePlayerTargetIndicatorSnapshot TargetIndicators { get; }
    public Vector3 ShipWorldPosition { get; }
    public Vector3 ShipForward { get; }
    public Vector3? NavigationTargetWorldPosition { get; }
    public Vector3? CombatTargetWorldPosition { get; }
}

public static class PrototypePlayerHudSnapshotBuilder
{
    private const float DockingGuidanceRadiusMeters = 120f;

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
        bool dockingTargetSelected = targetDockingPort != null;
        DockingPort effectiveSourceDockingPort = sourceDockingPort != null
            ? sourceDockingPort
            : dockingApproachAssist != null ? dockingApproachAssist.SourceDockingPort : null;
        DockingPort effectiveTargetDockingPort = targetDockingPort;
        if (effectiveTargetDockingPort == null
            && dockingApproachAssist != null
            && dockingApproachAssist.IsAssistanceRouted)
        {
            effectiveTargetDockingPort = dockingApproachAssist.TargetDockingPort;
        }

        PrototypePlayerFlightSnapshot flight = BuildFlight(shipRigidbody, stats, controller);
        PrototypePlayerNavigationSnapshot navigation = BuildNavigation(autopilot, trajectoryPreview);
        PrototypePlayerCombatSnapshot combat = BuildCombat(weaponComputer);
        PrototypePveArenaSnapshot arena = arenaLoop != null ? arenaLoop.Snapshot : default;
        PrototypePlayerDockingSnapshot docking = BuildDocking(
            effectiveSourceDockingPort,
            effectiveTargetDockingPort,
            shipRigidbody,
            dockingApproachAssist,
            dockingTargetSelected);
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
            docking.Visible
                ? PrototypeFlightHud.HudMode.Docking
                : PrototypeFlightHud.HudMode.World);

        PrototypePlayerShipStatusSnapshot shipStatus = BuildShipStatus(stats, controller, weaponComputer);
        PrototypePlayerHudChip[] warnings = BuildWarningChips(stats, controller, autopilot, momentumAssist, combat, docking);
        PrototypePlayerHudChip[] assists = BuildAssistChips(autopilot, momentumAssist, navigation, combat, docking, arena);
        PrototypePlayerRadarSnapshot radar = BuildRadar(
            shipRoot,
            autopilot,
            weaponComputer,
            effectiveTargetDockingPort,
            arenaLoop,
            navigation);
        PrototypePlayerTargetIndicatorSnapshot targetIndicators = BuildTargetIndicators(
            shipRoot,
            navigation,
            combat,
            docking,
            arena,
            radar);

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
            radar,
            targetIndicators,
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
            case "NO ATTITUDE":
            case "NoAttitudeAuthority":
                return "Autopilot: keine Dreh-Autoritaet";
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
            case PrototypeTurretFireBlockReason.LineBlocked:
                return "Schusslinie blockiert";
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
            lines.Add("F5: navigation map");
            lines.Add("F7: combat computer");
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
                preview.HasRenderablePoints ? "Route: Vorschau" : "Route: Kein Ziel",
                preview.HasRenderablePoints ? "Manoever: Vorschau" : "Manoever: Kein Ziel",
                0f,
                0f,
                0f,
                System.Array.Empty<string>(),
                System.Array.Empty<Vector3>(),
                preview,
                false,
                Vector3.zero,
                string.Empty,
                0,
                0);
        }

        string eta = FormatNavigationEta(autopilot.EtaSeconds, autopilot.ClosingSpeed);
        string[] sourceWarnings = autopilot.BuildNavigationWarningChips();
        string[] warnings = new string[sourceWarnings.Length];
        for (int i = 0; i < sourceWarnings.Length; i++)
        {
            warnings[i] = TranslateWarning(sourceWarnings[i]);
        }

        PrototypeFlightPlan flightPlan = autopilot.CurrentFlightPlan;
        bool hasFlightPlan = flightPlan.HasSegments;
        Vector3[] routePoints = hasFlightPlan
            ? CopyFlightPlanRoutePoints(flightPlan.predictedSamples, 8)
            : CopyRoutePoints(autopilot.PredictedRoute, 8);
        Vector3 autopilotOrigin = autopilot.transform != null ? autopilot.transform.position : Vector3.zero;
        routePoints = ResolveNavigationRoutePoints(autopilotOrigin, autopilot, routePoints);
        bool hasAvoidanceCue = autopilot.AvoidanceActive || autopilot.NavigationObstacleDetected;
        bool visible = autopilot.CurrentTarget != null || autopilot.AutopilotEngaged;
        int targetCount = autopilot.WaypointManager != null ? autopilot.WaypointManager.TargetCount : (autopilot.CurrentTarget != null ? 1 : 0);
        int targetIndex = autopilot.WaypointManager != null && targetCount > 0 ? autopilot.WaypointManager.SelectedIndex + 1 : (autopilot.CurrentTarget != null ? 1 : 0);
        PrototypeTrajectorySegment[] planSegments = autopilot.PlanSegments;
        float totalPlanDuration = hasFlightPlan ? flightPlan.totalDurationSeconds : SumNavigationPlanDuration(planSegments);
        float totalPlanFuel = hasFlightPlan ? flightPlan.totalExpectedFuelKg : SumNavigationPlanFuel(planSegments);
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
            BuildNavigationRouteModeLabel(routePoints, hasAvoidanceCue),
            BuildNavigationManeuverIntentLabel(autopilot),
            autopilot.StoppingDistance,
            autopilot.RequiredBurnSeconds,
            autopilot.AvailableBurnSeconds,
            warnings,
            routePoints,
            preview,
            hasAvoidanceCue,
            autopilot.AvoidanceWaypoint,
            hasAvoidanceCue ? BuildAvoidanceLabel(autopilot) : string.Empty,
            targetIndex,
            targetCount,
            BuildNavigationPlanAuthorityLabel(autopilot, flightPlan),
            hasFlightPlan ? BuildNavigationFlightPlanActiveSegmentLabel(autopilot, flightPlan) : "Active: " + TranslateTrajectorySegmentType(autopilot.ActiveSegmentType),
            BuildNavigationReplanStatusLabel(autopilot, flightPlan),
            totalPlanDuration,
            totalPlanFuel,
            hasFlightPlan ? BuildNavigationManeuverRows(flightPlan.segments) : BuildNavigationManeuverRows(planSegments),
            PrototypeNavigationObstacleRegistry.Count,
            BuildNavigationObstacleSummaryLabel(autopilot, hasAvoidanceCue));
    }

    private static string[] BuildNavigationManeuverRows(PrototypeTrajectorySegment[] segments)
    {
        if (segments == null || segments.Length == 0)
        {
            return System.Array.Empty<string>();
        }

        const int maxRows = 5;
        int rowCount = Mathf.Min(maxRows, segments.Length);
        string[] rows = new string[rowCount + (segments.Length > maxRows ? 1 : 0)];
        float startSeconds = 0f;
        for (int i = 0; i < rowCount; i++)
        {
            PrototypeTrajectorySegment segment = segments[i];
            rows[i] = BuildNavigationManeuverRow(i, startSeconds, segment);
            startSeconds += Mathf.Max(0f, segment.durationSeconds);
        }

        if (segments.Length > maxRows)
        {
            rows[rows.Length - 1] = "... +" + (segments.Length - maxRows) + " steps";
        }

        return rows;
    }

    private static string BuildNavigationManeuverRow(int index, float startSeconds, PrototypeTrajectorySegment segment)
    {
        float endSeconds = startSeconds + Mathf.Max(0f, segment.durationSeconds);
        return (index + 1) + " T+" + FormatPlannerSeconds(startSeconds) + "-" + FormatPlannerSeconds(endSeconds)
            + " " + TranslateTrajectorySegmentType(segment.type)
            + " | " + BuildNavigationSegmentActuatorLabel(segment)
            + " | dV " + segment.expectedDeltaV.ToString("0.0")
            + " | fuel " + segment.expectedFuelKg.ToString("0.00") + "kg";
    }

    private static string[] BuildNavigationManeuverRows(PrototypeManeuverSegment[] segments)
    {
        if (segments == null || segments.Length == 0)
        {
            return System.Array.Empty<string>();
        }

        const int maxRows = 7;
        int rowCount = Mathf.Min(maxRows, segments.Length);
        string[] rows = new string[rowCount + (segments.Length > maxRows ? 1 : 0)];
        for (int i = 0; i < rowCount; i++)
        {
            rows[i] = BuildNavigationManeuverRow(segments[i]);
        }

        if (segments.Length > maxRows)
        {
            rows[rows.Length - 1] = "... +" + (segments.Length - maxRows) + " steps";
        }

        return rows;
    }

    private static string BuildNavigationManeuverRow(PrototypeManeuverSegment segment)
    {
        return (segment.index + 1) + " T+" + FormatPlannerSeconds(segment.startTimeSeconds) + "-" + FormatPlannerSeconds(segment.endTimeSeconds)
            + " " + segment.label
            + " | " + BuildNavigationSegmentActuatorLabel(segment)
            + " | dV " + segment.expectedDeltaV.ToString("0.0")
            + " | fuel " + segment.ExpectedFuelKg.ToString("0.00") + "kg";
    }

    private static string BuildNavigationSegmentActuatorLabel(PrototypeTrajectorySegment segment)
    {
        switch (segment.type)
        {
            case PrototypeTrajectorySegmentType.Burn:
                return "MAIN " + Mathf.RoundToInt(segment.throttle * 100f) + "%";
            case PrototypeTrajectorySegmentType.AvoidanceBurn:
                return segment.throttle > 0.01f
                    ? "MAIN " + Mathf.RoundToInt(segment.throttle * 100f) + "% + RCS"
                    : "RCS";
            case PrototypeTrajectorySegmentType.Brake:
                return "MAIN brake";
            case PrototypeTrajectorySegmentType.FinalApproach:
                return segment.throttle > 0.01f
                    ? "RCS/Main " + Mathf.RoundToInt(segment.throttle * 100f) + "%"
                    : "RCS";
            case PrototypeTrajectorySegmentType.Align:
                return "SAS/RCS";
            case PrototypeTrajectorySegmentType.Coast:
                return "COAST";
            case PrototypeTrajectorySegmentType.Hold:
                return "HOLD RCS";
            default:
                return "AUTO";
        }
    }

    private static string BuildNavigationSegmentActuatorLabel(PrototypeManeuverSegment segment)
    {
        switch (segment.commandMode)
        {
            case PrototypeManeuverCommandMode.AttitudeOnly:
            case PrototypeManeuverCommandMode.RcsAttitude:
                return "ATT/RCS";
            case PrototypeManeuverCommandMode.MainThrottle:
                return "MAIN " + Mathf.RoundToInt(segment.mainThrottle * 100f) + "%";
            case PrototypeManeuverCommandMode.RcsTranslation:
                return "RCS " + Mathf.RoundToInt(segment.rcsTranslationScale * 100f) + "%";
            case PrototypeManeuverCommandMode.CombinedMainAndRcs:
                return "MAIN " + Mathf.RoundToInt(segment.mainThrottle * 100f) + "% + RCS " + Mathf.RoundToInt(segment.rcsTranslationScale * 100f) + "%";
            default:
                return "AUTO";
        }
    }

    private static float SumNavigationPlanDuration(PrototypeTrajectorySegment[] segments)
    {
        if (segments == null)
        {
            return 0f;
        }

        float total = 0f;
        for (int i = 0; i < segments.Length; i++)
        {
            total += Mathf.Max(0f, segments[i].durationSeconds);
        }

        return total;
    }

    private static float SumNavigationPlanFuel(PrototypeTrajectorySegment[] segments)
    {
        if (segments == null)
        {
            return 0f;
        }

        float total = 0f;
        for (int i = 0; i < segments.Length; i++)
        {
            total += Mathf.Max(0f, segments[i].expectedFuelKg);
        }

        return total;
    }

    private static string BuildNavigationReplanStatusLabel(PrototypeWaypointAutopilot autopilot, PrototypeFlightPlan flightPlan)
    {
        if (autopilot == null)
        {
            return "Replan: no autopilot";
        }

        if (flightPlan.HasSegments && !flightPlan.isExecutable)
        {
            return "Replan: plan blocked " + flightPlan.nonExecutableReasons;
        }

        if (autopilot.FlightPlanDivergenceReasons != PrototypeFlightPlanAbortReplanReason.None)
        {
            return autopilot.FlightPlanDivergenceStatusLabel;
        }

        PrototypeTrajectoryPlan plan = autopilot.CurrentPlan;
        if (plan.fuelInsufficient)
        {
            return "Replan: fuel insufficient";
        }

        if (plan.directPathBlocked || plan.obstacleDetected || autopilot.NavigationObstacleDetected)
        {
            return "Replan: obstacle cue";
        }

        if (plan.limitedRcsAuthority || plan.holdNoAuthority || plan.limitedHoldAuthority)
        {
            return "Replan: authority limited";
        }

        if (!string.IsNullOrWhiteSpace(plan.warningStatus))
        {
            return "Replan: " + plan.warningStatus;
        }

        return "Replan: none";
    }

    private static string BuildNavigationPlanAuthorityLabel(PrototypeWaypointAutopilot autopilot, PrototypeFlightPlan flightPlan)
    {
        if (!flightPlan.HasSegments)
        {
            return "Authority: Legacy live gates";
        }

        if (!flightPlan.isExecutable)
        {
            return "Authority: Flight plan blocked | legacy gates";
        }

        string revision = "rev " + flightPlan.revision;
        if (autopilot != null && autopilot.FlightPlanExecutorActive)
        {
            return "Authority: Flight plan executor active | " + revision;
        }

        return "Authority: Flight plan emitted | executor pending | " + revision;
    }

    private static string BuildNavigationFlightPlanActiveSegmentLabel(PrototypeWaypointAutopilot autopilot, PrototypeFlightPlan flightPlan)
    {
        if (!flightPlan.HasSegments)
        {
            return "Planned: none";
        }

        PrototypeFlightPlanExecutionState executionState = autopilot != null
            ? autopilot.CurrentFlightPlanExecutionState
            : default;
        if (executionState.hasActiveSegment
            && executionState.activeSegmentIndex >= 0
            && executionState.activeSegmentIndex < flightPlan.SegmentCount)
        {
            PrototypeManeuverSegment active = flightPlan.segments[executionState.activeSegmentIndex];
            return "Active: " + (executionState.activeSegmentIndex + 1) + "/" + flightPlan.SegmentCount
                + " " + active.label
                + " " + FormatPlannerSeconds(executionState.activeElapsedSeconds)
                + "/" + FormatPlannerSeconds(active.durationSeconds);
        }

        float elapsed = autopilot != null ? autopilot.FlightPlanExecutorElapsedSeconds : 0f;
        if (flightPlan.TryGetActiveSegment(elapsed, out PrototypeManeuverSegment segment))
        {
            return "Planned: " + segment.label;
        }

        return "Planned: " + flightPlan.segments[0].label;
    }

    private static string BuildNavigationObstacleSummaryLabel(PrototypeWaypointAutopilot autopilot, bool hasAvoidanceCue)
    {
        int obstacleCount = PrototypeNavigationObstacleRegistry.Count;
        if (hasAvoidanceCue && autopilot != null)
        {
            return obstacleCount + " active | cue " + BuildAvoidanceLabel(autopilot);
        }

        return obstacleCount > 0
            ? obstacleCount + " active | no blocking cue"
            : "0 active | no obstacle cue";
    }

    private static string TranslateTrajectorySegmentType(PrototypeTrajectorySegmentType type)
    {
        switch (type)
        {
            case PrototypeTrajectorySegmentType.Align:
                return "Align";
            case PrototypeTrajectorySegmentType.Burn:
                return "Burn";
            case PrototypeTrajectorySegmentType.Coast:
                return "Coast";
            case PrototypeTrajectorySegmentType.AvoidanceBurn:
                return "Avoid";
            case PrototypeTrajectorySegmentType.Brake:
                return "Brake";
            case PrototypeTrajectorySegmentType.FinalApproach:
                return "Final";
            case PrototypeTrajectorySegmentType.Hold:
                return "Hold";
            default:
                return type.ToString();
        }
    }

    private static string FormatPlannerSeconds(float seconds)
    {
        if (float.IsInfinity(seconds))
        {
            return "inf";
        }

        if (float.IsNaN(seconds) || seconds <= 0f)
        {
            return "0.0s";
        }

        return seconds.ToString("0.0") + "s";
    }

    private static PrototypePlayerRadarSnapshot BuildRadar(
        Transform shipRoot,
        PrototypeWaypointAutopilot autopilot,
        PrototypeWeaponComputer weaponComputer,
        DockingPort dockingTarget,
        PrototypePveArenaLoop arenaLoop,
        PrototypePlayerNavigationSnapshot navigation)
    {
        Vector3 origin = shipRoot != null ? shipRoot.position : Vector3.zero;
        Vector3 forward = shipRoot != null ? shipRoot.forward : Vector3.forward;
        var blips = new List<PrototypePlayerRadarBlip>(32);
        var keys = new HashSet<string>();

        AddNavigationRadarBlips(blips, keys, autopilot);
        AddArenaRadarBlips(blips, keys, arenaLoop);
        AddCombatRadarBlips(blips, keys, shipRoot, weaponComputer);
        AddDockingRadarBlip(blips, keys, dockingTarget);
        AddEnvironmentRadarBlips(blips, keys);
        AddNavigationObstacleRadarBlips(blips, keys);

        Vector3[] route = ResolveRadarRoutePoints(origin, autopilot, navigation);
        Vector3[] preview = navigation.TrajectoryPreview.HasRenderablePoints
            ? CopyRoutePoints(navigation.TrajectoryPreview.Points, 16)
            : System.Array.Empty<Vector3>();
        float farthestMeters = 0f;
        float farthestActionableMeters = 0f;
        for (int i = 0; i < blips.Count; i++)
        {
            float distance = FlatDistance(origin, blips[i].WorldPosition);
            farthestMeters = Mathf.Max(farthestMeters, distance);
            if (ShouldUseBlipForRadarAutoRange(blips[i].Kind))
            {
                farthestActionableMeters = Mathf.Max(farthestActionableMeters, distance);
            }
        }

        farthestMeters = MaxFlatDistance(origin, route, farthestMeters);
        farthestActionableMeters = MaxFlatDistance(origin, route, farthestActionableMeters);
        farthestMeters = MaxFlatDistance(origin, preview, farthestMeters);
        farthestActionableMeters = MaxFlatDistance(origin, preview, farthestActionableMeters);
        if (navigation.HasAvoidanceCue)
        {
            float avoidanceDistance = FlatDistance(origin, navigation.AvoidanceWorldPosition);
            farthestMeters = Mathf.Max(farthestMeters, avoidanceDistance);
            farthestActionableMeters = Mathf.Max(farthestActionableMeters, avoidanceDistance);
        }

        float rangeMeters = ResolveRadarRangeMeters(farthestActionableMeters > 0.01f ? farthestActionableMeters : farthestMeters);
        SortRadarBlipsForDisplay(blips);
        return new PrototypePlayerRadarSnapshot(
            rangeMeters,
            FormatRadarRangeLabel(rangeMeters),
            origin,
            forward,
            blips.ToArray(),
            route,
            preview,
            navigation.HasAvoidanceCue,
            navigation.AvoidanceWorldPosition);
    }

    internal static void SortRadarBlipsForDisplay(List<PrototypePlayerRadarBlip> blips)
    {
        if (blips == null || blips.Count < 2)
        {
            return;
        }

        blips.Sort((left, right) =>
        {
            int priority = RadarBlipDrawPriority(left.Kind).CompareTo(RadarBlipDrawPriority(right.Kind));
            if (priority != 0)
            {
                return priority;
            }

            return string.Compare(left.Label, right.Label, System.StringComparison.Ordinal);
        });
    }

    internal static int RadarBlipDrawPriority(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.Beacon:
            case PrototypePlayerRadarBlipKind.Gate:
            case PrototypePlayerRadarBlipKind.Station:
                return 10;
            case PrototypePlayerRadarBlipKind.Navigation:
                return 20;
            case PrototypePlayerRadarBlipKind.Hazard:
                return 30;
            case PrototypePlayerRadarBlipKind.Docking:
                return 40;
            case PrototypePlayerRadarBlipKind.Objective:
                return 50;
            case PrototypePlayerRadarBlipKind.Combat:
                return 60;
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
                return 80;
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                return 90;
            default:
                return 0;
        }
    }

    private static bool ShouldUseBlipForRadarAutoRange(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
            case PrototypePlayerRadarBlipKind.Combat:
            case PrototypePlayerRadarBlipKind.SelectedCombat:
            case PrototypePlayerRadarBlipKind.Objective:
            case PrototypePlayerRadarBlipKind.Docking:
                return true;
            default:
                return false;
        }
    }

    private static Vector3[] ResolveRadarRoutePoints(
        Vector3 origin,
        PrototypeWaypointAutopilot autopilot,
        PrototypePlayerNavigationSnapshot navigation)
    {
        return ResolveNavigationRoutePoints(origin, autopilot, navigation.RouteWorldPoints);
    }

    private static Vector3[] ResolveNavigationRoutePoints(
        Vector3 origin,
        PrototypeWaypointAutopilot autopilot,
        Vector3[] routePoints)
    {
        Vector3[] route = routePoints != null ? routePoints : System.Array.Empty<Vector3>();
        if (route.Length > 1)
        {
            return route;
        }

        PrototypeNavigationTarget selected = autopilot != null ? autopilot.CurrentTarget : null;
        if (selected == null)
        {
            return route;
        }

        return new[] { origin, selected.Position };
    }

    private static PrototypePlayerTargetIndicatorSnapshot BuildTargetIndicators(
        Transform shipRoot,
        PrototypePlayerNavigationSnapshot navigation,
        PrototypePlayerCombatSnapshot combat,
        PrototypePlayerDockingSnapshot docking,
        PrototypePveArenaSnapshot arena,
        PrototypePlayerRadarSnapshot radar)
    {
        Vector3 origin = shipRoot != null ? shipRoot.position : radar.ShipWorldPosition;
        var indicators = new List<PrototypePlayerTargetIndicator>(8);
        var keys = new HashSet<string>();

        PrototypePlayerRadarBlip selectedCombat;
        if (TryFindRadarBlip(radar, PrototypePlayerRadarBlipKind.SelectedCombat, out selectedCombat))
        {
            AddTargetIndicator(
                indicators,
                keys,
                PrototypePlayerTargetIndicatorKind.Combat,
                combat.TargetName,
                combat.FireStatusLabel,
                selectedCombat.WorldPosition,
                Vector3.Distance(origin, selectedCombat.WorldPosition),
                combat.FireSeverity,
                combat.HealthPercent,
                selected: true,
                showLabel: true);
        }

        PrototypePlayerRadarBlip dockingTarget;
        if (docking.Visible && TryFindRadarBlip(radar, PrototypePlayerRadarBlipKind.Docking, out dockingTarget))
        {
            AddTargetIndicator(
                indicators,
                keys,
                PrototypePlayerTargetIndicatorKind.Docking,
                docking.TargetName,
                docking.StatusLabel,
                dockingTarget.WorldPosition,
                docking.DistanceMeters,
                docking.StatusSeverity,
                0f,
                selected: true,
                showLabel: true);
        }

        PrototypePlayerRadarBlip selectedNavigation;
        if (navigation.Visible && TryFindRadarBlip(radar, PrototypePlayerRadarBlipKind.SelectedNavigation, out selectedNavigation))
        {
            AddTargetIndicator(
                indicators,
                keys,
                PrototypePlayerTargetIndicatorKind.Navigation,
                navigation.TargetName,
                navigation.StateLabel,
                selectedNavigation.WorldPosition,
                navigation.DistanceMeters,
                PrototypePlayerHudSeverity.Info,
                0f,
                selected: true,
                showLabel: true);
        }

        if (arena.IsVisible)
        {
            PrototypePlayerRadarBlip[] blips = radar.Blips;
            int objectiveCount = 0;
            for (int i = 0; i < blips.Length && objectiveCount < 4; i++)
            {
                if (blips[i].Kind != PrototypePlayerRadarBlipKind.Objective)
                {
                    continue;
                }

                if (AddTargetIndicator(
                    indicators,
                    keys,
                    PrototypePlayerTargetIndicatorKind.Objective,
                    blips[i].Label,
                    "Objective",
                    blips[i].WorldPosition,
                    Vector3.Distance(origin, blips[i].WorldPosition),
                    PrototypePlayerHudSeverity.Info,
                    0f,
                    selected: false,
                    showLabel: false))
                {
                    objectiveCount++;
                }
            }
        }

        return new PrototypePlayerTargetIndicatorSnapshot(indicators.ToArray());
    }

    private static bool TryFindRadarBlip(PrototypePlayerRadarSnapshot radar, PrototypePlayerRadarBlipKind kind, out PrototypePlayerRadarBlip result)
    {
        PrototypePlayerRadarBlip[] blips = radar.Blips;
        for (int i = 0; i < blips.Length; i++)
        {
            if (blips[i].Kind == kind)
            {
                result = blips[i];
                return true;
            }
        }

        result = default;
        return false;
    }

    private static bool AddTargetIndicator(
        List<PrototypePlayerTargetIndicator> indicators,
        HashSet<string> keys,
        PrototypePlayerTargetIndicatorKind kind,
        string label,
        string statusLabel,
        Vector3 worldPosition,
        float distanceMeters,
        PrototypePlayerHudSeverity severity,
        float healthFraction,
        bool selected,
        bool showLabel)
    {
        string key = BuildTargetIndicatorKey(worldPosition);
        if (!keys.Add(key))
        {
            return false;
        }

        indicators.Add(new PrototypePlayerTargetIndicator(
            kind,
            label,
            statusLabel,
            worldPosition,
            distanceMeters,
            severity,
            healthFraction,
            selected,
            showLabel));
        return true;
    }

    private static string BuildTargetIndicatorKey(Vector3 worldPosition)
    {
        return Mathf.RoundToInt(worldPosition.x * 10f).ToString()
            + "|"
            + Mathf.RoundToInt(worldPosition.y * 10f).ToString()
            + "|"
            + Mathf.RoundToInt(worldPosition.z * 10f).ToString();
    }

    private static void AddNavigationRadarBlips(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        PrototypeWaypointAutopilot autopilot)
    {
        PrototypeNavigationTarget selected = autopilot != null ? autopilot.CurrentTarget : null;
        PrototypeWaypointManager manager = autopilot != null ? autopilot.WaypointManager : null;

        if (manager != null)
        {
            manager.RefreshTargets();
            PrototypeNavigationTarget[] targets = manager.NavigationTargets;
            for (int i = 0; i < targets.Length; i++)
            {
                PrototypeNavigationTarget target = targets[i];
                if (target == null || !target.isActiveAndEnabled)
                {
                    continue;
                }

                bool isSelected = selected != null && target == selected;
                AddRadarBlip(
                    blips,
                    keys,
                    isSelected ? PrototypePlayerRadarBlipKind.SelectedNavigation : PrototypePlayerRadarBlipKind.Navigation,
                    target.DisplayName,
                    target.Position,
                    target.ArrivalRadius);
            }
        }

        if (selected != null)
        {
            AddRadarBlip(
                blips,
                keys,
                PrototypePlayerRadarBlipKind.SelectedNavigation,
                selected.DisplayName,
                selected.Position,
                selected.ArrivalRadius);
        }

        AddSceneNavigationRadarBlips(blips, keys, selected);
    }

    private static void AddSceneNavigationRadarBlips(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        PrototypeNavigationTarget selected)
    {
        PrototypeNavigationTarget[] targets = UnityEngine.Object.FindObjectsByType<PrototypeNavigationTarget>(FindObjectsInactive.Exclude);
        if (targets == null || targets.Length == 0)
        {
            targets = Resources.FindObjectsOfTypeAll<PrototypeNavigationTarget>();
        }

        for (int i = 0; i < targets.Length; i++)
        {
            PrototypeNavigationTarget target = targets[i];
            if (target == null || !target.gameObject.scene.IsValid() || !target.isActiveAndEnabled)
            {
                continue;
            }

            bool isSelected = selected != null && target == selected;
            AddRadarBlip(
                blips,
                keys,
                isSelected ? PrototypePlayerRadarBlipKind.SelectedNavigation : PrototypePlayerRadarBlipKind.Navigation,
                target.DisplayName,
                target.Position,
                target.ArrivalRadius);
        }
    }

    private static void AddArenaRadarBlips(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        PrototypePveArenaLoop arenaLoop)
    {
        if (arenaLoop == null || arenaLoop.Targets == null)
        {
            return;
        }

        IReadOnlyList<PrototypePveArenaTarget> targets = arenaLoop.Targets;
        for (int i = 0; i < targets.Count; i++)
        {
            PrototypePveArenaTarget target = targets[i];
            if (target == null || target.Transform == null || target.IsDestroyed || !target.Transform.gameObject.activeInHierarchy)
            {
                continue;
            }

            AddRadarBlip(
                blips,
                keys,
                PrototypePlayerRadarBlipKind.Objective,
                target.Transform.name,
                target.Transform.position,
                6f);
        }
    }

    private static void AddCombatRadarBlips(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        Transform shipRoot,
        PrototypeWeaponComputer weaponComputer)
    {
        var seenTargetIds = new HashSet<int>();
        Transform selectedTarget = weaponComputer != null ? weaponComputer.ActiveTargetTransform : null;
        int prePrimaryCombatBlipCount = blips != null ? blips.Count : 0;
        if (weaponComputer != null && weaponComputer.AvailableTargets != null)
        {
            IReadOnlyList<PrototypeWeaponTarget> availableTargets = weaponComputer.AvailableTargets;
            for (int i = 0; i < availableTargets.Count; i++)
            {
                PrototypeWeaponTarget target = availableTargets[i];
                if (target == null || !target.IsValid || IsSameHierarchy(shipRoot, target.TargetTransform))
                {
                    continue;
                }

                seenTargetIds.Add(target.StableId);
                AddRadarBlip(
                    blips,
                    keys,
                    IsSameHierarchy(selectedTarget, target.TargetTransform)
                        ? PrototypePlayerRadarBlipKind.SelectedCombat
                        : PrototypePlayerRadarBlipKind.Combat,
                    target.Label,
                    target.Position,
                    6f);
            }
        }

        var registeredTargets = new List<Transform>();
        PrototypeWeaponTargetRegistry.CopyRegisteredTargets(registeredTargets);
        for (int i = 0; i < registeredTargets.Count; i++)
        {
            Transform candidate = registeredTargets[i];
            PrototypeWeaponTarget target = PrototypeWeaponTarget.FromTransform(candidate);
            Transform targetTransform = target != null && target.TargetTransform != null ? target.TargetTransform : candidate;
            if (targetTransform == null || IsSameHierarchy(shipRoot, targetTransform))
            {
                continue;
            }

            int targetId = targetTransform.GetHashCode();
            if (!seenTargetIds.Add(targetId))
            {
                continue;
            }

            AddRadarBlip(
                blips,
                keys,
                IsSameHierarchy(selectedTarget, targetTransform)
                    ? PrototypePlayerRadarBlipKind.SelectedCombat
                    : PrototypePlayerRadarBlipKind.Combat,
                target != null ? target.Label : targetTransform.name,
                targetTransform.position,
                6f);
        }

        if (blips == null || blips.Count == prePrimaryCombatBlipCount)
        {
            AddCombatRadarBlipsFallback(
                blips,
                keys,
                seenTargetIds,
                shipRoot,
                selectedTarget);
        }
    }

    private static void AddCombatRadarBlipsFallback(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        HashSet<int> seenTargetIds,
        Transform shipRoot,
        Transform selectedTarget)
    {
        var fallbackTargets = new List<PrototypeWeaponTarget>();
        PrototypeWeaponTarget.DiscoverInto(shipRoot, fallbackTargets, includeDebugFallback: true);
        for (int i = 0; i < fallbackTargets.Count; i++)
        {
            PrototypeWeaponTarget target = fallbackTargets[i];
            if (target == null || !target.IsValid || IsSameHierarchy(shipRoot, target.TargetTransform))
            {
                continue;
            }

            if (!seenTargetIds.Add(target.StableId))
            {
                continue;
            }

            AddRadarBlip(
                blips,
                keys,
                IsSameHierarchy(selectedTarget, target.TargetTransform)
                    ? PrototypePlayerRadarBlipKind.SelectedCombat
                    : PrototypePlayerRadarBlipKind.Combat,
                target.Label,
                target.Position,
                6f);
        }
    }

    private static void AddDockingRadarBlip(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        DockingPort dockingTarget)
    {
        if (dockingTarget == null)
        {
            return;
        }

        AddRadarBlip(
            blips,
            keys,
            PrototypePlayerRadarBlipKind.Docking,
            dockingTarget.name,
            dockingTarget.transform.position,
            8f);
    }

    private static void AddEnvironmentRadarBlips(List<PrototypePlayerRadarBlip> blips, HashSet<string> keys)
    {
        PrototypeTestEnvironment environment = UnityEngine.Object.FindAnyObjectByType<PrototypeTestEnvironment>();
        if (environment == null)
        {
            return;
        }

        PrototypeEnvironmentPoint[] points = environment.GetPointsSnapshot();
        for (int i = 0; i < points.Length; i++)
        {
            PrototypeEnvironmentPoint point = points[i];
            if (point == null || !TryMapEnvironmentPointKind(point.Kind, out PrototypePlayerRadarBlipKind blipKind))
            {
                continue;
            }

            AddRadarBlip(blips, keys, blipKind, point.Label, point.Position, point.Radius);
        }
    }

    private static void AddNavigationObstacleRadarBlips(List<PrototypePlayerRadarBlip> blips, HashSet<string> keys)
    {
        var obstacles = new List<PrototypeNavigationObstacle>();
        PrototypeNavigationObstacleRegistry.CopyActiveObstacles(obstacles);
        for (int i = 0; i < obstacles.Count; i++)
        {
            PrototypeNavigationObstacle obstacle = obstacles[i];
            if (obstacle == null || !obstacle.isActiveAndEnabled)
            {
                continue;
            }

            AddRadarBlip(
                blips,
                keys,
                PrototypePlayerRadarBlipKind.Hazard,
                obstacle.DisplayName,
                obstacle.WorldPosition,
                obstacle.EffectiveClearanceRadius);
        }
    }

    private static bool TryMapEnvironmentPointKind(PrototypeEnvironmentPointKind pointKind, out PrototypePlayerRadarBlipKind blipKind)
    {
        switch (pointKind)
        {
            case PrototypeEnvironmentPointKind.Beacon:
                blipKind = PrototypePlayerRadarBlipKind.Beacon;
                return true;
            case PrototypeEnvironmentPointKind.Gate:
                blipKind = PrototypePlayerRadarBlipKind.Gate;
                return true;
            case PrototypeEnvironmentPointKind.Station:
                blipKind = PrototypePlayerRadarBlipKind.Station;
                return true;
            case PrototypeEnvironmentPointKind.Obstacle:
                blipKind = PrototypePlayerRadarBlipKind.Hazard;
                return true;
            default:
                blipKind = default;
                return false;
        }
    }

    private static void AddRadarBlip(
        List<PrototypePlayerRadarBlip> blips,
        HashSet<string> keys,
        PrototypePlayerRadarBlipKind kind,
        string label,
        Vector3 worldPosition,
        float radiusMeters)
    {
        if (blips == null || keys == null)
        {
            return;
        }

        string key = BuildRadarBlipKey(kind, label, worldPosition);
        if (!keys.Add(key))
        {
            return;
        }

        blips.Add(new PrototypePlayerRadarBlip(kind, label, worldPosition, radiusMeters));
    }

    private static string BuildRadarBlipKey(PrototypePlayerRadarBlipKind kind, string label, Vector3 position)
    {
        return kind.ToString()
            + "|"
            + (string.IsNullOrWhiteSpace(label) ? string.Empty : label)
            + "|"
            + Mathf.RoundToInt(position.x * 10f).ToString()
            + "|"
            + Mathf.RoundToInt(position.y * 10f).ToString()
            + "|"
            + Mathf.RoundToInt(position.z * 10f).ToString();
    }

    private static bool IsSameHierarchy(Transform left, Transform right)
    {
        if (left == null || right == null)
        {
            return false;
        }

        return left == right || left.IsChildOf(right) || right.IsChildOf(left);
    }

    private static float MaxFlatDistance(Vector3 origin, Vector3[] points, float currentMax)
    {
        if (points == null)
        {
            return currentMax;
        }

        float maxDistance = currentMax;
        for (int i = 0; i < points.Length; i++)
        {
            maxDistance = Mathf.Max(maxDistance, FlatDistance(origin, points[i]));
        }

        return maxDistance;
    }

    private static float FlatDistance(Vector3 origin, Vector3 target)
    {
        Vector3 delta = target - origin;
        return new Vector2(delta.x, delta.z).magnitude;
    }

    private static float ResolveRadarRangeMeters(float farthestMeters)
    {
        if (farthestMeters > 3500f)
        {
            return 5000f;
        }

        if (farthestMeters > 1000f)
        {
            return 2500f;
        }

        if (farthestMeters > 250f)
        {
            return 1000f;
        }

        return farthestMeters > 0.01f ? 250f : 1000f;
    }

    private static string FormatRadarRangeLabel(float rangeMeters)
    {
        if (rangeMeters >= 1000f)
        {
            return "Range " + (rangeMeters / 1000f).ToString("0.#") + " km";
        }

        return "Range " + rangeMeters.ToString("0") + " m";
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
        int availableTargetCount = weaponComputer.AvailableTargets != null ? weaponComputer.AvailableTargets.Count : 0;
        float healthPercent = hasTarget ? target.CurrentHealth / Mathf.Max(1f, target.MaxHealth) : 0f;
        string health = hasTarget ? target.CurrentHealth.ToString("0") + "/" + target.MaxHealth.ToString("0") : "--";
        string autoFire = BuildAutoFireLabel(weaponComputer.AutoFireEnabled, hasTarget, fireStatus);
        string fireLabel = hasTarget ? TranslateFireStatus(fireStatus) : "No target";
        PrototypePlayerHudSeverity severity = fireStatus.canFire
            ? PrototypePlayerHudSeverity.Info
            : !hasTarget && weaponComputer.AutoFireEnabled
                ? PrototypePlayerHudSeverity.Warning
                : !hasTarget
                    ? PrototypePlayerHudSeverity.Disabled
                    : FireBlockSeverity(fireStatus.blockReason);

        return new PrototypePlayerCombatSnapshot(
            hasTarget || weaponComputer.AutoFireEnabled || availableTargetCount > 0,
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
        PrototypeDockingApproachAssist dockingApproachAssist,
        bool dockingTargetSelected)
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

        bool assistRouted = dockingApproachAssist != null
            && dockingApproachAssist.IsAssistanceRouted
            && dockingApproachAssist.TargetDockingPort == target;
        Rigidbody targetRigidbody = target.GetComponentInParent<Rigidbody>();
        if (!source.TryCalculateRelativeState(target, sourceRigidbody, targetRigidbody, out DockingRelativeState state))
        {
            return new PrototypePlayerDockingSnapshot(
                dockingTargetSelected || assistRouted,
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
        string assistLabel = assistRouted ? "Soft Capture Assist aktiv" : "Soft Capture Assist inaktiv";
        PrototypePlayerHudSeverity severity = eligibility.canSoftCapture || eligibility.canHardLock
            ? PrototypePlayerHudSeverity.Info
            : PrototypePlayerHudSeverity.Warning;
        float captureRadius = Mathf.Max(0.001f, Mathf.Min(source.CaptureRadius, target.CaptureRadius));
        float softAngle = Mathf.Max(0.001f, Mathf.Min(source.SoftCaptureAngleDegrees, target.SoftCaptureAngleDegrees));
        float softVelocity = Mathf.Max(0.001f, Mathf.Min(source.SoftCaptureMaxRelativeVelocity, target.SoftCaptureMaxRelativeVelocity));
        bool visible = dockingTargetSelected
            || assistRouted
            || (softCapture.requested && state.distance <= DockingGuidanceRadiusMeters);

        return new PrototypePlayerDockingSnapshot(
            visible,
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
                arena.Completed ? "Mission complete" : "Arena " + arena.ProgressLabel,
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
            case PrototypeTurretFireBlockReason.LineBlocked:
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

    private static Vector3[] CopyFlightPlanRoutePoints(PrototypeTrajectoryPredictedSample[] source, int maxPoints)
    {
        if (source == null || source.Length == 0 || maxPoints <= 0)
        {
            return System.Array.Empty<Vector3>();
        }

        int count = Mathf.Min(source.Length, maxPoints);
        var points = new Vector3[count];
        if (count == 1)
        {
            points[0] = source[0].position;
            return points;
        }

        for (int i = 0; i < count; i++)
        {
            int sourceIndex = Mathf.RoundToInt((source.Length - 1) * (i / (float)(count - 1)));
            points[i] = source[Mathf.Clamp(sourceIndex, 0, source.Length - 1)].position;
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

    private static string BuildNavigationRouteModeLabel(Vector3[] routePoints, bool hasAvoidanceCue)
    {
        if (hasAvoidanceCue)
        {
            return "Route: Ausweichkurs";
        }

        if (routePoints != null && routePoints.Length > 2)
        {
            return "Route: Geplant";
        }

        if (routePoints != null && routePoints.Length > 1)
        {
            return "Route: Direkt";
        }

        return "Route: Kein Plan";
    }

    private static string BuildNavigationManeuverIntentLabel(PrototypeWaypointAutopilot autopilot)
    {
        if (autopilot == null || autopilot.CurrentTarget == null)
        {
            return "Manoever: Kein Ziel";
        }

        if (!autopilot.AutopilotEngaged)
        {
            if (autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
            {
                return string.Equals(autopilot.ArrivalFailureReason, "NoAttitudeAuthority", System.StringComparison.OrdinalIgnoreCase)
                    ? "Manoever: Keine Dreh-Autoritaet"
                    : "Manoever: Nicht moeglich";
            }

            if (autopilot.AvoidanceActive || autopilot.NavigationObstacleDetected)
            {
                return "Manoever: Ausweichkurs geplant";
            }

            if (autopilot.LastMetrics.shouldBrake)
            {
                return "Manoever: Zum Bremsen drehen";
            }

            return "Manoever: Direkt-Burn bereit";
        }

        switch (autopilot.CurrentState)
        {
            case PrototypeWaypointAutopilotState.ObstacleAvoidance:
                return "Manoever: Ausweich-Burn";
            case PrototypeWaypointAutopilotState.FlipForBrake:
                return "Manoever: Zum Bremsen drehen";
            case PrototypeWaypointAutopilotState.Brake:
                return "Manoever: Main-Decel-Burn";
            case PrototypeWaypointAutopilotState.AlignForBurn:
                return "Manoever: Zum Burn ausrichten";
            case PrototypeWaypointAutopilotState.Accelerate:
                return "Manoever: Main-Transfer-Burn";
            case PrototypeWaypointAutopilotState.FinalApproach:
                return "Manoever: Endanflug trimmen";
            case PrototypeWaypointAutopilotState.HoldPosition:
                return "Manoever: Position halten";
            case PrototypeWaypointAutopilotState.Complete:
                return "Manoever: Ziel erreicht";
            case PrototypeWaypointAutopilotState.FuelInsufficient:
                return "Manoever: Zu wenig Treibstoff";
            case PrototypeWaypointAutopilotState.Failed:
                return "Manoever: Nicht moeglich";
            default:
                return "Manoever: " + TranslateNavigationState(autopilot.CurrentState);
        }
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
    private const int MinimumPlayerHudFontSize = 10;
    private const int TargetIndicatorLabelCount = 6;
    private const int MaxRadarGridSegments = 6;
    private const int MaxRadarRouteSegments = 28;
    private const int MaxRadarPreviewSegments = 28;
    private const int MaxRadarBlips = 64;
    private const int MaxNavigationPlannerMapBlips = 3;
    private const int MaxCompactRadarGenericBlips = 8;
    private const int MinimapRangeModeAuto = 0;
    private const int MinimapRangeModeCount = 5;
    private static readonly float[] MinimapRangeMeters = new[] { 250f, 1000f, 2500f, 5000f };
    private static readonly string[] MinimapRangeLabels = new[]
    {
        "Range 250 m",
        "Range 1 km",
        "Range 2.5 km",
        "Range 5 km"
    };

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
    private RectTransform objectivePanelRect;
    private RectTransform contextPanelRect;
    private RectTransform radarPanelRect;
    private TMP_Text topWarningText;
    private readonly List<TMP_Text> assistTexts = new List<TMP_Text>();
    private TMP_Text speedText;
    private TMP_Text throttleText;
    private TMP_Text fuelText;
    private Image throttleFill;
    private Image fuelFill;
    private TMP_Text modeText;
    private TMP_Text modeHintText;
    private TMP_Text rcsText;
    private TMP_Text sasText;
    private TMP_Text systemText;
    private TMP_Text objectiveTitleText;
    private TMP_Text objectiveBodyText;
    private TMP_Text contextTitleText;
    private TMP_Text contextBodyText;
    private RectTransform navigationControlRow;
    private Button navPreviousButton;
    private Button navNextButton;
    private Button navAutopilotButton;
    private Button navReplanButton;
    private Button navPreviewButton;
    private TMP_Text navAutopilotButtonText;
    private TMP_Text navPreviewButtonText;
    private RectTransform navigationPlannerPanelRect;
    private TMP_Text navigationPlannerTitleText;
    private TMP_Text navigationPlannerBodyText;
    private RectTransform navigationPlannerMapPanelRect;
    private RectTransform navigationPlannerMapLayerRect;
    private Image navigationPlannerMapHeadingImage;
    private Image navigationPlannerMapAvoidanceImage;
    private TMP_Text navigationPlannerMapText;
    private readonly List<Image> navigationPlannerMapGridSegments = new List<Image>();
    private readonly List<Image> navigationPlannerMapRouteSegments = new List<Image>();
    private readonly List<Image> navigationPlannerMapPreviewSegments = new List<Image>();
    private readonly List<Image> navigationPlannerMapBlipImages = new List<Image>();
    private Button navPlannerPreviousButton;
    private Button navPlannerNextButton;
    private Button navPlannerEngageButton;
    private Button navPlannerReplanButton;
    private Button navPlannerPreviewButton;
    private Button navPlannerRangeMinusButton;
    private Button navPlannerRangeAutoButton;
    private Button navPlannerRangePlusButton;
    private Button navPlannerCloseButton;
    private TMP_Text navPlannerEngageButtonText;
    private TMP_Text navPlannerPreviewButtonText;
    private RectTransform combatControlRow;
    private Button combatPreviousButton;
    private Button combatNextButton;
    private Button combatClearButton;
    private Button combatAutoFireButton;
    private Button combatPriorityButton;
    private TMP_Text combatAutoFireButtonText;
    private TMP_Text combatPriorityButtonText;
    private RectTransform combatComputerPanelRect;
    private TMP_Text combatComputerTitleText;
    private TMP_Text combatComputerBodyText;
    private Button combatComputerPreviousButton;
    private Button combatComputerNextButton;
    private Button combatComputerClearButton;
    private Button combatComputerAutoFireButton;
    private Button combatComputerPriorityButton;
    private Button combatComputerCloseButton;
    private TMP_Text combatComputerAutoFireButtonText;
    private TMP_Text combatComputerPriorityButtonText;
    private RectTransform contextGaugePanelRect;
    private readonly List<Image> contextGaugeFills = new List<Image>();
    private readonly List<TMP_Text> contextGaugeLabels = new List<TMP_Text>();
    private RectTransform radarLayerRect;
    private Image radarHeadingImage;
    private Image radarAvoidanceImage;
    private readonly List<Image> radarGridSegments = new List<Image>();
    private readonly List<Image> radarRouteSegments = new List<Image>();
    private readonly List<Image> radarPreviewSegments = new List<Image>();
    private readonly List<Image> radarBlipImages = new List<Image>();
    private Button radarRangeMinusButton;
    private Button radarRangeAutoButton;
    private Button radarRangePlusButton;
    private TMP_Text radarText;
    private TMP_Text helpText;
    private GameObject helpPanel;
    private Button killMomentumButton;
    private TMP_Text killMomentumButtonText;
    private readonly List<TMP_Text> markerLabels = new List<TMP_Text>();
    private readonly List<TMP_Text> targetIndicatorLabels = new List<TMP_Text>();
    private PrototypePlayerProjectedTargetIndicator[] projectedTargetIndicators = System.Array.Empty<PrototypePlayerProjectedTargetIndicator>();
    private PrototypePlayerHudSnapshot lastSnapshot;
    private static TMP_FontAsset runtimeFontAsset;
    private int lastLayoutWidth = -1;
    private int lastLayoutHeight = -1;
    private bool compactBottomBarLayout;
    private string currentKillMomentumButtonLabel = "Kill Momentum";
    private FlightControlMode cachedHelpMode;
    private bool cachedHelpIncludesDebug;
    private string cachedHelpText;
    private bool hasCachedHelpText;
    private int minimapRangeMode = MinimapRangeModeAuto;

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
        UnityEngine.InputSystem.Keyboard keyboard = UnityEngine.InputSystem.Keyboard.current;
        if (keyboard != null
            && keyboard.f1Key.wasPressedThisFrame)
        {
            SetHelpVisible(helpPanel == null || !helpPanel.activeSelf);
        }

        if (keyboard != null
            && keyboard.mKey.wasPressedThisFrame)
        {
            HandleKillMomentumAction("keybind");
        }

        if (keyboard != null
            && keyboard.cKey.wasPressedThisFrame)
        {
            HandleCombatTargetCycle();
        }

        if (keyboard != null
            && keyboard.f5Key.wasPressedThisFrame)
        {
            SetNavigationPlannerVisible(navigationPlannerPanelRect == null || !navigationPlannerPanelRect.gameObject.activeSelf);
        }

        if (keyboard != null
            && keyboard.pKey.wasPressedThisFrame)
        {
            SetNavigationPlannerVisible(navigationPlannerPanelRect == null || !navigationPlannerPanelRect.gameObject.activeSelf);
        }

        if (keyboard != null
            && keyboard.f7Key.wasPressedThisFrame
            && PrototypeUiLayoutManager.CurrentPreset == PrototypeUiPreset.Basic)
        {
            SetCombatComputerVisible(combatComputerPanelRect == null || !combatComputerPanelRect.gameObject.activeSelf);
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
        PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
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
        lastSnapshot = ApplyMinimapRangeOverride(snapshot);
        ApplySnapshot(lastSnapshot);
    }

    private PrototypePlayerHudSnapshot ApplyMinimapRangeOverride(PrototypePlayerHudSnapshot snapshot)
    {
        if (minimapRangeMode == MinimapRangeModeAuto)
        {
            return snapshot;
        }

        float rangeMeters = MinimapRangeMeters[minimapRangeMode - 1];
        string rangeLabel = MinimapRangeLabels[minimapRangeMode - 1];
        PrototypePlayerRadarBlip[] rangeFilteredBlips = FilterRadarBlipsByRange(
            snapshot.Radar.Blips,
            snapshot.Radar.ShipWorldPosition,
            rangeMeters);
        PrototypePlayerRadarSnapshot radar = new PrototypePlayerRadarSnapshot(
            rangeMeters,
            rangeLabel,
            snapshot.Radar.ShipWorldPosition,
            snapshot.Radar.ShipForward,
            rangeFilteredBlips,
            snapshot.Radar.RouteWorldPoints,
            snapshot.Radar.TrajectoryPreviewWorldPoints,
            snapshot.Radar.HasAvoidanceWaypoint,
            snapshot.Radar.AvoidanceWorldPosition);

        return new PrototypePlayerHudSnapshot(
            snapshot.Flight,
            snapshot.Navigation,
            snapshot.Combat,
            snapshot.Arena,
            snapshot.Docking,
            snapshot.ShipStatus,
            snapshot.Warnings,
            snapshot.AssistChips,
            snapshot.MarkerModel,
            radar,
            snapshot.TargetIndicators,
            snapshot.ShipWorldPosition,
            snapshot.ShipForward,
            snapshot.NavigationTargetWorldPosition,
            snapshot.CombatTargetWorldPosition);
    }

    private static PrototypePlayerRadarBlip[] FilterRadarBlipsByRange(
        PrototypePlayerRadarBlip[] source,
        Vector3 shipWorldPosition,
        float rangeMeters)
    {
        if (source == null || source.Length == 0)
        {
            return System.Array.Empty<PrototypePlayerRadarBlip>();
        }

        float maxDistance = Mathf.Max(1f, rangeMeters);
        float maxDistanceSq = maxDistance * maxDistance;

        var filtered = new List<PrototypePlayerRadarBlip>(source.Length);
        for (int i = 0; i < source.Length; i++)
        {
            PrototypePlayerRadarBlip blip = source[i];
            if (IsActionableNavigationPlannerMapBlip(blip.Kind))
            {
                filtered.Add(blip);
            }
            else
            {
                Vector3 delta = blip.WorldPosition - shipWorldPosition;
                Vector2 flat = new Vector2(delta.x, delta.z);
                if (flat.sqrMagnitude <= maxDistanceSq)
                {
                    filtered.Add(blip);
                }
            }
        }

        if (filtered.Count == source.Length)
        {
            return source;
        }

        return filtered.ToArray();
    }

    private void SetMinimapRangeMode(int mode)
    {
        minimapRangeMode = Mathf.Clamp(mode, MinimapRangeModeAuto, MinimapRangeModeCount - 1);
    }

    private void StepMinimapRangeMode(int delta)
    {
        SetMinimapRangeMode(minimapRangeMode + delta);
        RefreshNow();
    }

    private void SetMinimapRangeModeAuto()
    {
        minimapRangeMode = MinimapRangeModeAuto;
        RefreshNow();
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
            if (navigationPlannerPanelRect == null)
            {
                CreateNavigationPlannerPanel(canvas.transform);
            }

            if (combatComputerPanelRect == null)
            {
                CreateCombatComputerPanel(canvas.transform);
            }

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

        overlayGraphic = CreateGraphic<PrototypePlayerHudOverlayGraphic>("FlightMarkers", canvasObject.transform, StretchFull());
        overlayGraphic.raycastTarget = false;

        CreateTopStrip(canvasObject.transform);
        CreateBottomBar(canvasObject.transform);
        CreateSystemPanel(canvasObject.transform);
        CreateObjectivePanel(canvasObject.transform);
        CreateContextPanel(canvasObject.transform);
        CreateRadarPanel(canvasObject.transform);
        CreateNavigationPlannerPanel(canvasObject.transform);
        CreateCombatComputerPanel(canvasObject.transform);

        CreateMarkerLabels(canvasObject.transform);
        CreateTargetIndicatorLabels(canvasObject.transform);
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
        objectivePanelRect = FindHudComponent<RectTransform>("ObjectivePanel");
        contextPanelRect = FindHudComponent<RectTransform>("ContextPanel");
        radarPanelRect = FindHudComponent<RectTransform>("RadarPanel");
        radarLayerRect = FindHudComponent<RectTransform>("RadarLayer");
        radarHeadingImage = FindHudComponent<Image>("RadarHeading");
        radarAvoidanceImage = FindHudComponent<Image>("RadarAvoidance");
        LoadHudImagePool(radarGridSegments, "RadarGridSegment", MaxRadarGridSegments);
        LoadHudImagePool(radarRouteSegments, "RadarRouteSegment", MaxRadarRouteSegments);
        LoadHudImagePool(radarPreviewSegments, "RadarPreviewSegment", MaxRadarPreviewSegments);
        LoadHudImagePool(radarBlipImages, "RadarBlip", MaxRadarBlips);
        radarRangeMinusButton = FindHudComponent<Button>("RadarRangeMinus");
        radarRangeAutoButton = FindHudComponent<Button>("RadarRangeAuto");
        radarRangePlusButton = FindHudComponent<Button>("RadarRangePlus");
        topWarningText = FindHudComponent<TMP_Text>("PrimaryWarning");
        speedText = FindHudComponent<TMP_Text>("Speed");
        throttleText = FindHudComponent<TMP_Text>("Throttle");
        fuelText = FindHudComponent<TMP_Text>("Fuel");
        throttleFill = FindHudComponent<Image>("ThrottleBarFill");
        fuelFill = FindHudComponent<Image>("FuelBarFill");
        modeText = FindHudComponent<TMP_Text>("Mode");
        modeHintText = FindHudComponent<TMP_Text>("ModeHint");
        rcsText = FindHudComponent<TMP_Text>("Rcs");
        sasText = FindHudComponent<TMP_Text>("Sas");
        systemText = FindHudComponent<TMP_Text>("SystemsText");
        objectiveTitleText = FindHudComponent<TMP_Text>("ObjectiveTitle");
        objectiveBodyText = FindHudComponent<TMP_Text>("ObjectiveBody");
        contextTitleText = FindHudComponent<TMP_Text>("ContextTitle");
        contextBodyText = FindHudComponent<TMP_Text>("ContextBody");
        navigationControlRow = FindHudComponent<RectTransform>("NavigationControls");
        navPreviousButton = FindHudComponent<Button>("NavPreviousTarget");
        navNextButton = FindHudComponent<Button>("NavNextTarget");
        navAutopilotButton = FindHudComponent<Button>("NavAutopilot");
        navReplanButton = FindHudComponent<Button>("NavReplan");
        navPreviewButton = FindHudComponent<Button>("NavPreview");
        navAutopilotButtonText = FindHudComponent<TMP_Text>("NavAutopilotText");
        navPreviewButtonText = FindHudComponent<TMP_Text>("NavPreviewText");
        navigationPlannerPanelRect = FindHudComponent<RectTransform>("NavigationPlannerPanel");
        navigationPlannerTitleText = FindHudComponent<TMP_Text>("NavigationPlannerTitle");
        navigationPlannerBodyText = FindHudComponent<TMP_Text>("NavigationPlannerBody");
        navigationPlannerMapPanelRect = FindHudComponent<RectTransform>("NavigationPlannerMapPanel");
        navigationPlannerMapLayerRect = FindHudComponent<RectTransform>("NavigationPlannerMapLayer");
        navigationPlannerMapHeadingImage = FindHudComponent<Image>("NavigationPlannerMapHeading");
        navigationPlannerMapAvoidanceImage = FindHudComponent<Image>("NavigationPlannerMapAvoidance");
        navigationPlannerMapText = FindHudComponent<TMP_Text>("NavigationPlannerMapText");
        LoadHudImagePool(navigationPlannerMapGridSegments, "NavigationPlannerMapGridSegment", MaxRadarGridSegments);
        LoadHudImagePool(navigationPlannerMapRouteSegments, "NavigationPlannerMapRouteSegment", MaxRadarRouteSegments);
        LoadHudImagePool(navigationPlannerMapPreviewSegments, "NavigationPlannerMapPreviewSegment", MaxRadarPreviewSegments);
        LoadHudImagePool(navigationPlannerMapBlipImages, "NavigationPlannerMapBlip", MaxRadarBlips);
        navPlannerPreviousButton = FindHudComponent<Button>("NavPlannerPreviousTarget");
        navPlannerNextButton = FindHudComponent<Button>("NavPlannerNextTarget");
        navPlannerEngageButton = FindHudComponent<Button>("NavPlannerEngage");
        navPlannerReplanButton = FindHudComponent<Button>("NavPlannerReplan");
        navPlannerPreviewButton = FindHudComponent<Button>("NavPlannerPreview");
        navPlannerRangeMinusButton = FindHudComponent<Button>("NavPlannerRangeMinus");
        navPlannerRangeAutoButton = FindHudComponent<Button>("NavPlannerRangeAuto");
        navPlannerRangePlusButton = FindHudComponent<Button>("NavPlannerRangePlus");
        navPlannerCloseButton = FindHudComponent<Button>("NavPlannerClose");
        navPlannerEngageButtonText = FindHudComponent<TMP_Text>("NavPlannerEngageText");
        navPlannerPreviewButtonText = FindHudComponent<TMP_Text>("NavPlannerPreviewText");
        combatControlRow = FindHudComponent<RectTransform>("CombatControls");
        combatPreviousButton = FindHudComponent<Button>("CombatPreviousTarget");
        combatNextButton = FindHudComponent<Button>("CombatNextTarget");
        combatClearButton = FindHudComponent<Button>("CombatClearTarget");
        combatAutoFireButton = FindHudComponent<Button>("CombatAutoFire");
        combatPriorityButton = FindHudComponent<Button>("CombatPriority");
        combatAutoFireButtonText = FindHudComponent<TMP_Text>("CombatAutoFireText");
        combatPriorityButtonText = FindHudComponent<TMP_Text>("CombatPriorityText");
        combatComputerPanelRect = FindHudComponent<RectTransform>("CombatComputerPanel");
        combatComputerTitleText = FindHudComponent<TMP_Text>("CombatComputerTitle");
        combatComputerBodyText = FindHudComponent<TMP_Text>("CombatComputerBody");
        combatComputerPreviousButton = FindHudComponent<Button>("CombatComputerPreviousTarget");
        combatComputerNextButton = FindHudComponent<Button>("CombatComputerNextTarget");
        combatComputerClearButton = FindHudComponent<Button>("CombatComputerClearTarget");
        combatComputerAutoFireButton = FindHudComponent<Button>("CombatComputerAutoFire");
        combatComputerPriorityButton = FindHudComponent<Button>("CombatComputerPriority");
        combatComputerCloseButton = FindHudComponent<Button>("CombatComputerClose");
        combatComputerAutoFireButtonText = FindHudComponent<TMP_Text>("CombatComputerAutoFireText");
        combatComputerPriorityButtonText = FindHudComponent<TMP_Text>("CombatComputerPriorityText");
        contextGaugePanelRect = FindHudComponent<RectTransform>("ContextGauges");
        radarText = FindHudComponent<TMP_Text>("RadarText");
        helpText = FindHudComponent<TMP_Text>("HelpText");
        helpPanel = helpText != null ? helpText.transform.parent.gameObject : null;
        killMomentumButton = FindHudComponent<Button>("KillMomentum");
        killMomentumButtonText = FindHudComponent<TMP_Text>("KillMomentumText");

        assistTexts.Clear();
        for (int i = 0; i < 3; i++)
        {
            TMP_Text chip = FindHudComponent<TMP_Text>("AssistChip" + (i + 1));
            if (chip != null)
            {
                assistTexts.Add(chip);
            }
        }

        contextGaugeLabels.Clear();
        contextGaugeFills.Clear();
        for (int i = 0; i < 3; i++)
        {
            TMP_Text label = FindHudComponent<TMP_Text>("GaugeLabel" + i);
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
            TMP_Text label = FindHudComponent<TMP_Text>("Marker_" + labels[i]);
            if (label != null)
            {
                markerLabels.Add(label);
            }
        }

        targetIndicatorLabels.Clear();
        for (int i = 0; i < TargetIndicatorLabelCount; i++)
        {
            TMP_Text label = FindHudComponent<TMP_Text>("TargetIndicatorLabel" + i);
            if (label != null)
            {
                targetIndicatorLabels.Add(label);
            }
        }

        bool complete = canvasScaler != null
            && overlayGraphic != null
            && radarGraphic != null
            && topStripRect != null
            && bottomBarRect != null
            && systemPanelRect != null
            && objectivePanelRect != null
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
            && objectiveTitleText != null
            && objectiveBodyText != null
            && contextTitleText != null
            && contextBodyText != null
            && navigationControlRow != null
            && navPreviousButton != null
            && navNextButton != null
            && navAutopilotButton != null
            && navReplanButton != null
            && navPreviewButton != null
            && navAutopilotButtonText != null
            && navPreviewButtonText != null
            && navigationPlannerPanelRect != null
            && navigationPlannerTitleText != null
            && navigationPlannerBodyText != null
            && navigationPlannerMapPanelRect != null
            && navigationPlannerMapLayerRect != null
            && navigationPlannerMapHeadingImage != null
            && navigationPlannerMapAvoidanceImage != null
            && navigationPlannerMapText != null
            && navigationPlannerMapGridSegments.Count == MaxRadarGridSegments
            && navigationPlannerMapRouteSegments.Count == MaxRadarRouteSegments
            && navigationPlannerMapPreviewSegments.Count == MaxRadarPreviewSegments
            && navigationPlannerMapBlipImages.Count == MaxRadarBlips
            && navPlannerPreviousButton != null
            && navPlannerNextButton != null
            && navPlannerEngageButton != null
            && navPlannerReplanButton != null
            && navPlannerPreviewButton != null
            && navPlannerRangeMinusButton != null
            && navPlannerRangeAutoButton != null
            && navPlannerRangePlusButton != null
            && navPlannerCloseButton != null
            && navPlannerEngageButtonText != null
            && navPlannerPreviewButtonText != null
            && combatControlRow != null
            && combatPreviousButton != null
            && combatNextButton != null
            && combatClearButton != null
            && combatAutoFireButton != null
            && combatPriorityButton != null
            && combatAutoFireButtonText != null
            && combatPriorityButtonText != null
            && combatComputerPanelRect != null
            && combatComputerTitleText != null
            && combatComputerBodyText != null
            && combatComputerPreviousButton != null
            && combatComputerNextButton != null
            && combatComputerClearButton != null
            && combatComputerAutoFireButton != null
            && combatComputerPriorityButton != null
            && combatComputerCloseButton != null
            && combatComputerAutoFireButtonText != null
            && combatComputerPriorityButtonText != null
            && contextGaugePanelRect != null
            && radarLayerRect != null
            && radarHeadingImage != null
            && radarAvoidanceImage != null
            && radarGridSegments.Count == MaxRadarGridSegments
            && radarRouteSegments.Count == MaxRadarRouteSegments
            && radarPreviewSegments.Count == MaxRadarPreviewSegments
            && radarBlipImages.Count == MaxRadarBlips
            && radarRangeMinusButton != null
            && radarRangeAutoButton != null
            && radarRangePlusButton != null
            && radarText != null
            && helpText != null
            && helpPanel != null
            && killMomentumButton != null
            && killMomentumButtonText != null
            && assistTexts.Count == 3
            && contextGaugeLabels.Count == 3
            && contextGaugeFills.Count == 3
            && markerLabels.Count == 4
            && targetIndicatorLabels.Count == TargetIndicatorLabelCount;

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

    private void LoadHudImagePool(List<Image> images, string namePrefix, int expectedCount)
    {
        images.Clear();
        for (int i = 0; i < expectedCount; i++)
        {
            Image image = FindHudComponent<Image>(namePrefix + i);
            if (image != null)
            {
                images.Add(image);
            }
        }
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
        objectivePanelRect = null;
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
        objectiveTitleText = null;
        objectiveBodyText = null;
        contextTitleText = null;
        contextBodyText = null;
        navigationControlRow = null;
        navPreviousButton = null;
        navNextButton = null;
        navAutopilotButton = null;
        navReplanButton = null;
        navPreviewButton = null;
        navAutopilotButtonText = null;
        navPreviewButtonText = null;
        navigationPlannerPanelRect = null;
        navigationPlannerTitleText = null;
        navigationPlannerBodyText = null;
        navigationPlannerMapPanelRect = null;
        navigationPlannerMapLayerRect = null;
        navigationPlannerMapHeadingImage = null;
        navigationPlannerMapAvoidanceImage = null;
        navigationPlannerMapText = null;
        navigationPlannerMapGridSegments.Clear();
        navigationPlannerMapRouteSegments.Clear();
        navigationPlannerMapPreviewSegments.Clear();
        navigationPlannerMapBlipImages.Clear();
        navPlannerPreviousButton = null;
        navPlannerNextButton = null;
        navPlannerEngageButton = null;
        navPlannerReplanButton = null;
        navPlannerPreviewButton = null;
        navPlannerRangeMinusButton = null;
        navPlannerRangeAutoButton = null;
        navPlannerRangePlusButton = null;
        navPlannerCloseButton = null;
        navPlannerEngageButtonText = null;
        navPlannerPreviewButtonText = null;
        combatControlRow = null;
        combatPreviousButton = null;
        combatNextButton = null;
        combatClearButton = null;
        combatAutoFireButton = null;
        combatPriorityButton = null;
        combatAutoFireButtonText = null;
        combatPriorityButtonText = null;
        combatComputerPanelRect = null;
        combatComputerTitleText = null;
        combatComputerBodyText = null;
        combatComputerPreviousButton = null;
        combatComputerNextButton = null;
        combatComputerClearButton = null;
        combatComputerAutoFireButton = null;
        combatComputerPriorityButton = null;
        combatComputerCloseButton = null;
        combatComputerAutoFireButtonText = null;
        combatComputerPriorityButtonText = null;
        contextGaugePanelRect = null;
        contextGaugeFills.Clear();
        contextGaugeLabels.Clear();
        radarLayerRect = null;
        radarHeadingImage = null;
        radarAvoidanceImage = null;
        radarGridSegments.Clear();
        radarRouteSegments.Clear();
        radarPreviewSegments.Clear();
        radarBlipImages.Clear();
        radarRangeMinusButton = null;
        radarRangeAutoButton = null;
        radarRangePlusButton = null;
        radarText = null;
        helpText = null;
        helpPanel = null;
        killMomentumButton = null;
        killMomentumButtonText = null;
        markerLabels.Clear();
        targetIndicatorLabels.Clear();
        projectedTargetIndicators = System.Array.Empty<PrototypePlayerProjectedTargetIndicator>();
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
            TMP_Text chip = CreateText("AssistChip" + (i + 1), strip, 11, TextAnchor.MiddleCenter, PrototypeUiStyle.ActiveColor, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(160f, 18f), new Vector2(14f + (i * 166f), 3f)));
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
        killMomentumButtonText = killMomentumButton.GetComponentInChildren<TMP_Text>(true);
    }

    private void CreateSystemPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("ShipSystems", parent, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(248f, 128f), new Vector2(24f, 24f));
        systemPanelRect = panel;
        systemText = CreateText("SystemsText", panel, 12, TextAnchor.UpperLeft, Color.white, StretchFull(12f, 10f));
    }

    private void CreateObjectivePanel(Transform parent)
    {
        RectTransform panel = CreatePanel("ObjectivePanel", parent, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(270f, 82f), new Vector2(24f, -82f));
        objectivePanelRect = panel;
        objectiveTitleText = CreateText("ObjectiveTitle", panel, 12, TextAnchor.UpperLeft, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-20f, 22f), new Vector2(0f, -12f)));
        objectiveBodyText = CreateText("ObjectiveBody", panel, 11, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-20f, 38f), new Vector2(0f, -38f)));
    }

    private void CreateContextPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("ContextPanel", parent, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(356f, 194f), new Vector2(-24f, 24f));
        contextPanelRect = panel;
        contextTitleText = CreateText("ContextTitle", panel, 14, TextAnchor.UpperLeft, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-22f, 26f), new Vector2(0f, -16f)));
        contextBodyText = CreateText("ContextBody", panel, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-22f, -112f), new Vector2(0f, 6f)));
        CreateContextGaugePanel(panel);
        CreateNavigationControls(panel);
        CreateCombatControls(panel);
    }

    private void CreateNavigationControls(Transform parent)
    {
        navigationControlRow = CreateRect("NavigationControls", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, 72f)));
        navPreviousButton = CreateButton("NavPreviousTarget", navigationControlRow, "Prev", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(36f, 22f), new Vector2(0f, 0f)));
        navNextButton = CreateButton("NavNextTarget", navigationControlRow, "Next", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(36f, 22f), new Vector2(40f, 0f)));
        navAutopilotButton = CreateButton("NavAutopilot", navigationControlRow, "Engage", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(64f, 22f), new Vector2(80f, 0f)));
        navReplanButton = CreateButton("NavReplan", navigationControlRow, "Plan", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(48f, 22f), new Vector2(148f, 0f)));
        navPreviewButton = CreateButton("NavPreview", navigationControlRow, "Preview", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(72f, 22f), new Vector2(0f, 0f)));
        navAutopilotButtonText = navAutopilotButton.GetComponentInChildren<TMP_Text>(true);
        navPreviewButtonText = navPreviewButton.GetComponentInChildren<TMP_Text>(true);
        navigationControlRow.gameObject.SetActive(false);
    }

    private void CreateCombatControls(Transform parent)
    {
        combatControlRow = CreateRect("CombatControls", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, 72f)));
        combatPreviousButton = CreateButton("CombatPreviousTarget", combatControlRow, "Prev", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(36f, 22f), new Vector2(0f, 0f)));
        combatNextButton = CreateButton("CombatNextTarget", combatControlRow, "Next", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(36f, 22f), new Vector2(40f, 0f)));
        combatClearButton = CreateButton("CombatClearTarget", combatControlRow, "Clear", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(44f, 22f), new Vector2(80f, 0f)));
        combatAutoFireButton = CreateButton("CombatAutoFire", combatControlRow, "Auto", new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(72f, 22f), new Vector2(128f, 0f)));
        combatPriorityButton = CreateButton("CombatPriority", combatControlRow, "Prio", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(80f, 22f), new Vector2(0f, 0f)));
        combatAutoFireButtonText = combatAutoFireButton.GetComponentInChildren<TMP_Text>(true);
        combatPriorityButtonText = combatPriorityButton.GetComponentInChildren<TMP_Text>(true);
        if (combatAutoFireButtonText != null)
        {
            combatAutoFireButtonText.fontSize = MinimumPlayerHudFontSize;
        }

        if (combatPriorityButtonText != null)
        {
            combatPriorityButtonText.fontSize = MinimumPlayerHudFontSize;
        }

        combatControlRow.gameObject.SetActive(false);
    }

    private void CreateContextGaugePanel(Transform parent)
    {
        RectTransform panel = CreateRect("ContextGauges", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 58f), new Vector2(0f, 12f)));
        contextGaugePanelRect = panel;
        for (int i = 0; i < 3; i++)
        {
            CreateContextGaugeRow(panel, i);
        }
    }

    private void CreateContextGaugeRow(Transform parent, int index)
    {
        float y = 42f - (index * 18f);
        TMP_Text label = CreateText("GaugeLabel" + index, parent, 10, TextAnchor.MiddleLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0.5f), new Vector2(92f, 16f), new Vector2(0f, y)));
        RectTransform background = CreatePanel("GaugeBar" + index, parent, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0.5f), new Vector2(-108f, 6f), new Vector2(54f, y));
        background.GetComponent<Image>().color = new Color(0.08f, 0.1f, 0.13f, 0.95f);
        Image fill = CreateGraphic<Image>("GaugeFill" + index, background, StretchFull());
        fill.color = PrototypeUiStyle.ActiveColor;
        contextGaugeLabels.Add(label);
        contextGaugeFills.Add(fill);
    }

    private void CreateRadarPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("RadarPanel", parent, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(220f, 220f), new Vector2(-24f, -24f));
        radarPanelRect = panel;
        radarGraphic = CreateGraphic<PrototypePlayerHudRadarGraphic>("RadarGraphic", panel, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(200f, 200f), Vector2.zero));
        radarGraphic.color = Color.white;
        radarGraphic.raycastTarget = false;
        CreateRadarLayer(panel);
        radarText = CreateText("RadarText", panel, 11, TextAnchor.LowerCenter, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-12f, 22f), new Vector2(0f, 11f)));
        radarRangeMinusButton = CreateButton("RadarRangeMinus", panel, "-", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(24f, 22f), new Vector2(-46f, 34f)));
        radarRangeAutoButton = CreateButton("RadarRangeAuto", panel, "A", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(20f, 22f), new Vector2(-20f, 34f)));
        radarRangePlusButton = CreateButton("RadarRangePlus", panel, "+", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(24f, 22f), new Vector2(4f, 34f)));
    }

    private void CreateRadarLayer(Transform parent)
    {
        radarLayerRect = CreateRect("RadarLayer", parent, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(200f, 200f), Vector2.zero));
        radarHeadingImage = CreateRadarVisual("RadarHeading", radarLayerRect, new Vector2(10f, 14f), Color.white);
        radarAvoidanceImage = CreateRadarVisual("RadarAvoidance", radarLayerRect, new Vector2(9f, 9f), PrototypeUiStyle.WarningColor);

        radarGridSegments.Clear();
        for (int i = 0; i < MaxRadarGridSegments; i++)
        {
            radarGridSegments.Add(CreateRadarVisual("RadarGridSegment" + i, radarLayerRect, new Vector2(8f, 1.8f), new Color(0.25f, 0.85f, 1f, 0.72f)));
        }

        radarRouteSegments.Clear();
        for (int i = 0; i < MaxRadarRouteSegments; i++)
        {
            radarRouteSegments.Add(CreateRadarVisual("RadarRouteSegment" + i, radarLayerRect, new Vector2(8f, 3f), PrototypeModuleColorPalette.Target));
        }

        radarPreviewSegments.Clear();
        for (int i = 0; i < MaxRadarPreviewSegments; i++)
        {
            radarPreviewSegments.Add(CreateRadarVisual("RadarPreviewSegment" + i, radarLayerRect, new Vector2(8f, 3f), new Color(1f, 0.72f, 0.22f, 0.94f)));
        }

        radarBlipImages.Clear();
        for (int i = 0; i < MaxRadarBlips; i++)
        {
            radarBlipImages.Add(CreateRadarVisual("RadarBlip" + i, radarLayerRect, new Vector2(10f, 10f), PrototypeModuleColorPalette.Target));
        }
    }

    private void CreateNavigationPlannerMapLayer(Transform parent)
    {
        navigationPlannerMapLayerRect = CreateRect("NavigationPlannerMapLayer", parent, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(186f, 186f), new Vector2(-22f, 40f)));
        navigationPlannerMapHeadingImage = CreateRadarVisual("NavigationPlannerMapHeading", navigationPlannerMapLayerRect, new Vector2(10f, 14f), Color.white);
        navigationPlannerMapAvoidanceImage = CreateRadarVisual("NavigationPlannerMapAvoidance", navigationPlannerMapLayerRect, new Vector2(12f, 12f), PrototypeUiStyle.WarningColor);
        navPlannerRangeMinusButton = CreateButton("NavPlannerRangeMinus", navigationPlannerMapLayerRect, "-", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(22f, 22f), new Vector2(-44f, -12f)));
        navPlannerRangeAutoButton = CreateButton("NavPlannerRangeAuto", navigationPlannerMapLayerRect, "A", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(22f, 22f), new Vector2(-14f, -12f)));
        navPlannerRangePlusButton = CreateButton("NavPlannerRangePlus", navigationPlannerMapLayerRect, "+", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(22f, 22f), new Vector2(16f, -12f)));

        navigationPlannerMapGridSegments.Clear();
        for (int i = 0; i < MaxRadarGridSegments; i++)
        {
            navigationPlannerMapGridSegments.Add(CreateRadarVisual("NavigationPlannerMapGridSegment" + i, navigationPlannerMapLayerRect, new Vector2(8f, 1.8f), new Color(0.25f, 0.85f, 1f, 0.72f)));
        }

        navigationPlannerMapRouteSegments.Clear();
        for (int i = 0; i < MaxRadarRouteSegments; i++)
        {
            navigationPlannerMapRouteSegments.Add(CreateRadarVisual("NavigationPlannerMapRouteSegment" + i, navigationPlannerMapLayerRect, new Vector2(8f, 3.4f), PrototypeModuleColorPalette.Target));
        }

        navigationPlannerMapPreviewSegments.Clear();
        for (int i = 0; i < MaxRadarPreviewSegments; i++)
        {
            navigationPlannerMapPreviewSegments.Add(CreateRadarVisual("NavigationPlannerMapPreviewSegment" + i, navigationPlannerMapLayerRect, new Vector2(8f, 3.2f), new Color(1f, 0.72f, 0.22f, 0.94f)));
        }

        navigationPlannerMapBlipImages.Clear();
        for (int i = 0; i < MaxRadarBlips; i++)
        {
            navigationPlannerMapBlipImages.Add(CreateRadarVisual("NavigationPlannerMapBlip" + i, navigationPlannerMapLayerRect, new Vector2(10f, 10f), PrototypeModuleColorPalette.Target));
        }
    }

    private void CreateNavigationPlannerPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("NavigationPlannerPanel", parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(540f, 318f), Vector2.zero);
        navigationPlannerPanelRect = panel;
        navigationPlannerTitleText = CreateText("NavigationPlannerTitle", panel, 15, TextAnchor.UpperLeft, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-24f, 28f), new Vector2(0f, -16f)));
        navigationPlannerBodyText = CreateText("NavigationPlannerBody", panel, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-224f, -116f), new Vector2(-100f, 22f)));
        navigationPlannerMapPanelRect = CreatePanel("NavigationPlannerMapPanel", panel, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(198f, 228f), new Vector2(-12f, 34f));
        CreateNavigationPlannerMapLayer(panel);
        navigationPlannerMapText = CreateText("NavigationPlannerMapText", panel, 10, TextAnchor.LowerCenter, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(198f, 30f), new Vector2(-12f, -66f)));

        navPlannerPreviousButton = CreateButton("NavPlannerPreviousTarget", panel, "Prev", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(48f, 22f), new Vector2(12f, 54f)));
        navPlannerNextButton = CreateButton("NavPlannerNextTarget", panel, "Next", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(48f, 22f), new Vector2(66f, 54f)));
        navPlannerEngageButton = CreateButton("NavPlannerEngage", panel, "Engage", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(74f, 22f), new Vector2(120f, 54f)));
        navPlannerReplanButton = CreateButton("NavPlannerReplan", panel, "Replan", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(70f, 22f), new Vector2(200f, 54f)));
        navPlannerPreviewButton = CreateButton("NavPlannerPreview", panel, "Preview", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(92f, 22f), new Vector2(12f, 18f)));
        navPlannerCloseButton = CreateButton("NavPlannerClose", panel, "Close", new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(62f, 22f), new Vector2(-74f, 18f)));
        navPlannerEngageButtonText = navPlannerEngageButton.GetComponentInChildren<TMP_Text>(true);
        navPlannerPreviewButtonText = navPlannerPreviewButton.GetComponentInChildren<TMP_Text>(true);
        navigationPlannerMapPanelRect.gameObject.SetActive(false);
        navigationPlannerMapLayerRect.gameObject.SetActive(false);
        navigationPlannerMapText.gameObject.SetActive(false);
        panel.gameObject.SetActive(false);
    }

    private void CreateCombatComputerPanel(Transform parent)
    {
        RectTransform panel = CreatePanel("CombatComputerPanel", parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(520f, 300f), Vector2.zero);
        combatComputerPanelRect = panel;
        combatComputerTitleText = CreateText("CombatComputerTitle", panel, 15, TextAnchor.UpperLeft, Color.white, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-24f, 28f), new Vector2(0f, -16f)));
        combatComputerBodyText = CreateText("CombatComputerBody", panel, 12, TextAnchor.UpperLeft, PrototypeUiStyle.MutedColor, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-24f, -116f), new Vector2(0f, 22f)));

        combatComputerPreviousButton = CreateButton("CombatComputerPreviousTarget", panel, "Prev", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(48f, 22f), new Vector2(12f, 54f)));
        combatComputerNextButton = CreateButton("CombatComputerNextTarget", panel, "Next", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(48f, 22f), new Vector2(66f, 54f)));
        combatComputerClearButton = CreateButton("CombatComputerClearTarget", panel, "Clear", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(58f, 22f), new Vector2(120f, 54f)));
        combatComputerAutoFireButton = CreateButton("CombatComputerAutoFire", panel, "Auto", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(78f, 22f), new Vector2(184f, 54f)));
        combatComputerPriorityButton = CreateButton("CombatComputerPriority", panel, "Prio", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(92f, 22f), new Vector2(12f, 18f)));
        combatComputerCloseButton = CreateButton("CombatComputerClose", panel, "Close", new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(62f, 22f), new Vector2(-74f, 18f)));
        combatComputerAutoFireButtonText = combatComputerAutoFireButton.GetComponentInChildren<TMP_Text>(true);
        combatComputerPriorityButtonText = combatComputerPriorityButton.GetComponentInChildren<TMP_Text>(true);
        panel.gameObject.SetActive(false);
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
            TMP_Text label = CreateText("Marker_" + labels[i], parent, 10, TextAnchor.MiddleCenter, Color.white, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(44f, 18f), Vector2.zero));
            markerLabels.Add(label);
        }
    }

    private void CreateTargetIndicatorLabels(Transform parent)
    {
        for (int i = 0; i < TargetIndicatorLabelCount; i++)
        {
            TMP_Text label = CreateText("TargetIndicatorLabel" + i, parent, 10, TextAnchor.UpperCenter, Color.white, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(150f, 34f), Vector2.zero));
            label.gameObject.SetActive(false);
            targetIndicatorLabels.Add(label);
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
            + snapshot.ShipStatus.DamageLabel;

        ApplyObjectivePanel(snapshot.Arena);
        ApplyContext(snapshot);
        ConfigureNavigationPlannerPanel(snapshot);
        ConfigureCombatComputerPanel(snapshot);
        radarText.text = BuildRadarStatusLabel(snapshot.Radar);
        ConfigureRadarRangeControls();
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

        projectedTargetIndicators = ProjectTargetIndicators(snapshot, GetComponent<Camera>(), GetCanvasSize());
        UpdateTargetIndicatorLabels(projectedTargetIndicators);
        overlayGraphic.SetSnapshot(snapshot);
        overlayGraphic.SetProjectedTargetIndicators(projectedTargetIndicators);
        if (radarGraphic != null)
        {
            radarGraphic.SetSnapshot(snapshot);
        }

        ConfigureRadarLayer(snapshot);
        UpdateMarkerLabels(snapshot);
        ApplyModalVisibility(IsAnyPlayerHudModalVisible());
    }

    private void ConfigureRadarLayer(PrototypePlayerHudSnapshot snapshot)
    {
        ConfigureRadarLayer(
            snapshot,
            radarLayerRect,
            radarGridSegments,
            radarHeadingImage,
            radarAvoidanceImage,
            radarRouteSegments,
            radarPreviewSegments,
            radarBlipImages);
    }

    private void ConfigureNavigationPlannerMapLayer(PrototypePlayerHudSnapshot snapshot)
    {
        ConfigureRadarLayer(
            snapshot,
            navigationPlannerMapLayerRect,
            navigationPlannerMapGridSegments,
            navigationPlannerMapHeadingImage,
            navigationPlannerMapAvoidanceImage,
            navigationPlannerMapRouteSegments,
            navigationPlannerMapPreviewSegments,
            navigationPlannerMapBlipImages,
            true,
            6.6f,
            5.2f,
            true);
    }

    private void ConfigureRadarLayer(
        PrototypePlayerHudSnapshot snapshot,
        RectTransform layerRect,
        List<Image> gridSegments,
        Image headingImage,
        Image avoidanceImage,
        List<Image> routeSegments,
        List<Image> previewSegments,
        List<Image> blipImages,
        bool usePlannerMapBlips = false,
        float routeThickness = 3.2f,
        float previewThickness = 3f,
        bool dimPlannerGrid = false)
    {
        if (layerRect == null)
        {
            return;
        }

        Rect rect = layerRect.rect;
        float radius = Mathf.Min(rect.width, rect.height) * (usePlannerMapBlips ? 0.5f : 0.42f);
        ConfigureRadarGrid(gridSegments, radius, dimPlannerGrid);

        Vector2 heading = new Vector2(snapshot.ShipForward.x, snapshot.ShipForward.z);
        if (heading.sqrMagnitude <= 0.001f)
        {
            heading = Vector2.up;
        }

        heading.Normalize();
        ApplyRadarLine(headingImage, -heading * 9f, heading * 14f, Color.white, 2.5f);

        Vector3[] routePoints = snapshot.Radar.RouteWorldPoints ?? System.Array.Empty<Vector3>();
        if (usePlannerMapBlips)
        {
            routePoints = BuildNavigationPlannerRouteWorldPoints(snapshot, routePoints);
        }

        Vector3[] previewPoints = snapshot.Radar.TrajectoryPreviewWorldPoints ?? System.Array.Empty<Vector3>();
        ConfigureRadarSegmentPool(routeSegments, snapshot.Radar, routePoints, radius, PrototypeModuleColorPalette.Target, routeThickness, false);
        ConfigureRadarSegmentPool(previewSegments, snapshot.Radar, previewPoints, radius, new Color(1f, 0.72f, 0.22f, 0.94f), previewThickness, true);

        if (snapshot.Radar.HasAvoidanceWaypoint)
        {
            Vector2 point = RadarWorldToLayerPoint(snapshot.Radar, snapshot.Radar.AvoidanceWorldPosition, radius);
            ApplyRadarBlip(avoidanceImage, point, PrototypeUiStyle.WarningColor, new Vector2(12f, 12f), 45f);
        }
        else if (avoidanceImage != null)
        {
            avoidanceImage.gameObject.SetActive(false);
        }

        PrototypePlayerRadarBlip[] blips = usePlannerMapBlips
            ? GetNavigationPlannerMapBlips(snapshot)
            : GetCompactRadarBlips(snapshot);
        int blipCount = Mathf.Min(blips.Length, blipImages.Count);
        int blipStart = RadarBlipStartIndex(blips.Length, blipImages.Count);
        for (int i = 0; i < blipCount; i++)
        {
            PrototypePlayerRadarBlip blip = blips[blipStart + i];
            Vector2 point = RadarWorldToLayerPoint(snapshot.Radar, blip.WorldPosition, radius);
            Vector2 size = RadarBlipSize(blip.Kind);
            float rotation = RadarBlipRotation(blip.Kind);
            Color color = ColorForRadarBlipKind(blip.Kind);
            if (usePlannerMapBlips && !IsPrimaryNavigationPlannerMapBlip(blip.Kind))
            {
                color.a *= 0.4f;
                size *= 0.72f;
            }

            ApplyRadarBlip(blipImages[i], point, color, size, rotation);
        }

        for (int i = blipCount; i < blipImages.Count; i++)
        {
            blipImages[i].gameObject.SetActive(false);
        }
    }

    private static PrototypePlayerRadarBlip[] GetNavigationPlannerMapBlips(PrototypePlayerHudSnapshot snapshot)
    {
        PrototypePlayerRadarBlip[] source = snapshot.Radar.Blips ?? System.Array.Empty<PrototypePlayerRadarBlip>();
        if (!snapshot.Navigation.Visible)
        {
            return source;
        }

        return FilterNavigationPlannerMapBlips(source);
    }

    private static Vector3[] BuildNavigationPlannerRouteWorldPoints(PrototypePlayerHudSnapshot snapshot, Vector3[] routePoints)
    {
        Vector3[] route = routePoints ?? System.Array.Empty<Vector3>();
        PrototypePlayerRadarBlip selectedNavigation;
        if (!snapshot.Navigation.Visible || !TryFindPlannerRadarBlip(snapshot.Radar, PrototypePlayerRadarBlipKind.SelectedNavigation, out selectedNavigation))
        {
            return route;
        }

        if (route.Length == 0)
        {
            return new[] { snapshot.Radar.ShipWorldPosition, selectedNavigation.WorldPosition };
        }

        Vector3 lastPoint = route[route.Length - 1];
        float targetTolerance = Mathf.Max(1f, selectedNavigation.RadiusMeters);
        if ((lastPoint - selectedNavigation.WorldPosition).sqrMagnitude <= targetTolerance * targetTolerance)
        {
            return route;
        }

        Vector3[] extended = new Vector3[route.Length + 1];
        System.Array.Copy(route, extended, route.Length);
        extended[extended.Length - 1] = selectedNavigation.WorldPosition;
        return extended;
    }

    private static bool TryFindPlannerRadarBlip(PrototypePlayerRadarSnapshot radar, PrototypePlayerRadarBlipKind kind, out PrototypePlayerRadarBlip result)
    {
        PrototypePlayerRadarBlip[] blips = radar.Blips ?? System.Array.Empty<PrototypePlayerRadarBlip>();
        for (int i = 0; i < blips.Length; i++)
        {
            if (blips[i].Kind == kind)
            {
                result = blips[i];
                return true;
            }
        }

        result = default;
        return false;
    }

    private static PrototypePlayerRadarBlip[] FilterNavigationPlannerMapBlips(PrototypePlayerRadarBlip[] source)
    {
        if (source == null || source.Length == 0)
        {
            return System.Array.Empty<PrototypePlayerRadarBlip>();
        }

        var objective = new List<PrototypePlayerRadarBlip>(source.Length);
        var lowerPriority = new List<PrototypePlayerRadarBlip>(source.Length);
        var selectedCombat = new List<PrototypePlayerRadarBlip>(source.Length);
        var selectedNavigation = new List<PrototypePlayerRadarBlip>(source.Length);
        for (int i = 0; i < source.Length; i++)
        {
            PrototypePlayerRadarBlip blip = source[i];
            if (!IsActionableNavigationPlannerMapBlip(blip.Kind))
            {
                continue;
            }

            switch (blip.Kind)
            {
                case PrototypePlayerRadarBlipKind.SelectedCombat:
                    selectedCombat.Add(blip);
                    break;
                case PrototypePlayerRadarBlipKind.SelectedNavigation:
                    selectedNavigation.Add(blip);
                    break;
                case PrototypePlayerRadarBlipKind.Objective:
                    objective.Add(blip);
                    break;
                default:
                    lowerPriority.Add(blip);
                    break;
            }
        }

        PrototypePlayerHudSnapshotBuilder.SortRadarBlipsForDisplay(lowerPriority);
        PrototypePlayerHudSnapshotBuilder.SortRadarBlipsForDisplay(selectedNavigation);
        PrototypePlayerHudSnapshotBuilder.SortRadarBlipsForDisplay(selectedCombat);
        PrototypePlayerHudSnapshotBuilder.SortRadarBlipsForDisplay(objective);

        var prioritized = new List<PrototypePlayerRadarBlip>(source.Length);
        int lowerPriorityLimit = Mathf.Max(0, MaxNavigationPlannerMapBlips - selectedNavigation.Count - selectedCombat.Count - objective.Count);
        prioritized.AddRange(SelectNavigationPlannerLowerPriorityBlips(lowerPriority, lowerPriorityLimit));
        prioritized.AddRange(selectedNavigation);
        prioritized.AddRange(selectedCombat);
        prioritized.AddRange(objective);

        if (prioritized.Count > MaxNavigationPlannerMapBlips)
        {
            int startIndex = prioritized.Count - MaxNavigationPlannerMapBlips;
            return prioritized.GetRange(startIndex, MaxNavigationPlannerMapBlips).ToArray();
        }

        return prioritized.ToArray();
    }

    private static PrototypePlayerRadarBlip[] SelectNavigationPlannerLowerPriorityBlips(
        List<PrototypePlayerRadarBlip> source,
        int maxCount)
    {
        if (source == null || source.Count == 0 || maxCount <= 0)
        {
            return System.Array.Empty<PrototypePlayerRadarBlip>();
        }

        var selected = new List<PrototypePlayerRadarBlip>(Mathf.Min(maxCount, source.Count));
        AddFirstPlannerBlipKind(source, selected, PrototypePlayerRadarBlipKind.Navigation, maxCount);
        AddFirstPlannerBlipKind(source, selected, PrototypePlayerRadarBlipKind.Docking, maxCount);
        AddFirstPlannerBlipKind(source, selected, PrototypePlayerRadarBlipKind.Combat, maxCount);
        for (int i = 0; i < source.Count && selected.Count < maxCount; i++)
        {
            AddPlannerBlipIfMissing(selected, source[i], maxCount);
        }

        PrototypePlayerHudSnapshotBuilder.SortRadarBlipsForDisplay(selected);
        return selected.ToArray();
    }

    private static void AddFirstPlannerBlipKind(
        List<PrototypePlayerRadarBlip> source,
        List<PrototypePlayerRadarBlip> selected,
        PrototypePlayerRadarBlipKind kind,
        int maxCount)
    {
        for (int i = 0; i < source.Count; i++)
        {
            if (source[i].Kind == kind)
            {
                AddPlannerBlipIfMissing(selected, source[i], maxCount);
                return;
            }
        }
    }

    private static void AddPlannerBlipIfMissing(
        List<PrototypePlayerRadarBlip> selected,
        PrototypePlayerRadarBlip blip,
        int maxCount)
    {
        if (selected.Count >= maxCount)
        {
            return;
        }

        for (int i = 0; i < selected.Count; i++)
        {
            if (selected[i].Kind == blip.Kind && string.Equals(selected[i].Label, blip.Label, System.StringComparison.Ordinal))
            {
                return;
            }
        }

        selected.Add(blip);
    }

    private static PrototypePlayerRadarBlip[] GetCompactRadarBlips(PrototypePlayerHudSnapshot snapshot)
    {
        PrototypePlayerRadarBlip[] source = snapshot.Radar.Blips ?? System.Array.Empty<PrototypePlayerRadarBlip>();
        if (!snapshot.Navigation.Visible)
        {
            return source;
        }

        var priority = new List<PrototypePlayerRadarBlip>(source.Length);
        var generic = new List<PrototypePlayerRadarBlip>(source.Length);
        for (int i = 0; i < source.Length; i++)
        {
            if (IsActionableNavigationPlannerMapBlip(source[i].Kind))
            {
                priority.Add(source[i]);
            }
            else
            {
                generic.Add(source[i]);
            }
        }

        if (generic.Count <= MaxCompactRadarGenericBlips)
        {
            return source;
        }

        Vector3 shipWorldPosition = snapshot.Radar.ShipWorldPosition;
        generic.Sort((a, b) =>
            (a.WorldPosition - shipWorldPosition).sqrMagnitude.CompareTo((b.WorldPosition - shipWorldPosition).sqrMagnitude));

        int maxGeneric = Mathf.Max(0, MaxCompactRadarGenericBlips - priority.Count);
        if (maxGeneric < 0)
        {
            maxGeneric = 0;
        }

        var filtered = new List<PrototypePlayerRadarBlip>(priority.Count + maxGeneric);
        for (int i = 0; i < generic.Count && i < maxGeneric; i++)
        {
            filtered.Add(generic[i]);
        }
        filtered.AddRange(priority);

        return filtered.ToArray();
    }

    private static bool IsActionableNavigationPlannerMapBlip(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.Navigation:
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
            case PrototypePlayerRadarBlipKind.Objective:
            case PrototypePlayerRadarBlipKind.Docking:
            case PrototypePlayerRadarBlipKind.Combat:
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                return true;
            default:
                return false;
        }
    }

    private static bool IsPrimaryNavigationPlannerMapBlip(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
            case PrototypePlayerRadarBlipKind.SelectedCombat:
            case PrototypePlayerRadarBlipKind.Objective:
                return true;
            default:
                return false;
        }
    }

    private static int RadarBlipStartIndex(int totalBlips, int imageCapacity)
    {
        if (totalBlips <= 0 || imageCapacity <= 0 || totalBlips <= imageCapacity)
        {
            return 0;
        }

        return totalBlips - imageCapacity;
    }

    private void ConfigureRadarGrid(List<Image> gridSegments, float radius, bool dimForPlannerMap = false)
    {
        if (gridSegments == null || gridSegments.Count < MaxRadarGridSegments)
        {
            return;
        }

        Color gridColor = dimForPlannerMap
            ? new Color(0.25f, 0.85f, 1f, 0.45f)
            : new Color(0.25f, 0.85f, 1f, 0.72f);
        float majorThickness = dimForPlannerMap ? 1.4f : 1.8f;
        float minorThickness = dimForPlannerMap ? 1.15f : 1.5f;
        ApplyRadarLine(gridSegments[0], new Vector2(-radius, 0f), new Vector2(radius, 0f), gridColor, majorThickness);
        ApplyRadarLine(gridSegments[1], new Vector2(0f, -radius), new Vector2(0f, radius), gridColor, majorThickness);
        ApplyRadarLine(gridSegments[2], new Vector2(-radius, radius), new Vector2(radius, radius), gridColor, minorThickness);
        ApplyRadarLine(gridSegments[3], new Vector2(radius, radius), new Vector2(radius, -radius), gridColor, minorThickness);
        ApplyRadarLine(gridSegments[4], new Vector2(radius, -radius), new Vector2(-radius, -radius), gridColor, minorThickness);
        ApplyRadarLine(gridSegments[5], new Vector2(-radius, -radius), new Vector2(-radius, radius), gridColor, minorThickness);
    }

    private void ConfigureRadarSegmentPool(
        List<Image> pool,
        PrototypePlayerRadarSnapshot radar,
        Vector3[] worldPoints,
        float radius,
        Color color,
        float thickness,
        bool dashed)
    {
        if (pool == null)
        {
            return;
        }

        int segmentCount = 0;
        if (worldPoints != null && worldPoints.Length > 1)
        {
            Vector2 previous = RadarWorldToLayerPoint(radar, worldPoints[0], radius);
            for (int i = 1; i < worldPoints.Length && segmentCount < pool.Count; i++)
            {
                Vector2 next = RadarWorldToLayerPoint(radar, worldPoints[i], radius);
                if (!dashed || (i % 2) == 1)
                {
                    ApplyRadarLine(pool[segmentCount], previous, next, color, thickness);
                    segmentCount++;
                }

                previous = next;
            }
        }

        for (int i = segmentCount; i < pool.Count; i++)
        {
            pool[i].gameObject.SetActive(false);
        }
    }

    private static Vector2 RadarWorldToLayerPoint(PrototypePlayerRadarSnapshot radar, Vector3 target, float radius)
    {
        Vector3 delta = target - radar.ShipWorldPosition;
        Vector2 flat = new Vector2(delta.x, delta.z);
        return ProjectRadarOffset(flat, radar.RangeMeters, radius);
    }

    private static Vector2 ProjectRadarOffset(Vector2 flatOffset, float rangeMeters, float radius)
    {
        float range = Mathf.Max(1f, rangeMeters);
        float rawDistance = flatOffset.magnitude;
        if (rawDistance <= 0.0001f)
        {
            return Vector2.zero;
        }

        float normalizedDistance = Mathf.Clamp01(rawDistance / range);
        float easedDistance = Mathf.Sqrt(normalizedDistance);
        return flatOffset.normalized * (easedDistance * radius);
    }

    private static void ApplyRadarLine(Image image, Vector2 start, Vector2 end, Color color, float thickness)
    {
        if (image == null)
        {
            return;
        }

        Vector2 delta = end - start;
        if (delta.sqrMagnitude < 0.001f)
        {
            image.gameObject.SetActive(false);
            return;
        }

        RectTransform rect = image.rectTransform;
        image.color = color;
        rect.sizeDelta = new Vector2(delta.magnitude, thickness);
        rect.anchoredPosition = (start + end) * 0.5f;
        rect.localRotation = Quaternion.Euler(0f, 0f, Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg);
        image.gameObject.SetActive(true);
    }

    private static void ApplyRadarBlip(Image image, Vector2 point, Color color, Vector2 size, float rotationDegrees)
    {
        if (image == null)
        {
            return;
        }

        RectTransform rect = image.rectTransform;
        image.color = color;
        rect.sizeDelta = size;
        rect.anchoredPosition = point;
        rect.localRotation = Quaternion.Euler(0f, 0f, rotationDegrees);
        image.gameObject.SetActive(true);
    }

    private static Vector2 RadarBlipSize(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                return new Vector2(17f, 17f);
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
                return new Vector2(16f, 16f);
            case PrototypePlayerRadarBlipKind.Objective:
                return new Vector2(13f, 13f);
            case PrototypePlayerRadarBlipKind.Combat:
                return new Vector2(12f, 12f);
            case PrototypePlayerRadarBlipKind.Docking:
                return new Vector2(14f, 12f);
            case PrototypePlayerRadarBlipKind.Hazard:
                return new Vector2(14f, 14f);
            default:
                return new Vector2(11f, 11f);
        }
    }

    private static float RadarBlipRotation(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
            case PrototypePlayerRadarBlipKind.Navigation:
            case PrototypePlayerRadarBlipKind.Objective:
            case PrototypePlayerRadarBlipKind.Hazard:
                return 45f;
            default:
                return 0f;
        }
    }

    private static Color ColorForRadarBlipKind(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.Combat:
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                return PrototypeModuleColorPalette.Gun;
            case PrototypePlayerRadarBlipKind.Objective:
                return PrototypeUiStyle.WarningColor;
            case PrototypePlayerRadarBlipKind.Docking:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerRadarBlipKind.Beacon:
                return new Color(0.95f, 0.55f, 1f, 0.95f);
            case PrototypePlayerRadarBlipKind.Gate:
                return new Color(0.4f, 1f, 0.7f, 0.95f);
            case PrototypePlayerRadarBlipKind.Station:
                return new Color(0.66f, 0.72f, 0.82f, 0.95f);
            case PrototypePlayerRadarBlipKind.Hazard:
                return new Color(1f, 0.55f, 0.18f, 0.95f);
            default:
                return PrototypeModuleColorPalette.Target;
        }
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
        killMomentumButton.onClick.AddListener(() => HandleKillMomentumAction("button"));
    }

    private void HandleKillMomentumAction(string source)
    {
        if (momentumAssist == null)
        {
            return;
        }

        if (momentumAssist.IsActive)
        {
            momentumAssist.Abort(source);
            return;
        }

        if (momentumAssist.CurrentState == PrototypeMomentumAssistState.NoAuthority
            || momentumAssist.CurrentState == PrototypeMomentumAssistState.FuelInsufficient)
        {
            return;
        }

        momentumAssist.ActivateFromUi();
    }

    private void HandleCombatTargetCycle()
    {
        if (weaponComputer == null)
        {
            return;
        }

        weaponComputer.SelectNextTarget();
    }

    private void SetKillMomentumButtonState(string label, bool interactable)
    {
        currentKillMomentumButtonLabel = label;
        ApplyKillMomentumButtonLabel();

        killMomentumButton.interactable = interactable;
    }

    private void ApplyKillMomentumButtonLabel()
    {
        if (killMomentumButtonText == null)
        {
            return;
        }

        killMomentumButtonText.text = compactBottomBarLayout
            ? CompactKillMomentumLabel(currentKillMomentumButtonLabel)
            : currentKillMomentumButtonLabel;
    }

    private static string CompactKillMomentumLabel(string label)
    {
        switch (label)
        {
            case "Kill Momentum":
                return "Kill";
            case "Abort Assist":
                return "Abort";
            case "No Authority":
                return "No Auth";
            case "Assist n/a":
                return "No Assist";
            default:
                return label;
        }
    }

    private void ConfigureNavigationControls(bool visible)
    {
        if (navigationControlRow == null)
        {
            return;
        }

        navigationControlRow.gameObject.SetActive(visible);
        if (!visible)
        {
            RemoveNavigationButtonListeners();
            return;
        }

        bool hasAutopilot = autopilot != null;
        bool hasTarget = hasAutopilot && autopilot.CurrentTarget != null;
        int targetCount = hasAutopilot && autopilot.WaypointManager != null ? autopilot.WaypointManager.TargetCount : (hasTarget ? 1 : 0);

        SetNavigationButtonState(navPreviousButton, hasAutopilot && targetCount > 1, () =>
        {
            autopilot.SelectPreviousTarget();
            autopilot.ReplanNow();
            RefreshNow();
        });
        SetNavigationButtonState(navNextButton, hasAutopilot && targetCount > 1, () =>
        {
            autopilot.SelectNextTarget();
            autopilot.ReplanNow();
            RefreshNow();
        });

        if (navAutopilotButtonText != null)
        {
            navAutopilotButtonText.text = !hasAutopilot ? "AP n/a" : autopilot.AutopilotEngaged ? "Abort AP" : "Engage";
        }

        SetNavigationButtonState(navAutopilotButton, hasAutopilot && (hasTarget || autopilot.AutopilotEngaged), () =>
        {
            autopilot.ToggleAutopilot();
            RefreshNow();
        });
        SetNavigationButtonState(navReplanButton, hasAutopilot && hasTarget, () =>
        {
            SetNavigationPlannerVisible(true);
            autopilot.ReplanNow();
            RefreshNow();
        });

        bool hasPreview = trajectoryPreview != null;
        if (navPreviewButtonText != null)
        {
            navPreviewButtonText.text = !hasPreview ? "Preview n/a" : trajectoryPreview.PreviewEnabled ? "Preview On" : "Preview Off";
        }

        SetNavigationButtonState(navPreviewButton, hasPreview, () =>
        {
            trajectoryPreview.TogglePreview();
            RefreshNow();
        });
    }

    private void ConfigureRadarRangeControls()
    {
        if (radarRangeMinusButton == null)
        {
            return;
        }

        SetNavigationButtonState(radarRangeMinusButton, true, () => StepMinimapRangeMode(-1));
        SetNavigationButtonState(radarRangeAutoButton, true, SetMinimapRangeModeAuto);
        SetNavigationButtonState(radarRangePlusButton, true, () => StepMinimapRangeMode(1));
    }

    private void ConfigureNavigationPlannerPanel(PrototypePlayerHudSnapshot snapshot)
    {
        if (navigationPlannerPanelRect == null)
        {
            return;
        }

        if (!navigationPlannerPanelRect.gameObject.activeSelf)
        {
            RemoveNavigationPlannerButtonListeners();
            return;
        }

        if (navigationPlannerTitleText != null)
        {
            navigationPlannerTitleText.text = "Navigation Planner";
        }

        if (navigationPlannerBodyText != null)
        {
            navigationPlannerBodyText.text = BuildNavigationPlannerBody(snapshot.Navigation);
            navigationPlannerBodyText.color = snapshot.Navigation.Visible ? PrototypeUiStyle.MutedColor : PrototypeUiStyle.DisabledColor;
        }

        bool mapVisible = HasRadarMapContent(snapshot.Radar);
        if (navigationPlannerMapPanelRect != null)
        {
            navigationPlannerMapPanelRect.gameObject.SetActive(mapVisible);
        }

        if (navigationPlannerMapLayerRect != null)
        {
            navigationPlannerMapLayerRect.gameObject.SetActive(mapVisible);
        }

        if (navigationPlannerMapText != null)
        {
            navigationPlannerMapText.gameObject.SetActive(mapVisible);
            navigationPlannerMapText.text = BuildNavigationPlannerMapLabel(snapshot);
            navigationPlannerMapText.color = mapVisible ? PrototypeUiStyle.MutedColor : PrototypeUiStyle.DisabledColor;
        }

        ConfigureNavigationPlannerMapLayer(snapshot);
        ConfigureNavigationPlannerRangeControls();

        bool hasAutopilot = autopilot != null;
        bool hasTarget = hasAutopilot && autopilot.CurrentTarget != null;
        int targetCount = hasAutopilot && autopilot.WaypointManager != null ? autopilot.WaypointManager.TargetCount : (hasTarget ? 1 : 0);

        SetNavigationButtonState(navPlannerPreviousButton, hasAutopilot && targetCount > 1, () =>
        {
            autopilot.SelectPreviousTarget();
            autopilot.ReplanNow();
            RefreshNow();
        });
        SetNavigationButtonState(navPlannerNextButton, hasAutopilot && targetCount > 1, () =>
        {
            autopilot.SelectNextTarget();
            autopilot.ReplanNow();
            RefreshNow();
        });

        if (navPlannerEngageButtonText != null)
        {
            navPlannerEngageButtonText.text = !hasAutopilot ? "AP n/a" : autopilot.AutopilotEngaged ? "Abort AP" : "Engage";
        }

        SetNavigationButtonState(navPlannerEngageButton, hasAutopilot && (hasTarget || autopilot.AutopilotEngaged), () =>
        {
            autopilot.ToggleAutopilot();
            RefreshNow();
        });
        SetNavigationButtonState(navPlannerReplanButton, hasAutopilot && hasTarget, () =>
        {
            autopilot.ReplanNow();
            RefreshNow();
        });

        bool hasPreview = trajectoryPreview != null;
        if (navPlannerPreviewButtonText != null)
        {
            navPlannerPreviewButtonText.text = !hasPreview ? "Preview n/a" : trajectoryPreview.PreviewEnabled ? "Preview On" : "Preview Off";
        }

        SetNavigationButtonState(navPlannerPreviewButton, hasPreview, () =>
        {
            trajectoryPreview.TogglePreview();
            RefreshNow();
        });
        SetNavigationButtonState(navPlannerCloseButton, true, () => SetNavigationPlannerVisible(false));
    }

    private void RemoveNavigationPlannerButtonListeners()
    {
        RemoveButtonListeners(navPlannerPreviousButton);
        RemoveButtonListeners(navPlannerNextButton);
        RemoveButtonListeners(navPlannerEngageButton);
        RemoveButtonListeners(navPlannerReplanButton);
        RemoveButtonListeners(navPlannerPreviewButton);
        RemoveButtonListeners(navPlannerRangeMinusButton);
        RemoveButtonListeners(navPlannerRangeAutoButton);
        RemoveButtonListeners(navPlannerRangePlusButton);
        RemoveButtonListeners(navPlannerCloseButton);
    }

    private void ConfigureNavigationPlannerRangeControls()
    {
        if (navPlannerRangeMinusButton == null)
        {
            return;
        }

        SetNavigationButtonState(navPlannerRangeMinusButton, true, () => StepMinimapRangeMode(-1));
        SetNavigationButtonState(navPlannerRangeAutoButton, true, SetMinimapRangeModeAuto);
        SetNavigationButtonState(navPlannerRangePlusButton, true, () => StepMinimapRangeMode(1));
    }

    private static string BuildNavigationPlannerBody(PrototypePlayerNavigationSnapshot navigation)
    {
        if (!navigation.Visible)
        {
            return "No navigation target selected";
        }

        string routeLabel = navigation.RouteWorldPoints.Length > 1
            ? navigation.RouteModeLabel + " " + navigation.RouteWorldPoints.Length + " pts"
            : "No route";
        string previewLabel = navigation.TrajectoryPreview.Enabled
            ? navigation.TrajectoryPreview.StatusLabel
            : "Preview off";
        string avoidanceLabel = navigation.HasAvoidanceCue ? navigation.AvoidanceLabel : "No obstacle cue";
        string burnLabel = "Burn " + FormatBurnSeconds(navigation.RequiredBurnSeconds)
            + " / avail " + FormatBurnSeconds(navigation.AvailableBurnSeconds);
        string totalPlanLabel = "Schedule " + FormatBurnSeconds(navigation.TotalPlanDurationSeconds)
            + " | fuel " + navigation.TotalPlanFuelKg.ToString("0.00") + "kg"
            + " | " + navigation.ActiveSegmentLabel;

        return navigation.TargetName + " | " + navigation.TargetListLabel + "\n"
            + "Dist " + FormatDistance(navigation.DistanceMeters) + " | ETA " + navigation.EtaLabel
            + " | Closing " + navigation.ClosingSpeed.ToString("0.0") + " m/s\n"
            + navigation.PlanAuthorityLabel + "\n"
            + "Path: " + routeLabel + " | " + previewLabel + "\n"
            + navigation.ManeuverIntentLabel + " | Stop " + FormatDistance(navigation.StoppingDistanceMeters) + "\n"
            + burnLabel + " | " + totalPlanLabel + "\n"
            + navigation.ReplanStatusLabel + " | Obstacles: " + navigation.ObstacleSummaryLabel + "\n"
            + BuildNavigationPlannerStepRows(navigation.ManeuverStepRows, avoidanceLabel);
    }

    private static string BuildNavigationPlannerStepRows(string[] rows, string fallback)
    {
        if (rows == null || rows.Length == 0)
        {
            return fallback;
        }

        string text = "Steps:";
        for (int i = 0; i < rows.Length; i++)
        {
            if (!string.IsNullOrWhiteSpace(rows[i]))
            {
                text += "\n" + rows[i];
            }
        }

        return text;
    }

    private static string BuildNavigationPlannerMapLabel(PrototypePlayerHudSnapshot snapshot)
    {
        if (!snapshot.Navigation.Visible && !HasRadarMapContent(snapshot.Radar))
        {
            return "No route";
        }

        string range = BuildNavigationPlannerMapRangeLabel(snapshot.Radar.RangeLabel);
        int contactCount = snapshot.Radar.Blips != null ? snapshot.Radar.Blips.Length : 0;
        string contacts = BuildNavigationPlannerMapContactLabel(contactCount);
        string route = BuildNavigationPlannerMapRouteLabel(snapshot.Navigation);
        string preview = BuildNavigationPlannerMapPreviewLabel(snapshot);

        if (snapshot.Navigation.Visible)
        {
            int plannerContactCount = GetNavigationPlannerMapBlips(snapshot).Length;
            contactCount = plannerContactCount;
            contacts = BuildNavigationPlannerMapContactLabel(contactCount);
        }

        return string.Join(" | ", new[] { route, preview, range, contacts });
    }

    private static string BuildNavigationPlannerMapRangeLabel(string rangeLabel)
    {
        if (string.IsNullOrEmpty(rangeLabel))
        {
            return "R:auto";
        }

        if (rangeLabel.StartsWith("Range ", System.StringComparison.OrdinalIgnoreCase))
        {
            return rangeLabel.Substring("Range ".Length);
        }

        return rangeLabel;
    }

    private static string BuildNavigationPlannerMapContactLabel(int contactCount)
    {
        if (contactCount <= 0)
        {
            return "No contacts";
        }

        return contactCount + (contactCount == 1 ? " contact" : " contacts");
    }

    private static string BuildNavigationPlannerMapRouteLabel(PrototypePlayerNavigationSnapshot navigation)
    {
        int routePointCount = navigation.RouteWorldPoints != null ? navigation.RouteWorldPoints.Length : 0;
        if (routePointCount <= 1)
        {
            return "No route";
        }

        if (routePointCount <= 2)
        {
            return "Direct " + routePointCount;
        }

        return "Route " + routePointCount;
    }

    private static string BuildNavigationPlannerMapPreviewLabel(PrototypePlayerHudSnapshot snapshot)
    {
        if (!snapshot.Navigation.Visible || !snapshot.Navigation.TrajectoryPreview.Enabled)
        {
            return "Preview off";
        }

        int previewPointCount = snapshot.Radar.TrajectoryPreviewWorldPoints != null
            ? snapshot.Radar.TrajectoryPreviewWorldPoints.Length
            : 0;
        if (previewPointCount <= 0)
        {
            return "No preview";
        }

        return "Preview " + previewPointCount;
    }

    private static string BuildRadarStatusLabel(PrototypePlayerRadarSnapshot radar)
    {
        string range = !string.IsNullOrWhiteSpace(radar.RangeLabel)
            ? radar.RangeLabel
            : "Range --";
        int contactCount = radar.Blips != null ? radar.Blips.Length : 0;
        if (contactCount <= 0)
        {
            return range;
        }

        return range + " | " + contactCount.ToString() + (contactCount == 1 ? " contact" : " contacts");
    }

    private static bool HasRadarMapContent(PrototypePlayerRadarSnapshot radar)
    {
        return (radar.Blips != null && radar.Blips.Length > 0)
            || (radar.RouteWorldPoints != null && radar.RouteWorldPoints.Length > 1)
            || (radar.TrajectoryPreviewWorldPoints != null && radar.TrajectoryPreviewWorldPoints.Length > 1)
            || radar.HasAvoidanceWaypoint;
    }

    private void RemoveNavigationButtonListeners()
    {
        if (navPreviousButton != null)
        {
            navPreviousButton.onClick.RemoveAllListeners();
        }

        if (navNextButton != null)
        {
            navNextButton.onClick.RemoveAllListeners();
        }

        if (navAutopilotButton != null)
        {
            navAutopilotButton.onClick.RemoveAllListeners();
        }

        if (navReplanButton != null)
        {
            navReplanButton.onClick.RemoveAllListeners();
        }

        if (navPreviewButton != null)
        {
            navPreviewButton.onClick.RemoveAllListeners();
        }

        RemoveButtonListeners(radarRangeMinusButton);
        RemoveButtonListeners(radarRangeAutoButton);
        RemoveButtonListeners(radarRangePlusButton);
    }

    private void ConfigureCombatControls(bool visible)
    {
        if (combatControlRow == null)
        {
            return;
        }

        combatControlRow.gameObject.SetActive(visible);
        if (!visible)
        {
            RemoveCombatButtonListeners();
            return;
        }

        bool hasComputer = weaponComputer != null;
        int targetCount = hasComputer ? weaponComputer.AvailableTargets.Count : 0;
        bool hasSelection = hasComputer && weaponComputer.SelectedTargetCount > 0;

        SetNavigationButtonState(combatPreviousButton, hasComputer && targetCount > 0, () =>
        {
            weaponComputer.SelectPreviousTarget();
            RefreshNow();
        });
        SetNavigationButtonState(combatNextButton, hasComputer && targetCount > 0, () =>
        {
            weaponComputer.SelectNextTarget();
            RefreshNow();
        });
        SetNavigationButtonState(combatClearButton, hasSelection, () =>
        {
            weaponComputer.ClearSelection();
            RefreshNow();
        });

        if (combatAutoFireButtonText != null)
        {
            combatAutoFireButtonText.text = !hasComputer ? "Auto n/a" : weaponComputer.AutoFireEnabled ? "Auto On" : "Auto Off";
        }

        SetNavigationButtonState(combatAutoFireButton, hasComputer, () =>
        {
            weaponComputer.SetAutoFireEnabled(!weaponComputer.AutoFireEnabled);
            weaponComputer.UpdateActiveTargetAndStatus();
            RefreshNow();
        });

        if (combatPriorityButtonText != null)
        {
            combatPriorityButtonText.text = !hasComputer ? "Prio n/a" : "Prio " + CompactPriorityLabel(weaponComputer.PriorityMode);
        }

        SetNavigationButtonState(combatPriorityButton, hasComputer, () =>
        {
            weaponComputer.CyclePriorityMode();
            RefreshNow();
        });
    }

    private void ConfigureCombatComputerPanel(PrototypePlayerHudSnapshot snapshot)
    {
        if (combatComputerPanelRect == null)
        {
            return;
        }

        if (!combatComputerPanelRect.gameObject.activeSelf)
        {
            RemoveCombatComputerButtonListeners();
            return;
        }

        if (combatComputerTitleText != null)
        {
            combatComputerTitleText.text = "Combat Computer";
        }

        if (combatComputerBodyText != null)
        {
            combatComputerBodyText.text = BuildCombatComputerBody(snapshot.Combat);
            combatComputerBodyText.color = ColorForSeverity(snapshot.Combat.FireSeverity);
        }

        bool hasComputer = weaponComputer != null;
        int targetCount = hasComputer ? weaponComputer.AvailableTargets.Count : 0;
        bool hasSelection = hasComputer && weaponComputer.SelectedTargetCount > 0;

        SetNavigationButtonState(combatComputerPreviousButton, hasComputer && targetCount > 0, () =>
        {
            weaponComputer.SelectPreviousTarget();
            RefreshNow();
        });
        SetNavigationButtonState(combatComputerNextButton, hasComputer && targetCount > 0, () =>
        {
            weaponComputer.SelectNextTarget();
            RefreshNow();
        });
        SetNavigationButtonState(combatComputerClearButton, hasSelection, () =>
        {
            weaponComputer.ClearSelection();
            RefreshNow();
        });

        if (combatComputerAutoFireButtonText != null)
        {
            combatComputerAutoFireButtonText.text = !hasComputer ? "Auto n/a" : weaponComputer.AutoFireEnabled ? "Auto On" : "Auto Off";
        }

        SetNavigationButtonState(combatComputerAutoFireButton, hasComputer, () =>
        {
            weaponComputer.SetAutoFireEnabled(!weaponComputer.AutoFireEnabled);
            weaponComputer.UpdateActiveTargetAndStatus();
            RefreshNow();
        });

        if (combatComputerPriorityButtonText != null)
        {
            combatComputerPriorityButtonText.text = !hasComputer ? "Prio n/a" : "Prio " + CompactPriorityLabel(weaponComputer.PriorityMode);
        }

        SetNavigationButtonState(combatComputerPriorityButton, hasComputer, () =>
        {
            weaponComputer.CyclePriorityMode();
            RefreshNow();
        });
        SetNavigationButtonState(combatComputerCloseButton, true, () => SetCombatComputerVisible(false));
    }

    private void RemoveCombatComputerButtonListeners()
    {
        RemoveButtonListeners(combatComputerPreviousButton);
        RemoveButtonListeners(combatComputerNextButton);
        RemoveButtonListeners(combatComputerClearButton);
        RemoveButtonListeners(combatComputerAutoFireButton);
        RemoveButtonListeners(combatComputerPriorityButton);
        RemoveButtonListeners(combatComputerCloseButton);
    }

    private static string BuildCombatComputerBody(PrototypePlayerCombatSnapshot combat)
    {
        if (!combat.Visible)
        {
            return "No weapon computer available";
        }

        return "Target " + combat.TargetName + " | Range " + FormatDistance(combat.RangeMeters) + "\n"
            + "Health " + combat.HealthLabel + "\n"
            + combat.FireStatusLabel + "\n"
            + combat.AutoFireLabel + "\n"
            + "Priority " + combat.PriorityLabel;
    }

    private void RemoveCombatButtonListeners()
    {
        if (combatPreviousButton != null)
        {
            combatPreviousButton.onClick.RemoveAllListeners();
        }

        if (combatNextButton != null)
        {
            combatNextButton.onClick.RemoveAllListeners();
        }

        if (combatClearButton != null)
        {
            combatClearButton.onClick.RemoveAllListeners();
        }

        if (combatAutoFireButton != null)
        {
            combatAutoFireButton.onClick.RemoveAllListeners();
        }

        if (combatPriorityButton != null)
        {
            combatPriorityButton.onClick.RemoveAllListeners();
        }
    }

    private static string CompactPriorityLabel(PrototypeWeaponTargetPriorityMode mode)
    {
        switch (mode)
        {
            case PrototypeWeaponTargetPriorityMode.Nearest:
                return "Near";
            case PrototypeWeaponTargetPriorityMode.HighestHealth:
                return "High HP";
            case PrototypeWeaponTargetPriorityMode.LowestHealth:
                return "Low HP";
            default:
                return "Manual";
        }
    }

    private static void SetNavigationButtonState(Button button, bool interactable, UnityEngine.Events.UnityAction action)
    {
        if (button == null)
        {
            return;
        }

        button.interactable = interactable;
        button.onClick.RemoveAllListeners();
        if (interactable && action != null)
        {
            button.onClick.AddListener(action);
        }
    }

    private static void RemoveButtonListeners(Button button)
    {
        if (button != null)
        {
            button.onClick.RemoveAllListeners();
        }
    }

    private void SetNavigationPlannerVisible(bool visible)
    {
        if (navigationPlannerPanelRect == null)
        {
            return;
        }

        navigationPlannerPanelRect.gameObject.SetActive(visible);
        if (visible)
        {
            SetCombatComputerVisible(false);
            if (helpPanel != null)
            {
                helpPanel.SetActive(false);
            }

            if (autopilot != null && autopilot.CurrentTarget != null)
            {
                autopilot.ReplanNow();
            }
        }

        RefreshNow();
    }

    private void SetCombatComputerVisible(bool visible)
    {
        if (combatComputerPanelRect == null)
        {
            return;
        }

        combatComputerPanelRect.gameObject.SetActive(visible);
        if (visible)
        {
            SetNavigationPlannerVisible(false);
            if (helpPanel != null)
            {
                helpPanel.SetActive(false);
            }

            if (weaponComputer != null)
            {
                weaponComputer.RefreshTargets();
                weaponComputer.UpdateActiveTargetAndStatus();
            }
        }

        RefreshNow();
    }

    private bool IsAnyPlayerHudModalVisible()
    {
        return (helpPanel != null && helpPanel.activeSelf)
            || (navigationPlannerPanelRect != null && navigationPlannerPanelRect.gameObject.activeSelf)
            || (combatComputerPanelRect != null && combatComputerPanelRect.gameObject.activeSelf);
    }

    public void ApplyResponsiveLayoutForTests(int width, int height)
    {
        ApplyResponsiveLayout(width, height, true);
    }

    public PrototypePlayerProjectedTargetIndicator[] ProjectTargetIndicatorsForTests(
        int width,
        int height,
        PrototypePlayerHudSnapshot snapshot)
    {
        return ProjectTargetIndicators(snapshot, GetComponent<Camera>(), new Vector2(Mathf.Max(1, width), Mathf.Max(1, height)));
    }

    public PrototypePlayerProjectedTargetIndicator[] LastProjectedTargetIndicators => projectedTargetIndicators;

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
        if (topStripRect == null
            || bottomBarRect == null
            || systemPanelRect == null
            || objectivePanelRect == null
            || contextPanelRect == null
            || radarPanelRect == null)
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
        float radarSize = narrow ? (shortScreen ? 128f : 168f) : 220f;
        float availableRadarHeight = safeHeight - margin - (sideBottom + contextHeight) - gap;
        if (availableRadarHeight < radarSize)
        {
            radarSize = Mathf.Clamp(availableRadarHeight, 112f, radarSize);
        }

        float sideAvailableWidth = safeWidth - (margin * 2f) - gap;
        float systemWidth = narrow ? 220f : 248f;
        float objectiveWidth = narrow ? 238f : 270f;
        float objectiveHeight = shortScreen ? 74f : 82f;
        float contextWidth = narrow ? 306f : 356f;
        if (systemWidth + contextWidth > sideAvailableWidth)
        {
            systemWidth = Mathf.Clamp(sideAvailableWidth * 0.42f, 156f, systemWidth);
            contextWidth = Mathf.Clamp(sideAvailableWidth - systemWidth - gap, 220f, contextWidth);
            objectiveWidth = Mathf.Clamp(systemWidth, 156f, objectiveWidth);
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
        ApplyRect(objectivePanelRect, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(objectiveWidth, objectiveHeight), new Vector2(margin, -(margin + 56f)));
        ApplyRect(contextPanelRect, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(contextWidth, contextHeight), new Vector2(-margin, sideBottom));
        ApplyRect(radarPanelRect, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(radarSize, radarSize), new Vector2(-margin, -margin));
        if (radarGraphic != null)
        {
            float radarGraphicSize = Mathf.Max(76f, radarSize - 16f);
            ApplyRect(radarGraphic.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(radarGraphicSize, radarGraphicSize), Vector2.zero);
            radarGraphic.SetAllDirty();
            ApplyRect(radarLayerRect, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(radarGraphicSize, radarGraphicSize), Vector2.zero);
        }

        if (radarText != null)
        {
            radarText.fontSize = shortScreen ? 9f : narrow ? 10f : 11f;
        }

        ApplyHelpPanelLayout(safeWidth, safeHeight, margin, gap, contextWidth, sideBottom, systemHeight, narrow, shortScreen);
        ApplyPlayerComputerPanelLayout(navigationPlannerPanelRect, navigationPlannerBodyText, safeWidth, safeHeight, margin, gap, bottomOffset, bottomHeight, narrow, shortScreen, 760f, 480f);
        ApplyNavigationPlannerMapLayout(safeWidth, safeHeight, narrow, shortScreen);
        ApplyPlayerComputerPanelLayout(combatComputerPanelRect, combatComputerBodyText, safeWidth, safeHeight, margin, gap, bottomOffset, bottomHeight, narrow, shortScreen);
        ApplyContextBodyLayout((navigationControlRow != null && navigationControlRow.gameObject.activeSelf) || (combatControlRow != null && combatControlRow.gameObject.activeSelf));
    }

    private void ApplyHelpPanelLayout(
        float safeWidth,
        float safeHeight,
        float margin,
        float gap,
        float contextWidth,
        float sideBottom,
        float systemHeight,
        bool narrow,
        bool shortScreen)
    {
        if (helpPanel == null)
        {
            return;
        }

        RectTransform helpRect = helpPanel.GetComponent<RectTransform>();
        if (helpRect == null)
        {
            return;
        }

        bool avoidRightContext = safeWidth < 1180f;
        float helpWidth = 620f;
        float helpHeight = shortScreen ? 320f : 390f;
        if (avoidRightContext)
        {
            float contextLeft = safeWidth - margin - contextWidth;
            float availableLeftWidth = Mathf.Max(280f, contextLeft - margin - gap);
            helpWidth = Mathf.Clamp(availableLeftWidth, 300f, 620f);
            helpHeight = Mathf.Clamp(safeHeight - (margin * 2f) - 300f, shortScreen ? 240f : 300f, 320f);
            float systemTop = sideBottom + systemHeight;
            float centerY = Mathf.Clamp(
                systemTop + gap + 96f + (helpHeight * 0.5f),
                margin + (helpHeight * 0.5f),
                safeHeight - margin - (helpHeight * 0.5f));
            ApplyRect(
                helpRect,
                new Vector2(0f, 0.5f),
                new Vector2(0f, 0.5f),
                new Vector2(0.5f, 0.5f),
                new Vector2(helpWidth, helpHeight),
                new Vector2(margin + (helpWidth * 0.5f), centerY - (safeHeight * 0.5f)));
        }
        else
        {
            ApplyRect(
                helpRect,
                new Vector2(0.5f, 0.5f),
                new Vector2(0.5f, 0.5f),
                new Vector2(0.5f, 0.5f),
                new Vector2(helpWidth, helpHeight),
                Vector2.zero);
        }

        if (helpText != null)
        {
            helpText.fontSize = narrow || avoidRightContext ? 11f : 12f;
        }
    }

    private void ApplyPlayerComputerPanelLayout(
        RectTransform panel,
        TMP_Text bodyText,
        float safeWidth,
        float safeHeight,
        float margin,
        float gap,
        float bottomOffset,
        float bottomHeight,
        bool narrow,
        bool shortScreen,
        float wideMaxWidth = 560f,
        float wideMaxHeight = 390f)
    {
        if (panel == null)
        {
            return;
        }

        float width = Mathf.Clamp(safeWidth - (margin * 2f), 320f, narrow ? 500f : wideMaxWidth);
        float availableHeight = safeHeight - (margin * 2f) - bottomOffset - bottomHeight - gap;
        float height = Mathf.Clamp(availableHeight, 220f, shortScreen ? 320f : wideMaxHeight);
        float bottomClearanceTop = bottomOffset + bottomHeight + gap;
        float centerY = Mathf.Clamp(
            bottomClearanceTop + (height * 0.5f),
            margin + (height * 0.5f),
            safeHeight - margin - (height * 0.5f));

        ApplyRect(
            panel,
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0.5f),
            new Vector2(width, height),
            new Vector2(0f, centerY));

        if (bodyText != null)
        {
            bodyText.fontSize = narrow || shortScreen ? 11f : 12f;
        }
    }

    private void ApplyNavigationPlannerMapLayout(float safeWidth, float safeHeight, bool narrow, bool shortScreen)
    {
        if (navigationPlannerPanelRect == null
            || navigationPlannerBodyText == null
            || navigationPlannerMapPanelRect == null
            || navigationPlannerMapLayerRect == null
            || navigationPlannerMapText == null)
        {
            return;
        }

        float panelWidth = navigationPlannerPanelRect.rect.width;
        float panelHeight = navigationPlannerPanelRect.rect.height;
        if (panelWidth <= 0f || panelHeight <= 0f)
        {
            return;
        }

        bool stacked = narrow || safeWidth < 860f || panelHeight < 270f;
        float buttonReserve = shortScreen ? 86f : 96f;
        float titleReserve = 62f;
        float contentHeight = Mathf.Max(96f, panelHeight - buttonReserve - titleReserve);

        if (stacked)
        {
            float mapSize = Mathf.Clamp(contentHeight * 0.56f, 130f, 160f);
            ApplyRect(
                navigationPlannerMapPanelRect,
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(mapSize + 18f, mapSize + 56f),
                new Vector2(-12f, -42f));
            ApplyRect(
                navigationPlannerBodyText.rectTransform,
                new Vector2(0f, 0f),
                new Vector2(1f, 1f),
                new Vector2(0.5f, 0.5f),
                new Vector2(-(mapSize + 54f), -(buttonReserve + titleReserve + 4f)),
                new Vector2(-((mapSize + 18f) * 0.5f), (buttonReserve * 0.5f) - 4f));
            ApplyRect(
                navigationPlannerMapLayerRect,
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(mapSize, mapSize),
                new Vector2(-21f, -46f));
            ApplyRect(
                navigationPlannerMapText.rectTransform,
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(1f, 1f),
                new Vector2(mapSize + 18f, 30f),
                new Vector2(-12f, -(mapSize + 62f)));
            navigationPlannerBodyText.fontSize = shortScreen ? 10f : 11f;
        }
        else
        {
            float mapSize = Mathf.Clamp(contentHeight + 16f, 280f, 352f);
            ApplyRect(
                navigationPlannerMapPanelRect,
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(mapSize + 20f, mapSize + 44f),
                new Vector2(-12f, 22f));
            ApplyRect(
                navigationPlannerBodyText.rectTransform,
                new Vector2(0f, 0f),
                new Vector2(1f, 1f),
                new Vector2(0.5f, 0.5f),
                new Vector2(-(mapSize + 60f), -(buttonReserve + titleReserve)),
                new Vector2(-((mapSize + 28f) * 0.5f), (buttonReserve * 0.5f) - 2f));
            ApplyRect(
                navigationPlannerMapLayerRect,
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(mapSize, mapSize),
                new Vector2(-22f, 40f));
            ApplyRect(
                navigationPlannerMapText.rectTransform,
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(1f, 0.5f),
                new Vector2(mapSize + 20f, 30f),
                new Vector2(-12f, 24f - (mapSize * 0.5f)));
        }

        if (navigationPlannerMapText != null)
        {
            navigationPlannerMapText.fontSize = MinimumPlayerHudFontSize;
        }

        for (int i = 0; i < navigationPlannerMapGridSegments.Count; i++)
        {
            navigationPlannerMapGridSegments[i].SetAllDirty();
        }

        ApplyNavigationPlannerMapRangeButtonLayout();
    }

    private void ApplyNavigationPlannerMapRangeButtonLayout()
    {
        if (navPlannerRangeMinusButton == null
            || navPlannerRangeAutoButton == null
            || navPlannerRangePlusButton == null)
        {
            return;
        }

        const float buttonSize = 22f;
        const float buttonY = 4f;
        ApplyRect(
            navPlannerRangeMinusButton.GetComponent<RectTransform>(),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(buttonSize, buttonSize),
            new Vector2(-44f, buttonY));
        ApplyRect(
            navPlannerRangeAutoButton.GetComponent<RectTransform>(),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(buttonSize, buttonSize),
            new Vector2(-14f, buttonY));
        ApplyRect(
            navPlannerRangePlusButton.GetComponent<RectTransform>(),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(0.5f, 0f),
            new Vector2(buttonSize, buttonSize),
            new Vector2(16f, buttonY));

        navPlannerRangeMinusButton.transform.SetAsLastSibling();
        navPlannerRangeAutoButton.transform.SetAsLastSibling();
        navPlannerRangePlusButton.transform.SetAsLastSibling();
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
            assistTexts[i].fontSize = chipWidth < 118f ? MinimumPlayerHudFontSize : 11;
        }
    }

    private void ApplyBottomBarChildLayout(float bottomWidth, bool narrow)
    {
        bool compact = narrow || bottomWidth < 700f;
        compactBottomBarLayout = compact;
        RectTransform throttleBar = throttleFill != null ? throttleFill.transform.parent as RectTransform : null;
        RectTransform fuelBar = fuelFill != null ? fuelFill.transform.parent as RectTransform : null;
        RectTransform buttonRect = killMomentumButton != null ? killMomentumButton.GetComponent<RectTransform>() : null;

        if (compact)
        {
            speedText.fontSize = 16;
            throttleText.fontSize = 10;
            fuelText.fontSize = 10;
            modeText.fontSize = 12;
            modeHintText.fontSize = MinimumPlayerHudFontSize;
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
            ApplyKillMomentumButtonLabel();
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
        ApplyKillMomentumButtonLabel();
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

    private void ApplyObjectivePanel(PrototypePveArenaSnapshot arena)
    {
        if (objectivePanelRect == null || objectiveTitleText == null || objectiveBodyText == null)
        {
            return;
        }

        objectivePanelRect.gameObject.SetActive(arena.IsVisible);
        if (!arena.IsVisible)
        {
            return;
        }

        objectiveTitleText.text = arena.ObjectiveName;
        objectiveBodyText.text = "Targets " + arena.ProgressLabel + " | " + arena.StatusLabel;
        if (arena.Completed)
        {
            objectiveBodyText.text += "\nReward: " + BuildArenaRewardLabel(arena.RewardStubLabel);
        }
        objectiveBodyText.color = arena.Completed ? PrototypeUiStyle.ActiveColor : PrototypeUiStyle.MutedColor;
    }

    private static string BuildArenaRewardLabel(string rewardStubLabel)
    {
        if (string.IsNullOrWhiteSpace(rewardStubLabel))
        {
            return "Reward pending";
        }

        return rewardStubLabel;
    }

    private void ApplyContext(PrototypePlayerHudSnapshot snapshot)
    {
        ConfigureNavigationControls(false);
        ConfigureCombatControls(false);
        ApplyContextBodyLayout(false);

        if (ApplyCriticalContext(snapshot))
        {
            return;
        }

        bool combatActive = IsActiveCombatContext(snapshot.Combat);
        if (combatActive)
        {
            ApplyCombatContext(snapshot.Combat);
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

        if (snapshot.Navigation.Visible)
        {
            ApplyContextBodyLayout(true);
            ConfigureNavigationControls(true);
            contextTitleText.text = "Navigation: " + snapshot.Navigation.TargetName;
            contextBodyText.text =
                snapshot.Navigation.TargetTypeLabel + " | " + snapshot.Navigation.TargetListLabel + " | Dist " + FormatDistance(snapshot.Navigation.DistanceMeters) + " | ETA " + snapshot.Navigation.EtaLabel + "\n"
                + "Closing " + snapshot.Navigation.ClosingSpeed.ToString("0.0") + " m/s | Lateral " + snapshot.Navigation.LateralSpeed.ToString("0.0") + " m/s\n"
                + snapshot.Navigation.ManeuverIntentLabel + "\n"
                + "Stop " + FormatDistance(snapshot.Navigation.StoppingDistanceMeters) + " | " + snapshot.Navigation.RouteModeLabel + "\n"
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

        if (snapshot.Arena.IsVisible)
        {
            contextTitleText.text = "Objective: " + snapshot.Arena.ObjectiveName;
            contextBodyText.text =
                snapshot.Arena.StatusLabel + " | Targets " + snapshot.Arena.ProgressLabel
                + (snapshot.Arena.Completed ? string.Empty : "\nComplete the marked targets");
            contextBodyText.color = snapshot.Arena.Completed ? PrototypeUiStyle.ActiveColor : PrototypeUiStyle.MutedColor;
            SetContextGauge(0, "Objective", snapshot.Arena.ProgressFraction, PrototypeUiStyle.ActiveColor, true);
            SetContextGauge(1, string.Empty, 0f, Color.white, false);
            SetContextGauge(2, string.Empty, 0f, Color.white, false);
            return;
        }

        if (snapshot.Combat.Visible)
        {
            ApplyCombatContext(snapshot.Combat);
            return;
        }

        contextTitleText.text = "Navigation";
        contextBodyText.text = "Kein Navigationsziel";
        contextBodyText.color = PrototypeUiStyle.MutedColor;
        HideContextGauges();
    }

    private static bool IsActiveCombatContext(PrototypePlayerCombatSnapshot combat)
    {
        if (!combat.Visible)
        {
            return false;
        }

        return !string.Equals(combat.TargetName, "No target", System.StringComparison.Ordinal)
            || !string.Equals(combat.AutoFireLabel, "Auto Fire: Off", System.StringComparison.Ordinal);
    }

    private void ApplyCombatContext(PrototypePlayerCombatSnapshot combat)
    {
        ApplyContextBodyLayout(true);
        ConfigureCombatControls(true);
        contextTitleText.text = "Combat: " + combat.TargetName;
        contextBodyText.text =
            "Health " + combat.HealthLabel + " | Range " + FormatDistance(combat.RangeMeters) + "\n"
            + combat.FireStatusLabel + "\n"
            + combat.AutoFireLabel + "\n"
            + "Priority " + combat.PriorityLabel;
        contextBodyText.color = ColorForSeverity(combat.FireSeverity);
        SetContextGauge(0, "Integrity", combat.HealthPercent, ColorForSeverity(combat.FireSeverity), true);
        SetContextGauge(1, string.Empty, 0f, Color.white, false);
        SetContextGauge(2, string.Empty, 0f, Color.white, false);
    }

    private void ApplyContextBodyLayout(bool navigationControlsVisible)
    {
        if (contextBodyText == null)
        {
            return;
        }

        if (navigationControlsVisible)
        {
            float contextHeight = contextPanelRect != null ? Mathf.Max(120f, contextPanelRect.rect.height) : 194f;
            float gaugeHeight = contextHeight < 180f ? 42f : 50f;
            float gaugeBottom = 10f;
            float rowBottom = gaugeBottom + gaugeHeight + 4f;
            float bodyBottom = rowBottom + 28f;
            float bodyHeight = Mathf.Clamp(contextHeight - bodyBottom - 42f, 28f, 60f);

            ApplyRect(contextGaugePanelRect, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, gaugeHeight), new Vector2(0f, gaugeBottom));
            ApplyRect(navigationControlRow, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, rowBottom));
            ApplyRect(combatControlRow, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, rowBottom));
            ApplyRect(contextBodyText.rectTransform, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, bodyHeight), new Vector2(0f, bodyBottom));
            return;
        }

        ApplyRect(contextGaugePanelRect, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 58f), new Vector2(0f, 12f));
        ApplyRect(navigationControlRow, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, 72f));
        ApplyRect(combatControlRow, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-22f, 24f), new Vector2(0f, 72f));
        ApplyRect(contextBodyText.rectTransform, new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-22f, -112f), new Vector2(0f, 6f));
    }

    private bool ApplyCriticalContext(PrototypePlayerHudSnapshot snapshot)
    {
        for (int i = 0; i < snapshot.Warnings.Length; i++)
        {
            if (snapshot.Warnings[i].Severity == PrototypePlayerHudSeverity.Danger)
            {
                contextTitleText.text = "Critical";
                contextBodyText.text = snapshot.Warnings[i].Label;
                contextBodyText.color = PrototypeUiStyle.DangerColor;
                HideContextGauges();
                return true;
            }
        }

        return false;
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

    private void SetMarkerLabel(TMP_Text label, Vector2 markerOffset, bool visible, Color color)
    {
        label.gameObject.SetActive(visible);
        label.color = color;
        RectTransform rect = label.rectTransform;
        Vector2 clamped = Vector2.ClampMagnitude(markerOffset, MarkerRadius);
        rect.anchoredPosition = new Vector2(clamped.x, clamped.y - 86f);
    }

    private Vector2 GetCanvasSize()
    {
        RectTransform canvasRect = canvas != null ? canvas.GetComponent<RectTransform>() : null;
        if (canvasRect != null && canvasRect.rect.width > 1f && canvasRect.rect.height > 1f)
        {
            return canvasRect.rect.size;
        }

        return new Vector2(CanvasReferenceWidth, CanvasReferenceHeight);
    }

    private static PrototypePlayerProjectedTargetIndicator[] ProjectTargetIndicators(
        PrototypePlayerHudSnapshot snapshot,
        Camera projectionCamera,
        Vector2 canvasSize)
    {
        PrototypePlayerTargetIndicator[] indicators = snapshot.TargetIndicators.Indicators;
        if (projectionCamera == null || indicators == null || indicators.Length == 0)
        {
            return System.Array.Empty<PrototypePlayerProjectedTargetIndicator>();
        }

        Vector2 size = new Vector2(Mathf.Max(1f, canvasSize.x), Mathf.Max(1f, canvasSize.y));
        Rect markerSafeRect = BuildTargetIndicatorSafeRect(size);
        Rect labelSafeRect = BuildTargetIndicatorLabelSafeRect(markerSafeRect);
        var projected = new PrototypePlayerProjectedTargetIndicator[indicators.Length];
        for (int i = 0; i < indicators.Length; i++)
        {
            PrototypePlayerTargetIndicator indicator = indicators[i];
            Vector3 viewport = projectionCamera.WorldToViewportPoint(indicator.WorldPosition);
            bool behindCamera = viewport.z <= 0f;
            Vector2 viewportPoint = new Vector2(viewport.x, viewport.y);
            if (behindCamera)
            {
                viewportPoint = new Vector2(1f - viewportPoint.x, 1f - viewportPoint.y);
            }

            Vector2 rawCanvas = new Vector2(
                (viewportPoint.x - 0.5f) * size.x,
                (viewportPoint.y - 0.5f) * size.y);
            Vector2 clampedCanvas = ClampToRect(rawCanvas, markerSafeRect);
            bool outsideViewport = viewportPoint.x < 0f || viewportPoint.x > 1f || viewportPoint.y < 0f || viewportPoint.y > 1f;
            bool clampedBySafeArea = (clampedCanvas - rawCanvas).sqrMagnitude > 0.01f;
            bool offscreen = behindCamera || outsideViewport || clampedBySafeArea;
            Vector2 labelPosition = clampedCanvas + new Vector2(0f, offscreen ? -28f : 20f);
            bool labelVisible = indicator.ShowLabel
                && size.x >= 720f
                && size.y >= 520f
                && labelSafeRect.Contains(labelPosition);

            projected[i] = new PrototypePlayerProjectedTargetIndicator(indicator, clampedCanvas, offscreen, labelVisible);
        }

        return projected;
    }

    private static Rect BuildTargetIndicatorSafeRect(Vector2 canvasSize)
    {
        float width = Mathf.Max(1f, canvasSize.x);
        float height = Mathf.Max(1f, canvasSize.y);
        bool narrow = width < 980f;
        bool shortScreen = height < 620f;
        float margin = narrow ? 16f : 24f;
        float gap = narrow ? 12f : 16f;
        float leftReserve = narrow ? margin + 76f : margin + 270f + gap;
        float rightReserve = narrow ? margin + 96f : margin + 356f + gap;
        float topReserve = margin + (shortScreen ? 96f : 112f);
        float bottomReserve = margin + (shortScreen ? 104f : 128f);
        Rect safe = new Rect(
            (-width * 0.5f) + leftReserve,
            (-height * 0.5f) + bottomReserve,
            width - leftReserve - rightReserve,
            height - topReserve - bottomReserve);

        float minimumWidth = Mathf.Min(width - (margin * 2f), 220f);
        if (safe.width < minimumWidth)
        {
            safe.x = -minimumWidth * 0.5f;
            safe.width = minimumWidth;
        }

        float minimumHeight = Mathf.Min(height - (margin * 2f), 160f);
        if (safe.height < minimumHeight)
        {
            safe.y = -minimumHeight * 0.5f;
            safe.height = minimumHeight;
        }

        return safe;
    }

    private static Rect BuildTargetIndicatorLabelSafeRect(Rect markerSafeRect)
    {
        const float labelHalfWidth = 76f;
        const float labelHeight = 42f;
        if (markerSafeRect.width <= labelHalfWidth * 2f || markerSafeRect.height <= labelHeight * 2f)
        {
            return new Rect(markerSafeRect.center, Vector2.zero);
        }

        return new Rect(
            markerSafeRect.xMin + labelHalfWidth,
            markerSafeRect.yMin + labelHeight,
            markerSafeRect.width - (labelHalfWidth * 2f),
            markerSafeRect.height - (labelHeight * 2f));
    }

    private static Vector2 ClampToRect(Vector2 value, Rect rect)
    {
        return new Vector2(
            Mathf.Clamp(value.x, rect.xMin, rect.xMax),
            Mathf.Clamp(value.y, rect.yMin, rect.yMax));
    }

    private void UpdateTargetIndicatorLabels(PrototypePlayerProjectedTargetIndicator[] projectedIndicators)
    {
        for (int i = 0; i < targetIndicatorLabels.Count; i++)
        {
            targetIndicatorLabels[i].gameObject.SetActive(false);
        }

        if (projectedIndicators == null)
        {
            return;
        }

        var occupiedLabelRects = new List<Rect>(targetIndicatorLabels.Count);
        for (int i = 0; i < projectedIndicators.Length && i < targetIndicatorLabels.Count; i++)
        {
            PrototypePlayerProjectedTargetIndicator projected = projectedIndicators[i];
            if (!projected.LabelVisible)
            {
                continue;
            }

            Vector2 size = new Vector2(projected.Indicator.Kind == PrototypePlayerTargetIndicatorKind.Combat ? 170f : 150f, 34f);
            Vector2 position = projected.CanvasPosition + new Vector2(0f, projected.Offscreen ? -28f : 20f);
            Rect labelRect = new Rect(position.x - (size.x * 0.5f), position.y - 2f, size.x, size.y);
            if (OverlapsAny(labelRect, occupiedLabelRects))
            {
                continue;
            }

            TMP_Text label = targetIndicatorLabels[i];
            label.gameObject.SetActive(true);
            label.text = BuildTargetIndicatorLabel(projected.Indicator);
            label.color = ColorForTargetIndicator(projected.Indicator);
            label.fontSize = MinimumPlayerHudFontSize;
            RectTransform rect = label.rectTransform;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            occupiedLabelRects.Add(labelRect);
        }
    }

    private static bool OverlapsAny(Rect candidate, List<Rect> occupied)
    {
        for (int i = 0; i < occupied.Count; i++)
        {
            if (candidate.Overlaps(occupied[i]))
            {
                return true;
            }
        }

        return false;
    }

    private static string BuildTargetIndicatorLabel(PrototypePlayerTargetIndicator indicator)
    {
        string distance = FormatDistance(indicator.DistanceMeters);
        if (indicator.Kind == PrototypePlayerTargetIndicatorKind.Combat && indicator.HealthFraction > 0f)
        {
            return indicator.Label + "\n" + distance + " | " + (indicator.HealthFraction * 100f).ToString("0") + "% | " + indicator.StatusLabel;
        }

        if (!string.IsNullOrWhiteSpace(indicator.StatusLabel))
        {
            return indicator.Label + "\n" + distance + " | " + indicator.StatusLabel;
        }

        return indicator.Label + "\n" + distance;
    }

    private static Color ColorForTargetIndicator(PrototypePlayerTargetIndicator indicator)
    {
        switch (indicator.Kind)
        {
            case PrototypePlayerTargetIndicatorKind.Combat:
                return ColorForSeverity(indicator.Severity);
            case PrototypePlayerTargetIndicatorKind.Docking:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerTargetIndicatorKind.Objective:
                return PrototypeUiStyle.WarningColor;
            default:
                return PrototypeModuleColorPalette.Target;
        }
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
        image.color = new Color(0.022f, 0.027f, 0.039f, 1f);
        return rect;
    }

    private static TMP_Text CreateText(string name, Transform parent, int fontSize, TextAnchor alignment, Color color, RectPreset preset)
    {
        TMP_Text text = CreateGraphic<TextMeshProUGUI>(name, parent, preset);
        TMP_FontAsset fontAsset = ResolveRuntimeFontAsset();
        if (fontAsset != null)
        {
            text.font = fontAsset;
        }

        text.fontSize = Mathf.Max(MinimumPlayerHudFontSize, fontSize);
        text.alignment = ToTextAlignmentOptions(alignment);
        text.color = color;
        text.fontStyle = FontStyles.Normal;
        text.enableAutoSizing = true;
        text.fontSizeMin = MinimumPlayerHudFontSize;
        text.fontSizeMax = Mathf.Max(MinimumPlayerHudFontSize, fontSize);
        text.textWrappingMode = TextWrappingModes.Normal;
        text.overflowMode = TextOverflowModes.Truncate;
        text.margin = Vector4.zero;
        text.raycastTarget = false;
        return text;
    }

    private static TMP_FontAsset ResolveRuntimeFontAsset()
    {
        if (runtimeFontAsset != null)
        {
            return runtimeFontAsset;
        }

        runtimeFontAsset = Resources.Load<TMP_FontAsset>("Fonts & Materials/LiberationSans SDF");
        if (runtimeFontAsset == null)
        {
            TMP_Settings settings = TMP_Settings.instance;
            if (settings != null)
            {
                runtimeFontAsset = TMP_Settings.defaultFontAsset;
            }
        }

        return runtimeFontAsset;
    }

    private static TextAlignmentOptions ToTextAlignmentOptions(TextAnchor alignment)
    {
        switch (alignment)
        {
            case TextAnchor.UpperLeft:
                return TextAlignmentOptions.TopLeft;
            case TextAnchor.UpperCenter:
                return TextAlignmentOptions.Top;
            case TextAnchor.UpperRight:
                return TextAlignmentOptions.TopRight;
            case TextAnchor.MiddleLeft:
                return TextAlignmentOptions.Left;
            case TextAnchor.MiddleCenter:
                return TextAlignmentOptions.Center;
            case TextAnchor.MiddleRight:
                return TextAlignmentOptions.Right;
            case TextAnchor.LowerLeft:
                return TextAlignmentOptions.BottomLeft;
            case TextAnchor.LowerCenter:
                return TextAlignmentOptions.Bottom;
            case TextAnchor.LowerRight:
                return TextAlignmentOptions.BottomRight;
            default:
                return TextAlignmentOptions.TopLeft;
        }
    }

    private static T CreateGraphic<T>(string name, Transform parent, RectPreset preset) where T : Graphic
    {
        RectTransform rect = CreateRect(name, parent, preset);
        return rect.gameObject.AddComponent<T>();
    }

    private static Image CreateRadarVisual(string name, Transform parent, Vector2 size, Color color)
    {
        Image image = CreateGraphic<Image>(
            name,
            parent,
            new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), size, Vector2.zero));
        image.color = color;
        image.raycastTarget = false;
        image.gameObject.SetActive(false);
        return image;
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

        if (visible)
        {
            hasCachedHelpText = false;
        }

        ApplyModalVisibility(IsAnyPlayerHudModalVisible());
    }

    private void ApplyModalVisibility(bool modalVisible)
    {
        SetGameObjectActive(systemPanelRect, !modalVisible);
        SetGameObjectActive(objectivePanelRect, !modalVisible);
        SetGameObjectActive(contextPanelRect, !modalVisible);
        SetGameObjectActive(radarPanelRect, !modalVisible);
        SetGameObjectActive(overlayGraphic != null ? overlayGraphic.rectTransform : null, !modalVisible);
        for (int i = 0; i < targetIndicatorLabels.Count; i++)
        {
            if (targetIndicatorLabels[i] != null && modalVisible)
            {
                targetIndicatorLabels[i].gameObject.SetActive(false);
            }
        }
    }

    private static void SetGameObjectActive(Component component, bool active)
    {
        if (component != null && component.gameObject.activeSelf != active)
        {
            component.gameObject.SetActive(active);
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

    private static string FormatBurnSeconds(float seconds)
    {
        if (float.IsInfinity(seconds))
        {
            return "unlimited";
        }

        if (float.IsNaN(seconds) || seconds <= 0f)
        {
            return "--";
        }

        return seconds.ToString("0.0") + "s";
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
    private PrototypePlayerProjectedTargetIndicator[] projectedTargetIndicators = System.Array.Empty<PrototypePlayerProjectedTargetIndicator>();

    public void SetSnapshot(PrototypePlayerHudSnapshot value)
    {
        snapshot = value;
        SetVerticesDirty();
    }

    public void SetProjectedTargetIndicators(PrototypePlayerProjectedTargetIndicator[] value)
    {
        projectedTargetIndicators = value ?? System.Array.Empty<PrototypePlayerProjectedTargetIndicator>();
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
        DrawTargetIndicators(vh, projectedTargetIndicators);

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

    private static void DrawTargetIndicators(VertexHelper vh, PrototypePlayerProjectedTargetIndicator[] projectedIndicators)
    {
        if (projectedIndicators == null)
        {
            return;
        }

        for (int i = 0; i < projectedIndicators.Length; i++)
        {
            PrototypePlayerProjectedTargetIndicator projected = projectedIndicators[i];
            Color color = ColorForTargetIndicator(projected.Indicator);
            if (projected.Offscreen)
            {
                DrawOffscreenArrow(vh, projected.CanvasPosition, color);
                continue;
            }

            switch (projected.Indicator.Kind)
            {
                case PrototypePlayerTargetIndicatorKind.Combat:
                    DrawCombatBracket(vh, projected.CanvasPosition, color);
                    DrawHealthTick(vh, projected.CanvasPosition, projected.Indicator.HealthFraction, color);
                    break;
                case PrototypePlayerTargetIndicatorKind.Docking:
                    DrawDockingIndicator(vh, projected.CanvasPosition, color);
                    break;
                case PrototypePlayerTargetIndicatorKind.Objective:
                    DrawDiamond(vh, projected.CanvasPosition, color, 12f, 1.6f);
                    break;
                default:
                    DrawDiamond(vh, projected.CanvasPosition, color, projected.Indicator.Selected ? 15f : 11f, projected.Indicator.Selected ? 1.9f : 1.4f);
                    break;
            }
        }
    }

    private static void DrawOffscreenArrow(VertexHelper vh, Vector2 position, Color color)
    {
        Vector2 direction = position.sqrMagnitude > 0.001f ? position.normalized : Vector2.up;
        Vector2 tangent = new Vector2(-direction.y, direction.x);
        Vector2 tip = position;
        Vector2 baseCenter = position - direction * 18f;
        DrawLine(vh, tip, baseCenter + tangent * 8f, color, 2f);
        DrawLine(vh, tip, baseCenter - tangent * 8f, color, 2f);
        DrawLine(vh, baseCenter + tangent * 8f, baseCenter - tangent * 8f, color, 1.4f);
    }

    private static void DrawDiamond(VertexHelper vh, Vector2 center, Color color, float size, float thickness)
    {
        DrawLine(vh, center + Vector2.up * size, center + Vector2.right * size, color, thickness);
        DrawLine(vh, center + Vector2.right * size, center + Vector2.down * size, color, thickness);
        DrawLine(vh, center + Vector2.down * size, center + Vector2.left * size, color, thickness);
        DrawLine(vh, center + Vector2.left * size, center + Vector2.up * size, color, thickness);
    }

    private static void DrawDockingIndicator(VertexHelper vh, Vector2 center, Color color)
    {
        DrawCircle(vh, center, 18f, color, 1.5f, 32);
        DrawLine(vh, center + Vector2.left * 24f, center + Vector2.left * 10f, color, 1.7f);
        DrawLine(vh, center + Vector2.right * 10f, center + Vector2.right * 24f, color, 1.7f);
        DrawLine(vh, center + Vector2.up * 10f, center + Vector2.up * 24f, color, 1.7f);
        DrawLine(vh, center + Vector2.down * 24f, center + Vector2.down * 10f, color, 1.7f);
    }

    private static void DrawHealthTick(VertexHelper vh, Vector2 center, float healthFraction, Color color)
    {
        if (healthFraction <= 0f)
        {
            return;
        }

        Vector2 start = center + new Vector2(-24f, -34f);
        Vector2 end = start + Vector2.right * (48f * Mathf.Clamp01(healthFraction));
        DrawLine(vh, start, start + Vector2.right * 48f, new Color(color.r, color.g, color.b, 0.28f), 2f);
        DrawLine(vh, start, end, color, 2f);
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

    private static Color ColorForTargetIndicator(PrototypePlayerTargetIndicator indicator)
    {
        switch (indicator.Kind)
        {
            case PrototypePlayerTargetIndicatorKind.Combat:
                return ColorForSeverity(indicator.Severity);
            case PrototypePlayerTargetIndicatorKind.Docking:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerTargetIndicatorKind.Objective:
                return PrototypeUiStyle.WarningColor;
            default:
                return PrototypeModuleColorPalette.Target;
        }
    }
}

public sealed class PrototypePlayerHudRadarGraphic : MaskableGraphic
{
    private static readonly PrototypePlayerRadarBlip[] EmptyBlips = System.Array.Empty<PrototypePlayerRadarBlip>();
    private static readonly Vector3[] EmptyRoute = System.Array.Empty<Vector3>();
    private PrototypePlayerHudSnapshot snapshot;

    public void SetSnapshot(PrototypePlayerHudSnapshot value)
    {
        snapshot = value;
        color = Color.white;
        SetAllDirty();
    }

    protected override void OnPopulateMesh(VertexHelper vh)
    {
        vh.Clear();
        Rect rect = rectTransform.rect;
        Vector2 center = rect.center;
        float radius = Mathf.Min(rect.width, rect.height) * 0.42f;
        Color ringColor = new Color(0.25f, 0.85f, 1f, 0.95f);

        DrawCircle(vh, center, radius, ringColor, 2.2f, 48);
        DrawCircle(vh, center, radius * 0.5f, ringColor, 1.6f, 48);
        DrawLine(vh, center + Vector2.left * radius, center + Vector2.right * radius, ringColor, 1.5f);
        DrawLine(vh, center + Vector2.up * radius, center + Vector2.down * radius, ringColor, 1.5f);

        Vector2 heading = new Vector2(snapshot.ShipForward.x, snapshot.ShipForward.z);
        if (heading.sqrMagnitude <= 0.001f)
        {
            heading = Vector2.up;
        }

        heading.Normalize();
        Vector2 right = new Vector2(heading.y, -heading.x);
        DrawLine(vh, center + heading * 16f, center - heading * 11f - right * 8f, Color.white, 1.9f);
        DrawLine(vh, center - heading * 11f - right * 8f, center - heading * 11f + right * 8f, Color.white, 1.9f);
        DrawLine(vh, center - heading * 11f + right * 8f, center + heading * 16f, Color.white, 1.9f);

        Vector3[] routePoints = snapshot.Radar.RouteWorldPoints ?? EmptyRoute;
        Vector3[] previewPoints = snapshot.Radar.TrajectoryPreviewWorldPoints ?? EmptyRoute;
        DrawRadarPath(vh, center, radius, snapshot.Radar, routePoints, PrototypeModuleColorPalette.Target, 2.2f, false);
        DrawRadarPath(vh, center, radius, snapshot.Radar, previewPoints, new Color(1f, 0.72f, 0.22f, 0.82f), 2f, true);

        if (snapshot.Radar.HasAvoidanceWaypoint)
        {
            Vector2 avoidance = ClampRadarPoint(center, radius, snapshot.Radar, snapshot.Radar.AvoidanceWorldPosition);
            DrawHazardBlip(vh, avoidance, PrototypeUiStyle.WarningColor, 7f);
        }

        PrototypePlayerRadarBlip[] blips = snapshot.Radar.Blips ?? EmptyBlips;
        for (int i = 0; i < blips.Length; i++)
        {
            PrototypePlayerRadarBlip blip = blips[i];
            Vector2 point = ClampRadarPoint(center, radius, snapshot.Radar, blip.WorldPosition);
            if (blip.Kind == PrototypePlayerRadarBlipKind.SelectedNavigation)
            {
                DrawLine(vh, center, point, ColorForRadarBlip(blip.Kind), 2f);
            }

            DrawRadarBlip(vh, point, blip);
        }
    }

    private static void DrawBlip(VertexHelper vh, Vector2 point, Color color)
    {
        DrawLine(vh, point + Vector2.left * 5f, point + Vector2.right * 5f, color, 2.4f);
        DrawLine(vh, point + Vector2.up * 5f, point + Vector2.down * 5f, color, 2.4f);
    }

    private static void DrawRadarPath(
        VertexHelper vh,
        Vector2 center,
        float radius,
        PrototypePlayerRadarSnapshot radar,
        Vector3[] worldPoints,
        Color color,
        float thickness,
        bool dashed)
    {
        if (worldPoints == null || worldPoints.Length <= 1)
        {
            return;
        }

        Vector2 previous = ClampRadarPoint(center, radius, radar, worldPoints[0]);
        for (int i = 1; i < worldPoints.Length; i++)
        {
            Vector2 next = ClampRadarPoint(center, radius, radar, worldPoints[i]);
            if (!dashed || (i % 2) == 1)
            {
                DrawLine(vh, previous, next, color, thickness);
            }

            previous = next;
        }
    }

    private static void DrawRadarBlip(VertexHelper vh, Vector2 point, PrototypePlayerRadarBlip blip)
    {
        Color color = ColorForRadarBlip(blip.Kind);
        switch (blip.Kind)
        {
            case PrototypePlayerRadarBlipKind.SelectedNavigation:
                DrawDiamondBlip(vh, point, color, 10f, 2.7f);
                DrawBlip(vh, point, color);
                break;
            case PrototypePlayerRadarBlipKind.Navigation:
                DrawDiamondBlip(vh, point, color, 7f, 1.8f);
                break;
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                DrawCombatBlip(vh, point, color, 11f);
                break;
            case PrototypePlayerRadarBlipKind.Combat:
                DrawBlip(vh, point, color);
                break;
            case PrototypePlayerRadarBlipKind.Objective:
                DrawDiamondBlip(vh, point, color, 9f, 2.3f);
                break;
            case PrototypePlayerRadarBlipKind.Docking:
                DrawSquareBlip(vh, point, color, 9f);
                break;
            case PrototypePlayerRadarBlipKind.Hazard:
                DrawHazardBlip(vh, point, color, 8f);
                break;
            default:
                DrawBlip(vh, point, color);
                break;
        }
    }

    private static void DrawDiamondBlip(VertexHelper vh, Vector2 point, Color color, float size, float thickness)
    {
        DrawLine(vh, point + Vector2.up * size, point + Vector2.right * size, color, thickness);
        DrawLine(vh, point + Vector2.right * size, point + Vector2.down * size, color, thickness);
        DrawLine(vh, point + Vector2.down * size, point + Vector2.left * size, color, thickness);
        DrawLine(vh, point + Vector2.left * size, point + Vector2.up * size, color, thickness);
    }

    private static void DrawSquareBlip(VertexHelper vh, Vector2 point, Color color, float size)
    {
        Vector2 topLeft = point + new Vector2(-size, size);
        Vector2 topRight = point + new Vector2(size, size);
        Vector2 bottomRight = point + new Vector2(size, -size);
        Vector2 bottomLeft = point + new Vector2(-size, -size);
        DrawLine(vh, topLeft, topRight, color, 1.5f);
        DrawLine(vh, topRight, bottomRight, color, 1.5f);
        DrawLine(vh, bottomRight, bottomLeft, color, 1.5f);
        DrawLine(vh, bottomLeft, topLeft, color, 1.5f);
    }

    private static void DrawCombatBlip(VertexHelper vh, Vector2 point, Color color, float size)
    {
        DrawLine(vh, point + new Vector2(-size, -size), point + new Vector2(-size * 0.35f, -size), color, 1.8f);
        DrawLine(vh, point + new Vector2(-size, -size), point + new Vector2(-size, -size * 0.35f), color, 1.8f);
        DrawLine(vh, point + new Vector2(size, -size), point + new Vector2(size * 0.35f, -size), color, 1.8f);
        DrawLine(vh, point + new Vector2(size, -size), point + new Vector2(size, -size * 0.35f), color, 1.8f);
        DrawLine(vh, point + new Vector2(-size, size), point + new Vector2(-size * 0.35f, size), color, 1.8f);
        DrawLine(vh, point + new Vector2(-size, size), point + new Vector2(-size, size * 0.35f), color, 1.8f);
        DrawLine(vh, point + new Vector2(size, size), point + new Vector2(size * 0.35f, size), color, 1.8f);
        DrawLine(vh, point + new Vector2(size, size), point + new Vector2(size, size * 0.35f), color, 1.8f);
    }

    private static void DrawHazardBlip(VertexHelper vh, Vector2 point, Color color, float size)
    {
        DrawLine(vh, point + Vector2.up * size, point + new Vector2(size, -size), color, 1.6f);
        DrawLine(vh, point + new Vector2(size, -size), point + new Vector2(-size, -size), color, 1.6f);
        DrawLine(vh, point + new Vector2(-size, -size), point + Vector2.up * size, color, 1.6f);
    }

    private static Color ColorForRadarBlip(PrototypePlayerRadarBlipKind kind)
    {
        switch (kind)
        {
            case PrototypePlayerRadarBlipKind.Combat:
            case PrototypePlayerRadarBlipKind.SelectedCombat:
                return PrototypeModuleColorPalette.Gun;
            case PrototypePlayerRadarBlipKind.Objective:
                return PrototypeUiStyle.WarningColor;
            case PrototypePlayerRadarBlipKind.Docking:
                return PrototypeUiStyle.ActiveColor;
            case PrototypePlayerRadarBlipKind.Beacon:
                return new Color(0.95f, 0.55f, 1f, 0.95f);
            case PrototypePlayerRadarBlipKind.Gate:
                return new Color(0.4f, 1f, 0.7f, 0.95f);
            case PrototypePlayerRadarBlipKind.Station:
                return new Color(0.66f, 0.72f, 0.82f, 0.95f);
            case PrototypePlayerRadarBlipKind.Hazard:
                return new Color(1f, 0.55f, 0.18f, 0.95f);
            default:
                return PrototypeModuleColorPalette.Target;
        }
    }

    private static Vector2 ClampRadarPoint(Vector2 center, float radius, PrototypePlayerRadarSnapshot radar, Vector3 target)
    {
        Vector3 delta = target - radar.ShipWorldPosition;
        Vector2 flat = new Vector2(delta.x, delta.z);
        return center + ProjectRadarOffsetPrototypeGraphic(flat, radar.RangeMeters, radius);
    }

    private static Vector2 ProjectRadarOffsetPrototypeGraphic(Vector2 flatOffset, float rangeMeters, float radius)
    {
        float range = Mathf.Max(1f, rangeMeters);
        float rawDistance = flatOffset.magnitude;
        if (rawDistance <= 0.0001f)
        {
            return Vector2.zero;
        }

        float normalizedDistance = Mathf.Clamp01(rawDistance / range);
        float easedDistance = Mathf.Sqrt(normalizedDistance);
        return flatOffset.normalized * (easedDistance * radius);
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
