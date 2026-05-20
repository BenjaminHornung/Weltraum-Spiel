using System.Collections.Generic;
using UnityEngine;

public class PrototypeBootstrap : MonoBehaviour
{
    [SerializeField] private bool buildOnStart = true;
    [SerializeField] private PrototypeShipConfig shipConfig;
    [SerializeField] private int selectedVariantIndex;
    [SerializeField] private bool addOrientationMarkers = true;
    [SerializeField] private Vector3 shipStartPosition = new Vector3(0f, 0.5f, 0f);
    [SerializeField] private bool spawnTestTarget = true;
    [SerializeField] private Vector3 testTargetPosition = new Vector3(0f, 0.5f, 42f);
    [SerializeField] private Vector3 testTargetScale = new Vector3(4f, 4f, 0.6f);

    private const string PrototypeRootName = "PrototypeShip";
    private const float DefaultRcsBlockThrust = 6500f;
    private static readonly Color HullColor = new Color(0.68f, 0.72f, 0.78f);
    private static readonly Color CockpitColor = new Color(0.82f, 0.2f, 0.2f);
    private static readonly Color FuelTankColor = new Color(0.2f, 0.7f, 0.2f);
    private static readonly Color GunColor = new Color(0.9f, 0.9f, 0.3f);
    private static readonly Color CargoColor = new Color(0.45f, 0.5f, 0.56f);
    private static readonly Color MainThrusterColor = new Color(0.16f, 0.44f, 0.9f);
    private static readonly Color RcsBlockColor = new Color(0.22f, 0.85f, 0.95f);
    private static readonly Color RcsVfxColor = new Color(0.35f, 1f, 0.65f, 0.85f);

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

        EnsureModuleParts(ship.transform, layout);
        MainThrusterModule[] mainThrusterModules = EnsureMainThrusters(ship.transform, layout, stats, shipRigidbody, physicsCore, variant, out Transform primaryMainNozzle);
        EnsureGunModules(ship.transform, layout);
        EnsureRcsThrusters(ship.transform, layout, variant);
        PrototypeModuleMassLayout.ConfigureGeneratedPrototypeDescriptors(ship.transform, stats, layout);
        stats.ApplyMassProperties(shipRigidbody);
        RemoveRootFallbackChild(ship.transform, "Muzzle");

        var gun = GetOrAddComponent<GunModule>(ship);
        var engine = GetOrAddComponent<EngineVfxController>(ship);
        var mainThruster = GetOrAddComponent<MainThrusterBank>(ship);
        var rcs = GetOrAddComponent<RcsThrusterController>(ship);
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

        GetOrAddComponent<PlayerShipController>(ship);

        mainThruster.Configure(mainThrusterModules, shipRigidbody, stats, physicsCore);
        engine.ConfigureNozzle(primaryMainNozzle);
        rcs.ConfigureThrusters(
            ship.transform.Find("RCS_Top"),
            ship.transform.Find("RCS_Bottom"),
            ship.transform.Find("RCS_Left"),
            ship.transform.Find("RCS_Right"),
            null,
            null,
            shipRigidbody,
            physicsCore);

        if (gun == null || engine == null)
        {
            Debug.LogWarning("Prototype ship bootstrap could not initialize all optional modules.");
        }

        if (addOrientationMarkers)
        {
            EnsureOrientationMarkers(ship.transform);
        }

        if (spawnTestTarget)
        {
            SpawnTestTarget();
        }

        SetupMainCamera(ship.transform, stats, shipRigidbody);
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

    public void SpawnTestTarget()
    {
        EnsureTestTarget();
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
            PrototypeModuleLayoutEntry module = modules[i];
            BuildModulePart(
                ship,
                module.ModuleId,
                PrimitiveType.Cube,
                module.LocalPosition,
                Quaternion.Euler(module.LocalEulerAngles),
                module.LocalScale,
                ColorForModule(module.MassRole));
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
                MainThrusterColor);
            var nozzle = gimbal.transform.Find(entry.NozzleId);
            if (nozzle == null)
            {
                var nozzleObject = new GameObject(entry.NozzleId);
                nozzleObject.transform.SetParent(gimbal.transform, false);
                nozzle = nozzleObject.transform;
            }

