using UnityEngine;
using UnityEngine.InputSystem;

public enum PrototypeShipVisualMode
{
    GeneratedPrimitives = 0,
    ImportedDemoScout = 1,
    ImportedDemoCargo = 2
}

public class PrototypeShipVisualSwitcher : MonoBehaviour
{
    [SerializeField] private PrototypeShipVisualMode visualMode = PrototypeShipVisualMode.GeneratedPrimitives;
    [SerializeField] private bool hideGeneratedPrototypePrimitivesWithImportedVisual = true;
    [SerializeField] private GameObject importedDemoScoutVisualPrefab;
    [SerializeField] private GameObject importedDemoCargoVisualPrefab;

    private const string PrototypeRootName = "PrototypeShip";
    private const string RuntimeManagerName = "PrototypeShipVisualSwitcher_Manager";
    private const string ImportedVisualRootName = "ImportedShipVisual";
    private const string ImportedScoutInstanceName = "ImportedDemoScoutVisual";
    private const string ImportedCargoInstanceName = "ImportedDemoCargoVisual";
    private const string ImportedScoutVisualPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx";
    private const string ImportedCargoVisualPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_cargo_mk1.fbx";
    private static readonly Vector3 ImportedVisualAlignmentEuler = new Vector3(-90f, 180f, 0f);

    private Transform cachedShip;
    private PrototypeBootstrap cachedBootstrap;
    private Transform importedVisualRoot;
    private GameObject importedScoutVisualInstance;
    private GameObject importedCargoVisualInstance;
    private GameObject cachedImportedScoutVisualPrefab;
    private GameObject cachedImportedCargoVisualPrefab;
    private bool importedScoutPrefabResolved;
    private bool importedCargoPrefabResolved;
    private PrototypeShipVisualMode appliedMode = (PrototypeShipVisualMode)(-1);

    public PrototypeShipVisualMode SelectedVisualMode => visualMode;
    public string SelectedVisualModeName => VisualModeDisplayName(visualMode);

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void RuntimeBootstrap()
    {
        if (!Application.isPlaying)
        {
            return;
        }

        PrototypeShipVisualSwitcher switcher = Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
        if (switcher != null)
        {
            switcher.gameObject.name = RuntimeManagerName;
            StripManagerObjectComponents(switcher.gameObject);
            switcher.ResetForRuntimeBaseline();
            return;
        }

        var switcherObject = new GameObject(RuntimeManagerName);
        var runtimeSwitcher = switcherObject.AddComponent<PrototypeShipVisualSwitcher>();
        StripManagerObjectComponents(switcherObject);
        runtimeSwitcher.ResetForRuntimeBaseline();
        Object.DontDestroyOnLoad(switcherObject);
    }

    private void Awake()
    {
        StripManagerObjectComponents(gameObject);
    }

    private void Update()
    {
        Keyboard keyboard = Keyboard.current;
        if (Application.isPlaying && keyboard != null && keyboard.f6Key.wasPressedThisFrame)
        {
            CycleVisualMode();
        }

        EnsureCurrentModeApplied();
    }

    public void SelectVisualMode(PrototypeShipVisualMode mode)
    {
        visualMode = mode;
        ApplyNow();
    }

    public void CycleVisualMode()
    {
        visualMode = NextVisualMode(visualMode);
        ApplyNow();
    }

    public void ApplyNow()
    {
        StripManagerObjectComponents(gameObject);
        Transform ship = FindShip();
        if (ship != null)
        {
            ApplyVisualMode(ship);
        }
    }

    private void ResetForRuntimeBaseline()
    {
        visualMode = PrototypeShipVisualMode.GeneratedPrimitives;
        appliedMode = (PrototypeShipVisualMode)(-1);
        cachedShip = null;
        ApplyNow();
    }

    private void EnsureCurrentModeApplied()
    {
        Transform ship = FindShip();
        if (ship == null)
        {
            return;
        }

        bool hasImportedVisual = ship.Find(ImportedVisualRootName) != null;
        bool needsImportedVisual = visualMode != PrototypeShipVisualMode.GeneratedPrimitives;
        if (appliedMode != visualMode || (needsImportedVisual && !hasImportedVisual))
        {
            ApplyVisualMode(ship);
        }
    }

