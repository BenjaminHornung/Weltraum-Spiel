#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

public class PrototypeFunctionalShipSocketValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("FunctionalSocketTestRoot");
        DestroyNamed("FunctionalSocketImportedTestRoot");
        DestroyNamed("FunctionalSocketFunctionalRoot");
        DestroyNamed("PrototypeBootstrapTestHost");
        DestroyNamed("PrototypeShip");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("PrototypeProjectile");
    }

    [Test]
    public void ImportedDemoShipsBindFunctionalSocketsWithoutDuplicating()
    {
        AssertImportedShipBinds("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx", true);
        AssertImportedShipBinds("Assets/Art/PrototypeShipKit/DemoShips/demo_cargo_mk1.fbx", false);
    }

    [Test]
    public void GunModuleUsesImportedMuzzleForProjectileAndRecoil()
    {
        GameObject root = CreateRuntimeRoot();
        var muzzle = new GameObject("PART_Gun_Mount_Light_Mk1_MUZZLE");
        muzzle.transform.SetParent(root.transform, false);
        muzzle.transform.localPosition = new Vector3(0.25f, 0.5f, 1.5f);
        muzzle.transform.localRotation = Quaternion.identity;

        var gun = root.AddComponent<GunModule>();
        gun.ConfigureMuzzle(null);

        Assert.AreSame(muzzle.transform, gun.MuzzleTransform);
        Assert.True(gun.TryFire());
        Assert.That(Vector3.Distance(gun.LastRecoilPositionWorld, muzzle.transform.position), Is.LessThan(0.001f));
        Assert.That(Vector3.Distance(gun.LastProjectileVelocityWorld.normalized, muzzle.transform.forward), Is.LessThan(0.001f));
    }

    [Test]
    public void RcsThrusterControllerDetectsImportedSocketsAndVfxChildren()
    {
        GameObject root = CreateRuntimeRoot();
        var nozzle = new GameObject("PART_RCS_Pod_4Way_Mk1_RCS_NOZZLE_FORWARD");
        nozzle.transform.SetParent(root.transform, false);
        nozzle.transform.localPosition = new Vector3(1f, 0f, 0f);
        nozzle.transform.localRotation = Quaternion.identity;
        var vfx = GameObject.CreatePrimitive(PrimitiveType.Cube);
        vfx.name = "VFX";
        vfx.transform.SetParent(nozzle.transform, false);
        vfx.SetActive(false);

        PrototypeShipSocketUtility.EnsureSocketsInHierarchy(root.transform);
        var controller = root.AddComponent<RcsThrusterController>();
        controller.RefreshNozzles();
        controller.ApplyControls(Vector3.forward, Vector3.zero, false, 0.1f);

        Assert.That(controller.InstalledNozzleCount, Is.EqualTo(1));
        Assert.That(controller.ActiveNozzleCount, Is.EqualTo(1));
        Assert.True(vfx.activeSelf);
    }

    [Test]
    public void RcsThrusterControllerDefaultsToGeneratedNozzleHierarchyAndCanOptIntoImportedSockets()
    {
        GameObject root = CreateRuntimeRoot();
        var importedVisual = new GameObject("ImportedShipVisual");
        importedVisual.transform.SetParent(root.transform, false);
        var importedNozzle = new GameObject("PART_RCS_Pod_4Way_Mk1_RCS_NOZZLE_FORWARD");
        importedNozzle.transform.SetParent(importedVisual.transform, false);
        importedNozzle.transform.localPosition = new Vector3(1f, 0f, 0f);

        var vfx = GameObject.CreatePrimitive(PrimitiveType.Cube);
        vfx.name = PrototypeShipKitVfxBinder.RcsThrusterVfxChildName;
        vfx.transform.SetParent(importedNozzle.transform, false);
        vfx.SetActive(false);

        var controller = root.AddComponent<RcsThrusterController>();
        controller.RefreshNozzles();

        int initialRefreshes = controller.NozzleRefreshCount;
        Assert.False(controller.UseImportedFunctionalSockets);
        Assert.That(controller.InstalledNozzleCount, Is.EqualTo(0));

        controller.ApplyControls(Vector3.forward, Vector3.zero, false, 0.02f);
        Assert.That(controller.NozzleRefreshCount, Is.EqualTo(initialRefreshes));

        controller.SetUseImportedFunctionalSockets(true);
        Assert.True(controller.UseImportedFunctionalSockets);
        controller.ApplyControls(Vector3.forward, Vector3.zero, false, 0.02f);
        Assert.That(controller.NozzleRefreshCount, Is.EqualTo(initialRefreshes + 1));
        Assert.That(controller.InstalledNozzleCount, Is.EqualTo(1));
        Assert.That(controller.ActiveNozzleCount, Is.EqualTo(1));
        Assert.True(vfx.activeSelf);
    }

    [Test]
    public void MainThrusterVfxAndGimbalBindToImportedNozzle()
    {
        GameObject root = CreateRuntimeRoot();
        var gimbal = new GameObject("MainThrusterGimbal");
        gimbal.transform.SetParent(root.transform, false);
        var nozzle = new GameObject("PART_Main_Engine_Bell_Mk1_THRUST_NOZZLE_MAIN");
        nozzle.transform.SetParent(gimbal.transform, false);
        nozzle.transform.localPosition = new Vector3(0f, 0f, -1f);
        nozzle.transform.localRotation = Quaternion.LookRotation(Vector3.right, Vector3.up);

        PrototypeShipSocketUtility.EnsureSocketsInHierarchy(root.transform);
        var module = root.AddComponent<MainThrusterModule>();
        module.Configure(nozzle.transform, gimbal.transform, root.GetComponent<Rigidbody>(), root.GetComponent<ShipStats>(), root.GetComponent<ShipPhysicsCore>(), null);
        Quaternion before = gimbal.transform.localRotation;
        module.GetThrustDirection(1f, 0.5f, 0.1f);

        var engineVfx = root.AddComponent<EngineVfxController>();
        engineVfx.ConfigureNozzle(nozzle.transform);
        engineVfx.SetThrottle(1f);

        Assert.AreSame(nozzle.transform, module.ThrustTransform);
        Assert.AreSame(gimbal.transform, module.GimbalVisualTransform);
        Assert.That(Vector3.Angle(module.GetThrustDirection(0f, 0f), nozzle.transform.forward), Is.LessThan(2f));
        Assert.AreSame(nozzle.transform, engineVfx.Nozzle);
        Assert.That(Quaternion.Angle(before, gimbal.transform.localRotation), Is.GreaterThanOrEqualTo(0f));
        Assert.NotNull(nozzle.transform.Find("EngineParticleSystem"));
    }

    [Test]
    public void BinderIsIdempotentAndCreatesRuntimeVfxChildren()
    {
        GameObject root = CreateRuntimeRoot();
        var mainNozzle = new GameObject("PART_Main_Engine_Bell_Mk1_THRUST_NOZZLE_MAIN");
        mainNozzle.transform.SetParent(root.transform, false);
        var rcsNozzle = new GameObject("PART_RCS_Pod_4Way_Mk1_RCS_NOZZLE_LEFT");
        rcsNozzle.transform.SetParent(root.transform, false);
        var muzzle = new GameObject("PART_Gun_Mount_Light_Mk1_MUZZLE");
        muzzle.transform.SetParent(root.transform, false);

        var binder = root.AddComponent<PrototypeImportedShipBinder>();
        PrototypeImportedShipBinder.BindReport first = binder.BindNow();
        int firstVfxCount = CountDescendantNames(root.transform, "VFX");
        PrototypeImportedShipBinder.BindReport second = binder.BindNow();
        int secondVfxCount = CountDescendantNames(root.transform, "VFX");

        Assert.That(first.foundMainNozzles, Is.EqualTo(1));
        Assert.That(first.foundRcsNozzles, Is.EqualTo(1));
        Assert.That(first.foundMuzzles, Is.EqualTo(1));
        Assert.That(first.boundMainThrusters, Is.EqualTo(1));
        Assert.That(first.boundRcsNozzles, Is.EqualTo(1));
        Assert.That(first.boundGuns, Is.EqualTo(1));
        Assert.That(firstVfxCount, Is.EqualTo(1));
        Assert.That(secondVfxCount, Is.EqualTo(firstVfxCount));
        Assert.That(second.createdRcsVfxChildren, Is.EqualTo(0));
    }

    [Test]
    public void FunctionalBinderUsesImportedDemoScoutAsRuntimeRootWithoutFallbacks()
    {
        AssetDatabase.ImportAsset("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx", ImportAssetOptions.ForceUpdate);
        GameObject root = CreateRuntimeRoot();
        root.name = "FunctionalSocketFunctionalRoot";

        var binder = root.AddComponent<PrototypeFunctionalShipBinder>();
        PrototypeFunctionalShipBinder.BindReport report = binder.BindNow();

        Assert.True(report.hasRequiredFunctionalSockets, string.Join(", ", report.missingRequiredSockets));
        Assert.NotNull(report.importedVisualRoot);
        Assert.NotNull(report.importedShipInstance);
        Assert.That(report.foundMainNozzles, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.foundRcsNozzles, Is.GreaterThanOrEqualTo(8));
        Assert.That(report.foundWeaponMuzzleMarkers, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.boundMainThrusters, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.boundRcsNozzles, Is.GreaterThanOrEqualTo(8));
        Assert.That(report.boundTurretWeapons, Is.GreaterThanOrEqualTo(1));

        EngineVfxController engine = root.GetComponent<EngineVfxController>();
        RcsThrusterController rcs = root.GetComponent<RcsThrusterController>();
        GunModule gun = root.GetComponent<GunModule>();
        PrototypeTurretWeapon weapon = root.GetComponentInChildren<PrototypeTurretWeapon>(true);

        Assert.NotNull(engine);
        Assert.NotNull(engine.Nozzle);
        Assert.That(engine.Nozzle.name, Does.Contain("THRUST_NOZZLE_MAIN"));
        Assert.False(engine.AllowFallbackNozzle);
        Assert.NotNull(rcs);
        Assert.True(rcs.UseImportedFunctionalSockets);
        Assert.NotNull(gun);
        Assert.False(gun.AllowMuzzleFallback);
        Assert.NotNull(gun.MuzzleTransform);
        Assert.That(gun.MuzzleTransform.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
        Assert.NotNull(weapon);
        Assert.AreSame(gun.MuzzleTransform, weapon.Muzzle);
        Assert.Null(root.transform.Find("Muzzle"));
        Assert.Null(root.transform.Find("EngineNozzle"));
    }

    [Test]
    public void BootstrapDefaultBuildsImportedFunctionalScoutWithVisibleTurretHierarchy()
    {
        AssetDatabase.ImportAsset("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx", ImportAssetOptions.ForceUpdate);
        GameObject host = new GameObject("PrototypeBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
        Assert.NotNull(ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName));
        Assert.Null(ship.transform.Find("Muzzle"));
        Assert.Null(ship.transform.Find("EngineNozzle"));

        EngineVfxController engine = ship.GetComponent<EngineVfxController>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        GunModule gun = ship.GetComponent<GunModule>();
        PrototypeTurretWeapon weapon = ship.GetComponentInChildren<PrototypeTurretWeapon>(true);

        Assert.NotNull(engine);
        Assert.That(engine.Nozzle.name, Does.Contain("THRUST_NOZZLE_MAIN"));
        Assert.NotNull(rcs);
        Assert.True(rcs.UseImportedFunctionalSockets);
        Assert.That(rcs.InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
        Assert.NotNull(gun);
        Assert.That(gun.MuzzleTransform.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
        Assert.NotNull(weapon);
        Assert.NotNull(weapon.Mount);
        Assert.NotNull(weapon.Mount.YawPivot);
        Assert.NotNull(weapon.Mount.PitchPivot);

        Transform barrel = FindDescendant(ship.transform, "DEMO_Scout_Mk1_GEO_Gun_Barrel");
        Transform yawMesh = FindDescendant(ship.transform, "DEMO_Scout_Mk1_GEO_Gun_Mount_Base");
        Assert.NotNull(barrel);
        Assert.NotNull(yawMesh);
        Assert.True(barrel.IsChildOf(weapon.Mount.PitchPivot), barrel.parent != null ? barrel.parent.name : "no parent");
        Assert.True(yawMesh.IsChildOf(weapon.Mount.YawPivot), yawMesh.parent != null ? yawMesh.parent.name : "no parent");
    }

    private static void AssertImportedShipBinds(string assetPath, bool requiresMuzzle)
    {
        GameObject source = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        Assert.NotNull(source, assetPath);

        GameObject instance = Object.Instantiate(source);
        instance.name = "FunctionalSocketImportedTestRoot";
        var binder = instance.AddComponent<PrototypeImportedShipBinder>();
        PrototypeImportedShipBinder.BindReport first = binder.BindNow();
        int firstRuntimeVfxCount = CountDescendantNames(instance.transform, "VFX");
        PrototypeImportedShipBinder.BindReport second = binder.BindNow();
        int secondRuntimeVfxCount = CountDescendantNames(instance.transform, "VFX");

        Assert.That(first.foundMainNozzles, Is.GreaterThanOrEqualTo(1), assetPath);
        Assert.That(first.foundRcsNozzles, Is.GreaterThanOrEqualTo(8), assetPath);
        if (requiresMuzzle)
        {
            Assert.That(first.foundMuzzles, Is.GreaterThanOrEqualTo(1), assetPath);
        }
        Assert.That(first.boundMainThrusters, Is.GreaterThanOrEqualTo(1), assetPath);
        Assert.That(first.boundRcsNozzles, Is.EqualTo(first.foundRcsNozzles), assetPath);
        Assert.That(first.boundGuns, Is.EqualTo(requiresMuzzle ? 1 : 0), assetPath);
        Assert.That(firstRuntimeVfxCount, Is.GreaterThanOrEqualTo(first.foundRcsNozzles), assetPath);
        Assert.That(second.createdRcsVfxChildren, Is.EqualTo(0), assetPath);
        Assert.That(secondRuntimeVfxCount, Is.EqualTo(firstRuntimeVfxCount), assetPath);

        Object.DestroyImmediate(instance);
    }

    private static GameObject CreateRuntimeRoot()
    {
        var root = new GameObject("FunctionalSocketTestRoot");
        var rigidbody = root.AddComponent<Rigidbody>();
        rigidbody.useGravity = false;
        root.AddComponent<ShipStats>();
        var physicsCore = root.AddComponent<ShipPhysicsCore>();
        physicsCore.Configure(rigidbody);
        return root;
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

    private static Transform FindDescendant(Transform root, string exactName)
    {
        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            if (transforms[i].name == exactName)
            {
                return transforms[i];
            }
        }

        return null;
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif


