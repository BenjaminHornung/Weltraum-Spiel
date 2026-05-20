using UnityEngine;

public enum PrototypeShipVisualArchetype
{
    CockpitWedge,
    HullCore,
    HullLongSegment,
    FuelTankPod,
    MainEngineBell,
    RcsPod,
    GunMount,
    CargoBox,
    UtilityBlock,
    ConnectorHardpointMarker
}

public sealed class PrototypeShipPartVisualMetadata
{
    public string PartId { get; }
    public string DisplayName { get; }
    public string Category { get; }
    public PrototypeShipVisualArchetype VisualArchetype { get; }
    public Vector3 LocalSize { get; }
    public PrototypeModuleMassRole MassRole { get; }
    public bool ShowConnectorMarker { get; }
    public bool ShowHardpointMarker { get; }
    public string GameplayRole { get; }

    public PrototypeShipPartVisualMetadata(
        string partId,
        string displayName,
        string category,
        PrototypeShipVisualArchetype visualArchetype,
        Vector3 localSize,
        PrototypeModuleMassRole massRole,
        bool showConnectorMarker,
        bool showHardpointMarker,
        string gameplayRole)
    {
        PartId = string.IsNullOrWhiteSpace(partId) ? "Part" : partId;
        DisplayName = string.IsNullOrWhiteSpace(displayName) ? PartId : displayName;
        Category = string.IsNullOrWhiteSpace(category) ? "Utility" : category;
        VisualArchetype = visualArchetype;
        LocalSize = localSize;
        MassRole = massRole;
        ShowConnectorMarker = showConnectorMarker;
        ShowHardpointMarker = showHardpointMarker;
        GameplayRole = string.IsNullOrWhiteSpace(gameplayRole) ? Category : gameplayRole;
    }
}

public static class PrototypeShipPartVisualFactory
{
    public const string VisualRootName = "__KitVisual";

    public static PrototypeShipPartVisualMetadata ResolveMetadata(
        string partId,
        Vector3 localSize,
        PrototypeModuleMassRole massRole,
        string gameplayRole)
    {
        PrototypeShipVisualArchetype archetype = ResolveArchetype(partId, localSize, massRole);
        string normalized = string.IsNullOrWhiteSpace(partId) ? string.Empty : partId.ToLowerInvariant();

        return new PrototypeShipPartVisualMetadata(
            partId,
            string.IsNullOrWhiteSpace(normalized) ? archetype.ToString() : partId,
            ResolveCategory(massRole, normalized),
            archetype,
            localSize,
            massRole,
            ShowConnectorMarker(partId, normalized, massRole),
            ShowHardpointMarker(partId, normalized, massRole),
            string.IsNullOrWhiteSpace(gameplayRole) ? massRole.ToString() : gameplayRole);
    }

    public static void ApplyGeneratedVisual(GameObject partRoot, PrototypeShipPartVisualMetadata metadata, Color baseColor)
    {
        if (partRoot == null || metadata == null)
        {
            return;
        }

        EnsureRootRenderer(partRoot, baseColor);
        Transform visualRoot = EnsureVisualRoot(partRoot.transform);
        ClearGeneratedChildren(visualRoot);
        BuildVisualByArchetype(visualRoot, metadata, baseColor);
        if (metadata.ShowConnectorMarker)
        {
            CreateConnectorMarker(visualRoot);
        }

        if (metadata.ShowHardpointMarker)
        {
            CreateHardpointMarker(visualRoot);
        }
    }

    private static string ResolveCategory(PrototypeModuleMassRole massRole, string normalizedId)
    {
        if (!string.IsNullOrWhiteSpace(normalizedId))
        {
            if (normalizedId.Contains("connector") || normalizedId.Contains("hardpoint"))
            {
                return "connector";
            }
        }

        if (massRole == PrototypeModuleMassRole.Cockpit)
        {
            return "cockpit";
        }

        if (massRole == PrototypeModuleMassRole.FuelTank)
        {
            return "fuel";
        }

        if (massRole == PrototypeModuleMassRole.Engine)
        {
            return "engine";
        }

        if (massRole == PrototypeModuleMassRole.Gun)
        {
            return "weapon";
        }

        if (massRole == PrototypeModuleMassRole.RcsBlock)
        {
            return "control";
        }

        if (massRole == PrototypeModuleMassRole.Custom)
        {
            if (normalizedId.Contains("cargo"))
            {
                return "cargo";
            }

            return "utility";
        }

        return "hull";
    }

