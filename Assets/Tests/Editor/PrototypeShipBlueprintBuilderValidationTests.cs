#if UNITY_EDITOR
using NUnit.Framework;
using System.IO;
using UnityEngine;

public class PrototypeShipBlueprintBuilderValidationTests
{
    [SetUp]
    public void SetUp()
    {
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
    }

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
    }

    [Test]
    public void BuiltInBlueprintsValidateAndExposeTwoGeneratedVariants()
    {
        PrototypeShipBlueprint[] blueprints = PrototypeShipBlueprintCatalog.BuiltInBlueprints();
        PrototypeShipVariant[] variants = PrototypeShipBlueprintCatalog.BuiltInVariants();

        Assert.That(blueprints.Length, Is.GreaterThanOrEqualTo(2));
        Assert.That(variants.Length, Is.GreaterThanOrEqualTo(2));
        Assert.That(blueprints[0].DisplayName, Is.EqualTo("Scout Blueprint"));
        Assert.That(blueprints[1].DisplayName, Is.EqualTo("Hauler Blueprint"));

        for (int i = 0; i < blueprints.Length; i++)
        {
            PrototypeShipBlueprintValidationReport report = blueprints[i].Validate();
            Assert.True(report.IsValid, string.Join("\n", report.Errors));
            Assert.That(report.CockpitCount, Is.GreaterThanOrEqualTo(1));
            Assert.That(report.MainThrusterCount, Is.GreaterThanOrEqualTo(1));
            Assert.That(report.RcsBlockCount, Is.GreaterThanOrEqualTo(1));
            Assert.That(report.GunCount, Is.GreaterThanOrEqualTo(1));
            Assert.That(report.FuelCapacityKg, Is.GreaterThan(0f));
        }
    }

    [Test]
    public void InvalidBlueprintReportsDuplicateMissingAndRequiredData()
    {
        var definition = new PrototypeShipModuleDefinition(
            "cockpit",
            "Cockpit",
            PrototypeShipModuleCategory.Cockpit,
            PrototypeModuleMassRole.Cockpit,
            Vector3.one,
            100f);
        var invalid = new PrototypeShipBlueprint(
            "invalid",
            "Invalid",
            new[] { definition, definition },
            new[]
            {
                new PrototypeShipModuleInstance("dup", "cockpit", Vector3.zero),
                new PrototypeShipModuleInstance("dup", "missing", new Vector3(float.NaN, 0f, 0f))
            });

        PrototypeShipBlueprintValidationReport report = invalid.Validate();

        Assert.False(report.IsValid);
        Assert.That(Contains(report, "Duplicate module definition id"), Is.True);
        Assert.That(Contains(report, "Duplicate module instance id"), Is.True);
        Assert.That(Contains(report, "missing definition"), Is.True);
        Assert.That(Contains(report, "fuel capacity"), Is.True);
        Assert.That(Contains(report, "main thruster"), Is.True);
    }

    [Test]
    public void SampleBlueprintsDeriveDistinctMassFuelThrustRcsAndGunValues()
    {
        PrototypeShipBlueprintBuildResult scout = PrototypeShipBlueprintCatalog.ScoutBlueprint().BuildVariant();
        PrototypeShipBlueprintBuildResult hauler = PrototypeShipBlueprintCatalog.HaulerBlueprint().BuildVariant();

        Assert.True(scout.IsValid, string.Join("\n", scout.Validation.Errors));
        Assert.True(hauler.IsValid, string.Join("\n", hauler.Validation.Errors));
        Assert.That(scout.Variant.VariantId, Is.EqualTo("blueprint-scout"));
        Assert.That(hauler.Variant.VariantId, Is.EqualTo("blueprint-hauler"));
        Assert.That(hauler.TotalDryMassKg, Is.GreaterThan(scout.TotalDryMassKg));
        Assert.That(hauler.TotalFuelCapacityKg, Is.GreaterThan(scout.TotalFuelCapacityKg));
        Assert.That(hauler.TotalMainThrustForce, Is.GreaterThan(scout.TotalMainThrustForce));
        Assert.That(hauler.AverageRcsBlockThrust, Is.GreaterThan(scout.AverageRcsBlockThrust));
        Assert.That(hauler.Variant.Gun.projectileSpeed, Is.LessThan(scout.Variant.Gun.projectileSpeed));
        Assert.That(hauler.Variant.Gun.projectileFireRate, Is.LessThan(scout.Variant.Gun.projectileFireRate));
    }

    [Test]
    public void BlueprintGeneratedVariantsSpawnPlayableRuntimeShips()
    {
        PrototypeShipVariant scout = PrototypeShipBlueprintCatalog.ScoutBlueprint().BuildVariant().Variant;
        PrototypeShipVariant hauler = PrototypeShipBlueprintCatalog.HaulerBlueprint().BuildVariant().Variant;

        SpawnResult scoutSpawn = SpawnGeneratedVariant(scout);
        DestroyNamed("PrototypeShip");
        SpawnResult haulerSpawn = SpawnGeneratedVariant(hauler);

        Assert.That(scoutSpawn.mass, Is.GreaterThan(0f));
        Assert.That(haulerSpawn.mass, Is.GreaterThan(scoutSpawn.mass));
        Assert.That(Vector3.Distance(scoutSpawn.centerOfMass, haulerSpawn.centerOfMass), Is.GreaterThan(0.05f));
        Assert.That(scoutSpawn.fuel, Is.EqualTo(300f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(haulerSpawn.fuel, Is.EqualTo(620f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(scoutSpawn.mainThrust, Is.EqualTo(45000f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(haulerSpawn.mainThrust, Is.EqualTo(56000f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(scoutSpawn.rcsNozzles, Is.EqualTo(20));
        Assert.That(haulerSpawn.rcsNozzles, Is.EqualTo(20));
        Assert.That(scoutSpawn.hardpoints, Is.GreaterThan(0));
        Assert.That(haulerSpawn.hardpoints, Is.GreaterThan(0));
    }

    [Test]
    public void BlueprintLayerDoesNotHardcodeImportedDemoHierarchyPaths()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypeShipBlueprint.cs"));

        Assert.That(source.Contains("ImportedShipVisual"), Is.False);
        Assert.That(source.Contains("demo_scout_mk1"), Is.False);
        Assert.That(source.Contains("Assets/Art/PrototypeShipKit"), Is.False);
    }

    private static bool Contains(PrototypeShipBlueprintValidationReport report, string expected)
    {
        for (int i = 0; i < report.Errors.Count; i++)
        {
            if (report.Errors[i].Contains(expected))
            {
                return true;
            }
        }

        return false;
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
            var body = ship.GetComponent<Rigidbody>();
            var stats = ship.GetComponent<ShipStats>();
            var physicsCore = ship.GetComponent<ShipPhysicsCore>();
            var mainThruster = ship.GetComponent<MainThrusterBank>();
            var rcs = ship.GetComponent<RcsThrusterController>();
            var gun = ship.GetComponent<GunModule>();
            var anchor = ship.GetComponentInChildren<PrototypeCameraAnchor>();
            var descriptors = ship.GetComponentsInChildren<ModuleMassDescriptor>(false);
            var hardpoints = ship.GetComponentsInChildren<PrototypeShipHardpoint>(false);

            Assert.NotNull(body);
            Assert.NotNull(stats);
            Assert.NotNull(physicsCore);
            Assert.NotNull(mainThruster);
            Assert.NotNull(rcs);
            Assert.NotNull(gun);
            Assert.NotNull(anchor);
            Assert.That(descriptors.Length, Is.GreaterThanOrEqualTo(8));

            return new SpawnResult
            {
                mass = body.mass,
                centerOfMass = body.centerOfMass,
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

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }

    private struct SpawnResult
    {
        public float mass;
        public Vector3 centerOfMass;
        public float fuel;
        public float mainThrust;
        public int rcsNozzles;
        public int hardpoints;
    }
}
#endif
