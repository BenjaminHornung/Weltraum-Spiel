using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
public class MainThrusterModule : MonoBehaviour
{
    [Header("Main Thruster")]
    [SerializeField] private Transform thrustTransform;
    [Range(0f, 1f)]
    [SerializeField] private float throttleScale = 1f;
    [SerializeField] private bool supportsGimbal = true;
    [Range(0f, 45f)]
    [SerializeField] private float gimbalLimitDegrees = 8f;

    [Header("Runtime")]
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;

    public bool SupportsGimbal => supportsGimbal;
    public float GimbalLimitDegrees => Mathf.Max(0f, gimbalLimitDegrees);
    public float LastThrottleCommand { get; private set; }
    public float LastThrottlePercent => LastThrottleCommand * 100f;
    public float LastAppliedThrust { get; private set; }
    public float LastGimbalYawCommand { get; private set; }
    public float LastGimbalPitchCommand { get; private set; }
    public float LastGimbalAngleDegrees { get; private set; }
    public Vector3 LastAppliedDirection { get; private set; } = Vector3.forward;
    public Vector3 LastForceWorld { get; private set; }
    public Vector3 LastForcePositionWorld { get; private set; }
    public Vector3 LastEstimatedTorque { get; private set; }
    public bool FiredThisStep => LastAppliedThrust > 0f;

    private void Awake()
    {
        ResolveReferences();
    }

    public void Configure(Transform nozzleTransform, Rigidbody body, ShipStats stats)
    {
        thrustTransform = nozzleTransform != null ? nozzleTransform : thrustTransform;
        shipRigidbody = body != null ? body : shipRigidbody;
        shipStats = stats != null ? stats : shipStats;
        ResolveReferences();
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

        if (thrustTransform == null)
        {
            thrustTransform = transform;
        }
    }

    public float Fire(float throttleCommand, float yawCommand, float pitchCommand, float deltaTime)
    {
        ResolveReferences();

        LastThrottleCommand = Mathf.Clamp01(throttleCommand) * Mathf.Clamp01(throttleScale);
        LastAppliedThrust = 0f;
        LastForceWorld = Vector3.zero;
        LastEstimatedTorque = Vector3.zero;

        Vector3 thrustDirection = GetThrustDirection(yawCommand, pitchCommand);
        Vector3 forcePosition = thrustTransform != null ? thrustTransform.position : transform.position;
        LastAppliedDirection = thrustDirection;
        LastForcePositionWorld = forcePosition;

        if (shipRigidbody == null || shipStats == null || LastThrottleCommand <= 0f)
        {
            return 0f;
        }

        float fuelUsed = shipStats.ConsumeFuelForThrust(LastThrottleCommand, deltaTime);
        if (fuelUsed <= 0f)
        {
            return 0f;
        }

        LastAppliedThrust = LastThrottleCommand * shipStats.Thrust;
        LastForceWorld = thrustDirection * LastAppliedThrust;
        LastEstimatedTorque = Vector3.Cross(forcePosition - shipRigidbody.worldCenterOfMass, LastForceWorld);
        shipRigidbody.AddForceAtPosition(LastForceWorld, forcePosition, ForceMode.Force);
        return LastAppliedThrust;
    }

    public Vector3 GetThrustDirection(float yawCommand, float pitchCommand)
    {
        ResolveReferences();

        Vector3 baseDirection = thrustTransform != null ? thrustTransform.forward : transform.forward;
        if (baseDirection.sqrMagnitude <= 0.0001f)
        {
            baseDirection = transform.forward;
        }

        baseDirection.Normalize();
        LastGimbalYawCommand = supportsGimbal ? Mathf.Clamp(yawCommand, -1f, 1f) : 0f;
        LastGimbalPitchCommand = supportsGimbal ? Mathf.Clamp(pitchCommand, -1f, 1f) : 0f;
        LastGimbalAngleDegrees = 0f;

        if (!supportsGimbal)
        {
            return baseDirection;
        }

        Vector3 yawAxis = thrustTransform != null ? thrustTransform.up : transform.up;
        Vector3 pitchAxis = thrustTransform != null ? thrustTransform.right : transform.right;
        Quaternion yawRotation = Quaternion.AngleAxis(LastGimbalYawCommand * GimbalLimitDegrees, yawAxis);
        Quaternion pitchRotation = Quaternion.AngleAxis(-LastGimbalPitchCommand * GimbalLimitDegrees, pitchAxis);
        Vector3 gimballed = (yawRotation * pitchRotation * baseDirection).normalized;
        LastGimbalAngleDegrees = Vector3.Angle(baseDirection, gimballed);
        return gimballed;
    }

    public void ResetRuntimeState()
    {
        LastThrottleCommand = 0f;
        LastAppliedThrust = 0f;
        LastGimbalYawCommand = 0f;
        LastGimbalPitchCommand = 0f;
        LastGimbalAngleDegrees = 0f;
        LastAppliedDirection = GetThrustDirection(0f, 0f);
        LastForceWorld = Vector3.zero;
        LastForcePositionWorld = thrustTransform != null ? thrustTransform.position : transform.position;
        LastEstimatedTorque = Vector3.zero;
    }

    private void OnValidate()
    {
        throttleScale = Mathf.Clamp01(throttleScale);
        gimbalLimitDegrees = Mathf.Max(0f, gimbalLimitDegrees);
    }
}
