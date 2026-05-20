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

            Assert.That(result.mode, Is.EqualTo(MainThrustMode.ComSafeSteeringOnly));
            Assert.That(result.appliedThrust, Is.EqualTo(22500f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.z, Is.EqualTo(22500f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.x, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netForce.y, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(result.netTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
            Assert.AreEqual(1, result.applications);
        }
    }

    [Test]
    public void FullyPhysicalMainThrottleAppliesFullForceAtNozzlePosition()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.MainThrustResult result = PhysicsValidationProbe.RunMainThrustWithMode(
                fixture,
                MainThrustMode.FullyPhysicalNozzleForce,
                0.5f,
                0f,
                0f,
                0.02f);
            Vector3 expectedTorque = Vector3.Cross(result.forcePositionWorld - fixture.Rigidbody.worldCenterOfMass, result.forceWorld);

            Assert.That(result.mode, Is.EqualTo(MainThrustMode.FullyPhysicalNozzleForce));
            Assert.That(result.appliedThrust, Is.EqualTo(22500f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(result.forcePositionWorld, fixture.MainThruster.LastForcePositionWorld), Is.LessThan(PhysicsValidationProbe.CenterOfMassTolerance));
            Assert.That(result.straightForce.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(result.steeringForce, result.forceWorld), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(result.netForce, result.forceWorld), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(result.estimatedTorque, expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(result.netTorque, expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.AreEqual(1, result.applications);
        }
    }

    [Test]
    public void GimbalSteeringTorqueMatchesCrossProductEstimate()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.GimbalResult result = PhysicsValidationProbe.RunGimbal(fixture, 1f, 0f, 0.02f);

            Assert.That(result.mode, Is.EqualTo(MainThrustMode.ComSafeSteeringOnly));
            Assert.That(result.steeringForce.magnitude, Is.GreaterThan(100f));
            Assert.That(Vector3.Distance(result.estimatedTorque, result.expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(result.netTorque, result.expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(result.netTorque.magnitude, Is.GreaterThan(1000f));
        }
    }

    [Test]
    public void FullyPhysicalGimbalTorqueDiagnosticsMatchFullForceCrossProduct()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.GimbalResult result = PhysicsValidationProbe.RunGimbalWithMode(
                fixture,
                MainThrustMode.FullyPhysicalNozzleForce,
                1f,
                0f,
                0.02f);
            Vector3 expectedTorque = Vector3.Cross(result.forcePositionWorld - fixture.Rigidbody.worldCenterOfMass, result.forceWorld);

            Assert.That(result.mode, Is.EqualTo(MainThrustMode.FullyPhysicalNozzleForce));
            Assert.That(result.forceWorld.magnitude, Is.GreaterThan(100f));
            Assert.That(Vector3.Distance(result.expectedTorque, expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(result.estimatedTorque, expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(result.netTorque, expectedTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
        }
    }

    [Test]
    public void RcsAllocatorProducesTranslationAttitudeAndBoundedNozzleUsage()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.RcsResult translation = PhysicsValidationProbe.RunRcs(fixture, Vector3.right, Vector3.zero);
            Assert.That(translation.force.x, Is.GreaterThan(8000f));
            Assert.That(Vector3.Distance(translation.force, translation.actualForce), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(translation.desiredForce, Vector3.right * 9000f), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Vector3.Distance(translation.residualForce, translation.desiredForce - translation.actualForce), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Mathf.Abs(translation.force.y), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
            Assert.That(Mathf.Abs(translation.force.z), Is.LessThan(PhysicsValidationProbe.RcsResidualForceTolerance));
            Assert.That(translation.torque.magnitude, Is.LessThan(100f));
            Assert.That(translation.maxNozzleThrottle, Is.LessThanOrEqualTo(1f + PhysicsValidationProbe.NozzleThrottleTolerance));
            Assert.That(translation.applications, Is.EqualTo(translation.activeNozzles));
            Assert.That(translation.activeNozzles, Is.GreaterThan(0));

            PhysicsValidationProbe.RcsResult yaw = PhysicsValidationProbe.RunRcs(fixture, Vector3.zero, Vector3.up);
            Assert.That(yaw.force.magnitude, Is.LessThan(PhysicsValidationProbe.RcsResidualForceTolerance));
            Assert.That(yaw.torque.y, Is.GreaterThan(1000f));
            Assert.That(Vector3.Distance(yaw.torque, yaw.actualTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(Vector3.Distance(yaw.residualTorque, yaw.desiredTorque - yaw.actualTorque), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(yaw.maxNozzleThrottle, Is.LessThanOrEqualTo(1f + PhysicsValidationProbe.NozzleThrottleTolerance));
            Assert.That(yaw.applications, Is.EqualTo(yaw.activeNozzles));
            Assert.That(yaw.installedNozzles, Is.EqualTo(20));
        }
    }

    [Test]
    public void RcsFuelUseFollowsFinalCombinedAllocatorOutput()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            PhysicsValidationProbe.RcsResult result = PhysicsValidationProbe.RunRcs(fixture, Vector3.right, Vector3.up);
            float expectedFuel = 0.6f * result.allocatedThrottleTotal * 0.02f;

            Assert.That(result.allocatedThrottleTotal, Is.GreaterThan(0f));
            Assert.That(result.fuelRequested, Is.EqualTo(expectedFuel).Within(PhysicsValidationProbe.FuelTolerance));
            Assert.That(result.fuelConsumed, Is.EqualTo(expectedFuel).Within(PhysicsValidationProbe.FuelTolerance));
            Assert.That(result.fuelFraction, Is.EqualTo(1f).Within(PhysicsValidationProbe.NozzleThrottleTolerance));
            Assert.That(result.maxNozzleThrottle, Is.LessThanOrEqualTo(1f + PhysicsValidationProbe.NozzleThrottleTolerance));
        }
    }

    [Test]
    public void RcsUnavailableCommandsKeepDesiredResidualDiagnostics()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            fixture.Rcs.SetRcsEnabled(false);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.right, Vector3.up, false, 0.02f);

            AssertUnavailableRcsDiagnostics(fixture.Rcs, "disabled");
            Assert.That(fixture.PhysicsCore.NetAppliedForce.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.PhysicsCore.NetAppliedTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
        }

        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            for (int i = fixture.Ship.transform.childCount - 1; i >= 0; i--)
            {
                Transform child = fixture.Ship.transform.GetChild(i);
                if (child.name.StartsWith("RCS_"))
                {
                    Object.DestroyImmediate(child.gameObject);
                }
            }

            fixture.Rcs.RefreshNozzles();
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.right, Vector3.up, false, 0.02f);

            Assert.That(fixture.Rcs.InstalledNozzleCount, Is.EqualTo(0));
            AssertUnavailableRcsDiagnostics(fixture.Rcs, "no nozzles");
            Assert.That(fixture.PhysicsCore.NetAppliedForce.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
            Assert.That(fixture.PhysicsCore.NetAppliedTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
        }

        GameObject noAuthorityShip = new GameObject("RcsNoAuthorityShip");
        try
        {
            Rigidbody body = noAuthorityShip.AddComponent<Rigidbody>();
            body.useGravity = false;
            RcsThrusterController rcs = noAuthorityShip.AddComponent<RcsThrusterController>();
            GameObject nozzle = new GameObject("RCS_Nozzle_NoAuthority_Right");
            nozzle.transform.SetParent(noAuthorityShip.transform, false);
            nozzle.transform.localPosition = Vector3.right;
            nozzle.transform.forward = Vector3.right;
            rcs.ConfigureThrusters(null, null, null, null, null, null, body, null);

            rcs.ApplyControls(Vector3.right, Vector3.up, false, 0.02f);

            Assert.That(rcs.InstalledNozzleCount, Is.EqualTo(1));
            AssertUnavailableRcsDiagnostics(rcs, "no authority");
        }
        finally
        {
            Object.DestroyImmediate(noAuthorityShip);
        }
    }

    private static void AssertUnavailableRcsDiagnostics(RcsThrusterController rcs, string expectedStatus)
    {
        Assert.That(rcs.LastAllocatorStatus, Is.EqualTo(expectedStatus));
        Assert.That(Vector3.Distance(rcs.LastDesiredRcsForceWorld, Vector3.right * 9000f), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
        Assert.That(rcs.LastDesiredRcsTorqueWorld.magnitude, Is.GreaterThan(0f));
        Assert.That(rcs.LastActualRcsForceWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(rcs.LastActualRcsTorqueWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
        Assert.That(Vector3.Distance(rcs.LastResidualRcsForceWorld, rcs.LastDesiredRcsForceWorld), Is.LessThan(PhysicsValidationProbe.ForceTolerance));
        Assert.That(Vector3.Distance(rcs.LastResidualRcsTorqueWorld, rcs.LastDesiredRcsTorqueWorld), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
        Assert.That(rcs.LastMaxNozzleThrottle, Is.EqualTo(0f).Within(PhysicsValidationProbe.NozzleThrottleTolerance));
        Assert.That(rcs.LastAllocatedNozzleThrottleTotal, Is.EqualTo(0f).Within(PhysicsValidationProbe.NozzleThrottleTolerance));
        Assert.That(rcs.LastSaturatedNozzleCount, Is.EqualTo(0));
        Assert.That(rcs.LastNozzleApplicationCount, Is.EqualTo(0));
        Assert.That(rcs.ActiveNozzleCount, Is.EqualTo(0));
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
    public void ProjectileMomentumUsesConfiguredMassForRecoilAndImpact()
    {
        PhysicsValidationProbe.ProjectileMassResult result = PhysicsValidationProbe.RunProjectileMassConsistency(2.5f, 100f);
        Vector3 expectedRecoil = -result.muzzleForward * result.configuredMass * result.projectileSpeed;

        Assert.True(result.fired);
        Assert.False(result.createdProjectileGameObject);
        Assert.That(result.rigidbodyMass, Is.EqualTo(0f).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.projectileMass, Is.EqualTo(result.configuredMass).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(Vector3.Distance(result.recoilImpulse, expectedRecoil), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(Vector3.Distance(result.netImpulse, expectedRecoil), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(result.netForce.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.ForceTolerance));
        Assert.That(result.impactImpulseMagnitude, Is.EqualTo(result.configuredMass * result.projectileSpeed).Within(PhysicsValidationProbe.TimestepImpulseTolerance));
    }

    [Test]
    public void ForceModeImpulseDoesNotInflateContinuousForceDiagnostics()
    {
        PhysicsValidationProbe.ImpulseDiagnosticsResult result = PhysicsValidationProbe.RunForceImpulseDiagnosticSeparation();

        Assert.That(result.force, Is.EqualTo(new Vector3(10f, 0f, 0f)));
        Assert.That(result.torque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
        Assert.That(result.impulse, Is.EqualTo(new Vector3(0f, 20f, 0f)));
        Assert.That(Vector3.Distance(result.angularImpulse, new Vector3(-20f, 0f, 0f)), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(result.forceCount, Is.EqualTo(1));
        Assert.That(result.impulseCount, Is.EqualTo(1));
    }

    [Test]
    public void RcsSpoolLimitsActualNozzleThrottle()
    {
        PhysicsValidationProbe.RcsResult result = PhysicsValidationProbe.RunRcsWithSpool(2f, Vector3.right, Vector3.zero, 0.02f);

        Assert.That(result.desiredForce.magnitude, Is.GreaterThan(0f));
        Assert.That(result.maxNozzleThrottle, Is.EqualTo(0.04f).Within(PhysicsValidationProbe.NozzleThrottleTolerance));
        Assert.That(result.actualForce.magnitude, Is.LessThan(result.desiredForce.magnitude));
        Assert.That(result.residualForce.magnitude, Is.GreaterThan(0f));
    }

    [Test]
    public void ManualAttitudeKeepsPriorityOverSasTorqueBudget()
    {
        PhysicsValidationProbe.ManualPriorityResult result = PhysicsValidationProbe.RunManualAttitudePriority();

        Assert.That(Mathf.Abs(result.sasTorqueLocal.x), Is.GreaterThan(0f));
        Assert.That(result.desiredTorqueLocal.y, Is.EqualTo(result.manualTorqueLocal.y).Within(PhysicsValidationProbe.TorqueTolerance));
        Assert.That(Mathf.Abs(result.desiredTorqueLocal.x), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
    }

    [Test]
    public void NullConfigRestoresReusablePrototypeDefaults()
    {
        PhysicsValidationProbe.ConfigDefaultsResult result = PhysicsValidationProbe.RunNullConfigDefaults();

        Assert.That(result.projectileMass, Is.EqualTo(PrototypeGunSettings.Default.projectileMass).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.projectileSpeed, Is.EqualTo(PrototypeGunSettings.Default.projectileSpeed).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.mainThrottleScale, Is.EqualTo(PrototypeMainThrusterSettings.Default.throttleScale).Within(PhysicsValidationProbe.NozzleThrottleTolerance));
        Assert.That(result.rcsTranslationForce, Is.EqualTo(PrototypeRcsSettings.Default.translationForce).Within(PhysicsValidationProbe.FuelTolerance));
        Assert.That(result.rcsBlockThrust, Is.EqualTo(PrototypeRcsSettings.Default.blockThrust).Within(PhysicsValidationProbe.FuelTolerance));
    }

    [Test]
    public void MainThrustTimestepComparisonKeepsImpulseAndFuelStable()
    {
        PhysicsValidationProbe.TimestepResult result = PhysicsValidationProbe.CompareMainThrustTimesteps();

        Assert.That(result.impulseAt002, Is.EqualTo(result.impulseAt001).Within(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(result.fuelAt002, Is.EqualTo(result.fuelAt001).Within(PhysicsValidationProbe.FuelTolerance));
    }

    [Test]
    public void DefaultPrototypeGravityStepAppliesNoAcceleration()
    {
        PhysicsValidationProbe.GravityResult result = PhysicsValidationProbe.RunDefaultGravityStep();

        Assert.False(result.applied);
        Assert.That(result.bodyName, Is.EqualTo("none"));
        Assert.That(result.distance, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.acceleration.magnitude, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.force.magnitude, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.applications, Is.EqualTo(0));
    }

    [Test]
    public void CentralGravityAccelerationPointsTowardBodyWithMuOverRadiusSquared()
    {
        PhysicsValidationProbe.GravityResult result = PhysicsValidationProbe.RunCentralGravityStep(
            Vector3.zero,
            new Vector3(10f, 0f, 0f),
            1000f,
            250f);

        Assert.True(result.applied);
        Assert.That(result.bodyName, Is.EqualTo("GravityBody"));
        Assert.That(result.distance, Is.EqualTo(10f).Within(0.001f));
        Assert.That(result.acceleration.x, Is.EqualTo(10f).Within(0.001f));
        Assert.That(result.acceleration.y, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.acceleration.z, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.force.x, Is.EqualTo(2500f).Within(0.001f));
        Assert.That(result.netTorque.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
        Assert.That(result.applications, Is.EqualTo(1));
    }

    [Test]
    public void CentralGravityAccelerationIsMassIndependent()
    {
        PhysicsValidationProbe.GravityResult lightShip = PhysicsValidationProbe.RunCentralGravityStep(
            Vector3.zero,
            new Vector3(0f, 20f, 0f),
            800f,
            100f);
        PhysicsValidationProbe.GravityResult heavyShip = PhysicsValidationProbe.RunCentralGravityStep(
            Vector3.zero,
            new Vector3(0f, 20f, 0f),
            800f,
            500f);

        Assert.That(Vector3.Distance(lightShip.acceleration, heavyShip.acceleration), Is.LessThan(0.001f));
        Assert.That(lightShip.acceleration.y, Is.EqualTo(2f).Within(0.001f));
        Assert.That(heavyShip.force.y, Is.EqualTo(lightShip.force.y * 5f).Within(0.001f));
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
    public void FuelConsumptionReducesRigidbodyMassThroughMassModel()
    {
        PhysicsValidationProbe.FuelMassConsumptionResult result = PhysicsValidationProbe.RunFuelMassConsumptionStep();

        Assert.That(result.fuelConsumed, Is.GreaterThan(0f));
        Assert.That(result.initialMass - result.finalMass, Is.EqualTo(result.expectedMassDrop).Within(PhysicsValidationProbe.FuelTolerance));
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
