#if UNITY_EDITOR
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
        Assert.True(ship.transform.Find("Hull").GetComponent<Renderer>().enabled);
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
        var bootstrapObject = new GameObject("VariantTestBootstrap");
        var bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        bootstrap.BuildBuiltInVariant(0);

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
