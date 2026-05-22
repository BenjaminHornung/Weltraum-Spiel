#if UNITY_EDITOR
using System;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class WeaponRecoilStabilizationValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        if (PrototypeProjectileSimulation.Instance != null)
        {
            PrototypeProjectileSimulation.Instance.ClearRuntime();
        }

        DestroyNamed("CombatFlightOffComTarget");
        DestroyNamed("WeaponRecoilStabilizerTestShip");
        DestroyNamed("PhysicsValidationShip");
        DestroyObjects<Projectile>();
    }

    [Test]
    public void StabilizerEstimatesCounterTorqueFromOffCenterRecoilImpulse()
    {
        GameObject ship = new GameObject("WeaponRecoilStabilizerTestShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        body.centerOfMass = Vector3.zero;
        WeaponRecoilStabilizer stabilizer = ship.AddComponent<WeaponRecoilStabilizer>();
        stabilizer.Configure(body);

        Vector3 recoilImpulse = new Vector3(0f, 0f, -12f);
        Vector3 muzzlePosition = body.worldCenterOfMass + Vector3.up * 2f;
        Vector3 expectedAngularImpulse = Vector3.Cross(muzzlePosition - body.worldCenterOfMass, recoilImpulse);

        stabilizer.RecordRecoilImpulse(recoilImpulse, muzzlePosition);
        FlightAssistRequest request = stabilizer.BuildFlightAssistRequest(ship.transform, true, true, true, 0.02f);
        Vector3 requestWorld = ship.transform.TransformDirection(request.torqueLocal);

        Assert.That(Vector3.Distance(stabilizer.LastEstimatedRecoilAngularImpulseWorld, expectedAngularImpulse), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
        Assert.That(request.source, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
        Assert.That(request.HasPhysicalRequest, Is.True);
        Assert.That(Vector3.Dot(requestWorld, expectedAngularImpulse), Is.LessThan(0f));
    }

    [Test]
    public void WeaponStabilizationRequestRunsThroughRcsAllocator()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            WeaponRecoilStabilizer stabilizer = fixture.Ship.AddComponent<WeaponRecoilStabilizer>();
            stabilizer.Configure(fixture.Rigidbody);
            Vector3 recoilImpulse = new Vector3(-30f, 0f, -120f);
            Vector3 muzzlePosition = fixture.Rigidbody.worldCenterOfMass + new Vector3(0.4f, 0.8f, 2f);

            stabilizer.RecordRecoilImpulse(recoilImpulse, muzzlePosition);
            FlightAssistRequest request = stabilizer.BuildFlightAssistRequest(fixture.Ship.transform, true, true, true, 0.02f);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(
                Vector3.zero,
                Vector3.zero,
                true,
                SasControlMode.KillRotation,
                fixture.Ship.transform.rotation,
                true,
                request,
                0.02f);
            stabilizer.RecordRcsDiagnostics(fixture.Rcs.LastActualRcsTorqueWorld, fixture.Rcs.LastResidualRcsTorqueWorld, fixture.Rcs.LastAllocatorStatus);

            Assert.That(request.source, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
            Assert.That(fixture.Rcs.LastFlightAssistSource, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
            Assert.That(fixture.Rcs.LastDesiredRcsTorqueWorld.magnitude, Is.GreaterThan(0f));
            Assert.That(fixture.Rcs.LastActualRcsTorqueWorld.magnitude, Is.GreaterThan(0f));
            Assert.That(fixture.PhysicsCore.AppliedForceCount, Is.GreaterThan(0));
        }
    }

    [Test]
    public void InsufficientRcsAuthorityLeavesResidualTorqueVisible()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            fixture.Rcs.SetRcsEnabled(false);
            FlightAssistRequest request = new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.WeaponStabilization,
                Vector3.zero,
                new Vector3(0f, 5000f, 0f),
                false);

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(
                Vector3.zero,
                Vector3.zero,
                true,
                SasControlMode.KillRotation,
                fixture.Ship.transform.rotation,
                true,
                request,
                0.02f);

            Assert.That(fixture.Rcs.LastActualRcsTorqueWorld.magnitude, Is.EqualTo(0f).Within(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(fixture.Rcs.LastResidualRcsTorqueWorld.magnitude, Is.GreaterThan(0f));
            Assert.That(fixture.Rcs.LastAllocatorStatus, Is.EqualTo("disabled"));
        }
    }

    [Test]
    public void ManualAttitudeHasPriorityOverWeaponStabilizationTorque()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            FlightAssistRequest request = new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.WeaponStabilization,
                Vector3.zero,
                Vector3.up * 100000f,
                false);

            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(
                Vector3.zero,
                Vector3.up,
                true,
                SasControlMode.KillRotation,
                fixture.Ship.transform.rotation,
                true,
                request,
                0.02f);

            Assert.That(Vector3.Distance(fixture.Rcs.LastDesiredTorqueLocal, fixture.Rcs.LastManualDesiredTorqueLocal), Is.LessThan(PhysicsValidationProbe.TorqueTolerance));
            Assert.That(fixture.Rcs.LastManualDesiredTorqueLocal.magnitude, Is.GreaterThan(0f));
        }
    }

    [Test]
    public void WeaponRecoilStabilizerDoesNotAssignRigidbodyAngularVelocity()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "WeaponRecoilStabilizer.cs"));
        Assert.False(Regex.IsMatch(source, @"\.angularVelocity\s*="));
    }

    [Test]
    public void AutoFireTurretOffCenterRecoilRequestsRcsWeaponStabilization()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            WeaponRecoilStabilizer stabilizer = fixture.Ship.AddComponent<WeaponRecoilStabilizer>();
            stabilizer.Configure(fixture.Rigidbody);
            PrototypeTurretWeapon weapon = CreateOffCenterTurret(fixture);
            PrototypeWeaponComputer computer = fixture.Ship.AddComponent<PrototypeWeaponComputer>();
            computer.Bind(fixture.Ship.transform, fixture.Stats, weapon);
            computer.SetAutoFireEnabled(true);
            computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.Nearest);

            GameObject target = CreateMarkedTarget("CombatFlightOffComTarget", weapon.Muzzle.position + Vector3.forward * 80f + Vector3.right * 4f);
            computer.RefreshTargets();
            SelectTarget(computer, target.transform);

            fixture.PhysicsCore.BeginPhysicsStep();
            InvokeUpdate(computer);

            Assert.True(weapon.LastRecoilApplied);
            Assert.That(stabilizer.LastEstimatedRecoilAngularImpulseWorld.magnitude, Is.GreaterThan(0.01f));

            FlightAssistRequest request = FlightAssistRequest.None;
            for (int i = 0; i < 6; i++)
            {
                request = stabilizer.BuildFlightAssistRequest(
                    fixture.Ship.transform,
                    effectiveSasEnabled: true,
                    rcsEnabled: true,
                    hasRcs: true,
                    deltaTime: 0.02f);
                fixture.PhysicsCore.BeginPhysicsStep();
                fixture.Rcs.ApplyControls(
                    Vector3.zero,
                    Vector3.zero,
                    true,
                    SasControlMode.KillRotation,
                    fixture.Ship.transform.rotation,
                    true,
                    request,
                    0.02f);
                stabilizer.RecordRcsDiagnostics(fixture.Rcs.LastActualRcsTorqueWorld, fixture.Rcs.LastResidualRcsTorqueWorld, fixture.Rcs.LastAllocatorStatus);
            }

            Assert.That(request.source, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
            Assert.That(fixture.Rcs.LastFlightAssistSource, Is.EqualTo(FlightAssistRequestSource.WeaponStabilization));
            Assert.That(stabilizer.LastWeaponStabilizationTorqueRequestWorld.magnitude, Is.GreaterThan(0.01f));
            Assert.That(stabilizer.LastWeaponStabilizationActualRcsTorqueWorld.magnitude, Is.GreaterThan(0.01f));
            Assert.That(
                Vector3.Dot(stabilizer.LastWeaponStabilizationActualRcsTorqueWorld, stabilizer.LastEstimatedRecoilAngularImpulseWorld),
                Is.LessThan(-0.001f));
        }
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            UnityEngine.Object.DestroyImmediate(target);
        }
    }

    private static void DestroyObjects<T>() where T : UnityEngine.Object
    {
        T[] objects = UnityEngine.Object.FindObjectsByType<T>(FindObjectsInactive.Include);
        for (int i = 0; i < objects.Length; i++)
        {
            if (objects[i] != null)
            {
                UnityEngine.Object.DestroyImmediate(objects[i] is Component component ? component.gameObject : objects[i]);
            }
        }
    }

    private static PrototypeTurretWeapon CreateOffCenterTurret(PhysicsValidationProbe.GeneratedShipFixture fixture)
    {
        SetPrivateField(fixture.Stats, "projectileMode", WeaponProjectileMode.Hitscan);
        SetPrivateField(fixture.Stats, "projectileSpeed", 20f);
        SetPrivateField(fixture.Stats, "projectileMass", 0.5f);
        SetPrivateField(fixture.Stats, "projectileDiameter", 0.2f);
        SetPrivateField(fixture.Stats, "projectileRadius", 0.1f);
        SetPrivateField(fixture.Stats, "projectileFireRate", 20f);
        SetPrivateField(fixture.Stats, "projectileLifetime", 2f);
        SetPrivateField(fixture.Stats, "projectileRecoilEnabled", true);
        SetPrivateField(fixture.Stats, "projectileSpreadDegrees", 0f);
        SetPrivateField(fixture.Stats, "hitChance", 1f);
        SetPrivateField(fixture.Stats, "engagementRangeMeters", 250f);
        SetPrivateField(fixture.Stats, "yawLimitLeftDegrees", -35f);
        SetPrivateField(fixture.Stats, "yawLimitRightDegrees", 35f);
        SetPrivateField(fixture.Stats, "pitchMinDegrees", -15f);
        SetPrivateField(fixture.Stats, "pitchMaxDegrees", 35f);
        SetPrivateField(fixture.Stats, "turretSlewDegreesPerSecond", 90f);

        Transform baseMarker = CreateChild(fixture.Ship.transform, "WEAPON_TURRET_BASE_COMBAT");
        baseMarker.localPosition = new Vector3(0.7f, 0.45f, 1.2f);
        Transform yaw = CreateChild(baseMarker, "WEAPON_TURRET_YAW_COMBAT");
        Transform pitch = CreateChild(yaw, "WEAPON_TURRET_PITCH_COMBAT");
        Transform muzzle = CreateChild(pitch, "WEAPON_MUZZLE_COMBAT");
        muzzle.localPosition = Vector3.forward;
        muzzle.localRotation = Quaternion.identity;

        PrototypeTurretMount mount = baseMarker.gameObject.AddComponent<PrototypeTurretMount>();
        mount.Configure(baseMarker, yaw, pitch, muzzle, null);
        PrototypeTurretWeapon weapon = baseMarker.gameObject.AddComponent<PrototypeTurretWeapon>();
        weapon.Configure(fixture.Stats, fixture.Rigidbody, fixture.PhysicsCore, mount);
        weapon.SetRecoilMode(WeaponRecoilMode.PhysicalMuzzle);
        return weapon;
    }

    private static GameObject CreateMarkedTarget(string name, Vector3 position)
    {
        GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube);
        target.name = name;
        target.transform.position = position;
        target.AddComponent<PrototypeTargetDummy>();
        target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);
        return target;
    }

    private static void SelectTarget(PrototypeWeaponComputer computer, Transform targetTransform)
    {
        for (int i = 0; i < computer.AvailableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = computer.AvailableTargets[i];
            if (target != null && target.TargetTransform == targetTransform)
            {
                computer.ToggleTarget(target);
                return;
            }
        }

        Assert.Fail("Expected marked combat target to be available.");
    }

    private static Transform CreateChild(Transform parent, string name)
    {
        GameObject child = new GameObject(name);
        child.transform.SetParent(parent, false);
        return child.transform;
    }

    private static void InvokeUpdate(PrototypeWeaponComputer computer)
    {
        MethodInfo update = typeof(PrototypeWeaponComputer).GetMethod("Update", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(update);
        update.Invoke(computer, null);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
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
