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

    public enum AutopilotFlipChaseReferenceMode
    {
        ShipForward,
        VelocityOrPrevious,
        AutopilotDesiredBurnDirection
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
    [SerializeField] private float chaseLockedPositionSmooth = 16f;
    [SerializeField] private float chaseLockedRotationSmooth = 18f;
    [SerializeField] private float chaseLockedFocusSmooth = 20f;
    [SerializeField] private float autopilotFlipAngularVelocityThreshold = 1.5f;
    [SerializeField] private float autopilotFlipReferenceSpeedThreshold = 0.75f;
    [SerializeField] private float chaseLockedPositionSmoothFlipAssist = 80f;
    [SerializeField] private float chaseLockedRotationFlipAssist = 100f;
    [SerializeField] private float chaseLockedFocusSmoothFlipAssist = 0f;
    [SerializeField] private float autopilotFlipAssistReleaseDelay = 0.35f;
    [SerializeField] private float chaseViewportSafeXMin = 0.15f;
    [SerializeField] private float chaseViewportSafeXMax = 0.85f;
    [SerializeField] private float chaseViewportSafeYMin = 0.15f;
    [SerializeField] private float chaseViewportSafeYMax = 0.85f;
    [SerializeField] private AutopilotFlipChaseReferenceMode autopilotFlipChaseReferenceMode = AutopilotFlipChaseReferenceMode.VelocityOrPrevious;
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
    private PrototypeWaypointAutopilot targetAutopilot;
    private PrototypeCameraAnchor targetAnchor;
    private Transform namedFocusAnchor;
    private string namedFocusAnchorLabel = "TargetPosition";

    private float baseFollowDistance;
    private float effectiveFollowDistance;
    private float baseVisualBoundsRadius;
    private float anchorError;
    private CameraVisualBoundsData cachedVisualBoundsSnapshot;
    private int visualBoundsIncludedRendererCount;
    private bool hasPreviousFocusPoint;
    private Vector3 previousFocusPoint;
    private bool hasChaseLockedSmoothedFocusPoint;
    private Vector3 chaseLockedSmoothedFocusPoint;
    private Vector3 rawFocusPoint;
    private float lastFocusPointDelta;
    private bool lastChaseLockedSnap;
    private bool isAutopilotFlipCameraAssistActive;
    private float cameraAngularVelocityMagnitude;
    private bool hasPreviousChaseReferenceForward;
    private Vector3 previousChaseReferenceForward;
    private bool hasStableChaseUp;
    private Vector3 stableChaseUp = Vector3.up;
    private string cameraChaseBlendMode = "Normal";
    private Vector3 viewportTargetPosition = Vector3.zero;
    private Vector3 lastViewportPoint = Vector3.zero;
    private string lastViewportSafetyStatus = "NoViewportEval";
    private bool pendingViewportSafetySnap;
    private float autopilotFlipAssistReleaseTimer;

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
    public Vector3 RawFocusPoint => rawFocusPoint;
    public Vector3 SmoothedFocusPoint => hasChaseLockedSmoothedFocusPoint ? chaseLockedSmoothedFocusPoint : focusPoint;
    public float LastFocusPointDelta => lastFocusPointDelta;
    public bool LastChaseLockedSnap => lastChaseLockedSnap;
    public string FocusSourceLabel => focusSourceLabel;
    public string CameraFocusSource => focusSourceLabel;
    public Vector3 VisualBoundsCenter => visualBoundsCenter;
    public float VisualBoundsRadius => visualBoundsRadius;
    public Vector3 VisualBoundsCenterOffsetFromCom => visualBoundsCenterOffsetFromCom;
    public int VisualBoundsRefreshCount => visualBoundsRefreshCount;
    public int VisualBoundsRendererCount => cachedVisualBoundsSnapshot.includedRendererCount;
    public int VisualBoundsTotalRendererCount => cachedVisualBoundsSnapshot.totalRendererCount;
    public CameraVisualBoundsData VisualBoundsSnapshot => cachedVisualBoundsSnapshot;
    public string TargetName => target != null ? target.name : string.Empty;
    public bool HasVisualBounds => hasVisualBounds;
    public bool IsAutopilotFlipCameraAssistActive => isAutopilotFlipCameraAssistActive;
    public float CameraAngularVelocityMagnitude => cameraAngularVelocityMagnitude;
    public PrototypeWaypointAutopilotState CameraAutopilotState => targetAutopilot != null ? targetAutopilot.CurrentState : PrototypeWaypointAutopilotState.Idle;
    public string CameraChaseBlendMode => cameraChaseBlendMode;
    public Vector3 ViewportTargetPosition => viewportTargetPosition;
    public Vector3 LastViewportPoint => lastViewportPoint;
    public string LastViewportSafetyStatus => lastViewportSafetyStatus;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        EnsureCamera();
        target = newTarget;
        targetStats = stats;
        ResolveTargetHierarchyReferences();
        hasPreviousChaseReferenceForward = false;
        previousChaseReferenceForward = Vector3.zero;
        hasStableChaseUp = false;
        stableChaseUp = Vector3.up;
        autopilotFlipAssistReleaseTimer = 0f;
        isAutopilotFlipCameraAssistActive = false;
        MarkVisualBoundsDirty();
        freeInspectLookTarget = Vector3.zero;
        hasFreeInspectLookTarget = false;
        hasPreviousFocusPoint = false;
        ResetChaseLockedFocusSmoothing();
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
        ReframeToTargetVisualBounds(false);
    }

    public void PreviousCameraMode()
    {
        int previousMode = (int)cameraMode - 1;
        if (previousMode < 0)
        {
            previousMode = 3;
        }

        SetCameraMode((CameraViewMode)previousMode);
        ReframeToTargetVisualBounds(false);
    }

    public void ResetFraming()
    {
        cameraMode = CameraViewMode.ChaseLocked;
        orbitYaw = 0f;
        orbitPitch = 0f;
        zoomOffset = 0f;
        freeInspectLookTarget = Vector3.zero;
        hasFreeInspectLookTarget = false;
        ResetChaseLockedFocusSmoothing();
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

    public void ReframeToTargetVisualBounds(bool forceBoundsRefresh = true)
    {
        if (forceBoundsRefresh)
        {
            MarkVisualBoundsDirty();
            ResetChaseLockedFocusSmoothing();
        }

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

    public CameraVisualBoundsData CopyVisualBoundsSnapshot()
    {
        return cachedVisualBoundsSnapshot;
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
            hasPreviousFocusPoint = false;
            isAutopilotFlipCameraAssistActive = false;
            cameraAngularVelocityMagnitude = 0f;
            cameraChaseBlendMode = "NoTarget";
            lastViewportSafetyStatus = "NoTarget";
            return;
        }

        RefreshVisualBoundsIfNeeded();
        UpdateCachedVisualBoundsWorldSpace();
        RefreshFocusPoint();
        UpdateVisualBoundsSnapshot();
        UpdateAutopilotFlipAssistState();
        bool focusJumped = HasLargeFocusDiscontinuity();
        bool shouldSnapThisFrame = snapNextFrame || focusJumped || pendingViewportSafetySnap || Time.deltaTime <= Mathf.Epsilon;
        pendingViewportSafetySnap = false;

        float followHeight = targetStats != null ? targetStats.FollowHeight : height;
        float baseDistance = ResolveBaseDistance(followHeight);
        Vector3 lookTarget = GetLookTargetFromMode(cameraMode);
        if (cameraMode == CameraViewMode.ChaseLocked)
        {
            float effectiveChaseFocusSmooth = isAutopilotFlipCameraAssistActive
                ? chaseLockedFocusSmoothFlipAssist
                : chaseLockedFocusSmooth;
            lookTarget = ResolveChaseLockedLookTarget(lookTarget, shouldSnapThisFrame, effectiveChaseFocusSmooth);
        }

        Vector3 viewDirection = GetViewDirectionFromPivot(cameraMode, followHeight, baseDistance);
        float followDistance = ResolveEffectiveDistance(baseDistance, lookTarget, viewDirection);
        Vector3 desiredPosition = lookTarget + viewDirection * followDistance;
        UpdateViewportSafetyDiagnostics(lookTarget, isAutopilotFlipCameraAssistActive);
        if (isAutopilotFlipCameraAssistActive && !lastViewportSafetyStatus.Equals("Safe", StringComparison.Ordinal))
        {
            pendingViewportSafetySnap = true;
        }

        if (cameraMode == CameraViewMode.ChaseLocked)
        {
            Quaternion desiredRotation = GetDesiredRotation(desiredPosition, lookTarget, GetChaseUpReference());
            float chasePositionBlendRate = isAutopilotFlipCameraAssistActive
                ? chaseLockedPositionSmoothFlipAssist
                : chaseLockedPositionSmooth;
            float chaseRotationBlendRate = isAutopilotFlipCameraAssistActive
                ? chaseLockedRotationFlipAssist
                : chaseLockedRotationSmooth;
            float chasePositionBlend = shouldSnapThisFrame ? 1f : 1f - Mathf.Exp(-chasePositionBlendRate * Time.deltaTime);
            transform.position = Vector3.Lerp(transform.position, desiredPosition, chasePositionBlend);
            float chaseRotationBlend = shouldSnapThisFrame ? 1f : 1f - Mathf.Exp(-chaseRotationBlendRate * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, chaseRotationBlend);
            anchorError = Vector3.Distance(transform.position, desiredPosition);
            lastChaseLockedSnap = shouldSnapThisFrame;
            snapNextFrame = false;
            if (isAutopilotFlipCameraAssistActive)
            {
                CacheChaseAssistState();
                Vector3 referenceForward = ResolveChaseReferenceForward();
                if (referenceForward.sqrMagnitude > 0.0001f)
                {
                    previousChaseReferenceForward = referenceForward;
                    hasPreviousChaseReferenceForward = true;
                }
            }
            else
            {
                hasStableChaseUp = false;
            }

            cameraChaseBlendMode = isAutopilotFlipCameraAssistActive ? "AutopilotFlipAssist" : "ChaseLocked";
            RememberFocusPointForNextFrame();
            return;
        }

        float positionBlend = shouldSnapThisFrame ? 1f : 1f - Mathf.Exp(-positionSmooth * Time.deltaTime);
        transform.position = Vector3.Lerp(transform.position, desiredPosition, positionBlend);

        Vector3 direction = lookTarget - transform.position;
        if (direction.sqrMagnitude > 0.01f)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction, GetLookUp());
            float rotationBlend = shouldSnapThisFrame ? 1f : 1f - Mathf.Exp(-rotationSmooth * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationBlend);
        }

        anchorError = Vector3.Distance(transform.position, desiredPosition);
        lastChaseLockedSnap = false;
        cameraChaseBlendMode = "OrbitOrOther";
        snapNextFrame = false;
        RememberFocusPointForNextFrame();
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
            Quaternion chaseReferenceRotation = ResolveChaseReferenceRotation();
            return (chaseReferenceRotation * new Vector3(0f, followHeight, -distanceForAngle)).normalized;
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

    private Vector3 GetChaseUpReference()
    {
        if (!isAutopilotFlipCameraAssistActive || target == null)
        {
            return target != null ? target.up : Vector3.up;
        }

        return hasStableChaseUp ? stableChaseUp : Vector3.up;
    }

    private Quaternion GetDesiredRotation(Vector3 cameraPosition, Vector3 targetFocusPoint, Vector3 lookUp)
    {
        float lookYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
        float lookPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
        Vector3 direction = targetFocusPoint - cameraPosition;
        Quaternion anchorRotation = direction.sqrMagnitude > 0.01f
            ? Quaternion.LookRotation(direction, lookUp)
            : target.rotation;
        return anchorRotation * Quaternion.Euler(lookPitch, lookYaw, 0f);
    }

    private Vector3 ResolveChaseLockedLookTarget(Vector3 rawLookTarget, bool shouldSnapThisFrame, float focusBlendRate)
    {
        rawFocusPoint = rawLookTarget;
        if (!hasChaseLockedSmoothedFocusPoint || shouldSnapThisFrame)
        {
            lastFocusPointDelta = hasChaseLockedSmoothedFocusPoint
                ? Vector3.Distance(chaseLockedSmoothedFocusPoint, rawLookTarget)
                : 0f;
            chaseLockedSmoothedFocusPoint = rawLookTarget;
            hasChaseLockedSmoothedFocusPoint = true;
            return chaseLockedSmoothedFocusPoint;
        }

        Vector3 before = chaseLockedSmoothedFocusPoint;
        float focusBlend = focusBlendRate <= Mathf.Epsilon ? 1f : 1f - Mathf.Exp(-focusBlendRate * Time.deltaTime);
        chaseLockedSmoothedFocusPoint = Vector3.Lerp(chaseLockedSmoothedFocusPoint, rawLookTarget, focusBlend);
        lastFocusPointDelta = Vector3.Distance(before, chaseLockedSmoothedFocusPoint);
        return chaseLockedSmoothedFocusPoint;
    }

    private void ResetChaseLockedFocusSmoothing()
    {
        hasChaseLockedSmoothedFocusPoint = false;
        chaseLockedSmoothedFocusPoint = Vector3.zero;
        rawFocusPoint = Vector3.zero;
        lastFocusPointDelta = 0f;
        lastChaseLockedSnap = false;
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
            UpdateCachedVisualBoundsWorldSpace();
            return;
        }

        ResolveTargetHierarchyReferences();
        RefreshVisualBounds();
        isVisualBoundsDirty = false;
        visualBoundsRefreshCount++;
        UpdateVisualBoundsSnapshot();
    }

    private bool HasLargeFocusDiscontinuity()
    {
        if (!hasPreviousFocusPoint)
        {
            return false;
        }

        float snapThreshold = Mathf.Max(4f, Mathf.Max(effectiveFollowDistance * 0.5f, baseFollowDistance * 0.5f));
        return Vector3.Distance(previousFocusPoint, focusPoint) > snapThreshold;
    }

    private void RememberFocusPointForNextFrame()
    {
        previousFocusPoint = focusPoint;
        hasPreviousFocusPoint = true;
    }

    private void RefreshVisualBounds()
    {
        if (target == null)
        {
            visualBoundsRenderers.Clear();
            hasVisualBounds = false;
            visualBoundsCenter = Vector3.zero;
            visualBoundsCenterLocal = Vector3.zero;
            visualBoundsRadius = 0f;
            visualBoundsCenterOffsetFromCom = Vector3.zero;
            focusPoint = Vector3.zero;
            focusSourceLabel = "None";
            visualBoundsIncludedRendererCount = 0;
            return;
        }

        if (TryRefreshImportedShipVisualBounds())
        {
            return;
        }

        visualBoundsRenderers.Clear();
        target.GetComponentsInChildren(true, visualBoundsRenderers);
        bool hasBounds = false;
        int includedRendererCount = 0;
        Bounds combined = new Bounds(target.position, Vector3.zero);

        for (int i = 0; i < visualBoundsRenderers.Count; i++)
        {
            Renderer renderer = visualBoundsRenderers[i];
            if (!ShouldIncludeRendererInVisualBounds(renderer))
            {
                continue;
            }

            includedRendererCount++;
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

        visualBoundsIncludedRendererCount = includedRendererCount;
        UpdateCachedVisualBoundsWorldSpace();
    }

    private bool TryRefreshImportedShipVisualBounds()
    {
        Transform importedVisualRoot = target.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName);
        if (importedVisualRoot == null || !importedVisualRoot.gameObject.activeInHierarchy)
        {
            return false;
        }

        visualBoundsRenderers.Clear();
        importedVisualRoot.GetComponentsInChildren(true, visualBoundsRenderers);
        bool hasBounds = false;
        int includedRendererCount = 0;
        Bounds combined = new Bounds(target.position, Vector3.zero);

        for (int i = 0; i < visualBoundsRenderers.Count; i++)
        {
            Renderer renderer = visualBoundsRenderers[i];
            if (!PrototypeShipVisualBoundsUtility.IsImportedDemoShipBodyRenderer(renderer))
            {
                continue;
            }

            includedRendererCount++;
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

        if (!hasBounds)
        {
            return false;
        }

        hasVisualBounds = true;
        visualBoundsCenter = combined.center;
        visualBoundsCenterLocal = target.InverseTransformPoint(combined.center);
        visualBoundsRadius = combined.extents.magnitude;
        visualBoundsIncludedRendererCount = includedRendererCount;
        UpdateCachedVisualBoundsWorldSpace();
        return true;
    }

    private void UpdateVisualBoundsSnapshot()
    {
        cachedVisualBoundsSnapshot.snapshotVersion = visualBoundsRefreshCount;
        cachedVisualBoundsSnapshot.refreshCount = visualBoundsRefreshCount;
        cachedVisualBoundsSnapshot.totalRendererCount = visualBoundsRenderers.Count;
        cachedVisualBoundsSnapshot.includedRendererCount = visualBoundsIncludedRendererCount;
        cachedVisualBoundsSnapshot.hasVisualBounds = hasVisualBounds ? 1 : 0;
        cachedVisualBoundsSnapshot.visualBoundsCenter = visualBoundsCenter;
        cachedVisualBoundsSnapshot.visualBoundsCenterLocal = visualBoundsCenterLocal;
        cachedVisualBoundsSnapshot.visualBoundsRadius = visualBoundsRadius;
        cachedVisualBoundsSnapshot.visualBoundsCenterOffsetFromCom = visualBoundsCenterOffsetFromCom;
        cachedVisualBoundsSnapshot.focusPoint = focusPoint;
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

        rawFocusPoint = focusPoint;
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
            targetAutopilot = null;
            targetAnchor = null;
            namedFocusAnchor = null;
            namedFocusAnchorLabel = "TargetPosition";
            autopilotFlipAssistReleaseTimer = 0f;
            isAutopilotFlipCameraAssistActive = false;
            hasPreviousChaseReferenceForward = false;
            previousChaseReferenceForward = Vector3.zero;
            hasStableChaseUp = false;
            stableChaseUp = Vector3.up;
            return;
        }

        targetRigidbody = target.GetComponent<Rigidbody>();
        if (targetRigidbody == null)
        {
            targetRigidbody = target.GetComponentInParent<Rigidbody>();
        }

        if (targetRigidbody == null)
        {
            targetRigidbody = target.GetComponentInChildren<Rigidbody>(true);
        }

        targetAutopilot = target.GetComponent<PrototypeWaypointAutopilot>();
        if (targetAutopilot == null)
        {
            targetAutopilot = target.GetComponentInParent<PrototypeWaypointAutopilot>();
        }

        if (targetAutopilot == null)
        {
            targetAutopilot = target.GetComponentInChildren<PrototypeWaypointAutopilot>(true);
        }
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

    private void UpdateAutopilotFlipAssistState()
    {
        if (cameraMode != CameraViewMode.ChaseLocked)
        {
            autopilotFlipAssistReleaseTimer = 0f;
            isAutopilotFlipCameraAssistActive = false;
            lastViewportSafetyStatus = "NoAssist";
            cameraChaseBlendMode = "ChaseLocked";
            cameraAngularVelocityMagnitude = targetRigidbody != null ? targetRigidbody.angularVelocity.magnitude : 0f;
            return;
        }

        bool wasAutopilotFlipAssistActive = isAutopilotFlipCameraAssistActive;
        float previousAutopilotFlipReleaseTimer = autopilotFlipAssistReleaseTimer;

        if (targetRigidbody == null)
        {
            cameraAngularVelocityMagnitude = 0f;
        }
        else
        {
            cameraAngularVelocityMagnitude = targetRigidbody.angularVelocity.magnitude;
        }

        bool autopilotEngaged = targetAutopilot != null && targetAutopilot.AutopilotEngaged;
        bool isFlipForBrake = targetAutopilot != null && targetAutopilot.CurrentState == PrototypeWaypointAutopilotState.FlipForBrake;
        bool isBrake = targetAutopilot != null && targetAutopilot.CurrentState == PrototypeWaypointAutopilotState.Brake;
        bool hasHighAngularVelocity = cameraAngularVelocityMagnitude > autopilotFlipAngularVelocityThreshold;
        bool hasRawAutopilotFlipAssist = autopilotEngaged && (isFlipForBrake || (isBrake && hasHighAngularVelocity));

        if (hasRawAutopilotFlipAssist)
        {
            autopilotFlipAssistReleaseTimer = autopilotFlipAssistReleaseDelay;
        }
        else
        {
            autopilotFlipAssistReleaseTimer = Mathf.Max(0f, autopilotFlipAssistReleaseTimer - Time.deltaTime);
        }

        bool nextAutopilotFlipCameraAssistActive = hasRawAutopilotFlipAssist || autopilotFlipAssistReleaseTimer > 0f;
        bool didFlipAssistExpire = wasAutopilotFlipAssistActive && !nextAutopilotFlipCameraAssistActive && previousAutopilotFlipReleaseTimer > 0f;
        if (didFlipAssistExpire)
        {
            pendingViewportSafetySnap = true;
        }

        isAutopilotFlipCameraAssistActive = nextAutopilotFlipCameraAssistActive;

        if (!isAutopilotFlipCameraAssistActive)
        {
            lastViewportSafetyStatus = "NoAssist";
            cameraChaseBlendMode = "Normal";
        }
    }

    private void UpdateViewportSafetyDiagnostics(Vector3 lookTarget, bool isAssistActive)
    {
        viewportTargetPosition = lookTarget;

        if (!isAssistActive)
        {
            lastViewportPoint = Vector3.zero;
            lastViewportSafetyStatus = "NoAssist";
            return;
        }

        if (attachedCamera == null)
        {
            lastViewportPoint = Vector3.zero;
            lastViewportSafetyStatus = "NoCamera";
            return;
        }

        Vector3 viewportPoint = attachedCamera.WorldToViewportPoint(lookTarget);
        lastViewportPoint = viewportPoint;

        float safeXMin = Mathf.Clamp01(chaseViewportSafeXMin);
        float safeXMax = Mathf.Clamp01(chaseViewportSafeXMax);
        float safeYMin = Mathf.Clamp01(chaseViewportSafeYMin);
        float safeYMax = Mathf.Clamp01(chaseViewportSafeYMax);

        if (safeXMax < safeXMin)
        {
            float safeXSwap = safeXMin;
            safeXMin = safeXMax;
            safeXMax = safeXSwap;
        }

        if (safeYMax < safeYMin)
        {
            float safeYSwap = safeYMin;
            safeYMin = safeYMax;
            safeYMax = safeYSwap;
        }

        bool safeX = viewportPoint.x >= safeXMin && viewportPoint.x <= safeXMax;
        bool safeY = viewportPoint.y >= safeYMin && viewportPoint.y <= safeYMax;
        bool safeZ = viewportPoint.z > 0f;

        lastViewportSafetyStatus = (safeX && safeY && safeZ) ? "Safe" : "Unsafe";
    }

    private Quaternion ResolveChaseReferenceRotation()
    {
        if (target == null)
        {
            return Quaternion.identity;
        }

        Vector3 referenceForward = ResolveChaseReferenceForward();
        Vector3 chaseUp = GetChaseUpReference();
        if (referenceForward.sqrMagnitude <= 0.0001f)
        {
            referenceForward = target.forward;
        }

        if (Vector3.Cross(referenceForward, chaseUp).sqrMagnitude <= 0.0001f)
        {
            chaseUp = Vector3.up;
        }

        return Quaternion.LookRotation(referenceForward, chaseUp);
    }

    private Vector3 ResolveChaseReferenceForward()
    {
        if (target == null)
        {
            return Vector3.forward;
        }

        if (!isAutopilotFlipCameraAssistActive)
        {
            return target.forward;
        }

        switch (autopilotFlipChaseReferenceMode)
        {
            case AutopilotFlipChaseReferenceMode.ShipForward:
                return target.forward;
            case AutopilotFlipChaseReferenceMode.AutopilotDesiredBurnDirection:
                if (targetAutopilot != null && targetAutopilot.DesiredBurnDirection.sqrMagnitude > 0.0001f)
                {
                    return targetAutopilot.DesiredBurnDirection.normalized;
                }
                break;
            case AutopilotFlipChaseReferenceMode.VelocityOrPrevious:
            default:
                if (targetRigidbody != null
                    && targetRigidbody.linearVelocity.sqrMagnitude >= autopilotFlipReferenceSpeedThreshold * autopilotFlipReferenceSpeedThreshold)
                {
                    return -targetRigidbody.linearVelocity.normalized;
                }
                break;
        }

        if (hasPreviousChaseReferenceForward)
        {
            return previousChaseReferenceForward;
        }

        return target.forward;
    }

    private void CacheChaseAssistState()
    {
        stableChaseUp = hasPreviousChaseReferenceForward ? transform.up : Vector3.up;
        hasStableChaseUp = true;
    }
}
