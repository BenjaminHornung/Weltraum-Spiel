#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeControlModeValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("ControlModeShip");
        DestroyNamed("SasAuthorityShip");
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
        GameObject ship = CreateGeneratedShip();
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

    [Test]
    public void TranslationMode_WHeld_DoesNotAutoBrake()
    {
        PlayerShipController controller = CreateGeneratedController();
        Rigidbody rb = controller.GetComponent<Rigidbody>();

        controller.SetControlMode(FlightControlMode.Translation);
        rb.linearVelocity = Vector3.forward * 4f;
        controller.ApplyModeSpecificInputForTests(w: true, s: false, a: false, d: false, q: false, e: false, h: false, n: false, shift: false, ctrl: false);

        InvokeFixedUpdate(controller);

        Assert.That(controller.LastFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.None));
        Assert.That(controller.LastFlightAssistRequest.forceWorld.sqrMagnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(controller.LastFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
    }

    [Test]
    public void TranslationMode_WReleased_SasAutoStopRequestsOpposingForce()
    {
        PlayerShipController controller = CreateGeneratedController();
        Rigidbody rb = controller.GetComponent<Rigidbody>();

        controller.SetControlMode(FlightControlMode.Translation);
        rb.linearVelocity = Vector3.forward * 5f;
        controller.ApplyModeSpecificInputForTests(w: false, s: false, a: false, d: false, q: true, e: false, h: false, n: false, shift: false, ctrl: false);

        InvokeFixedUpdate(controller);

        Assert.That(controller.LastFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.Sas));
        Assert.That(controller.LastFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(controller.LastFlightAssistRequest.torqueLocal, Is.EqualTo(Vector3.zero).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(controller.LastFlightAssistRequest.forceWorld.magnitude, Is.GreaterThan(0f));
        Assert.That(Vector3.Dot(controller.LastFlightAssistRequest.forceWorld, rb.linearVelocity), Is.LessThan(0f));
    }

    [Test]
    public void TranslationMode_AutoStop_ReducesVelocityOverSteps()
    {
        PlayerShipController controller = CreateGeneratedController();
        Rigidbody rb = controller.GetComponent<Rigidbody>();

        controller.SetControlMode(FlightControlMode.Translation);
        rb.linearVelocity = Vector3.forward * 8f;
        controller.ApplyModeSpecificInputForTests(w: false, s: false, a: false, d: false, q: false, e: false, h: false, n: false, shift: false, ctrl: false);

        float initialSpeed = rb.linearVelocity.magnitude;
        for (int i = 0; i < 10; i++)
        {
            InvokeFixedUpdate(controller);

            FlightAssistRequest request = controller.LastFlightAssistRequest;
            Assert.That(request.source, Is.EqualTo(FlightAssistRequestSource.Sas));
            rb.linearVelocity += request.forceWorld / rb.mass * Time.fixedDeltaTime;
            Assert.That(rb.linearVelocity.magnitude, Is.GreaterThanOrEqualTo(0f));
        }

        Assert.That(rb.linearVelocity.magnitude, Is.LessThan(initialSpeed));
    }

    [Test]
    public void SasAuthorityProperty_UsesAuthorityNotDerivativeGain()
    {
        GameObject ship = new GameObject("SasAuthorityShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        RcsThrusterController rcs = ship.AddComponent<RcsThrusterController>();
        MethodInfo computeSasCommand = typeof(RcsThrusterController).GetMethod("ComputeSasCommand", PrivateInstance);
        MethodInfo resolveReferences = typeof(RcsThrusterController).GetMethod("ResolveReferences", PrivateInstance);
        Assert.NotNull(computeSasCommand);
        Assert.NotNull(resolveReferences);

        rcs.ApplySettings(new PrototypeRcsSettings
        {
            blockThrust = 6500f,
            translationForce = 9000f,
            attitudeForce = 6500f,
            sasAuthority = 0f,
            sasProportionalGain = 0.75f,
            sasDerivativeGain = 1.8f,
            minSelectionDot = 0.25f,
            nozzleSpoolUpRate = 0f,
            nozzleSpoolDownRate = 0f
        });
        resolveReferences.Invoke(rcs, null);
        rb.angularVelocity = new Vector3(0.15f, -0.27f, 0.33f);
        Vector3 commandWithZeroAuthority = (Vector3)computeSasCommand.Invoke(
            rcs,
            new object[] { SasControlMode.KillRotation, Quaternion.identity, false }
        );
        Assert.That(rcs.SasAuthority, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(commandWithZeroAuthority, Is.EqualTo(Vector3.zero).Within(PhysicsValidationProbe.ForceTolerance));

        rcs.ApplySettings(new PrototypeRcsSettings
        {
            blockThrust = 6500f,
            translationForce = 9000f,
            attitudeForce = 6500f,
            sasAuthority = 2.4f,
            sasProportionalGain = 0.75f,
            sasDerivativeGain = 1.8f,
            minSelectionDot = 0.25f,
            nozzleSpoolUpRate = 0f,
            nozzleSpoolDownRate = 0f
        });
        Vector3 commandWithAuthority = (Vector3)computeSasCommand.Invoke(
            rcs,
            new object[] { SasControlMode.KillRotation, Quaternion.identity, false }
        );

        Assert.That(rcs.SasAuthority, Is.EqualTo(2.4f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(rcs.SasDerivativeGain, Is.EqualTo(1.8f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(commandWithAuthority.magnitude, Is.GreaterThan(0f));
        Assert.That(commandWithAuthority, Is.Not.EqualTo(commandWithZeroAuthority));
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

    private static GameObject CreateGeneratedShip()
    {
        GameObject bootstrapObject = new GameObject("ControlModeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        bootstrap.BuildBuiltInVariant(0);
        return GameObject.Find("PrototypeShip");
    }

    private static PlayerShipController CreateGeneratedController()
    {
        GameObject ship = CreateGeneratedShip();
        Assert.NotNull(ship);
        return ship.GetComponent<PlayerShipController>();
    }

    private static void InvokeFixedUpdate(PrototypeMomentumAssist momentum)
    {
        MethodInfo fixedUpdate = typeof(PrototypeMomentumAssist).GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(momentum, null);
    }

    private static void InvokeFixedUpdate(PlayerShipController controller)
    {
        MethodInfo fixedUpdate = typeof(PlayerShipController).GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(controller, null);
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
