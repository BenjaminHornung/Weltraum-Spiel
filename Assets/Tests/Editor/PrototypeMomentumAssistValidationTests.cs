#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class PrototypeMomentumAssistValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("MomentumAssistBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void MomentumAssistDoesNotResetPhysicsOrVelocity()
    {
        string momentumAssistPath = Path.Combine("Assets", "Scripts", "Prototype", "PrototypeMomentumAssist.cs");
        Assert.True(File.Exists(momentumAssistPath), $"Missing file: {momentumAssistPath}");

        string source = File.ReadAllText(momentumAssistPath);

        Assert.False(Regex.IsMatch(source, @"\.linearVelocity\s*="), "MomentumAssist must not assign linearVelocity directly.");
        Assert.False(Regex.IsMatch(source, @"\.angularVelocity\s*="), "MomentumAssist must not assign angularVelocity directly.");
        Assert.False(Regex.IsMatch(source, @"ResetVelocity"), "MomentumAssist must not call ResetVelocity.");
        Assert.False(Regex.IsMatch(source, @"ResetAngularVelocity"), "MomentumAssist must not call ResetAngularVelocity.");
        Assert.False(Regex.IsMatch(source, @"ResetPosition"), "MomentumAssist must not call ResetPosition.");
    }

    [Test]
    public void MomentumAssist_RcsDamp_DecreasesLinearVelocity()
    {
        GameObject ship = CreateGeneratedShip();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        Rigidbody shipRigidbody = ship.GetComponent<Rigidbody>();

        controller.SetControlMode(FlightControlMode.Translation);
        shipRigidbody.linearVelocity = transformRight(ship) * 3.9f;
        momentum.Activate();

        float initialSpeed = shipRigidbody.linearVelocity.magnitude;
        bool sawNonZeroRequest = false;
        for (int step = 0; step < 12; step++)
        {
            InvokeMomentumFixedUpdate(momentum);
            InvokeFixedUpdate(controller);

            Vector3 request = controller.LastFlightAssistRequest.forceWorld;
            if (request.sqrMagnitude > PhysicsValidationProbe.ForceTolerance)
            {
                sawNonZeroRequest = true;
            }
            Assert.That(controller.LastFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.MomentumAssist));

            shipRigidbody.linearVelocity += request / shipRigidbody.mass * Time.fixedDeltaTime;
        }

        Assert.That(sawNonZeroRequest, Is.True);
        Assert.That(shipRigidbody.linearVelocity.magnitude, Is.LessThan(initialSpeed));
        Assert.That(momentum.CurrentState, Is.Not.EqualTo(PrototypeMomentumAssistState.Idle));
    }

    [Test]
    public void MomentumAssist_RcsRequest_OpposesVelocity()
    {
        GameObject ship = CreateGeneratedShip();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        Rigidbody shipRigidbody = ship.GetComponent<Rigidbody>();

        Vector3 initialVelocity = transformForward(ship) * 6.8f;
        controller.SetControlMode(FlightControlMode.Translation);
        shipRigidbody.linearVelocity = initialVelocity;
        momentum.Activate();

        InvokeMomentumFixedUpdate(momentum);
        InvokeFixedUpdate(controller);

        FlightAssistRequest request = controller.LastFlightAssistRequest;
        Assert.That(request.source, Is.EqualTo(FlightAssistRequestSource.MomentumAssist));
        Assert.That(request.forceWorld.magnitude, Is.GreaterThan(0f));
        Assert.That(Vector3.Dot(request.forceWorld, initialVelocity), Is.LessThan(0f));
    }

    [Test]
    public void MomentumAssist_MainBrake_RequestsMainThrottleInNormal()
    {
        GameObject ship = CreateGeneratedShip();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        PrototypeMomentumAssist momentum = ship.GetComponent<PrototypeMomentumAssist>();
        Rigidbody shipRigidbody = ship.GetComponent<Rigidbody>();

        controller.SetControlMode(FlightControlMode.Normal);
        shipRigidbody.linearVelocity = -transformForward(ship) * 10f;
        momentum.Activate();

        InvokeMomentumFixedUpdate(momentum);
        Assert.That(momentum.CurrentState, Is.EqualTo(PrototypeMomentumAssistState.MainBrake));
        Assert.That(momentum.LastMainThrottleRequest, Is.GreaterThan(0f));

        InvokeFixedUpdate(controller);

        Assert.That(controller.MainThrustCommand, Is.GreaterThan(0f));
        Assert.That(controller.HasExternalFlightAssistRequest, Is.True);
        Assert.That(controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.MomentumAssist));
        Assert.That(controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0f));
        Assert.That(controller.LastFlightAssistRequest.mainThrottle, Is.EqualTo(controller.LastExternalFlightAssistRequest.mainThrottle));
    }

    private static GameObject CreateGeneratedShip()
    {
        GameObject bootstrapObject = new GameObject("MomentumAssistBootstrap");
        bootstrapObject.AddComponent<PrototypeBootstrap>().BuildBuiltInVariant(0);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        return ship;
    }

    private static Vector3 transformForward(GameObject ship)
    {
        return ship.transform.forward;
    }

    private static Vector3 transformRight(GameObject ship)
    {
        return ship.transform.right;
    }

    private static void InvokeMomentumFixedUpdate(PrototypeMomentumAssist momentum)
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
