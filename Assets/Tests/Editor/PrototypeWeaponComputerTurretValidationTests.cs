#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class PrototypeWeaponComputerTurretValidationTests
{
    private const float AngleTolerance = 0.25f;
    private const float DistanceTolerance = 0.001f;

    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        if (PrototypeProjectileSimulation.Instance != null)
        {
            PrototypeProjectileSimulation.Instance.ClearRuntime();
        }

        DestroyObjects<PrototypeProjectileSimulation>();
        DestroyObjects<Projectile>();
        DestroyNamed("WeaponComputerTestShip");
        DestroyNamed("WeaponComputerTargetNear");
        DestroyNamed("WeaponComputerTargetFar");
        DestroyNamed("WeaponComputerTargetHighHealth");
        DestroyNamed("WeaponComputerTargetLowHealth");
        DestroyNamed("WeaponComputerDummyTarget");
        DestroyNamed("WeaponBinderTestShip");
        DestroyNamed("WeaponBinderWrapper");
        DestroyNamed("PrototypeBootstrapTestHost");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeProjectile");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void TurretSettingsClampNormalizesWeaponBalanceValues()
    {
        PrototypeGunSettings settings = PrototypeGunSettings.Default;
        settings.projectileFireRate = -10f;
        settings.projectileDiameter = -1f;
        settings.projectileScale = 0.004f;
        settings.projectileMass = 0f;
        settings.hitChance = 1.4f;
        settings.engagementRangeMeters = 0f;
        settings.yawLimitLeftDegrees = 80f;
        settings.yawLimitRightDegrees = -220f;
        settings.pitchMinDegrees = 75f;
        settings.pitchMaxDegrees = -25f;
        settings.turretSlewDegreesPerSecond = 0f;

        settings.Clamp();

        Assert.That(settings.hitChance, Is.EqualTo(1f).Within(DistanceTolerance));
        Assert.That(settings.projectileFireRate, Is.EqualTo(PrototypeGunSettings.MinimumProjectileFireRate).Within(DistanceTolerance));
        Assert.That(settings.projectileDiameter, Is.EqualTo(PrototypeGunSettings.MinimumProjectileDiameter).Within(DistanceTolerance));
        Assert.That(settings.projectileMass, Is.EqualTo(PrototypeGunSettings.MinimumProjectileMass).Within(DistanceTolerance));
        Assert.That(settings.engagementRangeMeters, Is.EqualTo(PrototypeGunSettings.MinimumEngagementRangeMeters).Within(DistanceTolerance));
        Assert.That(settings.turretSlewDegreesPerSecond, Is.EqualTo(PrototypeGunSettings.MinimumTurretSlewDegreesPerSecond).Within(DistanceTolerance));
        Assert.That(settings.yawLimitLeftDegrees, Is.LessThanOrEqualTo(settings.yawLimitRightDegrees));
        Assert.That(settings.pitchMinDegrees, Is.LessThanOrEqualTo(settings.pitchMaxDegrees));
        Assert.That(settings.yawLimitLeftDegrees, Is.InRange(-180f, 180f));
        Assert.That(settings.yawLimitRightDegrees, Is.InRange(-180f, 180f));
    }

    [Test]
    public void TurretArcAcceptsInsideTargetAndBlocksOutsideTargetWithClampedAngles()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, yawLeft: -35f, yawRight: 35f, pitchMin: -10f, pitchMax: 35f);

            PrototypeTurretFireStatus inside = fixture.Weapon.EvaluateFireStatus(fixture.Muzzle.position + Vector3.forward * 20f);
            Assert.True(inside.canFire);
            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.EqualTo(0f).Within(AngleTolerance));
            Assert.That(fixture.Weapon.LastAppliedPitchDegrees, Is.EqualTo(0f).Within(AngleTolerance));

            Vector3 outsideTarget = fixture.Muzzle.position + Quaternion.Euler(0f, 65f, 0f) * Vector3.forward * 20f;
            bool fired = fixture.Weapon.TryFireAt(outsideTarget);

            Assert.False(fired);
            Assert.That(fixture.Weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.OutOfArc));
            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.GreaterThan(0f));
            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.LessThan(35f));
            Assert.That(fixture.Weapon.LastAppliedPitchDegrees, Is.EqualTo(0f).Within(AngleTolerance));
        }
    }

    [Test]
    public void TurretAimSlewsTowardTargetBeforeFiring()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, yawLeft: -35f, yawRight: 35f, pitchMin: -10f, pitchMax: 35f);
            Vector3 target = fixture.Muzzle.position + Quaternion.Euler(0f, 24f, 0f) * Vector3.forward * 30f;

            PrototypeTurretFireStatus first = fixture.Weapon.EvaluateFireStatus(target);
            Assert.That(first.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.Aligning));
            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.EqualTo(0f).Within(AngleTolerance));

            fixture.Weapon.TickAimAtTarget(target, 0.1f);
            float yawAfterFirstTick = fixture.Weapon.LastAppliedYawDegrees;
            Assert.That(yawAfterFirstTick, Is.GreaterThan(0f));
            Assert.That(yawAfterFirstTick, Is.LessThan(24f));
            PrototypeTurretFireStatus afterFirstTick = fixture.Weapon.EvaluateFireStatus(target);
            Assert.False(afterFirstTick.canFire);
            Assert.That(fixture.Weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.Aligning));

            for (int i = 0; i < 20; i++)
            {
                fixture.Weapon.TickAimAtTarget(target, 0.1f);
            }

            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.EqualTo(24f).Within(1.6f));
            Assert.True(fixture.Weapon.TryFireAt(target));
        }
    }

    [Test]
    public void WeaponComputerPriorityModesChooseSelectedTargetsByDistanceAndHealth()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            GameObject near = CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 8f));
            GameObject far = CreateRigidbodyTarget("WeaponComputerTargetFar", new Vector3(0f, 0f, 24f));
            GameObject highHealth = CreateDamageTarget("WeaponComputerTargetHighHealth", new Vector3(0f, 0f, 16f), 200f, 1f);
            GameObject lowHealth = CreateDamageTarget("WeaponComputerTargetLowHealth", new Vector3(0f, 0f, 18f), 100f, 0.2f);

            fixture.Computer.RefreshTargets();
            SelectTarget(fixture.Computer, near.transform);
            SelectTarget(fixture.Computer, far.transform);
            SelectTarget(fixture.Computer, highHealth.transform);
            SelectTarget(fixture.Computer, lowHealth.transform);

            fixture.Computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.ManualOrder);
            Assert.AreSame(near.transform, fixture.Computer.ActiveTargetTransform);

            fixture.Computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.Nearest);
            Assert.AreSame(near.transform, fixture.Computer.ActiveTargetTransform);

            fixture.Computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.HighestHealth);
            Assert.AreSame(highHealth.transform, fixture.Computer.ActiveTargetTransform);

            fixture.Computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.LowestHealth);
            Assert.AreSame(lowHealth.transform, fixture.Computer.ActiveTargetTransform);
        }
    }

    [Test]
    public void WeaponTargetDummyFallbackHealthIsStableAndLabelled()
    {
        GameObject dummy = GameObject.CreatePrimitive(PrimitiveType.Cube);
        dummy.name = "WeaponComputerDummyTarget";
        dummy.AddComponent<PrototypeTargetDummy>();

        PrototypeWeaponTarget target = PrototypeWeaponTarget.FromTransform(dummy.transform);

        Assert.NotNull(target);
        Assert.False(target.HasHealthSource);
        Assert.That(target.CurrentHealth, Is.EqualTo(100f).Within(DistanceTolerance));
        Assert.That(target.MaxHealth, Is.EqualTo(100f).Within(DistanceTolerance));
        Assert.That(target.HealthLabel, Is.EqualTo("no health source"));
    }

    [Test]
    public void FireControlUsesDeterministicHitChanceAndCooldown()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, projectileSpeed: 120f, projectileMass: 2f, projectileDiameter: 0.3f, fireRate: 4f, hitChance: 1f);
            fixture.PhysicsCore.BeginPhysicsStep();

            bool firstShot = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 40f);
            bool secondShot = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 40f);

            Assert.True(firstShot);
            Assert.True(fixture.Weapon.LastShotWasIntendedHit);
            Assert.That(Vector3.Angle(fixture.Weapon.LastProjectileVelocityWorld, fixture.Muzzle.forward), Is.LessThan(AngleTolerance));
            Assert.False(secondShot);
            Assert.That(fixture.Weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.Cooldown));
            Assert.That(FindProjectiles().Length, Is.EqualTo(0));
            Assert.True(fixture.Weapon.LastFireResult.fired);
            Assert.That(fixture.Weapon.LastFireResult.mode, Is.EqualTo(WeaponProjectileMode.Hitscan));
            Assert.That(PrototypeProjectileSimulation.Instance.ActiveProjectileCount, Is.EqualTo(0));
        }

        DestroyObjects<Projectile>();

        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, projectileSpeed: 120f, projectileMass: 2f, projectileDiameter: 0.3f, fireRate: 4f, hitChance: 0f);
            fixture.Weapon.SetForcedRoll(0.75f);
            fixture.PhysicsCore.BeginPhysicsStep();

            bool fired = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 40f);

            Assert.True(fired);
            Assert.False(fixture.Weapon.LastShotWasIntendedHit);
            Assert.That(Vector3.Angle(fixture.Weapon.LastProjectileVelocityWorld, fixture.Muzzle.forward), Is.GreaterThan(0.1f));
            Vector3 expectedMissRecoil = -fixture.Weapon.LastProjectileVelocityWorld.normalized * (fixture.Stats.ProjectileMass * fixture.Stats.ProjectileSpeed);
            Assert.That(Vector3.Distance(fixture.Weapon.LastRecoilImpulseWorld, expectedMissRecoil), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
            Assert.That(FindProjectiles().Length, Is.EqualTo(0));
            Assert.True(fixture.Weapon.LastFireResult.fired);
        }
    }

    [Test]
    public void SimulatedProjectileUsesManagerPathWithoutProjectileGameObject()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(
                fixture.Stats,
                projectileSpeed: 60f,
                projectileMass: 1f,
                projectileDiameter: 0.2f,
                projectileMode: WeaponProjectileMode.SimulatedProjectile);

            bool fired = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 40f);

            Assert.True(fired);
            Assert.That(FindProjectiles().Length, Is.EqualTo(0));
            Assert.NotNull(PrototypeProjectileSimulation.Instance);
            Assert.That(PrototypeProjectileSimulation.Instance.ActiveProjectileCount, Is.EqualTo(1));
            Assert.That(PrototypeProjectileSimulation.Instance.LastFireResult.mode, Is.EqualTo(WeaponProjectileMode.SimulatedProjectile));

            PrototypeProjectileSimulation.Instance.Simulate(0.25f);

            Assert.That(PrototypeProjectileSimulation.Instance.ActiveProjectileCount, Is.EqualTo(1));
        }
    }

    [Test]
    public void SimulatedProjectileSnapshotPersistsAcrossSimulationFrames()
    {
        PrototypeProjectileSimulation simulation = PrototypeProjectileSimulation.GetOrCreateDefault();
        simulation.ClearRuntime();
        var request = PrototypeProjectileFireRequest.FromWeapon(
            WeaponProjectileMode.SimulatedProjectile,
            null,
            null,
            Vector3.forward,
            Vector3.zero,
            100f,
            0.1f,
            1f,
            2f,
            100f,
            0);
        request.origin = Vector3.zero;
        request.muzzleTransform = null;
        request.emitMuzzleVisual = false;
        request.hitMask = Physics.DefaultRaycastLayers;

        bool fired = simulation.Fire(request).fired;
        Assert.That(fired, Is.True);
        Assert.That(simulation.ActiveProjectileCount, Is.EqualTo(1));

        var snapshotA = new List<ProjectileData>();
        int firstSnapshotCount = simulation.CopyActiveProjectileSnapshot(snapshotA);
        Assert.That(firstSnapshotCount, Is.EqualTo(1));
        Assert.That(snapshotA.Count, Is.EqualTo(1));
        int trackedProjectileId = snapshotA[0].projectileId;
        Assert.That(snapshotA[0].age, Is.EqualTo(0f).Within(0.0001f));

        simulation.Simulate(0.2f);

        var snapshotB = new List<ProjectileData>();
        int secondSnapshotCount = simulation.CopyActiveProjectileSnapshot(snapshotB);
        Assert.That(simulation.ActiveProjectileCount, Is.EqualTo(1));
        Assert.That(secondSnapshotCount, Is.EqualTo(1));
        Assert.That(snapshotB[0].projectileId, Is.EqualTo(trackedProjectileId));
        Assert.That(snapshotB[0].age, Is.GreaterThan(0f));
    }

    [Test]
    public void RuntimeSnapshotDataModelsDoNotStoreUnityObjectReferences()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypeRuntimeDataSnapshots.cs"));

        Assert.False(Regex.IsMatch(source, @"\b(Transform|GameObject|Renderer|Rigidbody|Component|Collider|string)\s+\w+\s*;"));
        Assert.False(Regex.IsMatch(source, @"\b(GetComponent|GetComponentsInChildren|FindObjectsByType|Instantiate|Destroy)\b"));
        Assert.False(Regex.IsMatch(source, @"\bPhysics\."));
    }

    [Test]
    public void WeaponTargetDiscoveryIgnoresLiveProjectiles()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            GameObject target = CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 30f));
            SetWeaponStats(fixture.Stats, projectileSpeed: 80f, projectileMass: 1f, projectileDiameter: 0.2f, hitChance: 1f);

            Assert.True(fixture.Weapon.TryFireAt(target.transform.position));

            System.Collections.Generic.List<PrototypeWeaponTarget> targets = PrototypeWeaponTarget.Discover(fixture.Ship.transform);
            Assert.That(targets.Exists(candidate => candidate.TargetTransform == target.transform), Is.True);
            Assert.That(targets.Exists(candidate => candidate.TargetTransform != null && candidate.TargetTransform.GetComponent<Projectile>() != null), Is.False);
            Assert.That(targets.Exists(candidate => candidate.TargetTransform != null && candidate.TargetTransform.GetComponentInChildren<PrototypeProjectileRuntimeMarker>() != null), Is.False);
        }
    }

    [Test]
    public void WeaponTargetRegistrySnapshotRemainsStableWithoutChanges()
    {
        GameObject near = CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 12f));
        GameObject far = CreateRigidbodyTarget("WeaponComputerTargetFar", new Vector3(0f, 0f, 20f));
        PrototypeWeaponTargetRegistry.Register(near.transform);
        PrototypeWeaponTargetRegistry.Register(far.transform);

        var snapshotA = new List<TargetData>();
        int countA = PrototypeWeaponTargetRegistry.CopyRegisteredTargetData(snapshotA);
        Assert.That(countA, Is.EqualTo(2));

        var snapshotB = new List<TargetData>();
        int countB = PrototypeWeaponTargetRegistry.CopyRegisteredTargetData(snapshotB);
        Assert.That(countB, Is.EqualTo(countA));
        Assert.That(snapshotB.Count, Is.EqualTo(snapshotA.Count));

        for (int i = 0; i < snapshotA.Count; i++)
        {
            Assert.That(snapshotB.Exists(candidate => candidate.targetId == snapshotA[i].targetId), Is.True);
        }
    }

    [Test]
    public void WeaponTargetRegistryCopyMethodAvoidsComponentAndHierarchyScanWork()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypeWeaponTargetRegistry.cs"));
        string methodBody = ExtractMethodBody(source, "CopyRegisteredTargetData");

        Assert.That(
            Regex.IsMatch(methodBody, @"\b(GetComponent|GetComponentInParent|GetComponentsInChildren|FindObjects|FindObject|FindAnyObject|RefreshNozzles)\b"),
            Is.False,
            "CopyRegisteredTargetData should use cached references instead of hierarchy scans or component lookups.");
    }

    [Test]
    public void ProjectileVisualPoolReusesTracerObjectsAndSharedMaterials()
    {
        GameObject poolObject = new GameObject("ProjectileVisualPoolTest");
        PrototypeProjectileRuntimeMarker.Mark(poolObject);
        PrototypeProjectileVisualPool pool = poolObject.AddComponent<PrototypeProjectileVisualPool>();
        pool.EnsurePrewarmed();
        int createdBefore = pool.TracerCreatedCount;
        Material sharedMaterial = pool.SharedTracerMaterial;

        pool.EmitTracer(Vector3.zero, Vector3.forward * 10f, 0.1f);
        pool.Tick(Time.time + 1f);
        pool.EmitTracer(Vector3.zero, Vector3.forward * 20f, 0.1f);

        Assert.That(pool.TracerCreatedCount, Is.EqualTo(createdBefore));
        Assert.AreSame(sharedMaterial, pool.SharedTracerMaterial);
        Assert.That(pool.GetActiveCount(PrototypeProjectileVisualKind.Tracer), Is.EqualTo(1));

        UnityEngine.Object.DestroyImmediate(poolObject);
    }

    [Test]
    public void HighFireRateHitscanKeepsProjectileObjectsAndVisualsBounded()
    {
        PrototypeProjectileSimulation simulation = PrototypeProjectileSimulation.GetOrCreateDefault();
        simulation.ClearRuntime();
        int visualCountBefore = simulation.VisualPool.TotalCreatedCount;
        var request = PrototypeProjectileFireRequest.FromWeapon(
            WeaponProjectileMode.Hitscan,
            null,
            null,
            Vector3.forward,
            Vector3.zero,
            100f,
            0.1f,
            1f,
            2f,
            100f,
            10);
        request.origin = Vector3.zero;
        request.emitMuzzleVisual = false;

        for (int i = 0; i < 60; i++)
        {
            simulation.Fire(request);
        }

        Assert.That(FindProjectiles().Length, Is.EqualTo(0));
        Assert.That(simulation.ActiveProjectileCount, Is.EqualTo(0));
        Assert.That(simulation.VisualPool.TotalCreatedCount, Is.LessThanOrEqualTo(visualCountBefore + 1));
        Assert.That(simulation.TotalShotsProcessed, Is.GreaterThanOrEqualTo(60));
    }

    [Test]
    public void WeaponTargetDiscoveryRequiresExplicitMarkerForRigidbodyOnlyObjects()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            GameObject unmarked = CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 10f), addMarker: false);
            GameObject marked = CreateRigidbodyTarget("WeaponComputerTargetFar", new Vector3(0f, 0f, 20f), addMarker: true);

            fixture.Computer.RefreshTargets();

            Assert.Null(FindAvailableTarget(fixture.Computer, unmarked.transform));
            Assert.NotNull(FindAvailableTarget(fixture.Computer, marked.transform));
        }
    }

    [Test]
    public void WeaponTargetDiscoveryDoesNotUseGlobalRigidbodyFallback()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypeWeaponTarget.cs"));
        Assert.False(Regex.IsMatch(source, @"FindObjectsByType\s*<\s*Rigidbody\s*>"));
    }

    [Test]
    public void WeaponComputerRefreshUsesRegistryWithoutDebugFallbackByDefault()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            int fallbackCountBefore = PrototypeWeaponTarget.DebugFallbackDiscoveryCount;
            CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 10f), addMarker: true);

            fixture.Computer.RefreshTargets();

            Assert.That(PrototypeWeaponTarget.LastDiscoveryUsedDebugFallback, Is.False);
            Assert.That(PrototypeWeaponTarget.DebugFallbackDiscoveryCount, Is.EqualTo(fallbackCountBefore));
            Assert.That(PrototypeWeaponTarget.LastRegistryCandidateCount, Is.GreaterThanOrEqualTo(1));
        }
    }

    [Test]
    public void ProjectileDiameterControlsScaleAndSweepRadius()
    {
        GameObject projectileObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        projectileObject.name = "PrototypeProjectile";
        projectileObject.AddComponent<Rigidbody>();
        projectileObject.AddComponent<TrailRenderer>();
        Projectile projectile = projectileObject.AddComponent<Projectile>();

        projectile.Initialize(Vector3.forward * 10f, 1f, 3f, 0.6f, null);

        Assert.That(projectile.ProjectileDiameterMeters, Is.EqualTo(0.6f).Within(DistanceTolerance));
        Assert.That(projectile.ProjectileRadiusMeters, Is.EqualTo(0.3f).Within(DistanceTolerance));
        Assert.That(projectile.SweepRadiusMeters, Is.EqualTo(0.3f).Within(DistanceTolerance));
        Assert.That(projectile.transform.localScale.x, Is.EqualTo(0.6f).Within(DistanceTolerance));
        TrailRenderer trail = projectile.GetComponent<TrailRenderer>();
        Assert.NotNull(trail);
        Assert.That(trail.startWidth, Is.EqualTo(0.21f).Within(DistanceTolerance));
    }

    [Test]
    public void TurretSafeRecoilRegistersCenterOfMassImpulseThroughShipPhysicsCore()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, projectileSpeed: 80f, projectileMass: 1.5f, projectileDiameter: 0.25f, hitChance: 1f);
            fixture.PhysicsCore.BeginPhysicsStep();

            bool fired = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 20f);
            Vector3 expectedImpulse = -fixture.Muzzle.forward * (fixture.Stats.ProjectileMass * fixture.Stats.ProjectileSpeed);

            Assert.True(fired);
            Assert.True(fixture.Weapon.LastRecoilApplied);
            Assert.That(fixture.PhysicsCore.AppliedImpulseCount, Is.EqualTo(1));
            Assert.That(Vector3.Distance(fixture.Weapon.LastRecoilImpulseWorld, expectedImpulse), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
            Assert.That(Vector3.Distance(fixture.PhysicsCore.NetAppliedImpulse, expectedImpulse), Is.LessThan(PhysicsValidationProbe.TimestepImpulseTolerance));
            Assert.That(Vector3.Distance(fixture.Weapon.LastMuzzleWorldPosition, fixture.Muzzle.position), Is.LessThan(DistanceTolerance));
            Assert.That(Vector3.Distance(fixture.Weapon.LastRecoilPositionWorld, fixture.Body.worldCenterOfMass), Is.LessThan(DistanceTolerance));
            Assert.That(fixture.Weapon.LastRecoilAngularImpulseWorld.magnitude, Is.EqualTo(0f).Within(DistanceTolerance));
        }
    }

    [Test]
    public void TurretBlocksFireWhenOwnHullLineOfFireIsBlocked()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, projectileSpeed: 120f, projectileMass: 2f, projectileDiameter: 0.3f, fireRate: 4f, hitChance: 1f);
            GameObject blocker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            blocker.name = "WeaponComputerHullBlocker";
            blocker.transform.SetParent(fixture.Ship.transform, true);
            blocker.transform.position = fixture.Muzzle.position + fixture.Muzzle.forward * 0.45f;
            blocker.transform.localScale = Vector3.one * 0.35f;
            Physics.SyncTransforms();

            bool fired = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 40f);

            Assert.False(fired);
            Assert.That(fixture.Weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.LineBlocked));
            Assert.False(fixture.Weapon.LastFireResult.fired);
        }
    }

    [Test]
    public void TurretPhysicalMuzzleRecoilIsExplicitAndRecordsAngularImpulse()
    {
        using (TurretFixture fixture = new TurretFixture())
        {
            SetWeaponStats(fixture.Stats, projectileSpeed: 80f, projectileMass: 1.5f, projectileDiameter: 0.25f, hitChance: 1f);
            fixture.Muzzle.localPosition = new Vector3(0.25f, 0f, 1f);
            fixture.Weapon.SetRecoilMode(WeaponRecoilMode.PhysicalMuzzle);
            fixture.PhysicsCore.BeginPhysicsStep();

            bool fired = fixture.Weapon.TryFireAt(fixture.Muzzle.position + Vector3.forward * 20f);

            Assert.True(fired);
            Assert.True(fixture.Weapon.LastRecoilApplied);
            Assert.That(Vector3.Distance(fixture.Weapon.LastRecoilPositionWorld, fixture.Muzzle.position), Is.LessThan(DistanceTolerance));
            Assert.That(fixture.Weapon.LastRecoilAngularImpulseWorld.magnitude, Is.GreaterThan(0.01f));
            Assert.That(fixture.PhysicsCore.NetAppliedAngularImpulse.magnitude, Is.GreaterThan(0.01f));
        }
    }

    [Test]
    public void WeaponBinderFindsMarkersAndBindNowIsIdempotent()
    {
        GameObject ship = new GameObject("WeaponBinderTestShip");
        CreateWeaponMarkerHierarchy(ship.transform, "PRIMARY", includeFlash: true);

        PrototypeShipKitWeaponBinder.BindReport first = PrototypeShipKitWeaponBinder.BindHierarchy(ship.transform, true, true);
        PrototypeShipKitWeaponBinder.BindReport second = PrototypeShipKitWeaponBinder.BindHierarchy(ship.transform, true, true);

        Assert.That(first.foundMuzzles, Is.EqualTo(1));
        Assert.That(first.foundMuzzleFlashes, Is.EqualTo(1));
        Assert.That(first.boundTurretWeapons, Is.EqualTo(1));
        Assert.That(first.boundWeaponComputers, Is.EqualTo(1));
        Assert.That(first.visibleYawRenderers, Is.GreaterThanOrEqualTo(1));
        Assert.That(first.visiblePitchRenderers, Is.GreaterThanOrEqualTo(1));
        Assert.That(first.boundMuzzleName, Is.EqualTo("WEAPON_MUZZLE_PRIMARY"));
        Assert.That(second.createdMuzzleFlashVfxChildren, Is.EqualTo(0));
        Assert.That(ship.GetComponents<PrototypeShipKitWeaponBinder>().Length, Is.EqualTo(1));
        Assert.That(ship.GetComponents<PrototypeWeaponComputer>().Length, Is.EqualTo(1));
        Assert.That(ship.GetComponentsInChildren<PrototypeTurretWeapon>(true).Length, Is.EqualTo(1));
        Assert.That(CountDescendantNames(ship.transform, PrototypeShipKitWeaponBinder.MuzzleFlashVfxChildName), Is.EqualTo(1));
        Assert.That(PrototypeShipSocketUtility.FindSockets(ship.transform, PrototypeShipSocketType.WeaponMuzzle, false).Count, Is.EqualTo(1));
    }

    [Test]
    public void WeaponBinderUsesMarkerRootForRuntimeOwnershipWhenMountedOnWrapper()
    {
        GameObject wrapper = new GameObject("WeaponBinderWrapper");
        Transform markerRoot = CreateChild(wrapper.transform, "WeaponBinderTestShip");
        CreateWeaponMarkerHierarchy(markerRoot, "PRIMARY", includeFlash: false);

        PrototypeShipKitWeaponBinder binder = wrapper.AddComponent<PrototypeShipKitWeaponBinder>();
        SetPrivateField(binder, "markerRoot", markerRoot);
        PrototypeShipKitWeaponBinder.BindReport report = binder.BindNow();

        Assert.That(report.boundTurretWeapons, Is.EqualTo(1));
        Assert.NotNull(markerRoot.GetComponent<Rigidbody>());
        Assert.NotNull(markerRoot.GetComponent<ShipStats>());
        Assert.NotNull(markerRoot.GetComponent<ShipPhysicsCore>());
        Assert.NotNull(markerRoot.GetComponent<GunModule>());
        Assert.NotNull(markerRoot.GetComponent<PrototypeWeaponComputer>());
        Assert.Null(wrapper.GetComponent<Rigidbody>());
        Assert.Null(wrapper.GetComponent<GunModule>());
        Assert.Null(wrapper.GetComponent<PrototypeWeaponComputer>());
    }

    [Test]
    public void BootstrapCreatesTurretCompatibleWeaponWithRealMarkerMuzzle()
    {
        GameObject host = new GameObject("PrototypeBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        PrototypeTurretWeapon weapon = ship.GetComponentInChildren<PrototypeTurretWeapon>();
        PrototypeWeaponComputer computer = ship.GetComponent<PrototypeWeaponComputer>();
        GunModule gun = ship.GetComponent<GunModule>();

        Assert.NotNull(weapon);
        Assert.NotNull(computer);
        Assert.NotNull(gun);
        Assert.NotNull(weapon.Muzzle);
        Assert.True(PrototypeShipSocketUtility.IsWeaponMuzzleName(weapon.Muzzle.name));
        Assert.That(weapon.Muzzle.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
        Assert.Null(ship.transform.Find("Muzzle"));
    }

    [Test]
    public void BootstrapRegistersDefaultTestTargetForWeaponComputer()
    {
        GameObject host = new GameObject("PrototypeBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        GameObject target = GameObject.Find("PrototypeTargetDummy");
        Assert.NotNull(ship);
        Assert.NotNull(target);
        Assert.NotNull(target.GetComponent<PrototypeTargetDummy>());
        Assert.NotNull(target.GetComponent<PrototypeWeaponTargetMarker>());

        PrototypeWeaponComputer computer = ship.GetComponent<PrototypeWeaponComputer>();
        Assert.NotNull(computer);
        computer.RefreshTargets();
        Assert.NotNull(FindAvailableTarget(computer, target.transform));
        Assert.That(PrototypeWeaponTarget.LastDiscoveryUsedDebugFallback, Is.False);
    }

    [Test]
    public void WeaponComputerPanelBindingAndStatusLabelsAreNullSafe()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            GameObject dummy = GameObject.CreatePrimitive(PrimitiveType.Cube);
            dummy.name = "WeaponComputerDummyTarget";
            dummy.transform.position = new Vector3(0f, 0f, 10f);
            dummy.AddComponent<PrototypeTargetDummy>();
            dummy.AddComponent<PrototypeWeaponTargetMarker>().Configure(dummy.transform);

            fixture.Computer.RefreshTargets();
            SelectTarget(fixture.Computer, dummy.transform);
            fixture.Computer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.Nearest);
            fixture.Computer.SetAutoFireEnabled(true);
            fixture.Computer.UpdateActiveTargetAndStatus();

            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.AddComponent<Camera>();
            PrototypeWeaponComputerPanel panel = cameraObject.AddComponent<PrototypeWeaponComputerPanel>();

            Assert.DoesNotThrow(() => panel.Bind(fixture.Ship.transform, fixture.Stats, fixture.Computer, null));
            Assert.DoesNotThrow(() => panel.SetWindowVisible(false));
            Assert.DoesNotThrow(() => panel.SetWindowCollapsed(true));
            Assert.AreSame(dummy.transform, fixture.Computer.ActiveTargetTransform);
            Assert.That(fixture.Computer.PriorityMode, Is.EqualTo(PrototypeWeaponTargetPriorityMode.Nearest));
            Assert.That(fixture.Computer.TurretStatusLabel, Is.Not.Null.And.Not.Empty);
        }
    }

    private static void SetWeaponStats(
        ShipStats stats,
        float projectileSpeed = 100f,
        float projectileMass = 1f,
        float projectileDiameter = 0.2f,
        float fireRate = 10f,
        float hitChance = 1f,
        WeaponProjectileMode projectileMode = WeaponProjectileMode.Hitscan,
        int tracerEveryNthShot = PrototypeGunSettings.DefaultTracerEveryNthShot,
        float yawLeft = -35f,
        float yawRight = 35f,
        float pitchMin = -10f,
        float pitchMax = 35f)
    {
        SetPrivateField(stats, "projectileMode", projectileMode);
        SetPrivateField(stats, "projectileSpeed", projectileSpeed);
        SetPrivateField(stats, "projectileMass", projectileMass);
        SetPrivateField(stats, "projectileDiameter", projectileDiameter);
        SetPrivateField(stats, "projectileRadius", projectileDiameter * 0.5f);
        SetPrivateField(stats, "projectileFireRate", fireRate);
        SetPrivateField(stats, "projectileLifetime", 2f);
        SetPrivateField(stats, "projectileRecoilEnabled", true);
        SetPrivateField(stats, "tracerEveryNthShot", tracerEveryNthShot);
        SetPrivateField(stats, "projectileSpreadDegrees", 0f);
        SetPrivateField(stats, "hitChance", hitChance);
        SetPrivateField(stats, "engagementRangeMeters", 500f);
        SetPrivateField(stats, "yawLimitLeftDegrees", yawLeft);
        SetPrivateField(stats, "yawLimitRightDegrees", yawRight);
        SetPrivateField(stats, "pitchMinDegrees", pitchMin);
        SetPrivateField(stats, "pitchMaxDegrees", pitchMax);
        SetPrivateField(stats, "turretSlewDegreesPerSecond", 90f);
    }

    private static void SelectTarget(PrototypeWeaponComputer computer, Transform targetTransform)
    {
        PrototypeWeaponTarget target = FindAvailableTarget(computer, targetTransform);
        Assert.NotNull(target, targetTransform.name);
        if (!computer.IsSelected(target))
        {
            computer.ToggleTarget(target);
        }
    }

    private static PrototypeWeaponTarget FindAvailableTarget(PrototypeWeaponComputer computer, Transform targetTransform)
    {
        for (int i = 0; i < computer.AvailableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = computer.AvailableTargets[i];
            if (target != null && target.TargetTransform == targetTransform)
            {
                return target;
            }
        }

        return null;
    }

    private static GameObject CreateRigidbodyTarget(string name, Vector3 position, bool addMarker = true)
    {
        GameObject target = new GameObject(name);
        target.transform.position = position;
        Rigidbody body = target.AddComponent<Rigidbody>();
        body.useGravity = false;
        if (addMarker)
        {
            target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);
        }

        return target;
    }

    private static GameObject CreateDamageTarget(string name, Vector3 position, float maxIntegrity, float integrityFraction)
    {
        GameObject root = CreateRigidbodyTarget(name, position);
        GameObject module = new GameObject(name + "_Module");
        module.transform.SetParent(root.transform, false);
        PrototypeModuleDamageState damageState = module.AddComponent<PrototypeModuleDamageState>();
        damageState.Configure(name, maxIntegrity, 0f);
        damageState.SetIntegrityFraction(integrityFraction);
        return root;
    }

    private static void CreateWeaponMarkerHierarchy(Transform root, string suffix, bool includeFlash)
    {
        Transform baseMarker = CreateChild(root, PrototypeShipSocketUtility.WeaponTurretBasePrefix + suffix);
        Transform yaw = CreateChild(baseMarker, PrototypeShipSocketUtility.WeaponTurretYawPrefix + suffix);
        Transform pitch = CreateChild(yaw, PrototypeShipSocketUtility.WeaponTurretPitchPrefix + suffix);
        Transform muzzle = CreateChild(pitch, PrototypeShipSocketUtility.WeaponMuzzlePrefix + suffix);
        muzzle.localPosition = Vector3.forward;
        CreateVisibleRenderer(yaw, "GEO_Test_Turret_Yaw");
        CreateVisibleRenderer(pitch, "GEO_Test_Turret_Barrel");
        if (includeFlash)
        {
            CreateChild(muzzle, PrototypeShipSocketUtility.WeaponMuzzleFlashPrefix + suffix);
        }
    }

    private static Transform CreateChild(Transform parent, string name)
    {
        GameObject child = new GameObject(name);
        child.transform.SetParent(parent, false);
        return child.transform;
    }

    private static void CreateVisibleRenderer(Transform parent, string name)
    {
        GameObject visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
        visual.name = name;
        visual.transform.SetParent(parent, false);
        visual.transform.localScale = Vector3.one * 0.2f;
        Collider collider = visual.GetComponent<Collider>();
        if (collider != null)
        {
            UnityEngine.Object.DestroyImmediate(collider);
        }
    }

    private static int CountDescendantNames(Transform root, string exactName)
    {
        int count = 0;
        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            if (transforms[i].name == exactName)
            {
                count++;
            }
        }

        return count;
    }

    private static Projectile[] FindProjectiles()
    {
        return UnityEngine.Object.FindObjectsByType<Projectile>(FindObjectsInactive.Include);
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

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            UnityEngine.Object.DestroyImmediate(target);
        }
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

    private sealed class TurretFixture : IDisposable
    {
        public readonly GameObject Ship;
        public readonly ShipStats Stats;
        public readonly Rigidbody Body;
        public readonly ShipPhysicsCore PhysicsCore;
        public readonly Transform Muzzle;
        public readonly PrototypeTurretWeapon Weapon;

        public TurretFixture()
        {
            Ship = new GameObject("WeaponComputerTestShip");
            Stats = Ship.AddComponent<ShipStats>();
            Body = Ship.AddComponent<Rigidbody>();
            Body.useGravity = false;
            Body.linearVelocity = Vector3.zero;
            Body.angularVelocity = Vector3.zero;

            PhysicsCore = Ship.AddComponent<ShipPhysicsCore>();
            PhysicsCore.Configure(Body);

            Transform baseMarker = CreateChild(Ship.transform, "WEAPON_TURRET_BASE_PRIMARY");
            Transform yaw = CreateChild(baseMarker, "WEAPON_TURRET_YAW_PRIMARY");
            Transform pitch = CreateChild(yaw, "WEAPON_TURRET_PITCH_PRIMARY");
            Muzzle = CreateChild(pitch, "WEAPON_MUZZLE_PRIMARY");
            Muzzle.localPosition = Vector3.forward;
            Muzzle.localRotation = Quaternion.identity;

            PrototypeTurretMount mount = baseMarker.gameObject.AddComponent<PrototypeTurretMount>();
            mount.Configure(baseMarker, yaw, pitch, Muzzle, null);
            Weapon = baseMarker.gameObject.AddComponent<PrototypeTurretWeapon>();
            Weapon.Configure(Stats, Body, PhysicsCore, mount);
            SetWeaponStats(Stats);
        }

        public void Dispose()
        {
            if (PrototypeProjectileSimulation.Instance != null)
            {
                PrototypeProjectileSimulation.Instance.ClearRuntime();
            }

            DestroyObjects<Projectile>();
            DestroyNamed("WeaponComputerTestShip");
        }
    }

    private sealed class WeaponComputerFixture : IDisposable
    {
        public readonly GameObject Ship;
        public readonly ShipStats Stats;
        public readonly PrototypeWeaponComputer Computer;

        public WeaponComputerFixture()
        {
            Ship = new GameObject("WeaponComputerTestShip");
            Stats = Ship.AddComponent<ShipStats>();
            Computer = Ship.AddComponent<PrototypeWeaponComputer>();
            Computer.Bind(Ship.transform, Stats, null);
            Computer.ClearSelection();
        }

        public void Dispose()
        {
            DestroyNamed("WeaponComputerTestShip");
        }
    }

    private static string ExtractMethodBody(string source, string methodName)
    {
        int methodStart = source.IndexOf(methodName + "(", System.StringComparison.Ordinal);
        Assert.IsTrue(methodStart >= 0, $"Method '{methodName}' not found in source.");

        int bodyStart = source.IndexOf('{', methodStart);
        Assert.IsTrue(bodyStart >= 0, $"Method '{methodName}' body was not found.");

        int braceDepth = 0;
        for (int i = bodyStart; i < source.Length; i++)
        {
            char c = source[i];
            if (c == '{')
            {
                braceDepth++;
            }
            else if (c == '}')
            {
                braceDepth--;
                if (braceDepth == 0)
                {
                    return source.Substring(bodyStart, i - bodyStart + 1);
                }
            }
        }

        Assert.Fail($"Unable to parse method body for '{methodName}'.");
        return string.Empty;
    }
}
#endif
