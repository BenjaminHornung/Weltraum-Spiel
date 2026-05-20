#if UNITY_EDITOR
using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeWeaponComputerTurretValidationTests
{
    private const float AngleTolerance = 0.25f;
    private const float DistanceTolerance = 0.001f;

    [TearDown]
    public void TearDown()
    {
        DestroyObjects<Projectile>();
        DestroyNamed("WeaponComputerTestShip");
        DestroyNamed("WeaponComputerTargetNear");
        DestroyNamed("WeaponComputerTargetFar");
        DestroyNamed("WeaponComputerTargetHighHealth");
        DestroyNamed("WeaponComputerTargetLowHealth");
        DestroyNamed("WeaponComputerDummyTarget");
        DestroyNamed("WeaponBinderTestShip");
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
            Assert.That(fixture.Weapon.LastAppliedYawDegrees, Is.EqualTo(35f).Within(AngleTolerance));
            Assert.That(fixture.Weapon.LastAppliedPitchDegrees, Is.EqualTo(0f).Within(AngleTolerance));
        }
    }

    [Test]
    public void WeaponComputerPriorityModesChooseSelectedTargetsByDistanceAndHealth()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            GameObject near = CreateRigidbodyTarget("WeaponComputerTargetNear", new Vector3(0f, 0f, 8f));
            GameObject far = CreateRigidbodyTarget("WeaponComputerTargetFar", new Vector3(0f, 0f, 24f));
            GameObject highHealth = CreateDamageTarget("WeaponComputerTargetHighHealth", new Vector3(0f, 0f, 16f), 0.9f);
            GameObject lowHealth = CreateDamageTarget("WeaponComputerTargetLowHealth", new Vector3(0f, 0f, 18f), 0.2f);

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
            Assert.That(FindProjectiles().Length, Is.EqualTo(1));
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
            Assert.That(FindProjectiles().Length, Is.EqualTo(1));
        }
    }

    [Test]
    public void ProjectileDiameterControlsScaleAndSweepRadius()
    {
        GameObject projectileObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        projectileObject.name = "PrototypeProjectile";
        projectileObject.AddComponent<Rigidbody>();
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
    public void TurretRecoilRegistersImpulseThroughShipPhysicsCore()
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
            Assert.That(Vector3.Distance(fixture.Weapon.LastRecoilPositionWorld, fixture.Muzzle.position), Is.LessThan(DistanceTolerance));
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
        Assert.That(first.boundMuzzleName, Is.EqualTo("WEAPON_MUZZLE_PRIMARY"));
        Assert.That(second.createdMuzzleFlashVfxChildren, Is.EqualTo(0));
        Assert.That(ship.GetComponents<PrototypeShipKitWeaponBinder>().Length, Is.EqualTo(1));
        Assert.That(ship.GetComponents<PrototypeWeaponComputer>().Length, Is.EqualTo(1));
        Assert.That(ship.GetComponentsInChildren<PrototypeTurretWeapon>(true).Length, Is.EqualTo(1));
        Assert.That(CountDescendantNames(ship.transform, PrototypeShipKitWeaponBinder.MuzzleFlashVfxChildName), Is.EqualTo(1));
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
    public void WeaponComputerPanelBindingAndStatusLabelsAreNullSafe()
    {
        using (WeaponComputerFixture fixture = new WeaponComputerFixture())
        {
            GameObject dummy = GameObject.CreatePrimitive(PrimitiveType.Cube);
            dummy.name = "WeaponComputerDummyTarget";
            dummy.transform.position = new Vector3(0f, 0f, 10f);
            dummy.AddComponent<PrototypeTargetDummy>();

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
        float yawLeft = -35f,
        float yawRight = 35f,
        float pitchMin = -10f,
        float pitchMax = 35f)
    {
        SetPrivateField(stats, "projectileSpeed", projectileSpeed);
        SetPrivateField(stats, "projectileMass", projectileMass);
        SetPrivateField(stats, "projectileDiameter", projectileDiameter);
        SetPrivateField(stats, "projectileFireRate", fireRate);
        SetPrivateField(stats, "projectileLifetime", 2f);
        SetPrivateField(stats, "projectileRecoilEnabled", true);
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

    private static GameObject CreateRigidbodyTarget(string name, Vector3 position)
    {
        GameObject target = new GameObject(name);
        target.transform.position = position;
        Rigidbody body = target.AddComponent<Rigidbody>();
        body.useGravity = false;
        return target;
    }

    private static GameObject CreateDamageTarget(string name, Vector3 position, float integrityFraction)
    {
        GameObject root = CreateRigidbodyTarget(name, position);
        GameObject module = new GameObject(name + "_Module");
        module.transform.SetParent(root.transform, false);
        PrototypeModuleDamageState damageState = module.AddComponent<PrototypeModuleDamageState>();
        damageState.Configure(name, 100f, 0f);
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
        return UnityEngine.Object.FindObjectsByType<Projectile>(FindObjectsInactive.Include, FindObjectsSortMode.None);
    }

    private static void DestroyObjects<T>() where T : UnityEngine.Object
    {
        T[] objects = UnityEngine.Object.FindObjectsByType<T>(FindObjectsInactive.Include, FindObjectsSortMode.None);
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
}
#endif
