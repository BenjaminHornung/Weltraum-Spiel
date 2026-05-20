using UnityEngine;

public enum PrototypeMomentumAssistState
{
    Idle,
    AlignForBrake,
    MainBrake,
    RcsDamp,
    Complete,
    Aborted,
    NoAuthority,
    FuelInsufficient
}

[DisallowMultipleComponent]
[DefaultExecutionOrder(-200)]
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(PlayerShipController))]
public class PrototypeMomentumAssist : MonoBehaviour
{
    [Header("Behavior")]
    [SerializeField] private float holdLinearSpeedMetersPerSecond = 0.18f;
    [SerializeField] private float holdAngularSpeedRadPerSecond = 0.08f;
    [SerializeField] private float holdConfirmSeconds = 0.22f;
    [SerializeField] private float alignForMainAngleDegrees = 7f;
    [SerializeField] private float mainBrakeEntrySpeedMetersPerSecond = 2.8f;
    [SerializeField] private float mainBrakeMaxSpeedForMinThrottle = 32f;
    [SerializeField] private float mainBrakeMinThrottle = 0.22f;
    [SerializeField] private float mainBrakeMaxThrottle = 1f;
    [Header("Control Gains")]
    [SerializeField] private float linearDampGain = 1.9f;
    [SerializeField] private float angularDampGain = 2.6f;
    [SerializeField] private float alignTorqueGain = 4f;
    [SerializeField] private float maxRcsForceScale = 2.3f;
    [SerializeField] private float maxRcsTorqueScale = 1.8f;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PlayerShipController shipController;

    private bool isActive;
    private float holdTimer;
    private bool hasAuthorityForMainBrake;
    private bool hasAuthorityForRcsDamp;
    private string lastStatusLabel = "idle";
    private PrototypeMomentumAssistState currentState = PrototypeMomentumAssistState.Idle;

    public bool IsActive => isActive;
    public PrototypeMomentumAssistState CurrentState => currentState;
    public string StatusLabel => lastStatusLabel;
    public float SpeedMetersPerSecond { get; private set; }
    public float AngularSpeed { get; private set; }
    public Vector3 LastRequestedForceWorld { get; private set; } = Vector3.zero;
    public Vector3 LastRequestedTorqueLocal { get; private set; } = Vector3.zero;
    public Vector3 LastBrakeDirectionWorld { get; private set; } = Vector3.forward;
    public float LastMainThrottleRequest { get; private set; }
    public bool CanUseMainBrake { get; private set; }

    public void Bind(PlayerShipController controller, Rigidbody body, ShipStats stats)
    {
        shipController = controller != null ? controller : shipController;
        shipRigidbody = body != null ? body : shipRigidbody;
        shipStats = stats != null ? stats : shipStats;
        ResolveReferences();
    }

    private void FixedUpdate()
    {
        if (!isActive)
        {
            if (currentState == PrototypeMomentumAssistState.Complete)
            {
                return;
            }

            if (currentState != PrototypeMomentumAssistState.Idle
                && currentState != PrototypeMomentumAssistState.Aborted
                && currentState != PrototypeMomentumAssistState.NoAuthority
                && currentState != PrototypeMomentumAssistState.FuelInsufficient)
            {
                SetState(PrototypeMomentumAssistState.Idle, "idle");
            }

            return;
        }

        ResolveReferences();
        if (shipRigidbody == null || shipStats == null || shipController == null)
        {
            Abort("missing dependency");
            return;
        }

        if (shipController.LastManualFlightInput)
        {
            Abort("manual override");
            return;
        }

        RefreshTelemetry();
        RefreshAuthority();

        if (!NeedsControl)
        {
            HandleHold();
            return;
        }

        if (!hasAuthorityForRcsDamp && !hasAuthorityForMainBrake)
        {
            shipController.SetMainThrottle(0f);
            shipController.ClearExternalFlightAssistRequest();
            SetState(PrototypeMomentumAssistState.NoAuthority, "no authority");
            isActive = false;
            return;
        }

        if (!shipStats.HasFuel && shipStats.FuelConsumptionKgPerSecond > 0f)
        {
            shipController.SetMainThrottle(0f);
            shipController.ClearExternalFlightAssistRequest();
            SetState(PrototypeMomentumAssistState.FuelInsufficient, "fuel insufficient");
            isActive = false;
            return;
        }

        FlightAssistRequest request = BuildRequest();
        LastRequestedForceWorld = request.forceWorld;
        LastRequestedTorqueLocal = request.torqueLocal;
        shipController.SetExternalFlightAssistRequest(request);
    }

    private void OnDisable()
    {
        if (shipController != null)
        {
            shipController.SetMainThrottle(0f);
            shipController.ClearExternalFlightAssistRequest();
        }

        isActive = false;
        SetState(PrototypeMomentumAssistState.Idle, "disabled");
        LastRequestedForceWorld = Vector3.zero;
        LastRequestedTorqueLocal = Vector3.zero;
    }

