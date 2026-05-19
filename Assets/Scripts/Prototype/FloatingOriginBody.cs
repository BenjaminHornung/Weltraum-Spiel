using UnityEngine;

[DisallowMultipleComponent]
public class FloatingOriginBody : MonoBehaviour
{
    [SerializeField] private bool registerOnEnable = true;
    [SerializeField] private FloatingOriginManager manager;
    [SerializeField] private LargeWorldVector3d absolutePosition;
    [SerializeField] private LargeWorldVector3d absoluteVelocity;

    private Rigidbody cachedRigidbody;

    public FloatingOriginManager Manager => manager;
    public LargeWorldVector3d AbsolutePosition => absolutePosition;
    public LargeWorldVector3d AbsoluteVelocity => absoluteVelocity;
    public Vector3 LocalUnityPosition => transform.position;
    public LargeWorldTransformState State => CaptureState(manager != null ? manager.Origin : LargeWorldVector3d.Zero);

    private void Awake()
    {
        cachedRigidbody = GetComponent<Rigidbody>();
    }

    private void OnEnable()
    {
        if (!registerOnEnable)
        {
            return;
        }

        if (manager == null)
        {
            manager = FindAnyObjectByType<FloatingOriginManager>();
        }

        if (manager != null)
        {
            manager.Register(this);
        }
    }

    private void OnDisable()
    {
        if (manager != null)
        {
            manager.Unregister(this);
        }
    }

    public void Configure(FloatingOriginManager newManager, LargeWorldVector3d initialAbsolutePosition)
    {
        manager = newManager;
        absolutePosition = initialAbsolutePosition;
        ApplyLocalPosition(manager != null ? manager.Origin : LargeWorldVector3d.Zero);
    }

    public void SetManager(FloatingOriginManager newManager)
    {
        manager = newManager;
    }

    public void CaptureAbsoluteState(LargeWorldVector3d origin)
    {
        absolutePosition = origin + transform.position;
        Rigidbody body = GetCachedRigidbody();
        absoluteVelocity = LargeWorldVector3d.FromVector3(body != null ? body.linearVelocity : Vector3.zero);
    }

    public LargeWorldTransformState CaptureState(LargeWorldVector3d origin)
    {
        Rigidbody body = GetCachedRigidbody();
        return LargeWorldTransformState.FromTransform(transform, body, origin);
    }

    public void ApplyLocalPosition(LargeWorldVector3d origin)
    {
        Vector3 localPosition = (absolutePosition - origin).ToVector3();
        Rigidbody body = GetCachedRigidbody();
        if (body == null)
        {
            transform.position = localPosition;
            return;
        }

        Vector3 linearVelocity = body.linearVelocity;
        Vector3 angularVelocity = body.angularVelocity;
        body.position = localPosition;
        transform.position = localPosition;
        body.linearVelocity = linearVelocity;
        body.angularVelocity = angularVelocity;
    }

    public void SetAbsoluteVelocity(Vector3 velocity)
    {
        absoluteVelocity = LargeWorldVector3d.FromVector3(velocity);
        Rigidbody body = GetCachedRigidbody();
        if (body != null)
        {
            body.linearVelocity = velocity;
        }
    }

    public void ResetAbsoluteState(Vector3 localPosition, Vector3 velocity)
    {
        LargeWorldVector3d origin = manager != null ? manager.Origin : LargeWorldVector3d.Zero;
        absolutePosition = origin + localPosition;
        absoluteVelocity = LargeWorldVector3d.FromVector3(velocity);

        Rigidbody body = GetCachedRigidbody();
        if (body != null)
        {
            body.position = localPosition;
            body.linearVelocity = velocity;
        }

        transform.position = localPosition;
    }

    private Rigidbody GetCachedRigidbody()
    {
        if (cachedRigidbody == null)
        {
            cachedRigidbody = GetComponent<Rigidbody>();
        }

        return cachedRigidbody;
    }
}
