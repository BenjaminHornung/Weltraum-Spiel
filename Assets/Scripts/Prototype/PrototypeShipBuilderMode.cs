using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(Camera))]
public class PrototypeShipBuilderMode : MonoBehaviour
{
    private const string BuilderRootName = "PrototypeShipBuilderRoot";
    private const float HangarEntryMaxSpeed = 1f;

    [SerializeField] private PrototypeBootstrap bootstrap;
    [SerializeField] private Transform shipRoot;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private bool allowEntryAfterBootstrap = true;
    [SerializeField] private PrototypeShipModuleCategory activeCategory = PrototypeShipModuleCategory.Hull;

    private PrototypeShipBuilderSession session;
    private PrototypeShipBlueprintStore store;
    private PrototypeShipBuilderHud hud;
    private GameObject builderRoot;
    private readonly List<GameObject> moduleVisuals = new List<GameObject>();
    private readonly List<Behaviour> disabledFlightBehaviours = new List<Behaviour>();
    private float gridLevel;
    private bool ghostActive;
    private string ghostDefinitionId = string.Empty;
    private bool confirmDialogOpen;
    private bool loadDialogOpen;

    public static bool IsAnyBuilderActive { get; private set; }

    public bool IsActive { get; private set; }
    public PrototypeShipBuilderSession Session => session;
    public bool IsConfirmDialogOpen => confirmDialogOpen;
    public bool IsLoadDialogOpen => loadDialogOpen;
    public bool HasGhost => ghostActive;
    public float GridLevel => gridLevel;

    private void Awake()
    {
        EnsureInitialized();
    }

    private void Update()
    {
        EnsureInitialized();
        Keyboard keyboard = Keyboard.current;
        if (keyboard == null)
        {
            RefreshHud();
            return;
        }

        if (!IsActive)
        {
            if (keyboard.f8Key.wasPressedThisFrame && CanEnterHangar())
            {
                EnterHangar();
            }

            return;
        }

        HandleBuilderInput(keyboard);
        RefreshHud();
    }

    public void Bind(PrototypeBootstrap bootstrapSource, Transform runtimeShipRoot, Rigidbody runtimeBody)
    {
        bootstrap = bootstrapSource != null ? bootstrapSource : bootstrap;
        shipRoot = runtimeShipRoot != null ? runtimeShipRoot : shipRoot;
        shipRigidbody = runtimeBody != null ? runtimeBody : shipRigidbody;
        allowEntryAfterBootstrap = true;
        EnsureInitialized();
    }

    public bool CanEnterHangar()
    {
        if (IsActive)
        {
            return false;
        }

        if (allowEntryAfterBootstrap)
        {
            return true;
        }

        return shipRigidbody == null || shipRigidbody.linearVelocity.magnitude < HangarEntryMaxSpeed;
    }

    public void EnterHangar()
    {
        EnsureInitialized();
        if (IsActive || !CanEnterHangar())
        {
            return;
        }

        IsActive = true;
        IsAnyBuilderActive = true;
        allowEntryAfterBootstrap = false;
        DisableFlightUi();
        if (shipRoot != null)
        {
            shipRoot.gameObject.SetActive(false);
        }

        EnsureBuilderRoot();
        builderRoot.SetActive(true);
        hud.SetVisible(true);
        RebuildViewportVisuals();
        RefreshHud();
    }

    public void ExitHangar(bool discardChanges)
    {
        if (!IsActive)
        {
            return;
        }

        if (session != null && session.IsDirty && !discardChanges)
        {
            confirmDialogOpen = true;
            RefreshHud();
            return;
        }

        CloseHangar();
    }

