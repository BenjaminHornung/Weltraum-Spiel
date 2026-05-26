using UnityEngine;
using UnityEngine.InputSystem;

public enum RcsManeuverLayer
{
    Attitude,
    Translation
}

public enum FlightControlMode
{
    Normal,
    Precision,
    Translation
}

public enum SasControlMode
{
    KillRotation,
    HoldAttitude
}

public enum GimbalAssistMode
{
    Off,
    Low,
    Manual,
    AutopilotOnly,
    ExperimentalFull
}

public readonly struct PrototypeFlightControlDiagnostics
{
    public PrototypeFlightControlDiagnostics(
        bool rcsEnabled,
        bool rcsAvailable,
        string rcsAllocatorStatus,
        float rcsActualForceMagnitude,
        float rcsActualTorqueMagnitude,
        bool sasEnabled,
        bool effectiveSasEnabled,
        bool sasHasAuthority,
        float sasActualTorqueMagnitude,
        FlightControlMode controlMode,
        string controlModeLabel,
        float mainThrottle,
        bool mainThrusterAllowed,
        bool gimbalAllowed,
        bool autopilotEngaged,
        PrototypeWaypointAutopilotState autopilotState,
        string autopilotStatus,
        bool momentumAssistActive,
        PrototypeMomentumAssistState momentumAssistState,
        string momentumAssistStatus)
    {
        this.rcsEnabled = rcsEnabled;
        this.rcsAvailable = rcsAvailable;
        this.rcsAllocatorStatus = string.IsNullOrWhiteSpace(rcsAllocatorStatus) ? "unavailable" : rcsAllocatorStatus;
        this.rcsActualForceMagnitude = rcsActualForceMagnitude;
        this.rcsActualTorqueMagnitude = rcsActualTorqueMagnitude;
        this.sasEnabled = sasEnabled;
        this.effectiveSasEnabled = effectiveSasEnabled;
        this.sasHasAuthority = sasHasAuthority;
        this.sasActualTorqueMagnitude = sasActualTorqueMagnitude;
        this.controlMode = controlMode;
        this.controlModeLabel = string.IsNullOrWhiteSpace(controlModeLabel) ? "Cruise" : controlModeLabel;
        this.mainThrottle = mainThrottle;
        this.mainThrusterAllowed = mainThrusterAllowed;
        this.gimbalAllowed = gimbalAllowed;
        this.autopilotEngaged = autopilotEngaged;
        this.autopilotState = autopilotState;
        this.autopilotStatus = string.IsNullOrWhiteSpace(autopilotStatus) ? "unavailable" : autopilotStatus;
        this.momentumAssistActive = momentumAssistActive;
        this.momentumAssistState = momentumAssistState;
        this.momentumAssistStatus = string.IsNullOrWhiteSpace(momentumAssistStatus) ? "unavailable" : momentumAssistStatus;
    }

    public readonly bool rcsEnabled;
    public readonly bool rcsAvailable;
    public readonly string rcsAllocatorStatus;
    public readonly float rcsActualForceMagnitude;
    public readonly float rcsActualTorqueMagnitude;
    public readonly bool sasEnabled;
    public readonly bool effectiveSasEnabled;
    public readonly bool sasHasAuthority;
    public readonly float sasActualTorqueMagnitude;
    public readonly FlightControlMode controlMode;
    public readonly string controlModeLabel;
    public readonly float mainThrottle;
    public readonly bool mainThrusterAllowed;
    public readonly bool gimbalAllowed;
    public readonly bool autopilotEngaged;
    public readonly PrototypeWaypointAutopilotState autopilotState;
    public readonly string autopilotStatus;
    public readonly bool momentumAssistActive;
    public readonly PrototypeMomentumAssistState momentumAssistState;
    public readonly string momentumAssistStatus;
}

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(MainThrusterBank))]
[RequireComponent(typeof(RcsThrusterController))]
[RequireComponent(typeof(ShipPhysicsCore))]
[RequireComponent(typeof(WeaponRecoilStabilizer))]
public class PlayerShipController : MonoBehaviour
{
    [Header("Flight tuning")]
    [SerializeField] private float keyboardAttitudeStrength = 1f;
    [SerializeField] private float precisionScale = 0.35f;
    [SerializeField] private float gamepadLookSpeed = 1.6f;
    [SerializeField] private float gamepadLookDeadZone = 0.18f;

    [Header("RCS Maneuver")]
    [SerializeField] private GimbalAssistMode gimbalAssistMode = GimbalAssistMode.AutopilotOnly;
    [SerializeField] private bool invertKeyboardPitch;
    [SerializeField] private bool invertKeyboardYaw;
    [SerializeField] private bool invertKeyboardRoll;
    [SerializeField] private bool invertGamepadPitch;

    [Header("SAS")]
    [SerializeField] private SasControlMode sasMode = SasControlMode.KillRotation;

    [Header("Flight Assist")]
    [SerializeField] private FlightAssistMode flightAssistMode = FlightAssistMode.Simulation;
    [SerializeField] private bool translationAutoStopWithSas = true;
    [SerializeField] private float translationAutoStopSpeedThreshold = 0.05f;
    [SerializeField] private float translationAutoStopGain = 2.8f;
    [SerializeField] private float translationAutoStopMaxForceScale = 1.0f;

    [Header("Main Throttle")]
    [Range(0f, 1f)]
    [SerializeField] private float mainThrottle;
    [SerializeField] private float throttleChangeRate = 0.65f;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private GunModule gunModule;
    [SerializeField] private EngineVfxController engineVfx;
    [SerializeField] private MainThrusterBank mainThruster;
    [SerializeField] private RcsThrusterController rcsThrusters;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private WeaponRecoilStabilizer weaponRecoilStabilizer;

