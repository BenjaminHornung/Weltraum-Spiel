using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class PrototypeImportedShipBinder : MonoBehaviour
{
    [SerializeField] private Transform socketRoot;
    [SerializeField] private PrototypeShipVfxLibrary vfxLibrary;
    [SerializeField] private bool bindOnAwake;
    [SerializeField] private bool createMissingRuntimeComponents = true;
    [SerializeField] private bool createRuntimeVfxChildren = true;
    [SerializeField] private float defaultRcsBlockThrust = 6500f;

    public BindReport LastReport { get; private set; }

    private void Awake()
    {
        if (bindOnAwake)
        {
            BindNow();
        }
    }

    public void Configure(
        Transform root,
        PrototypeShipVfxLibrary library = null,
        bool createRuntimeComponents = true,
        bool createVfxChildren = true)
    {
        socketRoot = root != null ? root : socketRoot;
        vfxLibrary = library != null ? library : vfxLibrary;
        createMissingRuntimeComponents = createRuntimeComponents;
        createRuntimeVfxChildren = createVfxChildren;
    }

    public BindReport BindNow()
    {
        Transform root = socketRoot != null ? socketRoot : transform;
        var report = new BindReport();
        if (root == null)
        {
            report.warnings.Add("No socket root available.");
            LastReport = report;
            return report;
        }

        report.addedSocketComponents = PrototypeShipSocketUtility.EnsureSocketsInHierarchy(root);
        PrototypeShipSocket[] sockets = root.GetComponentsInChildren<PrototypeShipSocket>(true);
        List<PrototypeShipSocket> mainNozzles = FilterSockets(sockets, PrototypeShipSocketType.MainThrusterNozzle);
        List<PrototypeShipSocket> gimbalPivots = FilterSockets(sockets, PrototypeShipSocketType.MainThrusterGimbalPivot);
        List<PrototypeShipSocket> rcsNozzles = FilterSockets(sockets, PrototypeShipSocketType.RcsNozzle);
        List<PrototypeShipSocket> muzzles = FilterSockets(sockets, PrototypeShipSocketType.WeaponMuzzle);
        List<PrototypeShipSocket> hardpoints = FilterSockets(sockets, PrototypeShipSocketType.Hardpoint);
        report.foundMainNozzles = mainNozzles.Count;
        report.foundGimbalPivots = gimbalPivots.Count;
        report.foundRcsNozzles = rcsNozzles.Count;
        report.foundMuzzles = muzzles.Count;
        report.foundHardpoints = hardpoints.Count;

        Rigidbody shipRigidbody = GetOrAddComponent<Rigidbody>(gameObject, createMissingRuntimeComponents);
        ShipStats shipStats = GetOrAddComponent<ShipStats>(gameObject, createMissingRuntimeComponents);
        ShipPhysicsCore physicsCore = GetOrAddComponent<ShipPhysicsCore>(gameObject, createMissingRuntimeComponents);
        PrototypeThermalModule thermalModule = GetComponent<PrototypeThermalModule>();
        if (physicsCore != null && shipRigidbody != null)
        {
            physicsCore.Configure(shipRigidbody);
        }

        BindMainThrusters(mainNozzles, gimbalPivots, shipRigidbody, shipStats, physicsCore, thermalModule, report);
        BindRcsNozzles(rcsNozzles, shipRigidbody, physicsCore, report);
        BindGun(muzzles, report);
        BindHardpoints(root, report);

        if (report.foundMainNozzles == 0)
        {
            report.missingRequiredSockets.Add("MainThrusterNozzle");
        }

        if (report.foundRcsNozzles == 0)
        {
            report.missingRequiredSockets.Add("RCS nozzles");
        }

        if (report.foundMuzzles == 0)
        {
            report.warnings.Add("No weapon muzzle socket found; guns will use their normal fallback if fired.");
        }

        if (report.foundHardpoints == 0)
        {
            report.warnings.Add("No builder hardpoint sockets found under " + root.name + ".");
        }

        LastReport = report;
        return report;
    }

    private void BindMainThrusters(
        List<PrototypeShipSocket> mainNozzles,
        List<PrototypeShipSocket> gimbalPivots,
        Rigidbody shipRigidbody,
        ShipStats shipStats,
        ShipPhysicsCore physicsCore,
        PrototypeThermalModule thermalModule,
        BindReport report)
    {
        if (mainNozzles.Count == 0)
        {
            return;
        }

        MainThrusterModule[] existingModules = GetComponents<MainThrusterModule>();
        var modules = new List<MainThrusterModule>(mainNozzles.Count);
        for (int i = 0; i < mainNozzles.Count; i++)
        {
            Transform nozzle = mainNozzles[i].transform;
            Transform gimbal = FindClosestGimbal(nozzle, gimbalPivots);
            MainThrusterModule module = i < existingModules.Length
                ? existingModules[i]
                : gameObject.AddComponent<MainThrusterModule>();
            if (module == null)
            {
                continue;
            }

            module.Configure(nozzle, gimbal, shipRigidbody, shipStats, physicsCore, thermalModule);
            modules.Add(module);
            report.boundMainThrusters++;
            report.gimbalSupported = report.gimbalSupported || gimbal != null;
            if (gimbal != null)
            {
                report.gimbalPivotNames.Add(gimbal.name);
            }
        }

        MainThrusterBank bank = GetOrAddComponent<MainThrusterBank>(gameObject, createMissingRuntimeComponents);
        if (bank != null)
        {
            bank.Configure(modules.ToArray(), shipRigidbody, shipStats, physicsCore);
        }

        EngineVfxController engineVfx = GetOrAddComponent<EngineVfxController>(gameObject, createMissingRuntimeComponents);
        if (engineVfx != null)
        {
            engineVfx.SetAllowFallbackNozzle(false);
            engineVfx.ConfigureNozzle(mainNozzles[0].transform);
        }
    }

    private void BindRcsNozzles(List<PrototypeShipSocket> rcsNozzles, Rigidbody shipRigidbody, ShipPhysicsCore physicsCore, BindReport report)
    {
        if (rcsNozzles.Count == 0)
        {
            return;
        }

        ResolveVfxLibrary();
        for (int i = 0; i < rcsNozzles.Count; i++)
        {
            Transform nozzle = rcsNozzles[i].transform;
            EnsureRcsBlock(nozzle);
            if (createRuntimeVfxChildren && EnsureRcsVfx(nozzle))
            {
                report.createdRcsVfxChildren++;
            }
        }

        RcsThrusterController rcsController = GetOrAddComponent<RcsThrusterController>(gameObject, createMissingRuntimeComponents);
        if (rcsController != null)
        {
            rcsController.SetUseImportedFunctionalSockets(true);
            rcsController.ConfigureThrusters(null, null, null, null, null, null, shipRigidbody, physicsCore);
            rcsController.MarkNozzlesDirty();
            rcsController.RefreshNozzles();
            report.boundRcsNozzles = rcsController.InstalledNozzleCount;
        }
    }

    private void BindGun(List<PrototypeShipSocket> muzzles, BindReport report)
    {
        if (muzzles.Count == 0)
        {
            return;
        }

        GunModule gun = GetOrAddComponent<GunModule>(gameObject, createMissingRuntimeComponents);
        if (gun == null)
        {
            return;
        }

        gun.SetAllowMuzzleFallback(false);
        gun.ConfigureMuzzle(muzzles[0].transform);
        report.boundGuns = 1;
        report.boundMuzzleName = muzzles[0].name;
        if (muzzles.Count > 1)
        {
            report.warnings.Add("Multiple weapon muzzles found; using first muzzle " + muzzles[0].name + " for prototype primary gun.");
        }
    }

    private void BindHardpoints(Transform root, BindReport report)
    {
        PrototypeShipHardpointBinder hardpointBinder = GetOrAddComponent<PrototypeShipHardpointBinder>(gameObject, createMissingRuntimeComponents);
        if (hardpointBinder == null)
        {
            report.warnings.Add("Hardpoint binder component is missing and creation is disabled.");
            return;
        }

        hardpointBinder.Configure(root, false, true);
        PrototypeShipHardpointBinder.BindReport hardpointReport = hardpointBinder.BindNow();
        report.boundHardpoints = hardpointReport.boundHardpoints;
        report.createdHardpointBindings = hardpointReport.createdHardpointBindings;
        report.duplicateHardpointsSkipped = hardpointReport.duplicateHardpointsSkipped;
        report.warnings.AddRange(hardpointReport.warnings);
    }

    private void EnsureRcsBlock(Transform nozzle)
    {
        Transform host = nozzle != null && nozzle.parent != null ? nozzle.parent : nozzle;
        if (host == null)
        {
            return;
        }

        RcsThrusterBlock block = host.GetComponentInParent<RcsThrusterBlock>();
        if (block == null)
        {
            block = host.gameObject.AddComponent<RcsThrusterBlock>();
        }

        block.ConfigureDefault(defaultRcsBlockThrust);
    }

    private bool EnsureRcsVfx(Transform nozzle)
    {
        if (nozzle == null
            || nozzle.Find("VFX") != null
            || nozzle.Find(PrototypeShipKitVfxBinder.RcsThrusterVfxChildName) != null
            || nozzle.Find("RcsThrusterVfx") != null)
        {
            return false;
        }

        GameObject prefab = vfxLibrary != null ? vfxLibrary.RcsThrusterVfxPrefab : null;
        GameObject instance = prefab != null
            ? Instantiate(prefab, nozzle, false)
            : GameObject.CreatePrimitive(PrimitiveType.Cube);
        instance.name = "VFX";
        instance.transform.SetParent(nozzle, false);
        instance.transform.localPosition = Vector3.back * 0.18f;
        instance.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
        instance.transform.localScale = Vector3.one * 0.18f;

        if (prefab == null)
        {
            var renderer = instance.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.sharedMaterial = CreateRuntimeVfxMaterial();
            }
        }

        Collider collider = instance.GetComponent<Collider>();
        if (collider != null)
        {
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

        instance.SetActive(false);
        return true;
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

    private static Material CreateRuntimeVfxMaterial()
    {
        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        var material = new Material(shader != null ? shader : Shader.Find("Standard"));
        material.color = new Color(0.1f, 0.9f, 1f, 0.85f);
        if (material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", new Color(0.1f, 0.9f, 1f, 1f) * 2f);
        }

        return material;
    }

    private static Transform FindClosestGimbal(Transform nozzle, List<PrototypeShipSocket> gimbalPivots)
    {
        if (nozzle == null || gimbalPivots == null || gimbalPivots.Count == 0)
        {
            return null;
        }

        Transform current = nozzle.parent;
        while (current != null)
        {
            for (int i = 0; i < gimbalPivots.Count; i++)
            {
                if (gimbalPivots[i] != null && gimbalPivots[i].transform == current)
                {
                    return current;
                }
            }

            current = current.parent;
        }

        Transform closest = null;
        float closestDistance = float.MaxValue;
        for (int i = 0; i < gimbalPivots.Count; i++)
        {
            if (gimbalPivots[i] == null)
            {
                continue;
            }

            float distance = (gimbalPivots[i].transform.position - nozzle.position).sqrMagnitude;
            if (distance < closestDistance)
            {
                closestDistance = distance;
                closest = gimbalPivots[i].transform;
            }
        }

        return closest;
    }

    private static List<PrototypeShipSocket> FilterSockets(PrototypeShipSocket[] sockets, PrototypeShipSocketType socketType)
    {
        var result = new List<PrototypeShipSocket>();
        var seen = new HashSet<string>();
        for (int i = 0; i < sockets.Length; i++)
        {
            PrototypeShipSocket socket = sockets[i];
            if (socket == null || socket.SocketType != socketType)
            {
                continue;
            }

            string key = BuildSocketDedupeKey(socket);
            if (!seen.Add(key))
            {
                continue;
            }

            result.Add(socket);
        }

        return result;
    }

    private static string BuildSocketDedupeKey(PrototypeShipSocket socket)
    {
        Vector3 position = socket.transform.position;
        return socket.SocketType + "|" + socket.Direction + "|"
            + Mathf.RoundToInt(position.x * 1000f) + "|"
            + Mathf.RoundToInt(position.y * 1000f) + "|"
            + Mathf.RoundToInt(position.z * 1000f);
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

    [System.Serializable]
    public sealed class BindReport
    {
        public int addedSocketComponents;
        public int foundMainNozzles;
        public int foundGimbalPivots;
        public int foundRcsNozzles;
        public int foundMuzzles;
        public int foundHardpoints;
        public int boundMainThrusters;
        public int boundRcsNozzles;
        public int boundGuns;
        public int boundHardpoints;
        public int createdRcsVfxChildren;
        public int createdHardpointBindings;
        public int duplicateHardpointsSkipped;
        public bool gimbalSupported;
        public string boundMuzzleName;
        public List<string> gimbalPivotNames = new List<string>();
        public List<string> missingRequiredSockets = new List<string>();
        public List<string> warnings = new List<string>();
    }
}

