using UnityEngine;

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
}
