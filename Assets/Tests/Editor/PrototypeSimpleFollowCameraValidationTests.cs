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
    public void CameraModeCycleReframesWithoutForcingVisualBoundsRefresh()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        BuildVisualChild(ship, "SimpleFollowCameraModeCycleVisual", Vector3.one * 2f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);
        int refreshCount = camera.VisualBoundsRefreshCount;

        camera.CycleCameraMode();
        InvokeLateUpdate(camera);
        camera.CycleCameraMode();
        InvokeLateUpdate(camera);

        Assert.That(camera.VisualBoundsRefreshCount, Is.EqualTo(refreshCount));
        Assert.That(camera.CameraMode, Is.EqualTo(2));
    }

    [Test]
    public void VisualBoundsSnapshotIsStableInSteadyStateAndUpdatesOnlyOnDirtyRefresh()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        BuildVisualChild(ship, "SimpleFollowCameraSnapshotVisual", Vector3.one * 2f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);
        CameraVisualBoundsData initialSnapshot = camera.CopyVisualBoundsSnapshot();
        int initialRefreshCount = initialSnapshot.refreshCount;
        int initialSnapshotVersion = initialSnapshot.snapshotVersion;
        int initialRendererCount = initialSnapshot.includedRendererCount;

        InvokeLateUpdate(camera);
        InvokeLateUpdate(camera);
        CameraVisualBoundsData steadySnapshot = camera.CopyVisualBoundsSnapshot();

        Assert.That(steadySnapshot.refreshCount, Is.EqualTo(initialRefreshCount));
        Assert.That(steadySnapshot.snapshotVersion, Is.EqualTo(initialSnapshotVersion));
        Assert.That(steadySnapshot.includedRendererCount, Is.EqualTo(initialRendererCount));
        Assert.That(steadySnapshot.totalRendererCount, Is.GreaterThanOrEqualTo(initialRendererCount));
        Assert.That(steadySnapshot.visualBoundsRadius, Is.EqualTo(initialSnapshot.visualBoundsRadius).Within(0.001f));

        camera.MarkVisualBoundsDirty();
        InvokeLateUpdate(camera);
        CameraVisualBoundsData refreshedSnapshot = camera.CopyVisualBoundsSnapshot();

        Assert.That(refreshedSnapshot.refreshCount, Is.EqualTo(initialRefreshCount + 1));
        Assert.That(refreshedSnapshot.snapshotVersion, Is.EqualTo(initialSnapshotVersion + 1));
        Assert.That(refreshedSnapshot.includedRendererCount, Is.EqualTo(initialRendererCount));
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
    public void ImportedVisualBoundsPreferDemoShipMeshesOverSocketMarkers()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject importedRoot = new GameObject(PrototypeFunctionalShipBinder.ImportedVisualRootName);
        importedRoot.transform.SetParent(ship.transform, false);
        GameObject importedVisual = new GameObject("ImportedDemoScoutVisual");
        importedVisual.transform.SetParent(importedRoot.transform, false);
        GameObject hull = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_GEO_Hull_Core_Faceted", new Vector3(2f, 1f, 4f));
        GameObject socketMarker = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_SOCKET_CAMERA_BOUNDS_SENTINEL", Vector3.one);
        socketMarker.transform.localPosition = new Vector3(0f, 0f, 60f);
        GameObject connectorMarker = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_VIS_PART_Wing_CONN_PORT", Vector3.one);
        connectorMarker.transform.localPosition = new Vector3(0f, 0f, -60f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Assert.True(camera.HasVisualBounds);
        Assert.That(camera.VisualBoundsRendererCount, Is.EqualTo(1));
        Assert.That(camera.VisualBoundsRadius, Is.LessThan(3f));
        AssertVector(camera.VisualBoundsCenter, hull.GetComponent<Renderer>().bounds.center, 0.001f);
    }

    [Test]
    public void ImportedVisualBoundsHandleRealScoutRendererNames()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SimpleFollowCamera camera = BuildCamera(ship);
        GameObject importedRoot = new GameObject(PrototypeFunctionalShipBinder.ImportedVisualRootName);
        importedRoot.transform.SetParent(ship.transform, false);
        GameObject importedVisual = new GameObject("ImportedDemoScoutVisual");
        importedVisual.transform.SetParent(importedRoot.transform, false);
        GameObject hull = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_GEO_Hull_Core_Faceted", new Vector3(2f, 1f, 4f));
        GameObject barrel = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_GEO_Gun_Barrel", new Vector3(0.35f, 0.35f, 1.6f));
        barrel.transform.localPosition = new Vector3(0f, 0.5f, 0.6f);
        GameObject mainNozzleMarker = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_PART_Main_Engine_Bell_Mk1_THRUST_NOZZLE_MAIN", Vector3.one);
        mainNozzleMarker.transform.localPosition = new Vector3(0f, 0f, 70f);
        GameObject rcsNozzleMarker = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_PART_RCS_Pod_4Way_Mk1_Port_RCS_NOZZLE_UP", Vector3.one);
        rcsNozzleMarker.transform.localPosition = new Vector3(0f, 0f, -70f);
        GameObject connectorMarker = BuildVisualChild(importedVisual, "DEMO_Scout_Mk1_VIS_PART_Wing_CONN_PORT", Vector3.one);
        connectorMarker.transform.localPosition = new Vector3(70f, 0f, 0f);

        camera.BindTarget(ship.transform, stats);
        InvokeLateUpdate(camera);

        Bounds expected = hull.GetComponent<Renderer>().bounds;
        expected.Encapsulate(barrel.GetComponent<Renderer>().bounds);

        Assert.True(camera.HasVisualBounds);
        Assert.That(camera.VisualBoundsRendererCount, Is.EqualTo(2));
        Assert.That(camera.VisualBoundsRadius, Is.LessThan(3f));
        AssertVector(camera.VisualBoundsCenter, expected.center, 0.001f);
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
    public void ChaseLockedDoesNotEnterAutopilotFlipAssistFromIdleAngularVelocity()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        body.angularVelocity = Vector3.up * 8f;
        ship.AddComponent<PrototypeWaypointAutopilot>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        InvokeLateUpdate(camera);

        Assert.False(camera.IsAutopilotFlipCameraAssistActive, "Idle/cruise spin must not activate brake-flip chase framing.");
        Assert.That(camera.CameraAutopilotState, Is.EqualTo(PrototypeWaypointAutopilotState.Idle));
        Assert.That(camera.CameraChaseBlendMode, Is.Not.EqualTo("AutopilotFlipAssist"));
    }

    [Test]
    public void AssistRotationSignalIncludesMomentumAssistAndCameraConsumesIt()
    {
        GameObject ship = BuildAssistRotationShip();
        ShipStats stats = ship.GetComponent<ShipStats>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        SetPrivateField(momentum, "isActive", true);
        SetPrivateField(momentum, "currentState", PrototypeMomentumAssistState.AlignForBrake);
        SetPrivateProperty(momentum, "LastBrakeDirectionWorld", Vector3.left);
        controller.UpdateAssistRotationCameraSignal(0.02f);
        InvokeLateUpdate(camera);

        Assert.True(controller.IsAssistRotationActive, "Momentum assist align/main-brake states should feed the shared camera signal.");
        Assert.True(camera.IsAutopilotFlipCameraAssistActive, "Camera should consume the shared assist-rotation signal.");
        Assert.That(camera.CameraChaseBlendMode, Is.EqualTo("AssistRotation"));
        Assert.That(Vector3.Angle(controller.AssistRotationReferenceDirection, Vector3.left), Is.LessThan(0.1f));
    }

    [Test]
    public void MomentumAssistActivationBeforeFixedUpdateUsesCurrentVelocityInsteadOfStaleForward()
    {
        GameObject ship = BuildAssistRotationShip();
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        Vector3[] velocities =
        {
            Vector3.right * 12f,
            Vector3.forward * 12f
        };

        for (int i = 0; i < velocities.Length; i++)
        {
            body.linearVelocity = velocities[i];
            SetPrivateField(momentum, "isActive", true);
            SetPrivateField(momentum, "currentState", PrototypeMomentumAssistState.AlignForBrake);
            SetPrivateProperty(momentum, "LastBrakeDirectionWorld", Vector3.forward);

            controller.UpdateAssistRotationCameraSignal(0.02f);

            Assert.True(controller.IsAssistRotationActive, "Activation before MomentumAssist.FixedUpdate should still expose a camera assist signal.");
            Assert.True(controller.HasAssistRotationReferenceDirection, "Sideways/forward velocity should produce a usable brake reference immediately.");
            Assert.That(Vector3.Angle(controller.AssistRotationReferenceDirection, -velocities[i].normalized), Is.LessThan(0.1f));
            Assert.That(Vector3.Angle(controller.AssistRotationReferenceDirection, Vector3.forward), Is.GreaterThan(80f), "The default LastBrakeDirectionWorld forward value must not be accepted when current velocity says to brake another way.");
        }
    }

    [Test]
    public void CameraLateUpdateReadsAssistRotationSignalWithoutReleasingControllerHysteresis()
    {
        GameObject ship = BuildAssistRotationShip();
        ShipStats stats = ship.GetComponent<ShipStats>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        SetPrivateField(autopilot, "autopilotEngaged", true);
        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.FlipForBrake);
        controller.UpdateAssistRotationCameraSignal(0.02f);
        Assert.True(controller.IsAssistRotationActive);

        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.Idle);
        for (int i = 0; i < 8; i++)
        {
            InvokeLateUpdate(camera);
        }

        Assert.True(controller.IsAssistRotationActive, "Camera LateUpdate should be a read-only consumer and must not decrement controller release timers.");
        Assert.True(camera.IsAutopilotFlipCameraAssistActive, "Camera should continue to report the current controller-owned assist state.");

        controller.UpdateAssistRotationCameraSignal(1f);
        InvokeLateUpdate(camera);
        Assert.False(controller.IsAssistRotationActive, "Controller FixedUpdate/test calls should remain the sole owner of release timing.");
    }

    [Test]
    public void AssistRotationNearZeroVelocityFallsBackToLastStableChaseDirection()
    {
        GameObject ship = BuildAssistRotationShip();
        ShipStats stats = ship.GetComponent<ShipStats>();
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        SimpleFollowCamera camera = BuildCamera(ship);
        camera.BindTarget(ship.transform, stats);

        InvokeLateUpdate(camera);
        Vector3 stableDirection = ship.transform.forward;

        ship.transform.rotation = Quaternion.LookRotation(Vector3.right, Vector3.up);
        body.linearVelocity = Vector3.zero;
        body.angularVelocity = Vector3.up * 5f;
        SetPrivateField(autopilot, "autopilotEngaged", true);
        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.Brake);

        controller.UpdateAssistRotationCameraSignal(0.02f);
        InvokeLateUpdate(camera);

        Vector3 referenceForward = InvokeResolveChaseReferenceForward(camera);
        Assert.True(camera.IsAutopilotFlipCameraAssistActive, "Brake plus high angular rate should enter assist rotation.");
        Assert.False(controller.HasAssistRotationReferenceDirection, "Zero velocity with no assist reference should not synthesize a degenerate reference.");
        Assert.That(Vector3.Angle(referenceForward, stableDirection), Is.LessThan(0.1f), "Near-zero velocity should preserve the last stable camera direction instead of snapping to current ship forward.");
    }

    [Test]
    public void AssistRotationHysteresisHoldsAutopilotSourceAcrossBriefStateDrop()
    {
        GameObject ship = BuildAssistRotationShip();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();

        SetPrivateField(autopilot, "autopilotEngaged", true);
        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.FlipForBrake);
        controller.UpdateAssistRotationCameraSignal(0.02f);
        Assert.True(controller.IsAssistRotationActive);

        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.AlignForBurn);
        SetPrivateField(autopilot, "desiredBurnDirection", ship.transform.forward);
        controller.UpdateAssistRotationCameraSignal(0.1f);
        Assert.True(controller.IsAssistRotationActive, "Autopilot assist should hold through a short replan/state gap.");

        controller.UpdateAssistRotationCameraSignal(1f);
        Assert.False(controller.IsAssistRotationActive, "Autopilot assist should release after the hysteresis window expires.");
    }

    [Test]
    public void AssistRotationHysteresisWaitsForAngularVelocityReleaseGate()
    {
        GameObject ship = BuildAssistRotationShip();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        Rigidbody body = ship.GetComponent<Rigidbody>();

        body.linearVelocity = Vector3.forward * 20f;
        body.angularVelocity = Vector3.up * 8f;
        SetPrivateField(autopilot, "autopilotEngaged", true);
        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.FlipForBrake);
        controller.UpdateAssistRotationCameraSignal(0.02f);
        Assert.True(controller.IsAssistRotationActive);

        SetPrivateProperty(autopilot, "CurrentState", PrototypeWaypointAutopilotState.AlignForBurn);
        SetPrivateField(autopilot, "desiredBurnDirection", ship.transform.forward);
        controller.UpdateAssistRotationCameraSignal(10f);
        Assert.True(
            controller.IsAssistRotationActive,
            "Autopilot assist should stay latched after source drop while angular velocity remains above the release gate.");

        body.angularVelocity = Vector3.zero;
        controller.UpdateAssistRotationCameraSignal(0.02f);
        Assert.False(controller.IsAssistRotationActive, "Autopilot assist should release once the delay has elapsed and angular velocity is below the gate.");
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

    private static GameObject BuildAssistRotationShip()
    {
        GameObject ship = new GameObject("SimpleFollowCameraTestShip");
        ship.AddComponent<Rigidbody>().useGravity = false;
        ship.AddComponent<ShipStats>();
        ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<RcsThrusterController>();
        ship.AddComponent<ShipPhysicsCore>();
        ship.AddComponent<WeaponRecoilStabilizer>();
        PlayerShipController controller = ship.AddComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.AddComponent<PrototypeWaypointAutopilot>();
        PrototypeMomentumAssist momentum = ship.AddComponent<PrototypeMomentumAssist>();
        momentum.Bind(controller, ship.GetComponent<Rigidbody>(), ship.GetComponent<ShipStats>());
        Assert.NotNull(autopilot);
        return ship;
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

    private static Vector3 InvokeResolveChaseReferenceForward(SimpleFollowCamera camera)
    {
        MethodInfo method = typeof(SimpleFollowCamera).GetMethod("ResolveChaseReferenceForward", NonPublicInstance);
        Assert.NotNull(method, "SimpleFollowCamera ResolveChaseReferenceForward method should exist for reference tests.");
        return (Vector3)method.Invoke(camera, null);
    }

    private static float GetPrivateFloat(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
        Assert.NotNull(field, fieldName);
        return (float)field.GetValue(target);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateProperty<T>(object target, string propertyName, T value)
    {
        PropertyInfo property = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(property, propertyName);
        property.SetValue(target, value);
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