    public bool TestFly()
    {
        EnsureInitialized();
        PrototypeShipBuilderValidationResult validation = session.Validate();
        if (!validation.IsValid)
        {
            RefreshHud();
            return false;
        }

        PrototypeShipBlueprintBuildResult build = session.DraftBlueprint.BuildVariant();
        if (!build.IsValid || build.Variant == null)
        {
            RefreshHud();
            return false;
        }

        if (bootstrap == null)
        {
            bootstrap = FindAnyObjectByType<PrototypeBootstrap>();
        }

        if (bootstrap == null)
        {
            return false;
        }

        CloseHangar();
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
        bootstrap.BuildPrototype(build.Variant);
        return true;
    }

    public string SaveDraft()
    {
        EnsureInitialized();
        return store.Save(session.DraftBlueprint);
    }

    public void StartGhost(string definitionId)
    {
        ghostDefinitionId = definitionId ?? string.Empty;
        ghostActive = !string.IsNullOrWhiteSpace(ghostDefinitionId);
        RefreshHud();
    }

    public void PlaceGhost(Vector3 localPosition)
    {
        if (!ghostActive)
        {
            return;
        }

        session.AddModule(ghostDefinitionId, new Vector3(localPosition.x, gridLevel, localPosition.z));
        RebuildViewportVisuals();
        RefreshHud();
    }

    public void ToggleMirror()
    {
        session.SetMirrorX(!session.MirrorX);
        RefreshHud();
    }

    public void SetActiveCategory(PrototypeShipModuleCategory category)
    {
        activeCategory = category;
        RefreshHud();
    }

    public PrototypeShipBuilderInputAction ResolveEscapeAction()
    {
        if (confirmDialogOpen || loadDialogOpen)
        {
            confirmDialogOpen = false;
            loadDialogOpen = false;
            RefreshHud();
            return PrototypeShipBuilderInputAction.CloseDialog;
        }

        if (ghostActive)
        {
            ghostActive = false;
            ghostDefinitionId = string.Empty;
            RefreshHud();
            return PrototypeShipBuilderInputAction.CancelGhost;
        }

        ExitHangar(false);
        return PrototypeShipBuilderInputAction.ExitRequested;
    }

    private void EnsureInitialized()
    {
        if (session == null)
        {
            session = new PrototypeShipBuilderSession(PrototypeShipBuilderSession.CreateEditableCopy(PrototypeShipBlueprintCatalog.ScoutBlueprint(), "scout-copy-1"));
        }

        if (store == null)
        {
            store = new PrototypeShipBlueprintStore();
        }

        if (hud == null)
        {
            hud = GetComponent<PrototypeShipBuilderHud>();
            if (hud == null)
            {
                hud = gameObject.AddComponent<PrototypeShipBuilderHud>();
            }
        }
    }

    private void HandleBuilderInput(Keyboard keyboard)
    {
        if (hud != null && hud.IsNameInputFocused())
        {
            if (keyboard.escapeKey.wasPressedThisFrame)
            {
                ResolveEscapeAction();
            }
            return;
        }

        if (keyboard.escapeKey.wasPressedThisFrame)
        {
            ResolveEscapeAction();
        }
        else if (keyboard.f8Key.wasPressedThisFrame)
        {
            ExitHangar(false);
        }
        else if (keyboard.mKey.wasPressedThisFrame)
        {
            ToggleMirror();
        }
        else if (keyboard.qKey.wasPressedThisFrame)
        {
            gridLevel -= PrototypeShipBuilderSession.GridSize;
        }
        else if (keyboard.eKey.wasPressedThisFrame)
        {
            gridLevel += PrototypeShipBuilderSession.GridSize;
        }
        else if (keyboard.rKey.wasPressedThisFrame && !string.IsNullOrWhiteSpace(session.SelectedInstanceId))
        {
            session.RotateYaw90(session.SelectedInstanceId);
            RebuildViewportVisuals();
        }
        else if (keyboard.tKey.wasPressedThisFrame && !string.IsNullOrWhiteSpace(session.SelectedInstanceId))
        {
            session.RotatePitch90(session.SelectedInstanceId);
            RebuildViewportVisuals();
        }
        else if (keyboard.deleteKey.wasPressedThisFrame && !string.IsNullOrWhiteSpace(session.SelectedInstanceId))
        {
            session.RemoveModule(session.SelectedInstanceId);
            RebuildViewportVisuals();
        }
        else if (keyboard.ctrlKey.isPressed && keyboard.zKey.wasPressedThisFrame)
        {
            session.Undo();
            RebuildViewportVisuals();
        }
        else if (keyboard.ctrlKey.isPressed && keyboard.sKey.wasPressedThisFrame)
        {
            SaveDraft();
        }
        else if (keyboard.ctrlKey.isPressed && keyboard.dKey.wasPressedThisFrame && !string.IsNullOrWhiteSpace(session.SelectedInstanceId))
        {
            session.DuplicateModule(session.SelectedInstanceId);
            RebuildViewportVisuals();
        }
    }

