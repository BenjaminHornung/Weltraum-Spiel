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
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");
        DestroyNamed("PrototypeShipVisualSwitcher");
        DestroyNamed("PrototypeShip");
        DestroyNamed("RuntimeWeaponTarget");
        DestroyNamed("PrototypeProjectileSimulation");
        DestroyNamed("PrototypeProjectile");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    [Test]
    public void BootstrapPlayModeKeepsImportedScoutVisibleAndPlayableForTenSeconds()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");

        try
        {
            GameObject host = new GameObject("PrototypeBootstrapPlayModeHost");
            PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
            SetPrivateField(bootstrap, "buildOnStart", false);
            SetPrivateField(bootstrap, "spawnTestTarget", false);
            SetPrivateField(bootstrap, "buildTestEnvironment", false);
            SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
            bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

            GameObject ship = GameObject.Find("PrototypeShip");
            Assert.NotNull(ship);
            PrototypeShipVisualSwitcher switcher = Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
            if (switcher == null)
            {
                switcher = new GameObject("PrototypeShipVisualSwitcher_Manager").AddComponent<PrototypeShipVisualSwitcher>();
            }

            InvokeMethod(switcher, "ResetForRuntimeBaseline");
            for (int i = 0; i < 8; i++)
            {
                InvokeMethod(switcher, "Update");
            }

            Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
            Assert.That(switcher.SelectedVisualMode, Is.EqualTo(PrototypeShipVisualMode.ImportedDemoScout));
            Transform importedVisual = ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName);
            Assert.NotNull(importedVisual);
            Assert.True(importedVisual.gameObject.activeInHierarchy);
            Assert.Null(ship.transform.Find("Muzzle"));
            Assert.Null(ship.transform.Find("EngineNozzle"));

            EngineVfxController engine = ship.GetComponent<EngineVfxController>();
            MainThrusterBank mainThruster = ship.GetComponent<MainThrusterBank>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            PrototypeWeaponComputer computer = ship.GetComponent<PrototypeWeaponComputer>();
            PrototypeTurretWeapon weapon = ship.GetComponentInChildren<PrototypeTurretWeapon>(true);

            Assert.NotNull(engine);
            Assert.NotNull(engine.Nozzle);
            Assert.That(engine.Nozzle.name, Does.Contain("THRUST_NOZZLE_MAIN"));
            AssertSafeFunctionalSocketScale(engine.Nozzle);
            Assert.That(Vector3.Dot(engine.Nozzle.forward, ship.transform.forward), Is.GreaterThanOrEqualTo(0.9f));
            Assert.NotNull(mainThruster);
            Assert.NotNull(rcs);
            Assert.True(rcs.UseImportedFunctionalSockets);
            Assert.That(rcs.InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
            Assert.NotNull(controller);
            Assert.NotNull(body);
            Assert.NotNull(computer);
            Assert.NotNull(weapon);
            Assert.NotNull(weapon.Muzzle);
            Assert.That(weapon.Muzzle.name, Does.StartWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix));
            AssertSafeFunctionalSocketScale(weapon.Muzzle);

            controller.ResetFlightState(Vector3.zero, Quaternion.identity, true);
            Physics.SyncTransforms();
            float initialForwardSpeed = Vector3.Dot(body.linearVelocity, ship.transform.forward);
            Vector3 previousPosition = body.position;
            float maxFrameJump = 0f;
            float maxAngularVelocity = 0f;

            controller.FullMainThrottle();
            for (int i = 0; i < 500; i++)
            {
                InvokeMethod(switcher, "Update");
                InvokeMethod(controller, "FixedUpdate");
                Physics.Simulate(Time.fixedDeltaTime);
                AssertFinite(body.position, "position");
                AssertFinite(body.linearVelocity, "linearVelocity");
                AssertFinite(body.angularVelocity, "angularVelocity");
                maxFrameJump = Mathf.Max(maxFrameJump, Vector3.Distance(previousPosition, body.position));
                maxAngularVelocity = Mathf.Max(maxAngularVelocity, body.angularVelocity.magnitude);
                previousPosition = body.position;
                Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
                Assert.That(switcher.SelectedVisualMode, Is.EqualTo(PrototypeShipVisualMode.ImportedDemoScout));
                Assert.True(importedVisual.gameObject.activeInHierarchy);
            }

            float finalForwardSpeed = Vector3.Dot(body.linearVelocity, ship.transform.forward);
            Assert.That(finalForwardSpeed, Is.GreaterThan(initialForwardSpeed + 0.5f));
            Assert.That(maxFrameJump, Is.LessThan(25f));
            Assert.That(maxAngularVelocity, Is.LessThan(5f));
            Assert.That(mainThruster.LastAppliedThrust, Is.GreaterThan(0f));
            Transform engineParticles = engine.Nozzle.Find("EngineParticleSystem");
            Assert.NotNull(engineParticles);
            Assert.True(engineParticles.GetComponent<ParticleSystem>().isPlaying);

            controller.CutMainThrottle();
            controller.ResetAngularVelocity();
            controller.PulseRcsTranslation(Vector3.up);
            InvokeMethod(controller, "FixedUpdate");
            Physics.Simulate(Time.fixedDeltaTime);
            Assert.That(rcs.ActiveNozzleCount, Is.GreaterThan(0));
            Assert.NotNull(FindActiveRcsVfxNearImportedNozzle(ship.transform));
            Assert.That(body.angularVelocity.magnitude, Is.LessThan(5f));

            GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube);
            target.name = "RuntimeWeaponTarget";
            Vector3 targetDirection = weapon.Mount.MountRoot.TransformDirection(Quaternion.Euler(8f, 18f, 0f) * Vector3.forward).normalized;
            target.transform.position = weapon.Muzzle.position + targetDirection * 32f;
            target.AddComponent<Rigidbody>().useGravity = false;
            target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);
            computer.RefreshTargets();
            SelectTarget(computer, target.transform);
            computer.SetAutoFireEnabled(true);

            float yawBefore = weapon.LastAppliedYawDegrees;
            float pitchBefore = weapon.LastAppliedPitchDegrees;
            bool fired = false;
            for (int i = 0; i < 90; i++)
            {
                InvokeMethod(computer, "Update");
                fired = weapon.LastFireResult.fired || fired;
                if (fired)
                {
                    break;
                }
            }

            Assert.That(Mathf.Abs(weapon.LastAppliedYawDegrees - yawBefore), Is.GreaterThan(0.5f));
            Assert.That(Mathf.Abs(weapon.LastAppliedPitchDegrees - pitchBefore), Is.GreaterThan(0.1f));
            Assert.True(fired, computer.TurretStatusLabel);
            Assert.That(Vector3.Distance(weapon.LastRecoilPositionWorld, weapon.Muzzle.position), Is.LessThan(0.25f));
            Assert.True(weapon.LastFireResult.muzzleVisualEmitted || weapon.LastFireResult.tracerVisualEmitted);
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
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

    private static void SelectTarget(PrototypeWeaponComputer computer, Transform targetTransform)
    {
        Assert.NotNull(computer);
        for (int i = 0; i < computer.AvailableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = computer.AvailableTargets[i];
            if (target != null && target.TargetTransform == targetTransform)
            {
                computer.ToggleTarget(target);
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

    private static void AssertSafeFunctionalSocketScale(Transform socket)
    {
        Assert.NotNull(socket);
        Vector3 scale = socket.lossyScale;
        Assert.That(scale.x, Is.EqualTo(1f).Within(0.02f), socket.name);
        Assert.That(scale.y, Is.EqualTo(1f).Within(0.02f), socket.name);
        Assert.That(scale.z, Is.EqualTo(1f).Within(0.02f), socket.name);
    }

    private static void AssertFinite(Vector3 value, string label)
    {
        Assert.True(IsFinite(value.x), label + ".x");
        Assert.True(IsFinite(value.y), label + ".y");
        Assert.True(IsFinite(value.z), label + ".z");
    }

    private static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
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
