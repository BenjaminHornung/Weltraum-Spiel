using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(ShipPhysicsCore))]
public class MainThrusterBank : MonoBehaviour
{
    [SerializeField] private MainThrusterModule[] thrusters;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private ShipPhysicsCore physicsCore;

    public MainThrustMode ThrustMode => FirstThruster != null ? FirstThruster.ThrustMode : MainThrustMode.ComSafeSteeringOnly;
    public float ThrottleScale => FirstThruster != null ? FirstThruster.ThrottleScale : 0f;
    public bool SupportsGimbal => FirstThruster != null && FirstThruster.SupportsGimbal;
    public float GimbalLimitDegrees => FirstThruster != null ? FirstThruster.GimbalLimitDegrees : 0f;
    public float GimbalResponseScalar => FirstThruster != null ? FirstThruster.GimbalResponseScalar : 0f;
    public float GimbalSlewRateDegreesPerSecond => FirstThruster != null ? FirstThruster.GimbalSlewRateDegreesPerSecond : 0f;
    public float ThrottleSpoolUpRate => FirstThruster != null ? FirstThruster.ThrottleSpoolUpRate : 0f;
    public float ThrottleSpoolDownRate => FirstThruster != null ? FirstThruster.ThrottleSpoolDownRate : 0f;
    public float LastTargetThrottle { get; private set; }
    public float LastActualThrottle { get; private set; }
    public float LastAppliedThrust { get; private set; }
    public float LastTargetGimbalYawCommand { get; private set; }
    public float LastTargetGimbalPitchCommand { get; private set; }
    public float LastActualGimbalYawCommand { get; private set; }
    public float LastActualGimbalPitchCommand { get; private set; }
    public float LastGimbalAngleDegrees { get; private set; }
    public Vector3 LastAppliedDirection { get; private set; } = Vector3.forward;
    public Vector3 LastStraightForceWorld { get; private set; }
    public Vector3 LastSteeringForceWorld { get; private set; }
    public Vector3 LastForceWorld { get; private set; }
    public Vector3 LastForcePositionWorld { get; private set; }
    public Vector3 LastEstimatedTorque { get; private set; }
    public PrototypeThermalModule ThermalModule => FirstThruster != null ? FirstThruster.ThermalModule : null;
    public bool ThermalSimulationEnabled => FirstThruster != null && FirstThruster.ThermalSimulationEnabled;
    public bool IsOverheated => FirstThruster != null && FirstThruster.IsOverheated;
    public float ThermalEfficiencyScalar => FirstThruster != null ? FirstThruster.ThermalEfficiencyScalar : 1f;
    public float LastPowerDrawKw { get; private set; }
    public int ThrusterCount => ActiveThrusters.Length;

    private MainThrusterModule FirstThruster
    {
        get
        {
            MainThrusterModule[] active = ActiveThrusters;
            return active.Length > 0 ? active[0] : null;
        }
    }

    private MainThrusterModule[] ActiveThrusters
    {
        get
        {
            ResolveReferences();
            return thrusters ?? System.Array.Empty<MainThrusterModule>();
        }
    }

    private void Awake()
    {
        ResolveReferences();
    }

    public void Configure(MainThrusterModule[] modules, Rigidbody body, ShipStats stats, ShipPhysicsCore core)
    {
        thrusters = modules ?? System.Array.Empty<MainThrusterModule>();
        shipRigidbody = body != null ? body : shipRigidbody;
        shipStats = stats != null ? stats : shipStats;
        physicsCore = core != null ? core : physicsCore;
        ResolveReferences();
    }

    public float Fire(float throttleCommand, float yawCommand, float pitchCommand, float deltaTime)
    {
        MainThrusterModule[] active = ActiveThrusters;
        ResetAggregateRuntime();

        if (active.Length == 0)
        {
            return 0f;
        }

        Vector3 weightedDirection = Vector3.zero;
        for (int i = 0; i < active.Length; i++)
        {
            MainThrusterModule thruster = active[i];
            if (thruster == null)
            {
                continue;
            }

            float applied = thruster.Fire(throttleCommand, yawCommand, pitchCommand, deltaTime);
            LastAppliedThrust += applied;
            LastStraightForceWorld += thruster.LastStraightForceWorld;
            LastSteeringForceWorld += thruster.LastSteeringForceWorld;
            LastForceWorld += thruster.LastForceWorld;
            LastEstimatedTorque += thruster.LastEstimatedTorque;
            LastPowerDrawKw += thruster.LastPowerDrawKw;
            LastTargetThrottle += thruster.LastTargetThrottle;
            LastActualThrottle += thruster.LastActualThrottle;
            LastTargetGimbalYawCommand += thruster.LastTargetGimbalYawCommand;
            LastTargetGimbalPitchCommand += thruster.LastTargetGimbalPitchCommand;
            LastActualGimbalYawCommand += thruster.LastActualGimbalYawCommand;
            LastActualGimbalPitchCommand += thruster.LastActualGimbalPitchCommand;
            LastGimbalAngleDegrees = Mathf.Max(LastGimbalAngleDegrees, thruster.LastGimbalAngleDegrees);
            LastForcePositionWorld = thruster.LastForcePositionWorld;
            weightedDirection += thruster.LastAppliedDirection * Mathf.Max(0.0001f, applied);
        }

        float count = Mathf.Max(1, active.Length);
        LastTargetThrottle /= count;
        LastActualThrottle /= count;
        LastTargetGimbalYawCommand /= count;
        LastTargetGimbalPitchCommand /= count;
        LastActualGimbalYawCommand /= count;
        LastActualGimbalPitchCommand /= count;
        LastAppliedDirection = weightedDirection.sqrMagnitude > 0.0001f ? weightedDirection.normalized : transform.forward;
        return LastAppliedThrust;
    }

    public void SetThrustMode(MainThrustMode mode)
    {
        MainThrusterModule[] active = ActiveThrusters;
        for (int i = 0; i < active.Length; i++)
        {
            if (active[i] != null)
            {
                active[i].SetThrustMode(mode);
            }
        }
    }

    public void ApplyConfig(PrototypeShipConfig config)
    {
        PrototypeMainThrusterSettings settings = config != null ? config.MainThruster : PrototypeMainThrusterSettings.Default;
        ApplySettings(settings);
    }

    public void ApplySettings(PrototypeMainThrusterSettings settings)
    {
        MainThrusterModule[] active = ActiveThrusters;
        for (int i = 0; i < active.Length; i++)
        {
            if (active[i] != null)
            {
                active[i].ApplySettings(settings);
            }
        }
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

        if (thrusters == null || thrusters.Length == 0)
        {
            thrusters = GetComponents<MainThrusterModule>();
        }
    }

    private void ResetAggregateRuntime()
    {
        LastTargetThrottle = 0f;
        LastActualThrottle = 0f;
        LastAppliedThrust = 0f;
        LastTargetGimbalYawCommand = 0f;
        LastTargetGimbalPitchCommand = 0f;
        LastActualGimbalYawCommand = 0f;
        LastActualGimbalPitchCommand = 0f;
        LastGimbalAngleDegrees = 0f;
        LastAppliedDirection = transform.forward;
        LastStraightForceWorld = Vector3.zero;
        LastSteeringForceWorld = Vector3.zero;
        LastForceWorld = Vector3.zero;
        LastForcePositionWorld = transform.position;
        LastEstimatedTorque = Vector3.zero;
        LastPowerDrawKw = 0f;
    }
}