    private bool throttleUp;
    private bool throttleDown;
    private bool cutThrottle;
    private bool fullThrottle;
    private bool fire;
    private bool debugRefuel;
    private bool toggleRcs;
    private bool toggleSas;
    private bool cycleControlMode;
    private bool sasHoldInvert;
    private bool sasEnabled = true;
    private bool sasTargetRotationValid;
    private FlightControlMode controlMode = FlightControlMode.Normal;
    private RcsManeuverLayer activeRcsLayer = RcsManeuverLayer.Attitude;
    private bool rcsEnabled = true;
    private Vector3 rcsTranslationInput;
    private Vector3 attitudeInput;
    private float previousForwardSpeed;
    private Quaternion sasTargetRotation = Quaternion.identity;
    private bool hasExternalFlightAssistRequest;
    private FlightAssistRequest externalFlightAssistRequest = FlightAssistRequest.None;
    private const float SasManualTargetRefreshDeadZone = 0.05f;
    private Vector3 pendingDebugRcsTranslationPulse;
    private Vector3 pendingDebugRcsAttitudePulse;
    private float pendingDebugMainThrottlePulse;
    private PrototypeMomentumAssist momentumAssist;
    private PrototypeWaypointAutopilot waypointAutopilot;
    private const float MassPropertiesRefreshInterval = 0.25f;
    private const float MassPropertiesFuelDeltaThreshold = 0.25f;
    private float nextMassPropertiesRefreshTime;
    private float lastMassPropertiesFuelKg = -1f;
    private bool lastTranslationAutoStopActive;
    private Vector3 lastTranslationAutoStopForceWorld;
    private bool lastManualTranslationInputHeld;
    private float lastManualInputGraceUntil;
    private float lastTranslationAutoStopBlend;
    public float MainThrottle => mainThrottle;
    public float MainThrottlePercent => mainThrottle * 100f;
    public float MainThrustCommand { get; private set; }
    public float MainTargetThrottle => mainThruster != null ? mainThruster.LastTargetThrottle : MainThrustCommand;
    public float MainActualThrottle => mainThruster != null ? mainThruster.LastActualThrottle : MainThrustCommand;
    public float MainActualThrottlePercent => MainActualThrottle * 100f;
    public Vector3 RcsTranslationCommand { get; private set; }
    public Vector3 RcsAttitudeCommand { get; private set; }
    public float TurnInput { get; private set; }
    public float GimbalYawCommand { get; private set; }
    public float MainThrottleScale => mainThruster != null ? mainThruster.ThrottleScale : 0f;
    public float MainThrottleSpoolUpRate => mainThruster != null ? mainThruster.ThrottleSpoolUpRate : 0f;
    public float MainThrottleSpoolDownRate => mainThruster != null ? mainThruster.ThrottleSpoolDownRate : 0f;
    public bool GimbalEnabled => mainThruster != null && mainThruster.SupportsGimbal;
    public float GimbalLimitDegrees => mainThruster != null ? mainThruster.GimbalLimitDegrees : 0f;
    public float GimbalResponseScalar => mainThruster != null ? mainThruster.GimbalResponseScalar : 0f;
    public float GimbalSlewRateDegreesPerSecond => mainThruster != null ? mainThruster.GimbalSlewRateDegreesPerSecond : 0f;
    public float GimbalPitchCommand => mainThruster != null ? mainThruster.LastActualGimbalPitchCommand : 0f;
    public float TargetGimbalYawCommand => mainThruster != null ? mainThruster.LastTargetGimbalYawCommand : GimbalYawCommand;
    public float TargetGimbalPitchCommand => mainThruster != null ? mainThruster.LastTargetGimbalPitchCommand : 0f;
    public float ActualGimbalYawCommand => mainThruster != null ? mainThruster.LastActualGimbalYawCommand : GimbalYawCommand;
    public float ActualGimbalPitchCommand => mainThruster != null ? mainThruster.LastActualGimbalPitchCommand : 0f;
    public float LastGimbalAngleDegrees => mainThruster != null ? mainThruster.LastGimbalAngleDegrees : 0f;
    public MainThrustMode MainThrustMode => mainThruster != null ? mainThruster.ThrustMode : MainThrustMode.ComSafeSteeringOnly;
    public Vector3 LastMainThrustDirection => mainThruster != null ? mainThruster.LastAppliedDirection : transform.forward;
    public float LastMainAppliedThrust => mainThruster != null ? mainThruster.LastAppliedThrust : 0f;
    public Vector3 LastMainForceWorld => mainThruster != null ? mainThruster.LastForceWorld : Vector3.zero;
    public Vector3 LastMainStraightForceWorld => mainThruster != null ? mainThruster.LastStraightForceWorld : Vector3.zero;
    public Vector3 LastMainSteeringForceWorld => mainThruster != null ? mainThruster.LastSteeringForceWorld : Vector3.zero;
    public Vector3 LastMainForcePositionWorld => mainThruster != null ? mainThruster.LastForcePositionWorld : transform.position;
    public Vector3 LastMainThrustTorque => mainThruster != null ? mainThruster.LastEstimatedTorque : Vector3.zero;
    public Vector3 LastMainGimbalTorque => LastMainThrustTorque;
    public PrototypeThermalModule MainThermalModule => mainThruster != null ? mainThruster.ThermalModule : null;
    public bool MainThermalEnabled => mainThruster != null && mainThruster.ThermalSimulationEnabled;
    public bool MainThermalOverheated => mainThruster != null && mainThruster.IsOverheated;
    public float MainThermalEfficiency => mainThruster != null ? mainThruster.ThermalEfficiencyScalar : 1f;
    public float MainPowerDrawKw => mainThruster != null ? mainThruster.LastPowerDrawKw : 0f;
    public float RcsTranslationForceSetting => rcsThrusters != null ? rcsThrusters.TranslationForce : 0f;
    public float RcsAttitudeForceSetting => rcsThrusters != null ? rcsThrusters.AttitudeForce : 0f;
    public float RcsSasAuthority => rcsThrusters != null ? rcsThrusters.SasAuthority : 0f;
    public float RcsSasProportionalGain => rcsThrusters != null ? rcsThrusters.SasProportionalGain : 0f;
    public float RcsSasDerivativeGain => rcsThrusters != null ? rcsThrusters.SasDerivativeGain : 0f;
    public float RcsMinSelectionDot => rcsThrusters != null ? rcsThrusters.MinSelectionDot : 0f;
    public float RcsNozzleSpoolUpRate => rcsThrusters != null ? rcsThrusters.NozzleSpoolUpRate : 0f;
    public float RcsNozzleSpoolDownRate => rcsThrusters != null ? rcsThrusters.NozzleSpoolDownRate : 0f;
    public bool HasMainThruster => mainThruster != null && mainThruster.ThrusterCount > 0;
    public int MainThrusterCount => mainThruster != null ? mainThruster.ThrusterCount : 0;
    public bool HasRcs => rcsThrusters != null && rcsThrusters.HasRcs;
    public bool RcsEnabled => rcsThrusters != null ? rcsThrusters.RcsEnabled : rcsEnabled;
    public bool SasEnabled => sasEnabled;
    public bool EffectiveSasEnabled => sasEnabled ^ sasHoldInvert;
    public SasControlMode SasMode => sasMode;
    public FlightAssistMode FlightAssistMode => flightAssistMode;
    public bool HasSasTargetRotation => sasTargetRotationValid;
    public Quaternion SasTargetRotation => sasTargetRotationValid ? sasTargetRotation : transform.rotation;
    public bool LastManualFlightInput { get; private set; }
    public bool TranslationAutoStopActive => lastTranslationAutoStopActive;
    public Vector3 TranslationAutoStopForceWorld => lastTranslationAutoStopForceWorld;
    public bool ManualTranslationInputHeld => lastManualTranslationInputHeld;
    public float ManualInputGraceUntil => lastManualInputGraceUntil;
    public float TranslationAutoStopBlend => lastTranslationAutoStopBlend;
    public bool HasExternalFlightAssistRequest => hasExternalFlightAssistRequest;
    public FlightAssistRequest LastExternalFlightAssistRequest => externalFlightAssistRequest;
    public FlightAssistRequest LastFlightAssistRequest { get; private set; } = FlightAssistRequest.None;
    public Vector3 LastFlightAssistForceWorld => LastFlightAssistRequest.forceWorld;
    public Vector3 LastFlightAssistTorqueLocal => LastFlightAssistRequest.torqueLocal;
    public bool LastFlightAssistDebugOnly => LastFlightAssistRequest.debugOnlyNonPhysical;
    public Vector3 LastWeaponRecoilImpulseWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponRecoilImpulseWorld : Vector3.zero;
    public Vector3 LastWeaponRecoilPositionWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponRecoilPositionWorld : transform.position;
    public Vector3 LastWeaponRecoilAngularImpulseWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastEstimatedRecoilAngularImpulseWorld : Vector3.zero;
    public Vector3 LastWeaponStabilizationTorqueRequestWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponStabilizationTorqueRequestWorld : Vector3.zero;
    public Vector3 LastWeaponStabilizationTorqueRequestLocal => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponStabilizationTorqueRequestLocal : Vector3.zero;
    public Vector3 LastWeaponStabilizationActualRcsTorqueWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponStabilizationActualRcsTorqueWorld : Vector3.zero;
    public Vector3 LastWeaponStabilizationResidualRcsTorqueWorld => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponStabilizationResidualRcsTorqueWorld : Vector3.zero;
    public string LastWeaponStabilizationStatus => weaponRecoilStabilizer != null ? weaponRecoilStabilizer.LastWeaponStabilizationStatus : "unavailable";
    public bool WeaponStabilizationActive => weaponRecoilStabilizer != null && weaponRecoilStabilizer.LastWeaponStabilizationRequestActive;
    public FlightControlMode ControlMode => controlMode;
    public string ControlModeLabel => controlMode switch
    {
        FlightControlMode.Precision => "Precision",
        FlightControlMode.Translation => "Translation",
        _ => "Cruise"
    };
    public bool MainThrusterAllowed => controlMode == FlightControlMode.Normal;
    public bool GimbalAllowed => controlMode == FlightControlMode.Normal;
    public bool RcsManeuverMode => controlMode != FlightControlMode.Normal;
    public RcsManeuverLayer ActiveRcsLayer => activeRcsLayer;
    public string ActiveRcsLayerLabel => activeRcsLayer.ToString();
    public bool IsRcsTranslationLayerActive => controlMode == FlightControlMode.Translation;
    public bool PrecisionControls => controlMode == FlightControlMode.Precision;
    public GimbalAssistMode GimbalAssistMode => gimbalAssistMode;
    public bool InvertKeyboardPitch => invertKeyboardPitch;
    public bool InvertKeyboardYaw => invertKeyboardYaw;
    public bool InvertKeyboardRoll => invertKeyboardRoll;
    public bool InvertGamepadPitch => invertGamepadPitch;
    public float LastForwardAcceleration { get; private set; }
    public Vector3 RcsControlPivotLocal => rcsThrusters != null ? rcsThrusters.ControlPivotLocal : Vector3.zero;
    public Vector3 RcsControlPivotWorld => rcsThrusters != null ? rcsThrusters.ControlPivotWorld : transform.position;
    public Vector3 LastRcsForce => rcsThrusters != null ? rcsThrusters.LastForceAtPositionTotal : Vector3.zero;
    public Vector3 LastRcsTranslationForce => rcsThrusters != null ? rcsThrusters.LastTranslationForce : Vector3.zero;
    public Vector3 LastRcsDesiredForceWorld => rcsThrusters != null ? rcsThrusters.LastDesiredRcsForceWorld : Vector3.zero;
    public Vector3 LastRcsActualForceWorld => rcsThrusters != null ? rcsThrusters.LastActualRcsForceWorld : Vector3.zero;
    public Vector3 LastRcsResidualForceWorld => rcsThrusters != null ? rcsThrusters.LastResidualRcsForceWorld : Vector3.zero;
    public Vector3 LastRcsDesiredTorqueWorld => rcsThrusters != null ? rcsThrusters.LastDesiredRcsTorqueWorld : Vector3.zero;
    public Vector3 LastRcsActualTorqueWorld => rcsThrusters != null ? rcsThrusters.LastActualRcsTorqueWorld : Vector3.zero;
    public Vector3 LastRcsResidualTorqueWorld => rcsThrusters != null ? rcsThrusters.LastResidualRcsTorqueWorld : Vector3.zero;
    public Vector3 LastRcsTorque => rcsThrusters != null ? rcsThrusters.LastTorque : Vector3.zero;
    public Vector3 LastRcsYawTorque => rcsThrusters != null ? rcsThrusters.LastYawTorqueEstimate : Vector3.zero;
    public int InstalledRcsNozzleCount => rcsThrusters != null ? rcsThrusters.InstalledNozzleCount : 0;
    public int ActiveRcsNozzleCount => rcsThrusters != null ? rcsThrusters.ActiveNozzleCount : 0;
    public string ActiveRcsNozzleIds => rcsThrusters != null ? rcsThrusters.ActiveNozzleIds : string.Empty;
    public float LastRcsMaxNozzleThrottle => rcsThrusters != null ? rcsThrusters.LastMaxNozzleThrottle : 0f;
    public float LastRcsAllocatedNozzleThrottleTotal => rcsThrusters != null ? rcsThrusters.LastAllocatedNozzleThrottleTotal : 0f;
    public int LastRcsNozzleApplicationCount => rcsThrusters != null ? rcsThrusters.LastNozzleApplicationCount : 0;
    public int LastRcsSaturatedNozzleCount => rcsThrusters != null ? rcsThrusters.LastSaturatedNozzleCount : 0;
    public string LastRcsAllocatorStatus => rcsThrusters != null ? rcsThrusters.LastAllocatorStatus : "unavailable";
    public float LastRcsFuelRequestedKg => rcsThrusters != null ? rcsThrusters.LastFuelRequestedKg : 0f;
    public float LastRcsFuelConsumedKg => rcsThrusters != null ? rcsThrusters.LastFuelConsumedKg : 0f;
    public float LastRcsFuelFraction => rcsThrusters != null ? rcsThrusters.LastAppliedFuelFraction : 1f;
    public Vector3 LastRawRcsSasCommand => rcsThrusters != null ? rcsThrusters.LastRawSasCommand : Vector3.zero;
    public Vector3 LastRcsSasReleasedAxes => rcsThrusters != null ? rcsThrusters.LastSasReleasedAxes : Vector3.one;
    public Vector3 LastRcsSasManualOverrideAxes => rcsThrusters != null ? rcsThrusters.LastSasManualOverrideAxes : Vector3.zero;
    public Vector3 LastRcsSasAngularVelocityLocal => rcsThrusters != null ? rcsThrusters.LastSasAngularVelocityLocal : Vector3.zero;
    public Vector3 LastRcsSasAngularErrorLocal => rcsThrusters != null ? rcsThrusters.LastSasAngularErrorLocal : Vector3.zero;
    public Vector3 LastRawRcsSasDesiredTorqueLocal => rcsThrusters != null ? rcsThrusters.LastRawSasDesiredTorqueLocal : Vector3.zero;
    public Vector3 LastRcsSasDesiredTorqueLocal => rcsThrusters != null ? rcsThrusters.LastSasDesiredTorqueLocal : Vector3.zero;
    public Vector3 LastRcsManualDesiredTorqueLocal => rcsThrusters != null ? rcsThrusters.LastManualDesiredTorqueLocal : Vector3.zero;
    public Vector3 LastRcsDesiredTorqueLocal => rcsThrusters != null ? rcsThrusters.LastDesiredTorqueLocal : Vector3.zero;
    public Vector3 LastRcsSasSuppressedTorqueLocal => rcsThrusters != null ? rcsThrusters.LastSasSuppressedTorqueLocal : Vector3.zero;
    public Vector3 LastRcsSasCommand => rcsThrusters != null ? rcsThrusters.LastSasCommand : Vector3.zero;
    public Vector3 LastCoreAppliedForce => physicsCore != null ? physicsCore.NetAppliedForce : Vector3.zero;
    public Vector3 LastCoreAppliedTorque => physicsCore != null ? physicsCore.NetAppliedTorque : Vector3.zero;
    public Vector3 LastCoreAppliedImpulse => physicsCore != null ? physicsCore.NetAppliedImpulse : Vector3.zero;
    public Vector3 LastCoreAppliedAngularImpulse => physicsCore != null ? physicsCore.NetAppliedAngularImpulse : Vector3.zero;
    public int LastCoreAppliedForceCount => physicsCore != null ? physicsCore.AppliedForceCount : 0;
    public int LastCoreAppliedImpulseCount => physicsCore != null ? physicsCore.AppliedImpulseCount : 0;
    public bool GravityEnabled => physicsCore != null && physicsCore.CentralGravityEnabled;
    public string LastGravityBodyName => physicsCore != null ? physicsCore.LastGravityBodyName : "none";
    public float GravityMu => physicsCore != null ? physicsCore.CentralGravityMu : 0f;
    public float LastGravityDistance => physicsCore != null ? physicsCore.LastGravityDistance : 0f;
    public Vector3 LastGravityAcceleration => physicsCore != null ? physicsCore.LastGravityAcceleration : Vector3.zero;
    public Vector3 LastGravityForce => physicsCore != null ? physicsCore.LastGravityForce : Vector3.zero;
    public bool LastGravityApplied => physicsCore != null && physicsCore.LastGravityApplied;
    public PrototypeFlightControlDiagnostics FlightControlDiagnostics
    {
        get
        {
            return new PrototypeFlightControlDiagnostics(
                RcsEnabled,
                HasRcs,
                LastRcsAllocatorStatus,
                LastRcsActualForceWorld.magnitude,
                LastRcsActualTorqueWorld.magnitude,
                SasEnabled,
                EffectiveSasEnabled,
                RcsEnabled && HasRcs && RcsSasAuthority > 0f,
                LastRcsSasDesiredTorqueLocal.magnitude,
                ControlMode,
                ControlModeLabel,
                MainThrottle,
                MainThrusterAllowed,
                GimbalAllowed,
                waypointAutopilot != null && waypointAutopilot.AutopilotEngaged,
                waypointAutopilot != null ? waypointAutopilot.CurrentState : PrototypeWaypointAutopilotState.Idle,
                waypointAutopilot != null ? waypointAutopilot.ArrivalStatus : "unavailable",
                momentumAssist != null && momentumAssist.IsActive,
                momentumAssist != null ? momentumAssist.CurrentState : PrototypeMomentumAssistState.Idle,
                momentumAssist != null ? momentumAssist.StatusLabel : "unavailable");
        }
    }

