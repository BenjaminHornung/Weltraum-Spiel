#if UNITY_EDITOR
using NUnit.Framework;
using System.IO;
using UnityEngine;

public class PrototypeShipBuilderV0ValidationTests
{
    [SetUp]
    public void SetUp()
    {
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("PrototypeShipBuilderHudTestCamera");
        DestroyNamed("EventSystem");
        DestroyNamed("BlueprintBootstrapHost");
        DestroyNamed("PrototypeDockingApproachTarget");
    }

    [TearDown]
    public void TearDown()
    {
        SetUp();
    }

    [Test]
    public void SessionCommandsSnapUndoMirrorAndKeepUniqueIds()
    {
        var session = new PrototypeShipBuilderSession(PrototypeShipBuilderSession.CreateEditableCopy(PrototypeShipBlueprintCatalog.ScoutBlueprint(), "builder-test"));
        int initialCount = session.Instances.Count;
        session.SetMirrorX(true);

        PrototypeShipModuleInstance first = session.AddModule("rcs-pod-65", new Vector3(0.37f, 0.12f, 0.13f));
        PrototypeShipModuleInstance second = session.AddModule("rcs-pod-65", new Vector3(0.62f, 0.12f, 0.13f));

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.That(first.LocalPosition, Is.EqualTo(new Vector3(0.25f, 0f, 0.25f)));
        Assert.That(session.Instances.Count, Is.EqualTo(initialCount + 4));
        Assert.True(session.IsDirty);
        Assert.True(session.Validate().BlueprintReport.IsValid, string.Join("\n", session.Validate().BlueprintReport.Errors));

        var ids = new System.Collections.Generic.HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < session.Instances.Count; i++)
        {
            Assert.True(ids.Add(session.Instances[i].InstanceId), "Duplicate id: " + session.Instances[i].InstanceId);
        }

