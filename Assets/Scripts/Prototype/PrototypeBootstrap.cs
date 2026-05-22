using System.Collections.Generic;
using UnityEngine;

public class PrototypeBootstrap : MonoBehaviour
{
    [SerializeField] private bool buildOnStart = true;
    [SerializeField] private PrototypeShipConfig shipConfig;
    [SerializeField] private PrototypeShipBuildMode buildMode = PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault;
    [SerializeField] private bool allowGeneratedFallbackWhenImportedAssetMissing = true;
    [SerializeField] private int selectedVariantIndex;
    [SerializeField] private bool addOrientationMarkers = false;
    [SerializeField] private Vector3 shipStartPosition = new Vector3(0f, 0.5f, 0f);
    [SerializeField] private bool spawnTestTarget = true;
    [SerializeField] private bool buildPveArena = true;
    [SerializeField] private Vector3 testTargetPosition = new Vector3(0f, 0.5f, 42f);
    [SerializeField] private Vector3 testTargetScale = new Vector3(4f, 4f, 0.6f);
    [SerializeField] private bool buildTestEnvironment = true;

    private const string PrototypeRootName = "PrototypeShip";
    private const string PrototypeDockingApproachTargetName = "PrototypeDockingApproachTarget";
    private const float PrototypeDockingApproachTargetDistance = 2.2f;
    private const float DefaultRcsBlockThrust = 6500f;
    private const float DirectionalLightMinIntensity = 1.0f;
    private const float DirectionalLightMaxIntensity = 1.45f;
    private static readonly Color MainThrusterColor = PrototypeModuleColorPalette.MainThruster;
    private static readonly Color MainThrusterRingColor = PrototypeModuleColorPalette.MainThrusterNozzleRing;
    private static readonly Color RcsBlockColor = PrototypeModuleColorPalette.RcsBlock;
    private static readonly Color GunColor = PrototypeModuleColorPalette.Gun;
    private static readonly Color RcsVfxColor = PrototypeModuleColorPalette.RcsVfx;
    private static readonly Color FuelTankCueColor = PrototypeModuleColorPalette.FuelTankCue;

    private PrototypeShipVariant[] runtimeVariants;

    public PrototypeShipVariant[] BuiltInVariants
    {
        get
        {
            EnsureRuntimeVariants();
            return runtimeVariants;
        }
    }

    public int SelectedVariantIndex => Mathf.Clamp(selectedVariantIndex, 0, Mathf.Max(0, BuiltInVariants.Length - 1));
    public PrototypeShipVariant SelectedVariant => BuiltInVariants.Length > 0 ? BuiltInVariants[SelectedVariantIndex] : PrototypeShipVariant.Baseline();
    public string SelectedVariantName => SelectedVariant != null ? SelectedVariant.DisplayName : "Baseline Balanced";
    public PrototypeShipBuildMode BuildMode => buildMode;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void RuntimeBootstrap()
    {
        if (!Application.isPlaying)
        {
            return;
        }

        if (Object.FindAnyObjectByType<PrototypeBootstrap>() == null)
        {
            var bootstrap = new GameObject("PrototypeBootstrap");
            bootstrap.AddComponent<PrototypeBootstrap>();
            Object.DontDestroyOnLoad(bootstrap);
        }
    }

    private void Start()
    {
        if (buildOnStart)
        {
            BuildPrototype();
        }
    }

    public void BuildPrototype()
    {
        BuildPrototype(SelectedVariant);
    }

