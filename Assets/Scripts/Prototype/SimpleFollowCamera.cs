using UnityEngine;

[RequireComponent(typeof(Camera))]
public class SimpleFollowCamera : MonoBehaviour
{
    private enum CameraViewMode
    {
        ChaseLocked = 0,
        OrbitInspect = 1,
        Side = 2,
        FreeInspect = 3
    }

    [SerializeField] private Transform target;
    [SerializeField] private ShipStats targetStats;

    [Range(10f, 25f)]
    [SerializeField] private float distance = 16f;
    [Range(3f, 10f)]
    [SerializeField] private float height = 6f;

    [SerializeField] private float positionSmooth = 8f;
    [SerializeField] private float rotationSmooth = 10f;
    [SerializeField] private float mouseOrbitSensitivity = 0.18f;
    [SerializeField] private float mouseWheelSensitivity = 1.1f;
    [SerializeField] private float minPitch = -20f;
    [SerializeField] private float maxPitch = 75f;
    [SerializeField] private float anchoredLookYawLimit = 18f;
    [SerializeField] private float anchoredLookPitchLimit = 12f;
    [SerializeField] private float anchoredLookRecenterSpeed = 45f;
    [Range(2f, 8f)]
    [SerializeField] private float anchoredModeDistanceClampMin = 4f;
    [Range(20f, 160f)]
    [SerializeField] private float anchoredModeDistanceClampMax = 120f;
    [SerializeField] private float visualBoundsDistanceMultiplier = 2.2f;
    [SerializeField] private float visualBoundsMinZoomMultiplier = 1.35f;
    [SerializeField] private float freeInspectMoveSpeed = 8f;

    private CameraViewMode cameraMode;
    private bool snapNextFrame;
    private float orbitYaw;
    private float orbitPitch;
    private float zoomOffset;
    private Vector3 freeInspectLookTarget;
    private bool hasFreeInspectLookTarget;
    private Vector3 visualBoundsCenter;
    private float visualBoundsRadius;
    private bool hasVisualBounds;

    private float baseFollowDistance;
    private float effectiveFollowDistance;
    private float baseVisualBoundsRadius;

