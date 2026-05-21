using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class PrototypeFunctionalShipBinder : MonoBehaviour
{
    public const string ImportedVisualRootName = "ImportedShipVisual";
    public const string DemoScoutInstanceName = "ImportedDemoScoutVisual";
    public const string DemoCargoInstanceName = "ImportedDemoCargoVisual";
    public const string DemoScoutAssetPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx";
    public const string DemoCargoAssetPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_cargo_mk1.fbx";

    private static readonly Vector3 ImportedShipLocalEulerAngles = new Vector3(-90f, 180f, 0f);
    private const float ImportedShipLocalScale = 100f;

    [SerializeField] private PrototypeShipBuildMode buildMode = PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault;
    [SerializeField] private GameObject demoScoutPrefab;
    [SerializeField] private GameObject demoCargoPrefab;
    [SerializeField] private PrototypeShipVfxLibrary vfxLibrary;
    [SerializeField] private bool createMissingRuntimeComponents = true;
    [SerializeField] private bool createRuntimeVfxChildren = true;

    public BindReport LastReport { get; private set; }

    public void Configure(
        PrototypeShipBuildMode mode,
        GameObject scoutPrefab = null,
        GameObject cargoPrefab = null,
        PrototypeShipVfxLibrary library = null)
    {
        buildMode = mode;
        demoScoutPrefab = scoutPrefab != null ? scoutPrefab : demoScoutPrefab;
        demoCargoPrefab = cargoPrefab != null ? cargoPrefab : demoCargoPrefab;
        vfxLibrary = library != null ? library : vfxLibrary;
    }

    public BindReport BindNow()
    {
        var report = new BindReport
        {
            requestedBuildMode = buildMode
        };

        if (buildMode == PrototypeShipBuildMode.GeneratedPrimitiveFallback)
        {
            report.warnings.Add("Functional imported binder skipped because generated primitive fallback mode is active.");
            LastReport = report;
            return report;
        }

        ResolveVfxLibrary();
        GameObject prefab = ResolvePrefab(buildMode, report);
        if (prefab == null)
        {
            report.missingRequiredSockets.Add("Imported demo ship asset");
            LastReport = report;
            return report;
        }

        Transform visualRoot = EnsureImportedVisualRoot();
        GameObject importedInstance = EnsureImportedInstance(visualRoot, prefab, InstanceNameForMode(buildMode), report);
        if (importedInstance == null)
        {
            report.missingRequiredSockets.Add("Imported demo ship instance");
            LastReport = report;
            return report;
        }

        report.importedVisualRoot = visualRoot;
        report.importedShipInstance = importedInstance.transform;

        PrototypeShipSocketUtility.EnsureSocketsInHierarchy(importedInstance.transform);
        BindVisualVfx(importedInstance.transform, report);

        PrototypeImportedShipBinder importedBinder = GetOrAddComponent<PrototypeImportedShipBinder>(gameObject, createMissingRuntimeComponents);
        if (importedBinder != null)
        {
            importedBinder.Configure(importedInstance.transform, vfxLibrary, createMissingRuntimeComponents, createRuntimeVfxChildren);
            PrototypeImportedShipBinder.BindReport importedReport = importedBinder.BindNow();
            report.foundMainNozzles = importedReport.foundMainNozzles;
            report.foundRcsNozzles = importedReport.foundRcsNozzles;
            report.foundMuzzles = importedReport.foundMuzzles;
            report.boundMainThrusters = importedReport.boundMainThrusters;
            report.boundRcsNozzles = importedReport.boundRcsNozzles;
            report.boundGunModules = importedReport.boundGuns;
            report.createdRcsVfxChildren = importedReport.createdRcsVfxChildren;
            report.missingRequiredSockets.AddRange(importedReport.missingRequiredSockets);
            report.warnings.AddRange(importedReport.warnings);
        }

        PrototypeShipKitWeaponBinder weaponBinder = GetOrAddComponent<PrototypeShipKitWeaponBinder>(gameObject, createMissingRuntimeComponents);
        if (weaponBinder != null)
        {
            weaponBinder.Configure(importedInstance.transform, transform, createMissingRuntimeComponents, true);
            PrototypeShipKitWeaponBinder.BindReport weaponReport = weaponBinder.BindNow();
            report.foundTurretBases = weaponReport.foundBases;
            report.foundTurretYawPivots = weaponReport.foundYawPivots;
            report.foundTurretPitchPivots = weaponReport.foundPitchPivots;
            report.foundWeaponMuzzleMarkers = weaponReport.foundMuzzles;
            report.foundMuzzleFlashMarkers = weaponReport.foundMuzzleFlashes;
            report.boundTurretWeapons = weaponReport.boundTurretWeapons;
            report.boundWeaponComputers = weaponReport.boundWeaponComputers;
            report.boundGunModules = Mathf.Max(report.boundGunModules, weaponReport.boundGunModules);
            report.boundMuzzleName = string.IsNullOrEmpty(report.boundMuzzleName) ? weaponReport.boundMuzzleName : report.boundMuzzleName;
            report.missingRequiredSockets.AddRange(weaponReport.missingRequiredMarkers);
            report.warnings.AddRange(weaponReport.warnings);
        }

        ApplyStrictRuntimeFallbackPolicy(report);
        ValidateRequiredRuntimeSockets(report);
        LastReport = report;
        return report;
    }

    private Transform EnsureImportedVisualRoot()
    {
        Transform visualRoot = transform.Find(ImportedVisualRootName);
        if (visualRoot == null)
        {
            visualRoot = new GameObject(ImportedVisualRootName).transform;
            visualRoot.SetParent(transform, false);
        }

        visualRoot.localPosition = Vector3.zero;
        visualRoot.localRotation = Quaternion.identity;
        visualRoot.localScale = Vector3.one;
        visualRoot.gameObject.SetActive(true);
        return visualRoot;
    }

    private GameObject EnsureImportedInstance(Transform visualRoot, GameObject prefab, string instanceName, BindReport report)
    {
        if (visualRoot == null || prefab == null)
        {
            return null;
        }

        GameObject selected = null;
        for (int i = visualRoot.childCount - 1; i >= 0; i--)
        {
            Transform child = visualRoot.GetChild(i);
            if (child.name == instanceName)
            {
                selected = child.gameObject;
                selected.SetActive(true);
            }
            else
            {
                child.gameObject.SetActive(false);
            }
        }

        if (selected == null)
        {
            selected = Instantiate(prefab, visualRoot, false);
            selected.name = instanceName;
            report.createdImportedInstance = true;
        }

        selected.transform.localPosition = Vector3.zero;
        selected.transform.localRotation = Quaternion.Euler(ImportedShipLocalEulerAngles);
        selected.transform.localScale = Vector3.one * ImportedShipLocalScale;
        selected.SetActive(true);
        StripRuntimePhysicsFromVisual(selected);
        return selected;
    }

    private void BindVisualVfx(Transform importedInstance, BindReport report)
    {
        if (importedInstance == null)
        {
            return;
        }

        PrototypeShipKitVfxBinder vfxBinder = importedInstance.GetComponent<PrototypeShipKitVfxBinder>();
        if (vfxBinder == null && createMissingRuntimeComponents)
        {
            vfxBinder = importedInstance.gameObject.AddComponent<PrototypeShipKitVfxBinder>();
        }

        if (vfxBinder == null)
        {
            return;
        }

        vfxBinder.MainThrusterVfxPrefab = vfxLibrary != null ? vfxLibrary.MainThrusterVfxPrefab : null;
        vfxBinder.RcsThrusterVfxPrefab = vfxLibrary != null ? vfxLibrary.RcsThrusterVfxPrefab : null;
        vfxBinder.PreviewEffectsActive = false;
        PrototypeShipKitVfxBinder.BindStats stats = vfxBinder.BindNow();
        report.visualMainVfxBindings = stats.MainThrusterBindings;
        report.visualRcsVfxBindings = stats.RcsThrusterBindings;
        report.visualVfxCreatedInstances = stats.CreatedInstances;
    }

    private void ApplyStrictRuntimeFallbackPolicy(BindReport report)
    {
        EngineVfxController engineVfx = GetComponent<EngineVfxController>();
        if (engineVfx != null)
        {
            engineVfx.SetAllowFallbackNozzle(false);
            if (engineVfx.Nozzle == null || !PrototypeShipSocketUtility.IsMainThrusterNozzleName(engineVfx.Nozzle.name))
            {
                report.missingRequiredSockets.Add("THRUST_NOZZLE_MAIN*");
            }
        }

        GunModule gun = GetComponent<GunModule>();
        if (gun != null)
        {
            gun.SetAllowMuzzleFallback(false);
            if (gun.MuzzleTransform == null || !gun.MuzzleTransform.name.ToUpperInvariant().StartsWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix, System.StringComparison.Ordinal))
            {
                report.missingRequiredSockets.Add(PrototypeShipSocketUtility.WeaponMuzzlePrefix + "*");
            }
        }

        RcsThrusterController rcs = GetComponent<RcsThrusterController>();
        if (rcs != null)
        {
            rcs.SetUseImportedFunctionalSockets(true);
            rcs.MarkNozzlesDirty();
            rcs.RefreshNozzles();
            report.boundRcsNozzles = rcs.InstalledNozzleCount;
        }
    }

    private void ValidateRequiredRuntimeSockets(BindReport report)
    {
        if (report.foundMainNozzles <= 0)
        {
            report.missingRequiredSockets.Add("THRUST_NOZZLE_MAIN*");
        }

        if (report.foundRcsNozzles <= 0)
        {
            report.missingRequiredSockets.Add("RCS_NOZZLE_*");
        }

        if (report.foundWeaponMuzzleMarkers <= 0 && report.foundMuzzles <= 0)
        {
            report.missingRequiredSockets.Add(PrototypeShipSocketUtility.WeaponMuzzlePrefix + "*");
        }

        if (report.boundTurretWeapons <= 0)
        {
            report.missingRequiredSockets.Add("WEAPON_TURRET_* hierarchy");
        }

        report.hasRequiredFunctionalSockets =
            report.foundMainNozzles > 0
            && report.foundRcsNozzles > 0
            && (report.foundWeaponMuzzleMarkers > 0 || report.foundMuzzles > 0)
            && report.boundMainThrusters > 0
            && report.boundRcsNozzles > 0
            && report.boundTurretWeapons > 0;
    }

    private GameObject ResolvePrefab(PrototypeShipBuildMode mode, BindReport report)
    {
        GameObject configuredPrefab = mode == PrototypeShipBuildMode.ImportedDemoCargoFunctional ? demoCargoPrefab : demoScoutPrefab;
        if (configuredPrefab != null)
        {
            return configuredPrefab;
        }

#if UNITY_EDITOR
        string assetPath = mode == PrototypeShipBuildMode.ImportedDemoCargoFunctional ? DemoCargoAssetPath : DemoScoutAssetPath;
        GameObject loaded = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (loaded == null)
        {
            report.warnings.Add("Could not load imported demo ship asset at " + assetPath + ".");
        }

        return loaded;
#else
        report.warnings.Add("No imported demo ship prefab is assigned for runtime build.");
        return null;
#endif
    }

    private void ResolveVfxLibrary()
    {
        if (vfxLibrary != null)
        {
            return;
        }

#if UNITY_EDITOR
        vfxLibrary = PrototypeShipVfxLibrary.LoadDefaultEditor();
#endif
    }

    private static string InstanceNameForMode(PrototypeShipBuildMode mode)
    {
        return mode == PrototypeShipBuildMode.ImportedDemoCargoFunctional ? DemoCargoInstanceName : DemoScoutInstanceName;
    }

    private static void StripRuntimePhysicsFromVisual(GameObject visualRoot)
    {
        if (visualRoot == null)
        {
            return;
        }

        Rigidbody[] rigidbodies = visualRoot.GetComponentsInChildren<Rigidbody>(true);
        for (int i = 0; i < rigidbodies.Length; i++)
        {
            DestroyComponent(rigidbodies[i]);
        }

        Collider[] colliders = visualRoot.GetComponentsInChildren<Collider>(true);
        for (int i = 0; i < colliders.Length; i++)
        {
            DestroyComponent(colliders[i]);
        }
    }

    private static T GetOrAddComponent<T>(GameObject target, bool mayAdd) where T : Component
    {
        if (target == null)
        {
            return null;
        }

        T component = target.GetComponent<T>();
        if (component == null && mayAdd)
        {
            component = target.AddComponent<T>();
        }

        return component;
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

    [System.Serializable]
    public sealed class BindReport
    {
        public PrototypeShipBuildMode requestedBuildMode;
        public Transform importedVisualRoot;
        public Transform importedShipInstance;
        public bool createdImportedInstance;
        public bool hasRequiredFunctionalSockets;
        public int foundMainNozzles;
        public int foundRcsNozzles;
        public int foundMuzzles;
        public int foundTurretBases;
        public int foundTurretYawPivots;
        public int foundTurretPitchPivots;
        public int foundWeaponMuzzleMarkers;
        public int foundMuzzleFlashMarkers;
        public int boundMainThrusters;
        public int boundRcsNozzles;
        public int boundTurretWeapons;
        public int boundGunModules;
        public int boundWeaponComputers;
        public int createdRcsVfxChildren;
        public int visualMainVfxBindings;
        public int visualRcsVfxBindings;
        public int visualVfxCreatedInstances;
        public string boundMuzzleName;
        public List<string> missingRequiredSockets = new List<string>();
        public List<string> warnings = new List<string>();
    }
}
