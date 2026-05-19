#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeAtmosphereValidationTests
{
    [Test]
    public void NoAtmosphereConfiguredAppliesZeroAtmosphereForce()
    {
        using (AtmosphereFixture fixture = AtmosphereFixture.Create(Vector3.right * 25f, null))
        {
            fixture.Core.BeginPhysicsStep();
            bool applied = fixture.Core.ApplyEnvironmentForces();

            Assert.False(applied);
            Assert.False(fixture.Core.LastAtmosphereActive);
            Assert.That(fixture.Core.LastAtmosphereDensity, Is.EqualTo(0f));
            Assert.That(fixture.Core.LastAtmosphereDragForce.magnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(fixture.Core.NetAppliedForce.magnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(fixture.Core.AppliedForceCount, Is.EqualTo(0));
        }
    }

    [Test]
    public void AtmosphereDragOpposesVelocity()
    {
        Vector3 velocity = new Vector3(12f, -3f, 0f);
        using (AtmosphereFixture fixture = AtmosphereFixture.Create(velocity, AtmosphereSettings.Default))
        {
            fixture.Core.BeginPhysicsStep();
            bool applied = fixture.Core.ApplyEnvironmentForces();
            Vector3 drag = fixture.Core.LastAtmosphereDragForce;

            Assert.True(applied);
            Assert.True(fixture.Core.LastAtmosphereActive);
            Assert.That(drag.magnitude, Is.GreaterThan(0f));
            Assert.That(Vector3.Dot(drag, velocity), Is.LessThan(0f));
            Assert.That(Vector3.Angle(drag, -velocity), Is.LessThan(0.01f));
            Assert.That(Vector3.Distance(fixture.Core.NetAppliedForce, drag), Is.LessThan(0.001f));
        }
    }

    [Test]
    public void AtmosphereDragScalesWithSquaredSpeed()
    {
        AtmosphereSettings settings = AtmosphereSettings.Default;
        float slowDrag = RunDragMagnitude(Vector3.forward * 10f, settings);
        float fastDrag = RunDragMagnitude(Vector3.forward * 20f, settings);

        Assert.That(slowDrag, Is.GreaterThan(0f));
        Assert.That(fastDrag / slowDrag, Is.EqualTo(4f).Within(0.001f));
    }

    private static float RunDragMagnitude(Vector3 velocity, AtmosphereSettings settings)
    {
        using (AtmosphereFixture fixture = AtmosphereFixture.Create(velocity, settings))
        {
            fixture.Core.BeginPhysicsStep();
            fixture.Core.ApplyEnvironmentForces();
            return fixture.Core.LastAtmosphereDragForce.magnitude;
        }
    }

    private struct AtmosphereSettings
    {
        public float density;
        public float dragCoefficient;
        public float referenceArea;
        public float radius;

        public static AtmosphereSettings Default => new AtmosphereSettings
        {
            density = 1.2f,
            dragCoefficient = 0.8f,
            referenceArea = 6f,
            radius = 100f
        };
    }

    private sealed class AtmosphereFixture : System.IDisposable
    {
        public readonly GameObject Ship;
        public readonly Rigidbody Rigidbody;
        public readonly ShipPhysicsCore Core;
        private readonly GameObject atmosphereObject;

        private AtmosphereFixture(Vector3 velocity, AtmosphereSettings? settings)
        {
            Ship = new GameObject("AtmosphereValidationShip");
            Ship.transform.position = Vector3.zero;
            Rigidbody = Ship.AddComponent<Rigidbody>();
            Rigidbody.useGravity = false;
            Rigidbody.mass = 1000f;
            Rigidbody.linearDamping = 0f;
            Rigidbody.angularDamping = 0f;
            Rigidbody.linearVelocity = velocity;
            Core = Ship.AddComponent<ShipPhysicsCore>();
            Core.Configure(Rigidbody);

            if (settings.HasValue)
            {
                atmosphereObject = new GameObject("TestAtmosphereVolume");
                atmosphereObject.transform.position = Vector3.zero;
                PrototypeAtmosphereVolume atmosphere = atmosphereObject.AddComponent<PrototypeAtmosphereVolume>();
                AtmosphereSettings value = settings.Value;
                atmosphere.Configure(true, value.density, value.dragCoefficient, value.referenceArea, value.radius);
                Core.ConfigureAtmosphere(atmosphere);
            }
        }

        public static AtmosphereFixture Create(Vector3 velocity, AtmosphereSettings? settings)
        {
            return new AtmosphereFixture(velocity, settings);
        }

        public void Dispose()
        {
            DestroyGameObject(atmosphereObject);
            DestroyGameObject(Ship);
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
}
#endif
