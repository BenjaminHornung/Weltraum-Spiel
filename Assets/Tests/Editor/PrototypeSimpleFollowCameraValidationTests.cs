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
    public void ChaseLockedAimsAtOffsetVisualBoundsCenter()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject offsetVisual = BuildVisualChild(ship, "SimpleFollowCameraOffsetVisual", Vector3.one * 2f);
        offsetVisual.transform.localPosition = new Vector3(0f, 3f, 10f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Vector3 toVisualCenter = offsetVisual.GetComponent<Renderer>().bounds.center - camera.transform.position;
        Assert.That(Vector3.Angle(camera.transform.forward, toVisualCenter), Is.LessThan(1f), "Chase camera should frame the visual bounds center, not just the gameplay transform origin.");
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
        InvokeLateUpdate(camera);

        ship.transform.position = new Vector3(30f, 0f, 0f);
        InvokeLateUpdate(camera);

        Vector3 toVisualCenter = visual.GetComponent<Renderer>().bounds.center - camera.transform.position;
        Assert.That(Vector3.Angle(camera.transform.forward, toVisualCenter), Is.LessThan(1f), "World-space Renderer.bounds must be refreshed while the ship moves, or the camera anchors to stale space.");
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
