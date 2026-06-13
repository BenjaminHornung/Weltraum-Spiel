#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class FloatingOriginValidationTests
{
    [Test]
    public void AbsoluteStateStoresLargePositionSeparateFromLocalTransform()
    {
        var target = new GameObject("LargeWorldStateProbe");
        try
        {
            target.transform.position = new Vector3(12f, -3f, 4f);
            var body = target.AddComponent<FloatingOriginBody>();
            var origin = new LargeWorldVector3d(1000000000d, -500000000d, 250000000d);

            body.CaptureAbsoluteState(origin);
            LargeWorldTransformState state = body.CaptureState(origin);

            Assert.That(state.localUnityPosition, Is.EqualTo(target.transform.position));
            Assert.That(state.absolutePosition.x, Is.EqualTo(1000000012d).Within(0.001d));
            Assert.That(state.absolutePosition.y, Is.EqualTo(-500000003d).Within(0.001d));
            Assert.That(state.absolutePosition.z, Is.EqualTo(250000004d).Within(0.001d));
        }
        finally
        {
            Object.DestroyImmediate(target);
        }
    }

    [Test]
    public void OriginShiftPreservesRelativePositionsAndRigidbodyVelocity()
    {
        var managerObject = new GameObject("FloatingOriginManagerProbe");
        var focusObject = new GameObject("FloatingOriginFocusProbe");
        var neighborObject = new GameObject("FloatingOriginNeighborProbe");

        try
        {
            var manager = managerObject.AddComponent<FloatingOriginManager>();
            focusObject.transform.position = new Vector3(6000f, 5f, -2f);
            neighborObject.transform.position = new Vector3(6012f, 8f, 4f);

            var focusRigidbody = focusObject.AddComponent<Rigidbody>();
            focusRigidbody.useGravity = false;
            focusRigidbody.linearVelocity = new Vector3(12f, -4f, 2f);
            focusRigidbody.angularVelocity = new Vector3(0.5f, 0.25f, -0.75f);

            var focus = focusObject.AddComponent<FloatingOriginBody>();
            var neighbor = neighborObject.AddComponent<FloatingOriginBody>();
            manager.Configure(true, 1000f, focus);
            manager.Register(focus);
            manager.Register(neighbor);

            Vector3 relativeBefore = neighborObject.transform.position - focusObject.transform.position;
            Vector3 velocityBefore = focusRigidbody.linearVelocity;
            Vector3 angularVelocityBefore = focusRigidbody.angularVelocity;

            Assert.True(manager.TryShiftOriginIfNeeded());

            Vector3 relativeAfter = neighborObject.transform.position - focusObject.transform.position;
            Assert.That(Vector3.Distance(relativeAfter, relativeBefore), Is.LessThan(0.001f));
            Assert.That(focusObject.transform.position.magnitude, Is.LessThan(0.001f));
            Assert.That(Vector3.Distance(focusRigidbody.linearVelocity, velocityBefore), Is.LessThan(0.001f));
            Assert.That(Vector3.Distance(focusRigidbody.angularVelocity, angularVelocityBefore), Is.LessThan(0.001f));
            Assert.That(manager.ShiftCount, Is.EqualTo(1));
        }
        finally
        {
            Object.DestroyImmediate(managerObject);
            Object.DestroyImmediate(focusObject);
            Object.DestroyImmediate(neighborObject);
        }
    }

    [Test]
    public void OriginShiftedEventFiresAfterStateUpdatesForNonZeroShift()
    {
        var managerObject = new GameObject("FloatingOriginEventProbe");

        try
        {
            var manager = managerObject.AddComponent<FloatingOriginManager>();
            Vector3 eventShift = Vector3.zero;
            LargeWorldVector3d eventOrigin = LargeWorldVector3d.Zero;
            int eventShiftCount = 0;
            int eventCount = 0;
            manager.OriginShifted += shift =>
            {
                eventShift = shift.LocalShift;
                eventOrigin = shift.Origin;
                eventShiftCount = shift.ShiftCount;
                eventCount++;
                Assert.That(manager.ShiftCount, Is.EqualTo(shift.ShiftCount));
                Assert.That(manager.Origin.x, Is.EqualTo(shift.Origin.x).Within(0.001d));
            };

            manager.ShiftOriginBy(Vector3.zero);
            Assert.That(eventCount, Is.EqualTo(0));

            Vector3 localShift = new Vector3(12f, -3f, 4f);
            manager.ShiftOriginBy(localShift);

            Assert.That(eventCount, Is.EqualTo(1));
            Assert.That(Vector3.Distance(eventShift, localShift), Is.LessThan(0.001f));
            Assert.That(eventOrigin.x, Is.EqualTo(12d).Within(0.001d));
            Assert.That(eventOrigin.y, Is.EqualTo(-3d).Within(0.001d));
            Assert.That(eventOrigin.z, Is.EqualTo(4d).Within(0.001d));
            Assert.That(eventShiftCount, Is.EqualTo(1));
        }
        finally
        {
            Object.DestroyImmediate(managerObject);
        }
    }

    [Test]
    public void DisabledFloatingOriginLeavesPrototypeLocalPositionUntouched()
    {
        var managerObject = new GameObject("DisabledFloatingOriginManagerProbe");
        var focusObject = new GameObject("DisabledFloatingOriginFocusProbe");

        try
        {
            var manager = managerObject.AddComponent<FloatingOriginManager>();
            focusObject.transform.position = new Vector3(9000f, 0f, 0f);
            var focus = focusObject.AddComponent<FloatingOriginBody>();
            manager.Configure(false, 1000f, focus);
            manager.Register(focus);

            Vector3 positionBefore = focusObject.transform.position;

            Assert.False(manager.TryShiftOriginIfNeeded());
            Assert.That(Vector3.Distance(focusObject.transform.position, positionBefore), Is.LessThan(0.001f));
            Assert.That(manager.ShiftCount, Is.EqualTo(0));
            Assert.That(manager.Origin.x, Is.EqualTo(0d).Within(0.001d));
        }
        finally
        {
            Object.DestroyImmediate(managerObject);
            Object.DestroyImmediate(focusObject);
        }
    }
}
#endif
