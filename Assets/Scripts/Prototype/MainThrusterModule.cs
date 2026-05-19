using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
public class MainThrusterModule : MonoBehaviour
{
    [Header("Main Thruster")]
    [SerializeField] private Transform thrustTransform;
    [SerializeField] private Transform gimbalVisualTransform;
    [SerializeField] private MainThrustMode mainThrustMode = MainThrustMode.ComSafeSteeringOnly;
    [Range(0f, 1f)]
    [SerializeField] private float throttleScale = 1f;
    [SerializeField] private bool supportsGimbal = true;
    [Range(0f, 45f)]
    [SerializeField] private float gimbalLimitDegrees = 20f;
    [Range(0f, 1f)]
    [SerializeField] private float gimbalResponseScalar = 0.35f;

    [Header("Runtime")]
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private PrototypeThermalModule thermalModule;


    private Quaternion gimbalBaseLocalRotation = Quaternion.identity;
    private bool hasGimbalBaseRotation;

    public MainThrustMode ThrustMode => mainThrustMode;
    public float ThrottleScale => Mathf.Clamp01(throttleScale);
    public bool SupportsGimbal => supportsGimbal;
    public float GimbalLimitDegrees => Mathf.Max(0f, gimbalLimitDegrees);
    public float GimbalResponseScalar => Mathf.Clamp01(gimbalResponseScalar);
    public float LastThrottleCommand { get; private set; }
    public float LastThrottlePercent => LastThrottleCommand * 100f;
    public float LastAppliedThrust { get; private set; }
    public float LastGimbalYawCommand { get; private set; }
    public float LastGimbalPitchCommand { get; private set; }
    public float LastGimbalAngleDegrees { get; private set; }
    public Vector3 LastAppliedDirection { get; private set; } = Vector3.forward;
    public Vector3 LastStraightForceWorld { get; private set; }
    public Vector3 LastSteeringForceWorld { get; private set; }
    public Vector3 LastForceWorld { get; private set; }
    public Vector3 LastForcePositionWorld { get; private set; }
    public Vector3 LastEstimatedTorque { get; private set; }
    public bool FiredThisStep => LastAppliedThrust > 0f;
    public PrototypeThermalModule ThermalModule => thermalModule;
    public bool ThermalSimulationEnabled => thermalModule != null && thermalModule.SimulationEnabled;
    public bool IsOverheated => thermalModule != null && thermalModule.IsOverheated;
    public float ThermalEfficiencyScalar => thermalModule != null ? thermalModule.EfficiencyScalar : 1f;
    public float LastPowerDrawKw => thermalModule != null ? thermalModule.LastPowerDrawKw : 0f;

    private void Awake()
    {
        ResolveReferences();
    }

    public void Configure(Transform nozzleTransform, Rigidbody body, ShipStats stats, ShipPhysicsCore core)
    {
        Configure(nozzleTransform, body, stats, core, null);
    }

    public void Configure(Transform nozzleTransform, Rigidbody body, ShipStats stats, ShipPhysicsCore core, PrototypeThermalModule thermal)
    {
        thrustTransform = nozzleTransform != null ? nozzleTransform : thrustTransform;
        shipRigidbody = body != null ? body : shipRigidbody;
        shipStats = stats != null ? stats : shipStats;
        physicsCore = core != null ? core : physicsCore;
        thermalModule = thermal != null ? thermal : thermalModule;
        ResolveReferences();
        CaptureGimbalBaseRotation();
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

        if (physicsCore == null)
        {
            physicsCore = GetComponent<ShipPhysicsCore>();
        }

        if (thermalModule == null)
        {
            thermalModule = GetComponent<PrototypeThermalModule>();
        }

        if (physicsCore != null && shipRigidbody == null)
        {
            shipRigidbody = physicsCore.ShipRigidbody;
        }

        if (thrustTransform == null)
        {
            thrustTransform = transform.Find("MainThrusterGimbal/MainThrusterNozzle");
        }

        if (thrustTransform == null)
        {
            thrustTransform = transform.Find("MainThrusterNozzle");
        }

        if (gimbalVisualTransform == null)
        {
            gimbalVisualTransform = transform.Find("MainThrusterGimbal");
        }

        if (gimbalVisualTransform == null && thrustTransform != null && thrustTransform.parent != transform)
        {
            gimbalVisualTransform = thrustTransform.parent;
        }

        if (thrustTransform == null)
        {
            thrustTransform = transform;
        }

        CaptureGimbalBaseRotation();
    }

