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

    public Rigidbody ShipRigidbody => shipRigidbody;
    public ShipWrench NetAppliedWrench { get; private set; }
    public Vector3 NetAppliedForce => NetAppliedWrench.force;
    public Vector3 NetAppliedTorque => NetAppliedWrench.torque;
    public int AppliedForceCount { get; private set; }
    public bool HasRigidbody => shipRigidbody != null;

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
}
