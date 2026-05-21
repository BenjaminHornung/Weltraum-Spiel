using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeFunctionalBlenderRuntimePlayModeTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        DestroyNamed("PrototypeBootstrapPlayModeHost");
        DestroyNamed("PrototypeShip");
        DestroyNamed("RuntimeWeaponTarget");
        DestroyNamed("PrototypeProjectileSimulation");
        DestroyNamed("PrototypeProjectile");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void BootstrapPlayModeUsesImportedScoutSocketsVfxAndAlignedTargetFire()
    {
        GameObject host = new GameObject("PrototypeBootstrapPlayModeHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
        Assert.NotNull(ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName));
        Assert.Null(ship.transform.Find("Muzzle"));
        Assert.Null(ship.transform.Find("EngineNozzle"));

        EngineVfxController engine = ship.GetComponent<EngineVfxController>();
        MainThrusterBank mainThruster = ship.GetComponent<MainThrusterBank>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        Component computer = ship.GetComponent("PrototypeWeaponComputer");
        PrototypeTurretWeapon weapon = ship.GetComponentInChildren<PrototypeTurretWeapon>(true);

        Assert.NotNull(engine);
        Assert.NotNull(engine.Nozzle);
        Assert.That(engine.Nozzle.name, Does.Contain("THRUST_NOZZLE_MAIN"));
        Assert.NotNull(mainThruster);
        Assert.NotNull(rcs);
        Assert.True(rcs.UseImportedFunctionalSockets);
        Assert.That(rcs.InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
        Assert.NotNull(computer);
        Assert.NotNull(weapon);
        Assert.NotNull(weapon.Muzzle);
        Assert.That(weapon.Muzzle.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));

        mainThruster.Fire(1f, 0f, 0f, Time.fixedDeltaTime);
        engine.SetThrottle(1f);
        Assert.That(mainThruster.LastAppliedThrust, Is.GreaterThan(0f));
        Transform engineParticles = engine.Nozzle.Find("EngineParticleSystem");
        Assert.NotNull(engineParticles);
        Assert.True(engineParticles.GetComponent<ParticleSystem>().isPlaying);

        PulseAnyRcsNozzle(rcs);
        Assert.That(rcs.ActiveNozzleCount, Is.GreaterThan(0));
        Assert.NotNull(FindActiveRcsVfxNearImportedNozzle(ship.transform));

        GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube);
        target.name = "RuntimeWeaponTarget";
        Vector3 targetDirection = weapon.Mount.MountRoot.TransformDirection(Quaternion.Euler(0f, 18f, 0f) * Vector3.forward).normalized;
        target.transform.position = weapon.Muzzle.position + targetDirection * 32f;
        target.AddComponent<Rigidbody>().useGravity = false;
        target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);
        InvokeMethod(computer, "RefreshTargets");
        SelectTarget(computer, target.transform);
        InvokeMethod(computer, "SetAutoFireEnabled", true);

        float yawBefore = weapon.LastAppliedYawDegrees;
        bool fired = false;
        for (int i = 0; i < 90; i++)
        {
            weapon.TickAimAtTarget(target.transform, Time.fixedDeltaTime);
            fired = weapon.TryFireAt(target.transform) || fired;
            if (fired)
            {
                break;
            }
        }

        Assert.That(Mathf.Abs(weapon.LastAppliedYawDegrees - yawBefore), Is.GreaterThan(0.5f));
        Assert.True(fired, GetStringProperty(computer, "TurretStatusLabel"));
        Assert.That(Vector3.Distance(weapon.LastRecoilPositionWorld, weapon.Muzzle.position), Is.LessThan(0.25f));
        Assert.True(weapon.LastFireResult.muzzleVisualEmitted || weapon.LastFireResult.tracerVisualEmitted);
    }

    private static GameObject FindActiveRcsVfxNearImportedNozzle(Transform ship)
    {
        Transform[] transforms = ship.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform nozzle = transforms[i];
            if (!PrototypeShipSocketUtility.IsRcsNozzleName(nozzle.name))
            {
                continue;
            }

            Transform vfx = nozzle.Find("VFX")
                ?? nozzle.Find(PrototypeShipKitVfxBinder.RcsThrusterVfxChildName)
                ?? nozzle.Find("RcsThrusterVfx");
            if (vfx != null && vfx.gameObject.activeSelf && Vector3.Distance(vfx.position, nozzle.position) < 0.25f)
            {
                return vfx.gameObject;
            }
        }

        return null;
    }

    private static void PulseAnyRcsNozzle(RcsThrusterController rcs)
    {
        Vector3[] commands =
        {
            Vector3.forward,
            Vector3.back,
            Vector3.left,
            Vector3.right,
            Vector3.up,
            Vector3.down
        };

        for (int i = 0; i < commands.Length; i++)
        {
            rcs.ApplyControls(commands[i], Vector3.zero, false, 0.1f);
            if (rcs.ActiveNozzleCount > 0)
            {
                return;
            }
        }

        for (int i = 0; i < commands.Length; i++)
        {
            rcs.ApplyControls(Vector3.zero, commands[i], false, 0.1f);
            if (rcs.ActiveNozzleCount > 0)
            {
                return;
            }
        }
    }

    private static void SelectTarget(Component computer, Transform targetTransform)
    {
        object targets = GetPropertyValue(computer, "AvailableTargets");
        var list = targets as System.Collections.IList;
        Assert.NotNull(list, "Weapon computer AvailableTargets should be list-like.");

        for (int i = 0; i < list.Count; i++)
        {
            object target = list[i];
            Transform foundTransform = GetPropertyValue(target, "TargetTransform") as Transform;
            if (target != null && foundTransform == targetTransform)
            {
                InvokeMethod(computer, "ToggleTarget", target);
                return;
            }
        }

        Assert.Fail("Runtime target was not discovered by the weapon computer.");
    }

    private static void InvokeMethod(object target, string methodName, params object[] args)
    {
        Assert.NotNull(target, methodName);
        MethodInfo method = null;
        MethodInfo[] methods = target.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        for (int i = 0; i < methods.Length; i++)
        {
            if (methods[i].Name == methodName && methods[i].GetParameters().Length == args.Length)
            {
                method = methods[i];
                break;
            }
        }

        Assert.NotNull(method, methodName);
        method.Invoke(target, args);
    }

    private static string GetStringProperty(object target, string propertyName)
    {
        object value = GetPropertyValue(target, propertyName);
        return value != null ? value.ToString() : string.Empty;
    }

    private static object GetPropertyValue(object target, string propertyName)
    {
        Assert.NotNull(target, propertyName);
        PropertyInfo property = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(property, propertyName);
        return property.GetValue(target);
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
