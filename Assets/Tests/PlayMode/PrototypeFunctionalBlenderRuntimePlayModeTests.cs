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
            Transform activeImportedVisual = FindActiveImportedVisual(importedVisual);
            Assert.NotNull(activeImportedVisual);
            Assert.That(activeImportedVisual.localScale.x, Is.GreaterThanOrEqualTo(50f));
            Assert.That(CountVisibleShipMeshRenderers(activeImportedVisual), Is.GreaterThan(20));
            Assert.That(CombinedVisibleShipMeshBounds(activeImportedVisual).size.magnitude, Is.GreaterThan(1f));
            SimpleFollowCamera followCamera = Camera.main != null ? Camera.main.GetComponent<SimpleFollowCamera>() : null;
            Assert.NotNull(followCamera);
            InvokeMethod(followCamera, "LateUpdate");
            Assert.That(followCamera.VisualBoundsRadius, Is.LessThan(6f));
            Assert.That(followCamera.VisualBoundsRendererCount, Is.InRange(20, 70));
            Assert.That(followCamera.EffectiveDistance, Is.LessThan(30f));
            AssertImportedShipProjectsToReadableViewport(Camera.main, activeImportedVisual);
            Assert.Null(ship.transform.Find("Muzzle"));
            Assert.Null(ship.transform.Find("EngineNozzle"));

            EngineVfxController engine = ship.GetComponent<EngineVfxController>();
            MainThrusterBank mainThruster = ship.GetComponent<MainThrusterBank>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            PrototypeWeaponComputer computer = ship.GetComponent<PrototypeWeaponComputer>();
            PrototypeTurretWeapon weapon = ship.GetComponentInChildren<PrototypeTurretWeapon>(true);
            PrototypeWeaponComputerPanel weaponPanel = Camera.main != null ? Camera.main.GetComponent<PrototypeWeaponComputerPanel>() : null;
            ShipStats stats = ship.GetComponent<ShipStats>();

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
            Assert.NotNull(weaponPanel);
            Assert.False(weaponPanel.IsWindowVisible);
            Assert.True(weaponPanel.IsWindowCollapsed);
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
                Assert.That(CountVisibleShipMeshRenderers(activeImportedVisual), Is.GreaterThan(20));
            }

            float finalForwardSpeed = Vector3.Dot(body.linearVelocity, ship.transform.forward);
            Assert.That(finalForwardSpeed, Is.GreaterThan(initialForwardSpeed + 0.5f));
            Assert.That(maxFrameJump, Is.LessThan(25f));
            Assert.That(maxAngularVelocity, Is.LessThan(5f));
            Assert.That(mainThruster.LastAppliedThrust, Is.GreaterThan(0f));
            Transform engineParticles = engine.Nozzle.Find("EngineParticleSystem");
            Assert.NotNull(engineParticles);
            Assert.True(engineParticles.GetComponent<ParticleSystem>().isPlaying);
            InvokeMethod(followCamera, "LateUpdate");
            AssertImportedShipProjectsToReadableViewport(Camera.main, activeImportedVisual);

            controller.CutMainThrottle();
            controller.ResetAngularVelocity();
            controller.PulseRcsTranslation(Vector3.up);
            InvokeMethod(controller, "FixedUpdate");
            Physics.Simulate(Time.fixedDeltaTime);
            Assert.That(rcs.ActiveNozzleCount, Is.GreaterThan(0));
            Assert.NotNull(FindActiveRcsVfxNearImportedNozzle(ship.transform));
            Assert.That(CombinedVisibleShipMeshBounds(activeImportedVisual).size.magnitude, Is.GreaterThan(1f));
            Assert.That(body.angularVelocity.magnitude, Is.LessThan(5f));
            InvokeMethod(followCamera, "LateUpdate");
            AssertImportedShipProjectsToReadableViewport(Camera.main, activeImportedVisual);

            GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube);
            target.name = "RuntimeWeaponTarget";
            Vector3 targetDirection = weapon.Mount.MountRoot.TransformDirection(Quaternion.Euler(8f, 18f, 0f) * Vector3.forward).normalized;
            target.transform.position = weapon.Muzzle.position + targetDirection * 32f;
            target.AddComponent<Rigidbody>().useGravity = false;
            target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);
            SetPrivateField(stats, "hitChance", 1f);
            SetPrivateField(stats, "projectileSpreadDegrees", 0f);
            computer.RefreshTargets();
            SelectTarget(computer, target.transform);
            computer.SetAutoFireEnabled(false);

            float yawBefore = weapon.LastAppliedYawDegrees;
            float pitchBefore = weapon.LastAppliedPitchDegrees;
            Transform barrel = FindDescendant(ship.transform, "DEMO_Scout_Mk1_GEO_Gun_Barrel");
            Transform yawMesh = FindDescendant(ship.transform, "DEMO_Scout_Mk1_GEO_Gun_Mount_Base");
            Assert.NotNull(barrel);
            Assert.NotNull(yawMesh);
            Assert.True(barrel.IsChildOf(weapon.Mount.PitchPivot), barrel.parent != null ? barrel.parent.name : "no parent");
            Assert.True(yawMesh.IsChildOf(weapon.Mount.YawPivot), yawMesh.parent != null ? yawMesh.parent.name : "no parent");
            Quaternion barrelRotationBefore = barrel.rotation;
            Quaternion yawMeshRotationBefore = yawMesh.rotation;
            for (int i = 0; i < 30; i++)
            {
                InvokeMethod(computer, "Update");
            }

            Assert.That(Mathf.Abs(weapon.LastAppliedYawDegrees - yawBefore), Is.GreaterThan(0.5f));
            Assert.That(Mathf.Abs(weapon.LastAppliedPitchDegrees - pitchBefore), Is.GreaterThan(0.1f));
            Assert.That(Quaternion.Angle(yawMeshRotationBefore, yawMesh.rotation), Is.GreaterThan(0.5f));
            Assert.That(Quaternion.Angle(barrelRotationBefore, barrel.rotation), Is.GreaterThan(0.1f));
            Assert.False(weapon.LastFireResult.fired);

            GameObject fireBlocker = GameObject.CreatePrimitive(PrimitiveType.Cube);
            fireBlocker.name = "RuntimeOwnHullFireBlocker";
            fireBlocker.transform.SetParent(ship.transform, true);
            fireBlocker.transform.position = weapon.Muzzle.position + weapon.Muzzle.forward * 0.35f;
            fireBlocker.transform.localScale = Vector3.one * 0.25f;
            Physics.SyncTransforms();
            computer.SetAutoFireEnabled(true);
            for (int i = 0; i < 10; i++)
            {
                InvokeMethod(computer, "Update");
            }

            Assert.False(weapon.LastFireResult.fired);
            Assert.That(weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.LineBlocked));
            Object.DestroyImmediate(fireBlocker);
            Physics.SyncTransforms();

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

            Assert.True(fired, computer.TurretStatusLabel);
            Assert.That(Vector3.Distance(weapon.LastMuzzleWorldPosition, weapon.Muzzle.position), Is.LessThan(0.25f));
            Assert.That(Vector3.Angle(weapon.LastFireResult.directionWorld, weapon.Muzzle.forward), Is.LessThan(2f));
            Assert.That(Vector3.Distance(weapon.LastRecoilPositionWorld, body.worldCenterOfMass), Is.LessThan(0.25f));
            Assert.That(weapon.LastRecoilAngularImpulseWorld.magnitude, Is.LessThan(0.01f));
            Assert.True(weapon.LastFireResult.muzzleVisualEmitted || weapon.LastFireResult.tracerVisualEmitted);

            Vector3 outsideArcTarget = weapon.Muzzle.position
                + weapon.Mount.MountRoot.TransformDirection(Quaternion.Euler(0f, 80f, 0f) * Vector3.forward).normalized * 32f;
            PrototypeTurretFireStatus outsideArcStatus = weapon.EvaluateFireStatus(outsideArcTarget);
            Assert.False(outsideArcStatus.canFire);
            Assert.That(outsideArcStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.OutOfArc));
            Assert.That(outsideArcStatus.requestedYawDegrees, Is.GreaterThan(stats.YawLimitRightDegrees));
            Assert.That(outsideArcStatus.appliedYawDegrees, Is.EqualTo(stats.YawLimitRightDegrees).Within(0.5f));
            bool outsideArcFired = weapon.TryFireAt(outsideArcTarget);
            Assert.False(outsideArcFired);
            Assert.That(weapon.LastFireStatus.blockReason, Is.EqualTo(PrototypeTurretFireBlockReason.OutOfArc));
            Assert.That(weapon.LastFireStatus.appliedYawDegrees, Is.EqualTo(stats.YawLimitRightDegrees).Within(0.5f));
            InvokeMethod(followCamera, "LateUpdate");
            AssertImportedShipProjectsToReadableViewport(Camera.main, activeImportedVisual);
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void BootstrapPlayModeRegistersDefaultTargetForWeaponComputer()
    {
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");

        GameObject host = new GameObject("PrototypeBootstrapPlayModeHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
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
        Assert.That(PrototypeWeaponTarget.LastDiscoveryUsedDebugFallback, Is.False);
        SelectTarget(computer, target.transform);
        Assert.AreSame(target.transform, computer.ActiveTargetTransform);
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

    private static Transform FindActiveImportedVisual(Transform importedVisualRoot)
    {
        Assert.NotNull(importedVisualRoot);
        for (int i = 0; i < importedVisualRoot.childCount; i++)
        {
            Transform child = importedVisualRoot.GetChild(i);
            if (child != null && child.gameObject.activeInHierarchy)
            {
                return child;
            }
        }

        return null;
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

    private static void AssertImportedShipProjectsToReadableViewport(Camera camera, Transform activeImportedVisual)
    {
        Assert.NotNull(camera);
        Bounds bounds = CombinedVisibleShipMeshBounds(activeImportedVisual);
        Rect viewportRect = ProjectBoundsToViewport(camera, bounds, out int inFrontCornerCount);
        Assert.That(inFrontCornerCount, Is.EqualTo(8));
        Assert.That(viewportRect.width, Is.GreaterThan(0.075f));
        Assert.That(viewportRect.height, Is.GreaterThan(0.075f));
        Assert.That(viewportRect.width * viewportRect.height, Is.GreaterThan(0.008f));
        Assert.That(viewportRect.width, Is.LessThan(0.6f));
        Assert.That(viewportRect.height, Is.LessThan(0.6f));
        Assert.That(viewportRect.width * viewportRect.height, Is.LessThan(0.25f));
        Assert.That(viewportRect.center.x, Is.InRange(0.3f, 0.7f));
        Assert.That(viewportRect.center.y, Is.InRange(0.25f, 0.75f));
    }

    private static Rect ProjectBoundsToViewport(Camera camera, Bounds bounds, out int inFrontCornerCount)
    {
        Vector3 min = bounds.min;
        Vector3 max = bounds.max;
        Vector3[] corners =
        {
            new Vector3(min.x, min.y, min.z),
            new Vector3(min.x, min.y, max.z),
            new Vector3(min.x, max.y, min.z),
            new Vector3(min.x, max.y, max.z),
            new Vector3(max.x, min.y, min.z),
            new Vector3(max.x, min.y, max.z),
            new Vector3(max.x, max.y, min.z),
            new Vector3(max.x, max.y, max.z)
        };

        float minX = 1f;
        float minY = 1f;
        float maxX = 0f;
        float maxY = 0f;
        inFrontCornerCount = 0;
        for (int i = 0; i < corners.Length; i++)
        {
            Vector3 viewport = camera.WorldToViewportPoint(corners[i]);
            if (viewport.z <= 0f)
            {
                continue;
            }

            inFrontCornerCount++;
            minX = Mathf.Min(minX, Mathf.Clamp01(viewport.x));
            minY = Mathf.Min(minY, Mathf.Clamp01(viewport.y));
            maxX = Mathf.Max(maxX, Mathf.Clamp01(viewport.x));
            maxY = Mathf.Max(maxY, Mathf.Clamp01(viewport.y));
        }

        return inFrontCornerCount > 0
            ? Rect.MinMaxRect(minX, minY, maxX, maxY)
            : Rect.zero;
    }

    private static bool IsVisibleShipMeshRenderer(Renderer renderer)
    {
        if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
        {
            return false;
        }

        string name = renderer.gameObject.name;
        return name.StartsWith("DEMO_", System.StringComparison.Ordinal)
            && name.IndexOf("_GEO_", System.StringComparison.OrdinalIgnoreCase) >= 0
            && name.IndexOf("VFX", System.StringComparison.OrdinalIgnoreCase) < 0
            && name.IndexOf("Marker", System.StringComparison.OrdinalIgnoreCase) < 0;
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