    public void BuildPrototype(PrototypeShipVariant variant)
    {
        variant = variant ?? PrototypeShipVariant.Baseline();
        int variantIndex = FindVariantIndex(variant.VariantId);
        selectedVariantIndex = variantIndex >= 0 ? variantIndex : 0;

        PrototypeShipLayout layout = variant.Layout ?? PrototypeShipLayout.Baseline();
        var ship = GameObject.Find(PrototypeRootName);
        if (ship == null)
        {
            ship = new GameObject(PrototypeRootName);
            ship.transform.position = shipStartPosition;
        }

        ClearGeneratedShipChildren(ship.transform);

        var stats = GetOrAddComponent<ShipStats>(ship);
        if (shipConfig != null)
        {
            stats.ApplyConfig(shipConfig);
        }
        else
        {
            stats.ApplyVariant(variant);
        }

        var shipRigidbody = GetOrAddComponent<Rigidbody>(ship);
        shipRigidbody.useGravity = false;
        shipRigidbody.mass = stats.CurrentMass;
        shipRigidbody.linearDamping = 0f;
        shipRigidbody.angularDamping = 0f;
        shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;

        var physicsCore = GetOrAddComponent<ShipPhysicsCore>(ship);
        physicsCore.Configure(shipRigidbody);

        bool useGeneratedFallback = buildMode == PrototypeShipBuildMode.GeneratedPrimitiveFallback;
        MainThrusterModule[] mainThrusterModules = new MainThrusterModule[0];
        Transform primaryMainNozzle = null;
        PrototypeFunctionalShipBinder.BindReport functionalBindReport = null;

        if (!useGeneratedFallback)
        {
            PrototypeFunctionalShipBinder functionalBinder = GetOrAddComponent<PrototypeFunctionalShipBinder>(ship);
            functionalBinder.Configure(buildMode);
            functionalBindReport = functionalBinder.BindNow();
            useGeneratedFallback = functionalBindReport == null || !functionalBindReport.hasRequiredFunctionalSockets;
            if (useGeneratedFallback)
            {
                string warning = functionalBindReport != null && functionalBindReport.missingRequiredSockets.Count > 0
                    ? string.Join(", ", functionalBindReport.missingRequiredSockets)
                    : "unknown imported binding failure";
                Debug.LogWarning("Imported functional ship binding failed (" + warning + ").");
                if (!allowGeneratedFallbackWhenImportedAssetMissing)
                {
                    useGeneratedFallback = false;
                }
                else
                {
                    ClearGeneratedShipChildren(ship.transform);
                }
            }
        }

        if (useGeneratedFallback)
        {
            EnsureModuleParts(ship.transform, layout);
            mainThrusterModules = EnsureMainThrusters(ship.transform, layout, stats, shipRigidbody, physicsCore, variant, out primaryMainNozzle);
            EnsureGunModules(ship.transform, layout);
            EnsureRcsThrusters(ship.transform, layout, variant);
            PrototypeModuleMassLayout.ConfigureGeneratedPrototypeDescriptors(ship.transform, stats, layout);
            var weaponBinder = GetOrAddComponent<PrototypeShipKitWeaponBinder>(ship);
            weaponBinder.Configure(ship.transform, ship.transform, true, true);
            weaponBinder.BindNow();
            PrototypeShipHardpointBinder.EnsureGeneratedFallbackHardpoints(ship.transform);
            var hardpointBinder = GetOrAddComponent<PrototypeShipHardpointBinder>(ship);
            hardpointBinder.Configure(ship.transform, true, true);
            hardpointBinder.BindNow();
        }

        stats.ApplyMassProperties(shipRigidbody);
        EnsureCameraAnchor(ship.transform, shipRigidbody);
        RemoveRootFallbackChild(ship.transform, "Muzzle");
        RemoveRootFallbackChild(ship.transform, "EngineNozzle");

        var gun = GetOrAddComponent<GunModule>(ship);
        var engine = GetOrAddComponent<EngineVfxController>(ship);
        var mainThruster = GetOrAddComponent<MainThrusterBank>(ship);
        var rcs = GetOrAddComponent<RcsThrusterController>(ship);
        var weaponComputer = GetOrAddComponent<PrototypeWeaponComputer>(ship);
        if (shipConfig != null)
        {
            gun.ApplyConfig(shipConfig);
            mainThruster.ApplyConfig(shipConfig);
            rcs.ApplyConfig(shipConfig);
        }
        else
        {
            gun.ApplySettings(variant.Gun);
            mainThruster.ApplySettings(variant.MainThruster);
            rcs.ApplySettings(variant.Rcs);
        }

        var controller = GetOrAddComponent<PlayerShipController>(ship);
        var waypointManager = GetOrAddComponent<PrototypeWaypointManager>(ship);
        waypointManager.EnsureDefaultWaypoints();
        var waypointAutopilot = GetOrAddComponent<PrototypeWaypointAutopilot>(ship);
        var momentumAssist = GetOrAddComponent<PrototypeMomentumAssist>(ship);

        if (useGeneratedFallback)
        {
            mainThruster.Configure(mainThrusterModules, shipRigidbody, stats, physicsCore);
            engine.SetAllowFallbackNozzle(true);
            engine.ConfigureNozzle(primaryMainNozzle);
            rcs.SetUseImportedFunctionalSockets(false);
            rcs.ConfigureThrusters(
                ship.transform.Find("RCS_Top"),
                ship.transform.Find("RCS_Bottom"),
                ship.transform.Find("RCS_Left"),
                ship.transform.Find("RCS_Right"),
                null,
                null,
                shipRigidbody,
                physicsCore);
        }
        else
        {
            gun.SetAllowMuzzleFallback(false);
            engine.SetAllowFallbackNozzle(false);
            rcs.SetUseImportedFunctionalSockets(true);
            rcs.MarkNozzlesDirty();
            rcs.RefreshNozzles();
            mainThruster.Configure(ship.GetComponents<MainThrusterModule>(), shipRigidbody, stats, physicsCore);
        }

        waypointAutopilot.Bind(waypointManager, controller, stats, shipRigidbody);
        momentumAssist.Bind(controller, shipRigidbody, stats);
        PrototypeTurretWeapon turretWeapon = ship.GetComponentInChildren<PrototypeTurretWeapon>();
        weaponComputer.Bind(ship.transform, stats, turretWeapon);
        controller.ResetStartupFlightControls(shipStartPosition, Quaternion.identity);
        waypointAutopilot.ResetForBootstrap();
        momentumAssist.ResetForBootstrap();
        DockingPort dockingApproachTargetPort = ConfigureDockingApproachAssist(ship, controller, shipRigidbody);

        if (gun == null || engine == null)
        {
            Debug.LogWarning("Prototype ship bootstrap could not initialize all optional modules.");
        }

        if (addOrientationMarkers)
        {
            EnsureOrientationMarkers(ship.transform);
        }
        else
        {
            RemoveOrientationMarkers(ship.transform);
        }

        if (spawnTestTarget)
        {
            SpawnTestTarget();
        }

        if (buildPveArena)
        {
            EnsurePveArena();
        }

        PrototypeTestEnvironment testEnvironment = buildTestEnvironment ? EnsureTestEnvironment() : null;
        SetupMainCamera(ship.transform, stats, shipRigidbody, testEnvironment, dockingApproachTargetPort);
        EnsureSceneDirectionalLight();
    }

