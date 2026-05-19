using UnityEngine;

[System.Serializable]
public struct DockingRelativeState
{
    public bool valid;
    public Vector3 sourceWorldPosition;
    public Vector3 targetWorldPosition;
    public Vector3 sourceWorldForward;
    public Vector3 targetWorldForward;
    public Vector3 offsetWorld;
    public Vector3 offsetLocal;
    public float distance;
    public float angleErrorDegrees;
    public Vector3 relativeVelocityWorld;
    public Vector3 relativeVelocityLocal;
    public float relativeSpeed;
    public float closingSpeed;
    public Vector3 relativeAngularVelocityLocal;
    public string diagnostic;

    public static DockingRelativeState Invalid(string diagnostic)
    {
        return new DockingRelativeState
        {
            valid = false,
            diagnostic = diagnostic
        };
    }
}

[DisallowMultipleComponent]
public class DockingPort : MonoBehaviour
{
    [Header("Port Frame")]
    [SerializeField] private Vector3 localPosition = Vector3.zero;
    [SerializeField] private Vector3 localForward = Vector3.forward;

    [Header("Capture Limits")]
    [SerializeField] private float captureRadius = 3f;
    [SerializeField] private float hardLockRadius = 0.35f;
    [SerializeField] private float maxAngleErrorDegrees = 10f;
    [SerializeField] private float softCaptureAngleDegrees = 30f;
    [SerializeField] private float maxRelativeVelocity = 1.5f;
    [SerializeField] private float softCaptureMaxRelativeVelocity = 6f;

    [Header("Soft Capture")]
    [SerializeField] private bool softCaptureEnabled = true;
    [SerializeField] private float softCapturePositionGain = 1200f;
    [SerializeField] private float softCaptureVelocityGain = 900f;
    [SerializeField] private float softCaptureAngularGain = 4500f;
    [SerializeField] private float maxSoftCaptureForce = 3500f;
    [SerializeField] private float maxSoftCaptureTorque = 5000f;

    [Header("Hard Lock")]
    [SerializeField] private bool hardLockEnabled = true;

    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalForward => SafeLocalForward(localForward);
    public Vector3 WorldPosition => transform.TransformPoint(localPosition);
    public Vector3 WorldForward => transform.TransformDirection(LocalForward).normalized;
    public float CaptureRadius => Mathf.Max(0f, captureRadius);
    public float HardLockRadius => Mathf.Clamp(hardLockRadius, 0f, CaptureRadius);
    public float MaxAngleErrorDegrees => Mathf.Clamp(maxAngleErrorDegrees, 0f, 180f);
    public float SoftCaptureAngleDegrees => Mathf.Clamp(softCaptureAngleDegrees, MaxAngleErrorDegrees, 180f);
    public float MaxRelativeVelocity => Mathf.Max(0f, maxRelativeVelocity);
    public float SoftCaptureMaxRelativeVelocity => Mathf.Max(MaxRelativeVelocity, softCaptureMaxRelativeVelocity);
    public bool SoftCaptureEnabled => softCaptureEnabled;
    public float SoftCapturePositionGain => Mathf.Max(0f, softCapturePositionGain);
    public float SoftCaptureVelocityGain => Mathf.Max(0f, softCaptureVelocityGain);
    public float SoftCaptureAngularGain => Mathf.Max(0f, softCaptureAngularGain);
    public float MaxSoftCaptureForce => Mathf.Max(0f, maxSoftCaptureForce);
    public float MaxSoftCaptureTorque => Mathf.Max(0f, maxSoftCaptureTorque);
    public bool HardLockEnabled => hardLockEnabled;

    public bool TryCalculateRelativeState(
        DockingPort target,
        Rigidbody sourceRigidbody,
        Rigidbody targetRigidbody,
        out DockingRelativeState state)
    {
        return TryCalculateRelativeState(this, target, sourceRigidbody, targetRigidbody, out state);
    }

