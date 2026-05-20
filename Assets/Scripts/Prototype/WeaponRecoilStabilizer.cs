using UnityEngine;

[DisallowMultipleComponent]
public class WeaponRecoilStabilizer : MonoBehaviour
{
    private const float MinimumCompensationWindowSeconds = 0.02f;
    private const float RequestEpsilon = 0.0001f;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private float compensationWindowSeconds = 0.18f;

    private Vector3 pendingCounterAngularImpulseWorld;
    private float remainingCompensationSeconds;

    public Vector3 LastWeaponRecoilImpulseWorld { get; private set; }
    public Vector3 LastWeaponRecoilPositionWorld { get; private set; }
    public Vector3 LastEstimatedRecoilAngularImpulseWorld { get; private set; }
    public Vector3 LastWeaponStabilizationTorqueRequestWorld { get; private set; }
    public Vector3 LastWeaponStabilizationTorqueRequestLocal { get; private set; }
    public Vector3 LastWeaponStabilizationActualRcsTorqueWorld { get; private set; }
    public Vector3 LastWeaponStabilizationResidualRcsTorqueWorld { get; private set; }
    public string LastWeaponStabilizationStatus { get; private set; } = "idle";
    public bool LastWeaponStabilizationRequestActive { get; private set; }
    public float RemainingCompensationSeconds => Mathf.Max(0f, remainingCompensationSeconds);

    private void Awake()
    {
        ResolveReferences();
    }

    public void Configure(Rigidbody body)
    {
        shipRigidbody = body != null ? body : shipRigidbody;
        ResolveReferences();
    }

    public void RecordRecoilImpulse(Vector3 recoilImpulseWorld, Vector3 recoilPositionWorld)
    {
        ResolveReferences();
        LastWeaponRecoilImpulseWorld = recoilImpulseWorld;
        LastWeaponRecoilPositionWorld = recoilPositionWorld;
        LastEstimatedRecoilAngularImpulseWorld = EstimateAngularImpulse(recoilImpulseWorld, recoilPositionWorld);
        LastWeaponStabilizationTorqueRequestWorld = Vector3.zero;
        LastWeaponStabilizationTorqueRequestLocal = Vector3.zero;
        LastWeaponStabilizationRequestActive = false;

        if (LastEstimatedRecoilAngularImpulseWorld.sqrMagnitude <= RequestEpsilon)
        {
            LastWeaponStabilizationStatus = "no angular recoil";
            return;
        }

        pendingCounterAngularImpulseWorld += -LastEstimatedRecoilAngularImpulseWorld;
        remainingCompensationSeconds = Mathf.Max(remainingCompensationSeconds, CompensationWindowSeconds);
        LastWeaponStabilizationStatus = "pending";
    }

    public FlightAssistRequest BuildFlightAssistRequest(
        Transform shipTransform,
        bool effectiveSasEnabled,
        bool rcsEnabled,
        bool hasRcs,
        float deltaTime)
    {
        LastWeaponStabilizationTorqueRequestWorld = Vector3.zero;
        LastWeaponStabilizationTorqueRequestLocal = Vector3.zero;
        LastWeaponStabilizationRequestActive = false;

        if (!HasPendingRequest())
        {
            LastWeaponStabilizationStatus = "idle";
            return FlightAssistRequest.None;
        }

        if (!effectiveSasEnabled)
        {
            DecayPendingRequest(deltaTime, Vector3.zero);
            LastWeaponStabilizationStatus = "sas disabled";
            return FlightAssistRequest.None;
        }

        if (!rcsEnabled || !hasRcs)
        {
            DecayPendingRequest(deltaTime, Vector3.zero);
            LastWeaponStabilizationStatus = rcsEnabled ? "no rcs authority" : "rcs disabled";
            return FlightAssistRequest.None;
        }

        float window = Mathf.Max(MinimumCompensationWindowSeconds, remainingCompensationSeconds);
        Vector3 torqueWorld = pendingCounterAngularImpulseWorld / window;
        Vector3 torqueLocal = shipTransform != null
            ? shipTransform.InverseTransformDirection(torqueWorld)
            : torqueWorld;

        LastWeaponStabilizationTorqueRequestWorld = torqueWorld;
        LastWeaponStabilizationTorqueRequestLocal = torqueLocal;
        LastWeaponStabilizationRequestActive = true;
        LastWeaponStabilizationStatus = "requesting";

        DecayPendingRequest(deltaTime, torqueWorld);
        return new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WeaponStabilization,
            Vector3.zero,
            torqueLocal,
            false);
    }

    public void RecordRcsDiagnostics(Vector3 actualTorqueWorld, Vector3 residualTorqueWorld, string allocatorStatus)
    {
        LastWeaponStabilizationActualRcsTorqueWorld = actualTorqueWorld;
        LastWeaponStabilizationResidualRcsTorqueWorld = residualTorqueWorld;
        if (LastWeaponStabilizationRequestActive && !string.IsNullOrWhiteSpace(allocatorStatus) && allocatorStatus != "ok")
        {
            LastWeaponStabilizationStatus = allocatorStatus;
        }
    }

    public static Vector3 EstimateRecoilImpulse(Vector3 shotDirectionWorld, float projectileMass, float projectileSpeed)
    {
        Vector3 direction = shotDirectionWorld.sqrMagnitude > RequestEpsilon
            ? shotDirectionWorld.normalized
            : Vector3.forward;
        return -direction * (Mathf.Max(0f, projectileMass) * Mathf.Max(0f, projectileSpeed));
    }

    public Vector3 EstimateAngularImpulse(Vector3 recoilImpulseWorld, Vector3 recoilPositionWorld)
    {
        ResolveReferences();
        Vector3 centerOfMass = shipRigidbody != null ? shipRigidbody.worldCenterOfMass : transform.position;
        return Vector3.Cross(recoilPositionWorld - centerOfMass, recoilImpulseWorld);
    }

    private float CompensationWindowSeconds => Mathf.Max(MinimumCompensationWindowSeconds, compensationWindowSeconds);

    private bool HasPendingRequest()
    {
        return remainingCompensationSeconds > 0f && pendingCounterAngularImpulseWorld.sqrMagnitude > RequestEpsilon;
    }

    private void DecayPendingRequest(float deltaTime, Vector3 requestedTorqueWorld)
    {
        float step = Mathf.Min(Mathf.Max(0f, deltaTime), remainingCompensationSeconds);
        if (step > 0f && requestedTorqueWorld.sqrMagnitude > RequestEpsilon)
        {
            pendingCounterAngularImpulseWorld -= requestedTorqueWorld * step;
        }

        remainingCompensationSeconds = Mathf.Max(0f, remainingCompensationSeconds - step);
        if (!HasPendingRequest())
        {
            pendingCounterAngularImpulseWorld = Vector3.zero;
            remainingCompensationSeconds = 0f;
        }
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }
    }

    private void OnValidate()
    {
        compensationWindowSeconds = Mathf.Max(MinimumCompensationWindowSeconds, compensationWindowSeconds);
    }
}
