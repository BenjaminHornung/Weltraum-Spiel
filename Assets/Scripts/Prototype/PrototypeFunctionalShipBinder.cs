using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class PrototypeFunctionalShipBinder : MonoBehaviour
{
    public const string ImportedVisualRootName = "ImportedShipVisual";
    public const string DemoScoutInstanceName = "ImportedDemoScoutVisual";
    public const string DemoCargoInstanceName = "ImportedDemoCargoVisual";
    public const string FunctionalSocketRigName = "FunctionalSocketRig";
    public const string DemoScoutAssetPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx";
    public const string DemoCargoAssetPath = "Assets/Art/PrototypeShipKit/DemoShips/demo_cargo_mk1.fbx";
    private const string HiddenStaticTurretVisualPrefix = "PrototypeStaticHidden_";

    private static readonly Vector3 ImportedShipLocalEulerAngles = new Vector3(-90f, 180f, 0f);
    private const float ImportedShipLocalScale = 1f;
    private const float FunctionalSocketScaleTolerance = 0.02f;
    private const float MainNozzleForwardDotMinimum = 0.9f;

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
            EnsureGeneratedPrimitiveRcsPath();
            report.warnings.Add("Functional imported binder skipped because generated primitive fallback mode is active.");
            LastReport = report;
            return report;
        }

        ResolveVfxLibrary();
        GameObject prefab = ResolvePrefab(buildMode, report);
        if (prefab == null)
        {
            EnsureGeneratedPrimitiveRcsPath();
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
        Transform functionalSocketRig = EnsureFunctionalSocketRig();
        BuildFunctionalSocketProxyRig(importedInstance.transform, functionalSocketRig, report);
        PrototypeShipSocketUtility.EnsureSocketsInHierarchy(functionalSocketRig);
        AttachVisibleTurretGeometryToProxy(importedInstance.transform, functionalSocketRig, report);
        report.functionalSocketRig = functionalSocketRig;

        if (!ValidateFunctionalSocketScales(functionalSocketRig, report))
        {
            ValidateRequiredRuntimeSockets(report);
            LastReport = report;
            return report;
        }

        ValidateMainNozzleDirection(functionalSocketRig, report);
        if (report.missingRequiredSockets.Contains("THRUST_NOZZLE_MAIN*.forward aligned with PrototypeShip.forward"))
        {
            ValidateRequiredRuntimeSockets(report);
            LastReport = report;
            return report;
        }

        BindVisualVfx(importedInstance.transform, report);

        PrototypeImportedShipBinder importedBinder = GetOrAddComponent<PrototypeImportedShipBinder>(gameObject, createMissingRuntimeComponents);
        if (importedBinder != null)
        {
            importedBinder.Configure(functionalSocketRig, vfxLibrary, createMissingRuntimeComponents, createRuntimeVfxChildren);
            PrototypeImportedShipBinder.BindReport importedReport = importedBinder.BindNow();
            report.foundMainNozzles = importedReport.foundMainNozzles;
            report.foundRcsNozzles = importedReport.foundRcsNozzles;
            report.foundMuzzles = importedReport.foundMuzzles;
            report.foundHardpoints = importedReport.foundHardpoints;
            report.boundMainThrusters = importedReport.boundMainThrusters;
            report.boundRcsNozzles = importedReport.boundRcsNozzles;
            report.boundGunModules = importedReport.boundGuns;
            report.boundHardpoints = importedReport.boundHardpoints;
            report.createdRcsVfxChildren = importedReport.createdRcsVfxChildren;
            report.createdHardpointBindings = importedReport.createdHardpointBindings;
            report.duplicateHardpointsSkipped = importedReport.duplicateHardpointsSkipped;
            report.missingRequiredSockets.AddRange(importedReport.missingRequiredSockets);
            report.warnings.AddRange(importedReport.warnings);
        }

        PrototypeShipKitWeaponBinder weaponBinder = GetOrAddComponent<PrototypeShipKitWeaponBinder>(gameObject, createMissingRuntimeComponents);
        if (weaponBinder != null)
        {
            weaponBinder.Configure(functionalSocketRig, transform, createMissingRuntimeComponents, true);
            PrototypeShipKitWeaponBinder.BindReport weaponReport = weaponBinder.BindNow();
            report.foundTurretBases = weaponReport.foundBases;
            report.foundTurretYawPivots = weaponReport.foundYawPivots;
            report.foundTurretPitchPivots = weaponReport.foundPitchPivots;
            report.foundWeaponMuzzleMarkers = weaponReport.foundMuzzles;
            report.foundMuzzleFlashMarkers = weaponReport.foundMuzzleFlashes;
            report.boundTurretWeapons = weaponReport.boundTurretWeapons;
            report.boundWeaponComputers = weaponReport.boundWeaponComputers;
            report.visibleTurretYawRenderers = weaponReport.visibleYawRenderers;
            report.visibleTurretPitchRenderers = weaponReport.visiblePitchRenderers;
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

    private Transform EnsureFunctionalSocketRig()
    {
        Transform rig = transform.Find(FunctionalSocketRigName);
        if (rig == null)
        {
            rig = new GameObject(FunctionalSocketRigName).transform;
            rig.SetParent(transform, false);
        }

        for (int i = rig.childCount - 1; i >= 0; i--)
        {
            DestroyGameObject(rig.GetChild(i).gameObject);
        }

        rig.localPosition = Vector3.zero;
        rig.localRotation = Quaternion.identity;
        rig.localScale = Vector3.one;
        rig.gameObject.SetActive(true);
        return rig;
    }

    private void BuildFunctionalSocketProxyRig(Transform importedInstance, Transform proxyRoot, BindReport report)
    {
        if (importedInstance == null || proxyRoot == null)
        {
            return;
        }

        var proxyBySource = new Dictionary<Transform, Transform>();
        Transform[] sourceTransforms = importedInstance.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < sourceTransforms.Length; i++)
        {
            Transform sourceTransform = sourceTransforms[i];
            if (sourceTransform == importedInstance)
            {
                continue;
            }

            PrototypeShipSocket sourceSocket = sourceTransform.GetComponent<PrototypeShipSocket>();
            if (!IsFunctionalRuntimeSocket(sourceSocket) && !IsFunctionalRuntimeMarkerWithoutSocket(sourceTransform.name))
            {
                continue;
            }

            CreateProxyForSocket(sourceTransform, sourceSocket, proxyRoot, proxyBySource);
            report.createdFunctionalSocketProxies++;
        }
    }

    private Transform CreateProxyForSocket(
        Transform source,
        PrototypeShipSocket sourceSocket,
        Transform proxyRoot,
        Dictionary<Transform, Transform> proxyBySource)
    {
        if (source == null)
        {
            return null;
        }

        if (proxyBySource.TryGetValue(source, out Transform existing))
        {
            return existing;
        }

        Transform parentProxy = proxyRoot;
        Transform parent = source.parent;
        while (parent != null)
        {
            if (proxyBySource.TryGetValue(parent, out parentProxy))
            {
                break;
            }

            PrototypeShipSocket parentSocket = parent.GetComponent<PrototypeShipSocket>();
            if (IsFunctionalRuntimeSocket(parentSocket))
            {
                parentProxy = CreateProxyForSocket(parent, parentSocket, proxyRoot, proxyBySource);
                break;
            }

            parent = parent.parent;
        }

        GameObject proxyObject = new GameObject(source.name);
        Transform proxy = proxyObject.transform;
        proxy.SetParent(parentProxy != null ? parentProxy : proxyRoot, false);
        proxy.position = source.position;
        proxy.rotation = ResolveProxyRotation(source, sourceSocket);
        proxy.localScale = Vector3.one;
        proxyBySource[source] = proxy;
        return proxy;
    }

    private Quaternion ResolveProxyRotation(Transform source, PrototypeShipSocket sourceSocket)
    {
        if (sourceSocket != null && sourceSocket.SocketType == PrototypeShipSocketType.MainThrusterNozzle)
        {
            return BuildForceDirectionRotation(transform.forward);
        }

        if (sourceSocket != null
            && sourceSocket.SocketType == PrototypeShipSocketType.RcsNozzle
            && TryResolveRcsForceDirection(sourceSocket.Direction, out Vector3 forceDirection))
        {
            return BuildForceDirectionRotation(forceDirection);
        }

        return source != null ? source.rotation : transform.rotation;
    }

    private Quaternion BuildForceDirectionRotation(Vector3 forceDirectionWorld)
    {
        Vector3 forceDirection = forceDirectionWorld.sqrMagnitude > 0.0001f
            ? forceDirectionWorld.normalized
            : transform.forward;
        Vector3 up = Mathf.Abs(Vector3.Dot(forceDirection, transform.up)) > 0.9f
            ? transform.forward
            : transform.up;
        return Quaternion.LookRotation(forceDirection, up);
    }

    private bool TryResolveRcsForceDirection(PrototypeShipSocketDirection direction, out Vector3 forceDirectionWorld)
    {
        switch (direction)
        {
            case PrototypeShipSocketDirection.Forward:
                forceDirectionWorld = transform.forward;
                return true;
            case PrototypeShipSocketDirection.Back:
                forceDirectionWorld = -transform.forward;
                return true;
            case PrototypeShipSocketDirection.Left:
                forceDirectionWorld = -transform.right;
                return true;
            case PrototypeShipSocketDirection.Right:
                forceDirectionWorld = transform.right;
                return true;
            case PrototypeShipSocketDirection.Up:
                forceDirectionWorld = transform.up;
                return true;
            case PrototypeShipSocketDirection.Down:
                forceDirectionWorld = -transform.up;
                return true;
            default:
                forceDirectionWorld = Vector3.zero;
                return false;
        }
    }

    private void AttachVisibleTurretGeometryToProxy(Transform importedInstance, Transform functionalSocketRig, BindReport report)
    {
        if (importedInstance == null || functionalSocketRig == null)
        {
            return;
        }

        Transform sourceYaw = FindFirstDescendant(importedInstance, PrototypeShipSocketUtility.IsWeaponTurretYawName);
        Transform sourcePitch = FindFirstDescendant(importedInstance, PrototypeShipSocketUtility.IsWeaponTurretPitchName);
        Transform proxyYaw = FindFirstDescendant(functionalSocketRig, PrototypeShipSocketUtility.IsWeaponTurretYawName);
        Transform proxyPitch = FindFirstDescendant(functionalSocketRig, PrototypeShipSocketUtility.IsWeaponTurretPitchName);

        CloneVisualChildrenToProxy(sourceYaw, proxyYaw, report);
        CloneVisualChildrenToProxy(sourcePitch, proxyPitch, report);
    }

    private static void CloneVisualChildrenToProxy(Transform sourcePivot, Transform proxyPivot, BindReport report)
    {
        if (sourcePivot == null || proxyPivot == null)
        {
            return;
        }

        for (int i = sourcePivot.childCount - 1; i >= 0; i--)
        {
            Transform child = sourcePivot.GetChild(i);
            if (IsFunctionalMarkerName(child.name))
            {
                continue;
            }

            string visualName = OriginalStaticTurretVisualName(child.name);
            GameObject clone = Object.Instantiate(child.gameObject, proxyPivot, true);
            clone.name = visualName;
            SetRenderersEnabled(clone.transform, true);
            if (!child.name.StartsWith(HiddenStaticTurretVisualPrefix, System.StringComparison.Ordinal))
            {
                child.name = HiddenStaticTurretVisualPrefix + child.name;
            }

            SetRenderersEnabled(child, false);
            report.reparentedVisibleTurretChildren++;
        }
    }

    private static string OriginalStaticTurretVisualName(string currentName)
    {
        if (string.IsNullOrEmpty(currentName))
        {
            return "TurretVisual";
        }

        return currentName.StartsWith(HiddenStaticTurretVisualPrefix, System.StringComparison.Ordinal)
            ? currentName.Substring(HiddenStaticTurretVisualPrefix.Length)
            : currentName;
    }

    private static void SetRenderersEnabled(Transform root, bool enabled)
    {
        if (root == null)
        {
            return;
        }

        Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
        for (int i = 0; i < renderers.Length; i++)
        {
            if (renderers[i] != null)
            {
                renderers[i].enabled = enabled;
            }
        }
    }

    private static Transform FindFirstDescendant(Transform root, System.Predicate<string> namePredicate)
    {
        if (root == null || namePredicate == null)
        {
            return null;
        }

        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            if (namePredicate(transforms[i].name))
            {
                return transforms[i];
            }
        }

        return null;
    }

    private bool ValidateFunctionalSocketScales(Transform importedInstance, BindReport report)
    {
        if (importedInstance == null)
        {
            return false;
        }

        bool valid = true;
        PrototypeShipSocket[] sockets = importedInstance.GetComponentsInChildren<PrototypeShipSocket>(true);
        for (int i = 0; i < sockets.Length; i++)
        {
            PrototypeShipSocket socket = sockets[i];
            if (!IsFunctionalRuntimeSocket(socket))
            {
                continue;
            }

            Vector3 lossyScale = socket.transform.lossyScale;
            if (IsApproximatelyUnitScale(lossyScale))
            {
                continue;
            }

            valid = false;
            report.unsafeFunctionalSocketScaleCount++;
            if (string.IsNullOrEmpty(report.firstUnsafeFunctionalSocketName))
            {
                report.firstUnsafeFunctionalSocketName = socket.name;
                report.firstUnsafeFunctionalSocketLossyScale = lossyScale;
                report.missingRequiredSockets.Add("unsafe functional socket scale");
                report.warnings.Add(
                    $"Functional socket '{socket.name}' has unsafe lossyScale {lossyScale}. Imported physics binding was aborted.");
            }
        }

        return valid;
    }

    private void ValidateMainNozzleDirection(Transform importedInstance, BindReport report)
    {
        List<PrototypeShipSocket> mainNozzles = PrototypeShipSocketUtility.FindSockets(
            importedInstance,
            PrototypeShipSocketType.MainThrusterNozzle,
            false);
        if (mainNozzles.Count == 0)
        {
            return;
        }

        float bestDot = -1f;
        string bestName = string.Empty;
        Vector3 shipForward = transform.forward.normalized;
        for (int i = 0; i < mainNozzles.Count; i++)
        {
            Transform nozzle = mainNozzles[i] != null ? mainNozzles[i].transform : null;
            if (nozzle == null)
            {
                continue;
            }

            float dot = Vector3.Dot(nozzle.forward.normalized, shipForward);
            if (dot > bestDot)
            {
                bestDot = dot;
                bestName = nozzle.name;
            }
        }

        report.bestMainNozzleForwardDot = bestDot;
        report.bestMainNozzleForwardName = bestName;
        if (bestDot < MainNozzleForwardDotMinimum)
        {
            report.missingRequiredSockets.Add("THRUST_NOZZLE_MAIN*.forward aligned with PrototypeShip.forward");
            report.warnings.Add(
                $"Best imported main nozzle forward alignment is {bestDot:0.000} on '{bestName}', expected >= {MainNozzleForwardDotMinimum:0.000}.");
        }
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

        if (report.visibleTurretYawRenderers <= 0)
        {
            report.missingRequiredSockets.Add("visible yaw renderer under WEAPON_TURRET_YAW_*");
        }

        if (report.visibleTurretPitchRenderers <= 0)
        {
            report.missingRequiredSockets.Add("visible pitch renderer under WEAPON_TURRET_PITCH_*");
        }

        report.hasRequiredFunctionalSockets =
            report.foundMainNozzles > 0
            && report.foundRcsNozzles > 0
            && (report.foundWeaponMuzzleMarkers > 0 || report.foundMuzzles > 0)
            && report.boundMainThrusters > 0
            && report.boundRcsNozzles > 0
            && report.boundTurretWeapons > 0
            && report.visibleTurretYawRenderers > 0
            && report.visibleTurretPitchRenderers > 0;
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

    private static bool IsFunctionalRuntimeSocket(PrototypeShipSocket socket)
    {
        if (socket == null || !socket.IsRuntimeSocket)
        {
            return false;
        }

        return socket.SocketType == PrototypeShipSocketType.MainThrusterNozzle
            || socket.SocketType == PrototypeShipSocketType.MainThrusterGimbalPivot
            || socket.SocketType == PrototypeShipSocketType.RcsNozzle
            || socket.SocketType == PrototypeShipSocketType.WeaponMuzzle
            || socket.SocketType == PrototypeShipSocketType.TurretYawPivot
            || socket.SocketType == PrototypeShipSocketType.TurretPitchPivot
            || (socket.SocketType == PrototypeShipSocketType.Hardpoint
                && PrototypeShipSocketUtility.IsWeaponTurretBaseName(socket.name));
    }

    private static bool IsFunctionalRuntimeMarkerWithoutSocket(string objectName)
    {
        return PrototypeShipSocketUtility.IsWeaponMuzzleFlashName(objectName)
            || PrototypeShipSocketUtility.IsWeaponSafetyMarkerName(objectName);
    }

    private static bool IsFunctionalMarkerName(string objectName)
    {
        return PrototypeShipSocketUtility.IsMainThrusterNozzleName(objectName)
            || PrototypeShipSocketUtility.IsMainThrusterGimbalName(objectName)
            || PrototypeShipSocketUtility.IsRcsNozzleName(objectName)
            || PrototypeShipSocketUtility.IsWeaponTurretBaseName(objectName)
            || PrototypeShipSocketUtility.IsWeaponTurretYawName(objectName)
            || PrototypeShipSocketUtility.IsWeaponTurretPitchName(objectName)
            || PrototypeShipSocketUtility.IsWeaponMuzzleName(objectName)
            || PrototypeShipSocketUtility.IsWeaponMuzzleFlashName(objectName)
            || PrototypeShipSocketUtility.IsWeaponSafetyMarkerName(objectName);
    }

    private static bool IsApproximatelyUnitScale(Vector3 scale)
    {
        return Mathf.Abs(scale.x - 1f) <= FunctionalSocketScaleTolerance
            && Mathf.Abs(scale.y - 1f) <= FunctionalSocketScaleTolerance
            && Mathf.Abs(scale.z - 1f) <= FunctionalSocketScaleTolerance;
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

    private void EnsureGeneratedPrimitiveRcsPath()
    {
        RcsThrusterController rcs = GetComponent<RcsThrusterController>();
        if (rcs == null)
        {
            return;
        }

        rcs.SetUseImportedFunctionalSockets(false);
        rcs.MarkNozzlesDirty();
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        DestroyImmediate(target);
    }

    [System.Serializable]
    public sealed class BindReport
    {
        public PrototypeShipBuildMode requestedBuildMode;
        public Transform importedVisualRoot;
        public Transform importedShipInstance;
        public Transform functionalSocketRig;
        public bool createdImportedInstance;
        public bool hasRequiredFunctionalSockets;
        public int createdFunctionalSocketProxies;
        public int reparentedVisibleTurretChildren;
        public int foundMainNozzles;
        public int foundRcsNozzles;
        public int foundMuzzles;
        public int foundHardpoints;
        public int foundTurretBases;
        public int foundTurretYawPivots;
        public int foundTurretPitchPivots;
        public int foundWeaponMuzzleMarkers;
        public int foundMuzzleFlashMarkers;
        public int visibleTurretYawRenderers;
        public int visibleTurretPitchRenderers;
        public int boundMainThrusters;
        public int boundRcsNozzles;
        public int boundTurretWeapons;
        public int boundGunModules;
        public int boundWeaponComputers;
        public int boundHardpoints;
        public int createdRcsVfxChildren;
        public int createdHardpointBindings;
        public int duplicateHardpointsSkipped;
        public int visualMainVfxBindings;
        public int visualRcsVfxBindings;
        public int visualVfxCreatedInstances;
        public int unsafeFunctionalSocketScaleCount;
        public float bestMainNozzleForwardDot;
        public string boundMuzzleName;
        public string firstUnsafeFunctionalSocketName;
        public string bestMainNozzleForwardName;
        public Vector3 firstUnsafeFunctionalSocketLossyScale;
        public List<string> missingRequiredSockets = new List<string>();
        public List<string> warnings = new List<string>();
    }
}
