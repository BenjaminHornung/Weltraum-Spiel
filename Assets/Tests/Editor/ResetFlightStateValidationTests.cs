#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class ResetFlightStateValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [Test]
    public void ResetFlightStateClearsMotionThrottleDebugPulsesAndFloatingOriginState()
    {
        GameObject managerObject = new GameObject("ResetFlightStateOrigin");
        GameObject cameraObject = new GameObject("ResetFlightStateCamera");
        GameObject ship = new GameObject("ResetFlightStateShip");

        try
        {
            FloatingOriginManager manager = managerObject.AddComponent<FloatingOriginManager>();
            manager.ShiftOriginBy(new Vector3(1000f, 2000f, -3000f));

            Camera camera = cameraObject.AddComponent<Camera>();
            camera.tag = "MainCamera";
            cameraObject.AddComponent<SimpleFollowCamera>();

            Rigidbody body = ship.AddComponent<Rigidbody>();
            ship.AddComponent<ShipStats>();
            ship.AddComponent<MainThrusterModule>();
            ship.AddComponent<RcsThrusterController>();
            ship.AddComponent<ShipPhysicsCore>();
            WeaponRecoilStabilizer weaponRecoilStabilizer = ship.AddComponent<WeaponRecoilStabilizer>();
            PlayerShipController controller = ship.AddComponent<PlayerShipController>();
            FloatingOriginBody floatingOriginBody = ship.AddComponent<FloatingOriginBody>();
            floatingOriginBody.Configure(manager, manager.Origin + new Vector3(25f, 30f, 35f));

            weaponRecoilStabilizer.Configure(body);
            weaponRecoilStabilizer.RecordRecoilImpulse(
                new Vector3(0f, 7f, -30f),
                body.worldCenterOfMass + Vector3.right * 0.3f);
            FlightAssistRequest pendingRecoil = weaponRecoilStabilizer.BuildFlightAssistRequest(
                ship.transform,
                effectiveSasEnabled: true,
                rcsEnabled: true,
                hasRcs: true,
                deltaTime: 0.02f);

            Vector3 resetPosition = new Vector3(3f, 4f, 5f);
            Quaternion resetRotation = Quaternion.Euler(0f, 90f, 0f);
            body.position = new Vector3(50f, 60f, 70f);
            body.rotation = Quaternion.Euler(10f, 20f, 30f);
            body.linearVelocity = new Vector3(100f, -20f, 30f);
            body.angularVelocity = new Vector3(2f, -3f, 4f);
            ship.transform.SetPositionAndRotation(body.position, body.rotation);
            controller.SetMainThrottle(0.75f);
            controller.PulseMainThrust(1f);
            controller.PulseRcsTranslation(Vector3.right);
            controller.PulseRcsAttitude(Vector3.up);
            Assert.That(pendingRecoil.source, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
            Assert.That(weaponRecoilStabilizer.RemainingCompensationSeconds, Is.GreaterThan(0f));
            Assert.That(weaponRecoilStabilizer.LastWeaponStabilizationRequestActive, Is.True);

            controller.ResetFlightState(resetPosition, resetRotation, true);
            Assert.That(weaponRecoilStabilizer.RemainingCompensationSeconds, Is.EqualTo(0f).Within(0.001f));
            Assert.False(weaponRecoilStabilizer.LastWeaponStabilizationRequestActive);
            Assert.That(weaponRecoilStabilizer.LastWeaponStabilizationStatus, Is.EqualTo("reset"));
            Assert.That(weaponRecoilStabilizer.LastWeaponStabilizationTorqueRequestWorld, Is.EqualTo(Vector3.zero));

            LargeWorldVector3d expectedAbsolutePosition = manager.Origin + resetPosition;

            Assert.That(Vector3.Distance(body.position, resetPosition), Is.LessThan(0.001f));
            Assert.That(Quaternion.Angle(body.rotation, resetRotation), Is.LessThan(0.001f));
            Assert.That(body.linearVelocity.magnitude, Is.EqualTo(0f).Within(0.001f));
            Assert.That(body.angularVelocity.magnitude, Is.EqualTo(0f).Within(0.001f));
            Assert.That(controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(controller.MainThrustCommand, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(controller.LastForwardAcceleration, Is.EqualTo(0f).Within(0.001f));
            Assert.That(GetPrivateFloat(controller, "pendingDebugMainThrottlePulse"), Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateVector3(controller, "pendingDebugRcsTranslationPulse").magnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateVector3(controller, "pendingDebugRcsAttitudePulse").magnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(Vector3.Distance(floatingOriginBody.LocalUnityPosition, resetPosition), Is.LessThan(0.001f));
            Assert.That((floatingOriginBody.AbsolutePosition - expectedAbsolutePosition).ToVector3().magnitude, Is.LessThan(0.001f));
            Assert.That(floatingOriginBody.AbsoluteVelocity.ToVector3().magnitude, Is.EqualTo(0f).Within(0.001f));
            Assert.NotNull(typeof(SimpleFollowCamera).GetMethod("SnapNextFrame", BindingFlags.Instance | BindingFlags.Public));
        }
        finally
        {
            DestroyGameObject(ship);
            DestroyGameObject(cameraObject);
            DestroyGameObject(managerObject);
        }
    }

    private static float GetPrivateFloat(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (float)field.GetValue(target);
    }

    private static Vector3 GetPrivateVector3(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (Vector3)field.GetValue(target);
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Object.Destroy(target);
        }
        else
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif
