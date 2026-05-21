#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeSimpleFollowCameraValidationTests
{
    private const BindingFlags NonPublicInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("CameraTarget");
        DestroyNamed("SimpleFollowCameraTestShip");
        DestroyNamed("SimpleFollowCameraTestCamera");
        DestroyNamed("Main Camera");
    }

    [Test]
    public void CameraModeCycleVisitsFreeInspectAndWraps()
    {
        SimpleFollowCamera camera = BuildCameraWithShip();
        Assert.That(camera.CameraMode, Is.EqualTo(0), "Default mode should be ChaseLocked.");

        camera.CycleCameraMode();
        Assert.That(camera.CameraMode, Is.EqualTo(1), "Next mode should be OrbitInspect.");
        camera.CycleCameraMode();
        Assert.That(camera.CameraMode, Is.EqualTo(2), "Next mode should be Side.");
        camera.CycleCameraMode();
        Assert.That(camera.CameraMode, Is.EqualTo(3), "Next mode should be FreeInspect.");
        camera.CycleCameraMode();
        Assert.That(camera.CameraMode, Is.EqualTo(0), "Next mode should wrap to ChaseLocked.");
    }

    [Test]
    public void ZoomAdjustsEffectiveDistanceWithoutMutatingShipStatsFollowDistance()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        float originalFollowDistance = stats.FollowDistance;
        InvokeLateUpdate(camera);
        float baseDistance = camera.BaseVisualDistance;

        camera.AdjustZoom(-4f);
        InvokeLateUpdate(camera);

        Assert.That(camera.EffectiveDistance, Is.LessThan(baseDistance - 0.01f));
        Assert.That(stats.FollowDistance, Is.EqualTo(originalFollowDistance).Within(0.0001f));
        Assert.That(camera.Zoom, Is.Not.EqualTo(0f));
    }

    [Test]
    public void ZoomInCannotPassThroughLargeVisualBounds()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject largeVisual = BuildVisualChild(ship, "SimpleFollowCameraLargeVisual", Vector3.one * 40f);
        camera.BindTarget(ship.transform, stats);

        camera.CycleCameraMode();
        camera.CycleCameraMode();
        camera.CycleCameraMode();
        camera.AdjustZoom(-1000f);
        InvokeLateUpdate(camera);

        float minBoundsZoomPadding = GetPrivateFloat(camera, "visualBoundsMinZoomPadding");
        Bounds visualBounds = largeVisual.GetComponent<Renderer>().bounds;
        float cameraDistanceFromVisualCenter = Vector3.Distance(camera.transform.position, visualBounds.center);

        Assert.That(camera.EffectiveDistance, Is.GreaterThanOrEqualTo(camera.BaseVisualBoundsRadius + minBoundsZoomPadding - 0.01f));
        Assert.That(cameraDistanceFromVisualCenter, Is.GreaterThan(camera.BaseVisualBoundsRadius), "Extreme zoom-in should keep the camera outside the visible ship bounds.");
    }

    [Test]
    public void OrbitZoomPreservesViewRayToVisualPivot()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 4f);
        visual.transform.localPosition = new Vector3(2f, 1f, 5f);
        camera.BindTarget(ship.transform, stats);
        camera.CycleCameraMode();
        InvokeLateUpdate(camera);

        Vector3 visualCenter = visual.GetComponent<Renderer>().bounds.center;
        Vector3 beforeRay = (camera.transform.position - visualCenter).normalized;

        camera.AdjustZoom(-3f);
        InvokeLateUpdate(camera);

        Vector3 afterRay = (camera.transform.position - visual.GetComponent<Renderer>().bounds.center).normalized;
        Assert.That(Vector3.Angle(beforeRay, afterRay), Is.LessThan(0.1f), "Zoom should dolly on the same ray instead of changing the framing anchor.");
    }

    [Test]
    public void HighestPriorityCameraAnchorWinsOverVisualBoundsForFocus()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 3f);
        visual.transform.localPosition = new Vector3(0f, 8f, 20f);
        PrototypeCameraAnchor lowAnchor = BuildCameraAnchor(ship, "LowCameraAnchor", new Vector3(-4f, 1f, 0f), 1);
        PrototypeCameraAnchor highAnchor = BuildCameraAnchor(ship, "HighCameraAnchor", new Vector3(3f, 2f, -1f), 10);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.That(camera.FocusSourceLabel, Is.EqualTo("CameraAnchor"));
        AssertVector(camera.FocusPoint, highAnchor.FocusPoint, 0.001f);
        Assert.That(Vector3.Distance(camera.FocusPoint, visual.GetComponent<Renderer>().bounds.center), Is.GreaterThan(1f));
        Assert.That(lowAnchor, Is.Not.Null);
    }

    [Test]
    public void RigidbodyCenterOfMassWinsWhenNoCameraAnchorExists()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        body.centerOfMass = new Vector3(1.5f, -0.25f, 2.25f);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 2f);
        visual.transform.localPosition = new Vector3(0f, 6f, 18f);
        SimpleFollowCamera camera = BuildCamera(ship);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.That(camera.FocusSourceLabel, Is.EqualTo("Rigidbody.worldCenterOfMass"));
        AssertVector(camera.FocusPoint, body.worldCenterOfMass, 0.001f);
        Assert.That(Vector3.Distance(camera.FocusPoint, visual.GetComponent<Renderer>().bounds.center), Is.GreaterThan(1f));
    }

    [Test]
    public void VisualBoundsDriveDistanceWithoutMovingAnchorFocus()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        PrototypeCameraAnchor anchor = BuildCameraAnchor(ship, "CameraAnchor", new Vector3(0f, 0.5f, 0f), 0);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraLargeOffsetVisual", Vector3.one * 30f);
        visual.transform.localPosition = new Vector3(0f, 0f, 35f);
        SimpleFollowCamera camera = BuildCamera(ship);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.That(camera.FocusSourceLabel, Is.EqualTo("CameraAnchor"));
        AssertVector(camera.FocusPoint, anchor.FocusPoint, 0.001f);
        Assert.True(camera.HasVisualBounds);
        Assert.That(camera.VisualBoundsRadius, Is.GreaterThan(10f));
        Assert.That(camera.BaseVisualDistance, Is.GreaterThan(stats.FollowDistance));
        Assert.That(Vector3.Distance(camera.VisualBoundsCenter, camera.FocusPoint), Is.GreaterThan(1f));
    }

    [Test]
    public void OrbitZoomPreservesViewRayToVisualPivotWhenAnchorExists()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        BuildCameraAnchor(ship, "CameraAnchor", new Vector3(0f, 1f, 0f), 0);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 4f);
        visual.transform.localPosition = new Vector3(4f, 2f, 12f);
        SimpleFollowCamera camera = BuildCamera(ship);

        camera.BindTarget(ship.transform, stats);
        camera.CycleCameraMode();
        InvokeLateUpdate(camera);

        Vector3 focus = camera.VisualBoundsCenter;
        Vector3 beforeRay = (camera.transform.position - focus).normalized;

        camera.AdjustZoom(-3f);
        InvokeLateUpdate(camera);

        Vector3 afterRay = (camera.transform.position - camera.VisualBoundsCenter).normalized;
        Assert.That(camera.FocusSourceLabel, Is.EqualTo("VisualBounds"));
        Assert.That(Vector3.Angle(beforeRay, afterRay), Is.LessThan(0.1f), "Orbit zoom should preserve the visual pivot ray even when ChaseLocked uses an anchor.");
    }

    [Test]
    public void DiagnosticsReportTargetFocusVisualBoundsAndDistance()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        PrototypeCameraAnchor anchor = BuildCameraAnchor(ship, "CameraAnchor", new Vector3(0f, 1f, 0f), 0);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraVisual", Vector3.one * 2f);
        visual.transform.localPosition = new Vector3(0f, 2f, 5f);
        SimpleFollowCamera camera = BuildCamera(ship);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.That(camera.TargetName, Is.EqualTo(ship.name));
        Assert.That(camera.FocusSourceLabel, Is.EqualTo("CameraAnchor"));
        AssertVector(camera.FocusPoint, anchor.FocusPoint, 0.001f);
        Assert.True(camera.HasVisualBounds);
        AssertVector(camera.VisualBoundsCenter, visual.GetComponent<Renderer>().bounds.center, 0.001f);
        Assert.That(camera.VisualBoundsRadius, Is.GreaterThan(0f));
        Assert.That(camera.EffectiveDistance, Is.GreaterThan(0f));
    }

    [Test]
    public void VisualBoundsCacheDoesNotRefreshUntilMarkedDirty()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraCachedVisual", Vector3.one * 2f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);
        int refreshCount = camera.VisualBoundsRefreshCount;
        float initialRadius = camera.VisualBoundsRadius;

        visual.transform.localScale = Vector3.one * 20f;
        InvokeLateUpdate(camera);
        InvokeLateUpdate(camera);

        Assert.That(camera.VisualBoundsRefreshCount, Is.EqualTo(refreshCount));
        Assert.That(camera.VisualBoundsRadius, Is.EqualTo(initialRadius).Within(0.001f));

        camera.MarkVisualBoundsDirty();
        InvokeLateUpdate(camera);

        Assert.That(camera.VisualBoundsRefreshCount, Is.EqualTo(refreshCount + 1));
        Assert.That(camera.VisualBoundsRadius, Is.GreaterThan(initialRadius));
    }

    [Test]
    public void CameraBoundsIgnoreVfxMarkersAndExplicitIgnoreComponents()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        BuildVisualChild(ship, "SimpleFollowCameraShipMesh", Vector3.one * 2f);
        BuildVisualChild(ship, "Huge_VFX_Debug_Marker", Vector3.one * 200f);
        GameObject ignored = BuildVisualChild(ship, "HugeVisibleIgnoredMesh", Vector3.one * 200f);
        ignored.AddComponent<PrototypeIgnoreCameraBounds>();

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.True(camera.HasVisualBounds);
        Assert.That(camera.VisualBoundsRadius, Is.LessThan(5f), "Ignored VFX/marker renderers should not inflate camera fit bounds.");
    }

    [Test]
    public void VisualBoundsReframeChangesBaseDistanceWithinConfiguredClamps()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        GameObject smallVisual = BuildVisualChild(ship, "SimpleFollowCameraSmallVisual", Vector3.one);
        camera.ReframeToTargetVisualBounds();
        InvokeLateUpdate(camera);
        float smallBoundsDistance = camera.BaseVisualDistance;
        Assert.That(smallBoundsDistance, Is.GreaterThan(0f));

        smallVisual.SetActive(false);
        GameObject largeVisual = BuildVisualChild(ship, "SimpleFollowCameraLargeVisual", Vector3.one * 40f);
        camera.ReframeToTargetVisualBounds();
        InvokeLateUpdate(camera);
        float largeBoundsDistance = camera.BaseVisualDistance;

        Assert.That(largeBoundsDistance, Is.GreaterThan(smallBoundsDistance));
        Assert.That(largeBoundsDistance, Is.GreaterThan(GetPrivateFloat(camera, "anchoredModeDistanceClampMin")));
        Assert.That(largeBoundsDistance, Is.AtMost(GetPrivateFloat(camera, "anchoredModeDistanceClampMax")));

        largeVisual.SetActive(false);
        smallVisual.SetActive(true);
        camera.ReframeToTargetVisualBounds();
        InvokeLateUpdate(camera);

        Assert.That(camera.BaseVisualDistance, Is.LessThan(largeBoundsDistance));
    }

    [Test]
    public void ChaseLockedAimsAtShipFocusWhenVisualBoundsAreOffset()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject offsetVisual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 2f);
        offsetVisual.transform.localPosition = new Vector3(0f, 3f, 10f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Vector3 toShipFocus = ship.transform.position - camera.transform.position;
        Vector3 toVisualCenter = offsetVisual.GetComponent<Renderer>().bounds.center - camera.transform.position;
        Assert.That(camera.FocusSourceLabel, Is.EqualTo("TargetPosition"));
        Assert.That(Vector3.Angle(camera.transform.forward, toShipFocus), Is.LessThan(1f), "Chase camera should stay anchored to the gameplay ship focus.");
        Assert.That(Vector3.Angle(camera.transform.forward, toVisualCenter), Is.GreaterThan(1f), "Offset imported visual bounds should not drag the ChaseLocked pivot.");
    }

    [Test]
    public void VisualBoundsAnchorFollowsMovingTarget()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject visual = BuildVisualChild(ship, "SimpleFollowCameraMovingVisual", Vector3.one * 2f);
        visual.transform.localPosition = new Vector3(0f, 2f, 6f);

        camera.BindTarget(ship.transform, stats);
        camera.CycleCameraMode();
        InvokeLateUpdate(camera);
        int refreshCount = camera.VisualBoundsRefreshCount;

        ship.transform.position = new Vector3(30f, 0f, 0f);
        InvokeLateUpdate(camera);

        Vector3 toVisualCenter = visual.GetComponent<Renderer>().bounds.center - camera.transform.position;
        Assert.That(camera.VisualBoundsRefreshCount, Is.EqualTo(refreshCount), "Moving the target should reuse cached renderer membership and transform the cached local bounds center.");
        Assert.That(Vector3.Angle(camera.transform.forward, toVisualCenter), Is.LessThan(1f), "Cached local visual bounds must follow the moving ship without a renderer hierarchy refresh.");
    }

    [Test]
    public void ResetFramingReturnsToChaseLockedAndDefaultOffsets()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        camera.CycleCameraMode();
        camera.CycleCameraMode();
        camera.CycleCameraMode();
        camera.AdjustZoom(-6f);
        camera.ReframeToTargetVisualBounds();
        InvokeLateUpdate(camera);
        Assert.That(camera.CameraMode, Is.EqualTo(3));

        camera.ResetFraming();
        InvokeLateUpdate(camera);

        Assert.That(camera.CameraMode, Is.EqualTo(0), "Reset should return to ChaseLocked.");
        Assert.That(camera.Zoom, Is.EqualTo(0f).Within(0.001f));
        Assert.That(camera.EffectiveDistance, Is.EqualTo(camera.BaseVisualDistance).Within(0.001f));
        Assert.That(camera.LookYaw, Is.EqualTo(0f).Within(0.001f));
        Assert.That(camera.LookPitch, Is.EqualTo(0f).Within(0.001f));
    }

    private static SimpleFollowCamera BuildCamera(GameObject ship)
    {
        GameObject cameraObject = new GameObject("SimpleFollowCameraTestCamera");
        Camera unityCamera = cameraObject.AddComponent<Camera>();
        unityCamera.tag = "MainCamera";
        return cameraObject.AddComponent<SimpleFollowCamera>();
    }

    private static SimpleFollowCamera BuildCameraWithShip()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, ship.GetComponent<ShipStats>());
        return camera;
    }

    private static GameObject BuildVisualChild(GameObject parent, string name, Vector3 scale)
    {
        GameObject visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
        visual.name = name;
        visual.transform.SetParent(parent.transform, false);
        visual.transform.localPosition = Vector3.zero;
        visual.transform.localScale = scale;
        return visual;
    }

    private static PrototypeCameraAnchor BuildCameraAnchor(GameObject parent, string name, Vector3 localPosition, int priority)
    {
        GameObject anchorObject = new GameObject(name);
        anchorObject.transform.SetParent(parent.transform, false);
        anchorObject.transform.localPosition = localPosition;
        PrototypeCameraAnchor anchor = anchorObject.AddComponent<PrototypeCameraAnchor>();
        FieldInfo priorityField = typeof(PrototypeCameraAnchor).GetField("priority", NonPublicInstance);
        Assert.NotNull(priorityField);
        priorityField.SetValue(anchor, priority);
        return anchor;
    }

    private static void AssertVector(Vector3 actual, Vector3 expected, float tolerance)
    {
        Assert.That(Vector3.Distance(actual, expected), Is.LessThanOrEqualTo(tolerance), $"Expected {expected}, got {actual}.");
    }

    private static void InvokeLateUpdate(SimpleFollowCamera camera)
    {
        MethodInfo lateUpdate = typeof(SimpleFollowCamera).GetMethod("LateUpdate", NonPublicInstance);
        Assert.NotNull(lateUpdate, "SimpleFollowCamera LateUpdate method should exist for test update.");
        lateUpdate.Invoke(camera, null);
    }

    private static float GetPrivateFloat(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
        Assert.NotNull(field, fieldName);
        return (float)field.GetValue(target);
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif
