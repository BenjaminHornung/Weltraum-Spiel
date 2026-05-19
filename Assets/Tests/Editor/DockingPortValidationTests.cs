#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class DockingPortValidationTests
{
    [Test]
    public void DockingEligibilityRejectsDistanceAngleAndHardVelocityCases()
    {
        using (DockingFixture fixture = DockingFixture.CreateAligned(4f))
        {
            DockingEligibility eligibility = fixture.Evaluate();
            Assert.False(eligibility.canSoftCapture);
            Assert.False(eligibility.canHardLock);
            Assert.False(eligibility.withinCaptureRadius);
            Assert.That(eligibility.diagnostic, Is.EqualTo("outside-capture-radius"));
        }

        using (DockingFixture fixture = DockingFixture.CreateMisaligned(2f))
        {
            DockingEligibility eligibility = fixture.Evaluate();
            Assert.False(eligibility.canSoftCapture);
            Assert.False(eligibility.canHardLock);
            Assert.False(eligibility.withinSoftCaptureAngle);
            Assert.That(eligibility.diagnostic, Is.EqualTo("angle-too-large"));
        }

        using (DockingFixture fixture = DockingFixture.CreateAligned(0.2f))
        {
            fixture.SourceBody.linearVelocity = Vector3.forward * 2f;
            DockingRelativeState state = fixture.Measure();
            DockingEligibility eligibility = fixture.SourcePort.EvaluateEligibility(fixture.TargetPort, state);
            Assert.That(state.closingSpeed, Is.GreaterThan(1.9f));
            Assert.True(eligibility.canSoftCapture);
            Assert.False(eligibility.canHardLock);
            Assert.False(eligibility.withinHardLockVelocity);
            Assert.That(eligibility.diagnostic, Is.EqualTo("soft-capture-eligible"));
        }
    }

    private sealed class DockingFixture : System.IDisposable
    {
        public readonly GameObject Source;
        public readonly GameObject Target;
        public readonly Rigidbody SourceBody;
        public readonly Rigidbody TargetBody;
        public readonly DockingPort SourcePort;
        public readonly DockingPort TargetPort;

        private DockingFixture(GameObject source, GameObject target)
        {
            Source = source;
            Target = target;
            SourceBody = source.GetComponent<Rigidbody>();
            TargetBody = target.GetComponent<Rigidbody>();
            SourcePort = source.GetComponent<DockingPort>();
            TargetPort = target.GetComponent<DockingPort>();
        }

        public static DockingFixture CreateAligned(float distance)
        {
            return Create(distance, Quaternion.identity, Quaternion.LookRotation(Vector3.back, Vector3.up));
        }

        public static DockingFixture CreateMisaligned(float distance)
        {
            return Create(distance, Quaternion.identity, Quaternion.identity);
        }

        public DockingRelativeState Measure()
        {
            DockingRelativeState state;
            Assert.True(SourcePort.TryCalculateRelativeState(TargetPort, SourceBody, TargetBody, out state));
            return state;
        }

        public DockingEligibility Evaluate()
        {
            return SourcePort.EvaluateEligibility(TargetPort, Measure());
        }

        public void Dispose()
        {
            DestroyGameObject(Source);
            DestroyGameObject(Target);
        }

        private static DockingFixture Create(float distance, Quaternion sourceRotation, Quaternion targetRotation)
        {
            GameObject source = CreateBody("DockingSource", Vector3.zero, sourceRotation);
            GameObject target = CreateBody("DockingTarget", Vector3.forward * distance, targetRotation);
            return new DockingFixture(source, target);
        }

        private static GameObject CreateBody(string name, Vector3 position, Quaternion rotation)
        {
            var body = new GameObject(name);
            body.transform.SetPositionAndRotation(position, rotation);
            Rigidbody rigidbody = body.AddComponent<Rigidbody>();
            rigidbody.useGravity = false;
            rigidbody.linearDamping = 0f;
            rigidbody.angularDamping = 0f;
            DockingPort port = body.AddComponent<DockingPort>();
            port.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
            return body;
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
