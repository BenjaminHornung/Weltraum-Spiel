using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeDebugOverlay : MonoBehaviour
{
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

    private GUIStyle labelStyle;

    private void Start()
    {
        ResolveTargetReferences();
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
        if (targetStats == null || targetRigidbody == null || shipController == null)
        {
            ResolveTargetReferences();
            if (targetStats == null || targetRigidbody == null)
            {
                return;
            }
        }

        EnsureStyle();

        Vector3 linearVelocity = targetRigidbody.linearVelocity;
        Vector3 angularVelocity = targetRigidbody.angularVelocity;
        float speedMps = linearVelocity.magnitude;
        float speedKph = speedMps * 3.6f;
        float rbMass = targetRigidbody.mass;
        Vector3 centerOfMassLocal = targetRigidbody.centerOfMass;
        Vector3 centerOfMassWorld = targetRigidbody.worldCenterOfMass;
        Vector3 inertiaTensor = targetRigidbody.inertiaTensor;
        ShipMassProperties massProperties = targetStats.LastMassProperties;
        DamageDiagnostics damageDiagnostics = BuildDamageDiagnostics(target);

        Vector3 rcsTranslation = shipController != null ? shipController.RcsTranslationCommand : Vector3.zero;
        Vector3 rcsAttitude = shipController != null ? shipController.RcsAttitudeCommand : Vector3.zero;
        float throttlePercent = shipController != null ? shipController.MainActualThrottlePercent : targetStats.LastThrottle * 100f;
        float mainCommand = shipController != null ? shipController.MainThrustCommand : targetStats.LastThrottle;
        float mainTargetThrottle = shipController != null ? shipController.MainTargetThrottle : targetStats.LastThrottle;
        float mainActualThrottle = shipController != null ? shipController.MainActualThrottle : targetStats.LastThrottle;
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
        float turnInput = shipController != null ? shipController.TurnInput : 0f;
        bool hasRcs = shipController != null && shipController.HasRcs;
        bool rcsEnabled = shipController != null && shipController.RcsEnabled;
        bool sasEnabled = shipController != null && shipController.SasEnabled;
        bool effectiveSas = shipController != null && shipController.EffectiveSasEnabled;
        bool precision = shipController != null && shipController.PrecisionControls;
        float forwardAcceleration = shipController != null ? shipController.LastForwardAcceleration : targetStats.LastAcceleration;
        Vector3 rcsPivotLocal = shipController != null ? shipController.RcsControlPivotLocal : Vector3.zero;
        Vector3 rcsPivotWorld = shipController != null ? shipController.RcsControlPivotWorld : centerOfMassWorld;
        int installedNozzles = shipController != null ? shipController.InstalledRcsNozzleCount : 0;
        int activeNozzles = shipController != null ? shipController.ActiveRcsNozzleCount : 0;
        string activeNozzleIds = shipController != null ? shipController.ActiveRcsNozzleIds : string.Empty;
        float rcsMaxNozzleThrottle = shipController != null ? shipController.LastRcsMaxNozzleThrottle : 0f;
        int rcsNozzleApplications = shipController != null ? shipController.LastRcsNozzleApplicationCount : 0;
        float rcsTranslationSetting = shipController != null ? shipController.RcsTranslationForceSetting : 0f;
        float rcsAttitudeSetting = shipController != null ? shipController.RcsAttitudeForceSetting : 0f;
        float sasAuthority = shipController != null ? shipController.RcsSasAuthority : 0f;
        float sasProportionalGain = shipController != null ? shipController.RcsSasProportionalGain : 0f;
        float sasDerivativeGain = shipController != null ? shipController.RcsSasDerivativeGain : 0f;
        SasControlMode sasMode = shipController != null ? shipController.SasMode : SasControlMode.KillRotation;
        FlightAssistMode flightAssistMode = shipController != null ? shipController.FlightAssistMode : FlightAssistMode.Simulation;
        float minSelectionDot = shipController != null ? shipController.RcsMinSelectionDot : 0f;
        float rcsNozzleSpoolUp = shipController != null ? shipController.RcsNozzleSpoolUpRate : 0f;
        float rcsNozzleSpoolDown = shipController != null ? shipController.RcsNozzleSpoolDownRate : 0f;
        Vector3 rawSasCommand = shipController != null ? shipController.LastRawRcsSasCommand : Vector3.zero;
        Vector3 sasCommand = shipController != null ? shipController.LastRcsSasCommand : Vector3.zero;
        Vector3 sasReleasedAxes = shipController != null ? shipController.LastRcsSasReleasedAxes : Vector3.one;
        Vector3 sasManualAxes = shipController != null ? shipController.LastRcsSasManualOverrideAxes : Vector3.zero;
        Vector3 sasAngularVelocityLocal = shipController != null ? shipController.LastRcsSasAngularVelocityLocal : Vector3.zero;
        Vector3 sasAngularErrorLocal = shipController != null ? shipController.LastRcsSasAngularErrorLocal : Vector3.zero;
        Vector3 rawSasTorqueLocal = shipController != null ? shipController.LastRawRcsSasDesiredTorqueLocal : Vector3.zero;
        Vector3 sasTorqueLocal = shipController != null ? shipController.LastRcsSasDesiredTorqueLocal : Vector3.zero;
        Vector3 suppressedSasTorqueLocal = shipController != null ? shipController.LastRcsSasSuppressedTorqueLocal : Vector3.zero;
        Vector3 assistForceWorld = shipController != null ? shipController.LastFlightAssistForceWorld : Vector3.zero;
        Vector3 assistTorqueLocal = shipController != null ? shipController.LastFlightAssistTorqueLocal : Vector3.zero;
        bool assistDebugOnly = shipController != null && shipController.LastFlightAssistDebugOnly;
        Vector3 manualTorqueLocal = shipController != null ? shipController.LastRcsManualDesiredTorqueLocal : Vector3.zero;
        Vector3 desiredTorqueLocal = shipController != null ? shipController.LastRcsDesiredTorqueLocal : Vector3.zero;
        Vector3 rcsTotalForce = shipController != null ? shipController.LastRcsForce : Vector3.zero;
        Vector3 rcsTranslationForce = shipController != null ? shipController.LastRcsTranslationForce : Vector3.zero;
        Vector3 rcsDesiredForce = shipController != null ? shipController.LastRcsDesiredForceWorld : Vector3.zero;
        Vector3 rcsActualForce = shipController != null ? shipController.LastRcsActualForceWorld : Vector3.zero;
        Vector3 rcsResidualForce = shipController != null ? shipController.LastRcsResidualForceWorld : Vector3.zero;
        Vector3 rcsDesiredTorque = shipController != null ? shipController.LastRcsDesiredTorqueWorld : Vector3.zero;
        Vector3 rcsActualTorque = shipController != null ? shipController.LastRcsActualTorqueWorld : Vector3.zero;
        Vector3 rcsResidualTorque = shipController != null ? shipController.LastRcsResidualTorqueWorld : Vector3.zero;
        Vector3 rcsTorque = shipController != null ? shipController.LastRcsTorque : Vector3.zero;
        Vector3 rcsYawTorque = shipController != null ? shipController.LastRcsYawTorque : Vector3.zero;
        Vector3 coreForce = shipController != null ? shipController.LastCoreAppliedForce : Vector3.zero;
        Vector3 coreTorque = shipController != null ? shipController.LastCoreAppliedTorque : Vector3.zero;
        Vector3 coreImpulse = shipController != null ? shipController.LastCoreAppliedImpulse : Vector3.zero;
        Vector3 coreAngularImpulse = shipController != null ? shipController.LastCoreAppliedAngularImpulse : Vector3.zero;
        int coreApplications = shipController != null ? shipController.LastCoreAppliedForceCount : 0;
        int coreImpulseApplications = shipController != null ? shipController.LastCoreAppliedImpulseCount : 0;
        Vector3 impactImpulse = targetPhysicsCore != null ? targetPhysicsCore.LastImpactImpulse : Vector3.zero;
        Vector3 impactTorqueImpulse = targetPhysicsCore != null ? targetPhysicsCore.LastImpactTorqueImpulse : Vector3.zero;
        int impactImpulseCount = targetPhysicsCore != null ? targetPhysicsCore.ImpactImpulseCount : 0;
        ShipAtmosphereSample atmosphereSample = targetPhysicsCore != null ? targetPhysicsCore.LastAtmosphereSample : ShipAtmosphereSample.Zero;
        bool atmosphereActive = atmosphereSample.active;
        float atmosphereDensity = atmosphereSample.densityKgPerCubicMeter;
        float atmosphereDragCoefficient = atmosphereSample.dragCoefficient;
        float atmosphereReferenceArea = atmosphereSample.referenceAreaSquareMeters;
        Vector3 atmosphereRelativeVelocity = atmosphereSample.relativeVelocity;
        Vector3 atmosphereDragForce = atmosphereSample.dragForce;
        bool gravityEnabled = shipController != null && shipController.GravityEnabled;
        bool gravityApplied = shipController != null && shipController.LastGravityApplied;
        string gravityBodyName = shipController != null ? shipController.LastGravityBodyName : "none";
        float gravityMu = shipController != null ? shipController.GravityMu : 0f;
        float gravityDistance = shipController != null ? shipController.LastGravityDistance : 0f;
        Vector3 gravityAcceleration = shipController != null ? shipController.LastGravityAcceleration : Vector3.zero;
        Vector3 gravityForce = shipController != null ? shipController.LastGravityForce : Vector3.zero;
        string mainThrustMode = shipController != null ? shipController.MainThrustMode.ToString() : MainThrustMode.ComSafeSteeringOnly.ToString();
        Vector3 mainDirection = shipController != null ? shipController.LastMainThrustDirection : target.transform.forward;
        Vector3 mainForce = shipController != null ? shipController.LastMainForceWorld : Vector3.zero;
        Vector3 mainStraight = shipController != null ? shipController.LastMainStraightForceWorld : Vector3.zero;
        Vector3 mainSteering = shipController != null ? shipController.LastMainSteeringForceWorld : Vector3.zero;
        Vector3 mainTorque = shipController != null ? shipController.LastMainThrustTorque : Vector3.zero;
        PrototypeThermalModule mainThermal = shipController != null ? shipController.MainThermalModule : null;
        bool mainThermalEnabled = shipController != null && shipController.MainThermalEnabled;
        bool mainThermalOverheated = shipController != null && shipController.MainThermalOverheated;
        float mainThermalEfficiency = shipController != null ? shipController.MainThermalEfficiency : 1f;
        float mainPowerDrawKw = shipController != null ? shipController.MainPowerDrawKw : 0f;
        float mainFuelRequested = targetStats.LastFuelRequestedKg;
        float mainFuelConsumed = targetStats.LastFuelConsumedKg;
        float mainFuelFraction = targetStats.LastAppliedFuelFraction;
        float rcsFuelRequested = shipController != null ? shipController.LastRcsFuelRequestedKg : 0f;
        float rcsFuelConsumed = shipController != null ? shipController.LastRcsFuelConsumedKg : 0f;
        float rcsFuelFraction = shipController != null ? shipController.LastRcsFuelFraction : 1f;
        float rcsAllocatedThrottleTotal = shipController != null ? shipController.LastRcsAllocatedNozzleThrottleTotal : 0f;
        string cameraMode = followCamera != null ? followCamera.CameraModeName : "none";
        float cameraAnchorError = followCamera != null ? followCamera.AnchorError : 0f;
        float cameraLookYaw = followCamera != null ? followCamera.LookYaw : 0f;
        float cameraLookPitch = followCamera != null ? followCamera.LookPitch : 0f;
        Vector3 mainForcePosition = shipController != null ? shipController.LastMainForcePositionWorld : centerOfMassWorld;
        bool floatingOriginPresent = floatingOriginBody != null;
        bool floatingOriginEnabled = floatingOriginManager != null && floatingOriginManager.FloatingOriginEnabled;
        LargeWorldVector3d origin = floatingOriginManager != null ? floatingOriginManager.Origin : LargeWorldVector3d.Zero;
        LargeWorldVector3d absolutePosition = floatingOriginBody != null ? floatingOriginBody.AbsolutePosition : LargeWorldVector3d.Zero;
        LargeWorldVector3d absoluteVelocity = floatingOriginBody != null ? floatingOriginBody.AbsoluteVelocity : LargeWorldVector3d.Zero;
        int originShiftCount = floatingOriginManager != null ? floatingOriginManager.ShiftCount : 0;
        int registeredOriginBodies = floatingOriginManager != null ? floatingOriginManager.RegisteredBodyCount : 0;
        string navTargetName = waypointAutopilot != null ? waypointAutopilot.TargetName : "none";
        string autopilotState = waypointAutopilot != null ? waypointAutopilot.CurrentState.ToString() : "none";
        string autopilotArrival = waypointAutopilot != null ? waypointAutopilot.ArrivalStatus : "unavailable";
        float navDistance = waypointAutopilot != null ? waypointAutopilot.DistanceToTarget : 0f;
        float navClosingSpeed = waypointAutopilot != null ? waypointAutopilot.ClosingSpeed : 0f;
        float navLateralSpeed = waypointAutopilot != null ? waypointAutopilot.LateralSpeed : 0f;
        float navStoppingDistance = waypointAutopilot != null ? waypointAutopilot.StoppingDistance : 0f;
        float navEtaSeconds = waypointAutopilot != null ? waypointAutopilot.EtaSeconds : float.PositiveInfinity;
        float navAvailableBurn = waypointAutopilot != null ? waypointAutopilot.AvailableBurnSeconds : 0f;
        float navRequiredBurn = waypointAutopilot != null ? waypointAutopilot.RequiredBurnSeconds : 0f;
        bool navFuelFeasible = waypointAutopilot != null && waypointAutopilot.FuelFeasible;

        Rect rect = new Rect(windowPosition.x, windowPosition.y, 620f, 830f);
        GUI.Box(rect, "Prototype Flight Diagnostics");

        GUILayout.BeginArea(new Rect(rect.x + 8f, rect.y + 22f, rect.width - 14f, rect.height - 24f));
        GUILayout.BeginHorizontal();
        GUILayout.BeginVertical(GUILayout.Width(300f));
        GUILayout.Label($"Fuel: {targetStats.CurrentFuelKg:0.0} / {targetStats.MaxFuelKg:0.0} kg", labelStyle);
        GUILayout.Label($"Mass: stats {targetStats.CurrentMass:0.0} kg, rb {rbMass:0.0} kg", labelStyle);
        GUILayout.Label($"Speed: {speedMps:0.0} m/s ({speedKph:0.0} km/h)", labelStyle);
        GUILayout.Label($"Velocity: {FormatVector(linearVelocity)} m/s", labelStyle);
        GUILayout.Label($"Camera: {cameraMode}, anchor error {cameraAnchorError:0.000} m", labelStyle);
        GUILayout.Label($"Camera look: yaw {cameraLookYaw:0.0} deg, pitch {cameraLookPitch:0.0} deg", labelStyle);
        GUILayout.Label($"Floating origin: {(floatingOriginEnabled ? "on" : "off")} ({(floatingOriginPresent ? "body" : "no body")}), shifts {originShiftCount}, bodies {registeredOriginBodies}", labelStyle);
        GUILayout.Label($"Origin abs: {FormatLargeVector(origin)}", labelStyle);
        GUILayout.Label($"Ship abs/local: {FormatLargeVector(absolutePosition)} / {FormatVector(target.position)}", labelStyle);
        GUILayout.Label($"Ship abs velocity: {FormatLargeVector(absoluteVelocity)} m/s", labelStyle);
        GUILayout.Label($"Angular velocity: {FormatVector(angularVelocity)} rad/s", labelStyle);
        GUILayout.Label($"COM local: {FormatVector(centerOfMassLocal)}", labelStyle);
        GUILayout.Label($"COM world: {FormatVector(centerOfMassWorld)}", labelStyle);
        GUILayout.Label($"Mass model: {massProperties.ModuleCount} modules, dry {massProperties.DryMassKg:0.0} kg, fuel {massProperties.FuelMassKg:0.0} kg", labelStyle);
        GUILayout.Label($"Inertia tensor: {FormatVector(inertiaTensor)} kg*m^2", labelStyle);
        GUILayout.Label($"Damage: {damageDiagnostics.damagedModules}/{damageDiagnostics.totalModules} modules, worst {damageDiagnostics.worstModule} {damageDiagnostics.worstIntegrityPercent:0}% cap {damageDiagnostics.worstCapabilityMultiplier:0.00}", labelStyle);
        GUILayout.Space(4f);
        GUILayout.Label($"Throttle: {throttlePercent:0}% target {mainTargetThrottle:0.00} actual {mainActualThrottle:0.00} cmd {mainCommand:0.00}", labelStyle);
        GUILayout.Label($"Throttle response: up {FormatRate(throttleSpoolUp)}, down {FormatRate(throttleSpoolDown)}, scale {throttleScale:0.00}", labelStyle);
        GUILayout.Label($"Main thrust: {targetStats.LastAppliedThrust:0} / {targetStats.Thrust:0} N", labelStyle);
        GUILayout.Label($"Main fuel: req {mainFuelRequested:0.000} kg, used {mainFuelConsumed:0.000} kg, frac {mainFuelFraction:0.00}", labelStyle);
        GUILayout.Label($"Forward accel: {forwardAcceleration:0.0} m/s^2", labelStyle);
        GUILayout.Label($"Main mode: {mainThrustMode}", labelStyle);
        GUILayout.Label($"Main dir: {FormatVector(mainDirection)}", labelStyle);
        GUILayout.Label($"Main force pos: {FormatVector(mainForcePosition)}", labelStyle);
        GUILayout.Label($"Main force: {FormatVector(mainForce)}", labelStyle);
        GUILayout.Label($"Main straight: {FormatVector(mainStraight)}", labelStyle);
        GUILayout.Label($"Main steering: {FormatVector(mainSteering)}", labelStyle);
        GUILayout.Label($"Main thrust torque: {FormatVector(mainTorque)}", labelStyle);
        if (mainThermal != null)
        {
            GUILayout.Label($"Thermal: {mainThermal.ModuleName} {mainThermal.CurrentTemperature:0.0}/{mainThermal.MaxTemperature:0.0} C {mainThermal.StateLabel}", labelStyle);
            GUILayout.Label($"Heat/power: heat {mainThermal.LastHeatGeneratedPerSecond:0.0}/s, cool {mainThermal.LastCoolingApplied:0.00}, power {mainPowerDrawKw:0.0} kW", labelStyle);
            GUILayout.Label($"Overheat hook: {(mainThermalEnabled ? "sim" : "off")}, {(mainThermalOverheated ? "active" : "clear")}, eff {mainThermalEfficiency:0.00}", labelStyle);
        }

        GUILayout.Label($"Gimbal: {(gimbalEnabled ? "on" : "off")} / {gimbalLimit:0.0} deg", labelStyle);
        GUILayout.Label($"Gimbal target: Y {targetGimbalYaw:0.00} P {targetGimbalPitch:0.00}, response {gimbalResponse:0.00}", labelStyle);
        GUILayout.Label($"Gimbal actual: Y {actualGimbalYaw:0.00} P {actualGimbalPitch:0.00}, slew {FormatRate(gimbalSlewRate)}, angle {gimbalAngle:0.0}", labelStyle);
        GUILayout.EndVertical();

        GUILayout.BeginVertical(GUILayout.Width(300f));
        GUILayout.Label($"RCS: installed {(hasRcs ? "yes" : "no")}, enabled {(rcsEnabled ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"RCS tuning: move {rcsTranslationSetting:0} N, attitude {rcsAttitudeSetting:0} N", labelStyle);
        GUILayout.Label($"RCS response: up {FormatRate(rcsNozzleSpoolUp)}, down {FormatRate(rcsNozzleSpoolDown)}", labelStyle);
        GUILayout.Label($"RCS select dot: {minSelectionDot:0.00}, nozzles {activeNozzles}/{installedNozzles}", labelStyle);
        GUILayout.Label($"RCS allocator: max {rcsMaxNozzleThrottle:0.00}, sum {rcsAllocatedThrottleTotal:0.00}, applications {rcsNozzleApplications}", labelStyle);
        GUILayout.Label($"RCS fuel: req {rcsFuelRequested:0.000} kg, used {rcsFuelConsumed:0.000} kg, frac {rcsFuelFraction:0.00}", labelStyle);
        GUILayout.Label($"Precision: {(precision ? "on" : "off")}", labelStyle);
        GUILayout.Label($"Move cmd: L/R {rcsTranslation.x:0.00}, U/D {rcsTranslation.y:0.00}, F/B {rcsTranslation.z:0.00}", labelStyle);
        GUILayout.Label($"Attitude cmd: P {rcsAttitude.x:0.00}, Y {rcsAttitude.y:0.00}, R {rcsAttitude.z:0.00}", labelStyle);
        GUILayout.Label($"Turn input: {turnInput:0.00}", labelStyle);
        GUILayout.Label($"RCS pivot local: {FormatVector(rcsPivotLocal)}", labelStyle);
        GUILayout.Label($"RCS pivot world: {FormatVector(rcsPivotWorld)}", labelStyle);
        GUILayout.Label($"RCS force desired: {FormatVector(rcsDesiredForce)}", labelStyle);
        GUILayout.Label($"RCS force actual: {FormatVector(rcsActualForce)}", labelStyle);
        GUILayout.Label($"RCS force residual: {FormatVector(rcsResidualForce)}", labelStyle);
        GUILayout.Label($"RCS torque desired: {FormatVector(rcsDesiredTorque)}", labelStyle);
        GUILayout.Label($"RCS torque actual: {FormatVector(rcsActualTorque)}", labelStyle);
        GUILayout.Label($"RCS torque residual: {FormatVector(rcsResidualTorque)}", labelStyle);
        GUILayout.Label($"RCS total force: {FormatVector(rcsTotalForce)}", labelStyle);
        GUILayout.Label($"RCS translate force: {FormatVector(rcsTranslationForce)}", labelStyle);
        GUILayout.Label($"RCS torque est: {FormatVector(rcsTorque)}", labelStyle);
        GUILayout.Label($"RCS yaw torque est: {FormatVector(rcsYawTorque)}", labelStyle);
        GUILayout.Label($"Core force: {FormatVector(coreForce)}", labelStyle);
        GUILayout.Label($"Core torque: {FormatVector(coreTorque)}, applications {coreApplications}", labelStyle);
        GUILayout.Label($"Core impulse: {FormatVector(coreImpulse)} Ns, applications {coreImpulseApplications}", labelStyle);
        GUILayout.Label($"Core angular impulse: {FormatVector(coreAngularImpulse)} Ns*m", labelStyle);
        GUILayout.Label($"Impact impulse: {FormatVector(impactImpulse)} Ns, count {impactImpulseCount}", labelStyle);
        GUILayout.Label($"Impact torque impulse: {FormatVector(impactTorqueImpulse)} Ns*m", labelStyle);
        GUILayout.Label($"Atmosphere: {(atmosphereActive ? "active" : "vacuum")} density {atmosphereDensity:0.000} kg/m^3", labelStyle);
        GUILayout.Label($"Atmos drag: {FormatVector(atmosphereDragForce)} N, rel {atmosphereRelativeVelocity.magnitude:0.00} m/s", labelStyle);
        GUILayout.Label($"Atmos Cd/area: {atmosphereDragCoefficient:0.00} / {atmosphereReferenceArea:0.00} m^2", labelStyle);
        GUILayout.Label($"Gravity: {(gravityEnabled ? "on" : "off")} body {gravityBodyName}, applied {(gravityApplied ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"Gravity mu/dist: {gravityMu:0.00} / {gravityDistance:0.00} m", labelStyle);
        GUILayout.Label($"Gravity accel: {FormatVector(gravityAcceleration)} m/s^2", labelStyle);
        GUILayout.Label($"Gravity force: {FormatVector(gravityForce)} N", labelStyle);
        GUILayout.Space(4f);
        GUILayout.Label($"Nav target: {navTargetName}", labelStyle);
        GUILayout.Label($"Autopilot: {autopilotState}, {autopilotArrival}", labelStyle);
        GUILayout.Label($"Nav dist/ETA: {navDistance:0.0} m, {FormatEta(navEtaSeconds)}", labelStyle);
        GUILayout.Label($"Nav speed: closing {navClosingSpeed:0.0} m/s, lateral {navLateralSpeed:0.0} m/s", labelStyle);
        GUILayout.Label($"Nav stop/fuel: {navStoppingDistance:0.0} m, burn {FormatBurn(navAvailableBurn)} / {navRequiredBurn:0.0}s {(navFuelFeasible ? "ok" : "low")}", labelStyle);
        GUILayout.Space(4f);
        GUILayout.Label($"SAS: {(sasEnabled ? "on" : "off")} (effective {(effectiveSas ? "on" : "off")}) {sasMode}", labelStyle);
        GUILayout.Label($"SAS PD: Kp {sasProportionalGain:0.00}, Kd {sasDerivativeGain:0.00}, auth {sasAuthority:0.00}", labelStyle);
        GUILayout.Label($"SAS local w: {FormatVector(sasAngularVelocityLocal)} rad/s", labelStyle);
        GUILayout.Label($"SAS angular err: {FormatVector(sasAngularErrorLocal)} rad", labelStyle);
        GUILayout.Label($"SAS raw cmd: {FormatVector(rawSasCommand)}", labelStyle);
        GUILayout.Label($"SAS masked cmd: {FormatVector(sasCommand)}", labelStyle);
        GUILayout.Label($"SAS torque raw: {FormatVector(rawSasTorqueLocal)} Nm", labelStyle);
        GUILayout.Label($"SAS torque masked: {FormatVector(sasTorqueLocal)} Nm", labelStyle);
        GUILayout.Label($"SAS torque blocked: {FormatVector(suppressedSasTorqueLocal)} Nm", labelStyle);
        GUILayout.Label($"Assist: {flightAssistMode}{(assistDebugOnly ? " (debug-only)" : string.Empty)}", labelStyle);
        GUILayout.Label($"Assist force req: {FormatVector(assistForceWorld)} N", labelStyle);
        GUILayout.Label($"Assist torque req: {FormatVector(assistTorqueLocal)} Nm", labelStyle);
        GUILayout.Label($"Torque demand: manual {FormatVector(manualTorqueLocal)}", labelStyle);
        GUILayout.Label($"Torque demand: total {FormatVector(desiredTorqueLocal)}", labelStyle);
        GUILayout.Label($"SAS released axes: {FormatAxisMask(sasReleasedAxes)}", labelStyle);
        GUILayout.Label($"SAS manual axes: {FormatManualMask(sasManualAxes)}", labelStyle);
        GUILayout.Label($"Debug vectors: lines {(drawDebugVectors ? "on" : "off")}, gizmos {(drawDebugGizmos ? "on" : "off")}", labelStyle);
        GUILayout.Label($"Active nozzles: {Shorten(activeNozzleIds, 74)}", labelStyle);
        GUILayout.EndVertical();
        GUILayout.EndHorizontal();
        GUILayout.EndArea();
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
    }

    private static string Shorten(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return string.IsNullOrEmpty(value) ? "none" : value;
        }

        return value.Substring(0, Mathf.Max(0, maxLength - 3)) + "...";
    }


public bool DrawDebugVectors => drawDebugVectors;

    public bool DrawDebugGizmos => drawDebugGizmos;

    public void SetDrawDebugVectors(bool enabled)
    {
        drawDebugVectors = enabled;
    }

    public void SetDrawDebugGizmos(bool enabled)
    {
        drawDebugGizmos = enabled;
    }
}
