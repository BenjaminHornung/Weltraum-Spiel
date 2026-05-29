#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeBootstrapRuntimeGuardValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [SetUp]
    public void SetUp()
    {
        PrototypeBootstrap.ResetRuntimeBootstrapSessionForTests();
        CleanupRuntimeObjects();
    }

    [TearDown]
    public void TearDown()
    {
        PrototypeBootstrap.ResetRuntimeBootstrapSessionForTests();
        CleanupRuntimeObjects();
    }

    [Test]
    public void DetectsUnityTestRunnerSceneNames()
    {
        Assert.True(PrototypeBootstrap.IsUnityTestRunnerScene("Assets/InitTestSceneeddf73b2-278d-4020-84b3-62a0d4d68df8.unity"));
        Assert.True(PrototypeBootstrap.IsUnityTestRunnerScene("InitTestScene92adc857-461a-4fbd-99a1-798237d6cd1d"));
        Assert.False(PrototypeBootstrap.IsUnityTestRunnerScene("Assets/Scenes/SampleScene.unity"));
        Assert.False(PrototypeBootstrap.IsUnityTestRunnerScene("SampleScene"));
    }

    [Test]
    public void EditModeBuildDoesNotArmRuntimeIntegrityWatchdog()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();

        bootstrap.BuildPrototype();

        Assert.False(bootstrap.RuntimeIntegrityWatchdogActive);
        Assert.True(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingRoots, out _), missingRoots);
    }

    [Test]
    public void RuntimeIntegrityRepairRestoresMissingRootsAndDoesNotRebuildCleanState()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildPrototype();
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeEnvironment");

        Assert.False(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingBeforeRepair, out _));
        Assert.That(missingBeforeRepair, Does.Contain("PrototypeShip"));
        Assert.That(missingBeforeRepair, Does.Contain("PrototypeEnvironment"));

        Assert.True(bootstrap.RunRuntimeIntegrityRepairForTests("EditorSimulatedRootRemoval", true));
        Assert.True(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingAfterRepair, out _), missingAfterRepair);

        Assert.False(bootstrap.RunRuntimeIntegrityRepairForTests("CleanStateAfterRepair", true));
        Assert.True(bootstrap.TryGetRuntimeRootIntegrityReport(out string missingAfterCleanCheck, out _), missingAfterCleanCheck);
    }

    private static PrototypeBootstrap CreateBootstrap()
    {
        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        return bootstrap;
    }

    private static void CleanupRuntimeObjects()
    {
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

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }
}
#endif