    public int CameraMode => (int)cameraMode;
    public string CameraModeName => GetCameraModeName(cameraMode);
    public float AnchorError => anchorError;
    public float LookYaw => cameraMode == CameraViewMode.ChaseLocked ? Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit) : orbitYaw;
    public float LookPitch => cameraMode == CameraViewMode.ChaseLocked ? Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit) : orbitPitch;
    public float OrbitYaw => orbitYaw;
    public float OrbitPitch => orbitPitch;
    public float Zoom => zoomOffset;
    public float BaseVisualDistance => baseFollowDistance;
    public float BaseVisualBoundsRadius => baseVisualBoundsRadius;
    public float EffectiveDistance => effectiveFollowDistance;

    private float anchorError;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        target = newTarget;
        targetStats = stats;
        freeInspectLookTarget = Vector3.zero;
        hasFreeInspectLookTarget = false;
        snapNextFrame = true;
        ReframeToTargetVisualBounds();
    }

    public void SnapNextFrame()
    {
        snapNextFrame = true;
    }

    public void CycleCameraMode()
    {
        SetCameraMode((CameraViewMode)(((int)cameraMode + 1) % 4));
        ReframeToTargetVisualBounds();
    }

    public void PreviousCameraMode()
    {
        int previousMode = (int)cameraMode - 1;
        if (previousMode < 0)
        {
            previousMode = 3;
        }

        SetCameraMode((CameraViewMode)previousMode);
        ReframeToTargetVisualBounds();
    }

    public void ResetFraming()
    {
        cameraMode = CameraViewMode.ChaseLocked;
        orbitYaw = 0f;
        orbitPitch = 0f;
        zoomOffset = 0f;
        freeInspectLookTarget = Vector3.zero;
        hasFreeInspectLookTarget = false;
        snapNextFrame = true;
        ReframeToTargetVisualBounds();
    }

    public void AdjustZoom(float wheelDelta)
    {
        zoomOffset = Mathf.Clamp(zoomOffset + wheelDelta, -anchoredModeDistanceClampMax, anchoredModeDistanceClampMax);
        snapNextFrame = true;
    }

    public void SetZoomState(float zoom)
    {
        zoomOffset = zoom;
        snapNextFrame = true;
    }

    public void ReframeToTargetVisualBounds()
    {
        RefreshVisualBounds();

        if (target == null)
        {
            return;
        }

        if (cameraMode == CameraViewMode.FreeInspect)
        {
            freeInspectLookTarget = GetVisualFocusPoint();
            hasFreeInspectLookTarget = true;
        }

        snapNextFrame = true;
    }

    private void SetCameraMode(CameraViewMode nextMode)
    {
        if (cameraMode == nextMode)
        {
            return;
        }

        if (nextMode == CameraViewMode.FreeInspect)
        {
            freeInspectLookTarget = GetVisualFocusPoint();
            hasFreeInspectLookTarget = true;
        }

        cameraMode = nextMode;
        snapNextFrame = true;
    }

    private void Update()
    {
        var keyboard = UnityEngine.InputSystem.Keyboard.current;
        if (keyboard != null)
        {
            if (keyboard.vKey.wasPressedThisFrame)
            {
                CycleCameraMode();
            }

            if (WasResetPressed(keyboard))
            {
                ResetFraming();
            }
        }

        var mouse = UnityEngine.InputSystem.Mouse.current;
        bool rightMouseHeld = mouse != null && mouse.rightButton.isPressed;

        HandleMouseOrbit(mouse, rightMouseHeld);
        HandleMouseZoom(mouse);
        HandleFreeInspectMovement(keyboard, rightMouseHeld);

        if (rightMouseHeld)
        {
            snapNextFrame = true;
        }

        if (cameraMode == CameraViewMode.ChaseLocked && !rightMouseHeld)
        {
            orbitYaw = Mathf.MoveTowards(orbitYaw, 0f, anchoredLookRecenterSpeed * Time.deltaTime);
            orbitPitch = Mathf.MoveTowards(orbitPitch, 0f, anchoredLookRecenterSpeed * Time.deltaTime);
        }
    }

    private void LateUpdate()
    {
        if (target == null)
        {
            anchorError = 0f;
            return;
        }

        float followHeight = targetStats != null ? targetStats.FollowHeight : height;
        float followDistance = ResolveBaseDistance(followHeight);

        Vector3 desiredPosition = GetDesiredPosition(followDistance, followHeight);

        if (cameraMode == CameraViewMode.ChaseLocked)
        {
            Quaternion desiredRotation = GetDesiredRotation(desiredPosition);
            transform.SetPositionAndRotation(desiredPosition, desiredRotation);
            anchorError = Vector3.Distance(transform.position, desiredPosition);
            snapNextFrame = false;
            return;
        }

        float positionBlend = snapNextFrame ? 1f : 1f - Mathf.Exp(-positionSmooth * Time.deltaTime);
        transform.position = Vector3.Lerp(transform.position, desiredPosition, positionBlend);

        Vector3 lookTarget = GetLookTargetFromMode(cameraMode);
        Vector3 direction = lookTarget - transform.position;
        if (direction.sqrMagnitude > 0.01f)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction, GetLookUp());
            float rotationBlend = snapNextFrame ? 1f : 1f - Mathf.Exp(-rotationSmooth * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationBlend);
        }

        anchorError = Vector3.Distance(transform.position, desiredPosition);
        snapNextFrame = false;
    }

    private void HandleMouseOrbit(UnityEngine.InputSystem.Mouse mouse, bool rightMouseHeld)
    {
        if (mouse == null || !rightMouseHeld)
        {
            return;
        }

        Vector2 mouseDelta = mouse.delta.ReadValue();
        orbitYaw += mouseDelta.x * mouseOrbitSensitivity;
        orbitPitch -= mouseDelta.y * mouseOrbitSensitivity;

        if (cameraMode == CameraViewMode.ChaseLocked)
        {
            orbitYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
            orbitPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
        }
        else
        {
            orbitPitch = Mathf.Clamp(orbitPitch, minPitch, maxPitch);
        }
    }

    private void HandleMouseZoom(UnityEngine.InputSystem.Mouse mouse)
    {
        if (mouse == null)
        {
            return;
        }

        float scrollDelta = mouse.scroll.ReadValue().y;
        if (Mathf.Abs(scrollDelta) <= Mathf.Epsilon)
        {
            return;
        }

        AdjustZoom(-scrollDelta * mouseWheelSensitivity);
    }

    private void HandleFreeInspectMovement(UnityEngine.InputSystem.Keyboard keyboard, bool rightMouseHeld)
    {
        if (!rightMouseHeld || keyboard == null || cameraMode != CameraViewMode.FreeInspect || target == null)
        {
            return;
        }

        float lateral = 0f;
        float up = 0f;
        float forward = 0f;

        if (keyboard.wKey.isPressed)
        {
            forward += 1f;
        }

        if (keyboard.sKey.isPressed)
        {
            forward -= 1f;
        }

        if (keyboard.aKey.isPressed)
        {
            lateral -= 1f;
        }

        if (keyboard.dKey.isPressed)
        {
            lateral += 1f;
        }

        if (keyboard.qKey.isPressed)
        {
            up -= 1f;
        }

        if (keyboard.eKey.isPressed)
        {
            up += 1f;
        }

        Vector3 moveLocal = new Vector3(lateral, up, forward);
        if (moveLocal.sqrMagnitude <= 0.01f)
        {
            return;
        }

        // FreeInspect movement updates the inspect focus point while RMB is held, with no ship-physics changes.
        freeInspectLookTarget += transform.TransformDirection(moveLocal.normalized) * freeInspectMoveSpeed * Time.deltaTime;
        hasFreeInspectLookTarget = true;
        snapNextFrame = true;
    }

    private float ResolveBaseDistance(float followHeight)
    {
        float minDistance = Mathf.Max(0.1f, anchoredModeDistanceClampMin);
        float maxDistance = Mathf.Max(minDistance, anchoredModeDistanceClampMax);
        float minZoomDistance = minDistance;

        float rawDistance = targetStats != null ? targetStats.FollowDistance : distance;
        baseVisualBoundsRadius = hasVisualBounds ? visualBoundsRadius : 0f;

        if (hasVisualBounds)
        {
            float visualDistance = (baseVisualBoundsRadius * visualBoundsDistanceMultiplier) + followHeight;
            rawDistance = Mathf.Max(rawDistance, visualDistance);
            minZoomDistance = Mathf.Max(minZoomDistance, baseVisualBoundsRadius * visualBoundsMinZoomMultiplier);
        }

        minZoomDistance = Mathf.Min(minZoomDistance, maxDistance);
        baseFollowDistance = Mathf.Clamp(rawDistance, minDistance, maxDistance);
        effectiveFollowDistance = Mathf.Clamp(baseFollowDistance + zoomOffset, minZoomDistance, maxDistance);

        return effectiveFollowDistance;
    }

    private Vector3 GetDesiredPosition(float followDistance, float followHeight)
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        if (cameraMode == CameraViewMode.FreeInspect)
        {
            Vector3 focus = GetLookTargetFromMode(cameraMode);
            Quaternion orbit = Quaternion.AngleAxis(orbitYaw, Vector3.up) * Quaternion.AngleAxis(orbitPitch, Vector3.right);
            return focus + orbit * new Vector3(0f, 0f, -followDistance);
        }

        Quaternion orbitRotation = Quaternion.AngleAxis(orbitYaw, Vector3.up) * Quaternion.AngleAxis(orbitPitch, Vector3.right);
        Vector3 lookTarget = GetLookTargetFromMode(cameraMode);

        if (cameraMode == CameraViewMode.OrbitInspect)
        {
            return lookTarget + orbitRotation * new Vector3(0f, followHeight * 1.4f, -followDistance * 1.25f);
        }

        if (cameraMode == CameraViewMode.Side)
        {
            return lookTarget + orbitRotation * new Vector3(-followDistance * 0.9f, followHeight, 0f);
        }

        return GetVisualFocusPoint() + target.rotation * new Vector3(0f, followHeight, -followDistance);
    }

    private Vector3 GetLookTargetFromMode(CameraViewMode mode)
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        if (mode == CameraViewMode.ChaseLocked || mode == CameraViewMode.OrbitInspect || mode == CameraViewMode.Side)
        {
            return GetVisualFocusPoint();
        }

        if (mode == CameraViewMode.FreeInspect)
        {
            if (hasFreeInspectLookTarget)
            {
                return freeInspectLookTarget;
            }

            return GetVisualFocusPoint();
        }

        return GetVisualFocusPoint();
    }

    private Vector3 GetVisualFocusPoint()
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        return hasVisualBounds ? visualBoundsCenter : target.position;
    }

    private Vector3 GetLookUp()
    {
        return cameraMode == CameraViewMode.ChaseLocked ? target.up : Vector3.up;
    }

    private Quaternion GetDesiredRotation(Vector3 cameraPosition)
    {
        float lookYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
        float lookPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
        Vector3 direction = GetVisualFocusPoint() - cameraPosition;
        Quaternion anchorRotation = direction.sqrMagnitude > 0.01f
            ? Quaternion.LookRotation(direction, target.up)
            : target.rotation;
        return anchorRotation * Quaternion.Euler(lookPitch, lookYaw, 0f);
    }

    private static bool WasResetPressed(UnityEngine.InputSystem.Keyboard keyboard)
    {
        return keyboard.backquoteKey.wasPressedThisFrame
            || keyboard.backslashKey.wasPressedThisFrame
            || keyboard.quoteKey.wasPressedThisFrame
            || keyboard.digit3Key.wasPressedThisFrame;
    }

    private void RefreshVisualBounds()
    {
        if (target == null)
        {
            hasVisualBounds = false;
            visualBoundsCenter = Vector3.zero;
            visualBoundsRadius = 0f;
            return;
        }

        Renderer[] renderers = target.GetComponentsInChildren<Renderer>(true);
        bool hasBounds = false;
        Bounds combined = new Bounds(target.position, Vector3.zero);

        for (int i = 0; i < renderers.Length; i++)
        {
            Renderer renderer = renderers[i];
            if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
            {
                continue;
            }

            if (!hasBounds)
            {
                combined = renderer.bounds;
                hasBounds = true;
            }
            else
            {
                combined.Encapsulate(renderer.bounds);
            }
        }

        hasVisualBounds = hasBounds;
        if (hasBounds)
        {
            visualBoundsCenter = combined.center;
            visualBoundsRadius = combined.extents.magnitude;
        }
        else
        {
            visualBoundsCenter = target.position;
            visualBoundsRadius = 0f;
        }

        if (cameraMode == CameraViewMode.FreeInspect && !hasVisualBounds)
        {
            freeInspectLookTarget = target.position;
            hasFreeInspectLookTarget = true;
        }
    }

    private static string GetCameraModeName(CameraViewMode mode)
    {
        switch (mode)
        {
            case CameraViewMode.ChaseLocked:
                return "ChaseLocked";
            case CameraViewMode.OrbitInspect:
                return "OrbitInspect";
            case CameraViewMode.Side:
                return "Side";
            case CameraViewMode.FreeInspect:
                return "FreeInspect";
            default:
                return "Unknown";
        }
    }
}
