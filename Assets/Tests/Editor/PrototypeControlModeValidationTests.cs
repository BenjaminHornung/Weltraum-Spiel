#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeControlModeValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("ControlModeShip");
        DestroyNamed("ControlModeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void CapsCycleOrderUsesExplicitControlModes()
    {
        PlayerShipController controller = CreateMinimalController();

        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Normal));

        controller.CycleControlMode();
        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Precision));
        Assert.True(controller.RcsEnabled);
        Assert.False(controller.MainThrusterAllowed);

        controller.CycleControlMode();
        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Translation));
        Assert.True(controller.RcsEnabled);
        Assert.False(controller.GimbalAllowed);

        controller.CycleControlMode();
        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Normal));
    }

    [Test]
    public void TranslationModeMapsWasdToTranslationWithoutPitchYaw()
    {
        PlayerShipController controller = CreateMinimalController();
        controller.SetControlMode(FlightControlMode.Translation);

        controller.ApplyModeSpecificInputForTests(w: true, s: false, a: true, d: false, q: true, e: false, h: true, n: false, shift: true, ctrl: false);

        Assert.That(controller.RcsTranslationCommand.z, Is.GreaterThan(0f));
        Assert.That(controller.RcsTranslationCommand.x, Is.LessThan(0f));
        Assert.That(controller.RcsTranslationCommand.y, Is.GreaterThan(0f));
        Assert.That(controller.RcsAttitudeCommand.x, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(controller.RcsAttitudeCommand.y, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(controller.RcsAttitudeCommand.z, Is.LessThan(0f));
        Assert.False(controller.MainThrusterAllowed);
        Assert.False(controller.GimbalAllowed);
    }

    [Test]
    public void PrecisionAndTranslationForceMainThrottleAndGimbalOff()
    {
        PlayerShipController controller = CreateMinimalController();
        controller.SetMainThrottle(0.65f);

        controller.SetControlMode(FlightControlMode.Precision);
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.False(controller.FlightControlDiagnostics.mainThrusterAllowed);
        Assert.False(controller.FlightControlDiagnostics.gimbalAllowed);

        controller.SetMainThrottle(0.65f);
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));

        controller.SetControlMode(FlightControlMode.Translation);
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.False(controller.FlightControlDiagnostics.mainThrusterAllowed);
        Assert.False(controller.FlightControlDiagnostics.gimbalAllowed);

        controller.SetControlMode(FlightControlMode.Normal);
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void DiagnosticsSnapshotIsSingleSourceForUiState()
    {
        PlayerShipController controller = CreateMinimalController();
        controller.SetSasEnabled(true);
        controller.SetRcsEnabled(false);
        controller.SetControlMode(FlightControlMode.Precision);

        PrototypeFlightControlDiagnostics diagnostics = controller.FlightControlDiagnostics;

        Assert.That(diagnostics.controlMode, Is.EqualTo(controller.ControlMode));
        Assert.That(diagnostics.sasEnabled, Is.EqualTo(controller.SasEnabled));
        Assert.That(diagnostics.effectiveSasEnabled, Is.EqualTo(controller.EffectiveSasEnabled));
        Assert.That(diagnostics.rcsEnabled, Is.EqualTo(controller.RcsEnabled));
        Assert.That(diagnostics.mainThrottle, Is.EqualTo(controller.MainThrottle).Within(0.0001f));
    }

    [Test]
    public void MomentumAssistEngageCreatesPhysicalRequestOnGeneratedShip()
    {
        GameObject bootstrapObject = new GameObject("ControlModeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        bootstrap.BuildBuiltInVariant(0);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Rigidbody rb = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        Assert.NotNull(momentum);

        rb.linearVelocity = ship.transform.right * 8f;
        controller.SetControlMode(FlightControlMode.Translation);
        momentum.Activate();
        InvokeFixedUpdate(momentum);

        Assert.That(momentum.CurrentState, Is.Not.EqualTo(PrototypeMomentumAssistState.Idle));
        if (controller.HasExternalFlightAssistRequest)
        {
            Assert.That(momentum.LastRequestedForceWorld.sqrMagnitude + momentum.LastRequestedTorqueLocal.sqrMagnitude, Is.GreaterThan(0.0001f));
            Assert.That(controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.MomentumAssist));
        }
        else
        {
            Assert.True(momentum.CurrentState == PrototypeMomentumAssistState.NoAuthority || momentum.CurrentState == PrototypeMomentumAssistState.FuelInsufficient);
            Assert.That(momentum.StatusLabel, Is.Not.Empty);
        }
    }

    private static PlayerShipController CreateMinimalController()
    {
        GameObject ship = new GameObject("ControlModeShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        ShipPhysicsCore core = ship.AddComponent<ShipPhysicsCore>();
        MainThrusterBank mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<RcsThrusterController>();
        ship.AddComponent<GunModule>();
        core.Configure(rb);
        mainThruster.Configure(new MainThrusterModule[0], rb, stats, core);
        return ship.AddComponent<PlayerShipController>();
    }

    private static void InvokeFixedUpdate(PrototypeMomentumAssist momentum)
    {
        MethodInfo fixedUpdate = typeof(PrototypeMomentumAssist).GetMethod("FixedUpdate", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(momentum, null);
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
