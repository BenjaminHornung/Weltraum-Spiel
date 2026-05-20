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
    private const string ImportedVisualRootName = "ImportedShipVisual";
    private const string ImportedScoutVisualPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx";
    private const string ImportedCargoVisualPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_cargo_mk1.fbx";
    private static readonly Vector3 ImportedVisualAlignmentEuler = new Vector3(-90f, 180f, 0f);

    private Transform cachedShip;
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
            switcher.ResetForRuntimeBaseline();
            return;
        }

        var switcherObject = new GameObject("PrototypeShipVisualSwitcher");
        var runtimeSwitcher = switcherObject.AddComponent<PrototypeShipVisualSwitcher>();
        runtimeSwitcher.ResetForRuntimeBaseline();
        Object.DontDestroyOnLoad(switcherObject);
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
        if (appliedMode != visualMode || hasImportedVisual != needsImportedVisual)
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

        DestroyChildIfExists(ship, ImportedVisualRootName);

        PrototypeShipLayout layout = ResolveActiveLayout();
        if (visualMode == PrototypeShipVisualMode.GeneratedPrimitives)
        {
            SetGeneratedPrototypeVisualsVisible(ship, layout, true);
            appliedMode = visualMode;
            NotifyCameraAfterVisualChange();
            return;
        }

        GameObject visualPrefab = ResolveImportedShipVisualPrefab(visualMode);
        if (visualPrefab == null)
        {
            Debug.LogWarning($"Prototype ship visual '{SelectedVisualModeName}' is unavailable. Generated primitives remain visible.");
            SetGeneratedPrototypeVisualsVisible(ship, layout, true);
            appliedMode = visualMode;
            NotifyCameraAfterVisualChange();
            return;
        }

        SetGeneratedPrototypeVisualsVisible(ship, layout, !hideGeneratedPrototypePrimitivesWithImportedVisual);

        var visualRoot = new GameObject(ImportedVisualRootName);
        visualRoot.transform.SetParent(ship, false);

        GameObject visualInstance = Instantiate(visualPrefab, visualRoot.transform);
        visualInstance.name = visualPrefab.name + "_Visual";
        visualInstance.transform.localPosition = Vector3.zero;
        visualInstance.transform.localRotation = Quaternion.Euler(ImportedVisualAlignmentEuler);
        StripRuntimePhysicsFromVisual(visualInstance);
        appliedMode = visualMode;
        NotifyCameraAfterVisualChange();
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
        PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
        PrototypeShipVariant variant = bootstrap != null ? bootstrap.SelectedVariant : null;
        return variant != null ? variant.Layout : PrototypeShipLayout.Baseline();
    }

    private GameObject ResolveImportedShipVisualPrefab(PrototypeShipVisualMode mode)
    {
        switch (mode)
        {
            case PrototypeShipVisualMode.ImportedDemoScout:
                return importedDemoScoutVisualPrefab != null
                    ? importedDemoScoutVisualPrefab
                    : LoadImportedVisualAsset(ImportedScoutVisualPath);
            case PrototypeShipVisualMode.ImportedDemoCargo:
                return importedDemoCargoVisualPrefab != null
                    ? importedDemoCargoVisualPrefab
                    : LoadImportedVisualAsset(ImportedCargoVisualPath);
            default:
                return null;
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

    private static void NotifyCameraAfterVisualChange()
    {
        if (Camera.main == null)
        {
            return;
        }

        SimpleFollowCamera followCamera = Camera.main.GetComponent<SimpleFollowCamera>();
        followCamera?.ReframeToTargetVisualBounds();
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
}
