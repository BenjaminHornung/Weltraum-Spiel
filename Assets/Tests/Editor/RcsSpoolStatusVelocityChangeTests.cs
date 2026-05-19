#if UNITY_EDITOR
using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class RcsSpoolStatusVelocityChangeTests
{
    [Test]
    public void ForceModeVelocityChangeDiagnosticsUseMassScaledImpulse()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            fixture.Rigidbody.mass = 50f;
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.PhysicsCore.ApplyForceAtPosition(new Vector3(0f, 2f, 0f), fixture.Rigidbody.worldCenterOfMass + Vector3.forward, ForceMode.VelocityChange);

            Assert.That(fixture.PhysicsCore.NetAppliedForce.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.PhysicsCore.NetAppliedTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(fixture.PhysicsCore.NetAppliedImpulse, new Vector3(0f, fixture.Rigidbody.mass * 2f, 0f)), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
            Assert.That(Vector3.Distance(fixture.PhysicsCore.NetAppliedAngularImpulse, new Vector3(-fixture.Rigidbody.mass * 2f, 0f, 0f)), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
            Assert.That(fixture.PhysicsCore.AppliedForceCount, Is.EqualTo(0));
            Assert.That(fixture.PhysicsCore.AppliedImpulseCount, Is.EqualTo(1));
        }
    }

    [Test]
    public void RcsSpoolDownAppliesResidualForceUntilNozzlesSettle()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Rcs, "nozzleSpoolUpRate", 0f);
            SetPrivateFloat(fixture.Rcs, "nozzleSpoolDownRate", 2f);

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.right, Vector3.zero, false, 0.02f);
            float initialForceMagnitude = fixture.Rcs.LastActualRcsForceWorld.magnitude;
            float initialMaxThrottle = fixture.Rcs.LastMaxNozzleThrottle;

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.zero, Vector3.zero, false, 0.02f);

            Assert.That(initialForceMagnitude, Is.GreaterThan(0f));
            Assert.That(fixture.Rcs.LastDesiredRcsForceWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.Rcs.LastActualRcsForceWorld.magnitude, Is.GreaterThan(0f));
            Assert.That(fixture.Rcs.LastMaxNozzleThrottle, Is.LessThan(initialMaxThrottle));
            Assert.That(fixture.Rcs.LastAllocatorStatus, Is.EqualTo("spooling-down"));

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.zero, Vector3.zero, false, 10f);

            Assert.That(fixture.Rcs.LastActualRcsForceWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.Rcs.LastAllocatorStatus, Is.EqualTo("idle"));
        }
    }

    [Test]
    public void RcsIdleWithoutResidualThrottleAppliesNoForce()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.zero, Vector3.zero, false, 0.02f);

            Assert.That(fixture.Rcs.LastActualRcsForceWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.Rcs.LastActualRcsTorqueWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(fixture.Rcs.LastNozzleApplicationCount, Is.EqualTo(0));
            Assert.That(fixture.Rcs.LastAllocatorStatus, Is.EqualTo("idle"));
        }
    }

    [Test]
    public void RcsAllocatorStatusReportsLimitedResiduals()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Rcs, "translationForce", 9000f);
            RcsThrusterBlock[] blocks = fixture.Ship.GetComponentsInChildren<RcsThrusterBlock>();
            for (int i = 0; i < blocks.Length; i++)
            {
                blocks[i].ConfigureThrust(100f);
            }

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.right, Vector3.zero, false, 0.02f);

            Assert.That(fixture.Rcs.LastDesiredRcsForceWorld.magnitude, Is.GreaterThan(8000f));
            Assert.That(fixture.Rcs.LastActualRcsForceWorld.magnitude, Is.LessThan(1000f));
            Assert.That(fixture.Rcs.LastResidualRcsForceWorld.magnitude, Is.GreaterThan(fixture.Rcs.LastDesiredRcsForceWorld.magnitude * 0.5f));
            Assert.That(fixture.Rcs.LastAllocatorStatus, Is.EqualTo("limited-residual"));
        }
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        if (field == null)
        {
            throw new MissingFieldException(target.GetType().Name, fieldName);
        }

        field.SetValue(target, value);
    }
}
#endif
