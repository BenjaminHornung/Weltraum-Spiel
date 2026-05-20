using UnityEngine;
using UnityEngine.InputSystem;

public enum SasControlMode
{
    KillRotation,
    HoldAttitude
}

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(MainThrusterBank))]
[RequireComponent(typeof(RcsThrusterController))]
[RequireComponent(typeof(ShipPhysicsCore))]
public class PlayerShipController : MonoBehaviour
{
    [Header("Flight tuning")]
    [SerializeField] private float keyboardAttitudeStrength = 1f;
    [SerializeField] private float precisionScale = 0.35f;
    [SerializeField] private float gamepadLookSpeed = 1.6f;
    [SerializeField] private float gamepadLookDeadZone = 0.18f;

    [Header("SAS")]
    [SerializeField] private SasControlMode sasMode = SasControlMode.KillRotation;

    [Header("Flight Assist")]
    [SerializeField] private FlightAssistMode flightAssistMode = FlightAssistMode.Simulation;

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

    private bool throttleUp;
    private bool throttleDown;
    private bool cutThrottle;
    private bool fullThrottle;
    private bool fire;
    private bool debugRefuel;
    private bool toggleRcs;
    private bool toggleSas;
    private bool togglePrecision;
    private bool sasHoldInvert;
    private bool sasEnabled;
    private bool sasTargetRotationValid;
    private bool precisionControls;
    private bool rcsEnabled = true;
    private Vector3 rcsTranslationInput;
    private Vector3 attitudeInput;
    private float previousForwardSpeed;
    private Quaternion sasTargetRotation = Quaternion.identity;
    private const float SasManualTargetRefreshDeadZone = 0.05f;
    private Vector3 pendingDebugRcsTranslationPulse;
    private Vector3 pendingDebugRcsAttitudePulse;
    private float pendingDebugMainThrottlePulse;
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
    public bool HasRcs => rcsThrusters != null && rcsThrusters.HasRcs;
    public bool RcsEnabled => rcsThrusters != null ? rcsThrusters.RcsEnabled : rcsEnabled;
    public bool SasEnabled => sasEnabled;
    public bool EffectiveSasEnabled => sasEnabled ^ sasHoldInvert;
    public SasControlMode SasMode => sasMode;
    public FlightAssistMode FlightAssistMode => flightAssistMode;
    public bool HasSasTargetRotation => sasTargetRotationValid;
    public Quaternion SasTargetRotation => sasTargetRotationValid ? sasTargetRotation : transform.rotation;
    public FlightAssistRequest LastFlightAssistRequest { get; private set; } = FlightAssistRequest.None;
    public Vector3 LastFlightAssistForceWorld => LastFlightAssistRequest.forceWorld;
    public Vector3 LastFlightAssistTorqueLocal => LastFlightAssistRequest.torqueLocal;
    public bool LastFlightAssistDebugOnly => LastFlightAssistRequest.debugOnlyNonPhysical;
    public bool PrecisionControls => precisionControls;
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

    private void Awake()
    {
        ResolveReferences();
        ConfigureRigidbody();
        ApplyRcsEnabledState();
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

        shipStats.ApplyMassProperties(shipRigidbody);

        if (physicsCore != null)
        {
            physicsCore.BeginPhysicsStep();
            physicsCore.ApplyEnvironmentForces();
        }

        float controlScale = precisionControls ? Mathf.Clamp01(precisionScale) : 1f;
        Vector3 combinedTranslationInput = rcsTranslationInput + pendingDebugRcsTranslationPulse;
        Vector3 combinedAttitudeInput = attitudeInput + pendingDebugRcsAttitudePulse;
        float mainThrottlePulse = pendingDebugMainThrottlePulse;
        pendingDebugRcsTranslationPulse = Vector3.zero;
        pendingDebugRcsAttitudePulse = Vector3.zero;
        pendingDebugMainThrottlePulse = 0f;
        RcsTranslationCommand = Vector3.ClampMagnitude(combinedTranslationInput, 1f) * controlScale;
        RcsAttitudeCommand = Vector3.ClampMagnitude(combinedAttitudeInput, 1f) * controlScale;
        TurnInput = Mathf.Clamp(RcsAttitudeCommand.y, -1f, 1f);
        UpdateSasTargetRotation(RcsAttitudeCommand);
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
        }

        MainThrustCommand = Mathf.Clamp01(Mathf.Max(mainThrottle, mainThrottlePulse));
        GimbalYawCommand = MainThrustCommand > 0f && GimbalEnabled ? TurnInput : 0f;
        float gimbalPitchCommand = MainThrustCommand > 0f && GimbalEnabled ? Mathf.Clamp(RcsAttitudeCommand.x, -1f, 1f) : 0f;

