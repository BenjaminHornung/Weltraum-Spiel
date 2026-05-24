#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
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
        DestroyNamed("InvisibleWeaponPrefab");
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
    public void GunModuleUsesImportedMuzzleForProjectileAndSafeRecoil()
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
        Assert.That(Vector3.Distance(gun.LastMuzzleWorldPosition, muzzle.transform.position), Is.LessThan(0.001f));
        Assert.That(Vector3.Distance(gun.LastRecoilPositionWorld, root.GetComponent<Rigidbody>().worldCenterOfMass), Is.LessThan(0.001f));
        Assert.That(gun.LastRecoilAngularImpulseWorld.magnitude, Is.EqualTo(0f).Within(0.001f));
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
    public void HardpointBinderReportsImportedHardpointsIdempotently()
    {
        GameObject source = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx");
        Assert.NotNull(source);

        GameObject instance = Object.Instantiate(source);
        instance.name = "FunctionalSocketImportedTestRoot";
        var importedBinder = instance.AddComponent<PrototypeImportedShipBinder>();

        PrototypeImportedShipBinder.BindReport first = importedBinder.BindNow();
        PrototypeImportedShipBinder.BindReport second = importedBinder.BindNow();
        PrototypeShipHardpoint[] hardpoints = instance.GetComponentsInChildren<PrototypeShipHardpoint>(true);

        Assert.That(first.foundHardpoints, Is.GreaterThan(0));
        Assert.That(first.boundHardpoints, Is.GreaterThan(0));
        Assert.That(first.createdHardpointBindings, Is.EqualTo(first.boundHardpoints));
        Assert.That(second.boundHardpoints, Is.EqualTo(first.boundHardpoints));
        Assert.That(second.createdHardpointBindings, Is.EqualTo(0));
        Assert.That(hardpoints.Length, Is.EqualTo(first.boundHardpoints));
        Assert.True(AllHardpointsHaveStableIds(hardpoints));

        Object.DestroyImmediate(instance);
    }

    [Test]
    public void GeneratedFallbackCreatesBoundHardpointsWithoutDisablingFallback()
    {
        GameObject host = new GameObject("PrototypeBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "buildOnStart", false);
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.GeneratedPrimitiveFallback));
        Assert.NotNull(ship.transform.Find(PrototypeShipHardpointBinder.GeneratedHardpointRigName));

        PrototypeShipHardpointBinder binder = ship.GetComponent<PrototypeShipHardpointBinder>();
        Assert.NotNull(binder);
        Assert.NotNull(binder.LastReport);
        Assert.That(binder.LastReport.boundHardpoints, Is.GreaterThanOrEqualTo(6));
        int firstCount = ship.GetComponentsInChildren<PrototypeShipHardpoint>(true).Length;

        PrototypeShipHardpointBinder.BindReport second = binder.BindNow();
        int secondCount = ship.GetComponentsInChildren<PrototypeShipHardpoint>(true).Length;

        Assert.That(second.createdHardpointBindings, Is.EqualTo(0));
        Assert.That(secondCount, Is.EqualTo(firstCount));
        Assert.NotNull(ship.transform.Find("RCS_Top"));
        Assert.False(ship.GetComponent<RcsThrusterController>().UseImportedFunctionalSockets);
        Assert.True(ship.GetComponent<EngineVfxController>().AllowFallbackNozzle);
    }

    [Test]
    public void HardpointBinderDoesNotHardcodeDemoShipHierarchyPaths()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypeShipHardpointBinder.cs"));

        Assert.False(Regex.IsMatch(source, "demo_scout|demo_cargo|ImportedDemo|DEMO_Scout|DEMO_Cargo"));
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
        Assert.That(report.importedShipInstance.localScale.x, Is.GreaterThanOrEqualTo(50f));
        Assert.That(CountVisibleShipMeshRenderers(report.importedShipInstance), Is.GreaterThan(20));
        Assert.That(CombinedVisibleShipMeshBounds(report.importedShipInstance).size.magnitude, Is.GreaterThan(1f));
        Assert.That(report.foundMainNozzles, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.foundRcsNozzles, Is.GreaterThanOrEqualTo(8));
        Assert.That(report.foundWeaponMuzzleMarkers, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.boundMainThrusters, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.boundRcsNozzles, Is.GreaterThanOrEqualTo(8));
        Assert.That(report.boundTurretWeapons, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.visibleTurretYawRenderers, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.visibleTurretPitchRenderers, Is.GreaterThanOrEqualTo(1));
        Assert.That(report.unsafeFunctionalSocketScaleCount, Is.EqualTo(0), report.firstUnsafeFunctionalSocketName);
        Assert.That(report.bestMainNozzleForwardDot, Is.GreaterThanOrEqualTo(0.9f), report.bestMainNozzleForwardName);

        EngineVfxController engine = root.GetComponent<EngineVfxController>();
        RcsThrusterController rcs = root.GetComponent<RcsThrusterController>();
        GunModule gun = root.GetComponent<GunModule>();
        PrototypeTurretWeapon weapon = root.GetComponentInChildren<PrototypeTurretWeapon>(true);

        Assert.NotNull(engine);
        Assert.NotNull(engine.Nozzle);
        Assert.That(engine.Nozzle.name, Does.Contain("THRUST_NOZZLE_MAIN"));
        AssertSafeFunctionalSocketScale(engine.Nozzle);
        Assert.That(Vector3.Dot(engine.Nozzle.forward, root.transform.forward), Is.GreaterThanOrEqualTo(0.9f));
        Assert.False(engine.AllowFallbackNozzle);
        Assert.NotNull(rcs);
        Assert.True(rcs.UseImportedFunctionalSockets);
        Assert.NotNull(gun);
        Assert.False(gun.AllowMuzzleFallback);
        Assert.NotNull(gun.MuzzleTransform);
        Assert.That(gun.MuzzleTransform.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
        AssertSafeFunctionalSocketScale(gun.MuzzleTransform);
        Assert.NotNull(weapon);
        Assert.AreSame(gun.MuzzleTransform, weapon.Muzzle);
        Assert.Null(root.transform.Find("Muzzle"));
        Assert.Null(root.transform.Find("EngineNozzle"));
    }

    [Test]
    public void FunctionalBinderTreatsMissingTurretRenderersAsWeaponVisualDegradationOnly()
    {
        GameObject root = CreateRuntimeRoot();
        root.name = "FunctionalSocketFunctionalRoot";
        GameObject prefab = CreateMinimalImportedFlightWeaponPrefab(includeVisibleTurretRenderers: false);

        var binder = root.AddComponent<PrototypeFunctionalShipBinder>();
        binder.Configure(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault, prefab);

        PrototypeFunctionalShipBinder.BindReport report = binder.BindNow();

        Assert.True(report.hasRequiredFlightSockets, string.Join(", ", report.missingRequiredSockets));
        Assert.True(report.hasRequiredFunctionalSockets, string.Join(", ", report.missingRequiredSockets));
        Assert.True(report.hasRequiredWeaponSockets, string.Join(", ", report.missingWeaponSockets));
        Assert.False(report.hasRequiredVisibleWeaponRenderers);
        Assert.That(report.missingRequiredSockets, Does.Not.Contain("visible yaw renderer under WEAPON_TURRET_YAW_*"));
        Assert.That(report.missingRequiredSockets, Does.Not.Contain("visible pitch renderer under WEAPON_TURRET_PITCH_*"));
        Assert.That(report.missingVisibleWeaponRenderers, Does.Contain("visible yaw renderer under WEAPON_TURRET_YAW_*"));
        Assert.That(report.missingVisibleWeaponRenderers, Does.Contain("visible pitch renderer under WEAPON_TURRET_PITCH_*"));
        Assert.NotNull(root.GetComponent<MainThrusterModule>());
        Assert.True(root.GetComponent<RcsThrusterController>().UseImportedFunctionalSockets);

        Object.DestroyImmediate(prefab);
    }

    [Test]
    public void FunctionalBinderCloneVisualChildrenLeavesOriginalVisibleWhenCloneHasNoRenderer()
    {
        GameObject source = new GameObject("FunctionalSocketImportedTestRoot");
        Transform sourceYaw = CreateChild(source.transform, "WEAPON_TURRET_YAW_PRIMARY", Vector3.zero, Quaternion.identity);
        Transform emptyVisual = CreateChild(sourceYaw, "EmptyTurretVisualContainer", Vector3.zero, Quaternion.identity);
        GameObject proxy = new GameObject("FunctionalSocketFunctionalRoot");
        Transform proxyYaw = CreateChild(proxy.transform, "WEAPON_TURRET_YAW_PRIMARY", Vector3.zero, Quaternion.identity);
        var report = new PrototypeFunctionalShipBinder.BindReport();

        MethodInfo cloneMethod = typeof(PrototypeFunctionalShipBinder).GetMethod(
            "CloneVisualChildrenToProxy",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(cloneMethod);

        cloneMethod.Invoke(null, new object[] { sourceYaw, proxyYaw, report });

        Assert.That(emptyVisual.name, Is.EqualTo("EmptyTurretVisualContainer"));
        Assert.That(proxyYaw.childCount, Is.EqualTo(0));
        Assert.That(report.reparentedVisibleTurretChildren, Is.EqualTo(0));
        Assert.That(report.warnings, Has.Some.Contains("no enabled renderer"));
    }

    [Test]
    public void PrototypeBootstrapHostSceneAllowsGeneratedFallbackForVisibleShipSafety()
    {
        string scenePath = Path.Combine(Application.dataPath, "Scenes", "PrototypeBootstrapHost.unity");
        string sceneText = File.ReadAllText(scenePath);

        Assert.That(sceneText, Does.Contain("allowGeneratedFallbackWhenImportedAssetMissing: 1"));
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
        AssertSafeFunctionalSocketScale(engine.Nozzle);
        Assert.That(Vector3.Dot(engine.Nozzle.forward, ship.transform.forward), Is.GreaterThanOrEqualTo(0.9f));
        Assert.NotNull(rcs);
        Assert.True(rcs.UseImportedFunctionalSockets);
        Assert.That(rcs.InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
        Assert.NotNull(gun);
        Assert.That(gun.MuzzleTransform.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
        AssertSafeFunctionalSocketScale(gun.MuzzleTransform);
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

    private static void AssertSafeFunctionalSocketScale(Transform socket)
    {
        Assert.NotNull(socket);
        Vector3 scale = socket.lossyScale;
        Assert.That(scale.x, Is.EqualTo(1f).Within(0.02f), socket.name);
        Assert.That(scale.y, Is.EqualTo(1f).Within(0.02f), socket.name);
        Assert.That(scale.z, Is.EqualTo(1f).Within(0.02f), socket.name);
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

    private static GameObject CreateMinimalImportedFlightWeaponPrefab(bool includeVisibleTurretRenderers)
    {
        GameObject prefab = new GameObject("InvisibleWeaponPrefab");
        CreateChild(prefab.transform, "THRUST_NOZZLE_MAIN_PRIMARY", new Vector3(0f, 0f, -2f), Quaternion.identity);
        CreateChild(prefab.transform, "RCS_NOZZLE_UP_PRIMARY", new Vector3(1f, 0f, 0f), Quaternion.LookRotation(Vector3.up, Vector3.forward));
        Transform weaponBase = CreateChild(prefab.transform, "WEAPON_TURRET_BASE_PRIMARY", new Vector3(0f, 0.5f, 0.5f), Quaternion.identity);
        Transform yaw = CreateChild(weaponBase, "WEAPON_TURRET_YAW_PRIMARY", Vector3.zero, Quaternion.identity);
        Transform pitch = CreateChild(yaw, "WEAPON_TURRET_PITCH_PRIMARY", Vector3.zero, Quaternion.identity);
        CreateChild(pitch, "WEAPON_MUZZLE_PRIMARY", new Vector3(0f, 0f, 1f), Quaternion.identity);

        if (includeVisibleTurretRenderers)
        {
            GameObject yawMesh = GameObject.CreatePrimitive(PrimitiveType.Cube);
            yawMesh.name = "VisibleYawMesh";
            yawMesh.transform.SetParent(yaw, false);
            yawMesh.transform.localScale = Vector3.one * 0.2f;

            GameObject pitchMesh = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pitchMesh.name = "VisiblePitchMesh";
            pitchMesh.transform.SetParent(pitch, false);
            pitchMesh.transform.localScale = new Vector3(0.1f, 0.1f, 0.8f);
        }

        PrototypeShipSocketUtility.EnsureSocketsInHierarchy(prefab.transform);
        return prefab;
    }

    private static Transform CreateChild(Transform parent, string name, Vector3 localPosition, Quaternion localRotation)
    {
        Transform child = new GameObject(name).transform;
        child.SetParent(parent, false);
        child.localPosition = localPosition;
        child.localRotation = localRotation;
        child.localScale = Vector3.one;
        return child;
    }

    private static int CountVisibleShipMeshRenderers(Transform root)
    {
        Renderer[] renderers = root != null ? root.GetComponentsInChildren<Renderer>(true) : new Renderer[0];
        int count = 0;
        for (int i = 0; i < renderers.Length; i++)
        {
            if (IsVisibleShipMeshRenderer(renderers[i]))
            {
                count++;
            }
        }

        return count;
    }

    private static Bounds CombinedVisibleShipMeshBounds(Transform root)
    {
        Renderer[] renderers = root != null ? root.GetComponentsInChildren<Renderer>(true) : new Renderer[0];
        Bounds bounds = new Bounds(root != null ? root.position : Vector3.zero, Vector3.zero);
        bool hasBounds = false;
        for (int i = 0; i < renderers.Length; i++)
        {
            Renderer renderer = renderers[i];
            if (!IsVisibleShipMeshRenderer(renderer))
            {
                continue;
            }

            if (!hasBounds)
            {
                bounds = renderer.bounds;
                hasBounds = true;
            }
            else
            {
                bounds.Encapsulate(renderer.bounds);
            }
        }

        return bounds;
    }

    private static bool IsVisibleShipMeshRenderer(Renderer renderer)
    {
        if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
        {
            return false;
        }

        string name = renderer.gameObject.name;
        return name.StartsWith("DEMO_", System.StringComparison.Ordinal)
            && name.IndexOf("VFX", System.StringComparison.OrdinalIgnoreCase) < 0
            && name.IndexOf("NOZZLE", System.StringComparison.OrdinalIgnoreCase) < 0
            && name.IndexOf("MUZZLE_FLASH", System.StringComparison.OrdinalIgnoreCase) < 0;
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

    private static bool AllHardpointsHaveStableIds(PrototypeShipHardpoint[] hardpoints)
    {
        for (int i = 0; i < hardpoints.Length; i++)
        {
            if (hardpoints[i] == null || string.IsNullOrWhiteSpace(hardpoints[i].HardpointId))
            {
                return false;
            }
        }

        return true;
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