    public void SelectVariant(int index)
    {
        selectedVariantIndex = Mathf.Clamp(index, 0, Mathf.Max(0, BuiltInVariants.Length - 1));
    }

    public void SelectNextVariant()
    {
        if (BuiltInVariants.Length == 0)
        {
            selectedVariantIndex = 0;
            return;
        }

        selectedVariantIndex = (SelectedVariantIndex + 1) % BuiltInVariants.Length;
    }

    public void SelectPreviousVariant()
    {
        if (BuiltInVariants.Length == 0)
        {
            selectedVariantIndex = 0;
            return;
        }

        selectedVariantIndex = (SelectedVariantIndex + BuiltInVariants.Length - 1) % BuiltInVariants.Length;
    }

    public void SpawnSelectedVariant()
    {
        BuildPrototype(SelectedVariant);
    }

    public void BuildBuiltInVariant(int index)
    {
        SelectVariant(index);
        SpawnSelectedVariant();
    }

    public void BuildSelectedVariant()
    {
        SpawnSelectedVariant();
    }

    public void SetBuildMode(PrototypeShipBuildMode mode, bool rebuild)
    {
        buildMode = mode;
        if (rebuild)
        {
            BuildPrototype();
        }
    }

    public void SpawnTestTarget()
    {
        EnsureTestTarget();
    }

    public void RebuildTestEnvironment()
    {
        EnsureTestEnvironment();
    }

    public void ResetPveArena()
    {
        EnsurePveArena().ResetArena();
    }

    private void EnsureRuntimeVariants()
    {
        if (runtimeVariants == null || runtimeVariants.Length == 0)
        {
            runtimeVariants = PrototypeShipVariant.BuiltIns();
        }
    }

    private int FindVariantIndex(string variantId)
    {
        PrototypeShipVariant[] variants = BuiltInVariants;
        for (int i = 0; i < variants.Length; i++)
        {
            if (variants[i] != null && variants[i].VariantId == variantId)
            {
                return i;
            }
        }

        return -1;
    }

    private static T GetOrAddComponent<T>(GameObject target) where T : Component
    {
        var component = target.GetComponent<T>();
        if (component == null)
        {
            component = target.AddComponent<T>();
        }

        return component;
    }

    private static void ClearGeneratedShipChildren(Transform ship)
    {
        if (ship == null)
        {
            return;
        }

        for (int i = ship.childCount - 1; i >= 0; i--)
        {
            DestroyGameObjectImmediate(ship.GetChild(i).gameObject);
        }

        MainThrusterModule[] existingThrusters = ship.GetComponents<MainThrusterModule>();
        for (int i = 0; i < existingThrusters.Length; i++)
        {
            DestroyComponentImmediate(existingThrusters[i]);
        }
    }

    private static void RemoveRootFallbackChild(Transform parent, string childName)
    {
        var child = parent.Find(childName);
        if (child == null)
        {
            return;
        }

        DestroyGameObject(child.gameObject);
    }

    private static GameObject EnsureModuleParts(Transform ship, PrototypeShipLayout layout)
    {
        PrototypeModuleLayoutEntry[] modules = layout != null ? layout.Modules : PrototypeShipLayout.Baseline().Modules;
        for (int i = 0; i < modules.Length; i++)
        {
            PrototypeModuleLayoutEntry moduleEntry = modules[i];
            GameObject moduleObject = BuildModulePart(
                ship,
                moduleEntry.ModuleId,
                PrimitiveType.Cube,
                moduleEntry.LocalPosition,
                Quaternion.Euler(moduleEntry.LocalEulerAngles),
                moduleEntry.LocalScale,
                ColorForModule(moduleEntry.MassRole),
                moduleEntry.MassRole,
                moduleEntry.ModuleId);
            if (moduleEntry.MassRole == PrototypeModuleMassRole.FuelTank)
            {
                EnsureFuelTankCue(moduleObject, moduleEntry.LocalScale);
            }
        }

        return ship.gameObject;
    }

    private static MainThrusterModule[] EnsureMainThrusters(Transform ship, PrototypeShipLayout layout, ShipStats stats, Rigidbody shipRigidbody, ShipPhysicsCore physicsCore, PrototypeShipVariant variant, out Transform primaryNozzle)
    {
        DestroyChildIfExists(ship, "Engine");

        PrototypeMainThrusterLayoutEntry[] entries = layout != null ? layout.MainThrusters : PrototypeShipLayout.Baseline().MainThrusters;
        var modules = new List<MainThrusterModule>(entries.Length);
        primaryNozzle = null;
        for (int i = 0; i < entries.Length; i++)
        {
            PrototypeMainThrusterLayoutEntry entry = entries[i];
            var gimbal = BuildModulePart(
                ship,
                entry.ModuleId,
                PrimitiveType.Cube,
                entry.LocalPosition,
                Quaternion.Euler(entry.LocalEulerAngles),
                entry.LocalScale,
                MainThrusterColor,
                PrototypeModuleMassRole.Engine,
                entry.ModuleId);
            var nozzle = gimbal.transform.Find(entry.NozzleId);
            if (nozzle == null)
            {
                var nozzleObject = new GameObject(entry.NozzleId);
                nozzleObject.transform.SetParent(gimbal.transform, false);
                nozzle = nozzleObject.transform;
            }

            nozzle.localPosition = entry.NozzleLocalPosition;
            nozzle.localRotation = Quaternion.Euler(entry.NozzleLocalEulerAngles);
            EnsureMainThrusterNozzleRing(nozzle);
            if (primaryNozzle == null)
            {
                primaryNozzle = nozzle;
            }

            var mainThermal = EnsureThermalModule(
                gimbal,
                "Main Thruster",
                180f,
                85f,
                450f,
                6f,
                120f,
                true,
                PrototypeThermalModule.OverheatEffect.DisableModule);
            var module = ship.gameObject.AddComponent<MainThrusterModule>();
            module.Configure(nozzle, shipRigidbody, stats, physicsCore, mainThermal);
            module.ApplySettings(variant != null ? variant.MainThruster : PrototypeMainThrusterSettings.Default);
            modules.Add(module);
        }

        return modules.ToArray();
    }