        float appliedThrust = 0f;
        if (mainThruster != null)
        {
            appliedThrust = mainThruster.Fire(MainThrustCommand, GimbalYawCommand, gimbalPitchCommand, Time.fixedDeltaTime);
            shipStats.ApplyMassProperties(shipRigidbody);
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
        togglePrecision = false;
        sasHoldInvert = false;
        rcsTranslationInput = Vector3.zero;
        attitudeInput = Vector3.zero;

        Keyboard keyboard = Keyboard.current;        Gamepad gamepad = Gamepad.current;

        if (keyboard != null)
        {
            throttleUp |= keyboard.leftShiftKey.isPressed;
            throttleDown |= keyboard.leftCtrlKey.isPressed || keyboard.rightCtrlKey.isPressed;
            cutThrottle |= keyboard.xKey.wasPressedThisFrame;
            fullThrottle |= keyboard.yKey.wasPressedThisFrame || keyboard.zKey.wasPressedThisFrame;
            fire |= keyboard.spaceKey.isPressed;
            debugRefuel |= keyboard.backspaceKey.wasPressedThisFrame;
            toggleRcs |= keyboard.rKey.wasPressedThisFrame;
            toggleSas |= keyboard.tKey.wasPressedThisFrame;
            togglePrecision |= keyboard.capsLockKey.wasPressedThisFrame;
            sasHoldInvert |= keyboard.fKey.isPressed;

            if (keyboard.wKey.isPressed)
            {
                attitudeInput.x -= keyboardAttitudeStrength;
            }

            if (keyboard.sKey.isPressed)
            {
                attitudeInput.x += keyboardAttitudeStrength;
            }

            if (keyboard.aKey.isPressed)
            {
                attitudeInput.y -= keyboardAttitudeStrength;
            }

            if (keyboard.dKey.isPressed)
            {
                attitudeInput.y += keyboardAttitudeStrength;
            }

            if (keyboard.qKey.isPressed)
            {
                attitudeInput.z -= keyboardAttitudeStrength;
            }

            if (keyboard.eKey.isPressed)
            {
                attitudeInput.z += keyboardAttitudeStrength;
            }

            if (keyboard.hKey.isPressed)
            {
                rcsTranslationInput.z += 1f;
            }

            if (keyboard.nKey.isPressed)
            {
                rcsTranslationInput.z -= 1f;
            }

            if (keyboard.iKey.isPressed)
            {
                rcsTranslationInput.y -= 1f;
            }

            if (keyboard.kKey.isPressed)
            {
                rcsTranslationInput.y += 1f;
            }

            if (keyboard.jKey.isPressed)
            {
                rcsTranslationInput.x -= 1f;
            }

            if (keyboard.lKey.isPressed)
            {
                rcsTranslationInput.x += 1f;
            }
        }

        if (gamepad != null)
        {
            Vector2 left = gamepad.leftStick.ReadValue();
            Vector2 right = gamepad.rightStick.ReadValue();
            float rightTrigger = gamepad.rightTrigger.ReadValue();
            float leftTrigger = gamepad.leftTrigger.ReadValue();

            throttleUp |= rightTrigger > 0.1f;
            throttleDown |= leftTrigger > 0.1f;
            fire |= gamepad.aButton.isPressed;
            toggleRcs |= gamepad.xButton.wasPressedThisFrame;
            toggleSas |= gamepad.yButton.wasPressedThisFrame;

            if (right.sqrMagnitude > gamepadLookDeadZone * gamepadLookDeadZone)
            {
                attitudeInput.x += -right.y * gamepadLookSpeed;
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
    }

    private void UpdateMainThrottle(float deltaTime)
    {
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

        if (togglePrecision)
        {
            precisionControls = !precisionControls;
        }

        if (debugRefuel)
        {
            shipStats.RefillFuelFull();
        }
    }

    private void ApplyRcsEnabledState()
    {
        if (rcsThrusters != null)
        {
            rcsThrusters.SetRcsEnabled(rcsEnabled);
        }
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

    private void OnValidate()
    {
        mainThrottle = Mathf.Clamp01(mainThrottle);
        throttleChangeRate = Mathf.Max(0f, throttleChangeRate);
        precisionScale = Mathf.Clamp01(precisionScale);
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
        precisionControls = enabled;
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
        mainThrottle = Mathf.Clamp01(normalizedThrottle);
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