    private void CaptureGimbalBaseRotation()
    {
        if (hasGimbalBaseRotation || gimbalVisualTransform == null)
        {
            return;
        }

        gimbalBaseLocalRotation = gimbalVisualTransform.localRotation;
        hasGimbalBaseRotation = true;
    }

    public float Fire(float throttleCommand, float yawCommand, float pitchCommand, float deltaTime)
    {
        ResolveReferences();

        LastThrottleCommand = Mathf.Clamp01(throttleCommand) * Mathf.Clamp01(throttleScale);
        LastAppliedThrust = 0f;
        LastStraightForceWorld = Vector3.zero;
        LastSteeringForceWorld = Vector3.zero;
        LastForceWorld = Vector3.zero;
        LastEstimatedTorque = Vector3.zero;
        if (shipStats != null)
        {
            shipStats.ResetFuelFlowTelemetry();
        }

        Vector3 baseDirection = GetBaseThrustDirection();
        Vector3 thrustDirection = GetThrustDirection(yawCommand, pitchCommand);
        Vector3 forcePosition = thrustTransform != null ? thrustTransform.position : transform.position;
        LastAppliedDirection = thrustDirection;
        LastForcePositionWorld = forcePosition;

        if (shipRigidbody == null || shipStats == null || physicsCore == null || LastThrottleCommand <= 0f)
        {
            AdvanceThermal(0f, deltaTime);
            return 0f;
        }

        if (thermalModule != null && thermalModule.ShouldDisableModule)
        {
            AdvanceThermal(0f, deltaTime);
            return 0f;
        }

        float appliedFuelFraction;
        shipStats.ConsumeFuelForThrust(LastThrottleCommand, deltaTime, out appliedFuelFraction);
        if (appliedFuelFraction <= 0f)
        {
            AdvanceThermal(0f, deltaTime);
            return 0f;
        }

        float thermalEfficiency = thermalModule != null ? thermalModule.EfficiencyScalar : 1f;
        LastAppliedThrust = LastThrottleCommand * shipStats.Thrust * appliedFuelFraction * thermalEfficiency;
        AdvanceThermal(LastThrottleCommand * appliedFuelFraction, deltaTime);
        if (LastAppliedThrust <= 0f)
        {
            return 0f;
        }

        LastStraightForceWorld = baseDirection * LastAppliedThrust;
        LastSteeringForceWorld = (thrustDirection - baseDirection) * LastAppliedThrust;
        LastForceWorld = LastStraightForceWorld + LastSteeringForceWorld;

        Vector3 centerOfMass = shipRigidbody.worldCenterOfMass;
        if (mainThrustMode == MainThrustMode.FullyPhysicalNozzleForce)
        {
            LastStraightForceWorld = Vector3.zero;
            LastSteeringForceWorld = LastForceWorld;
            physicsCore.ApplyForceAtPosition(LastForceWorld, forcePosition, ForceMode.Force);
            LastEstimatedTorque = Vector3.Cross(forcePosition - centerOfMass, LastForceWorld);
        }
        else
        {
            physicsCore.ApplyForceAtCenterOfMass(LastStraightForceWorld, ForceMode.Force);

            if (LastSteeringForceWorld.sqrMagnitude > 0.0001f)
            {
                physicsCore.ApplyForceAtPosition(LastSteeringForceWorld, forcePosition, ForceMode.Force);
                LastEstimatedTorque = Vector3.Cross(forcePosition - centerOfMass, LastSteeringForceWorld);
            }
        }

        return LastAppliedThrust;
    }

