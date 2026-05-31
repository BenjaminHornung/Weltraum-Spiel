#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;

public class PrototypeRuntimeHudCameraBootstrapPlayModeTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [SetUp]
    public void SetUp()
    {
        PrototypeBootstrap.ResetRuntimeBootstrapSessionForTests();
        CleanupTestOwnedObjects();
    }

    [TearDown]
    public void TearDown()
    {
        if (!PrototypeBootstrap.IsUnityTestRunnerContextActive())
        {
            CleanupRuntimeObjects();
        }
    }

    [Test]
    [Timeout(60000)]
    public void PlayMode_BootstrapShowsBoundHudShipAndDefaultNavigationTarget()
    {
        Assert.That(Application.isPlaying, Is.True, "This regression must run in Unity PlayMode.");

        GameObject host = new GameObject("RuntimeHudCameraBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype();

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship, "bootstrap ship");
        Assert.That(CountVisibleEnabledRenderers(ship), Is.GreaterThan(0), "visible imported/generated ship renderers");

        Camera camera = Camera.main;
        Assert.NotNull(camera, "main camera");
        Assert.That(Object.FindObjectsByType<Camera>(FindObjectsInactive.Exclude).Length, Is.EqualTo(1), "single active camera");

        SimpleFollowCamera follow = camera.GetComponent<SimpleFollowCamera>();
        Assert.NotNull(follow, "follow camera");
        Assert.That(follow.TargetName, Is.EqualTo("PrototypeShip"));
        Assert.False(follow.IsAutopilotFlipCameraAssistActive, "idle camera must not enter brake-flip assist");

        PrototypePlayerHudRenderer playerHud = camera.GetComponent<PrototypePlayerHudRenderer>();
        Assert.NotNull(playerHud, "player HUD");
        Assert.That(camera.GetComponents<PrototypePlayerHudRenderer>().Length, Is.EqualTo(1), "single HUD renderer on camera");
        playerHud.RefreshNow();

        Assert.True(playerHud.HasBoundRuntimeShip, "HUD ship binding");
        Assert.True(playerHud.HasBoundNavigationComputer, "HUD autopilot binding");
        Assert.True(playerHud.HasBoundMomentumAssist, "HUD momentum assist binding");
        Assert.True(playerHud.HasBoundWeaponComputer, "HUD weapon computer binding");
        Assert.That(playerHud.LastSnapshot.ShipStatus.FuelLabel, Does.StartWith("Fuel "));
        Assert.That(playerHud.LastSnapshot.ShipStatus.FuelLabel, Does.Not.Contain("n/a"));
        Assert.True(playerHud.LastSnapshot.Navigation.Visible, "default navigation target visible");
        Assert.That(playerHud.LastSnapshot.Navigation.TargetName, Does.Contain("Nav Waypoint"));
        Assert.That(playerHud.LastSnapshot.Radar.Blips.Length, Is.GreaterThan(0), "radar contacts");

        PrototypePveArenaLoop arena = Object.FindAnyObjectByType<PrototypePveArenaLoop>();
        Assert.NotNull(arena, "arena loop");
        Assert.That(arena.Snapshot.TotalTargets, Is.EqualTo(3));
    }

    [Test]
    [Timeout(60000)]
    public void PlayMode_BootstrapAddsVisibleOrbitMapDebugWindowWithCatalogSnapshot()
    {
        Assert.That(Application.isPlaying, Is.True, "This regression must run in Unity PlayMode.");

        GameObject host = new GameObject("RuntimeHudCameraBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype();

        Camera camera = Camera.main;
        Assert.NotNull(camera, "main camera");

        PrototypeOrbitMapDebugWindow orbitMap = camera.GetComponent<PrototypeOrbitMapDebugWindow>();
        Assert.NotNull(orbitMap, "orbit map debug window");
        Assert.That(camera.GetComponents<PrototypeOrbitMapDebugWindow>().Length, Is.EqualTo(1), "single orbit map debug window on camera");

        InvokePrivateMethod(orbitMap, "BuildSnapshotLines");
        CelestialOrbitMapSnapshot snapshot = GetPrivateField<CelestialOrbitMapSnapshot>(orbitMap, "snapshot");
        string[] readoutLines = GetPrivateField<string[]>(orbitMap, "readoutLines");

        Assert.NotNull(snapshot, "catalog-backed orbit map snapshot");
        Assert.That(snapshot.Bodies.Count, Is.GreaterThanOrEqualTo(4), "starter body count");
        Assert.True(HasBody(snapshot, "star.aurelia"), "Aurelia in snapshot");
        Assert.True(HasBody(snapshot, "planet.hestia"), "Hestia in snapshot");
        Assert.True(HasBody(snapshot, "moon.hestia.luma"), "Luma in snapshot");
        Assert.True(HasBody(snapshot, "asteroid.eber"), "Eber in snapshot");
        Assert.That(readoutLines, Is.Not.Null.And.Not.Empty, "debug readout lines");
        Assert.True(HasReadoutLine(readoutLines, "star.aurelia"), "Aurelia readout");
        Assert.True(HasReadoutLine(readoutLines, "planet.hestia"), "Hestia readout");
    }

    [Test]
    [Timeout(60000)]
    public void PlayMode_TestRunnerSceneDoesNotArmRuntimeIntegrityWatchdog()
    {
        Assert.That(Application.isPlaying, Is.True, "This regression must run in Unity PlayMode.");
        Assert.True(
            PrototypeBootstrap.IsUnityTestRunnerContextActive(),
            "Unity PlayMode tests should execute in a TestRunner context.");

        GameObject host = new GameObject("RuntimeHudCameraBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype();

        Assert.False(bootstrap.RuntimeIntegrityWatchdogActive, "TestRunner scenes must not arm the gameplay watchdog.");
        Assert.True(PrototypeBootstrap.IsUnityTestRunnerScene(SceneManager.GetActiveScene().path));
    }

    [Test]
    [Timeout(60000)]
    public void PlayMode_ForcedRuntimeIntegrityRepairRestoresMissingRootsOnce()
    {
        Assert.That(Application.isPlaying, Is.True, "This regression must run in Unity PlayMode.");

        GameObject host = new GameObject("RuntimeHudCameraBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype();
        DestroyNamedImmediate("PrototypeShip");
        DestroyNamedImmediate("PrototypeEnvironment");

        Assert.False(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingBeforeRepair, out _));
        Assert.That(missingBeforeRepair, Does.Contain("PrototypeShip"));
        Assert.That(missingBeforeRepair, Does.Contain("PrototypeEnvironment"));

        Assert.True(bootstrap.RunRuntimeIntegrityRepairForTests("SimulatedRootRemoval", true));
        Assert.True(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingAfterRepair, out _), missingAfterRepair);
        Assert.NotNull(GameObject.Find("PrototypeShip"));
        Assert.NotNull(GameObject.Find("PrototypeEnvironment"));
        Assert.NotNull(Object.FindAnyObjectByType<PrototypePveArenaLoop>());

        Assert.False(bootstrap.RunRuntimeIntegrityRepairForTests("SecondCleanCheck", true), "Clean roots should not trigger another rebuild.");
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static T GetPrivateField<T>(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (T)field.GetValue(target);
    }

    private static void InvokePrivateMethod(object target, string methodName)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        method.Invoke(target, null);
    }

    private static bool HasBody(CelestialOrbitMapSnapshot snapshot, string bodyId)
    {
        for (int i = 0; i < snapshot.Bodies.Count; i++)
        {
            if (snapshot.Bodies[i] != null && snapshot.Bodies[i].BodyId == bodyId)
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasReadoutLine(string[] readoutLines, string bodyId)
    {
        for (int i = 0; i < readoutLines.Length; i++)
        {
            if (!string.IsNullOrEmpty(readoutLines[i]) && readoutLines[i].Contains(bodyId))
            {
                return true;
            }
        }

        return false;
    }

    private static int CountVisibleEnabledRenderers(GameObject root)
    {
        int count = 0;
        Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
        for (int i = 0; i < renderers.Length; i++)
        {
            Renderer renderer = renderers[i];
            if (renderer != null && renderer.enabled && renderer.gameObject.activeInHierarchy)
            {
                count++;
            }
        }

        return count;
    }

    private static void CleanupRuntimeObjects()
    {
        CleanupTestOwnedObjects();
        DestroyNamed("RuntimeHudCameraBootstrapTestHost");
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PrototypeDockingApproachTarget");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("EventSystem");
        DestroyNamed("PrototypePlayerHudEventSystem");
    }

    private static void CleanupTestOwnedObjects()
    {
        DestroyNamedImmediate("RuntimeHudCameraBootstrapTestHost");
    }

    private static void DestroyNamed(string name)
    {
        GameObject[] objects = Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include);
        for (int i = objects.Length - 1; i >= 0; i--)
        {
            GameObject candidate = objects[i];
            if (candidate != null && candidate.name == name)
            {
                Object.DestroyImmediate(candidate);
            }
        }
    }

    private static void DestroyNamedImmediate(string name)
    {
        GameObject[] objects = Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include);
        for (int i = objects.Length - 1; i >= 0; i--)
        {
            GameObject candidate = objects[i];
            if (candidate != null && candidate.name == name)
            {
                Object.DestroyImmediate(candidate);
            }
        }
    }
}
#endif