    private static PrototypeShipVisualArchetype ResolveArchetype(string partId, Vector3 localSize, PrototypeModuleMassRole role)
    {
        string normalized = string.IsNullOrWhiteSpace(partId) ? string.Empty : partId.ToLowerInvariant();

        if (normalized.Contains("connector") || normalized.Contains("hardpoint"))
        {
            return PrototypeShipVisualArchetype.ConnectorHardpointMarker;
        }

        if (role == PrototypeModuleMassRole.Cockpit || normalized.Contains("cockpit"))
        {
            return PrototypeShipVisualArchetype.CockpitWedge;
        }

        if (role == PrototypeModuleMassRole.Gun || normalized.Contains("gun"))
        {
            return PrototypeShipVisualArchetype.GunMount;
        }

        if (role == PrototypeModuleMassRole.RcsBlock || normalized.StartsWith("rcs_"))
        {
            return PrototypeShipVisualArchetype.RcsPod;
        }

        if (role == PrototypeModuleMassRole.Engine || normalized.Contains("mainthruster") || normalized.Contains("engine"))
        {
            return PrototypeShipVisualArchetype.MainEngineBell;
        }

        if (role == PrototypeModuleMassRole.FuelTank || normalized.Contains("fueltank") || normalized.Contains("tank"))
        {
            return PrototypeShipVisualArchetype.FuelTankPod;
        }

        if ((role == PrototypeModuleMassRole.Custom && normalized.Contains("cargo"))
            || normalized.Contains("cargo")
            || normalized.Contains("utility")
            || normalized.Contains("box")
            || normalized.Contains("pod")
            || normalized.Contains("module"))
        {
            return PrototypeShipVisualArchetype.CargoBox;
        }

        if (role == PrototypeModuleMassRole.Custom)
        {
            return PrototypeShipVisualArchetype.UtilityBlock;
        }

        if (role == PrototypeModuleMassRole.Hull)
        {
            return Mathf.Abs(localSize.z) >= 4.5f
                ? PrototypeShipVisualArchetype.HullLongSegment
                : PrototypeShipVisualArchetype.HullCore;
        }

        return PrototypeShipVisualArchetype.HullCore;
    }

    private static bool ShowConnectorMarker(string partId, string normalizedId, PrototypeModuleMassRole role)
    {
        if (string.IsNullOrWhiteSpace(partId))
        {
            return false;
        }

        if (role == PrototypeModuleMassRole.Gun || role == PrototypeModuleMassRole.RcsBlock)
        {
            return false;
        }

        return normalizedId.Contains("connector") || normalizedId.Contains("hardpoint") || normalizedId.Contains("node");
    }

    private static bool ShowHardpointMarker(string partId, string normalizedId, PrototypeModuleMassRole role)
    {
        if (string.IsNullOrWhiteSpace(partId))
        {
            return false;
        }

        return normalizedId.Contains("connector") || normalizedId.Contains("hardpoint") || normalizedId.Contains("marker") || normalizedId.Contains("node");
    }

    private static Transform EnsureVisualRoot(Transform partRoot)
    {
        var existing = partRoot.Find(VisualRootName);
        if (existing != null)
        {
            return existing;
        }

        var container = new GameObject(VisualRootName).transform;
        container.SetParent(partRoot, false);
        return container;
    }

    private static void ClearGeneratedChildren(Transform visualRoot)
    {
        for (int i = visualRoot.childCount - 1; i >= 0; i--)
        {
            if (Application.isPlaying)
            {
                Object.Destroy(visualRoot.GetChild(i).gameObject);
            }
            else
            {
                Object.DestroyImmediate(visualRoot.GetChild(i).gameObject);
            }
        }
    }