    private void AdvanceThermal(float activityFraction, float deltaTime)
    {
        if (thermalModule != null)
        {
            thermalModule.Advance(activityFraction, deltaTime);
        }
    }

    public Vector3 GetThrustDirection(float yawCommand, float pitchCommand)
    {
        ResolveReferences();

        Vector3 baseDirection = GetBaseThrustDirection();
        Vector2 rawGimbalCommand = supportsGimbal
            ? Vector2.ClampMagnitude(new Vector2(yawCommand, pitchCommand), 1f)
            : Vector2.zero;
        Vector2 gimbalCommand = Vector2.ClampMagnitude(rawGimbalCommand * GimbalResponseScalar, 1f);
        LastGimbalYawCommand = gimbalCommand.x;
        LastGimbalPitchCommand = gimbalCommand.y;
        LastGimbalAngleDegrees = 0f;

        if (!supportsGimbal)
        {
            ApplyVisualGimbal(Quaternion.identity);
            return baseDirection;
        }

        float yawDegrees = LastGimbalYawCommand * GimbalLimitDegrees;
        float pitchDegrees = -LastGimbalPitchCommand * GimbalLimitDegrees;
        Vector3 yawAxis = transform.up;
        Vector3 pitchAxis = transform.right;
        Quaternion yawRotation = Quaternion.AngleAxis(yawDegrees, yawAxis);
        Quaternion pitchRotation = Quaternion.AngleAxis(pitchDegrees, pitchAxis);
        Vector3 gimballed = (yawRotation * pitchRotation * baseDirection).normalized;
        LastGimbalAngleDegrees = Vector3.Angle(baseDirection, gimballed);

        ApplyVisualGimbal(Quaternion.AngleAxis(yawDegrees, Vector3.up) * Quaternion.AngleAxis(pitchDegrees, Vector3.right));
        return gimballed;
    }

    private void ApplyVisualGimbal(Quaternion localGimbal)
    {
        if (gimbalVisualTransform == null)
        {
            return;
        }

        CaptureGimbalBaseRotation();
        gimbalVisualTransform.localRotation = gimbalBaseLocalRotation * localGimbal;
    }

    private Vector3 GetBaseThrustDirection()
    {
        Vector3 baseDirection = transform.forward;
        if (baseDirection.sqrMagnitude <= 0.0001f)
        {
            baseDirection = Vector3.forward;
        }

        return baseDirection.normalized;
    }

    public void ResetRuntimeState()
    {
        LastThrottleCommand = 0f;
        LastAppliedThrust = 0f;
        LastGimbalYawCommand = 0f;
        LastGimbalPitchCommand = 0f;
        LastGimbalAngleDegrees = 0f;
        LastAppliedDirection = GetThrustDirection(0f, 0f);
        LastStraightForceWorld = Vector3.zero;
        LastSteeringForceWorld = Vector3.zero;
        LastForceWorld = Vector3.zero;
        LastForcePositionWorld = thrustTransform != null ? thrustTransform.position : transform.position;
        LastEstimatedTorque = Vector3.zero;
    }

    private void OnValidate()
    {
        throttleScale = Mathf.Clamp01(throttleScale);
        gimbalLimitDegrees = Mathf.Max(0f, gimbalLimitDegrees);
        gimbalResponseScalar = Mathf.Clamp01(gimbalResponseScalar);
    }


    public void ApplyConfig(PrototypeShipConfig config)
    {
        if (config == null)
        {
            return;
        }

        PrototypeMainThrusterSettings settings = config.MainThruster;
        settings.Clamp();
        mainThrustMode = settings.mainThrustMode;
        throttleScale = settings.throttleScale;
        supportsGimbal = settings.supportsGimbal;
        gimbalLimitDegrees = settings.gimbalLimitDegrees;
        gimbalResponseScalar = settings.gimbalResponseScalar;
    }
}
