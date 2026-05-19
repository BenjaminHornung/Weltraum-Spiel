using UnityEngine;

[System.Serializable]
public struct ShipWrench
{
    public Vector3 force;
    public Vector3 torque;

    public ShipWrench(Vector3 force, Vector3 torque)
    {
        this.force = force;
        this.torque = torque;
    }

    public static ShipWrench Zero => new ShipWrench(Vector3.zero, Vector3.zero);
}

[RequireComponent(typeof(Rigidbody))]
public class ShipPhysicsCore : MonoBehaviour
{
    [SerializeField] private Rigidbody shipRigidbody;

    [Header("Central Gravity")]
    [SerializeField] private bool centralGravityEnabled;
    [SerializeField] private Transform centralGravityBody;
    [SerializeField] private float centralGravityMu;
    [SerializeField] private float minimumGravityDistance = 1f;

    [Header("Atmosphere")]
    [SerializeField] private PrototypeAtmosphereVolume atmosphereVolume;

    public Rigidbody ShipRigidbody => shipRigidbody;
    public ShipWrench NetAppliedWrench { get; private set; }
    public Vector3 NetAppliedForce => NetAppliedWrench.force;
    public Vector3 NetAppliedTorque => NetAppliedWrench.torque;
    public int AppliedForceCount { get; private set; }
    public bool HasRigidbody => shipRigidbody != null;
    public bool CentralGravityEnabled => centralGravityEnabled;
    public Transform CentralGravityBody => centralGravityBody;
    public string LastGravityBodyName { get; private set; } = "none";
    public float CentralGravityMu => Mathf.Max(0f, centralGravityMu);
    public float LastGravityDistance { get; private set; }
    public Vector3 LastGravityAcceleration { get; private set; }
    public Vector3 LastGravityForce { get; private set; }
    public bool LastGravityApplied { get; private set; }
    public PrototypeAtmosphereVolume AtmosphereVolume => atmosphereVolume;
    public ShipAtmosphereSample LastAtmosphereSample { get; private set; } = ShipAtmosphereSample.Zero;
    public bool LastAtmosphereActive => LastAtmosphereSample.active;
    public float LastAtmosphereDensity => LastAtmosphereSample.densityKgPerCubicMeter;
    public float LastAtmosphereDragCoefficient => LastAtmosphereSample.dragCoefficient;
    public float LastAtmosphereReferenceArea => LastAtmosphereSample.referenceAreaSquareMeters;
    public Vector3 LastAtmosphereRelativeVelocity => LastAtmosphereSample.relativeVelocity;
    public Vector3 LastAtmosphereDragForce => LastAtmosphereSample.dragForce;

    private void Awake()
    {
        ResolveReferences();
    }

    public void Configure(Rigidbody body)
    {
        shipRigidbody = body != null ? body : shipRigidbody;
        ResolveReferences();
    }

    public void BeginPhysicsStep()
    {
        NetAppliedWrench = ShipWrench.Zero;
        AppliedForceCount = 0;
        ResetGravityDiagnostics();
        ResetAtmosphereDiagnostics();
    }

    public bool ApplyForceAtCenterOfMass(Vector3 force, ForceMode mode = ForceMode.Force)
    {
        ResolveReferences();
        if (shipRigidbody == null || force.sqrMagnitude <= 0.0001f)
        {
            return false;
        }

        shipRigidbody.AddForce(force, mode);
        RecordAppliedForce(force, Vector3.zero);
        return true;
    }

    public bool ApplyForceAtPosition(Vector3 force, Vector3 position, ForceMode mode = ForceMode.Force)
    {
        ResolveReferences();
        if (shipRigidbody == null || force.sqrMagnitude <= 0.0001f)
        {
            return false;
        }

        shipRigidbody.AddForceAtPosition(force, position, mode);
        Vector3 torque = Vector3.Cross(position - shipRigidbody.worldCenterOfMass, force);
        RecordAppliedForce(force, torque);
        return true;
    }

    public ShipWrench EstimateForceAtPosition(Vector3 force, Vector3 position)
    {
        ResolveReferences();
        Vector3 torque = shipRigidbody != null
            ? Vector3.Cross(position - shipRigidbody.worldCenterOfMass, force)
            : Vector3.zero;
        return new ShipWrench(force, torque);
    }

