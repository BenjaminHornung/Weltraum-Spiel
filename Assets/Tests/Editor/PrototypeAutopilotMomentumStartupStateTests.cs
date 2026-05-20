#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeAutopilotMomentumStartupStateTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("StartupStateBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("TestMainThruster");
    }

    [Test]
    public void RebuildingExistingPrototypeShipResetsFlightStartupState()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildBuiltInVariant(0);
        GameObject ship = GameObject.Find("PrototypeShip");
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();

        ship.transform.SetPositionAndRotation(new Vector3(7f, 8f, 9f), Quaternion.Euler(15f, 30f, 45f));
        body.linearVelocity = new Vector3(3f, 4f, 5f);
        body.angularVelocity = new Vector3(0.3f, 0.4f, 0.5f);
        controller.SetControlMode(FlightControlMode.Translation);
        controller.SetRcsEnabled(false);
        controller.SetSasEnabled(false);
        controller.SetMainThrottle(0.8f);
        controller.SetExternalFlightAssistRequest(new FlightAssistRequest(FlightAssistMode.AssistedFlight, FlightAssistRequestSource.MomentumAssist, Vector3.right, Vector3.up, false));
        autopilot.ToggleAutopilot();
        momentum.ActivateFromUi();

        bootstrap.BuildBuiltInVariant(0);

        Assert.That(Vector3.Distance(ship.transform.position, new Vector3(0f, 0.5f, 0f)), Is.LessThan(0.0001f));
        Assert.That(Quaternion.Angle(ship.transform.rotation, Quaternion.identity), Is.LessThan(0.001f));
        Assert.That(body.linearVelocity.magnitude, Is.LessThan(0.0001f));
        Assert.That(body.angularVelocity.magnitude, Is.LessThan(0.0001f));
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Normal));
        Assert.True(controller.RcsEnabled);
        Assert.True(controller.SasEnabled);
        Assert.True(controller.HasSasTargetRotation);
        Assert.False(controller.HasExternalFlightAssistRequest);
        Assert.False(autopilot.AutopilotEngaged);
        Assert.False(momentum.IsActive);
    }

    [Test]
    public void DiagnosticsSnapshotExposesSharedRuntimeState()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildBuiltInVariant(0);
        GameObject ship = GameObject.Find("PrototypeShip");
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();

        controller.SetControlMode(FlightControlMode.Precision);
        momentum.ActivateFromUi();
        autopilot.ToggleAutopilot();
        PrototypeFlightControlDiagnostics diagnostics = controller.FlightControlDiagnostics;

        Assert.That(diagnostics.controlMode, Is.EqualTo(controller.ControlMode));
        Assert.That(diagnostics.rcsEnabled, Is.EqualTo(controller.RcsEnabled));
        Assert.That(diagnostics.rcsAvailable, Is.EqualTo(controller.HasRcs));
        Assert.That(diagnostics.rcsAllocatorStatus, Is.EqualTo(controller.LastRcsAllocatorStatus));
        Assert.That(diagnostics.sasEnabled, Is.EqualTo(controller.SasEnabled));
        Assert.That(diagnostics.effectiveSasEnabled, Is.EqualTo(controller.EffectiveSasEnabled));
        Assert.That(diagnostics.controlModeLabel, Is.EqualTo(controller.ControlModeLabel));
        Assert.That(diagnostics.autopilotEngaged, Is.EqualTo(autopilot.AutopilotEngaged));
        Assert.That(diagnostics.autopilotState, Is.EqualTo(autopilot.CurrentState));
        Assert.That(diagnostics.momentumAssistActive, Is.EqualTo(momentum.IsActive));
        Assert.That(diagnostics.momentumAssistState, Is.EqualTo(momentum.CurrentState));
    }

    [TestCase(FlightControlMode.Precision)]
    [TestCase(FlightControlMode.Translation)]
    public void AutopilotEngageNormalizesModeAndRequestsActuators(FlightControlMode startingMode)
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildBuiltInVariant(0);
        GameObject ship = GameObject.Find("PrototypeShip");
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();

        controller.SetControlMode(startingMode);
        controller.SetMainThrottle(0.7f);
        autopilot.ToggleAutopilot();
        InvokeFixedUpdate(autopilot);

        Assert.True(autopilot.AutopilotEngaged);
        Assert.That(controller.ControlMode, Is.EqualTo(FlightControlMode.Normal));
        Assert.True(controller.RcsEnabled);
        Assert.True(controller.SasEnabled);
        Assert.True(controller.HasExternalFlightAssistRequest);
        Assert.That(controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        Assert.True(controller.LastExternalFlightAssistRequest.HasAnyRequest);
        Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void FinalApproachLateralSpeedCreatesExternalForceRequest()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildBuiltInVariant(0);
        GameObject ship = GameObject.Find("PrototypeShip");
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();

        Assert.NotNull(autopilot.CurrentTarget);
        Vector3 targetPosition = autopilot.CurrentTarget.Position;
        ship.transform.SetPositionAndRotation(targetPosition - Vector3.forward * 30f, Quaternion.identity);
        body.position = ship.transform.position;
        Physics.SyncTransforms();
        body.linearVelocity = Vector3.right * 4f;
        autopilot.ToggleAutopilot();
        InvokeFixedUpdate(autopilot);

        Assert.True(autopilot.AutopilotEngaged);
        Assert.That(autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FinalApproach));
        Assert.True(controller.HasExternalFlightAssistRequest);
        Assert.That(controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        Assert.That(controller.LastExternalFlightAssistRequest.forceWorld.magnitude, Is.GreaterThan(0.01f));
        Assert.That(controller.LastExternalFlightAssistRequest.forceWorld.x, Is.LessThan(0f));
    }

    [Test]
    public void MomentumAssistUsesMainBrakeOnlyInNormalMode()
    {
        PrototypeBootstrap bootstrap = CreateBootstrap();
        bootstrap.BuildBuiltInVariant(0);
        GameObject ship = GameObject.Find("PrototypeShip");
        Rigidbody body = ship.GetComponent<Rigidbody>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();

        body.linearVelocity = -ship.transform.forward * 8f;
        controller.SetControlMode(FlightControlMode.Normal);
        momentum.ActivateFromUi();
        InvokeFixedUpdate(momentum);

        Assert.That(momentum.CurrentState, Is.EqualTo(PrototypeMomentumAssistState.MainBrake));
        Assert.That(momentum.LastMainThrottleRequest, Is.GreaterThan(0f));

        momentum.Abort("test reset");
        body.linearVelocity = -ship.transform.forward * 8f;
        controller.SetControlMode(FlightControlMode.Translation);
        momentum.ActivateFromUi();
        InvokeFixedUpdate(momentum);

        Assert.That(momentum.LastMainThrottleRequest, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(momentum.CurrentState, Is.EqualTo(PrototypeMomentumAssistState.RcsDamp));
        Assert.True(controller.HasExternalFlightAssistRequest || momentum.CurrentState == PrototypeMomentumAssistState.NoAuthority || momentum.CurrentState == PrototypeMomentumAssistState.FuelInsufficient);
    }

    [Test]
    public void MainThrusterDefaultsUseCalmerGimbalTuning()
    {
        PrototypeMainThrusterSettings defaults = PrototypeMainThrusterSettings.Default;
        Assert.That(defaults.gimbalLimitDegrees, Is.EqualTo(10f).Within(0.0001f));
        Assert.That(defaults.gimbalResponseScalar, Is.EqualTo(0.14f).Within(0.0001f));
        Assert.That(defaults.gimbalSlewRateDegreesPerSecond, Is.EqualTo(30f).Within(0.0001f));

        GameObject ship = new GameObject("TestMainThruster");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        ShipPhysicsCore core = ship.AddComponent<ShipPhysicsCore>();
        MainThrusterModule module = ship.AddComponent<MainThrusterModule>();
        MainThrusterBank bank = ship.AddComponent<MainThrusterBank>();
        core.Configure(body);
        module.ApplySettings(defaults);
        bank.Configure(new[] { module }, body, stats, core);

        Assert.That(bank.GimbalLimitDegrees, Is.EqualTo(10f).Within(0.0001f));
        Assert.That(bank.GimbalResponseScalar, Is.EqualTo(0.14f).Within(0.0001f));
        Assert.That(bank.GimbalSlewRateDegreesPerSecond, Is.EqualTo(30f).Within(0.0001f));
    }

    private static PrototypeBootstrap CreateBootstrap()
    {
        var bootstrapObject = new GameObject("StartupStateBootstrap");
        return bootstrapObject.AddComponent<PrototypeBootstrap>();
    }

    private static void InvokeFixedUpdate(object target)
    {
        MethodInfo fixedUpdate = target.GetType().GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(target, null);
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
