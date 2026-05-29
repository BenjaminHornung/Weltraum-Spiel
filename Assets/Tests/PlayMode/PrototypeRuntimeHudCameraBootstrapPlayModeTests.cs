#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeRuntimeHudCameraBootstrapPlayModeTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [SetUp]
    public void SetUp()
    {
        CleanupRuntimeObjects();
    }

    [TearDown]
    public void TearDown()
    {
        CleanupRuntimeObjects();
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

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
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

    private static void DestroyNamed(string name)
    {
        GameObject[] objects = Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include, FindObjectsSortMode.None);
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
