#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeShipVariantValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("VariantTestBootstrap");
    }

    [Test]
    public void BuiltInVariantsExposeExpectedPrototypeCases()
    {
        PrototypeShipVariant[] variants = PrototypeShipVariant.BuiltIns();

        Assert.That(variants.Length, Is.EqualTo(8));
        Assert.That(variants[0].VariantId, Is.EqualTo("baseline-balanced"));
        Assert.That(variants[1].VariantId, Is.EqualTo("dual-main-thruster"));
        Assert.That(variants[2].VariantId, Is.EqualTo("off-center-main-thruster"));
        Assert.That(variants[3].VariantId, Is.EqualTo("one-sided-rcs"));
        Assert.That(variants[4].VariantId, Is.EqualTo("heavy-cargo"));
        Assert.That(variants[5].VariantId, Is.EqualTo("no-rcs"));
        Assert.That(variants[6].VariantId, Is.EqualTo("blueprint-scout"));
        Assert.That(variants[7].VariantId, Is.EqualTo("blueprint-hauler"));
    }

    [Test]
    public void BaselineVariantBuildsStableRigAndRebindsDebugConsole()
    {
        GameObject ship = BuildVariant(0);

        Assert.NotNull(ship.GetComponent<PlayerShipController>());
        Assert.NotNull(ship.GetComponent<MainThrusterBank>());
        Assert.NotNull(ship.GetComponent<RcsThrusterController>());
        Assert.That(ship.GetComponent<MainThrusterBank>().ThrusterCount, Is.EqualTo(1));
        Assert.That(ship.GetComponent<RcsThrusterController>().InstalledNozzleCount, Is.EqualTo(20));
        Assert.NotNull(Camera.main);
        Assert.NotNull(Camera.main.GetComponent<PrototypeFlightDebugConsole>());
        Assert.NotNull(Camera.main.GetComponent<PrototypeKeybindOverlay>());
    }

    [Test]
    public void DebugConsoleBackedActionsMirrorRuntimeControllerState()
    {
        GameObject ship = BuildVariant(0);
        var controller = ship.GetComponent<PlayerShipController>();
        var stats = ship.GetComponent<ShipStats>();
        var body = ship.GetComponent<Rigidbody>();

        Assert.NotNull(Camera.main.GetComponent<PrototypeFlightDebugConsole>());

        controller.SetRcsEnabled(false);
        Assert.False(controller.RcsEnabled);
        controller.SetRcsEnabled(true);
        Assert.True(controller.RcsEnabled);

        controller.SetSasEnabled(false);
        Assert.False(controller.SasEnabled);
        controller.SetSasEnabled(true);
        Assert.True(controller.SasEnabled);
        Assert.True(controller.HasSasTargetRotation);

        controller.SetPrecisionControls(true);
        Assert.True(controller.PrecisionControls);
        controller.SetPrecisionControls(false);
        Assert.False(controller.PrecisionControls);

        controller.SetMainThrottle(0.42f);
        Assert.That(controller.MainThrottle, Is.EqualTo(0.42f).Within(0.0001f));
        controller.FullMainThrottle();
        Assert.That(controller.MainThrottle, Is.EqualTo(1f).Within(0.0001f));
        controller.CutMainThrottle();
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));

        stats.ConsumeFuelForThrust(1f, 1f);
        Assert.That(stats.CurrentFuelKg, Is.LessThan(stats.MaxFuelKg));
        controller.RefuelFull();
        Assert.That(stats.CurrentFuelKg, Is.EqualTo(stats.MaxFuelKg).Within(0.0001f));

        body.linearVelocity = new Vector3(12f, -3f, 4f);
        body.angularVelocity = new Vector3(0.4f, 0.5f, -0.3f);
        controller.ResetVelocity();
        controller.ResetAngularVelocity();

        Assert.That(body.linearVelocity.magnitude, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(body.angularVelocity.magnitude, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void DebugVectorTogglesUpdateRuntimeOverlayState()
    {
        BuildVariant(0);
        var overlay = Camera.main.GetComponent<PrototypeDebugOverlay>();

        Assert.NotNull(overlay);

        overlay.SetDrawDebugVectors(false);
        overlay.SetDrawDebugGizmos(false);
        Assert.False(overlay.DrawDebugVectors);
        Assert.False(overlay.DrawDebugGizmos);

        overlay.SetDrawDebugVectors(true);
        overlay.SetDrawDebugGizmos(true);
        Assert.True(overlay.DrawDebugVectors);
        Assert.True(overlay.DrawDebugGizmos);
    }

    [Test]
    public void DualMainThrusterVariantAppliesSymmetricComSafeThrustWithoutUnintendedTorque()
    {
        GameObject ship = BuildVariant(1);
        MainThrusterBank bank = ship.GetComponent<MainThrusterBank>();
        ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();

        Assert.That(bank.ThrusterCount, Is.EqualTo(2));

        physicsCore.BeginPhysicsStep();
        float thrust = bank.Fire(1f, 0f, 0f, 0.02f);

        Assert.That(thrust, Is.GreaterThan(48000f));
        Assert.That(physicsCore.NetAppliedForce.z, Is.GreaterThan(48000f));
        Assert.That(physicsCore.NetAppliedTorque.magnitude, Is.LessThan(0.01f));
    }

    [Test]
    public void OffCenterMainThrusterVariantShowsComSafeVsPhysicalTorqueDifference()
    {
        GameObject ship = BuildVariant(2);
        MainThrusterBank bank = ship.GetComponent<MainThrusterBank>();
        ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();

        Assert.That(bank.ThrusterCount, Is.EqualTo(1));

        physicsCore.BeginPhysicsStep();
        bank.Fire(1f, 0f, 0f, 0.02f);

        Assert.That(physicsCore.NetAppliedForce.z, Is.GreaterThan(40000f));
        Assert.That(physicsCore.NetAppliedTorque.magnitude, Is.LessThan(0.01f));

        bank.SetThrustMode(MainThrustMode.FullyPhysicalNozzleForce);

        physicsCore.BeginPhysicsStep();
        bank.Fire(1f, 0f, 0f, 0.02f);

        Assert.That(physicsCore.NetAppliedForce.z, Is.GreaterThan(40000f));
        Assert.That(Mathf.Abs(physicsCore.NetAppliedTorque.y), Is.GreaterThan(1000f));
    }

    [Test]
    public void DualMainThrusterSingleEngineFailureCreatesExpectedPhysicalTorque()
    {
        GameObject ship = BuildVariant(1);
        MainThrusterBank bank = ship.GetComponent<MainThrusterBank>();
        ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();
        MainThrusterModule[] thrusters = ship.GetComponents<MainThrusterModule>();

        Assert.That(thrusters.Length, Is.EqualTo(2));

        PrototypeThermalModule failedThermal = thrusters[0].ThermalModule;
        Assert.NotNull(failedThermal);
        failedThermal.SetSimulationEnabled(true);
        failedThermal.SetTemperature(failedThermal.MaxTemperature + 25f);
        Assert.True(failedThermal.ShouldDisableModule);

        bank.SetThrustMode(MainThrustMode.FullyPhysicalNozzleForce);

        physicsCore.BeginPhysicsStep();
        float appliedThrust = bank.Fire(1f, 0f, 0f, 0.02f);

        Assert.That(appliedThrust, Is.GreaterThan(20000f));
        Assert.That(appliedThrust, Is.LessThan(30000f));
        Assert.That(physicsCore.NetAppliedForce.z, Is.GreaterThan(20000f));
        Assert.That(Mathf.Abs(physicsCore.NetAppliedTorque.y), Is.GreaterThan(1000f));
        Assert.That(Vector3.Distance(physicsCore.NetAppliedTorque, bank.LastEstimatedTorque), Is.LessThan(0.01f));
    }

    [Test]
    public void OneSidedRcsVariantReportsResidualForUnsupportedTranslation()
    {
        GameObject ship = BuildVariant(3);
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();

        Assert.That(rcs.InstalledNozzleCount, Is.EqualTo(10));

        physicsCore.BeginPhysicsStep();
        rcs.ApplyControls(Vector3.left, Vector3.zero, false, 0.02f);

        Assert.That(rcs.LastDesiredRcsForceWorld.magnitude, Is.GreaterThan(8000f));
        Assert.That(rcs.LastResidualRcsForceWorld.magnitude, Is.LessThan(1000f));
        Assert.That(rcs.LastActualRcsForceWorld.magnitude, Is.GreaterThan(1000f));
        Assert.That(rcs.LastAllocatorStatus, Is.EqualTo("stable-prototype"));
    }

    [Test]
    public void NoRcsVariantReportsMissingRcsAuthority()
    {
        GameObject ship = BuildVariant(5);
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();

        Assert.That(rcs.InstalledNozzleCount, Is.EqualTo(0));

        physicsCore.BeginPhysicsStep();
        rcs.ApplyControls(Vector3.right, Vector3.up, false, 0.02f);

        Assert.That(rcs.LastAllocatorStatus, Is.EqualTo("no nozzles"));
        Assert.That(rcs.LastActualRcsForceWorld.magnitude, Is.LessThan(0.01f));
        Assert.That(rcs.LastActualRcsTorqueWorld.magnitude, Is.LessThan(0.01f));
    }

    private static GameObject BuildVariant(int builtInIndex)
    {
        var bootstrapObject = new GameObject("VariantTestBootstrap");
        var bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
        bootstrap.BuildBuiltInVariant(builtInIndex);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        return ship;
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