    private void Awake()
    {
        ResolveReferences();
        ConfigureRigidbody();
        ApplyRcsEnabledState();
        RefreshMassProperties(force: true);
    }

    private void Start()
    {
        RefreshMassProperties(force: true);
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

        if (gunModule == null)
        {
            gunModule = GetComponent<GunModule>();
        }

        if (engineVfx == null)
        {
            engineVfx = GetComponent<EngineVfxController>();
        }

        if (mainThruster == null)
        {
            mainThruster = GetComponent<MainThrusterBank>();
        }

        if (rcsThrusters == null)
        {
            rcsThrusters = GetComponent<RcsThrusterController>();
        }

        if (physicsCore == null)
        {
            physicsCore = GetComponent<ShipPhysicsCore>();
        }

        if (weaponRecoilStabilizer == null)
        {
            weaponRecoilStabilizer = GetComponent<WeaponRecoilStabilizer>();
            if (weaponRecoilStabilizer == null)
            {
                weaponRecoilStabilizer = gameObject.AddComponent<WeaponRecoilStabilizer>();
            }
        }

        if (weaponRecoilStabilizer != null)
        {
            weaponRecoilStabilizer.Configure(shipRigidbody);
        }

        if (waypointAutopilot == null)
        {
            waypointAutopilot = GetComponent<PrototypeWaypointAutopilot>();
        }
        if (momentumAssist == null)
        {
            momentumAssist = GetComponent<PrototypeMomentumAssist>();
        }
    }

