#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeShipVisualSwitcherValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("VariantTestBootstrap");
        DestroyNamed("PrototypeShipVisualSwitcher");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");
        DestroyNamed("GameplaySwitcherHost");
        DestroyNamed("StaleCameraTarget");
        DestroyNamed("OldMainCamera");
        DestroyNamed("InvisibleImportedVisual");
    }

    [Test]
    public void ImportedScoutVisualKeepsGameplayRigAndCanReturnToGeneratedPrimitives()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);

        Transform visualRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(visualRoot);
        Assert.NotNull(visualRoot.GetComponentInChildren<Renderer>(true));
        Assert.False(HasDescendantNameContaining(visualRoot, "Blank_MountPlate_Underside"));
        Assert.False(HasDescendantNameContaining(visualRoot, "Mount_Rails_ForeAft"));
        Assert.That(CountDescendantNamesContaining(visualRoot, "GEO_RCS_Nozzle_Up"), Is.EqualTo(4));
        Assert.That(CountDescendantNamesContaining(visualRoot, "GEO_RCS_Nozzle_Down"), Is.EqualTo(4));
        Assert.False(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
        Assert.That(ship.GetComponent<RcsThrusterController>().InstalledNozzleCount, Is.EqualTo(20));

        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);

        visualRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(visualRoot, "Imported visual root is pooled after first use.");
        Assert.False(visualRoot.gameObject.activeSelf);
        Transform hullKitRoot = ship.transform.Find("Hull").Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.NotNull(hullKitRoot);
        Assert.False(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
        Assert.True(AllRenderersEnabled(hullKitRoot));
    }

    [Test]
    public void RuntimeBootstrapBaselineResetKeepsImportedFunctionalDefault()
    {
        GameObject ship = BuildBaselineShip();
        PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
        Assert.NotNull(bootstrap);
        bootstrap.SetBuildMode(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault, false);
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        Assert.NotNull(ship.transform.Find("ImportedShipVisual"));

        MethodInfo resetMethod = typeof(PrototypeShipVisualSwitcher).GetMethod(
            "ResetForRuntimeBaseline",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(resetMethod);
        resetMethod.Invoke(switcher, null);

        Assert.That(switcher.SelectedVisualMode, Is.EqualTo(PrototypeShipVisualMode.ImportedDemoScout));
        Transform importedRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(importedRoot, "Runtime reset keeps imported visuals active for the default functional ship.");
        Assert.True(importedRoot.gameObject.activeSelf);
        Assert.False(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
    }

    [Test]
    public void SwitchingGeneratedImportedGeneratedModesDoesNotReEnableModuleRootRenderers()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();
        Renderer rootRenderer = ship.transform.Find("Hull").GetComponent<Renderer>();
        Assert.NotNull(rootRenderer);

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        Assert.False(rootRenderer.enabled);
        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);
        Assert.False(rootRenderer.enabled);

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoCargo);
        Assert.False(rootRenderer.enabled);
        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);
        Assert.False(rootRenderer.enabled);

        Transform hullKitRoot = ship.transform.Find("Hull").Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.True(AllRenderersEnabled(hullKitRoot));
    }

    [Test]
    public void GeneratedVisualHullBoundsAreNotDoubleScaled()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();
        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);

        Transform hull = ship.transform.Find("Hull");
        Transform hullKitRoot = hull.Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.NotNull(hullKitRoot);

        Renderer[] kitRenderers = CollectRenderers(hullKitRoot);
        Assert.That(kitRenderers.Length, Is.GreaterThan(0));
        Bounds bounds = CombineBounds(kitRenderers);

        Assert.That(bounds.size.x, Is.LessThanOrEqualTo(hull.localScale.x * 2.5f));
        Assert.That(bounds.size.y, Is.LessThanOrEqualTo(hull.localScale.y * 2.5f));
        Assert.That(bounds.size.z, Is.LessThanOrEqualTo(hull.localScale.z * 2.5f));
    }

    [Test]
    public void ImportedCargoVisualAlignsWithUnityForwardAndUp()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoCargo);

        Transform visualRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(visualRoot);
        Assert.False(HasDescendantNameContaining(visualRoot, "Blank_MountPlate_Underside"));
        Assert.False(HasDescendantNameContaining(visualRoot, "Mount_Rails_ForeAft"));
        Assert.That(CountDescendantNamesContaining(visualRoot, "GEO_RCS_Nozzle_Up"), Is.EqualTo(4));
        Assert.That(CountDescendantNamesContaining(visualRoot, "GEO_RCS_Nozzle_Down"), Is.EqualTo(4));
        Assert.That(CountDescendantNamesContaining(visualRoot, "FuelTank_Left_SideSaddle"), Is.EqualTo(1));
        Assert.That(CountDescendantNamesContaining(visualRoot, "FuelTank_Right_SideSaddle"), Is.EqualTo(1));
        Assert.That(CountDescendantNamesContaining(visualRoot, "FuelTank_Left_") + CountDescendantNamesContaining(visualRoot, "FuelTank_Right_"), Is.GreaterThanOrEqualTo(10));

        Transform cockpit = FindDeep(visualRoot, "DEMO_Cargo_Mk1_PART_Cockpit_Wedge_Mk1");
        Transform engine = FindDeep(visualRoot, "DEMO_Cargo_Mk1_PART_Main_Engine_Bell_Mk1");
        Transform topPanel = FindDeep(visualRoot, "DEMO_Cargo_Mk1_GEO_Hull_Core_TopPanel_0.32");

        Assert.NotNull(cockpit);
        Assert.NotNull(engine);
        Assert.NotNull(topPanel);

        Vector3 cockpitToEngine = cockpit.position - engine.position;
        Assert.That(cockpitToEngine.z, Is.GreaterThan(3.5f));
        Assert.That(Mathf.Abs(cockpitToEngine.x), Is.LessThan(0.1f));
        Assert.That(topPanel.position.y, Is.GreaterThan(ship.transform.position.y));
    }

    [Test]
    public void ImportedVisualSwitcherReusesPooledScoutAndCargoInstances()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        Transform visualRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(visualRoot);
        Transform firstScout = visualRoot.Find("ImportedDemoScoutVisual");
        Assert.NotNull(firstScout);
        Assert.True(firstScout.gameObject.activeSelf);
        Assert.That(CountDirectChildrenNamed(ship.transform, "ImportedShipVisual"), Is.EqualTo(1));

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoCargo);
        Transform cargo = visualRoot.Find("ImportedDemoCargoVisual");
        Assert.NotNull(cargo);
        Assert.True(cargo.gameObject.activeSelf);
        Assert.False(firstScout.gameObject.activeSelf);
        Assert.That(CountDirectChildrenNamed(ship.transform, "ImportedShipVisual"), Is.EqualTo(1));

        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);
        Assert.False(visualRoot.gameObject.activeSelf);

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        Assert.AreSame(firstScout, visualRoot.Find("ImportedDemoScoutVisual"));
        Assert.AreSame(cargo, visualRoot.Find("ImportedDemoCargoVisual"));
        Assert.True(firstScout.gameObject.activeSelf);
        Assert.False(cargo.gameObject.activeSelf);
        Assert.That(CountDirectChildrenNamed(ship.transform, "ImportedShipVisual"), Is.EqualTo(1));
    }

    [Test]
    public void ImportedVisualSwitcherKeepsGeneratedVisibleWhenImportedHasNoEnabledRenderers()
    {
        GameObject ship = BuildBaselineShip();
        Transform hullKitRoot = ship.transform.Find("Hull").Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.NotNull(hullKitRoot);
        Assert.True(AllRenderersEnabled(hullKitRoot));

        var switcher = CreateSwitcher();
        GameObject invisiblePrefab = new GameObject("InvisibleImportedVisual");
        SetPrivateField(switcher, "importedDemoScoutVisualPrefab", invisiblePrefab);

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);

        Transform importedRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(importedRoot);
        Assert.True(importedRoot.gameObject.activeSelf);
        Assert.That(CollectRenderers(importedRoot).Length, Is.EqualTo(0));
        Assert.True(AllRenderersEnabled(hullKitRoot), "Generated visuals must remain visible until imported visual has enabled renderers.");
    }

    [Test]
    public void BootstrapLeavesOneActiveMainCameraAndOverwritesFollowTarget()
    {
        GameObject staleTarget = new GameObject("StaleCameraTarget");
        GameObject staleMainCamera = new GameObject("Main Camera");
        staleMainCamera.tag = "MainCamera";
        staleMainCamera.AddComponent<Camera>();
        SimpleFollowCamera staleFollow = staleMainCamera.AddComponent<SimpleFollowCamera>();
        staleFollow.BindTarget(staleTarget.transform, staleTarget.AddComponent<ShipStats>());

        GameObject duplicateMainCamera = new GameObject("OldMainCamera");
        duplicateMainCamera.tag = "MainCamera";
        duplicateMainCamera.AddComponent<Camera>();

        GameObject ship = BuildBaselineShip();
        Camera mainCamera = Camera.main;
        Assert.NotNull(mainCamera);
        SimpleFollowCamera follow = mainCamera.GetComponent<SimpleFollowCamera>();
        Assert.NotNull(follow);
        InvokeLateUpdate(follow);

        Assert.That(CountActiveMainCameras(), Is.EqualTo(1));
        Assert.That(follow.TargetName, Is.EqualTo(ship.name));
        Assert.NotNull(ship.transform.Find("PrototypeCameraAnchor"));
        Assert.That(follow.FocusSourceLabel, Is.EqualTo("CameraAnchor"));
    }

    [Test]
    public void ImportedVisualRootStaysChildedAndMovesWithShip()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);

        Transform visualRoot = ship.transform.Find("ImportedShipVisual");
        Assert.NotNull(visualRoot);
        Assert.That(visualRoot.parent, Is.EqualTo(ship.transform));
        Vector3 initialVisualPosition = visualRoot.position;
        Vector3 delta = new Vector3(12f, 3f, -5f);

        ship.transform.position += delta;

        AssertVector(visualRoot.position, initialVisualPosition + delta, 0.001f);
        Assert.That(visualRoot.parent, Is.EqualTo(ship.transform));
    }

    [Test]
    public void ManagerObjectHasClearNameAndNoRuntimePhysicsOrRenderingComponents()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();
        switcher.gameObject.AddComponent<BoxCollider>();
        switcher.gameObject.AddComponent<Rigidbody>();
        switcher.gameObject.AddComponent<MeshRenderer>();

        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);

        Assert.That(ship, Is.Not.Null);
        Assert.That(switcher.gameObject.name, Is.EqualTo("PrototypeShipVisualSwitcher_Manager"));
        Assert.Null(switcher.GetComponent<Renderer>());
        Assert.Null(switcher.GetComponent<Collider>());
        Assert.Null(switcher.GetComponent<Rigidbody>());
    }

    [Test]
    public void SwitcherOnGameplayObjectDoesNotStripPhysicsOrRenderingComponents()
    {
        BuildBaselineShip();
        var host = new GameObject("GameplaySwitcherHost");
        var meshFilter = host.AddComponent<MeshFilter>();
        meshFilter.sharedMesh = new Mesh();
        var renderer = host.AddComponent<MeshRenderer>();
        var collider = host.AddComponent<BoxCollider>();
        var body = host.AddComponent<Rigidbody>();
        var switcher = host.AddComponent<PrototypeShipVisualSwitcher>();

        switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);

        Assert.AreEqual("GameplaySwitcherHost", host.name);
        Assert.AreSame(renderer, host.GetComponent<MeshRenderer>());
        Assert.AreSame(collider, host.GetComponent<BoxCollider>());
        Assert.AreSame(body, host.GetComponent<Rigidbody>());
        Assert.NotNull(host.GetComponent<PrototypeShipVisualSwitcher>());

        Object.DestroyImmediate(meshFilter.sharedMesh);
    }

    [Test]
    public void VisualChangeReframesCameraWithoutMovingAnchorOrBreakingBinding()
    {
        GameObject ship = BuildBaselineShip();
        Transform anchor = ship.transform.Find("PrototypeCameraAnchor");
        Assert.NotNull(anchor);
        Vector3 anchorLocalPosition = anchor.localPosition;
        SimpleFollowCamera follow = Camera.main.GetComponent<SimpleFollowCamera>();
        Assert.NotNull(follow);
        InvokeLateUpdate(follow);
        float beforeDistance = follow.EffectiveDistance;
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        InvokeLateUpdate(follow);

        Assert.That(follow.TargetName, Is.EqualTo(ship.name));
        Assert.That(follow.FocusSourceLabel, Is.EqualTo("CameraAnchor"));
        AssertVector(anchor.localPosition, anchorLocalPosition, 0.001f);
        Assert.That(follow.EffectiveDistance, Is.GreaterThan(0f));
        Assert.That(beforeDistance, Is.GreaterThan(0f));
        Assert.NotNull(ship.transform.Find("ImportedShipVisual"));
    }

    private static GameObject BuildBaselineShip()
    {
        return BuildVariantShip(0);
    }

    private static GameObject BuildHeavyCargoShip()
    {
        return BuildVariantShip(4);
    }

    private static GameObject BuildVariantShip(int variantIndex)
    {
        var bootstrapObject = new GameObject("VariantTestBootstrap");
        var bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
        bootstrap.BuildBuiltInVariant(variantIndex);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        return ship;
    }

    private static PrototypeShipVisualSwitcher CreateSwitcher()
    {
        var switcherObject = new GameObject("PrototypeShipVisualSwitcher_Manager");
        return switcherObject.AddComponent<PrototypeShipVisualSwitcher>();
    }

    private static Transform FindDeep(Transform root, string objectName)
    {
        if (root == null)
        {
            return null;
        }

        if (root.name == objectName)
        {
            return root;
        }

        for (int i = 0; i < root.childCount; i++)
        {
            Transform child = FindDeep(root.GetChild(i), objectName);
            if (child != null)
            {
                return child;
            }
        }

        return null;
    }

    [Test]
    public void HeavyCargoCargoMassDoesNotShowHardpointMarkerByDefault()
    {
        GameObject ship = BuildHeavyCargoShip();
        Transform cargoMass = ship.transform.Find("CargoMass");
        Assert.NotNull(cargoMass);
        Assert.False(HasDescendantNameContaining(cargoMass, "HardpointMarker"));

        var hardpointMetadata = PrototypeShipPartVisualFactory.ResolveMetadata("connector_hardpoint", Vector3.one, PrototypeModuleMassRole.Custom, string.Empty);
        Assert.True(hardpointMetadata.ShowConnectorMarker);
        Assert.True(hardpointMetadata.ShowHardpointMarker);

        var cargoMetadata = PrototypeShipPartVisualFactory.ResolveMetadata("CargoMass", Vector3.one, PrototypeModuleMassRole.Custom, string.Empty);
        Assert.False(cargoMetadata.ShowConnectorMarker);
        Assert.False(cargoMetadata.ShowHardpointMarker);
    }

    private static bool HasDescendantNameContaining(Transform root, string namePart)
    {
        if (root == null)
        {
            return false;
        }

        if (root.name.Contains(namePart))
        {
            return true;
        }

        for (int i = 0; i < root.childCount; i++)
        {
            if (HasDescendantNameContaining(root.GetChild(i), namePart))
            {
                return true;
            }
        }

        return false;
    }

    private static Renderer[] CollectRenderers(Transform root)
    {
        if (root == null)
        {
            return new Renderer[0];
        }

        var list = new System.Collections.Generic.List<Renderer>();
        CollectRenderersInternal(root, list);
        return list.ToArray();
    }

    private static bool AllRenderersEnabled(Transform root)
    {
        if (root == null)
        {
            return true;
        }

        Renderer renderer = root.GetComponent<Renderer>();
        if (renderer != null && !renderer.enabled)
        {
            return false;
        }

        for (int i = 0; i < root.childCount; i++)
        {
            if (!AllRenderersEnabled(root.GetChild(i)))
            {
                return false;
            }
        }

        return true;
    }

    private static void CollectRenderersInternal(Transform root, System.Collections.Generic.List<Renderer> renderers)
    {
        Renderer renderer = root.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderers.Add(renderer);
        }

        for (int i = 0; i < root.childCount; i++)
        {
            CollectRenderersInternal(root.GetChild(i), renderers);
        }
    }

    private static Bounds CombineBounds(Renderer[] renderers)
    {
        Assert.That(renderers.Length, Is.GreaterThan(0));
        Bounds bounds = renderers[0].bounds;
        for (int i = 1; i < renderers.Length; i++)
        {
            bounds.Encapsulate(renderers[i].bounds);
        }

        return bounds;
    }

    private static int CountActiveMainCameras()
    {
        Camera[] cameras = Object.FindObjectsByType<Camera>(FindObjectsInactive.Exclude);
        int count = 0;
        for (int i = 0; i < cameras.Length; i++)
        {
            if (cameras[i] != null && cameras[i].CompareTag("MainCamera"))
            {
                count++;
            }
        }

        return count;
    }

    private static void InvokeLateUpdate(SimpleFollowCamera camera)
    {
        MethodInfo lateUpdate = typeof(SimpleFollowCamera).GetMethod("LateUpdate", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(lateUpdate, "SimpleFollowCamera LateUpdate method should exist for test update.");
        lateUpdate.Invoke(camera, null);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void AssertVector(Vector3 actual, Vector3 expected, float tolerance)
    {
        Assert.That(Vector3.Distance(actual, expected), Is.LessThanOrEqualTo(tolerance), $"Expected {expected}, got {actual}.");
    }

    private static int CountDescendantNamesContaining(Transform root, string namePart)
    {
        if (root == null)
        {
            return 0;
        }

        int count = root.name.Contains(namePart) ? 1 : 0;
        for (int i = 0; i < root.childCount; i++)
        {
            count += CountDescendantNamesContaining(root.GetChild(i), namePart);
        }

        return count;
    }

    private static int CountDirectChildrenNamed(Transform root, string childName)
    {
        int count = 0;
        for (int i = 0; i < root.childCount; i++)
        {
            if (root.GetChild(i).name == childName)
            {
                count++;
            }
        }

        return count;
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
