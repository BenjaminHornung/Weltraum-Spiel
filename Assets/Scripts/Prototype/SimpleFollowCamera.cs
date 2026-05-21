using System;
using System.Collections.Generic;
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

    private static readonly string[] VisualBoundsNameFilters =
    {
        "VFX",
        "MUZZLE_FLASH",
        "WEAPON_CLEARANCE",
        "WEAPON_ARC_LIMIT",
        "Debug",
        "Label",
        "Ring",
        "Marker"
    };

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
    [SerializeField] private float visualFramingPadding = 1.2f;
    [SerializeField] private float visualBoundsMinZoomPadding = 0.75f;
    [SerializeField] private float freeInspectMoveSpeed = 8f;

    private Camera attachedCamera;
    private CameraViewMode cameraMode;
    private bool snapNextFrame;
    private float orbitYaw;
    private float orbitPitch;
    private float zoomOffset;
    private Vector3 freeInspectLookTarget;
    private bool hasFreeInspectLookTarget;
    private Vector3 visualBoundsCenter;
    private Vector3 visualBoundsCenterLocal;
    private float visualBoundsRadius;
    private bool hasVisualBounds;
    private bool isVisualBoundsDirty = true;
    private int visualBoundsRefreshCount;
    private Vector3 visualBoundsCenterOffsetFromCom;
    private readonly List<Renderer> visualBoundsRenderers = new List<Renderer>(32);
    private Vector3 focusPoint;
    private string focusSourceLabel = "TargetPosition";
    private Rigidbody targetRigidbody;
    private PrototypeCameraAnchor targetAnchor;
    private Transform namedFocusAnchor;
    private string namedFocusAnchorLabel = "TargetPosition";

    private float baseFollowDistance;
    private float effectiveFollowDistance;
    private float baseVisualBoundsRadius;
    private float anchorError;

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
    public Vector3 FocusPoint => focusPoint;
    public string FocusSourceLabel => focusSourceLabel;
    public string CameraFocusSource => focusSourceLabel;
    public Vector3 VisualBoundsCenter => visualBoundsCenter;
    public float VisualBoundsRadius => visualBoundsRadius;
    public Vector3 VisualBoundsCenterOffsetFromCom => visualBoundsCenterOffsetFromCom;
    public int VisualBoundsRefreshCount => visualBoundsRefreshCount;
    public string TargetName => target != null ? target.name : string.Empty;
    public bool HasVisualBounds => hasVisualBounds;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        EnsureCamera();
        target = newTarget;
        targetStats = stats;
        ResolveTargetHierarchyReferences();
        MarkVisualBoundsDirty();
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
        MarkVisualBoundsDirty();
        RefreshVisualBoundsIfNeeded();

        if (target == null)
        {
            return;
        }

        RefreshFocusPoint();

        if (cameraMode == CameraViewMode.FreeInspect)
        {
            freeInspectLookTarget = focusPoint;
            hasFreeInspectLookTarget = true;
        }

        snapNextFrame = true;
    }

    public void MarkVisualBoundsDirty()
    {
        isVisualBoundsDirty = true;
    }

    public void InvalidateVisualBounds()
    {
        MarkVisualBoundsDirty();
    }

    private void SetCameraMode(CameraViewMode nextMode)
    {
        if (cameraMode == nextMode)
        {
            return;
        }

        if (nextMode == CameraViewMode.FreeInspect)
        {
            freeInspectLookTarget = GetFocusPoint();
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
        EnsureCamera();

        if (target == null)
        {
            anchorError = 0f;
            return;
        }

        RefreshVisualBoundsIfNeeded();
        UpdateCachedVisualBoundsWorldSpace();
        RefreshFocusPoint();

        float followHeight = targetStats != null ? targetStats.FollowHeight : height;
        float baseDistance = ResolveBaseDistance(followHeight);
        Vector3 lookTarget = GetLookTargetFromMode(cameraMode);
        Vector3 viewDirection = GetViewDirectionFromPivot(cameraMode, followHeight, baseDistance);
        float followDistance = ResolveEffectiveDistance(baseDistance, lookTarget, viewDirection);
        Vector3 desiredPosition = lookTarget + viewDirection * followDistance;

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

        float rawDistance = targetStats != null ? targetStats.FollowDistance : distance;
        baseVisualBoundsRadius = hasVisualBounds ? visualBoundsRadius : 0f;

        if (hasVisualBounds)
        {
            float visualDistance = CalculatePerspectiveFitDistance(baseVisualBoundsRadius) + followHeight;
            rawDistance = Mathf.Max(rawDistance, visualDistance);
        }

        baseFollowDistance = Mathf.Clamp(rawDistance, minDistance, maxDistance);
        return baseFollowDistance;
    }

    private float ResolveEffectiveDistance(float baseDistance, Vector3 pivot, Vector3 viewDirection)
    {
        float minDistance = Mathf.Max(0.1f, anchoredModeDistanceClampMin);
        float maxDistance = Mathf.Max(minDistance, anchoredModeDistanceClampMax);
        float safeMinDistance = ResolveSafeVisualDistance(pivot, viewDirection, minDistance);
        float effectiveMaxDistance = Mathf.Max(maxDistance, safeMinDistance);
        effectiveFollowDistance = Mathf.Clamp(baseDistance + zoomOffset, safeMinDistance, effectiveMaxDistance);
        return effectiveFollowDistance;
    }

    private float ResolveSafeVisualDistance(Vector3 pivot, Vector3 viewDirection, float fallbackMinDistance)
    {
        if (!hasVisualBounds || visualBoundsRadius <= 0.01f || viewDirection.sqrMagnitude <= 0.01f)
        {
            return fallbackMinDistance;
        }

        Vector3 ray = viewDirection.normalized;
        Vector3 pivotToBoundsCenter = pivot - visualBoundsCenter;
        float safeRadius = visualBoundsRadius + visualBoundsMinZoomPadding + (attachedCamera != null ? attachedCamera.nearClipPlane : 0f);
        float b = Vector3.Dot(pivotToBoundsCenter, ray);
        float c = Vector3.Dot(pivotToBoundsCenter, pivotToBoundsCenter) - (safeRadius * safeRadius);

        if (c >= 0f && b >= 0f)
        {
            return fallbackMinDistance;
        }

        float discriminant = (b * b) - c;
        if (discriminant <= 0f)
        {
            return fallbackMinDistance;
        }

        float farIntersection = -b + Mathf.Sqrt(discriminant);
        if (farIntersection <= 0f)
        {
            return fallbackMinDistance;
        }

        return Mathf.Max(fallbackMinDistance, farIntersection);
    }

    private Vector3 GetViewDirectionFromPivot(CameraViewMode mode, float followHeight, float baseDistance)
    {
        if (target == null)
        {
            return Vector3.back;
        }

        float distanceForAngle = Mathf.Max(1f, baseDistance);
        if (mode == CameraViewMode.ChaseLocked)
        {
            return (target.rotation * new Vector3(0f, followHeight, -distanceForAngle)).normalized;
        }

        Quaternion orbitRotation = Quaternion.AngleAxis(orbitYaw, Vector3.up) * Quaternion.AngleAxis(orbitPitch, Vector3.right);
        if (mode == CameraViewMode.Side)
        {
            return (orbitRotation * new Vector3(-distanceForAngle, followHeight, 0f)).normalized;
        }

        if (mode == CameraViewMode.FreeInspect)
        {
            return (orbitRotation * Vector3.back).normalized;
        }

        return (orbitRotation * new Vector3(0f, followHeight, -distanceForAngle)).normalized;
    }

    private Vector3 GetLookTargetFromMode(CameraViewMode mode)
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        if (mode == CameraViewMode.ChaseLocked || mode == CameraViewMode.OrbitInspect || mode == CameraViewMode.Side)
        {
            return GetFocusPoint();
        }

        if (mode == CameraViewMode.FreeInspect)
        {
            if (hasFreeInspectLookTarget)
            {
                return freeInspectLookTarget;
            }

            return GetFocusPoint();
        }

        return GetFocusPoint();
    }

    private Vector3 GetFocusPoint()
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        return focusPoint;
    }

    private float CalculatePerspectiveFitDistance(float radius)
    {
        if (radius <= 0.01f)
        {
            return distance;
        }

        if (attachedCamera == null || attachedCamera.orthographic)
        {
            return radius * 2f * Mathf.Max(1f, visualFramingPadding);
        }

        float verticalFov = Mathf.Max(1f, attachedCamera.fieldOfView) * Mathf.Deg2Rad;
        float horizontalFov = Camera.VerticalToHorizontalFieldOfView(attachedCamera.fieldOfView, Mathf.Max(0.01f, attachedCamera.aspect)) * Mathf.Deg2Rad;
        float limitingFov = Mathf.Max(1f * Mathf.Deg2Rad, Mathf.Min(verticalFov, horizontalFov));
        return (radius / Mathf.Sin(limitingFov * 0.5f)) * Mathf.Max(1f, visualFramingPadding);
    }

    private void EnsureCamera()
    {
        if (attachedCamera == null)
        {
            attachedCamera = GetComponent<Camera>();
        }
    }

    private Vector3 GetLookUp()
    {
        return cameraMode == CameraViewMode.ChaseLocked ? target.up : Vector3.up;
    }

    private Quaternion GetDesiredRotation(Vector3 cameraPosition)
    {
        float lookYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
        float lookPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
        Vector3 direction = GetFocusPoint() - cameraPosition;
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

    private void RefreshVisualBoundsIfNeeded()
    {
        if (!isVisualBoundsDirty)
        {
            return;
        }

        ResolveTargetHierarchyReferences();
        RefreshVisualBounds();
        isVisualBoundsDirty = false;
        visualBoundsRefreshCount++;
    }

    private void RefreshVisualBounds()
    {
        if (target == null)
        {
            hasVisualBounds = false;
            visualBoundsCenter = Vector3.zero;
            visualBoundsCenterLocal = Vector3.zero;
            visualBoundsRadius = 0f;
            visualBoundsCenterOffsetFromCom = Vector3.zero;
            focusPoint = Vector3.zero;
            focusSourceLabel = "None";
            return;
        }

        visualBoundsRenderers.Clear();
        target.GetComponentsInChildren(true, visualBoundsRenderers);
        bool hasBounds = false;
        Bounds combined = new Bounds(target.position, Vector3.zero);

        for (int i = 0; i < visualBoundsRenderers.Count; i++)
        {
            Renderer renderer = visualBoundsRenderers[i];
            if (!ShouldIncludeRendererInVisualBounds(renderer))
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
            visualBoundsCenterLocal = target.InverseTransformPoint(combined.center);
            visualBoundsRadius = combined.extents.magnitude;
        }
        else
        {
            visualBoundsCenter = target.position;
            visualBoundsCenterLocal = Vector3.zero;
            visualBoundsRadius = 0f;
        }

        UpdateCachedVisualBoundsWorldSpace();
    }

    private void UpdateCachedVisualBoundsWorldSpace()
    {
        if (target == null)
        {
            visualBoundsCenterOffsetFromCom = Vector3.zero;
            return;
        }

        if (hasVisualBounds)
        {
            visualBoundsCenter = target.TransformPoint(visualBoundsCenterLocal);
            visualBoundsCenterOffsetFromCom = visualBoundsCenter - ResolveCenterOfMassOrTargetPosition();
        }
        else
        {
            visualBoundsCenter = target.position;
            visualBoundsCenterOffsetFromCom = Vector3.zero;
        }
    }

    private Vector3 ResolveCenterOfMassOrTargetPosition()
    {
        if (target == null)
        {
            return Vector3.zero;
        }

        return targetRigidbody != null ? targetRigidbody.worldCenterOfMass : target.position;
    }

    private bool ShouldIncludeRendererInVisualBounds(Renderer renderer)
    {
        if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
        {
            return false;
        }

        if (renderer.GetComponentInParent<PrototypeIgnoreCameraBounds>() != null)
        {
            return false;
        }

        string renderName = renderer.gameObject.name;
        for (int i = 0; i < VisualBoundsNameFilters.Length; i++)
        {
            if (renderName.IndexOf(VisualBoundsNameFilters[i], StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return false;
            }
        }

        return true;
    }

    private void RefreshFocusPoint()
    {
        if (target == null)
        {
            focusPoint = Vector3.zero;
            focusSourceLabel = "None";
            return;
        }

        if (cameraMode == CameraViewMode.ChaseLocked)
        {
            ResolveChaseFocusPoint();
        }
        else
        {
            ResolveNonChaseFocusPoint();
        }

        if (cameraMode == CameraViewMode.FreeInspect && !hasVisualBounds && !hasFreeInspectLookTarget)
        {
            freeInspectLookTarget = focusPoint;
            hasFreeInspectLookTarget = true;
        }
    }

    private void ResolveChaseFocusPoint()
    {
        if (targetAnchor != null)
        {
            focusPoint = targetAnchor.FocusPoint;
            focusSourceLabel = "CameraAnchor";
            return;
        }

        if (namedFocusAnchor != null)
        {
            focusPoint = namedFocusAnchor.position;
            focusSourceLabel = namedFocusAnchorLabel;
            return;
        }

        if (targetRigidbody != null)
        {
            focusPoint = targetRigidbody.worldCenterOfMass;
            focusSourceLabel = "Rigidbody.worldCenterOfMass";
            return;
        }

        focusPoint = target.position;
        focusSourceLabel = "TargetPosition";
    }

    private void ResolveNonChaseFocusPoint()
    {
        if (hasVisualBounds)
        {
            focusPoint = visualBoundsCenter;
            focusSourceLabel = "VisualBounds";
            return;
        }

        if (targetAnchor != null)
        {
            focusPoint = targetAnchor.FocusPoint;
            focusSourceLabel = "CameraAnchor";
            return;
        }

        if (targetRigidbody != null)
        {
            focusPoint = targetRigidbody.worldCenterOfMass;
            focusSourceLabel = "Rigidbody.worldCenterOfMass";
            return;
        }

        focusPoint = target.position;
        focusSourceLabel = "TargetPosition";
    }

    private void ResolveTargetHierarchyReferences()
    {
        if (target == null)
        {
            targetRigidbody = null;
            targetAnchor = null;
            namedFocusAnchor = null;
            namedFocusAnchorLabel = "TargetPosition";
            return;
        }

        targetRigidbody = target.GetComponent<Rigidbody>();
        targetAnchor = ResolveHighestPriorityAnchor();
        namedFocusAnchor = null;
        namedFocusAnchorLabel = "TargetPosition";

        if (targetAnchor == null)
        {
            Transform focusAnchor = FindDescendantByName(target.transform, "CameraFocusAnchor");
            if (focusAnchor != null)
            {
                namedFocusAnchor = focusAnchor;
                namedFocusAnchorLabel = "CameraFocusAnchor";
                return;
            }

            focusAnchor = FindDescendantByName(target.transform, "PrototypeCameraAnchor");
            if (focusAnchor != null)
            {
                namedFocusAnchor = focusAnchor;
                namedFocusAnchorLabel = "PrototypeCameraAnchor";
            }
        }
    }

    private PrototypeCameraAnchor ResolveHighestPriorityAnchor()
    {
        PrototypeCameraAnchor[] anchors = target.GetComponentsInChildren<PrototypeCameraAnchor>(true);
        PrototypeCameraAnchor best = null;
        int bestPriority = int.MinValue;

        for (int i = 0; i < anchors.Length; i++)
        {
            PrototypeCameraAnchor anchor = anchors[i];
            if (anchor == null || !anchor.isActiveAndEnabled)
            {
                continue;
            }

            if (best == null || anchor.Priority > bestPriority)
            {
                best = anchor;
                bestPriority = anchor.Priority;
            }
        }

        return best;
    }

    private static Transform FindDescendantByName(Transform root, string targetName)
    {
        for (int i = 0; i < root.childCount; i++)
        {
            Transform child = root.GetChild(i);
            if (string.Equals(child.name, targetName, StringComparison.Ordinal))
            {
                return child;
            }

            Transform match = FindDescendantByName(child, targetName);
            if (match != null)
            {
                return match;
            }
        }

        return null;
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