    private static void EnsureRootRenderer(GameObject partRoot, Color baseColor)
    {
        var renderer = partRoot.GetComponent<Renderer>();
        if (renderer == null)
        {
            return;
        }

        renderer.enabled = false;
        ApplyMaterial(renderer, baseColor, false, 0.03f, 0.15f, 0f);
    }

    private static void BuildVisualByArchetype(Transform visualRoot, PrototypeShipPartVisualMetadata metadata, Color baseColor)
    {
        Vector3 safe = Vector3.one;

        Color accent = Color.Lerp(baseColor, Color.white, 0.18f);

        switch (metadata.VisualArchetype)
        {
            case PrototypeShipVisualArchetype.CockpitWedge:
                CreateCockpitVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.HullCore:
                CreateHullCoreVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.HullLongSegment:
                CreateHullLongSegmentVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.FuelTankPod:
                CreateFuelTankPodVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.MainEngineBell:
                CreateMainEngineBellVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.RcsPod:
                CreateRcsPodVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.GunMount:
                CreateGunMountVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.CargoBox:
                CreateCargoBoxVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.UtilityBlock:
                CreateUtilityBlockVisual(visualRoot, safe, baseColor, accent);
                return;
            case PrototypeShipVisualArchetype.ConnectorHardpointMarker:
                CreateConnectorMarker(visualRoot, safe, baseColor, accent);
                return;
            default:
                CreateHullCoreVisual(visualRoot, safe, baseColor, accent);
                break;
        }
    }

