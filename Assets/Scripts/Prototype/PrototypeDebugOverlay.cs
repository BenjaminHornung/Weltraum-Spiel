using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeDebugOverlay : MonoBehaviour
{
    private const float HeavyDiagnosticsIntervalSeconds = 0.2f;

    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private SimpleFollowCamera followCamera;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private ShipPhysicsCore targetPhysicsCore;
    [SerializeField] private FloatingOriginBody floatingOriginBody;
    [SerializeField] private FloatingOriginManager floatingOriginManager;
    [SerializeField] private PrototypeWaypointAutopilot waypointAutopilot;

    [Header("Overlay")]
    [SerializeField] private Vector2 windowPosition = new Vector2(16f, 16f);

    [Header("Debug Vectors")]
    [SerializeField] private bool drawDebugVectors;
    [SerializeField] private bool drawDebugGizmos;
    [SerializeField] private float forceVectorScale = 0.00015f;
    [SerializeField] private float torqueVectorScale = 0.00025f;

    private readonly PrototypeUiSampleGate heavyDiagnosticsSampler = new PrototypeUiSampleGate(HeavyDiagnosticsIntervalSeconds);
    private readonly PrototypeUiSampleGate damageDiagnosticsSampler = new PrototypeUiSampleGate(HeavyDiagnosticsIntervalSeconds);
    private GUIStyle labelStyle;
    private PrototypeUiWindowState windowState;
    private Vector2 diagnosticsScroll;
    private bool advancedDiagnosticsOpen;
    private bool flightSectionOpen = true;
    private bool propulsionSectionOpen;
    private bool rcsSectionOpen;
    private bool sasSectionOpen;
    private bool physicsSectionOpen;
    private bool damageSectionOpen;
    private bool environmentSectionOpen;
    private bool navigationSectionOpen;
    private int lastCompactDiagnosticsFrame = -1;
    private PrototypeDebugViewModel compactDebugViewModel;
    private string compactFuelLine = "No ShipStats bound.";
    private string compactControlLine = string.Empty;
    private string compactTargetLine = string.Empty;
    private AdvancedDiagnosticsSnapshot advancedSnapshot;
    private DamageDiagnostics cachedDamageDiagnostics;

    public bool IsWindowVisible => ResolveWindowState().Visible;
    public bool DrawDebugVectors => drawDebugVectors;
    public bool DrawDebugGizmos => drawDebugGizmos;
    public bool AdvancedDiagnosticsOpen => advancedDiagnosticsOpen;
    public int HeavyDiagnosticsSampleCountForTests => heavyDiagnosticsSampler.SampleCount;
    public int DamageDiagnosticsSampleCountForTests => damageDiagnosticsSampler.SampleCount;

    private void Start()
    {
        ResolveTargetReferences();
    }

    private void LateUpdate()
    {
        if (!drawDebugVectors)
        {
            return;
        }

        ResolveTargetReferences();
        DrawRuntimeDebugVectors();
    }

    private void OnGUI()
    {
        EnsureStyle();
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        if (!windowState.Collapsed)
        {
            if (targetStats == null || targetRigidbody == null || shipController == null)
            {
                ResolveTargetReferences();
            }

            RefreshCompactDiagnosticsIfNeeded();
        }

        windowState.SetSize(advancedDiagnosticsOpen ? 680f : 440f, windowState.Collapsed ? 58f : (advancedDiagnosticsOpen ? 740f : 184f));
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, "Flight Diagnostics");
        windowState.ClampToScreen();
        windowState.TrySaveToPrefsThrottled();
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Open" : "Collapse", GUILayout.Width(76f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        if (GUILayout.Button("Hide", GUILayout.Width(54f)))
        {
            windowState.Visible = false;
        }

        GUILayout.Label("F2 toggles diagnostics", labelStyle);
        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            DrawCompactDiagnostics();
            DrawAdvancedDiagnostics(Time.unscaledTime);
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawCompactDiagnostics()
    {
        GUILayout.Label(compactFuelLine, labelStyle);
        GUILayout.Label(compactControlLine, labelStyle);
        GUILayout.Label(compactTargetLine, labelStyle);
    }

    private void DrawAdvancedDiagnostics(float nowSeconds)
    {
        bool wasAdvancedOpen = advancedDiagnosticsOpen;
        advancedDiagnosticsOpen = GUILayout.Toggle(advancedDiagnosticsOpen, "Advanced Diagnostics");
        if (!advancedDiagnosticsOpen)
        {
            return;
        }

        RefreshAdvancedDiagnosticsIfNeeded(nowSeconds, !wasAdvancedOpen);
        diagnosticsScroll = GUILayout.BeginScrollView(diagnosticsScroll);
        DrawSampledSection(ref flightSectionOpen, "Flight", advancedSnapshot.FlightLines, nowSeconds);
        DrawSampledSection(ref propulsionSectionOpen, "Propulsion", advancedSnapshot.PropulsionLines, nowSeconds);
        DrawSampledSection(ref rcsSectionOpen, "RCS", advancedSnapshot.RcsLines, nowSeconds);
        DrawSampledSection(ref sasSectionOpen, "SAS", advancedSnapshot.SasLines, nowSeconds);
        DrawSampledSection(ref physicsSectionOpen, "Physics Core", advancedSnapshot.PhysicsLines, nowSeconds);
        DrawDamageSection(nowSeconds);
        DrawSampledSection(ref environmentSectionOpen, "Atmosphere/Gravity", advancedSnapshot.EnvironmentLines, nowSeconds);
        DrawSampledSection(ref navigationSectionOpen, "Navigation/Floating Origin", advancedSnapshot.NavigationLines, nowSeconds);
        GUILayout.Label($"Debug vectors: lines {(drawDebugVectors ? "on" : "off")}, gizmos {(drawDebugGizmos ? "on" : "off")}", labelStyle);
        GUILayout.EndScrollView();
    }

    private void DrawSampledSection(ref bool open, string title, string[] lines, float nowSeconds)
    {
        bool wasOpen = open;
        open = GUILayout.Toggle(open, title);
        if (!open)
        {
            return;
        }

        RefreshAdvancedDiagnosticsIfNeeded(nowSeconds, !wasOpen);
        DrawLines(lines);
    }

    private void DrawDamageSection(float nowSeconds)
    {
        bool wasOpen = damageSectionOpen;
        damageSectionOpen = GUILayout.Toggle(damageSectionOpen, "Damage");
        if (!damageSectionOpen)
        {
            return;
        }

        RefreshDamageDiagnosticsIfNeeded(nowSeconds, !wasOpen);
        GUILayout.Label($"Damage: {cachedDamageDiagnostics.damagedModules}/{cachedDamageDiagnostics.totalModules} modules, worst {cachedDamageDiagnostics.worstModule} {cachedDamageDiagnostics.worstIntegrityPercent:0}% cap {cachedDamageDiagnostics.worstCapabilityMultiplier:0.00}", labelStyle);
    }

    private void DrawLines(string[] lines)
    {
        if (lines == null || lines.Length == 0)
        {
            GUILayout.Label("Waiting for diagnostics sample.", labelStyle);
            return;
        }

        for (int i = 0; i < lines.Length; i++)
        {
            GUILayout.Label(lines[i], labelStyle);
        }
    }

    private void RefreshCompactDiagnosticsIfNeeded()
    {
        if (lastCompactDiagnosticsFrame == Time.frameCount)
        {
            return;
        }

        lastCompactDiagnosticsFrame = Time.frameCount;
        if (targetStats == null || targetRigidbody == null)
        {
            compactFuelLine = "No ship diagnostics bound.";
            compactControlLine = string.Empty;
            compactTargetLine = string.Empty;
            return;
        }

        compactDebugViewModel = PrototypeDebugViewModelBuilder.Build(targetStats, targetRigidbody, shipController);
        string navTargetName = waypointAutopilot != null ? waypointAutopilot.TargetName : "none";
        compactFuelLine = $"Fuel {targetStats.CurrentFuelKg:0.0}/{targetStats.MaxFuelKg:0.0} kg | Speed {PrototypeUiFormatter.FormatSpeed(compactDebugViewModel.SpeedMetersPerSecond)} | Throttle {compactDebugViewModel.MainThrottlePercent:0}%";
        compactControlLine = $"RCS {PrototypeUiFormatter.FormatStatus(compactDebugViewModel.RcsEnabled, "on", "off")} | SAS {PrototypeUiFormatter.FormatStatus(compactDebugViewModel.SasEnabled, "on", "off")} effective {PrototypeUiFormatter.FormatStatus(compactDebugViewModel.EffectiveSasEnabled, "on", "off")} | Mode {compactDebugViewModel.ControlMode} | Main {targetStats.LastAppliedThrust:0} N";
        compactTargetLine = $"Target {navTargetName} | Auto {compactDebugViewModel.AutopilotState} | Debug vectors {(drawDebugVectors ? "on" : "off")}";
    }

    private void RefreshAdvancedDiagnosticsIfNeeded(float nowSeconds, bool force = false)
    {
        if (!advancedDiagnosticsOpen || targetStats == null || targetRigidbody == null)
        {
            return;
        }

        if (!heavyDiagnosticsSampler.ShouldSample(nowSeconds, force))
        {
            return;
        }

        advancedSnapshot = BuildAdvancedDiagnosticsSnapshot();
    }

    private void RefreshDamageDiagnosticsIfNeeded(float nowSeconds, bool force = false)
    {
        if (!advancedDiagnosticsOpen || !damageSectionOpen)
        {
            return;
        }

        if (!damageDiagnosticsSampler.ShouldSample(nowSeconds, force))
        {
            return;
        }

        cachedDamageDiagnostics = BuildDamageDiagnostics(target);
    }

    public void RefreshVisibleDiagnosticsForTests(float nowSeconds)
    {
        ResolveWindowState();
        if (!windowState.Visible || windowState.Collapsed)
        {
            return;
        }

        ResolveTargetReferences();
        RefreshCompactDiagnosticsIfNeeded();
        RefreshAdvancedDiagnosticsIfNeeded(nowSeconds);
        RefreshDamageDiagnosticsIfNeeded(nowSeconds);
    }

    private AdvancedDiagnosticsSnapshot BuildAdvancedDiagnosticsSnapshot()
    {
        var snapshot = new AdvancedDiagnosticsSnapshot();
        if (flightSectionOpen)
        {
            snapshot.FlightLines = BuildFlightLines();
        }

        if (propulsionSectionOpen)
        {
            snapshot.PropulsionLines = BuildPropulsionLines();
        }

        if (rcsSectionOpen)
        {
            snapshot.RcsLines = BuildRcsLines();
        }

        if (sasSectionOpen)
        {
            snapshot.SasLines = BuildSasLines();
        }

        if (physicsSectionOpen)
        {
            snapshot.PhysicsLines = BuildPhysicsLines();
        }

        if (environmentSectionOpen)
        {
            snapshot.EnvironmentLines = BuildEnvironmentLines();
        }

        if (navigationSectionOpen)
        {
            snapshot.NavigationLines = BuildNavigationLines();
        }

        return snapshot;
    }

    private string[] BuildFlightLines()
    {
        Vector3 linearVelocity = targetRigidbody != null ? targetRigidbody.linearVelocity : Vector3.zero;
        Vector3 angularVelocity = targetRigidbody != null ? targetRigidbody.angularVelocity : Vector3.zero;
        float rbMass = targetRigidbody != null ? targetRigidbody.mass : 0f;
        Vector3 centerOfMassLocal = targetRigidbody != null ? targetRigidbody.centerOfMass : Vector3.zero;
        Vector3 centerOfMassWorld = targetRigidbody != null ? targetRigidbody.worldCenterOfMass : Vector3.zero;
        Vector3 inertiaTensor = targetRigidbody != null ? targetRigidbody.inertiaTensor : Vector3.zero;
        ShipMassProperties massProperties = targetStats != null ? targetStats.LastMassProperties : default;
        string cameraMode = followCamera != null ? followCamera.CameraModeName : "none";
        float cameraBaseDistance = followCamera != null ? followCamera.BaseVisualDistance : 0f;
        float cameraBaseBoundsRadius = followCamera != null ? followCamera.BaseVisualBoundsRadius : 0f;
        float cameraEffectiveDistance = followCamera != null ? followCamera.EffectiveDistance : 0f;
        float cameraZoom = followCamera != null ? followCamera.Zoom : 0f;
        float cameraAnchorError = followCamera != null ? followCamera.AnchorError : 0f;
        float cameraLookYaw = followCamera != null ? followCamera.LookYaw : 0f;
        float cameraLookPitch = followCamera != null ? followCamera.LookPitch : 0f;

        return new[]
        {
            $"Mass: stats {(targetStats != null ? targetStats.CurrentMass : 0f):0.0} kg, rb {rbMass:0.0} kg",
            $"Velocity: {FormatVector(linearVelocity)} m/s",
            $"Angular velocity: {FormatVector(angularVelocity)} rad/s",
            $"Camera: {cameraMode}, dist {cameraEffectiveDistance:0.00} (base {cameraBaseDistance:0.00}), zoom {cameraZoom:0.00}, bounds {cameraBaseBoundsRadius:0.00}, anchor {cameraAnchorError:0.000} m",
            $"Camera look: yaw {cameraLookYaw:0.0} deg, pitch {cameraLookPitch:0.0} deg",
            $"COM local/world: {FormatVector(centerOfMassLocal)} / {FormatVector(centerOfMassWorld)}",
            $"Mass model: {massProperties.ModuleCount} modules, dry {massProperties.DryMassKg:0.0} kg, fuel {massProperties.FuelMassKg:0.0} kg",
            $"Inertia tensor: {FormatVector(inertiaTensor)} kg*m^2"
        };
    }

    private string[] BuildPropulsionLines()
    {
        Vector3 centerOfMassWorld = targetRigidbody != null ? targetRigidbody.worldCenterOfMass : Vector3.zero;
        float mainCommand = shipController != null ? shipController.MainThrustCommand : (targetStats != null ? targetStats.LastThrottle : 0f);
        float mainTargetThrottle = shipController != null ? shipController.MainTargetThrottle : (targetStats != null ? targetStats.LastThrottle : 0f);
        float mainActualThrottle = shipController != null ? shipController.MainActualThrottle : (targetStats != null ? targetStats.LastThrottle : 0f);
        float throttleScale = shipController != null ? shipController.MainThrottleScale : 0f;
        float throttleSpoolUp = shipController != null ? shipController.MainThrottleSpoolUpRate : 0f;
        float throttleSpoolDown = shipController != null ? shipController.MainThrottleSpoolDownRate : 0f;
        bool gimbalEnabled = shipController != null && shipController.GimbalEnabled;
        float gimbalLimit = shipController != null ? shipController.GimbalLimitDegrees : 0f;
        float gimbalResponse = shipController != null ? shipController.GimbalResponseScalar : 0f;
        float gimbalSlewRate = shipController != null ? shipController.GimbalSlewRateDegreesPerSecond : 0f;
        float targetGimbalYaw = shipController != null ? shipController.TargetGimbalYawCommand : 0f;
        float targetGimbalPitch = shipController != null ? shipController.TargetGimbalPitchCommand : 0f;
        float actualGimbalYaw = shipController != null ? shipController.ActualGimbalYawCommand : 0f;
        float actualGimbalPitch = shipController != null ? shipController.ActualGimbalPitchCommand : 0f;
        float gimbalAngle = shipController != null ? shipController.LastGimbalAngleDegrees : 0f;
        float forwardAcceleration = shipController != null ? shipController.LastForwardAcceleration : (targetStats != null ? targetStats.LastAcceleration : 0f);
        string mainThrustMode = shipController != null ? shipController.MainThrustMode.ToString() : MainThrustMode.ComSafeSteeringOnly.ToString();
        Vector3 mainDirection = shipController != null ? shipController.LastMainThrustDirection : (target != null ? target.forward : Vector3.forward);
        Vector3 mainForcePosition = shipController != null ? shipController.LastMainForcePositionWorld : centerOfMassWorld;
        Vector3 mainForce = shipController != null ? shipController.LastMainForceWorld : Vector3.zero;
        Vector3 mainStraight = shipController != null ? shipController.LastMainStraightForceWorld : Vector3.zero;
        Vector3 mainSteering = shipController != null ? shipController.LastMainSteeringForceWorld : Vector3.zero;
        Vector3 mainTorque = shipController != null ? shipController.LastMainThrustTorque : Vector3.zero;
        PrototypeThermalModule mainThermal = shipController != null ? shipController.MainThermalModule : null;

        var lines = new List<string>
        {
            $"Throttle: target {mainTargetThrottle:0.00} actual {mainActualThrottle:0.00} cmd {mainCommand:0.00}",
            $"Throttle response: up {FormatRate(throttleSpoolUp)}, down {FormatRate(throttleSpoolDown)}, scale {throttleScale:0.00}",
            $"Main thrust: {(targetStats != null ? targetStats.LastAppliedThrust : 0f):0} / {(targetStats != null ? targetStats.Thrust : 0f):0} N",
            $"Main fuel: req {(targetStats != null ? targetStats.LastFuelRequestedKg : 0f):0.000} kg, used {(targetStats != null ? targetStats.LastFuelConsumedKg : 0f):0.000} kg, frac {(targetStats != null ? targetStats.LastAppliedFuelFraction : 0f):0.00}",
            $"Forward accel: {forwardAcceleration:0.0} m/s^2",
            $"Main mode: {mainThrustMode}",
            $"Main dir: {FormatVector(mainDirection)}",
            $"Main force pos: {FormatVector(mainForcePosition)}",
            $"Main force: {FormatVector(mainForce)}",
            $"Main straight/steering: {FormatVector(mainStraight)} / {FormatVector(mainSteering)}",
            $"Main thrust torque: {FormatVector(mainTorque)}",
            $"Gimbal: {(gimbalEnabled ? "on" : "off")} / {gimbalLimit:0.0} deg",
            $"Gimbal target: Y {targetGimbalYaw:0.00} P {targetGimbalPitch:0.00}, response {gimbalResponse:0.00}",
            $"Gimbal actual: Y {actualGimbalYaw:0.00} P {actualGimbalPitch:0.00}, slew {FormatRate(gimbalSlewRate)}, angle {gimbalAngle:0.0}"
        };

        if (mainThermal != null)
        {
            lines.Add($"Thermal: {mainThermal.ModuleName} {mainThermal.CurrentTemperature:0.0}/{mainThermal.MaxTemperature:0.0} C {mainThermal.StateLabel}");
            lines.Add($"Heat/power: heat {mainThermal.LastHeatGeneratedPerSecond:0.0}/s, cool {mainThermal.LastCoolingApplied:0.00}, power {(shipController != null ? shipController.MainPowerDrawKw : 0f):0.0} kW");
            lines.Add($"Overheat hook: {(shipController != null && shipController.MainThermalEnabled ? "sim" : "off")}, {(shipController != null && shipController.MainThermalOverheated ? "active" : "clear")}, eff {(shipController != null ? shipController.MainThermalEfficiency : 1f):0.00}");
        }

        return lines.ToArray();
    }

    private string[] BuildRcsLines()
    {
        PrototypeFlightControlDiagnostics controlDiagnostics = shipController != null ? shipController.FlightControlDiagnostics : default;
        Vector3 centerOfMassWorld = targetRigidbody != null ? targetRigidbody.worldCenterOfMass : Vector3.zero;
        Vector3 rcsPivotWorld = shipController != null ? shipController.RcsControlPivotWorld : centerOfMassWorld;

        return new[]
        {
            $"RCS: enabled {(controlDiagnostics.rcsEnabled ? "yes" : "no")}, available {(controlDiagnostics.rcsAvailable ? "yes" : "no")}, allocator {controlDiagnostics.rcsAllocatorStatus}",
            $"RCS tuning: move {(shipController != null ? shipController.RcsTranslationForceSetting : 0f):0} N, attitude {(shipController != null ? shipController.RcsAttitudeForceSetting : 0f):0} N",
            $"RCS response: up {FormatRate(shipController != null ? shipController.RcsNozzleSpoolUpRate : 0f)}, down {FormatRate(shipController != null ? shipController.RcsNozzleSpoolDownRate : 0f)}",
            $"RCS select dot: {(shipController != null ? shipController.RcsMinSelectionDot : 0f):0.00}, nozzles {(shipController != null ? shipController.ActiveRcsNozzleCount : 0)}/{(shipController != null ? shipController.InstalledRcsNozzleCount : 0)}",
            $"RCS allocator: max {(shipController != null ? shipController.LastRcsMaxNozzleThrottle : 0f):0.00}, sum {(shipController != null ? shipController.LastRcsAllocatedNozzleThrottleTotal : 0f):0.00}, applications {(shipController != null ? shipController.LastRcsNozzleApplicationCount : 0)}",
            $"RCS fuel: req {(shipController != null ? shipController.LastRcsFuelRequestedKg : 0f):0.000} kg, used {(shipController != null ? shipController.LastRcsFuelConsumedKg : 0f):0.000} kg, frac {(shipController != null ? shipController.LastRcsFuelFraction : 1f):0.00}",
            $"Move cmd: L/R {(shipController != null ? shipController.RcsTranslationCommand.x : 0f):0.00}, U/D {(shipController != null ? shipController.RcsTranslationCommand.y : 0f):0.00}, F/B {(shipController != null ? shipController.RcsTranslationCommand.z : 0f):0.00}",
            $"Attitude cmd: P {(shipController != null ? shipController.RcsAttitudeCommand.x : 0f):0.00}, Y {(shipController != null ? shipController.RcsAttitudeCommand.y : 0f):0.00}, R {(shipController != null ? shipController.RcsAttitudeCommand.z : 0f):0.00}",
            $"RCS pivot local/world: {FormatVector(shipController != null ? shipController.RcsControlPivotLocal : Vector3.zero)} / {FormatVector(rcsPivotWorld)}",
            $"RCS force desired: {FormatVector(shipController != null ? shipController.LastRcsDesiredForceWorld : Vector3.zero)}",
            $"RCS force actual: {FormatVector(shipController != null ? shipController.LastRcsActualForceWorld : Vector3.zero)}",
            $"RCS force residual: {FormatVector(shipController != null ? shipController.LastRcsResidualForceWorld : Vector3.zero)}",
            $"RCS torque desired: {FormatVector(shipController != null ? shipController.LastRcsDesiredTorqueWorld : Vector3.zero)}",
            $"RCS torque actual: {FormatVector(shipController != null ? shipController.LastRcsActualTorqueWorld : Vector3.zero)}",
            $"RCS torque residual: {FormatVector(shipController != null ? shipController.LastRcsResidualTorqueWorld : Vector3.zero)}",
            $"RCS total force: {FormatVector(shipController != null ? shipController.LastRcsForce : Vector3.zero)}",
            $"RCS translate force: {FormatVector(shipController != null ? shipController.LastRcsTranslationForce : Vector3.zero)}",
            $"RCS torque/yaw est: {FormatVector(shipController != null ? shipController.LastRcsTorque : Vector3.zero)} / {FormatVector(shipController != null ? shipController.LastRcsYawTorque : Vector3.zero)}",
            $"Active nozzles: {Shorten(shipController != null ? shipController.ActiveRcsNozzleIds : string.Empty, 74)}"
        };
    }

    private string[] BuildSasLines()
    {
        PrototypeFlightControlDiagnostics controlDiagnostics = shipController != null ? shipController.FlightControlDiagnostics : default;
        return new[]
        {
            $"SAS: armed {(controlDiagnostics.sasEnabled ? "on" : "off")} / effective {(controlDiagnostics.effectiveSasEnabled ? "on" : "off")} / authority {(controlDiagnostics.sasHasAuthority ? "yes" : "no")} {(shipController != null ? shipController.SasMode : SasControlMode.KillRotation)}",
            $"SAS PD: Kp {(shipController != null ? shipController.RcsSasProportionalGain : 0f):0.00}, Kd {(shipController != null ? shipController.RcsSasDerivativeGain : 0f):0.00}, auth {(shipController != null ? shipController.RcsSasAuthority : 0f):0.00}",
            $"SAS local w: {FormatVector(shipController != null ? shipController.LastRcsSasAngularVelocityLocal : Vector3.zero)} rad/s",
            $"SAS angular err: {FormatVector(shipController != null ? shipController.LastRcsSasAngularErrorLocal : Vector3.zero)} rad",
            $"SAS raw/masked cmd: {FormatVector(shipController != null ? shipController.LastRawRcsSasCommand : Vector3.zero)} / {FormatVector(shipController != null ? shipController.LastRcsSasCommand : Vector3.zero)}",
            $"SAS torque raw: {FormatVector(shipController != null ? shipController.LastRawRcsSasDesiredTorqueLocal : Vector3.zero)} Nm",
            $"SAS torque masked: {FormatVector(shipController != null ? shipController.LastRcsSasDesiredTorqueLocal : Vector3.zero)} Nm",
            $"SAS torque blocked: {FormatVector(shipController != null ? shipController.LastRcsSasSuppressedTorqueLocal : Vector3.zero)} Nm",
            $"Assist: {(shipController != null ? shipController.FlightAssistMode : FlightAssistMode.Simulation)}{(shipController != null && shipController.LastFlightAssistDebugOnly ? " (debug-only)" : string.Empty)}",
            $"Assist force/torque req: {FormatVector(shipController != null ? shipController.LastFlightAssistForceWorld : Vector3.zero)} N / {FormatVector(shipController != null ? shipController.LastFlightAssistTorqueLocal : Vector3.zero)} Nm",
            $"Weapon recoil impulse: {FormatVector(shipController != null ? shipController.LastWeaponRecoilImpulseWorld : Vector3.zero)} Ns",
            $"Weapon recoil angular: {FormatVector(shipController != null ? shipController.LastWeaponRecoilAngularImpulseWorld : Vector3.zero)} Ns*m",
            $"Weapon stabilization: {(shipController != null ? shipController.LastWeaponStabilizationStatus : "unavailable")} req {FormatVector(shipController != null ? shipController.LastWeaponStabilizationTorqueRequestWorld : Vector3.zero)} Nm",
            $"Weapon stabilization residual: {FormatVector(shipController != null ? shipController.LastWeaponStabilizationResidualRcsTorqueWorld : Vector3.zero)} Nm",
            $"Torque demand: manual {FormatVector(shipController != null ? shipController.LastRcsManualDesiredTorqueLocal : Vector3.zero)}",
            $"Torque demand: total {FormatVector(shipController != null ? shipController.LastRcsDesiredTorqueLocal : Vector3.zero)}",
            $"SAS released axes: {FormatAxisMask(shipController != null ? shipController.LastRcsSasReleasedAxes : Vector3.one)}",
            $"SAS manual axes: {FormatManualMask(shipController != null ? shipController.LastRcsSasManualOverrideAxes : Vector3.zero)}"
        };
    }

    private string[] BuildPhysicsLines()
    {
        return new[]
        {
            $"Core force: {FormatVector(shipController != null ? shipController.LastCoreAppliedForce : Vector3.zero)}",
            $"Core torque: {FormatVector(shipController != null ? shipController.LastCoreAppliedTorque : Vector3.zero)}, applications {(shipController != null ? shipController.LastCoreAppliedForceCount : 0)}",
            $"Core impulse: {FormatVector(shipController != null ? shipController.LastCoreAppliedImpulse : Vector3.zero)} Ns, applications {(shipController != null ? shipController.LastCoreAppliedImpulseCount : 0)}",
            $"Core angular impulse: {FormatVector(shipController != null ? shipController.LastCoreAppliedAngularImpulse : Vector3.zero)} Ns*m",
            $"Impact impulse: {FormatVector(targetPhysicsCore != null ? targetPhysicsCore.LastImpactImpulse : Vector3.zero)} Ns, count {(targetPhysicsCore != null ? targetPhysicsCore.ImpactImpulseCount : 0)}",
            $"Impact torque impulse: {FormatVector(targetPhysicsCore != null ? targetPhysicsCore.LastImpactTorqueImpulse : Vector3.zero)} Ns*m"
        };
    }

    private string[] BuildEnvironmentLines()
    {
        ShipAtmosphereSample atmosphereSample = targetPhysicsCore != null ? targetPhysicsCore.LastAtmosphereSample : ShipAtmosphereSample.Zero;
        return new[]
        {
            $"Atmosphere: {(atmosphereSample.active ? "active" : "vacuum")} density {atmosphereSample.densityKgPerCubicMeter:0.000} kg/m^3",
            $"Atmos drag: {FormatVector(atmosphereSample.dragForce)} N, rel {atmosphereSample.relativeVelocity.magnitude:0.00} m/s",
            $"Atmos Cd/area: {atmosphereSample.dragCoefficient:0.00} / {atmosphereSample.referenceAreaSquareMeters:0.00} m^2",
            $"Gravity: {(shipController != null && shipController.GravityEnabled ? "on" : "off")} body {(shipController != null ? shipController.LastGravityBodyName : "none")}, applied {(shipController != null && shipController.LastGravityApplied ? "yes" : "no")}",
            $"Gravity mu/dist: {(shipController != null ? shipController.GravityMu : 0f):0.00} / {(shipController != null ? shipController.LastGravityDistance : 0f):0.00} m",
            $"Gravity accel: {FormatVector(shipController != null ? shipController.LastGravityAcceleration : Vector3.zero)} m/s^2",
            $"Gravity force: {FormatVector(shipController != null ? shipController.LastGravityForce : Vector3.zero)} N"
        };
    }

    private string[] BuildNavigationLines()
    {
        PrototypeFlightControlDiagnostics controlDiagnostics = shipController != null ? shipController.FlightControlDiagnostics : default;
        bool floatingOriginPresent = floatingOriginBody != null;
        bool floatingOriginEnabled = floatingOriginManager != null && floatingOriginManager.FloatingOriginEnabled;
        LargeWorldVector3d origin = floatingOriginManager != null ? floatingOriginManager.Origin : LargeWorldVector3d.Zero;
        LargeWorldVector3d absolutePosition = floatingOriginBody != null ? floatingOriginBody.AbsolutePosition : LargeWorldVector3d.Zero;
        LargeWorldVector3d absoluteVelocity = floatingOriginBody != null ? floatingOriginBody.AbsoluteVelocity : LargeWorldVector3d.Zero;

        return new[]
        {
            $"Nav target: {(waypointAutopilot != null ? waypointAutopilot.TargetName : "none")}",
            $"Autopilot: {(shipController != null ? controlDiagnostics.autopilotState.ToString() : "none")}, {(shipController != null ? controlDiagnostics.autopilotStatus : "unavailable")}",
            $"Nav dist/ETA: {(waypointAutopilot != null ? waypointAutopilot.DistanceToTarget : 0f):0.0} m, {FormatEta(waypointAutopilot != null ? waypointAutopilot.EtaSeconds : float.PositiveInfinity)}",
            $"Nav speed: closing {(waypointAutopilot != null ? waypointAutopilot.ClosingSpeed : 0f):0.0} m/s, lateral {(waypointAutopilot != null ? waypointAutopilot.LateralSpeed : 0f):0.0} m/s",
            $"Nav stop/fuel: {(waypointAutopilot != null ? waypointAutopilot.StoppingDistance : 0f):0.0} m, burn {FormatBurn(waypointAutopilot != null ? waypointAutopilot.AvailableBurnSeconds : 0f)} / {(waypointAutopilot != null ? waypointAutopilot.RequiredBurnSeconds : 0f):0.0}s {(waypointAutopilot != null && waypointAutopilot.FuelFeasible ? "ok" : "low")}",
            $"Floating origin: {(floatingOriginEnabled ? "on" : "off")} ({(floatingOriginPresent ? "body" : "no body")}), shifts {(floatingOriginManager != null ? floatingOriginManager.ShiftCount : 0)}, bodies {(floatingOriginManager != null ? floatingOriginManager.RegisteredBodyCount : 0)}",
            $"Origin abs: {FormatLargeVector(origin)}",
            $"Ship abs/local: {FormatLargeVector(absolutePosition)} / {FormatVector(target != null ? target.position : Vector3.zero)}",
            $"Ship abs velocity: {FormatLargeVector(absoluteVelocity)} m/s"
        };
    }

    private void ResolveTargetReferences()
    {
        if (target == null)
        {
            return;
        }

        if (targetStats == null)
        {
            targetStats = target.GetComponent<ShipStats>();
        }

        if (targetRigidbody == null)
        {
            targetRigidbody = target.GetComponent<Rigidbody>();
        }

        if (targetPhysicsCore == null)
        {
            targetPhysicsCore = target.GetComponent<ShipPhysicsCore>();
        }

        if (floatingOriginBody == null)
        {
            floatingOriginBody = target.GetComponent<FloatingOriginBody>();
        }

        if (floatingOriginManager == null && floatingOriginBody != null)
        {
            floatingOriginManager = floatingOriginBody.Manager;
        }

        if (followCamera == null)
        {
            followCamera = GetComponent<SimpleFollowCamera>();
        }

        if (shipController == null)
        {
            shipController = target.GetComponent<PlayerShipController>();
        }

        if (waypointAutopilot == null)
        {
            waypointAutopilot = target.GetComponent<PrototypeWaypointAutopilot>();
        }
    }

    private void EnsureStyle()
    {
        if (labelStyle != null)
        {
            return;
        }

        labelStyle = new GUIStyle(GUI.skin.label);
        labelStyle.fontSize = 13;
        labelStyle.normal.textColor = Color.white;
    }

    private void OnDrawGizmos()
    {
        if (!drawDebugGizmos)
        {
            return;
        }

        ResolveTargetReferences();
        if (targetRigidbody == null || shipController == null)
        {
            return;
        }

        DrawGizmoVector(shipController.LastMainForcePositionWorld, shipController.LastMainForceWorld, forceVectorScale, Color.cyan);
        DrawGizmoVector(shipController.LastMainForcePositionWorld, shipController.LastMainSteeringForceWorld, forceVectorScale, Color.magenta);
        DrawGizmoVector(shipController.RcsControlPivotWorld, shipController.LastRcsTranslationForce, forceVectorScale, Color.green);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastRcsTorque, torqueVectorScale, Color.yellow);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastMainThrustTorque, torqueVectorScale, Color.red);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedForce, forceVectorScale, Color.white);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedTorque, torqueVectorScale, Color.blue);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, targetPhysicsCore != null ? targetPhysicsCore.LastAtmosphereDragForce : Vector3.zero, forceVectorScale, Color.cyan);
    }

    private void DrawRuntimeDebugVectors()
    {
        if (targetRigidbody == null || shipController == null)
        {
            return;
        }

        DrawDebugVector(shipController.LastMainForcePositionWorld, shipController.LastMainForceWorld, forceVectorScale, Color.cyan);
        DrawDebugVector(shipController.LastMainForcePositionWorld, shipController.LastMainSteeringForceWorld, forceVectorScale, Color.magenta);
        DrawDebugVector(shipController.RcsControlPivotWorld, shipController.LastRcsTranslationForce, forceVectorScale, Color.green);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastRcsTorque, torqueVectorScale, Color.yellow);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastMainThrustTorque, torqueVectorScale, Color.red);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedForce, forceVectorScale, Color.white);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedTorque, torqueVectorScale, Color.blue);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, targetPhysicsCore != null ? targetPhysicsCore.LastAtmosphereDragForce : Vector3.zero, forceVectorScale, Color.cyan);
    }

    private static void DrawGizmoVector(Vector3 origin, Vector3 vector, float scale, Color color)
    {
        if (vector.sqrMagnitude <= 0.0001f || scale <= 0f)
        {
            return;
        }

        Gizmos.color = color;
        Gizmos.DrawLine(origin, origin + vector * scale);
    }

    private static void DrawDebugVector(Vector3 origin, Vector3 vector, float scale, Color color)
    {
        if (vector.sqrMagnitude <= 0.0001f || scale <= 0f)
        {
            return;
        }

        Debug.DrawLine(origin, origin + vector * scale, color, 0f, false);
    }

    private static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }

    private static string FormatLargeVector(LargeWorldVector3d value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }

    private static string FormatRate(float value)
    {
        return value <= 0f ? "instant" : $"{value:0.00}/s";
    }

    private static string FormatEta(float value)
    {
        return float.IsInfinity(value) || float.IsNaN(value) ? "--" : $"{value:0.0}s";
    }

    private static string FormatBurn(float value)
    {
        return float.IsInfinity(value) || float.IsNaN(value) ? "free" : $"{value:0.0}s";
    }

    private static string FormatAxisMask(Vector3 value)
    {
        return $"P {(value.x > 0.5f ? "released" : "manual")}, Y {(value.y > 0.5f ? "released" : "manual")}, R {(value.z > 0.5f ? "released" : "manual")}";
    }

    private static string FormatManualMask(Vector3 value)
    {
        return $"P {(value.x > 0.5f ? "manual" : "auto")}, Y {(value.y > 0.5f ? "manual" : "auto")}, R {(value.z > 0.5f ? "manual" : "auto")}";
    }

    private static string Shorten(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return string.IsNullOrEmpty(value) ? "none" : value;
        }

        return value.Substring(0, Mathf.Max(0, maxLength - 3)) + "...";
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.DiagnosticsWindowId,
                new Rect(windowPosition.x, windowPosition.y, 440f, 184f),
                true,
                false);
        }

        return windowState;
    }

    public void Bind(Transform trackTarget, ShipStats stats, Rigidbody rb)
    {
        target = trackTarget;
        targetStats = stats;
        targetRigidbody = rb;
        followCamera = GetComponent<SimpleFollowCamera>();
        shipController = trackTarget != null ? trackTarget.GetComponent<PlayerShipController>() : null;
        targetPhysicsCore = trackTarget != null ? trackTarget.GetComponent<ShipPhysicsCore>() : null;
        floatingOriginBody = trackTarget != null ? trackTarget.GetComponent<FloatingOriginBody>() : null;
        floatingOriginManager = floatingOriginBody != null ? floatingOriginBody.Manager : null;
        waypointAutopilot = trackTarget != null ? trackTarget.GetComponent<PrototypeWaypointAutopilot>() : null;
        lastCompactDiagnosticsFrame = -1;
        heavyDiagnosticsSampler.Invalidate();
        damageDiagnosticsSampler.Invalidate();
    }

    public void SetDrawDebugVectors(bool enabled)
    {
        drawDebugVectors = enabled;
        lastCompactDiagnosticsFrame = -1;
    }

    public void SetDrawDebugGizmos(bool enabled)
    {
        drawDebugGizmos = enabled;
    }

    public void SetWindowVisible(bool visible)
    {
        ResolveWindowState().Visible = visible;
    }

    public void SetWindowCollapsed(bool collapsed)
    {
        ResolveWindowState().Collapsed = collapsed;
    }

    public void SetAdvancedDiagnostics(bool enabled)
    {
        if (advancedDiagnosticsOpen != enabled)
        {
            heavyDiagnosticsSampler.Invalidate();
        }

        advancedDiagnosticsOpen = enabled;
        if (enabled)
        {
            propulsionSectionOpen = true;
            physicsSectionOpen = true;
            environmentSectionOpen = true;
            navigationSectionOpen = true;
        }
    }

    public void SetRcsDiagnosticsExpanded(bool expanded)
    {
        rcsSectionOpen = expanded;
        sasSectionOpen = expanded;
        if (expanded)
        {
            SetAdvancedDiagnostics(true);
        }
    }

    public void SetDamageDiagnosticsExpandedForTests(bool expanded)
    {
        damageSectionOpen = expanded;
        if (expanded)
        {
            SetAdvancedDiagnostics(true);
        }
    }

    private struct AdvancedDiagnosticsSnapshot
    {
        public string[] FlightLines;
        public string[] PropulsionLines;
        public string[] RcsLines;
        public string[] SasLines;
        public string[] PhysicsLines;
        public string[] EnvironmentLines;
        public string[] NavigationLines;
    }

    private struct DamageDiagnostics
    {
        public int totalModules;
        public int damagedModules;
        public string worstModule;
        public float worstIntegrityPercent;
        public float worstCapabilityMultiplier;
    }

    private static DamageDiagnostics BuildDamageDiagnostics(Transform root)
    {
        var diagnostics = new DamageDiagnostics
        {
            worstModule = "none",
            worstIntegrityPercent = 100f,
            worstCapabilityMultiplier = 1f
        };

        if (root == null)
        {
            return diagnostics;
        }

        PrototypeModuleDamageState[] states = root.GetComponentsInChildren<PrototypeModuleDamageState>(true);
        diagnostics.totalModules = states.Length;
        for (int i = 0; i < states.Length; i++)
        {
            PrototypeModuleDamageState state = states[i];
            if (state == null)
            {
                continue;
            }

            if (state.IsDamaged)
            {
                diagnostics.damagedModules++;
            }

            float integrityPercent = state.IntegrityFraction * 100f;
            if (diagnostics.worstModule == "none" || integrityPercent < diagnostics.worstIntegrityPercent)
            {
                diagnostics.worstModule = state.ModuleName;
                diagnostics.worstIntegrityPercent = integrityPercent;
                diagnostics.worstCapabilityMultiplier = state.CapabilityMultiplier;
            }
        }

        return diagnostics;
    }
}
