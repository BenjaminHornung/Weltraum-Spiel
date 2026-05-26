#if UNITY_EDITOR
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypePveArenaLoopValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        DestroyNamed("PrototypePveArenaLoopTest");
        DestroyNamed("PrototypePveArenaHudTest");
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void StartCreatesAtLeastThreeRegisteredDamageTargets()
    {
        PrototypePveArenaLoop arena = CreateArena();

        PrototypePveArenaSnapshot snapshot = arena.Snapshot;

        Assert.True(snapshot.Active);
        Assert.False(snapshot.Completed);
        Assert.That(snapshot.TotalTargets, Is.GreaterThanOrEqualTo(3));
        Assert.That(snapshot.DestroyedTargets, Is.EqualTo(0));
        Assert.That(snapshot.RemainingTargets, Is.EqualTo(snapshot.TotalTargets));
        Assert.That(arena.Targets.Count, Is.GreaterThanOrEqualTo(3));
        Assert.True(arena.Targets.All(target => target != null && target.DamageState != null && !target.DamageState.IsDestroyed));
        Assert.That(PrototypeWeaponTarget.Discover(null).Count, Is.GreaterThanOrEqualTo(3));
    }

    [Test]
    public void DestroyedDamageStatesDriveProgressCompletionAndRewardStub()
    {
        PrototypePveArenaLoop arena = CreateArena();

        arena.Targets[0].DamageState.ApplyDamage(999f);
        arena.RefreshProgress();
        Assert.That(arena.Snapshot.DestroyedTargets, Is.EqualTo(1));
        Assert.False(arena.Snapshot.Completed);

        for (int i = 1; i < arena.Targets.Count; i++)
        {
            arena.Targets[i].DamageState.ApplyDamage(999f);
        }

        arena.RefreshProgress();
        PrototypePveArenaSnapshot snapshot = arena.Snapshot;

        Assert.False(snapshot.Active);
        Assert.True(snapshot.Completed);
        Assert.That(snapshot.DestroyedTargets, Is.EqualTo(snapshot.TotalTargets));
        Assert.That(snapshot.RemainingTargets, Is.EqualTo(0));
        Assert.That(snapshot.RewardStubLabel, Is.EqualTo("Reward queued: test salvage"));
    }

    [Test]
    public void InactiveTargetsDoNotCountTowardArenaCompletion()
    {
        PrototypePveArenaLoop arena = CreateArena();
        arena.Targets[0].Transform.gameObject.SetActive(false);

        for (int i = 1; i < arena.Targets.Count; i++)
        {
            arena.Targets[i].DamageState.ApplyDamage(999f);
        }

        arena.RefreshProgress();
        PrototypePveArenaSnapshot snapshot = arena.Snapshot;

        Assert.False(snapshot.Completed);
        Assert.That(snapshot.TotalTargets, Is.EqualTo(3));
        Assert.That(snapshot.DestroyedTargets, Is.EqualTo(2));
        Assert.That(snapshot.RemainingTargets, Is.EqualTo(1));
    }

    [Test]
    public void MissingDamageStateDoesNotCountTowardArenaCompletion()
    {
        PrototypePveArenaLoop arena = CreateArena();
        Object.DestroyImmediate(arena.Targets[1].DamageState);

        arena.Targets[0].DamageState.ApplyDamage(999f);
        arena.Targets[2].DamageState.ApplyDamage(999f);
        arena.RefreshProgress();

        PrototypePveArenaSnapshot snapshot = arena.Snapshot;

        Assert.False(snapshot.Completed);
        Assert.That(snapshot.TotalTargets, Is.EqualTo(3));
        Assert.That(snapshot.DestroyedTargets, Is.EqualTo(2));
        Assert.That(snapshot.RemainingTargets, Is.EqualTo(1));
    }

    [Test]
    public void ResetRestoresTargetsAndReplaysObjectiveDeterministically()
    {
        PrototypePveArenaLoop arena = CreateArena();
        Vector3 firstPosition = arena.Targets[0].Transform.position;
        for (int i = 0; i < arena.Targets.Count; i++)
        {
            arena.Targets[i].DamageState.ApplyDamage(999f);
            arena.Targets[i].Transform.position += Vector3.right * 100f;
        }

        arena.RefreshProgress();
        Assert.True(arena.Snapshot.Completed);

        arena.ResetArena();
        PrototypePveArenaSnapshot snapshot = arena.Snapshot;

        Assert.True(snapshot.Active);
        Assert.False(snapshot.Completed);
        Assert.That(snapshot.DestroyedTargets, Is.EqualTo(0));
        Assert.That(arena.Targets[0].Transform.position, Is.EqualTo(firstPosition));
        Assert.True(arena.Targets.All(target => Mathf.Approximately(target.DamageState.CurrentIntegrity, target.DamageState.MaxIntegrity)));
    }

    [Test]
    public void HudSnapshotCarriesArenaStatusAndCompletionReward()
    {
        GameObject hudObject = new GameObject("PrototypePveArenaHudTest");
        PrototypePveArenaLoop arena = hudObject.AddComponent<PrototypePveArenaLoop>();
        arena.Configure("Clear Test Arena", "Reward queued: test salvage", 3, 50f, new Vector3(0f, 0f, 60f), 9f);
        arena.ResetArena();

        PrototypePlayerHudSnapshot activeSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
            hudObject.transform,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            arena);

        Assert.True(activeSnapshot.Arena.Active);
        Assert.That(activeSnapshot.Arena.ObjectiveName, Is.EqualTo("Clear Test Arena"));
        Assert.That(activeSnapshot.Arena.ProgressLabel, Is.EqualTo("0/3"));
        Assert.That(activeSnapshot.Arena.RewardStubLabel, Does.Not.Contain("Reward queued: test salvage"));
        Assert.That(string.Join(" | ", activeSnapshot.AssistChips.Select(chip => chip.Label)), Does.Contain("Arena 0/3"));
        Assert.That(string.Join(" | ", activeSnapshot.AssistChips.Select(chip => chip.Label)), Does.Not.Contain("Reward queued: test salvage"));

        for (int i = 0; i < arena.Targets.Count; i++)
        {
            arena.Targets[i].DamageState.ApplyDamage(999f);
        }

        arena.RefreshProgress();
        PrototypePlayerHudSnapshot completedSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
            hudObject.transform,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            arena);

        Assert.True(completedSnapshot.Arena.Completed);
        Assert.That(completedSnapshot.Arena.RewardStubLabel, Is.EqualTo("Reward queued: test salvage"));
        Assert.That(string.Join(" | ", completedSnapshot.AssistChips.Select(chip => chip.Label)), Does.Contain("Mission complete"));
        Assert.That(string.Join(" | ", completedSnapshot.AssistChips.Select(chip => chip.Label)), Does.Not.Contain("Reward queued: test salvage"));
    }

    [Test]
    public void BootstrapFallsBackToGeneratedHardpointsWhenImportedBindingCannotSatisfyRequirements()
    {
        GameObject preexistingShip = new GameObject("PrototypeShip");
        var preexistingFunctionalBinder = preexistingShip.AddComponent<PrototypeFunctionalShipBinder>();
        SetPrivateField(preexistingFunctionalBinder, "createMissingRuntimeComponents", false);
        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        Assert.True(GetPrivateField<bool>(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing"));

        bootstrap.BuildBuiltInVariant(0);

        GameObject builtShip = GameObject.Find("PrototypeShip");
        Assert.NotNull(builtShip);
        Assert.NotNull(builtShip.transform.Find(PrototypeShipHardpointBinder.GeneratedHardpointRigName));
        Assert.That(builtShip.GetComponentsInChildren<PrototypeShipHardpoint>(true).Length, Is.GreaterThan(0));
        EngineVfxController engine = builtShip.GetComponent<EngineVfxController>();
        Assert.NotNull(engine);
        Assert.True(engine.AllowFallbackNozzle);
        RcsThrusterController rcs = builtShip.GetComponent<RcsThrusterController>();
        Assert.NotNull(rcs);
        Assert.False(rcs.UseImportedFunctionalSockets);

        Assert.NotNull(Object.FindAnyObjectByType<PrototypePveArenaLoop>());
        Assert.That(Object.FindAnyObjectByType<PrototypePveArenaLoop>().Snapshot.TotalTargets, Is.GreaterThanOrEqualTo(3));
    }

    [Test]
    public void BootstrapCreatesPlayerHudRendererSnapshotWithArenaLoop()
    {
        GameObject preexistingShip = new GameObject("PrototypeShip");
        var preexistingFunctionalBinder = preexistingShip.AddComponent<PrototypeFunctionalShipBinder>();
        SetPrivateField(preexistingFunctionalBinder, "createMissingRuntimeComponents", false);
        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);

        bootstrap.BuildBuiltInVariant(0);

        PrototypePlayerHudRenderer liveRenderer = Object.FindAnyObjectByType<PrototypePlayerHudRenderer>();
        Assert.NotNull(liveRenderer);

        liveRenderer.RefreshNow();
        PrototypePveArenaSnapshot liveArenaSnapshot = liveRenderer.LastSnapshot.Arena;
        Assert.True(liveArenaSnapshot.Active);
        Assert.That(liveArenaSnapshot.TotalTargets, Is.GreaterThanOrEqualTo(3));

        PrototypePveArenaLoop bootstrapArena = Object.FindAnyObjectByType<PrototypePveArenaLoop>();
        Assert.NotNull(bootstrapArena);
        Assert.That(bootstrapArena.Snapshot.TotalTargets, Is.EqualTo(liveArenaSnapshot.TotalTargets));
    }

    private static PrototypePveArenaLoop CreateArena()
    {
        GameObject arenaObject = new GameObject("PrototypePveArenaLoopTest");
        PrototypePveArenaLoop arena = arenaObject.AddComponent<PrototypePveArenaLoop>();
        arena.Configure("Clear Test Arena", "Reward queued: test salvage", 3, 50f, new Vector3(0f, 0f, 60f), 9f);
        arena.ResetArena();
        return arena;
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static T GetPrivateField<T>(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        return (T)field.GetValue(target);
    }
}
#endif
