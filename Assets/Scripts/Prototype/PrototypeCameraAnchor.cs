using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeCameraAnchor : MonoBehaviour
{
    [SerializeField] private Vector3 focusOffsetLocal;
    [SerializeField] private bool preferRigidbodyCenterOfMass = true;
    [SerializeField] private bool useInterpolatedTransformForCameraFocus = true;
    [SerializeField] private bool useVisualBoundsForDistanceOnly = true;
    [SerializeField] private int priority;
    [SerializeField] private bool showGizmo = true;
    [SerializeField] private Color gizmoColor = new Color(0.2f, 0.9f, 1f, 0.85f);

    public Vector3 FocusOffsetLocal => focusOffsetLocal;
    public bool PreferRigidbodyCenterOfMass => preferRigidbodyCenterOfMass;
    public bool UseInterpolatedTransformForCameraFocus => useInterpolatedTransformForCameraFocus;
    public bool UseVisualBoundsForDistanceOnly => useVisualBoundsForDistanceOnly;
    public int Priority => priority;
    public bool ShowGizmo => showGizmo;
    public Color GizmoColor => gizmoColor;
    public Vector3 WorldFocusPoint => ResolveWorldFocusPoint(out _);
    public Vector3 FocusPoint => WorldFocusPoint;
    public string FocusSourceLabel
    {
        get
        {
            ResolveWorldFocusPoint(out string sourceLabel);
            return sourceLabel;
        }
    }

    private Vector3 ResolveWorldFocusPoint(out string sourceLabel)
    {
        if (preferRigidbodyCenterOfMass && !useInterpolatedTransformForCameraFocus)
        {
            Rigidbody body = GetComponentInParent<Rigidbody>();
            if (body != null)
            {
                sourceLabel = "CameraAnchor:CenterOfMass";
                return body.worldCenterOfMass + transform.TransformVector(focusOffsetLocal);
            }
        }

        sourceLabel = "CameraAnchor:Transform";
        return transform.TransformPoint(focusOffsetLocal);
    }

    private void OnDrawGizmosSelected()
    {
        if (!showGizmo)
        {
            return;
        }

        Gizmos.color = gizmoColor;
        Gizmos.DrawWireSphere(WorldFocusPoint, 0.4f);
        Gizmos.DrawLine(transform.position, WorldFocusPoint);
    }
}