    private void ConfigureRigidbody()
    {
        if (shipRigidbody == null)
        {
            return;
        }

        shipRigidbody.useGravity = false;
        shipRigidbody.linearDamping = 0f;
        shipRigidbody.angularDamping = 0f;
        shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;
    }

    private void RefreshMassProperties(bool force)
    {
        if (shipRigidbody == null || shipStats == null)
        {
            return;
        }

        bool timeExpired = Time.time >= nextMassPropertiesRefreshTime;
        bool significantFuelDelta = lastMassPropertiesFuelKg < 0f
            || Mathf.Abs(shipStats.CurrentFuelKg - lastMassPropertiesFuelKg) >= MassPropertiesFuelDeltaThreshold;

        if (!force && !timeExpired && !significantFuelDelta)
        {
            return;
        }

        shipStats.ApplyMassProperties(shipRigidbody);
        lastMassPropertiesFuelKg = shipStats.CurrentFuelKg;
        nextMassPropertiesRefreshTime = Time.time + MassPropertiesRefreshInterval;
    }

    private void Update()
    {
        if (shipRigidbody == null || shipStats == null || gunModule == null || engineVfx == null || mainThruster == null || rcsThrusters == null)
        {
            ResolveReferences();
            ConfigureRigidbody();
            if (shipRigidbody == null || shipStats == null)
            {
                return;
            }
        }

        PollInput();
        UpdateMainThrottle(Time.deltaTime);
        HandleUtilityInputs();

        if (fire)
        {
            if (gunModule == null)
            {
                ResolveReferences();
            }

            if (gunModule != null)
            {
                gunModule.TryFire();
            }
        }
    }