    private static void CreateCockpitVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        float forward = localSize.z * 0.72f;
        CreatePrimitiveVisual(parent, "CockpitShell", PrimitiveType.Cube, Vector3.zero, new Vector3(localSize.x * 0.98f, localSize.y * 0.75f, forward), Quaternion.identity, baseColor, false, 0.03f, 0.22f);
        CreatePrimitiveVisual(parent, "CockpitCanopy", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.16f, localSize.z * 0.28f), new Vector3(localSize.x * 0.56f, localSize.y * 0.52f, localSize.z * 0.28f), Quaternion.Euler(8f, 0f, 0f), Color.Lerp(baseColor, Color.white, 0.32f), true, 0.7f, 0.44f);
        CreatePrimitiveVisual(parent, "CockpitNose", PrimitiveType.Cylinder, new Vector3(0f, 0f, localSize.z * 0.4f), new Vector3(localSize.x * 0.56f, localSize.z * 0.22f, localSize.z * 0.48f), Quaternion.Euler(90f, 0f, 0f), accent, false, 0.05f, 0.2f);
    }

    private static void CreateHullCoreVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "HullDorsal", PrimitiveType.Cube, Vector3.zero, new Vector3(localSize.x * 0.98f, localSize.y * 0.9f, localSize.z * 0.98f), Quaternion.identity, baseColor, false, 0.02f, 0.2f);
        CreatePrimitiveVisual(parent, "HullBand", PrimitiveType.Cube, new Vector3(0f, localSize.y * -0.18f, 0f), new Vector3(localSize.x * 0.92f, localSize.y * 0.11f, localSize.z * 0.98f), Quaternion.identity, accent, false, 0.02f, 0.2f);
    }

    private static void CreateHullLongSegmentVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "HullTube", PrimitiveType.Cube, Vector3.zero, localSize * 0.98f, Quaternion.identity, baseColor, false, 0.02f, 0.2f);
        float spineHeight = localSize.y * 0.08f;
        CreatePrimitiveVisual(parent, "HullMidBandA", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.2f, localSize.z * 0.08f), new Vector3(localSize.x * 0.95f, spineHeight, localSize.z * 0.82f), Quaternion.identity, accent, false, 0.02f, 0.2f);
        CreatePrimitiveVisual(parent, "HullMidBandB", PrimitiveType.Cube, new Vector3(0f, -localSize.y * 0.2f, localSize.z * -0.06f), new Vector3(localSize.x * 0.95f, spineHeight, localSize.z * 0.82f), Quaternion.identity, accent, false, 0.02f, 0.2f);
        CreatePrimitiveVisual(parent, "HullFrame", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.5f, localSize.z * 0.02f), new Vector3(localSize.x * 0.88f, localSize.y * 0.16f, localSize.z * 0.2f), Quaternion.identity, Color.Lerp(baseColor, Color.black, 0.1f), false, 0.03f, 0.24f);
    }

    private static void CreateFuelTankPodVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "TankBody", PrimitiveType.Cylinder, Vector3.zero, new Vector3(localSize.x * 0.62f, localSize.z * 0.62f, localSize.z * 0.9f), Quaternion.Euler(90f, 0f, 0f), baseColor, false, 0.03f, 0.14f);
        CreatePrimitiveVisual(parent, "FuelRingA", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.24f, localSize.z * 0.03f), new Vector3(localSize.x * 0.66f, localSize.y * 0.09f, localSize.z * 0.74f), Quaternion.identity, accent, false, 0.03f, 0.18f);
        CreatePrimitiveVisual(parent, "FuelBandA", PrimitiveType.Cube, new Vector3(0f, -localSize.y * 0.25f, localSize.z * 0.12f), new Vector3(localSize.x * 0.66f, localSize.y * 0.12f, localSize.z * 0.22f), Quaternion.identity, Color.Lerp(baseColor, Color.black, 0.1f), false, 0.03f, 0.2f);
        CreatePrimitiveVisual(parent, "FuelStrapA", PrimitiveType.Cube, new Vector3(localSize.x * 0.18f, localSize.y * 0.05f, localSize.z * -0.18f), new Vector3(localSize.x * 0.22f, localSize.y * 0.03f, localSize.z * 0.26f), Quaternion.identity, accent, false, 0.03f, 0.2f);
    }

    private static void CreateMainEngineBellVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "EngineBell", PrimitiveType.Cylinder, new Vector3(0f, 0f, localSize.z * 0.1f), new Vector3(localSize.x * 0.56f, localSize.z * 0.8f, localSize.z * 0.62f), Quaternion.Euler(90f, 0f, 0f), baseColor, false, 0.08f, 0.3f);
        CreatePrimitiveVisual(parent, "EngineNozzle", PrimitiveType.Cylinder, new Vector3(0f, 0f, -localSize.z * 0.2f), new Vector3(localSize.x * 0.34f, localSize.z * 0.7f, localSize.z * 0.58f), Quaternion.Euler(90f, 0f, 0f), accent, true, 0.8f, 0.4f);
        CreatePrimitiveVisual(parent, "EngineFlange", PrimitiveType.Cube, new Vector3(0f, -localSize.y * 0.18f, -localSize.z * 0.18f), new Vector3(localSize.x * 0.5f, localSize.y * 0.15f, localSize.z * 0.42f), Quaternion.identity, Color.Lerp(baseColor, Color.black, 0.1f), false, 0.04f, 0.25f);
    }

    private static void CreateRcsPodVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "RcsBody", PrimitiveType.Cube, Vector3.zero, new Vector3(localSize.x, localSize.y * 0.8f, localSize.z * 0.85f), Quaternion.identity, baseColor, false, 0.05f, 0.2f);
        float insetX = localSize.x * 0.18f;
        float insetY = localSize.y * 0.1f;
        float insetZ = localSize.z * 0.55f;
        CreatePrimitiveVisual(parent, "RcsTabA", PrimitiveType.Cube, new Vector3(0f, 0f, insetZ), new Vector3(localSize.x * 0.7f, localSize.y * 0.42f, localSize.z * 0.12f), Quaternion.identity, accent, false, 0.05f, 0.22f);
        CreatePrimitiveVisual(parent, "RcsTabB", PrimitiveType.Cube, new Vector3(0f, 0f, -insetZ), new Vector3(localSize.x * 0.7f, localSize.y * 0.42f, localSize.z * 0.12f), Quaternion.identity, accent, false, 0.05f, 0.22f);
        CreatePrimitiveVisual(parent, "RcsConnector", PrimitiveType.Cylinder, new Vector3(localSize.x * -0.5f, insetY, 0f), new Vector3(insetX, localSize.x * 0.45f, localSize.z * 0.28f), Quaternion.Euler(90f, 0f, 0f), Color.Lerp(baseColor, Color.white, 0.35f), false, 0.05f, 0.2f);
        CreatePrimitiveVisual(parent, "RcsConnector", PrimitiveType.Cylinder, new Vector3(localSize.x * 0.5f, -insetY, 0f), new Vector3(insetX, localSize.x * 0.45f, localSize.z * 0.28f), Quaternion.Euler(90f, 0f, 0f), Color.Lerp(baseColor, Color.white, 0.35f), false, 0.05f, 0.2f);
    }

    private static void CreateGunMountVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "GunRecoilRing", PrimitiveType.Cylinder, Vector3.zero, new Vector3(localSize.x * 0.44f, localSize.z * 0.4f, localSize.z * 0.62f), Quaternion.Euler(90f, 0f, 0f), baseColor, false, 0.03f, 0.2f);
        CreatePrimitiveVisual(parent, "GunBarrel", PrimitiveType.Cylinder, new Vector3(0f, 0f, localSize.z * 0.25f), new Vector3(localSize.z * 0.22f, localSize.z * 0.12f, localSize.z * 0.7f), Quaternion.Euler(90f, 0f, 0f), accent, true, 0.9f, 0.4f);
        CreatePrimitiveVisual(parent, "GunMount", PrimitiveType.Cube, new Vector3(0f, 0f, localSize.z * -0.09f), new Vector3(localSize.x * 0.7f, localSize.y * 0.45f, localSize.z * 0.32f), Quaternion.identity, Color.Lerp(baseColor, Color.black, 0.2f), false, 0.03f, 0.2f);
    }

    private static void CreateCargoBoxVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "CargoShell", PrimitiveType.Cube, Vector3.zero, localSize * 0.94f, Quaternion.identity, baseColor, false, 0.03f, 0.2f);
        CreatePrimitiveVisual(parent, "CargoCap", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.35f, localSize.z * 0.18f), new Vector3(localSize.x * 0.72f, localSize.y * 0.2f, localSize.z * 0.72f), Quaternion.identity, accent, false, 0.03f, 0.2f);
        CreatePrimitiveVisual(parent, "CargoLockA", PrimitiveType.Cylinder, new Vector3(localSize.x * 0.28f, localSize.y * -0.26f, -localSize.z * 0.23f), new Vector3(localSize.y * 0.2f, localSize.x * 0.2f, localSize.x * 0.08f), Quaternion.Euler(90f, 0f, 0f), Color.Lerp(baseColor, Color.black, 0.1f), false, 0.05f, 0.2f);
    }

    private static void CreateUtilityBlockVisual(Transform parent, Vector3 localSize, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(parent, "UtilityShell", PrimitiveType.Cube, Vector3.zero, localSize * 0.96f, Quaternion.identity, baseColor, false, 0.03f, 0.2f);
        Vector3 stripe = new Vector3(localSize.x * 0.84f, localSize.y * 0.12f, localSize.z * 0.12f);
        CreatePrimitiveVisual(parent, "UtilityStripeA", PrimitiveType.Cube, new Vector3(0f, localSize.y * 0.44f, -localSize.z * 0.18f), stripe, Quaternion.identity, accent, false, 0.03f, 0.22f);
        CreatePrimitiveVisual(parent, "UtilityStripeB", PrimitiveType.Cube, new Vector3(0f, localSize.y * -0.44f, localSize.z * 0.18f), stripe, Quaternion.identity, Color.Lerp(baseColor, Color.black, 0.24f), false, 0.03f, 0.22f);
    }

    private static void CreateConnectorMarker(Transform visualRoot)
    {
        if (visualRoot == null)
        {
            return;
        }

        CreateConnectorMarker(visualRoot, Vector3.one, new Color(0.36f, 0.42f, 0.48f, 1f), new Color(0.72f, 0.84f, 0.92f, 1f));
    }

    private static void CreateConnectorMarker(Transform visualRoot, Vector3 size, Color baseColor, Color accent)
    {
        CreatePrimitiveVisual(visualRoot, "ConnectorMarker", PrimitiveType.Cylinder, Vector3.zero, Vector3.Max(size * 0.18f, new Vector3(0.08f, 0.02f, 0.22f)), Quaternion.Euler(90f, 0f, 0f), baseColor, false, 0.03f, 0.2f);
        CreatePrimitiveVisual(visualRoot, "ConnectorMarkCap", PrimitiveType.Sphere, new Vector3(0f, size.y * 0.2f, size.z * -0.2f), Vector3.Max(size * 0.09f, Vector3.one * 0.06f), Quaternion.identity, accent, true, 0.6f, 0.3f);
    }

    private static void CreateHardpointMarker(Transform visualRoot)
    {
        if (visualRoot == null)
        {
            return;
        }

        CreatePrimitiveVisual(
            visualRoot,
            "HardpointMarker",
            PrimitiveType.Cube,
            new Vector3(0f, 0f, 0f),
            new Vector3(0.12f, 0.12f, 0.32f),
            Quaternion.Euler(0f, 45f, 0f),
            PrototypeModuleColorPalette.RcsVfx,
            true,
            1.0f,
            0.5f);
        CreatePrimitiveVisual(visualRoot, "HardpointPin", PrimitiveType.Cylinder, new Vector3(0f, 0f, -0.16f), new Vector3(0.03f, 0.06f, 0.06f), Quaternion.Euler(90f, 0f, 0f), PrototypeModuleColorPalette.Cockpit, false, 0.03f, 0.18f);
    }

    private static void CreatePrimitiveVisual(
        Transform parent,
        string name,
        PrimitiveType primitive,
        Vector3 localPosition,
        Vector3 localScale,
        Quaternion localRotation,
        Color color,
        bool emissive,
        float emissionMultiplier,
        float smoothness)
    {
        var visual = GameObject.CreatePrimitive(primitive);
        visual.name = name;
        visual.transform.SetParent(parent, false);
        visual.transform.localPosition = localPosition;
        visual.transform.localRotation = localRotation;
        visual.transform.localScale = localScale;

        var renderer = visual.GetComponent<Renderer>();
        ApplyMaterial(renderer, color, emissive, emissionMultiplier, smoothness, 0f);
        RemoveCollider(visual);
    }

    private static void RemoveCollider(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        Collider collider = target.GetComponent<Collider>();
        if (collider != null)
        {
            if (Application.isPlaying)
            {
                collider.enabled = false;
                Object.Destroy(collider);
            }
            else
            {
                Object.DestroyImmediate(collider);
            }
        }
    }

    private static void ApplyMaterial(
        Renderer renderer,
        Color color,
        bool emissive,
        float emissionMultiplier,
        float smoothness,
        float metallic)
    {
        if (renderer == null)
        {
            return;
        }

        Material material = Application.isPlaying ? renderer.material : renderer.sharedMaterial;
        if (material == null || material.name == "Default-Material")
        {
            material = CreateURPLitMaterial();
            if (Application.isPlaying)
            {
                renderer.material = material;
            }
            else
            {
                renderer.sharedMaterial = material;
            }
        }

        if (material.HasProperty("_BaseColor"))
        {
            material.SetColor("_BaseColor", color);
            material.SetColor("_Color", color);
        }
        else
        {
            material.color = color;
        }

        if (material.HasProperty("_Smoothness"))
        {
            material.SetFloat("_Smoothness", smoothness);
        }

        if (material.HasProperty("_Metallic"))
        {
            material.SetFloat("_Metallic", metallic);
        }

        if (emissive && material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * emissionMultiplier);
            return;
        }
        if (material.HasProperty("_EmissionColor"))
        {
            material.SetColor("_EmissionColor", Color.black);
            material.DisableKeyword("_EMISSION");
        }
    }

    private static Material CreateURPLitMaterial()
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        return new Material(shader == null ? Shader.Find("Standard") : shader);
    }

}