    private void EnsureBuilderRoot()
    {
        if (builderRoot != null)
        {
            return;
        }

        builderRoot = GameObject.Find(BuilderRootName);
        if (builderRoot == null)
        {
            builderRoot = new GameObject(BuilderRootName);
            CreateGrid(builderRoot.transform);
            CreateBuilderLight(builderRoot.transform);
        }
    }

    private void RebuildViewportVisuals()
    {
        EnsureBuilderRoot();
        for (int i = 0; i < moduleVisuals.Count; i++)
        {
            if (moduleVisuals[i] != null)
            {
                Destroy(moduleVisuals[i]);
            }
        }
        moduleVisuals.Clear();

        PrototypeShipBlueprint draft = session.DraftBlueprint;
        var definitions = new Dictionary<string, PrototypeShipModuleDefinition>(System.StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < draft.Definitions.Length; i++)
        {
            PrototypeShipModuleDefinition definition = draft.Definitions[i];
            if (definition != null)
            {
                definitions[definition.DefinitionId] = definition;
            }
        }

        for (int i = 0; i < draft.Instances.Length; i++)
        {
            PrototypeShipModuleInstance instance = draft.Instances[i];
            if (instance == null || !definitions.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition))
            {
                continue;
            }

            GameObject visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            visual.name = "ShipBuilderModule_" + instance.InstanceId;
            visual.transform.SetParent(builderRoot.transform, false);
            visual.transform.localPosition = instance.LocalPosition;
            visual.transform.localRotation = Quaternion.Euler(instance.LocalEulerAngles);
            visual.transform.localScale = instance.HasScaleOverride ? instance.LocalScaleOverride : definition.LocalSize;
            ApplyMaterialColor(visual, ColorForCategory(definition.Category));
            moduleVisuals.Add(visual);
        }
    }

    private void RefreshHud()
    {
        if (hud == null)
        {
            return;
        }

        IReadOnlyList<PrototypeShipBlueprintStoreEntry> entries = store != null ? store.LoadAll() : null;
        hud.ApplySnapshot(PrototypeShipBuilderViewModel.FromSession(session, activeCategory, gridLevel, ghostActive, entries));
    }

    private void CloseHangar()
    {
        IsActive = false;
        IsAnyBuilderActive = false;
        confirmDialogOpen = false;
        loadDialogOpen = false;
        ghostActive = false;
        if (hud != null)
        {
            hud.SetVisible(false);
        }

        if (builderRoot != null)
        {
            builderRoot.SetActive(false);
        }

        if (shipRoot != null)
        {
            shipRoot.gameObject.SetActive(true);
        }

        RestoreFlightUi();
    }

    private void DisableFlightUi()
    {
        disabledFlightBehaviours.Clear();
        DisableIfEnabled(GetComponent<PrototypePlayerHudRenderer>());
        DisableIfEnabled(GetComponent<PrototypeFlightHud>());
        DisableIfEnabled(GetComponent<PrototypeDebugOverlay>());
        DisableIfEnabled(GetComponent<PrototypeKeybindOverlay>());
        DisableIfEnabled(GetComponent<PrototypeMinimapOverlay>());
        DisableIfEnabled(GetComponent<PrototypeWeaponComputerPanel>());
    }

    private void DisableIfEnabled(Behaviour behaviour)
    {
        if (behaviour == null || behaviour == this || !behaviour.enabled)
        {
            return;
        }

        disabledFlightBehaviours.Add(behaviour);
        behaviour.enabled = false;
    }

    private void RestoreFlightUi()
    {
        for (int i = 0; i < disabledFlightBehaviours.Count; i++)
        {
            if (disabledFlightBehaviours[i] != null)
            {
                disabledFlightBehaviours[i].enabled = true;
            }
        }
        disabledFlightBehaviours.Clear();
    }

    private static void CreateGrid(Transform parent)
    {
        GameObject grid = new GameObject("ShipBuilderGrid");
        grid.transform.SetParent(parent, false);
        for (int i = -24; i <= 24; i++)
        {
            CreateGridLine(grid.transform, new Vector3(i * 0.25f, 0f, -6f), new Vector3(i * 0.25f, 0f, 6f), i % 4 == 0);
            CreateGridLine(grid.transform, new Vector3(-6f, 0f, i * 0.25f), new Vector3(6f, 0f, i * 0.25f), i % 4 == 0);
        }
    }

    private static void CreateGridLine(Transform parent, Vector3 start, Vector3 end, bool major)
    {
        GameObject lineObject = new GameObject(major ? "GridMajor" : "GridMinor");
        lineObject.transform.SetParent(parent, false);
        LineRenderer line = lineObject.AddComponent<LineRenderer>();
        line.positionCount = 2;
        line.useWorldSpace = false;
        line.SetPosition(0, start);
        line.SetPosition(1, end);
        line.widthMultiplier = major ? 0.018f : 0.008f;
            Shader lineShader = Shader.Find("Sprites/Default");
            if (lineShader != null)
            {
                line.material = new Material(lineShader);
            }
        line.startColor = line.endColor = major ? PrototypeUiStyle.PanelBorder : new Color(PrototypeUiStyle.PanelBorder.r, PrototypeUiStyle.PanelBorder.g, PrototypeUiStyle.PanelBorder.b, 0.25f);
    }

    private static void CreateBuilderLight(Transform parent)
    {
        GameObject lightObject = new GameObject("ShipBuilderLight");
        lightObject.transform.SetParent(parent, false);
        lightObject.transform.localRotation = Quaternion.Euler(50f, 330f, 0f);
        Light light = lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.15f;
    }

    private static Color ColorForCategory(PrototypeShipModuleCategory category)
    {
        switch (category)
        {
            case PrototypeShipModuleCategory.Cockpit: return PrototypeModuleColorPalette.Cockpit;
            case PrototypeShipModuleCategory.FuelTank: return PrototypeModuleColorPalette.FuelTank;
            case PrototypeShipModuleCategory.MainThruster: return PrototypeModuleColorPalette.MainThruster;
            case PrototypeShipModuleCategory.RcsBlock: return PrototypeModuleColorPalette.RcsBlock;
            case PrototypeShipModuleCategory.Gun: return PrototypeModuleColorPalette.Gun;
            case PrototypeShipModuleCategory.Cargo:
            case PrototypeShipModuleCategory.Utility:
                return PrototypeModuleColorPalette.CargoUtility;
            default:
                return PrototypeModuleColorPalette.Hull;
        }
    }

    private static void ApplyMaterialColor(GameObject target, Color color)
    {
        Renderer renderer = target != null ? target.GetComponent<Renderer>() : null;
        if (renderer == null)
        {
            return;
        }

        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null)
        {
            shader = Shader.Find("Sprites/Default");
        }

        if (shader == null)
        {
            return;
        }

        renderer.sharedMaterial = new Material(shader);
        if (renderer.sharedMaterial != null)
        {
            renderer.sharedMaterial.color = color;
        }
    }
}

public enum PrototypeShipBuilderInputAction
{
    None,
    CloseDialog,
    CancelGhost,
    ExitRequested
}