    private static void EnsureGunModules(Transform ship, PrototypeShipLayout layout)
    {
        PrototypeGunLayoutEntry[] guns = layout != null ? layout.Guns : PrototypeShipLayout.Baseline().Guns;
        for (int i = 0; i < guns.Length; i++)
        {
            PrototypeGunLayoutEntry gunEntry = guns[i];
            var gun = BuildModulePart(
                ship,
                gunEntry.ModuleId,
                PrimitiveType.Cube,
                gunEntry.LocalPosition,
                Quaternion.Euler(gunEntry.LocalEulerAngles),
                gunEntry.LocalScale,
                GunColor,
                PrototypeModuleMassRole.Gun,
                gunEntry.ModuleId);
            string markerSuffix = SanitizeMarkerSuffix(gunEntry.ModuleId);
            Transform baseMarker = EnsureChild(gun.transform, "WEAPON_TURRET_BASE_" + markerSuffix);
            Transform yawMarker = EnsureChild(baseMarker, "WEAPON_TURRET_YAW_" + markerSuffix);
            Transform pitchMarker = EnsureChild(yawMarker, "WEAPON_TURRET_PITCH_" + markerSuffix);
            Transform muzzle = EnsureChild(pitchMarker, "WEAPON_MUZZLE_" + markerSuffix);
            Transform legacyMuzzle = EnsureChild(pitchMarker, gunEntry.MuzzleId);

            baseMarker.localPosition = Vector3.zero;
            baseMarker.localRotation = Quaternion.identity;
            yawMarker.localPosition = Vector3.zero;
            yawMarker.localRotation = Quaternion.identity;
            pitchMarker.localPosition = Vector3.zero;
            pitchMarker.localRotation = Quaternion.identity;
            muzzle.localPosition = gunEntry.MuzzleLocalPosition;
            muzzle.localRotation = Quaternion.Euler(gunEntry.MuzzleLocalEulerAngles);
            legacyMuzzle.localPosition = gunEntry.MuzzleLocalPosition;
            legacyMuzzle.localRotation = Quaternion.Euler(gunEntry.MuzzleLocalEulerAngles);
            EnsureThermalModule(
                gun,
                "Gun",
                12f,
                18f,
                160f,
                4f,
                95f,
                true,
                PrototypeThermalModule.OverheatEffect.ThrottleToHalf);
        }
    }

    private static Transform EnsureChild(Transform parent, string childName)
    {
        var child = parent.Find(childName);
        if (child != null)
        {
            return child;
        }

        var childObject = new GameObject(childName);
        childObject.transform.SetParent(parent, false);
        return childObject.transform;
    }

    private static string SanitizeMarkerSuffix(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "PRIMARY";
        }