        Assert.True(session.Undo());
        Assert.That(session.Instances.Count, Is.EqualTo(initialCount + 2));
        Assert.True(session.Undo());
        Assert.That(session.Instances.Count, Is.EqualTo(initialCount));
    }

    [Test]
    public void SessionValidationComposesCanonicalAndSpatialFindingsWithoutMutatingBlueprintValidate()
    {
        PrototypeShipBlueprint custom = CompleteCustomBlueprint(
            new PrototypeShipModuleInstance("overlap-a", "hull-core", Vector3.zero),
            new PrototypeShipModuleInstance("overlap-b", "hull-core", Vector3.zero));
        var session = new PrototypeShipBuilderSession(custom);

        PrototypeShipBlueprintValidationReport canonical = session.DraftBlueprint.Validate();
        PrototypeShipBuilderValidationResult composed = session.Validate();

        Assert.True(canonical.IsValid, string.Join("\n", canonical.Errors));
        Assert.False(composed.IsValid);
        Assert.That(composed.SpatialReport.ErrorCount, Is.GreaterThanOrEqualTo(1));
        Assert.That(composed.FirstError, Does.Contain("ueberlappen"));
    }

    [Test]
    public void SessionStatsUseBuildVariantFuelSettingsForDeltaV()
    {
        var session = new PrototypeShipBuilderSession(CompleteCustomBlueprint());
        PrototypeShipBuilderStats stats = session.BuildStats();
        PrototypeShipBlueprintBuildResult build = session.DraftBlueprint.BuildVariant();
        float expectedExhaustVelocity = build.TotalMainThrustForce / build.Variant.Fuel.fullThrottleFuelKgPerSecond;
        float expectedDeltaV = expectedExhaustVelocity * Mathf.Log((build.TotalDryMassKg + build.TotalFuelCapacityKg) / build.TotalDryMassKg);

        Assert.True(stats.IsAvailable);
        Assert.That(stats.DryMassKg, Is.EqualTo(build.TotalDryMassKg).Within(0.001f));
        Assert.That(stats.FuelCapacityKg, Is.EqualTo(build.TotalFuelCapacityKg).Within(0.001f));
        Assert.That(stats.DeltaV, Is.EqualTo(expectedDeltaV).Within(0.01f));
    }

    [Test]
    public void StoreRoundTripsSanitizesAndMarksDamagedFiles()
    {
        string root = Path.Combine(Path.GetTempPath(), "weltraum-builder-store-tests", System.Guid.NewGuid().ToString("N"));
        try
        {
            var store = new PrototypeShipBlueprintStore(root);
            PrototypeShipBlueprint source = CompleteCustomBlueprint();
            string saved = store.Save(new PrototypeShipBlueprint("My Fancy Ship!", "My Fancy Ship!", source.Definitions, source.Instances));
            Assert.That(Path.GetFileName(saved), Is.EqualTo("my-fancy-ship.json"));
            Assert.True(store.Exists("my fancy ship"));

            File.WriteAllText(Path.Combine(root, "broken.json"), "{ \"schemaVersion\": 1 }");
            System.Collections.Generic.IReadOnlyList<PrototypeShipBlueprintStoreEntry> entries = store.LoadAll();
            bool foundSaved = false;
            bool foundDamaged = false;
            for (int i = 0; i < entries.Count; i++)
            {
                foundSaved |= entries[i].Blueprint != null && entries[i].Blueprint.BlueprintId == "my-fancy-ship";
                foundDamaged |= entries[i].IsDamaged && entries[i].DisplayName.Contains("broken");
            }

            Assert.True(foundSaved);
            Assert.True(foundDamaged);
            Assert.That(store.AllocateCopyId("scout"), Is.EqualTo("scout-copy-1"));
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, true);
            }
        }
    }

    [Test]
    public void CustomBlueprintWithGenericRcsIdsSpawnsBoundGeneratedRuntimeShip()
    {
        PrototypeShipBlueprintBuildResult build = CompleteCustomBlueprint().BuildVariant();
        Assert.True(build.IsValid, string.Join("\n", build.Validation.Errors));

        SpawnResult spawn = SpawnGeneratedVariant(build.Variant);

        Assert.That(spawn.fuel, Is.EqualTo(build.TotalFuelCapacityKg).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(spawn.mainThrust, Is.EqualTo(build.TotalMainThrustForce).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(spawn.rcsNozzles, Is.GreaterThan(0));
        Assert.That(spawn.rcsNozzles, Is.Not.EqualTo(20));
        Assert.That(spawn.hardpoints, Is.GreaterThan(0));
    }

    [Test]
    public void BuilderHudCreatesRequiredBindingsDynamicRowsAndResponsivePanels()
    {
        var cameraObject = new GameObject("PrototypeShipBuilderHudTestCamera");
        cameraObject.AddComponent<Camera>();
        var hud = cameraObject.AddComponent<PrototypeShipBuilderHud>();
        var session = new PrototypeShipBuilderSession(PrototypeShipBuilderSession.CreateEditableCopy(PrototypeShipBlueprintCatalog.ScoutBlueprint(), "hud-test"));
        session.RemoveModule("Cockpit");
        PrototypeShipBuilderViewModel viewModel = PrototypeShipBuilderViewModel.FromSession(session, PrototypeShipModuleCategory.Hull, 0.5f, false, new PrototypeShipBlueprintStoreEntry[]
        {
            new PrototypeShipBlueprintStoreEntry(PrototypeShipBlueprintCatalog.ScoutBlueprint(), true, false, "Scout Blueprint", string.Empty, string.Empty),
            new PrototypeShipBlueprintStoreEntry(null, false, true, "broken beschaedigt", "broken.json", "bad")
        });

        hud.SetVisible(true);
        hud.ApplySnapshot(viewModel);
        hud.ApplyResponsiveLayoutForTests(1280, 720);

        Assert.True(hud.HasCompleteStaticBindingsForTests());
        Assert.NotNull(FindObjectNamed("ShipBuilderPaletteCard_hull-core"), "palette row");
        Assert.NotNull(FindObjectNamed("ShipBuilderValidationRow_0"), "validation row");
        Assert.NotNull(FindObjectNamed("ShipBuilderLoadRow_0"), "load row");
        Assert.That(FindRect("ShipBuilderPalettePanel").sizeDelta.x, Is.EqualTo(240f));
        Assert.That(FindRect("ShipBuilderInfoPanel").sizeDelta.x, Is.EqualTo(300f));

        hud.ApplyResponsiveLayoutForTests(1920, 1080);
        Assert.That(FindRect("ShipBuilderPalettePanel").sizeDelta.x, Is.EqualTo(280f));
        Assert.That(FindRect("ShipBuilderInfoPanel").sizeDelta.x, Is.EqualTo(340f));
    }

    [Test]
    public void BuilderModeUsesVelocityGateAndEscapePrecedence()
    {
        var cameraObject = new GameObject("PrototypeShipBuilderHudTestCamera");
        cameraObject.AddComponent<Camera>();
        var ship = new GameObject("PrototypeShip");
        var body = ship.AddComponent<Rigidbody>();
        var mode = cameraObject.AddComponent<PrototypeShipBuilderMode>();
        mode.Bind(null, ship.transform, body);

        Assert.True(mode.CanEnterHangar(), "Post-bootstrap allowance should permit first entry.");
        mode.EnterHangar();
        Assert.True(mode.IsActive);
        mode.StartGhost("hull-core");
        Assert.That(mode.ResolveEscapeAction(), Is.EqualTo(PrototypeShipBuilderInputAction.CancelGhost));
        Assert.False(mode.HasGhost);
        Assert.That(mode.ResolveEscapeAction(), Is.EqualTo(PrototypeShipBuilderInputAction.ExitRequested));

        body.linearVelocity = Vector3.right * 2f;
        Assert.False(mode.CanEnterHangar());
        body.linearVelocity = Vector3.zero;
        Assert.True(mode.CanEnterHangar());
    }

    private static PrototypeShipBlueprint CompleteCustomBlueprint(params PrototypeShipModuleInstance[] extraInstances)
    {
        PrototypeShipBlueprint scout = PrototypeShipBlueprintCatalog.ScoutBlueprint();
        var instances = new System.Collections.Generic.List<PrototypeShipModuleInstance>
        {
            new PrototypeShipModuleInstance("custom-hull", "hull-core", Vector3.zero),
            new PrototypeShipModuleInstance("custom-cockpit", "cockpit-mk1", new Vector3(0f, 0.5f, 2.25f)),
            new PrototypeShipModuleInstance("custom-tank", "fuel-tank-300", new Vector3(0f, -0.5f, 0f)),
            new PrototypeShipModuleInstance("custom-engine", "main-engine-45", new Vector3(0f, 0f, -3.4f)),
            new PrototypeShipModuleInstance("custom-rcs-upper", "rcs-pod-65", new Vector3(0.75f, 0.7f, 0.15f), Vector3.zero, new Vector3(0.55f, 0.22f, 0.55f)),
            new PrototypeShipModuleInstance("custom-gun", "gun-light", new Vector3(0f, 0.15f, 3.3f))
        };

        if (extraInstances != null)
        {
            instances.AddRange(extraInstances);
        }

        return new PrototypeShipBlueprint("custom-builder", "Custom Builder", PrototypeShipBuilderSession.CloneDefinitions(scout.Definitions), instances.ToArray());
    }

    private static SpawnResult SpawnGeneratedVariant(PrototypeShipVariant variant)
    {
        var host = new GameObject("BlueprintBootstrapHost");
        try
        {
            PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
            bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
            bootstrap.BuildPrototype(variant);

            GameObject ship = GameObject.Find("PrototypeShip");
            Assert.NotNull(ship);
            var stats = ship.GetComponent<ShipStats>();
            var rcs = ship.GetComponent<RcsThrusterController>();
            var hardpoints = ship.GetComponentsInChildren<PrototypeShipHardpoint>(false);

            Assert.NotNull(stats);
            Assert.NotNull(rcs);

            return new SpawnResult
            {
                fuel = stats.CurrentFuelKg,
                mainThrust = stats.Thrust,
                rcsNozzles = rcs.InstalledNozzleCount,
                hardpoints = hardpoints.Length
            };
        }
        finally
        {
            Object.DestroyImmediate(host);
        }
    }

    private static RectTransform FindRect(string name)
    {
        GameObject target = FindObjectNamed(name);
        Assert.NotNull(target, name);
        return target.GetComponent<RectTransform>();
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = FindObjectNamed(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }

    private static GameObject FindObjectNamed(string objectName)
    {
        Transform[] transforms = Resources.FindObjectsOfTypeAll<Transform>();
        for (int i = 0; i < transforms.Length; i++)
        {
            if (transforms[i] != null && transforms[i].gameObject != null && transforms[i].gameObject.name == objectName)
            {
                return transforms[i].gameObject;
            }
        }

        return null;
    }

    private struct SpawnResult
    {
        public float fuel;
        public float mainThrust;
        public int rcsNozzles;
        public int hardpoints;
    }
}
#endif
