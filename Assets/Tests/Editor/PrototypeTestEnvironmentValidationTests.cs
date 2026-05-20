#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeTestEnvironmentValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("EnvironmentValidationHost");
        DestroyNamed("MinimapValidationCamera");
        DestroyNamed("MinimapValidationShip");
        DestroyNamed("BootstrapEnvironmentValidationHost");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void EnvironmentRebuildCreatesRequiredLandmarkKindsWithoutDuplicateRoot()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        Assert.NotNull(GameObject.Find(PrototypeTestEnvironment.RootName));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Origin), Is.GreaterThanOrEqualTo(1));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Target), Is.GreaterThanOrEqualTo(5));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Beacon), Is.GreaterThanOrEqualTo(3));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Gate), Is.GreaterThanOrEqualTo(3));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Station), Is.GreaterThanOrEqualTo(1));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Obstacle), Is.GreaterThanOrEqualTo(5));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.RangeRing), Is.GreaterThanOrEqualTo(4));

        environment.Rebuild();

        Assert.That(CountNamed(PrototypeTestEnvironment.RootName), Is.EqualTo(1));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Target), Is.GreaterThanOrEqualTo(5));
    }

    [Test]
    public void BootstrapBindsGeneratedEnvironmentAndMinimapToMainCamera()
    {
        GameObject host = new GameObject("BootstrapEnvironmentValidationHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildPrototype();

        GameObject ship = GameObject.Find("PrototypeShip");
        PrototypeTestEnvironment environment = host.GetComponent<PrototypeTestEnvironment>();
        PrototypeMinimapOverlay minimap = Camera.main != null ? Camera.main.GetComponent<PrototypeMinimapOverlay>() : null;

        Assert.NotNull(ship);
        Assert.NotNull(environment);
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Target), Is.GreaterThanOrEqualTo(5));
        Assert.NotNull(minimap);
        Assert.AreSame(ship.transform, minimap.Target);
        Assert.AreSame(environment, minimap.Environment);
        Assert.That(minimap.CurrentZoomMeters, Is.EqualTo(1000f).Within(0.001f));
    }

    [Test]
    public void MinimapExposesFixedZoomLevelsAndLabelToggle()
    {
        GameObject ship = new GameObject("MinimapValidationShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        GameObject cameraObject = new GameObject("MinimapValidationCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeMinimapOverlay minimap = cameraObject.AddComponent<PrototypeMinimapOverlay>();

        minimap.Bind(ship.transform, body, null);
        minimap.SetZoomIndex(0);
        Assert.That(minimap.CurrentZoomMeters, Is.EqualTo(250f).Within(0.001f));

        minimap.SetZoomIndex(3);
        Assert.That(minimap.CurrentZoomMeters, Is.EqualTo(2500f).Within(0.001f));

        minimap.SetLabelsVisible(false);
        Assert.False(minimap.ShowLabels);
    }

    private static int Count(PrototypeTestEnvironment environment, PrototypeEnvironmentPointKind kind)
    {
        int count = 0;
        PrototypeEnvironmentPoint[] points = environment.GetPointsSnapshot();
        for (int i = 0; i < points.Length; i++)
        {
            if (points[i] != null && points[i].Kind == kind)
            {
                count++;
            }
        }

        return count;
    }

    private static int CountNamed(string objectName)
    {
        int count = 0;
        Transform[] transforms = Object.FindObjectsByType<Transform>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        for (int i = 0; i < transforms.Length; i++)
        {
            if (transforms[i] != null && transforms[i].name == objectName)
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