    public void ConfigureCentralGravity(Transform body, float gravitationalParameter, bool enabled)
    {
        centralGravityBody = body;
        centralGravityMu = Mathf.Max(0f, gravitationalParameter);
        centralGravityEnabled = enabled && centralGravityBody != null && centralGravityMu > 0f;
    }

    public void ConfigureAtmosphere(PrototypeAtmosphereVolume volume)
    {
        atmosphereVolume = volume;
        ResetAtmosphereDiagnostics();
    }

    public bool ApplyEnvironmentForces()
    {
        ResolveReferences();
        ResetGravityDiagnostics();
        ResetAtmosphereDiagnostics();

        if (shipRigidbody == null)
        {
            return false;
        }

        bool appliedGravity = ApplyCentralGravity();
        bool appliedAtmosphere = ApplyAtmosphereDrag();
        return appliedGravity || appliedAtmosphere;
    }

    public bool ApplyAtmosphereDrag()
    {
        ResolveReferences();
        ResetAtmosphereDiagnostics();

        if (shipRigidbody == null || atmosphereVolume == null)
        {
            return false;
        }

        ShipAtmosphereSample sample;
        if (!atmosphereVolume.TrySample(shipRigidbody.worldCenterOfMass, shipRigidbody.linearVelocity, out sample))
        {
            return false;
        }

        LastAtmosphereSample = sample;
        if (sample.dragForce.sqrMagnitude <= 0.0001f)
        {
            return false;
        }

        return ApplyForceAtCenterOfMass(sample.dragForce, ForceMode.Force);
    }

    private bool ApplyCentralGravity()
    {
        if (shipRigidbody == null || !centralGravityEnabled || centralGravityBody == null || CentralGravityMu <= 0f)
        {
            return false;
        }

        Vector3 toBody = centralGravityBody.position - shipRigidbody.worldCenterOfMass;
        if (toBody.sqrMagnitude <= 0.000001f)
        {
            LastGravityBodyName = centralGravityBody.name;
            return false;
        }

        float minDistance = Mathf.Max(0.001f, minimumGravityDistance);
        float distanceSquared = Mathf.Max(toBody.sqrMagnitude, minDistance * minDistance);
        float distance = Mathf.Sqrt(distanceSquared);
        Vector3 acceleration = toBody.normalized * (CentralGravityMu / distanceSquared);

        LastGravityBodyName = centralGravityBody.name;
        LastGravityDistance = distance;
        LastGravityAcceleration = acceleration;
        LastGravityForce = acceleration * shipRigidbody.mass;
        LastGravityApplied = ApplyAccelerationAtCenterOfMass(acceleration);
        return LastGravityApplied;
    }

    public bool ApplyAccelerationAtCenterOfMass(Vector3 acceleration)
    {
        ResolveReferences();
        if (shipRigidbody == null || acceleration.sqrMagnitude <= 0.000001f)
        {
            return false;
        }

        shipRigidbody.AddForce(acceleration, ForceMode.Acceleration);
        RecordAppliedForce(acceleration * shipRigidbody.mass, Vector3.zero);
        return true;
    }

    private void RecordAppliedForce(Vector3 force, Vector3 torque)
    {
        NetAppliedWrench = new ShipWrench(NetAppliedWrench.force + force, NetAppliedWrench.torque + torque);
        AppliedForceCount++;
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }
    }

    private void ResetGravityDiagnostics()
    {
        LastGravityBodyName = centralGravityBody != null && centralGravityEnabled ? centralGravityBody.name : "none";
        LastGravityDistance = 0f;
        LastGravityAcceleration = Vector3.zero;
        LastGravityForce = Vector3.zero;
        LastGravityApplied = false;
    }

    private void ResetAtmosphereDiagnostics()
    {
        LastAtmosphereSample = ShipAtmosphereSample.Zero;
    }

    private void OnValidate()
    {
        centralGravityMu = Mathf.Max(0f, centralGravityMu);
        minimumGravityDistance = Mathf.Max(0.001f, minimumGravityDistance);
        if (centralGravityEnabled && (centralGravityBody == null || centralGravityMu <= 0f))
        {
            centralGravityEnabled = false;
        }
    }
}
