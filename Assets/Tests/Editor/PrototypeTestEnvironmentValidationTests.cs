#if UNITY_EDITOR
using System.Reflection;
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
    public void Rebuild_PreservesManualChildrenAndRecreatesGeneratedLaunchCorridor()
    {
        GameObject preexistingRoot = new GameObject(PrototypeTestEnvironment.RootName);
        GameObject manualObstacle = new GameObject("Manual_Navigation_Obstacle");
        manualObstacle.transform.SetParent(preexistingRoot.transform, false);
        manualObstacle.AddComponent<PrototypeNavigationObstacle>();

        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        Assert.That(CountNamed(PrototypeTestEnvironment.RootName), Is.EqualTo(1));
        Assert.NotNull(GameObject.Find(PrototypeTestEnvironment.RootName + "/Manual_Navigation_Obstacle"));
        Assert.NotNull(GameObject.Find(PrototypeTestEnvironment.RootName + "/Manual_Navigation_Obstacle").GetComponent<PrototypeNavigationObstacle>());
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Launch_Corridor_Obstacles"));
    }

    [Test]
    public void Rebuild_MarksAsteroidsAsNavigationObstacles()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        GameObject asteroid = GameObject.Find("Asteroid_Visual_1");
        Assert.NotNull(asteroid);
        Assert.NotNull(asteroid.GetComponent<Collider>());
        PrototypeNavigationObstacle obstacle = asteroid.GetComponent<PrototypeNavigationObstacle>();
        Assert.NotNull(obstacle);
        Assert.That(obstacle.Label, Is.EqualTo("Asteroid 1"));
        Assert.That(obstacle.ClearanceRadiusMeters, Is.GreaterThan(0f));
        Assert.That(obstacle.DangerRadiusMeters, Is.GreaterThan(0f));
        Assert.True(obstacle.BlocksAutopilotNavigation);
    }

    [Test]
    public void Rebuild_DefaultTrainingEnvironmentHidesWorldAxesVisuals()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        Assert.IsNull(GameObject.Find("PrototypeEnvironment/World_Axes"));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Axis), Is.GreaterThanOrEqualTo(3));
    }

    [Test]
    public void Rebuild_TrainingEnvironmentHidesDebugWorldLabelsButKeepsPointData()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Origin/Label_ORIGIN"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Station_Hangar/Label_Station"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Targets/Label_Target_Close"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Targets/Label_Target_Far"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Navigation_Beacons/Label_Beacon_Alpha"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Navigation_Beacons/Label_Beacon_Beta"));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Origin), Is.GreaterThanOrEqualTo(1));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Station), Is.GreaterThanOrEqualTo(1));
    }

    [Test]
    public void Rebuild_MinimalEnvironmentHidesWorldAxesVisuals()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();
        SetEnvironmentDisplayMode(environment, PrototypeEnvironmentDisplayMode.Minimal);

        environment.Rebuild();

        Assert.IsNull(GameObject.Find("PrototypeEnvironment/World_Axes"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Origin/Label_ORIGIN"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Station_Hangar/Label_Station"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Targets/Label_Target_Close"));
        Assert.IsNull(GameObject.Find("PrototypeEnvironment/Navigation_Beacons/Label_Beacon_Alpha"));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Axis), Is.GreaterThanOrEqualTo(3));
    }

    [Test]
    public void Rebuild_FullDebugEnvironmentRendersWorldAxesVisuals()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();
        SetEnvironmentDisplayMode(environment, PrototypeEnvironmentDisplayMode.FullDebug);

        environment.Rebuild();

        Assert.NotNull(GameObject.Find("PrototypeEnvironment/World_Axes"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Origin/Label_ORIGIN"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Station_Hangar/Label_Station"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Targets/Label_Target_Far"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment/Navigation_Beacons/Label_Beacon_Beta"));
        Assert.That(Count(environment, PrototypeEnvironmentPointKind.Axis), Is.GreaterThanOrEqualTo(3));
    }

    [Test]
    public void Rebuild_AsteroidsAreTriggerNavigationObstacles()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        PrototypeNavigationObstacle[] obstacles = Object.FindObjectsByType<PrototypeNavigationObstacle>(FindObjectsInactive.Exclude);
        Assert.That(obstacles.Length, Is.GreaterThanOrEqualTo(5));
        for (int i = 0; i < obstacles.Length; i++)
        {
            Collider obstacleCollider = obstacles[i].GetComponent<Collider>();
            Assert.NotNull(obstacleCollider);
            Assert.True(obstacleCollider.isTrigger);
        }
    }

    [Test]
    public void Rebuild_AddsLaunchCorridorObstacleCourseOnDirectApproachLine()
    {
        GameObject host = new GameObject("EnvironmentValidationHost");
        PrototypeTestEnvironment environment = host.AddComponent<PrototypeTestEnvironment>();

        environment.Rebuild();

        GameObject obstacleGroup = GameObject.Find("PrototypeEnvironment/Launch_Corridor_Obstacles");
        Assert.NotNull(obstacleGroup);

        PrototypeNavigationObstacle[] obstacles = Object.FindObjectsByType<PrototypeNavigationObstacle>(FindObjectsInactive.Exclude);
        int launchObstacleCount = 0;
        for (int i = 0; i < obstacles.Length; i++)
        {
            PrototypeNavigationObstacle obstacle = obstacles[i];
            if (obstacle == null || !obstacle.Label.StartsWith("Launch Obstacle"))
            {
                continue;
            }

            launchObstacleCount++;
            Collider obstacleCollider = obstacle.GetComponent<Collider>();
            Assert.NotNull(obstacleCollider);
            Assert.True(obstacleCollider.isTrigger);
            Assert.True(obstacle.BlocksAutopilotNavigation);
            Assert.That(obstacle.ClearanceRadiusMeters, Is.GreaterThan(obstacle.Radius));
            Assert.That(obstacle.WorldPosition.y, Is.EqualTo(0.5f).Within(0.1f));
            Assert.That(obstacle.WorldPosition.x, Is.InRange(-6f, 6f));
            Assert.That(obstacle.WorldPosition.z, Is.InRange(10f, 40f));
        }

        Assert.That(launchObstacleCount, Is.EqualTo(3));
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

    [Test]
    public void BuildPrototypeDefaultsOrientationMarkersToOff()
    {
        GameObject host = new GameObject("BootstrapEnvironmentValidationHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildPrototype();

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.IsNull(ship.transform.Find("OrientationMarkers"));
    }

    [Test]
    public void DirectionalLightIsCappedWhenBootstrapBuilds()
    {
        var sceneLightObject = new GameObject("Directional Light");
        var sceneLight = sceneLightObject.AddComponent<Light>();
        sceneLight.type = LightType.Directional;
        sceneLight.intensity = 8f;

        GameObject host = new GameObject("BootstrapEnvironmentValidationHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        bootstrap.BuildPrototype();

        GameObject builtLight = GameObject.Find("Directional Light");
        Assert.NotNull(builtLight);
        sceneLight = builtLight.GetComponent<Light>();
        Assert.NotNull(sceneLight);
        Assert.That(sceneLight.intensity, Is.LessThanOrEqualTo(1.5f));
        Assert.That(sceneLight.intensity, Is.GreaterThan(1f));
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

    private static void SetEnvironmentDisplayMode(PrototypeTestEnvironment environment, PrototypeEnvironmentDisplayMode mode)
    {
        FieldInfo displayModeField = typeof(PrototypeTestEnvironment).GetField("environmentDisplayMode", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(displayModeField);
        displayModeField.SetValue(environment, mode);
    }

    private static int CountNamed(string objectName)
    {
        int count = 0;
        Transform[] transforms = Object.FindObjectsByType<Transform>(FindObjectsInactive.Include);
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
