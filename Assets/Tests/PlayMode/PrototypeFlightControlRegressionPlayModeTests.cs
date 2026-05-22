using System.Collections.Generic;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeFlightControlRegressionPlayModeTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private const float ImportedScoutMaxLeverArmMeters = 10f;
    private const float ImportedCargoMaxLeverArmMeters = 20f;
    private const float MaxNormalAngularVelocity = 2.5f;
    private const float MaxRecoilAngularVelocity = 0.75f;
    private const float MaxTranslationAngularVelocity = 0.5f;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("FlightControlRegressionBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");
        DestroyNamed("PrototypeShipVisualSwitcher");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [TestCase(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault)]
    [TestCase(PrototypeShipBuildMode.ImportedDemoCargoFunctional)]
    public void ImportedFunctionalRcsSocketsUseShipAxisForceDirections(PrototypeShipBuildMode mode)
    {
        GameObject ship = BuildImportedShip(mode);
        Transform rig = ship.transform.Find(PrototypeFunctionalShipBinder.FunctionalSocketRigName);
        Assert.NotNull(rig);

        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Forward, ship.transform.forward);
        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Back, -ship.transform.forward);
        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Left, -ship.transform.right);
        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Right, ship.transform.right);
        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Up, ship.transform.up);
        AssertDirection(rig, ship.transform, PrototypeShipSocketDirection.Down, -ship.transform.up);
    }

    [Test]
    public void ImportedFunctionalPhysicsSanityHasSaneInertiaAndLeverArms()
    {
        GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PrototypeShipPhysicsSanityReport report = PrototypeShipPhysicsSanity.Capture(ship);

        Assert.False(body.automaticCenterOfMass);
        Assert.False(body.automaticInertiaTensor);
        Assert.True(report.hasModuleMassDescriptors);
        Assert.That(report.moduleMassDescriptorCount, Is.GreaterThanOrEqualTo(6));
        Assert.That(report.inertiaTensor.x, Is.GreaterThan(100f));
        Assert.That(report.inertiaTensor.y, Is.GreaterThan(100f));
        Assert.That(report.inertiaTensor.z, Is.GreaterThan(100f));
        Assert.That(report.maxRcsNozzleLeverArm, Is.LessThan(ImportedScoutMaxLeverArmMeters));
        Assert.That(report.averageRcsNozzleLeverArm, Is.GreaterThan(0f));
        Assert.That(report.maxMuzzleLeverArm, Is.LessThan(ImportedScoutMaxLeverArmMeters));
        Assert.That(report.maxMainNozzleLeverArm, Is.LessThan(ImportedScoutMaxLeverArmMeters));
        Assert.That(report.computedTorqueAuthority, Is.LessThanOrEqualTo(12000.1f));
    }

    [Test]
    public void ImportedDefaultTranslationModeMovesThroughPlayerControllerOverFrames()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
            ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();
            Assert.NotNull(controller);
            Assert.NotNull(body);
            Assert.NotNull(rcs);
            Assert.NotNull(physicsCore);

            ResetManualFlight(controller, body, true);
            controller.SetControlMode(FlightControlMode.Translation);

            float maxAngularSpeed = 0f;
            for (int i = 0; i < 60; i++)
            {
                controller.ApplyModeSpecificInputForTests(w: true, s: false, a: false, d: false, q: false, e: false, h: false, n: false, shift: false, ctrl: false);
                InvokeFixedUpdate(controller);
                Physics.Simulate(Time.fixedDeltaTime);
                maxAngularSpeed = Mathf.Max(maxAngularSpeed, body.angularVelocity.magnitude);
            }

            float forwardSpeed = Vector3.Dot(body.linearVelocity, ship.transform.forward);
            Assert.That(controller.RcsTranslationCommand.z, Is.GreaterThan(0.5f));
            Assert.That(rcs.LastDesiredRcsForceWorld.magnitude, Is.GreaterThan(1000f));
            Assert.That(Vector3.Dot(rcs.LastActualRcsForceWorld, ship.transform.forward), Is.GreaterThan(1000f), rcs.LastAllocatorStatus);
            Assert.That(rcs.LastResidualRcsForceWorld.magnitude, Is.LessThan(rcs.LastDesiredRcsForceWorld.magnitude * 0.25f), rcs.LastAllocatorStatus);
            Assert.That(rcs.LastActualRcsTorqueWorld.magnitude, Is.LessThan(500f), rcs.LastAllocatorStatus);
            Assert.That(forwardSpeed, Is.GreaterThan(0.25f));
            Assert.That(maxAngularSpeed, Is.LessThan(0.5f));
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void TranslationModeAllAxesAreStableForImportedDefault()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();

            AssertTranslationAxis(ship, controller, body, rcs, true, false, false, false, false, false, false, false, ship.transform.forward);
            AssertTranslationAxis(ship, controller, body, rcs, false, true, false, false, false, false, false, false, -ship.transform.forward);
            AssertTranslationAxis(ship, controller, body, rcs, false, false, true, false, false, false, false, false, -ship.transform.right);
            AssertTranslationAxis(ship, controller, body, rcs, false, false, false, true, false, false, false, false, ship.transform.right);
            AssertTranslationAxis(ship, controller, body, rcs, false, false, false, false, false, false, true, false, ship.transform.up);
            AssertTranslationAxis(ship, controller, body, rcs, false, false, false, false, false, false, false, true, -ship.transform.up);
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void ImportedDefaultNormalAttitudeRotatesWithoutResidualLinearDrift()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();

            ResetManualFlight(controller, body, true);
            controller.SetControlMode(FlightControlMode.Normal);

            float maxLinearSpeed = 0f;
            for (int i = 0; i < 60; i++)
            {
                controller.ApplyModeSpecificInputForTests(w: false, s: false, a: false, d: true, q: false, e: false, h: false, n: false, shift: false, ctrl: false);
                InvokeFixedUpdate(controller);
                Physics.Simulate(Time.fixedDeltaTime);
                maxLinearSpeed = Mathf.Max(maxLinearSpeed, body.linearVelocity.magnitude);
            }

            Assert.That(controller.RcsAttitudeCommand.y, Is.GreaterThan(0.5f));
            Assert.That(rcs.LastDesiredRcsTorqueWorld.magnitude, Is.GreaterThan(1000f));
            Assert.That(rcs.LastActualRcsTorqueWorld.magnitude, Is.GreaterThan(100f), rcs.LastAllocatorStatus);
            Assert.That(rcs.LastActualRcsForceWorld.magnitude, Is.LessThan(50f), rcs.LastAllocatorStatus);
            Assert.That(maxLinearSpeed, Is.LessThan(0.25f));
            Assert.That(body.angularVelocity.magnitude, Is.GreaterThan(0.01f));
            Assert.That(body.angularVelocity.magnitude, Is.LessThan(MaxNormalAngularVelocity));
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void NormalModeWasdAngularVelocityIsBounded()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();

            AssertAttitudeAxis(controller, body, true, false, false, false, false, false);
            AssertAttitudeAxis(controller, body, false, true, false, false, false, false);
            AssertAttitudeAxis(controller, body, false, false, true, false, false, false);
            AssertAttitudeAxis(controller, body, false, false, false, true, false, false);
            AssertAttitudeAxis(controller, body, false, false, false, false, true, false);
            AssertAttitudeAxis(controller, body, false, false, false, false, false, true);
            Assert.That(ship.transform.position.magnitude, Is.LessThan(10f));
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void SpaceFireDoesNotCauseWildSpin()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            GunModule gun = ship.GetComponent<GunModule>();
            PrototypeTurretWeapon turret = ship.GetComponentInChildren<PrototypeTurretWeapon>();
            Assert.NotNull(gun);
            Assert.NotNull(turret);

            ResetManualFlight(controller, body, true);
            SetPrivateField(turret, "nextFireTime", -1f);
            Assert.True(gun.TryFire(), "Default imported scout should fire through its real GunModule/Turret path.");

            float maxAngularSpeed = body.angularVelocity.magnitude;
            for (int i = 0; i < 60; i++)
            {
                controller.ApplyModeSpecificInputForTests(w: false, s: false, a: false, d: false, q: false, e: false, h: false, n: false, shift: false, ctrl: false);
                InvokeFixedUpdate(controller);
                Physics.Simulate(Time.fixedDeltaTime);
                maxAngularSpeed = Mathf.Max(maxAngularSpeed, body.angularVelocity.magnitude);
            }

            PrototypeShipPhysicsSanityReport report = PrototypeShipPhysicsSanity.Capture(ship);
            Assert.That(report.maxMuzzleLeverArm, Is.LessThan(ImportedScoutMaxLeverArmMeters));
            Assert.That(report.recoilAngularImpulseWorld.magnitude, Is.LessThan(1f));
            Assert.That(maxAngularSpeed, Is.LessThan(MaxRecoilAngularVelocity));
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void ManualTranslationInputClearsStaleExternalAssistBeforeRcsApply()
    {
        GameObject ship = BuildImportedShip(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault);
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();

        controller.SetExternalFlightAssistRequest(new FlightAssistRequest(
            FlightAssistMode.AssistedFlight,
            FlightAssistRequestSource.WaypointAutopilot,
            ship.transform.right * 4000f,
            Vector3.up * 4000f,
            false));
        controller.SetControlMode(FlightControlMode.Translation);
        controller.ApplyModeSpecificInputForTests(w: true, s: false, a: false, d: false, q: false, e: false, h: false, n: false, shift: false, ctrl: false);

        InvokeFixedUpdate(controller);

        Assert.False(controller.HasExternalFlightAssistRequest);
        Assert.That(controller.LastFlightAssistRequest.source, Is.Not.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        Assert.That(rcs.LastFlightAssistSource, Is.Not.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        Assert.That(Vector3.Dot(rcs.LastDesiredRcsForceWorld, ship.transform.forward), Is.GreaterThan(1000f));
    }

    private static GameObject BuildImportedShip(PrototypeShipBuildMode mode)
    {
        DestroyNamed("FlightControlRegressionBootstrap");
        DestroyNamed("PrototypeShip");
        var host = new GameObject("FlightControlRegressionBootstrap");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.SetBuildMode(mode, false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());
        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(mode));
        Assert.NotNull(ship.GetComponent<Rigidbody>());
        Assert.NotNull(ship.GetComponent<PlayerShipController>());
        Assert.NotNull(ship.GetComponent<RcsThrusterController>());
        Assert.True(ship.GetComponent<RcsThrusterController>().UseImportedFunctionalSockets);
        Assert.That(ship.GetComponent<RcsThrusterController>().InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
        return ship;
    }

    private static void AssertDirection(Transform rig, Transform ship, PrototypeShipSocketDirection direction, Vector3 expectedWorld)
    {
        List<PrototypeShipSocket> sockets = PrototypeShipSocketUtility.FindSockets(rig, PrototypeShipSocketType.RcsNozzle, false);
        float bestDot = -1f;
        string bestName = string.Empty;
        for (int i = 0; i < sockets.Count; i++)
        {
            PrototypeShipSocket socket = sockets[i];
            if (socket == null || socket.Direction != direction)
            {
                continue;
            }

            float dot = Vector3.Dot(socket.transform.forward.normalized, expectedWorld.normalized);
            if (dot > bestDot)
            {
                bestDot = dot;
                bestName = socket.name;
            }
        }

        Assert.That(bestDot, Is.GreaterThan(0.95f), $"Direction {direction} best socket {bestName} on {ship.name}");
    }

    private static void AssertTranslationAxis(
        GameObject ship,
        PlayerShipController controller,
        Rigidbody body,
        RcsThrusterController rcs,
        bool w,
        bool s,
        bool a,
        bool d,
        bool q,
        bool e,
        bool h,
        bool n,
        Vector3 expectedDirection)
    {
        ResetManualFlight(controller, body, true);
        controller.SetControlMode(FlightControlMode.Translation);
        float maxAngularSpeed = 0f;
        Vector3 previousForce = Vector3.zero;
        bool hasPreviousForce = false;
        for (int i = 0; i < 60; i++)
        {
            controller.ApplyModeSpecificInputForTests(w, s, a, d, q, e, h, n, false, false);
            InvokeFixedUpdate(controller);
            Physics.Simulate(Time.fixedDeltaTime);
            maxAngularSpeed = Mathf.Max(maxAngularSpeed, body.angularVelocity.magnitude);
            if (hasPreviousForce && rcs.LastActualRcsForceWorld.sqrMagnitude > 1f && previousForce.sqrMagnitude > 1f)
            {
                Assert.That(Vector3.Dot(previousForce.normalized, rcs.LastActualRcsForceWorld.normalized), Is.GreaterThan(0.95f));
            }

            previousForce = rcs.LastActualRcsForceWorld;
            hasPreviousForce = true;
        }

        float velocityDot = Vector3.Dot(body.linearVelocity, expectedDirection.normalized);
        Assert.That(velocityDot, Is.GreaterThan(0.25f), ship.name);
        Assert.That(maxAngularSpeed, Is.LessThan(MaxTranslationAngularVelocity), rcs.LastAllocatorStatus);
    }

    private static void AssertAttitudeAxis(PlayerShipController controller, Rigidbody body, bool w, bool s, bool a, bool d, bool q, bool e)
    {
        ResetManualFlight(controller, body, true);
        controller.SetControlMode(FlightControlMode.Normal);
        float maxAngularSpeed = 0f;
        float maxLinearSpeed = 0f;
        for (int i = 0; i < 60; i++)
        {
            controller.ApplyModeSpecificInputForTests(w, s, a, d, q, e, false, false, false, false);
            InvokeFixedUpdate(controller);
            Physics.Simulate(Time.fixedDeltaTime);
            maxAngularSpeed = Mathf.Max(maxAngularSpeed, body.angularVelocity.magnitude);
            maxLinearSpeed = Mathf.Max(maxLinearSpeed, body.linearVelocity.magnitude);
        }

        Assert.That(maxAngularSpeed, Is.GreaterThan(0.01f));
        Assert.That(maxAngularSpeed, Is.LessThan(MaxNormalAngularVelocity));
        Assert.That(maxLinearSpeed, Is.LessThan(0.25f));
    }

    private static void ResetManualFlight(PlayerShipController controller, Rigidbody body, bool sasEnabled)
    {
        controller.ResetFlightState(Vector3.zero, Quaternion.identity, true);
        controller.SetSasEnabled(sasEnabled);
        controller.SetRcsEnabled(true);
        controller.ClearExternalFlightAssistRequest();
        body.linearVelocity = Vector3.zero;
        body.angularVelocity = Vector3.zero;
        Physics.SyncTransforms();
    }

    private static void InvokeFixedUpdate(PlayerShipController controller)
    {
        MethodInfo fixedUpdate = typeof(PlayerShipController).GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(controller, null);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field);
        field.SetValue(target, value);
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