    public void Toggle()
    {
        if (isActive)
        {
            Abort("toggle");
            return;
        }

        Activate();
    }

    public void Activate()
    {
        ResolveReferences();
        RefreshTelemetry();
        RefreshAuthority();
        if (shipController == null || shipRigidbody == null || shipStats == null)
        {
            SetState(PrototypeMomentumAssistState.NoAuthority, "missing dependency");
            isActive = false;
            return;
        }

        if (!hasAuthorityForRcsDamp && !hasAuthorityForMainBrake)
        {
            SetState(PrototypeMomentumAssistState.NoAuthority, "no authority");
            isActive = false;
            return;
        }

        isActive = true;
        holdTimer = 0f;
        SetState(NeedsControl ? (CanUseMainBrake ? PrototypeMomentumAssistState.AlignForBrake : PrototypeMomentumAssistState.RcsDamp) : PrototypeMomentumAssistState.Complete, "activated");
        LastRequestedForceWorld = Vector3.zero;
        LastRequestedTorqueLocal = Vector3.zero;
        LastMainThrottleRequest = 0f;
        shipController.ClearExternalFlightAssistRequest();
        shipController.SetMainThrottle(0f);
    }

    public void Abort(string reason = "aborted")
    {
        shipController?.SetMainThrottle(0f);
        shipController?.ClearExternalFlightAssistRequest();
        LastRequestedForceWorld = Vector3.zero;
        LastRequestedTorqueLocal = Vector3.zero;
        LastMainThrottleRequest = 0f;
        isActive = false;
        holdTimer = 0f;
        SetState(PrototypeMomentumAssistState.Aborted, reason);
    }

    private FlightAssistRequest BuildRequest()
    {
        if (shipRigidbody == null || shipController == null)
        {
            SetState(PrototypeMomentumAssistState.NoAuthority, "missing reference");
            isActive = false;
            return FlightAssistRequest.None;
        }

        Vector3 linearVelocityWorld = shipRigidbody.linearVelocity;
        Vector3 angularVelocityLocal = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        Vector3 dampLinearWorld = linearVelocityWorld.sqrMagnitude > 0.0001f
            ? Vector3.ClampMagnitude(-linearVelocityWorld * linearDampGain, GetMaxRcsForce())
            : Vector3.zero;
        Vector3 dampTorqueLocal = Vector3.ClampMagnitude(-angularVelocityLocal * angularDampGain, GetMaxRcsTorque());
        Vector3 requestedTorqueLocal = dampTorqueLocal;

        Vector3 desiredBrakeDirection = GetBrakeDirection();
        LastBrakeDirectionWorld = desiredBrakeDirection;
        if (desiredBrakeDirection.sqrMagnitude > 0.0001f)
        {
            Vector3 desiredDirectionLocal = transform.InverseTransformDirection(desiredBrakeDirection);
            Vector3 alignTorqueLocal = Vector3.Cross(Vector3.forward, desiredDirectionLocal) * alignTorqueGain;
            requestedTorqueLocal += alignTorqueLocal;
            requestedTorqueLocal = Vector3.ClampMagnitude(requestedTorqueLocal, GetMaxRcsTorque());
        }

        float alignmentAngle = Vector3.Angle(transform.forward, desiredBrakeDirection);
        if (CanUseMainBrake && alignmentAngle <= alignForMainAngleDegrees && SpeedMetersPerSecond >= mainBrakeEntrySpeedMetersPerSecond)
        {
            float speedScale = Mathf.InverseLerp(mainBrakeEntrySpeedMetersPerSecond, mainBrakeMaxSpeedForMinThrottle, SpeedMetersPerSecond);
            float targetThrottle = Mathf.Lerp(mainBrakeMinThrottle, mainBrakeMaxThrottle, speedScale);
            LastMainThrottleRequest = Mathf.Clamp(targetThrottle, 0f, mainBrakeMaxThrottle);
            shipController.SetMainThrottle(LastMainThrottleRequest);
            SetState(PrototypeMomentumAssistState.MainBrake, "main brake");
            return new FlightAssistRequest(FlightAssistMode.AssistedFlight, FlightAssistRequestSource.MomentumAssist, Vector3.zero, requestedTorqueLocal, false);
        }

        if (CanUseMainBrake)
        {
            LastMainThrottleRequest = 0f;
            shipController.SetMainThrottle(0f);
            SetState(PrototypeMomentumAssistState.AlignForBrake, "align for brake");
            return new FlightAssistRequest(FlightAssistMode.AssistedFlight, FlightAssistRequestSource.MomentumAssist, dampLinearWorld, requestedTorqueLocal, false);
        }

        LastMainThrottleRequest = 0f;
        shipController.SetMainThrottle(0f);
        SetState(PrototypeMomentumAssistState.RcsDamp, "rcs damp");
        return new FlightAssistRequest(FlightAssistMode.AssistedFlight, FlightAssistRequestSource.MomentumAssist, dampLinearWorld, requestedTorqueLocal, false);
    }