    private void FixedUpdate()
    {
        if (shipRigidbody == null || shipStats == null || mainThruster == null || rcsThrusters == null)
        {
            ResolveReferences();
            if (shipRigidbody == null || shipStats == null)
            {
                return;
            }
        }

        RefreshMassProperties(force: false);

        if (physicsCore != null)
        {
            physicsCore.BeginPhysicsStep();
            physicsCore.ApplyEnvironmentForces();
        }

        float controlScale = 1f;
        Vector3 combinedTranslationInput = rcsTranslationInput + pendingDebugRcsTranslationPulse;
        Vector3 combinedAttitudeInput = attitudeInput + pendingDebugRcsAttitudePulse;
        float mainThrottlePulse = pendingDebugMainThrottlePulse;
        pendingDebugRcsTranslationPulse = Vector3.zero;
        pendingDebugRcsAttitudePulse = Vector3.zero;
        pendingDebugMainThrottlePulse = 0f;
        if (IsControlModeRcsForced)
        {
            rcsEnabled = true;
            ApplyRcsEnabledState();
        }
        RcsTranslationCommand = Vector3.ClampMagnitude(combinedTranslationInput, 1f) * controlScale;
        RcsAttitudeCommand = Vector3.ClampMagnitude(combinedAttitudeInput, 1f) * controlScale;
        lastManualTranslationInputHeld = RcsTranslationCommand.sqrMagnitude > 0.0001f;
        if (lastManualTranslationInputHeld)
        {
            lastManualInputGraceUntil = Time.time;
        }

        TurnInput = Mathf.Clamp(RcsAttitudeCommand.y, -1f, 1f);
        UpdateSasTargetRotation(RcsAttitudeCommand);
        if (HasManualControlOverride(RcsTranslationCommand, RcsAttitudeCommand, mainThrottlePulse))
        {
            ClearExternalFlightAssistRequest();
        }

        LastFlightAssistRequest = BuildFlightAssistRequest();

        if (rcsThrusters != null)
        {
            rcsThrusters.ApplyControls(
                RcsTranslationCommand,
                RcsAttitudeCommand,
                EffectiveSasEnabled,
                sasMode,
                SasTargetRotation,
                HasSasTargetRotation,
                LastFlightAssistRequest,
                Time.fixedDeltaTime);
            if (weaponRecoilStabilizer != null)
            {
                weaponRecoilStabilizer.RecordRcsDiagnostics(
                    rcsThrusters.LastActualRcsTorqueWorld,
                    rcsThrusters.LastResidualRcsTorqueWorld,
                    rcsThrusters.LastAllocatorStatus);
            }
        }

        bool assistOwnsMainThrottle = CanAssistRequestMainThrottle(LastFlightAssistRequest)
            && LastFlightAssistRequest.mainThrottle > 0.0001f;
        float assistMainThrottle = assistOwnsMainThrottle ? LastFlightAssistRequest.mainThrottle : 0f;
        bool canFireMainThruster = MainThrusterAllowed || assistOwnsMainThrottle;
        MainThrustCommand = canFireMainThruster ? Mathf.Clamp01(Mathf.Max(mainThrottle, mainThrottlePulse, assistMainThrottle)) : 0f;
        Vector3 desiredGimbalCommand = GetGimbalAssistCommand();
        GimbalYawCommand = desiredGimbalCommand.y;
        float gimbalPitchCommand = desiredGimbalCommand.x;

        float appliedThrust = 0f;
        if (mainThruster != null)
        {
            appliedThrust = mainThruster.Fire(MainThrustCommand, GimbalYawCommand, gimbalPitchCommand, Time.fixedDeltaTime);
        }

        float forwardSpeed = Vector3.Dot(shipRigidbody.linearVelocity, transform.forward);
        LastForwardAcceleration = Time.fixedDeltaTime > 0.0001f ? (forwardSpeed - previousForwardSpeed) / Time.fixedDeltaTime : 0f;
        previousForwardSpeed = forwardSpeed;
        float actualThrottle = mainThruster != null ? mainThruster.LastActualThrottle : MainThrustCommand;
        shipStats.RecordFlightTelemetry(actualThrottle, appliedThrust, LastForwardAcceleration);

        if (engineVfx != null)
        {
            engineVfx.SetThrottle(appliedThrust > 0f ? actualThrottle : 0f);
        }
    }

    private void PollInput()
    {
        throttleUp = false;
        throttleDown = false;
        cutThrottle = false;
        fullThrottle = false;
        fire = false;
        debugRefuel = false;
        toggleRcs = false;
        toggleSas = false;
        cycleControlMode = false;
        sasHoldInvert = false;
        rcsTranslationInput = Vector3.zero;
        attitudeInput = Vector3.zero;

        Keyboard keyboard = Keyboard.current;
        Gamepad gamepad = Gamepad.current;

        if (keyboard != null)
        {
            throttleUp |= MainThrusterAllowed && keyboard.leftShiftKey.isPressed;
            throttleDown |= MainThrusterAllowed && (keyboard.leftCtrlKey.isPressed || keyboard.rightCtrlKey.isPressed);

            cutThrottle |= keyboard.xKey.wasPressedThisFrame;
            fullThrottle |= keyboard.yKey.wasPressedThisFrame || keyboard.zKey.wasPressedThisFrame;
            fire |= keyboard.spaceKey.isPressed;
            debugRefuel |= keyboard.backspaceKey.wasPressedThisFrame;
            toggleRcs |= keyboard.rKey.wasPressedThisFrame;
            toggleSas |= keyboard.tKey.wasPressedThisFrame;
            cycleControlMode |= keyboard.capsLockKey.wasPressedThisFrame;
            sasHoldInvert |= keyboard.fKey.isPressed;

            ApplyKeyboardFlightKeys(
                keyboard.wKey.isPressed,
                keyboard.sKey.isPressed,
                keyboard.aKey.isPressed,
                keyboard.dKey.isPressed,
                keyboard.qKey.isPressed,
                keyboard.eKey.isPressed,
                keyboard.hKey.isPressed,
                keyboard.nKey.isPressed,
                keyboard.iKey.isPressed,
                keyboard.kKey.isPressed,
                keyboard.jKey.isPressed,
                keyboard.lKey.isPressed);
        }

        if (gamepad != null)
        {
            Vector2 left = gamepad.leftStick.ReadValue();
            Vector2 right = gamepad.rightStick.ReadValue();
            float rightTrigger = gamepad.rightTrigger.ReadValue();
            float leftTrigger = gamepad.leftTrigger.ReadValue();

            throttleUp |= MainThrusterAllowed && rightTrigger > 0.1f;
            throttleDown |= MainThrusterAllowed && leftTrigger > 0.1f;
            fire |= gamepad.aButton.isPressed;
            toggleRcs |= gamepad.xButton.wasPressedThisFrame;
            toggleSas |= gamepad.yButton.wasPressedThisFrame;

            if (right.sqrMagnitude > gamepadLookDeadZone * gamepadLookDeadZone)
            {
                float gamepadPitchDirection = invertGamepadPitch ? -1f : 1f;
                attitudeInput.x += -right.y * gamepadLookSpeed * gamepadPitchDirection;
                attitudeInput.y += right.x * gamepadLookSpeed;
            }

            if (left.sqrMagnitude > gamepadLookDeadZone * gamepadLookDeadZone)
            {
                rcsTranslationInput.x += left.x;
                rcsTranslationInput.y += left.y;
            }

            if (gamepad.leftShoulder.isPressed)
            {
                attitudeInput.z -= keyboardAttitudeStrength;
            }

            if (gamepad.rightShoulder.isPressed)
            {
                attitudeInput.z += keyboardAttitudeStrength;
            }
        }
        activeRcsLayer = controlMode == FlightControlMode.Translation ? RcsManeuverLayer.Translation : RcsManeuverLayer.Attitude;

        LastManualFlightInput = throttleUp
            || throttleDown
            || cutThrottle
            || fullThrottle
            || rcsTranslationInput.sqrMagnitude > 0.0001f
            || attitudeInput.sqrMagnitude > 0.0001f;
    }