            nozzle.localPosition = entry.NozzleLocalPosition;
            nozzle.localRotation = Quaternion.Euler(entry.NozzleLocalEulerAngles);
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
                GunColor);
            var muzzle = gun.transform.Find(gunEntry.MuzzleId);
            if (muzzle == null)
            {
                var muzzleObj = new GameObject(gunEntry.MuzzleId);
                muzzleObj.transform.SetParent(gun.transform, false);
                muzzle = muzzleObj.transform;
            }

            muzzle.localPosition = gunEntry.MuzzleLocalPosition;
            muzzle.localRotation = Quaternion.Euler(gunEntry.MuzzleLocalEulerAngles);
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
        var block = BuildModulePart(ship, blockName, PrimitiveType.Cube, localPosition, Quaternion.identity, localScale, RcsBlockColor);
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

        vfx.localPosition = Vector3.back * 2.3f;
        vfx.localRotation = Quaternion.Euler(0f, 180f, 0f);
        vfx.localScale = new Vector3(0.08f, 0.08f, 0.12f);
        RemoveCollider(vfx.gameObject);
        ApplyMaterialColor(vfx.gameObject, RcsVfxColor, true);
        vfx.gameObject.SetActive(false);
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
        switch (role)
        {
            case PrototypeModuleMassRole.Cockpit:
                return CockpitColor;
            case PrototypeModuleMassRole.FuelTank:
                return FuelTankColor;
            case PrototypeModuleMassRole.Custom:
                return CargoColor;
            default:
                return HullColor;
        }
    }

    private static GameObject BuildModulePart(Transform parent, string name, PrimitiveType type, Vector3 localPos, Quaternion localRot, Vector3 localScale, Color color)
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
            material.SetColor("_EmissionColor", color * 2.5f);
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

        CreateMarker(markerRoot, "Marker_Forward", Color.cyan, new Vector3(0f, 0f, 3.7f), new Vector3(0.08f, 0.08f, 1.2f));
        CreateMarker(markerRoot, "Marker_Right", Color.red, new Vector3(1.5f, 0f, 0f), new Vector3(1.2f, 0.08f, 0.08f));
        CreateMarker(markerRoot, "Marker_Up", Color.green, new Vector3(0f, 1.3f, 0f), new Vector3(0.08f, 1.1f, 0.08f));
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

    private static void SetupMainCamera(Transform target, ShipStats stats, Rigidbody body)
    {
        var camera = Camera.main;
        if (camera == null)
        {
            var existingMain = GameObject.Find("Main Camera");
            if (existingMain != null)
            {
                camera = existingMain.GetComponent<Camera>();
            }
        }

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
        camTransform.position = target.position - (target.forward * 18f) + (Vector3.up * 6f);
        camTransform.LookAt(target.position + target.forward * 1.5f);

        var follow = camera.gameObject.GetComponent<SimpleFollowCamera>();
        if (follow == null)
        {
            follow = camera.gameObject.AddComponent<SimpleFollowCamera>();
        }
        follow.BindTarget(target, stats);

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

        var debugConsole = camera.gameObject.GetComponent<PrototypeFlightDebugConsole>();
        if (debugConsole == null)
        {
            debugConsole = camera.gameObject.AddComponent<PrototypeFlightDebugConsole>();
        }
        debugConsole.Bind(target, stats, body, Object.FindAnyObjectByType<PrototypeBootstrap>());
    }

    private static void EnsureSceneDirectionalLight()
    {
        var sceneLight = GameObject.Find("Directional Light");
        if (sceneLight == null)
        {
            sceneLight = new GameObject("Directional Light");
            var light = sceneLight.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
            sceneLight.transform.rotation = Quaternion.Euler(50f, 330f, 0f);
        }
        else if (sceneLight.GetComponent<Light>() == null)
        {
            sceneLight.AddComponent<Light>().type = LightType.Directional;
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
        ApplyMaterialColor(target, new Color(0.25f, 0.85f, 1f, 1f), true);

        var collider = target.GetComponent<BoxCollider>();
        if (collider == null)
        {
            collider = target.AddComponent<BoxCollider>();
        }

        collider.isTrigger = false;
        GetOrAddComponent<PrototypeTargetDummy>(target);
    }
}