    private void HandleHold()
    {
        shipController.SetMainThrottle(0f);
        shipController.ClearExternalFlightAssistRequest();
        LastRequestedForceWorld = Vector3.zero;
        LastRequestedTorqueLocal = Vector3.zero;
        LastMainThrottleRequest = 0f;
        holdTimer += Time.fixedDeltaTime;
        if (holdTimer < holdConfirmSeconds)
        {
            SetState(PrototypeMomentumAssistState.RcsDamp, "stabilizing");
            return;
        }

        SetState(PrototypeMomentumAssistState.Complete, "complete");
        isActive = false;
    }

    private bool NeedsControl => SpeedMetersPerSecond > holdLinearSpeedMetersPerSecond || AngularSpeed > holdAngularSpeedRadPerSecond;

    private Vector3 GetBrakeDirection()
    {
        return shipRigidbody != null && shipRigidbody.linearVelocity.sqrMagnitude > 0.0001f
            ? -shipRigidbody.linearVelocity.normalized
            : transform.forward;
    }

    private void RefreshTelemetry()
    {
        if (shipRigidbody == null)
        {
            SpeedMetersPerSecond = 0f;
            AngularSpeed = 0f;
            return;
        }

        SpeedMetersPerSecond = shipRigidbody.linearVelocity.magnitude;
        AngularSpeed = shipRigidbody.angularVelocity.magnitude;
    }

    private void RefreshAuthority()
    {
        hasAuthorityForRcsDamp = shipController != null && shipController.HasRcs && shipController.RcsEnabled;
        bool mainReady = shipController != null
            && shipController.HasMainThruster
            && shipController.MainThrottleScale > 0.0001f
            && !shipController.MainThermalOverheated;
        bool mainAllowed = shipController != null && !shipController.RcsManeuverMode;
        hasAuthorityForMainBrake = mainReady && mainAllowed;

        bool fuelFree = shipStats == null || shipStats.FuelConsumptionKgPerSecond <= 0f;
        CanUseMainBrake = hasAuthorityForMainBrake && (fuelFree || shipStats.HasFuel);
    }

    private float GetMaxRcsForce()
    {
        float baseForce = shipController != null ? shipController.RcsTranslationForceSetting : 0f;
        return Mathf.Max(0f, baseForce * maxRcsForceScale);
    }

    private float GetMaxRcsTorque()
    {
        float baseTorque = shipController != null ? shipController.RcsAttitudeForceSetting : 0f;
        return Mathf.Max(1f, baseTorque * maxRcsTorqueScale);
    }

    private void ResolveReferences()
    {
        if (shipController == null)
        {
            shipController = GetComponent<PlayerShipController>();
        }

        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }

        if (shipStats == null)
        {
            shipStats = GetComponent<ShipStats>();
        }
    }

    private void SetState(PrototypeMomentumAssistState state, string status)
    {
        currentState = state;
        lastStatusLabel = string.IsNullOrWhiteSpace(status) ? state.ToString() : status;
    }

    private void OnValidate()
    {
        holdLinearSpeedMetersPerSecond = Mathf.Max(0.01f, holdLinearSpeedMetersPerSecond);
        holdAngularSpeedRadPerSecond = Mathf.Max(0.01f, holdAngularSpeedRadPerSecond);
        holdConfirmSeconds = Mathf.Max(0f, holdConfirmSeconds);
        alignForMainAngleDegrees = Mathf.Clamp(alignForMainAngleDegrees, 1f, 45f);
        mainBrakeEntrySpeedMetersPerSecond = Mathf.Max(0.1f, mainBrakeEntrySpeedMetersPerSecond);
        mainBrakeMaxSpeedForMinThrottle = Mathf.Max(mainBrakeEntrySpeedMetersPerSecond + 0.01f, mainBrakeMaxSpeedForMinThrottle);
        mainBrakeMinThrottle = Mathf.Clamp(mainBrakeMinThrottle, 0f, 1f);
        mainBrakeMaxThrottle = Mathf.Clamp(mainBrakeMaxThrottle, 0f, 1f);
        linearDampGain = Mathf.Max(0.2f, linearDampGain);
        angularDampGain = Mathf.Max(0.2f, angularDampGain);
        alignTorqueGain = Mathf.Max(0f, alignTorqueGain);
        maxRcsForceScale = Mathf.Max(0.1f, maxRcsForceScale);
        maxRcsTorqueScale = Mathf.Max(0.1f, maxRcsTorqueScale);
    }
}