        return value.Trim().Replace(' ', '_').ToUpperInvariant();
    }

    private static void EnsureRcsThrusters(Transform ship, PrototypeShipLayout layout, PrototypeShipVariant variant)
    {
        DestroyChildIfExists(ship, "RCS_Up");
        DestroyChildIfExists(ship, "RCS_Down");
        DestroyChildIfExists(ship, "RCS_Forward");
        DestroyChildIfExists(ship, "RCS_Back");

        PrototypeRcsBlockLayoutEntry[] blocks = layout != null ? layout.RcsBlocks : PrototypeShipLayout.Baseline().RcsBlocks;
        PrototypeRcsSettings settings = variant != null ? variant.Rcs : PrototypeRcsSettings.Default;
        for (int i = 0; i < blocks.Length; i++)
        {
            PrototypeRcsBlockLayoutEntry block = blocks[i];
            BuildRcsBlock(ship, block.BlockId, block.LocalPosition, block.LocalScale, block.BlockedLocalDirection, settings);
        }
    }

    private static void BuildRcsBlock(Transform ship, string blockName, Vector3 localPosition, Vector3 localScale, Vector3 blockedDirection, PrototypeRcsSettings settings)
    {
        var block = BuildModulePart(
            ship,
            blockName,
            PrimitiveType.Cube,
            localPosition,
            Quaternion.identity,
            localScale,
            RcsBlockColor,
            PrototypeModuleMassRole.RcsBlock,
            blockName);
        var thrusterBlock = GetOrAddComponent<RcsThrusterBlock>(block);
        settings.Clamp();
        thrusterBlock.ApplySettings(settings.blockThrust > 0f ? settings : PrototypeRcsSettings.Default);
        thrusterBlock.ConfigureDefault(DefaultRcsBlockThrust);

        Vector3[] directions = { Vector3.forward, Vector3.back, Vector3.left, Vector3.right, Vector3.up, Vector3.down };
        for (int i = 0; i < directions.Length; i++)
        {
            Vector3 direction = directions[i];
            if (Vector3.Dot(direction, blockedDirection) > 0.95f)
            {
                continue;
            }

            EnsureRcsNozzle(block.transform, blockName, DirectionName(direction), direction);
        }
    }

    private static void EnsureRcsNozzle(Transform block, string blockName, string directionName, Vector3 localDirection)
    {
        string nozzleName = "RCS_Nozzle_" + blockName + "_" + directionName;
        var nozzle = block.Find(nozzleName);
        if (nozzle == null)
        {
            var nozzleObject = new GameObject(nozzleName);
            nozzleObject.transform.SetParent(block, false);
            nozzle = nozzleObject.transform;
        }

        nozzle.localPosition = localDirection.normalized * 0.38f;
        nozzle.localRotation = LookRotationLocal(localDirection.normalized);

        var vfx = nozzle.Find("VFX");
        if (vfx == null)
        {
            var vfxObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            vfxObject.name = "VFX";
            vfxObject.transform.SetParent(nozzle, false);
            vfx = vfxObject.transform;
        }

        vfx.localPosition = Vector3.back * 1.25f;
        vfx.localRotation = Quaternion.Euler(0f, 180f, 0f);
        vfx.localScale = new Vector3(0.12f, 0.12f, 0.16f);
        RemoveCollider(vfx.gameObject);
        ApplyMaterialColor(vfx.gameObject, RcsVfxColor, true);
        vfx.gameObject.SetActive(false);
    }

    private static void EnsureMainThrusterNozzleRing(Transform nozzle)
    {
        if (nozzle == null)
        {
            return;
        }

        const float RingRadius = 0.21f;
        const float RingThickness = 0.035f;
        var ring = nozzle.Find("NozzleRing");
        if (ring == null)
        {
            var ringObject = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ringObject.name = "NozzleRing";
            ringObject.transform.SetParent(nozzle, false);
            RemoveCollider(ringObject);
            ring = ringObject.transform;
        }

        ring.localPosition = Vector3.zero;
        ring.localRotation = Quaternion.Euler(90f, 0f, 0f);
        ring.localScale = new Vector3(RingRadius, RingThickness, RingRadius);
        ApplyMaterialColor(ring.gameObject, MainThrusterRingColor, true);
        ring.gameObject.SetActive(true);
    }

    private static void EnsureFuelTankCue(GameObject module, Vector3 moduleScale)
    {
        if (module == null)
        {
            return;
        }

        var cue = module.transform.Find("FuelCue");
        if (cue == null)
        {
            var cueObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cueObject.name = "FuelCue";
            cueObject.transform.SetParent(module.transform, false);
            RemoveCollider(cueObject);
            cue = cueObject.transform;
        }

        float cueHalfScale = Mathf.Min(moduleScale.x, moduleScale.y) * 0.26f;
        cueHalfScale = Mathf.Max(cueHalfScale, 0.07f);
        cue.localPosition = new Vector3(0f, moduleScale.y * 0.42f, moduleScale.z * -0.38f);
        cue.localRotation = Quaternion.identity;
        cue.localScale = new Vector3(cueHalfScale, cueHalfScale, cueHalfScale * 0.55f);
        ApplyMaterialColor(cue.gameObject, FuelTankCueColor, true);
        cue.gameObject.SetActive(true);
    }

    private static Quaternion LookRotationLocal(Vector3 localDirection)
    {
        Vector3 up = Mathf.Abs(Vector3.Dot(localDirection, Vector3.up)) > 0.9f ? Vector3.forward : Vector3.up;
        return Quaternion.LookRotation(localDirection, up);
    }

    private static string DirectionName(Vector3 direction)
    {
        if (direction == Vector3.forward) return "Forward";
        if (direction == Vector3.back) return "Back";
        if (direction == Vector3.left) return "Left";
        if (direction == Vector3.right) return "Right";
        if (direction == Vector3.up) return "Up";
        return "Down";
    }

    private static Color ColorForModule(PrototypeModuleMassRole role)
    {
        return PrototypeModuleColorPalette.ForMassRole(role);
    }

    private static GameObject BuildModulePart(Transform parent, string name, PrimitiveType type, Vector3 localPos, Quaternion localRot, Vector3 localScale, Color color)
    {
        return BuildModulePart(parent, name, type, localPos, localRot, localScale, color, PrototypeModuleMassRole.Custom, string.Empty);
    }

    private static GameObject BuildModulePart(
        Transform parent,
        string name,
        PrimitiveType type,
        Vector3 localPos,
        Quaternion localRot,
        Vector3 localScale,
        Color color,
        PrototypeModuleMassRole massRole,
        string gameplayRole)
    {
        var existing = parent.Find(name);
        GameObject go;
        if (existing != null)
        {
            go = existing.gameObject;
        }
        else
        {
            go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
        }

        go.transform.localPosition = localPos;
        go.transform.localRotation = localRot;
        go.transform.localScale = localScale;
        ApplyMaterialColor(go, color, false);
        var metadata = PrototypeShipPartVisualFactory.ResolveMetadata(name, localScale, massRole, gameplayRole);
        PrototypeShipPartVisualFactory.ApplyGeneratedVisual(go, metadata, color);
        return go;
    }

    private static PrototypeThermalModule EnsureThermalModule(
        GameObject target,
        string moduleName,
        float powerDrawKw,
        float heatGenerationPerSecond,
        float heatCapacity,
        float coolingRate,
        float maxTemperature,
        bool overheatEffectEnabled,
        PrototypeThermalModule.OverheatEffect overheatEffect)
    {
        var thermalModule = GetOrAddComponent<PrototypeThermalModule>(target);
        thermalModule.Configure(
            moduleName,
            thermalModule.SimulationEnabled,
            powerDrawKw,
            heatGenerationPerSecond,
            heatCapacity,
            coolingRate,
            maxTemperature,
            20f,
            overheatEffectEnabled,
            overheatEffect);
        return thermalModule;
    }

    private static void ApplyMaterialColor(GameObject go, Color color, bool emissive)
    {
        var renderer = go.GetComponent<Renderer>();
        if (renderer == null)
        {
            return;
        }

        Material material = Application.isPlaying ? renderer.material : renderer.sharedMaterial;
        if (material == null || (!Application.isPlaying && material.name == "Default-Material"))
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            material = new Material(shader == null ? Shader.Find("Standard") : shader);
            if (Application.isPlaying)
            {
                renderer.material = material;
            }
            else
            {
                renderer.sharedMaterial = material;
            }
        }

        material.color = color;
        if (emissive && material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * 1.25f);
            return;
        }
        if (material.HasProperty("_EmissionColor"))
        {
            material.SetColor("_EmissionColor", Color.black);
            material.DisableKeyword("_EMISSION");
        }
    }

    private static void EnsureOrientationMarkers(Transform ship)
    {
        var markerRoot = ship.Find("OrientationMarkers");
        if (markerRoot == null)
        {
            markerRoot = new GameObject("OrientationMarkers").transform;
            markerRoot.SetParent(ship, false);
        }

        CreateMarker(markerRoot, "Marker_Forward", PrototypeModuleColorPalette.MarkerForward, new Vector3(0f, 0f, 3.7f), new Vector3(0.08f, 0.08f, 1.2f));
        CreateMarker(markerRoot, "Marker_Right", PrototypeModuleColorPalette.MarkerRight, new Vector3(1.5f, 0f, 0f), new Vector3(1.2f, 0.08f, 0.08f));
        CreateMarker(markerRoot, "Marker_Up", PrototypeModuleColorPalette.MarkerUp, new Vector3(0f, 1.3f, 0f), new Vector3(0.08f, 1.1f, 0.08f));
    }

    private static void RemoveOrientationMarkers(Transform ship)
    {
        if (ship == null)
        {
            return;
        }

        var markerRoot = ship.Find("OrientationMarkers");
        if (markerRoot != null)
        {
            DestroyGameObject(markerRoot.gameObject);
        }
    }

    private static void CreateMarker(Transform parent, string name, Color color, Vector3 localPos, Vector3 scale)
    {
        var existing = parent.Find(name);
        GameObject mark;
        if (existing == null)
        {
            mark = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mark.name = name;
            mark.transform.SetParent(parent, false);
        }
        else
        {
            mark = existing.gameObject;
        }

        mark.transform.localPosition = localPos;
        mark.transform.localScale = scale;
        ApplyMaterialColor(mark, color, false);
    }

    private static DockingPort ConfigureDockingApproachAssist(
        GameObject ship,
        PlayerShipController controller,
        Rigidbody shipRigidbody)
    {
        DockingPort sourceDockingPort = ResolveSourceDockingPort(ship);
        DockingPort targetDockingPort = ResolveDockingApproachTargetPort(ship, sourceDockingPort);
        DockingPort[] targetCandidates = ResolveDockingTargetCandidates(sourceDockingPort);

        var dockingApproachAssist = GetOrAddComponent<PrototypeDockingApproachAssist>(ship);
        dockingApproachAssist.Bind(controller, shipRigidbody, sourceDockingPort, targetDockingPort, targetCandidates);
        dockingApproachAssist.SetAssistEnabled(false);
        dockingApproachAssist.ResetForBootstrap();
        return targetDockingPort;
    }

    private static DockingPort ResolveSourceDockingPort(GameObject ship)
    {
        if (ship == null)
        {
            return null;
        }

        DockingPort sourceDockingPort = ship.GetComponentInChildren<DockingPort>();
        if (sourceDockingPort != null)
        {
            return sourceDockingPort;
        }

        sourceDockingPort = GetOrAddComponent<DockingPort>(ship);
        sourceDockingPort.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        return sourceDockingPort;
    }

    private static DockingPort ResolveDockingApproachTargetPort(GameObject sourceShip, DockingPort sourcePort)
    {
        DockingPort[] ports = Object.FindObjectsByType<DockingPort>(FindObjectsInactive.Exclude);
        for (int i = 0; i < ports.Length; i++)
        {
            DockingPort candidate = ports[i];
            if (candidate != null && candidate != sourcePort && (sourceShip == null || !candidate.transform.IsChildOf(sourceShip.transform)))
            {
                return candidate;
            }
        }

        return EnsureDockingApproachTarget(sourceShip, sourcePort);
    }

    private static DockingPort EnsureDockingApproachTarget(GameObject sourceShip, DockingPort sourcePort)
    {
        if (sourceShip == null)
        {
            return null;
        }

        var targetObject = GetOrCreateDockingTargetObject(sourceShip);
        var targetBody = GetOrAddComponent<Rigidbody>(targetObject);
        targetBody.useGravity = false;
        targetBody.isKinematic = true;
        targetBody.linearDamping = 0f;
        targetBody.angularDamping = 0f;
        targetBody.interpolation = RigidbodyInterpolation.Interpolate;

        DockingPort targetPort = GetOrAddComponent<DockingPort>(targetObject);
        targetPort.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        return targetPort;
    }

    private static GameObject GetOrCreateDockingTargetObject(GameObject sourceShip)
    {
        if (sourceShip == null)
        {
            return null;
        }

        var sourceTransform = sourceShip.transform;
        Vector3 forward = sourceTransform != null ? sourceTransform.forward : Vector3.forward;
        Vector3 up = sourceTransform != null ? sourceTransform.up : Vector3.up;
        Vector3 position = (sourceTransform != null ? sourceTransform.position : Vector3.zero) + (forward * PrototypeDockingApproachTargetDistance);

        var targetObject = new GameObject(PrototypeDockingApproachTargetName)
        {
            transform =
            {
                position = position,
                rotation = Quaternion.LookRotation(-forward, up)
            }
        };

        return targetObject;
    }

    private static DockingPort[] ResolveDockingTargetCandidates(DockingPort sourcePort)
    {
        var allPorts = Object.FindObjectsByType<DockingPort>(FindObjectsInactive.Exclude);
        var candidates = new List<DockingPort>(allPorts.Length);
        for (int i = 0; i < allPorts.Length; i++)
        {
            DockingPort port = allPorts[i];
            if (port != null && port != sourcePort && (sourcePort == null || !port.transform.IsChildOf(sourcePort.transform.root)))
            {
                candidates.Add(port);
            }
        }

        return candidates.ToArray();
    }

    private static void SetupMainCamera(Transform target, ShipStats stats, Rigidbody body, PrototypeTestEnvironment testEnvironment, DockingPort dockingTargetPort = null)
    {
        var camera = ResolveSingleMainCamera();
        if (camera == null)
        {
            var camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            camera = camObj.AddComponent<Camera>();
        }
        else
        {
            camera.tag = "MainCamera";
        }

        var camTransform = camera.transform;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.008f, 0.012f, 0.026f, 1f);
        camTransform.position = target.position - (target.forward * 18f) + (Vector3.up * 6f);
        camTransform.LookAt(target.position + target.forward * 1.5f);

        var follow = camera.gameObject.GetComponent<SimpleFollowCamera>();
        if (follow == null)
        {
            follow = camera.gameObject.AddComponent<SimpleFollowCamera>();
        }
        follow.BindTarget(target, stats);
        follow.ReframeToTargetVisualBounds();
        follow.SnapNextFrame();

        var overlay = camera.gameObject.GetComponent<PrototypeDebugOverlay>();
        if (overlay == null)
        {
            overlay = camera.gameObject.AddComponent<PrototypeDebugOverlay>();
        }
        overlay.Bind(target, stats, body);

        var hud = camera.gameObject.GetComponent<PrototypeFlightHud>();
        if (hud == null)
        {
            hud = camera.gameObject.AddComponent<PrototypeFlightHud>();
        }
        hud.Bind(target, stats, body);

        var keybinds = camera.gameObject.GetComponent<PrototypeKeybindOverlay>();
        if (keybinds == null)
        {
            keybinds = camera.gameObject.AddComponent<PrototypeKeybindOverlay>();
        }
        keybinds.Bind(target);

        var minimap = camera.gameObject.GetComponent<PrototypeMinimapOverlay>();
        if (minimap == null)
        {
            minimap = camera.gameObject.AddComponent<PrototypeMinimapOverlay>();
        }
        minimap.Bind(target, body, testEnvironment);

        PrototypeTrajectoryPreviewNavMap trajectoryPreview = null;
        if (target != null)
        {
            trajectoryPreview = target.GetComponent<PrototypeTrajectoryPreviewNavMap>();
            if (trajectoryPreview == null)
            {
                trajectoryPreview = target.gameObject.AddComponent<PrototypeTrajectoryPreviewNavMap>();
            }

            trajectoryPreview.Bind(
                target,
                body,
                stats,
                target.GetComponent<ShipPhysicsCore>(),
                target.GetComponent<PrototypeWaypointAutopilot>());
            minimap.BindTrajectoryPreview(trajectoryPreview);
        }

        var debugConsole = camera.gameObject.GetComponent<PrototypeFlightDebugConsole>();
        if (debugConsole == null)
        {
            debugConsole = camera.gameObject.AddComponent<PrototypeFlightDebugConsole>();
        }
        debugConsole.Bind(target, stats, body, Object.FindAnyObjectByType<PrototypeBootstrap>());

        var weaponComputer = target != null ? target.GetComponent<PrototypeWeaponComputer>() : null;
        var turretWeapon = target != null ? target.GetComponentInChildren<PrototypeTurretWeapon>() : null;
        var weaponComputerPanel = camera.gameObject.GetComponent<PrototypeWeaponComputerPanel>();
        if (weaponComputerPanel == null)
        {
            weaponComputerPanel = camera.gameObject.AddComponent<PrototypeWeaponComputerPanel>();
        }
        weaponComputerPanel.Bind(target, stats, weaponComputer, turretWeapon);

        var playerHud = camera.gameObject.GetComponent<PrototypePlayerHudRenderer>();
        if (playerHud == null)
        {
            playerHud = camera.gameObject.AddComponent<PrototypePlayerHudRenderer>();
        }
        playerHud.Bind(target, stats, body);
        playerHud.BindTrajectoryPreview(trajectoryPreview);

        PrototypeUiLayoutManager.ApplyPreset(
            PrototypeUiLayoutManager.CurrentPreset,
            overlay,
            debugConsole,
            hud,
            keybinds,
            minimap,
            weaponComputerPanel);
    }

    private static Camera ResolveSingleMainCamera()
    {
        Camera selected = Camera.main;
        if (selected == null)
        {
            GameObject existingMain = GameObject.Find("Main Camera");
            selected = existingMain != null ? existingMain.GetComponent<Camera>() : null;
        }

        Camera[] cameras = Object.FindObjectsByType<Camera>(FindObjectsInactive.Include);
        for (int i = 0; i < cameras.Length; i++)
        {
            Camera candidate = cameras[i];
            if (candidate == null)
            {
                continue;
            }

            bool isMainCamera = candidate.CompareTag("MainCamera") || candidate.gameObject.name == "Main Camera";
            if (!isMainCamera)
            {
                continue;
            }

            if (selected == null)
            {
                selected = candidate;
                selected.gameObject.name = "Main Camera";
                selected.tag = "MainCamera";
                selected.gameObject.SetActive(true);
                continue;
            }

            if (candidate != selected)
            {
                DestroyGameObject(candidate.gameObject);
            }
        }

        if (selected != null)
        {
            selected.gameObject.name = "Main Camera";
            selected.tag = "MainCamera";
            selected.gameObject.SetActive(true);
        }

        return selected;
    }

    private static void EnsureCameraAnchor(Transform ship, Rigidbody shipRigidbody)
    {
        if (ship == null)
        {
            return;
        }

        Transform anchorTransform = ship.Find("PrototypeCameraAnchor");
        if (anchorTransform == null)
        {
            anchorTransform = new GameObject("PrototypeCameraAnchor").transform;
            anchorTransform.SetParent(ship, false);
        }

        anchorTransform.position = shipRigidbody != null ? shipRigidbody.worldCenterOfMass : ship.position;
        if (anchorTransform.GetComponent<PrototypeCameraAnchor>() == null)
        {
            anchorTransform.gameObject.AddComponent<PrototypeCameraAnchor>();
        }
    }

    private PrototypeTestEnvironment EnsureTestEnvironment()
    {
        var environment = GetOrAddComponent<PrototypeTestEnvironment>(gameObject);
        environment.Rebuild();
        return environment;
    }

    private PrototypePveArenaLoop EnsurePveArena()
    {
        var arena = GetOrAddComponent<PrototypePveArenaLoop>(gameObject);
        arena.StartOrResetArena();
        return arena;
    }

    private static void EnsureSceneDirectionalLight()
    {
        var sceneLight = GameObject.Find("Directional Light");
        var sceneLightColor = new Color(0.86f, 0.9f, 0.97f, 1f);
        if (sceneLight == null)
        {
            sceneLight = new GameObject("Directional Light");
            var light = sceneLight.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = Mathf.Clamp(1.2f, DirectionalLightMinIntensity, DirectionalLightMaxIntensity);
            light.color = sceneLightColor;
            sceneLight.transform.rotation = Quaternion.Euler(50f, 330f, 0f);
        }
        else if (sceneLight.GetComponent<Light>() == null)
        {
            var addedLight = sceneLight.AddComponent<Light>();
            addedLight.type = LightType.Directional;
            addedLight.intensity = Mathf.Clamp(1.2f, DirectionalLightMinIntensity, DirectionalLightMaxIntensity);
            addedLight.color = sceneLightColor;
        }
        else
        {
            var light = sceneLight.GetComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = Mathf.Clamp(light.intensity, DirectionalLightMinIntensity, DirectionalLightMaxIntensity);
            light.color = sceneLightColor;
        }
    }

    private static void DestroyChildIfExists(Transform parent, string childName)
    {
        var child = parent.Find(childName);
        if (child != null)
        {
            DestroyGameObject(child.gameObject);
        }
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }

    private static void DestroyGameObjectImmediate(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        DestroyImmediate(target);
    }

    private static void DestroyComponent(Component target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }

    private static void DestroyComponentImmediate(Component target)
    {
        if (target == null)
        {
            return;
        }

        DestroyImmediate(target);
    }

    private static void RemoveCollider(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        var collider = target.GetComponent<Collider>();
        if (collider == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            collider.enabled = false;
            Destroy(collider);
        }
        else
        {
            DestroyImmediate(collider);
        }
    }

    private void EnsureTestTarget()
    {
        const string targetName = "PrototypeTargetDummy";
        var target = GameObject.Find(targetName);
        if (target == null)
        {
            target = GameObject.CreatePrimitive(PrimitiveType.Cube);
            target.name = targetName;
        }

        target.transform.position = testTargetPosition;
        target.transform.rotation = Quaternion.identity;
        target.transform.localScale = testTargetScale;
        ApplyMaterialColor(target, PrototypeModuleColorPalette.Target, true);

        var collider = target.GetComponent<BoxCollider>();
        if (collider == null)
        {
            collider = target.AddComponent<BoxCollider>();
        }

        collider.isTrigger = false;
        GetOrAddComponent<PrototypeTargetDummy>(target);
    }
}
