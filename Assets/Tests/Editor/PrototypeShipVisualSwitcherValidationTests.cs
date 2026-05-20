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

        Assert.Null(ship.transform.Find("ImportedShipVisual"));
        Transform hullKitRoot = ship.transform.Find("Hull").Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.NotNull(hullKitRoot);
        Assert.False(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
        Assert.True(AllRenderersEnabled(hullKitRoot));
    }

    [Test]
    public void RuntimeBootstrapBaselineResetReturnsToGeneratedPrimitives()
    {
        GameObject ship = BuildBaselineShip();
        var switcher = CreateSwitcher();

        switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
        Assert.NotNull(ship.transform.Find("ImportedShipVisual"));

        MethodInfo resetMethod = typeof(PrototypeShipVisualSwitcher).GetMethod(
            "ResetForRuntimeBaseline",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(resetMethod);
        resetMethod.Invoke(switcher, null);

        Assert.That(switcher.SelectedVisualMode, Is.EqualTo(PrototypeShipVisualMode.GeneratedPrimitives));
        Assert.Null(ship.transform.Find("ImportedShipVisual"));
        Assert.False(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
        Transform hullKitRoot = ship.transform.Find("Hull").Find(PrototypeShipPartVisualFactory.VisualRootName);
        Assert.NotNull(hullKitRoot);
        Assert.True(AllRenderersEnabled(hullKitRoot));
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
        bootstrap.BuildBuiltInVariant(variantIndex);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        return ship;
    }

    private static PrototypeShipVisualSwitcher CreateSwitcher()
    {
        var switcherObject = new GameObject("PrototypeShipVisualSwitcher");
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