    private void UpdateMainThrottle(float deltaTime)
    {
        if (!MainThrusterAllowed)
        {
            mainThrottle = 0f;
            return;
        }

        if (cutThrottle)
        {
            mainThrottle = 0f;
            return;
        }

        if (fullThrottle)
        {
            mainThrottle = 1f;
            return;
        }

        float throttleDelta = 0f;
        if (throttleUp)
        {
            throttleDelta += throttleChangeRate * deltaTime;
        }

        if (throttleDown)
        {
            throttleDelta -= throttleChangeRate * deltaTime;
        }

        mainThrottle = Mathf.Clamp01(mainThrottle + throttleDelta);
    }

    private void HandleUtilityInputs()
    {
        if (toggleRcs)
        {
            rcsEnabled = !RcsEnabled;
            if (IsControlModeRcsForced)
            {
                rcsEnabled = true;
            }
            ApplyRcsEnabledState();
        }

        if (toggleSas)
        {
            sasEnabled = !sasEnabled;
            if (sasEnabled)
            {
                CaptureSasTargetRotation();
            }
        }

        if (cycleControlMode)
        {
            CycleControlMode();
        }

        if (debugRefuel)
        {
            RefuelFull();
        }
    }

    private void ApplyRcsEnabledState()
    {
        if (rcsThrusters != null)
        {
            rcsThrusters.SetRcsEnabled(IsControlModeRcsForced || rcsEnabled);
        }
    }

    private bool IsControlModeRcsForced => controlMode == FlightControlMode.Precision || controlMode == FlightControlMode.Translation;

    private void ApplyKeyboardFlightKeys(
        bool w,
        bool s,
        bool a,
        bool d,
        bool q,
        bool e,
        bool h,
        bool n,
        bool i,
        bool k,
        bool j,
        bool l)
    {
        float keyboardPitchDirection = invertKeyboardPitch ? 1f : -1f;
        float keyboardYawDirection = invertKeyboardYaw ? -1f : 1f;
        float keyboardRollDirection = invertKeyboardRoll ? -1f : 1f;

        activeRcsLayer = controlMode == FlightControlMode.Translation ? RcsManeuverLayer.Translation : RcsManeuverLayer.Attitude;

        if (controlMode == FlightControlMode.Translation)
        {
            if (w) rcsTranslationInput.z += 1f;
            if (s) rcsTranslationInput.z -= 1f;
            if (a) rcsTranslationInput.x -= 1f;
            if (d) rcsTranslationInput.x += 1f;
            if (h) rcsTranslationInput.y += 1f;
            if (n) rcsTranslationInput.y -= 1f;
        }
        else
        {
            if (w) attitudeInput.x += keyboardAttitudeStrength * keyboardPitchDirection;
            if (s) attitudeInput.x -= keyboardAttitudeStrength * keyboardPitchDirection;
            if (a) attitudeInput.y -= keyboardAttitudeStrength * keyboardYawDirection;
            if (d) attitudeInput.y += keyboardAttitudeStrength * keyboardYawDirection;

            if (h)
            {
                if (controlMode == FlightControlMode.Precision)
                {
                    rcsTranslationInput.y += 1f;
                }
                else
                {
                    rcsTranslationInput.z += 1f;
                }
            }

            if (n)
            {
                if (controlMode == FlightControlMode.Precision)
                {
                    rcsTranslationInput.y -= 1f;
                }
                else
                {
                    rcsTranslationInput.z -= 1f;
                }
            }
        }

        if (q) attitudeInput.z -= keyboardAttitudeStrength * keyboardRollDirection;
        if (e) attitudeInput.z += keyboardAttitudeStrength * keyboardRollDirection;
        if (i) rcsTranslationInput.y -= 1f;
        if (k) rcsTranslationInput.y += 1f;
        if (j) rcsTranslationInput.x -= 1f;
        if (l) rcsTranslationInput.x += 1f;
    }

    public void SetSasMode(SasControlMode mode)
    {
        sasMode = mode;
        CaptureSasTargetRotation();
    }

    public void CaptureSasTargetRotation()
    {
        sasTargetRotation = transform.rotation;
        sasTargetRotationValid = true;
    }

    public void SetSasTargetRotation(Quaternion targetRotation)
    {
        if (!TrajectoryPredictionMath.IsFinite(targetRotation))
        {
            return;
        }

        sasTargetRotation = targetRotation;
        sasTargetRotationValid = true;
    }

    private void UpdateSasTargetRotation(Vector3 manualAttitudeCommand)
    {
        if (sasMode != SasControlMode.HoldAttitude)
        {
            if (!sasTargetRotationValid)
            {
                CaptureSasTargetRotation();
            }

            return;
        }

        if (!EffectiveSasEnabled || !sasTargetRotationValid || manualAttitudeCommand.sqrMagnitude > SasManualTargetRefreshDeadZone * SasManualTargetRefreshDeadZone)
        {
            CaptureSasTargetRotation();
        }
    }

    private FlightAssistRequest BuildFlightAssistRequest()
    {
        return CombineWithWeaponStabilization(BuildBaseFlightAssistRequest());
    }

    private bool HasManualControlOverride(Vector3 translationCommand, Vector3 attitudeCommand, float mainThrottlePulse)
    {
        return translationCommand.sqrMagnitude > 0.0001f
            || attitudeCommand.sqrMagnitude > 0.0001f
            || mainThrottlePulse > 0.0001f
            || throttleUp
            || throttleDown
            || cutThrottle
            || fullThrottle;
    }