    private void ApplyVisualMode(Transform ship)
    {
        if (ship == null)
        {
            return;
        }

        PrototypeShipLayout layout = ResolveActiveLayout();
        if (visualMode == PrototypeShipVisualMode.GeneratedPrimitives)
        {
            SetGeneratedPrototypeVisualsVisible(ship, layout, true);
            SetImportedVisualActive(null);
            appliedMode = visualMode;
            NotifyCachesAfterVisualChange(ship);
            return;
        }

        GameObject visualPrefab = ResolveImportedShipVisualPrefab(visualMode);
        if (visualPrefab == null)
        {
            Debug.LogWarning($"Prototype ship visual '{SelectedVisualModeName}' is unavailable. Generated primitives remain visible.");
            SetGeneratedPrototypeVisualsVisible(ship, layout, true);
            SetImportedVisualActive(null);
            appliedMode = visualMode;
            NotifyCachesAfterVisualChange(ship);
            return;
        }

        SetGeneratedPrototypeVisualsVisible(ship, layout, !hideGeneratedPrototypePrimitivesWithImportedVisual);
        GameObject visualInstance = EnsureImportedVisualInstance(ship, visualMode, visualPrefab);
        SetImportedVisualActive(visualInstance);
        appliedMode = visualMode;
        NotifyCachesAfterVisualChange(ship);
    }

    private Transform FindShip()
    {
        if (cachedShip != null)
        {
            return cachedShip;
        }

        GameObject ship = GameObject.Find(PrototypeRootName);
        cachedShip = ship != null ? ship.transform : null;
        return cachedShip;
    }

    private PrototypeShipLayout ResolveActiveLayout()
    {
        if (cachedBootstrap == null)
        {
            cachedBootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
        }

        PrototypeShipVariant variant = cachedBootstrap != null ? cachedBootstrap.SelectedVariant : null;
        return variant != null ? variant.Layout : PrototypeShipLayout.Baseline();
    }

    private GameObject ResolveImportedShipVisualPrefab(PrototypeShipVisualMode mode)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                if (!importedScoutPrefabResolved)
                {
                    cachedImportedScoutVisualPrefab = importedDemoScoutVisualPrefab != null
                        ? importedDemoScoutVisualPrefab
                        : LoadImportedVisualAsset(ImportedScoutVisualPath);
                    importedScoutPrefabResolved = true;
                }

                return cachedImportedScoutVisualPrefab;
            case PrototypeShipVisualMode.ImportedDemoCargo:
                if (!importedCargoPrefabResolved)
                {
                    cachedImportedCargoVisualPrefab = importedDemoCargoVisualPrefab != null
                        ? importedDemoCargoVisualPrefab
                        : LoadImportedVisualAsset(ImportedCargoVisualPath);
                    importedCargoPrefabResolved = true;
                }