    public static bool TryCalculateRelativeState(
        DockingPort source,
        DockingPort target,
        Rigidbody sourceRigidbody,
        Rigidbody targetRigidbody,
        out DockingRelativeState state)
    {
        if (source == null)
        {
            state = DockingRelativeState.Invalid("missing-source-port");
            return false;
        }

        if (target == null)
        {
            state = DockingRelativeState.Invalid("missing-target-port");
            return false;
        }

        Vector3 sourcePosition = source.WorldPosition;
        Vector3 targetPosition = target.WorldPosition;
        Vector3 offset = targetPosition - sourcePosition;
        Vector3 sourceForward = source.WorldForward;
        Vector3 targetForward = target.WorldForward;
        Vector3 relativeVelocity = GetPointVelocity(sourceRigidbody, sourcePosition)
            - GetPointVelocity(targetRigidbody, targetPosition);
        Vector3 relativeAngularVelocity = GetAngularVelocity(sourceRigidbody)
            - GetAngularVelocity(targetRigidbody);
        Vector3 approachDirection = offset.sqrMagnitude > 0.0001f ? offset.normalized : sourceForward;

        state = new DockingRelativeState
        {
            valid = true,
            sourceWorldPosition = sourcePosition,
            targetWorldPosition = targetPosition,
            sourceWorldForward = sourceForward,
            targetWorldForward = targetForward,
            offsetWorld = offset,
            offsetLocal = source.transform.InverseTransformDirection(offset),
            distance = offset.magnitude,
            angleErrorDegrees = Vector3.Angle(sourceForward, -targetForward),
            relativeVelocityWorld = relativeVelocity,
            relativeVelocityLocal = source.transform.InverseTransformDirection(relativeVelocity),
            relativeSpeed = relativeVelocity.magnitude,
            closingSpeed = Mathf.Max(0f, -Vector3.Dot(relativeVelocity, approachDirection)),
            relativeAngularVelocityLocal = source.transform.InverseTransformDirection(relativeAngularVelocity),
            diagnostic = "relative-state-ok"
        };
        return true;
    }

    public void Configure(
        Vector3 localPosition,
        Vector3 localForward,
        float captureRadius,
        float maxAngleErrorDegrees,
        float maxRelativeVelocity)
    {
        this.localPosition = localPosition;
        this.localForward = SafeLocalForward(localForward);
        this.captureRadius = Mathf.Max(0f, captureRadius);
        this.maxAngleErrorDegrees = Mathf.Clamp(maxAngleErrorDegrees, 0f, 180f);
        this.maxRelativeVelocity = Mathf.Max(0f, maxRelativeVelocity);
        SanitizeSettings();
    }

    private void OnValidate()
    {
        SanitizeSettings();
    }

    private void SanitizeSettings()
    {
        localForward = SafeLocalForward(localForward);
        captureRadius = Mathf.Max(0f, captureRadius);
        hardLockRadius = Mathf.Clamp(hardLockRadius, 0f, captureRadius);
        maxAngleErrorDegrees = Mathf.Clamp(maxAngleErrorDegrees, 0f, 180f);
        softCaptureAngleDegrees = Mathf.Clamp(softCaptureAngleDegrees, maxAngleErrorDegrees, 180f);
        maxRelativeVelocity = Mathf.Max(0f, maxRelativeVelocity);
        softCaptureMaxRelativeVelocity = Mathf.Max(maxRelativeVelocity, softCaptureMaxRelativeVelocity);
        softCapturePositionGain = Mathf.Max(0f, softCapturePositionGain);
        softCaptureVelocityGain = Mathf.Max(0f, softCaptureVelocityGain);
        softCaptureAngularGain = Mathf.Max(0f, softCaptureAngularGain);
        maxSoftCaptureForce = Mathf.Max(0f, maxSoftCaptureForce);
        maxSoftCaptureTorque = Mathf.Max(0f, maxSoftCaptureTorque);
    }

    private static Vector3 SafeLocalForward(Vector3 direction)
    {
        return direction.sqrMagnitude > 0.0001f ? direction.normalized : Vector3.forward;
    }

    private static Vector3 GetPointVelocity(Rigidbody body, Vector3 worldPosition)
    {
        return body != null ? body.GetPointVelocity(worldPosition) : Vector3.zero;
    }

    private static Vector3 GetAngularVelocity(Rigidbody body)
    {
        return body != null ? body.angularVelocity : Vector3.zero;
    }
}