    private FlightAssistRequest BuildBaseFlightAssistRequest()
    {
        lastTranslationAutoStopActive = false;
        lastTranslationAutoStopForceWorld = Vector3.zero;
        lastTranslationAutoStopBlend = 0f;

        if (hasExternalFlightAssistRequest)
        {
            return externalFlightAssistRequest;
        }

        if (ShouldApplyTranslationAutoStop())
        {
            float maxForce = GetTranslationAutoStopMaxForce();
            Vector3 requestForceWorld = Vector3.ClampMagnitude(
                -shipRigidbody.linearVelocity * Mathf.Max(1f, shipRigidbody.mass) * translationAutoStopGain,
                maxForce);
            lastTranslationAutoStopActive = true;
            lastTranslationAutoStopForceWorld = requestForceWorld;
            lastTranslationAutoStopBlend = maxForce > 0.0001f
                ? Mathf.Clamp01(requestForceWorld.magnitude / maxForce)
                : 0f;
            return new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.Sas,
                requestForceWorld,
                Vector3.zero,
                false);
        }

        switch (flightAssistMode)
        {
            case FlightAssistMode.AssistedFlight:
            case FlightAssistMode.DebugAssist:
                return new FlightAssistRequest(
                    flightAssistMode,
                    flightAssistMode == FlightAssistMode.DebugAssist ? FlightAssistRequestSource.DebugOnly : FlightAssistRequestSource.FlightAssist,
                    Vector3.zero,
                    Vector3.zero,
                    flightAssistMode == FlightAssistMode.DebugAssist);
            default:
                return FlightAssistRequest.None;
        }
    }

    private FlightAssistRequest CombineWithWeaponStabilization(FlightAssistRequest baseRequest)
    {
        if (weaponRecoilStabilizer == null)
        {
            return baseRequest;
        }

        FlightAssistRequest weaponRequest = weaponRecoilStabilizer.BuildFlightAssistRequest(
            transform,
            EffectiveSasEnabled,
            RcsEnabled,
            HasRcs,
            Time.fixedDeltaTime);
        if (!weaponRequest.HasAnyRequest)
        {
            return baseRequest;
        }

        if (!baseRequest.HasAnyRequest)
        {
            return weaponRequest;
        }

        Vector3 forceWorld = baseRequest.HasPhysicalRequest ? baseRequest.forceWorld : Vector3.zero;
        Vector3 torqueLocal = baseRequest.HasPhysicalRequest ? baseRequest.torqueLocal : Vector3.zero;
        return new FlightAssistRequest(
            baseRequest.mode == FlightAssistMode.Simulation ? weaponRequest.mode : baseRequest.mode,
            baseRequest.source == FlightAssistRequestSource.None ? weaponRequest.source : baseRequest.source,
            forceWorld + weaponRequest.forceWorld,
            torqueLocal + weaponRequest.torqueLocal,
            Mathf.Max(baseRequest.mainThrottle, weaponRequest.mainThrottle),
            false);
    }

    public void SetExternalFlightAssistRequest(FlightAssistRequest request)
    {
        hasExternalFlightAssistRequest = true;
        externalFlightAssistRequest = request;
    }

    public void ClearExternalFlightAssistRequest()
    {
        hasExternalFlightAssistRequest = false;
        externalFlightAssistRequest = FlightAssistRequest.None;
    }

    public void ClearManualFlightInputForAssist()
    {
        LastManualFlightInput = false;
    }

    private void OnValidate()
    {
        mainThrottle = Mathf.Clamp01(mainThrottle);
        throttleChangeRate = Mathf.Max(0f, throttleChangeRate);
        precisionScale = Mathf.Clamp01(precisionScale);
        translationAutoStopSpeedThreshold = Mathf.Max(0f, translationAutoStopSpeedThreshold);
        translationAutoStopGain = Mathf.Max(0f, translationAutoStopGain);
        translationAutoStopMaxForceScale = Mathf.Max(0f, translationAutoStopMaxForceScale);
    }

    private bool ShouldApplyTranslationAutoStop()
    {
        if (!translationAutoStopWithSas || controlMode != FlightControlMode.Translation || shipRigidbody == null || RcsTranslationCommand.sqrMagnitude > 0.0001f)
        {
            return false;
        }

        if (!RcsEnabled || !HasRcs || !EffectiveSasEnabled)
        {
            return false;
        }

        if (shipRigidbody.linearVelocity.magnitude <= translationAutoStopSpeedThreshold)
        {
            return false;
        }

        return true;
    }

    private float GetTranslationAutoStopMaxForce()
    {
        return Mathf.Max(0f, RcsTranslationForceSetting * translationAutoStopMaxForceScale);
    }

    private static bool CanAssistRequestMainThrottle(FlightAssistRequest request)
    {
        return request.source == FlightAssistRequestSource.WaypointAutopilot
            || request.source == FlightAssistRequestSource.MomentumAssist;
    }


    public void SetRcsEnabled(bool enabled)
    {
        rcsEnabled = enabled;
        ApplyRcsEnabledState();
    }

    public void SetSasEnabled(bool enabled)
    {
        sasEnabled = enabled;
        if (sasEnabled)
        {
            CaptureSasTargetRotation();
        }
    }

    public void SetPrecisionControls(bool enabled)
    {
        SetControlMode(enabled ? FlightControlMode.Precision : FlightControlMode.Normal);
    }

    public void SetRcsManeuverMode(bool enabled)
    {
        SetControlMode(enabled ? FlightControlMode.Precision : FlightControlMode.Normal);
    }

    public void SetControlMode(FlightControlMode mode)
    {
        controlMode = mode;
        activeRcsLayer = controlMode == FlightControlMode.Translation ? RcsManeuverLayer.Translation : RcsManeuverLayer.Attitude;
        if (IsControlModeRcsForced)
        {
            mainThrottle = 0f;
            MainThrustCommand = 0f;
            GimbalYawCommand = 0f;
            rcsEnabled = true;
        }

        ApplyRcsEnabledState();
    }

    public void CycleControlMode()
    {
        SetControlMode(controlMode switch
        {
            FlightControlMode.Normal => FlightControlMode.Precision,
            FlightControlMode.Precision => FlightControlMode.Translation,
            _ => FlightControlMode.Normal
        });
    }

    public void ApplyModeSpecificInputForTests(bool w, bool s, bool a, bool d, bool q, bool e, bool h, bool n, bool shift, bool ctrl)
    {
        rcsTranslationInput = Vector3.zero;
        attitudeInput = Vector3.zero;
        throttleUp = MainThrusterAllowed && shift;
        throttleDown = MainThrusterAllowed && ctrl;
        ApplyKeyboardFlightKeys(w, s, a, d, q, e, h, n, false, false, false, false);
        RcsTranslationCommand = Vector3.ClampMagnitude(rcsTranslationInput, 1f);
        RcsAttitudeCommand = Vector3.ClampMagnitude(attitudeInput, 1f);
    }

    public void SetGimbalAssistMode(GimbalAssistMode mode)
    {
        gimbalAssistMode = mode;
    }

    public void SetInvertKeyboardPitch(bool invert)
    {
        invertKeyboardPitch = invert;
    }

    public void SetInvertKeyboardYaw(bool invert)
    {
        invertKeyboardYaw = invert;
    }

    public void SetInvertKeyboardRoll(bool invert)
    {
        invertKeyboardRoll = invert;
    }

    public void SetInvertGamepadPitch(bool invert)
    {
        invertGamepadPitch = invert;
    }

    private Vector3 GetGimbalAssistCommand()
    {
        if (!GimbalEnabled)
        {
            return Vector3.zero;
        }

        if (!GimbalAllowed || MainThrustCommand <= 0f)
        {
            return Vector3.zero;
        }

        Vector3 yawPitchInput = new Vector3(Mathf.Clamp(RcsAttitudeCommand.x, -1f, 1f), Mathf.Clamp(RcsAttitudeCommand.y, -1f, 1f), 0f);

        switch (gimbalAssistMode)
        {
            case GimbalAssistMode.Off:
                return Vector3.zero;
            case GimbalAssistMode.Low:
                return yawPitchInput * 0.32f;
            case GimbalAssistMode.AutopilotOnly:
            case GimbalAssistMode.ExperimentalFull:
                Vector3 autopilotAssist = GetAutopilotGimbalAssist();
                if (gimbalAssistMode == GimbalAssistMode.AutopilotOnly)
                {
                    return autopilotAssist;
                }

                return Vector3.ClampMagnitude(yawPitchInput + autopilotAssist, 1f);
            case GimbalAssistMode.Manual:
            default:
                return yawPitchInput;
        }
    }

    private Vector3 GetAutopilotGimbalAssist()
    {
        if (!EffectiveSasEnabled || shipRigidbody == null)
        {
            return Vector3.zero;
        }

        Vector3 angularVelocityLocal = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        if (angularVelocityLocal.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        Vector3 dampingCommand = new Vector3(-angularVelocityLocal.x, -angularVelocityLocal.y, 0f);
        return Vector3.ClampMagnitude(dampingCommand * 0.15f, 1f);
    }

    public void SetFlightAssistMode(FlightAssistMode mode)
    {
        flightAssistMode = mode;
    }

    public void SetMainThrustMode(MainThrustMode mode)
    {
        if (mainThruster == null)
        {
            ResolveReferences();
        }

        if (mainThruster != null)
        {
            mainThruster.SetThrustMode(mode);
        }
    }

    public void SetMainThrottle(float normalizedThrottle)
    {
        mainThrottle = MainThrusterAllowed ? Mathf.Clamp01(normalizedThrottle) : 0f;
    }

    public void CutMainThrottle()
    {
        SetMainThrottle(0f);
    }

    public void FullMainThrottle()
    {
        SetMainThrottle(1f);
    }

    public void RefuelFull()
    {
        if (shipStats == null)
        {
            ResolveReferences();
        }

        if (shipStats != null)
        {
            shipStats.RefillFuelFull();
            RefreshMassProperties(force: true);
        }
    }

    public void ResetPosition()
    {
        ResetFlightState(Vector3.zero, Quaternion.identity, true);
    }

    public void ResetFlightState(Vector3 position, Quaternion rotation, bool cutMainThrottle)
    {
        if (shipRigidbody == null)
        {
            ResolveReferences();
        }

        if (cutMainThrottle)
        {
            mainThrottle = 0f;
            MainThrustCommand = 0f;
            pendingDebugMainThrottlePulse = 0f;
        }

        pendingDebugRcsTranslationPulse = Vector3.zero;
        pendingDebugRcsAttitudePulse = Vector3.zero;
        RcsTranslationCommand = Vector3.zero;
        RcsAttitudeCommand = Vector3.zero;
        TurnInput = 0f;
        GimbalYawCommand = 0f;
        LastForwardAcceleration = 0f;
        previousForwardSpeed = 0f;
        LastFlightAssistRequest = FlightAssistRequest.None;
        ClearExternalFlightAssistRequest();
        if (weaponRecoilStabilizer != null)
        {
            weaponRecoilStabilizer.ClearPendingRequest("reset");
        }

        if (shipRigidbody != null)
        {
            shipRigidbody.position = position;
            shipRigidbody.rotation = rotation;
            shipRigidbody.linearVelocity = Vector3.zero;
            shipRigidbody.angularVelocity = Vector3.zero;
        }

        transform.SetPositionAndRotation(position, rotation);

        FloatingOriginBody floatingOriginBody = GetComponent<FloatingOriginBody>();
        if (floatingOriginBody != null)
        {
            floatingOriginBody.ResetAbsoluteState(position, Vector3.zero);
        }

        SimpleFollowCamera followCamera = Camera.main != null ? Camera.main.GetComponent<SimpleFollowCamera>() : null;
        if (followCamera != null)
        {
            followCamera.SnapNextFrame();
        }

        RefreshMassProperties(force: true);
    }

    public void ResetStartupFlightControls(Vector3 position, Quaternion rotation)
    {
        ResetFlightState(position, rotation, true);
        SetControlMode(FlightControlMode.Normal);
        SetRcsEnabled(true);
        SetSasEnabled(true);
        CaptureSasTargetRotation();
        ClearManualFlightInputForAssist();
    }


    public void ResetVelocity()
    {
        if (shipRigidbody == null)
        {
            ResolveReferences();
        }

        if (shipRigidbody != null)
        {
            shipRigidbody.linearVelocity = Vector3.zero;
            previousForwardSpeed = 0f;
        }
    }

    public void ResetAngularVelocity()
    {
        if (shipRigidbody == null)
        {
            ResolveReferences();
        }

        if (shipRigidbody != null)
        {
            shipRigidbody.angularVelocity = Vector3.zero;
        }
    }

    public void PulseRcsTranslation(Vector3 command)
    {
        pendingDebugRcsTranslationPulse = Vector3.ClampMagnitude(command, 1f);
    }

    public void PulseRcsAttitude(Vector3 command)
    {
        pendingDebugRcsAttitudePulse = Vector3.ClampMagnitude(command, 1f);
    }

    public void PulseMainThrust(float normalizedThrottle)
    {
        pendingDebugMainThrottlePulse = Mathf.Clamp01(normalizedThrottle);
    }

    public void PulseGimbal(float yawCommand, float pitchCommand)
    {
        pendingDebugRcsAttitudePulse = Vector3.ClampMagnitude(new Vector3(pitchCommand, yawCommand, 0f), 1f);
        pendingDebugMainThrottlePulse = 1f;
    }

    public bool HasDamageStates()
    {
        return GetComponentsInChildren<PrototypeModuleDamageState>(true).Length > 0;
    }

    public void ClearPrototypeDamage()
    {
        PrototypeModuleDamageState[] damageStates = GetComponentsInChildren<PrototypeModuleDamageState>(true);
        for (int i = 0; i < damageStates.Length; i++)
        {
            damageStates[i].RepairFull();
        }
    }

    public void ApplyPrototypeDamage(float damagePerModule)
    {
        PrototypeModuleDamageState[] damageStates = GetComponentsInChildren<PrototypeModuleDamageState>(true);
        for (int i = 0; i < damageStates.Length; i++)
        {
            damageStates[i].ApplyDamage(damagePerModule);
        }
    }
}
