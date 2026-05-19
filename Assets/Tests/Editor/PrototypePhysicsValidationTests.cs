#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypePhysicsValidationTests
{
    [Test]
    public void DeterministicGeneratedShipSetupCreatesExpectedPhysicsRig()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            Assert.NotNull(fixture.Ship);
            Assert.NotNull(fixture.Rigidbody);
            Assert.NotNull(fixture.PhysicsCore);
            Assert.NotNull(fixture.MainThruster);
            Assert.NotNull(fixture.Rcs);
            Assert.AreSame(fixture.Rigidbody, fixture.PhysicsCore.ShipRigidbody);
            Assert.AreEqual(20, fixture.Rcs.InstalledNozzleCount);
        }
    }

    [Test]
    public void MainThrottleAppliesForwardForceWithoutUnintendedTorque()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.MainThrustResult result = PhysicsValidationProbe.RunMainThrust(fixture, 0.5f, 0.02f);

            Assert.That(result.appliedThrust, Is.EqualTo(22500f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.z, Is.EqualTo(22500f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.x, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.y, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
            Assert.AreEqual(1, result.applications);
        }
    }

    [Test]
    public void GimbalSteeringTorqueMatchesCrossProductEstimate()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.GimbalResult result = PhysicsValidationProbe.RunGimbal(fixture, 1f, 0f, 0.02f);

            Assert.That(result.steeringForce.magnitude, Is.GreaterThan(100f));
            Assert.That(Vector3.Distance(result.estimatedTorque, result.expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(result.netTorque, result.expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(result.netTorque.magnitude, Is.GreaterThan(1000f));
        }
    }

    [Test]
    public void RcsAllocatorProducesTranslationAttitudeAndBoundedNozzleUsage()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.RcsResult translation = PhysicsValidationProbe.RunRcs(fixture, Vector3.right, Vector3.zero);
            Assert.That(translation.force.x, Is.GreaterThan(8000f));
            Assert.That(Mathf.Abs(translation.force.y), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Mathf.Abs(translation.force.z), Is.LessThan(PhysicsValidationProbe.RcsResidualForceTolerance));
            Assert.That(translation.torque.magnitude, Is.LessThan(100f));
            Assert.That(translation.maxNozzleThrottle, Is.LessThanOrEqualTo(1f + PhysicsValidationProbe.NozzleThrottleTolerance));
            Assert.That(translation.applications, Is.EqualTo(translation.activeNozzles));
            Assert.That(translation.activeNozzles, Is.GreaterThan(0));

            PhysicsValidationProbe.RcsResult yaw = PhysicsValidationProbe.RunRcs(fixture, Vector3.zero, Vector3.up);
            Assert.That(yaw.force.magnitude, Is.LessThan(PhysicsValidationProbe.RcsResidualForceTolerance));
            Assert.That(yaw.torque.y, Is.GreaterThan(1000f));
            Assert.That(yaw.maxNozzleThrottle, Is.LessThanOrEqualTo(1f + PhysicsValidationProbe.NozzleThrottleTolerance));
            Assert.That(yaw.applications, Is.EqualTo(yaw.activeNozzles));
            Assert.That(yaw.installedNozzles, Is.EqualTo(20));
        }
    }

    [Test]
    public void FuelPartialStepScalesThrustAndDoesNotGoNegative()
    {
        PhysicsValidationProbe.FuelPartialResult result = PhysicsValidationProbe.RunFuelPartialStep();

        Assert.That(result.appliedThrust, Is.EqualTo(result.expectedThrust).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(result.remainingFuel, Is.EqualTo(0f).Within(PhysicsValidationProbe.FuelTolerance));
    }

    [Test]
    public void MainFuelUseScalesWithThrottleAndZeroCostStillThrusts()
    {
        PhysicsValidationProbe.MainFuelScalingResult result = PhysicsValidationProbe.RunMainFuelScaling();

        Assert.That(result.fullThrottleFuel, Is.EqualTo(0.6f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.halfThrottleFuel, Is.EqualTo(0.3f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.zeroThrottleFuel, Is.EqualTo(0f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.zeroCostThrust, Is.EqualTo(45000f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(result.zeroCostFuel, Is.EqualTo(0f).Within(PhysicsValidationProbe.FuelTolerance));
    }

    [Test]
    public void ProjectileMomentumCheckIsDeferredUntilRecoilExists()
    {
        Assert.False(PhysicsValidationProbe.HasProjectileRecoilPath(), "GunModule currently spawns projectiles without a recoil impulse path; momentum checks should be added when recoil exists.");
    }

    [Test]
    public void MainThrustTimestepComparisonKeepsImpulseAndFuelStable()
    {
        PhysicsValidationProbe.TimestepResult result = PhysicsValidationProbe.CompareMainThrustTimesteps();

        Assert.That(result.impulseAt002, Is.EqualTo(result.impulseAt001).Within(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(result.fuelAt002, Is.EqualTo(result.fuelAt001).Within(PhysicsValidationProbe.FuelTolerance));
    }

    [Test]
    public void GeneratedModuleDescriptorsDriveRigidbodyMassProperties()
    {
        PhysicsValidationProbe.MassPropertiesResult result = PhysicsValidationProbe.InspectGeneratedMassProperties();

        Assert.That(result.moduleCount, Is.EqualTo(9));
        Assert.That(result.totalMass, Is.EqualTo(result.expectedMass).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(Vector3.Distance(result.centerOfMass, result.expectedCenterOfMass), Is.LessThan(PhysicsValidationProbe.CenterOfMassTolerance));
        Assert.That(result.inertiaTensor.x, Is.GreaterThan(0f));
        Assert.That(result.inertiaTensor.y, Is.GreaterThan(0f));
        Assert.That(result.inertiaTensor.z, Is.GreaterThan(0f));
    }

    [Test]
    public void SymmetricModuleLayoutKeepsCenterOfMassCentered()
    {
        PhysicsValidationProbe.MassPropertiesResult result = PhysicsValidationProbe.CalculateSymmetricCenterOfMass();

        Assert.That(result.totalMass, Is.EqualTo(result.expectedMass).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(Vector3.Distance(result.centerOfMass, result.expectedCenterOfMass), Is.LessThan(PhysicsValidationProbe.CenterOfMassTolerance));
    }

    [Test]
    public void MovingHeavyModuleShiftsCenterOfMassTowardIt()
    {
        PhysicsValidationProbe.MassPropertiesResult result = PhysicsValidationProbe.CalculateHeavyModuleShift();

        Assert.That(result.totalMass, Is.EqualTo(result.expectedMass).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(Vector3.Distance(result.centerOfMass, result.expectedCenterOfMass), Is.LessThan(PhysicsValidationProbe.CenterOfMassTolerance));
        Assert.That(result.centerOfMass.x, Is.GreaterThan(0f));
    }

    [Test]
    public void WiderModuleLayoutRaisesInertiaAndLowersAngularAcceleration()
    {
        PhysicsValidationProbe.InertiaComparisonResult result = PhysicsValidationProbe.CompareWideAndCompactInertia();

        Assert.That(result.wideInertiaZ, Is.GreaterThan(result.compactInertiaZ + PhysicsValidationProbe.InertiaTolerance));
        Assert.That(result.wideAngularAcceleration, Is.LessThan(result.compactAngularAcceleration));
    }

    [Test]
    public void ThermalModuleHeatsWhileMainThrusterIsActive()
    {
        PhysicsValidationProbe.ThermalStepResult result = PhysicsValidationProbe.RunThermalHeatRiseStep();

        Assert.That(result.finalTemperature, Is.GreaterThan(result.initialTemperature));
        Assert.That(result.finalTemperature, Is.EqualTo(21f).Within(0.001f));
        Assert.That(result.appliedThrust, Is.GreaterThan(0f));
        Assert.That(result.powerDrawKw, Is.EqualTo(24f).Within(0.001f));
        Assert.False(result.overheated);
    }

    [Test]
    public void ThermalModuleCoolsWhileMainThrusterIsIdle()
    {
        PhysicsValidationProbe.ThermalStepResult result = PhysicsValidationProbe.RunThermalCoolingStep();

        Assert.That(result.finalTemperature, Is.LessThan(result.initialTemperature));
        Assert.That(result.finalTemperature, Is.EqualTo(70f).Within(0.001f));
        Assert.That(result.appliedThrust, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(result.powerDrawKw, Is.EqualTo(0f).Within(0.001f));
    }

    [Test]
    public void ThermalOverheatHookDisablesMainThrusterAtThreshold()
    {
        PhysicsValidationProbe.ThermalStepResult result = PhysicsValidationProbe.RunThermalOverheatStep();

        Assert.That(result.finalTemperature, Is.GreaterThanOrEqualTo(25f));
        Assert.True(result.overheated);
        Assert.True(result.disabledByOverheat);
        Assert.That(result.appliedThrust, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(result.powerDrawKw, Is.EqualTo(0f).Within(0.001f));
    }
}
#endif