                return cachedImportedCargoVisualPrefab;
            default:
                return null;
        }
    }

    private GameObject EnsureImportedVisualInstance(Transform ship, PrototypeShipVisualMode mode, GameObject visualPrefab)
    {
        Transform root = EnsureImportedVisualRoot(ship);
        if (root == null || visualPrefab == null)
        {
            return null;
        }

        GameObject cachedInstance = GetCachedImportedVisualInstance(mode);
        if (cachedInstance != null)
        {
            return cachedInstance;
        }

        GameObject visualInstance = Instantiate(visualPrefab, root);
        visualInstance.name = GetImportedVisualInstanceName(mode);
        visualInstance.transform.localPosition = Vector3.zero;
        visualInstance.transform.localRotation = Quaternion.Euler(ImportedVisualAlignmentEuler);
        StripRuntimePhysicsFromVisual(visualInstance);
        SetCachedImportedVisualInstance(mode, visualInstance);
        return visualInstance;
    }

    private Transform EnsureImportedVisualRoot(Transform ship)
    {
        if (ship == null)
        {
            importedVisualRoot = null;
            return null;
        }

        if (importedVisualRoot != null && importedVisualRoot.parent == ship)
        {
            return importedVisualRoot;
        }

        importedVisualRoot = ship.Find(ImportedVisualRootName);
        if (importedVisualRoot == null)
        {
            var rootObject = new GameObject(ImportedVisualRootName);
            importedVisualRoot = rootObject.transform;
            importedVisualRoot.SetParent(ship, false);
        }

        importedVisualRoot.localPosition = Vector3.zero;
        importedVisualRoot.localRotation = Quaternion.identity;
        importedVisualRoot.localScale = Vector3.one;
        return importedVisualRoot;
    }

    private GameObject GetCachedImportedVisualInstance(PrototypeShipVisualMode mode)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                return importedScoutVisualInstance;
            case PrototypeShipVisualMode.ImportedDemoCargo:
                return importedCargoVisualInstance;
            default:
                return null;
        }
    }

    private void SetCachedImportedVisualInstance(PrototypeShipVisualMode mode, GameObject visualInstance)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                importedScoutVisualInstance = visualInstance;
                break;
            case PrototypeShipVisualMode.ImportedDemoCargo:
                importedCargoVisualInstance = visualInstance;
                break;
        }
    }

    private static string GetImportedVisualInstanceName(PrototypeShipVisualMode mode)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                return ImportedScoutInstanceName;
            case PrototypeShipVisualMode.ImportedDemoCargo:
                return ImportedCargoInstanceName;
            default:
                return "ImportedDemoVisual";
        }
    }

    private void SetImportedVisualActive(GameObject activeInstance)
    {
        if (importedVisualRoot == null && cachedShip != null)
        {
            importedVisualRoot = cachedShip.Find(ImportedVisualRootName);
        }

        if (importedVisualRoot != null)
        {
            for (int i = 0; i < importedVisualRoot.childCount; i++)
            {
                GameObject child = importedVisualRoot.GetChild(i).gameObject;
                child.SetActive(child == activeInstance);
            }
        }

        if (importedScoutVisualInstance != null)
        {
            importedScoutVisualInstance.SetActive(importedScoutVisualInstance == activeInstance);
        }

        if (importedCargoVisualInstance != null)
        {
            importedCargoVisualInstance.SetActive(importedCargoVisualInstance == activeInstance);
        }

        if (importedVisualRoot != null)
        {
            importedVisualRoot.gameObject.SetActive(activeInstance != null);
        }
    }

    private static GameObject LoadImportedVisualAsset(string assetPath)
    {
#if UNITY_EDITOR
        return UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
#else
        return null;
#endif
    }

    private static void NotifyCachesAfterVisualChange(Transform ship)
    {
        NotifyCameraAfterVisualChange();
        NotifyRcsAfterVisualChange(ship);
    }

    private static void NotifyCameraAfterVisualChange()
    {
        if (Camera.main == null)
        {
            return;
        }

        SimpleFollowCamera followCamera = Camera.main.GetComponent<SimpleFollowCamera>();
        if (followCamera != null)
        {
            followCamera.MarkVisualBoundsDirty();
            followCamera.ReframeToTargetVisualBounds();
            followCamera.SnapNextFrame();
        }
    }

    private static void NotifyRcsAfterVisualChange(Transform ship)
    {
        if (ship == null)
        {
            return;
        }

        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        if (rcs != null && rcs.UseImportedFunctionalSockets)
        {
            rcs.MarkNozzlesDirty();
            rcs.RefreshNozzles();
        }
    }

    private static PrototypeShipVisualMode NextVisualMode(PrototypeShipVisualMode mode)
    {
        int count = System.Enum.GetValues(typeof(PrototypeShipVisualMode)).Length;
        return (PrototypeShipVisualMode)(((int)mode + 1) % Mathf.Max(1, count));
    }

    private static string VisualModeDisplayName(PrototypeShipVisualMode mode)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                return "Imported Demo Scout";
            case PrototypeShipVisualMode.ImportedDemoCargo:
                return "Imported Demo Cargo";
            default:
                return "Generated Primitives";
        }
    }

    private static void SetGeneratedPrototypeVisualsVisible(Transform ship, PrototypeShipLayout layout, bool visible)
    {
        PrototypeShipLayout activeLayout = layout ?? PrototypeShipLayout.Baseline();

        PrototypeModuleLayoutEntry[] modules = activeLayout.Modules;
        for (int i = 0; i < modules.Length; i++)
        {
            Transform module = ship.Find(modules[i].ModuleId);
            SetModuleRenderersVisible(module, visible);
        }

        PrototypeMainThrusterLayoutEntry[] mainThrusters = activeLayout.MainThrusters;
        for (int i = 0; i < mainThrusters.Length; i++)
        {
            Transform gimbal = ship.Find(mainThrusters[i].ModuleId);
            SetModuleRenderersVisible(gimbal, visible);

            Transform nozzle = gimbal != null ? gimbal.Find(mainThrusters[i].NozzleId) : null;
            SetChildRendererVisible(nozzle, "NozzleRing", visible);
            SetChildRendererVisible(nozzle, "EngineNozzleRing", visible);
        }

        PrototypeGunLayoutEntry[] guns = activeLayout.Guns;
        for (int i = 0; i < guns.Length; i++)
        {
            SetModuleRenderersVisible(ship.Find(guns[i].ModuleId), visible);
        }

        PrototypeRcsBlockLayoutEntry[] rcsBlocks = activeLayout.RcsBlocks;
        for (int i = 0; i < rcsBlocks.Length; i++)
        {
            SetModuleRenderersVisible(ship.Find(rcsBlocks[i].BlockId), visible);
        }
    }

    private static void SetModuleRenderersVisible(Transform module, bool visible)
    {
        if (module == null)
        {
            return;
        }

        Renderer[] renderers = module.GetComponentsInChildren<Renderer>(true);
        for (int i = 0; i < renderers.Length; i++)
        {
            if (renderers[i].transform == module)
            {
                renderers[i].enabled = false;
                continue;
            }

            renderers[i].enabled = visible;
        }
    }

    private static void SetDirectRendererVisible(Transform target, bool visible)
    {
        if (target == null)
        {
            return;
        }

        Renderer renderer = target.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.enabled = visible;
        }
    }

    private static void SetChildRendererVisible(Transform parent, string childPath, bool visible)
    {
        if (parent == null)
        {
            return;
        }

        SetDirectRendererVisible(parent.Find(childPath), visible);
    }

    private static void StripRuntimePhysicsFromVisual(GameObject visualRoot)
    {
        if (visualRoot == null)
        {
            return;
        }

        Collider[] colliders = visualRoot.GetComponentsInChildren<Collider>(true);
        for (int i = 0; i < colliders.Length; i++)
        {
            DestroyComponent(colliders[i]);
        }

        Rigidbody[] rigidbodies = visualRoot.GetComponentsInChildren<Rigidbody>(true);
        for (int i = 0; i < rigidbodies.Length; i++)
        {
            DestroyComponent(rigidbodies[i]);
        }
    }

    private static void StripManagerObjectComponents(GameObject manager)
    {
        if (manager == null)
        {
            return;
        }

        Renderer renderer = manager.GetComponent<Renderer>();
        if (renderer != null)
        {
            DestroyComponent(renderer);
        }

        Collider collider = manager.GetComponent<Collider>();
        if (collider != null)
        {
            DestroyComponent(collider);
        }

        Rigidbody body = manager.GetComponent<Rigidbody>();
        if (body != null)
        {
            DestroyComponent(body);
        }
    }

    private static void DestroyChildIfExists(Transform parent, string childName)
    {
        Transform child = parent.Find(childName);
        if (child != null)
        {
            child.gameObject.SetActive(false);
            child.SetParent(null, false);
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

    private static void DestroyComponent(Component target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            if (target is Collider collider)
            {
                collider.enabled = false;
            }
            else if (target is Rigidbody body)
            {
                body.detectCollisions = false;
                body.isKinematic = true;
            }

            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }
}
