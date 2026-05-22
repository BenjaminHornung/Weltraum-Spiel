using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class PrototypeShipHardpoint : MonoBehaviour
{
    [SerializeField] private string hardpointId;
    [SerializeField] private string partId;
    [SerializeField] private string moduleId;
    [SerializeField] private string groupId;
    [SerializeField] private PrototypeShipSocketDirection direction;
    [SerializeField] private bool isRuntimeSocket;
    [SerializeField] private bool isBuilderSocket;

    public string HardpointId => hardpointId;
    public string PartId => partId;
    public string ModuleId => moduleId;
    public string GroupId => groupId;
    public PrototypeShipSocketDirection Direction => direction;
    public bool IsRuntimeSocket => isRuntimeSocket;
    public bool IsBuilderSocket => isBuilderSocket;

    public void Configure(PrototypeShipSocket socket, string fallbackId)
    {
        hardpointId = ResolveId(socket, fallbackId);
        partId = socket != null ? socket.PartId : string.Empty;
        moduleId = socket != null ? socket.ModuleId : string.Empty;
        groupId = socket != null ? socket.GroupId : string.Empty;
        direction = socket != null ? socket.Direction : PrototypeShipSocketDirection.Unknown;
        isRuntimeSocket = socket != null && socket.IsRuntimeSocket;
        isBuilderSocket = socket == null || socket.IsBuilderSocket;
    }

    private static string ResolveId(PrototypeShipSocket socket, string fallbackId)
    {
        if (socket != null && !string.IsNullOrWhiteSpace(socket.SocketId))
        {
            return socket.SocketId;
        }

        if (!string.IsNullOrWhiteSpace(fallbackId))
        {
            return fallbackId;
        }

        return socket != null ? socket.name : string.Empty;
    }
}

[DisallowMultipleComponent]
public sealed class PrototypeShipHardpointBinder : MonoBehaviour
{
    public const string GeneratedHardpointRigName = "GeneratedConnectorRig";

    [SerializeField] private Transform hardpointRoot;
    [SerializeField] private bool bindOnAwake;
    [SerializeField] private bool createMissingSocketComponents = true;
    [SerializeField] private bool bindRuntimeHardpoints = true;

    public BindReport LastReport { get; private set; }

    private void Awake()
    {
        if (bindOnAwake)
        {
            BindNow();
        }
    }

    public void Configure(Transform root, bool createSockets = true, bool includeRuntimeHardpoints = true)
    {
        hardpointRoot = root != null ? root : hardpointRoot;
        createMissingSocketComponents = createSockets;
        bindRuntimeHardpoints = includeRuntimeHardpoints;
    }

    public BindReport BindNow()
    {
        Transform root = hardpointRoot != null ? hardpointRoot : transform;
        var report = new BindReport();
        if (root == null)
        {
            report.warnings.Add("No hardpoint root available.");
            LastReport = report;
            return report;
        }

        if (createMissingSocketComponents)
        {
            report.addedSocketComponents = PrototypeShipSocketUtility.EnsureSocketsInHierarchy(root);
        }

        List<PrototypeShipSocket> hardpoints = PrototypeShipSocketUtility.FindSockets(root, PrototypeShipSocketType.Hardpoint, false);
        report.foundHardpoints = hardpoints.Count;

        var seen = new HashSet<string>();
        for (int i = 0; i < hardpoints.Count; i++)
        {
            PrototypeShipSocket socket = hardpoints[i];
            if (!ShouldBind(socket))
            {
                report.skippedNonBuilderHardpoints++;
                continue;
            }

            string key = BuildDedupeKey(socket);
            if (!seen.Add(key))
            {
                report.duplicateHardpointsSkipped++;
                continue;
            }

            PrototypeShipHardpoint hardpoint = socket.GetComponent<PrototypeShipHardpoint>();
            if (hardpoint == null)
            {
                hardpoint = socket.gameObject.AddComponent<PrototypeShipHardpoint>();
                report.createdHardpointBindings++;
            }

            hardpoint.Configure(socket, key);
            report.boundHardpoints++;
            if (string.IsNullOrEmpty(report.firstHardpointName))
            {
                report.firstHardpointName = socket.name;
            }
        }

        if (report.boundHardpoints == 0)
        {
            report.warnings.Add("No builder hardpoints were bound under " + root.name + ".");
        }

        LastReport = report;
        return report;
    }

    public static int EnsureGeneratedFallbackHardpoints(Transform shipRoot)
    {
        if (shipRoot == null)
        {
            return 0;
        }

        Transform rig = shipRoot.Find(GeneratedHardpointRigName);
        if (rig == null)
        {
            rig = new GameObject(GeneratedHardpointRigName).transform;
            rig.SetParent(shipRoot, false);
        }

        rig.localPosition = Vector3.zero;
        rig.localRotation = Quaternion.identity;
        rig.localScale = Vector3.one;

        ModuleMassDescriptor[] modules = shipRoot.GetComponentsInChildren<ModuleMassDescriptor>(true);
        int ensured = 0;
        for (int i = 0; i < modules.Length; i++)
        {
            ModuleMassDescriptor module = modules[i];
            if (module == null || module.transform == shipRoot || module.transform.IsChildOf(rig))
            {
                continue;
            }

            ensured += EnsureGeneratedModuleHardpoints(shipRoot, rig, module);
        }

        return ensured;
    }

    private static int EnsureGeneratedModuleHardpoints(Transform shipRoot, Transform rig, ModuleMassDescriptor module)
    {
        Vector3 halfSize = module.BoxSize * 0.5f;
        int count = 0;
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "FORWARD", PrototypeShipSocketDirection.Forward, Vector3.forward, new Vector3(0f, 0f, halfSize.z));
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "BACK", PrototypeShipSocketDirection.Back, Vector3.back, new Vector3(0f, 0f, -halfSize.z));
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "LEFT", PrototypeShipSocketDirection.Left, Vector3.left, new Vector3(-halfSize.x, 0f, 0f));
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "RIGHT", PrototypeShipSocketDirection.Right, Vector3.right, new Vector3(halfSize.x, 0f, 0f));
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "UP", PrototypeShipSocketDirection.Up, Vector3.up, new Vector3(0f, halfSize.y, 0f));
        count += EnsureGeneratedHardpoint(shipRoot, rig, module, "DOWN", PrototypeShipSocketDirection.Down, Vector3.down, new Vector3(0f, -halfSize.y, 0f));
        return count;
    }

    private static int EnsureGeneratedHardpoint(
        Transform shipRoot,
        Transform rig,
        ModuleMassDescriptor module,
        string directionName,
        PrototypeShipSocketDirection direction,
        Vector3 localNormal,
        Vector3 moduleLocalOffset)
    {
        string moduleId = Sanitize(module.ModuleId);
        string socketId = "GENERATED_" + moduleId + "_CONN_" + directionName;
        Transform socket = rig.Find(socketId);
        if (socket == null)
        {
            socket = new GameObject(socketId).transform;
            socket.SetParent(rig, false);
        }

        Vector3 worldPosition = module.transform.TransformPoint(moduleLocalOffset);
        Vector3 worldNormal = module.transform.TransformDirection(localNormal).normalized;
        socket.position = worldPosition;
        socket.rotation = BuildRotation(worldNormal, shipRoot.up);
        socket.localScale = Vector3.one;

        PrototypeShipSocketUtility.EnsureSocket(socket, new PrototypeShipSocketDescriptor
        {
            SocketId = socketId,
            SocketType = PrototypeShipSocketType.Hardpoint,
            LocalAxisRole = PrototypeShipSocketAxisRole.ConnectorNormal,
            PartId = module.ModuleId,
            ModuleId = module.ModuleId,
            GroupId = "generated-fallback",
            Direction = direction,
            IsRuntimeSocket = false,
            IsBuilderSocket = true,
            Notes = "Generated fallback builder hardpoint; forward is connector normal."
        });
        return 1;
    }

    private bool ShouldBind(PrototypeShipSocket socket)
    {
        if (socket == null)
        {
            return false;
        }

        return socket.IsBuilderSocket || (bindRuntimeHardpoints && socket.IsRuntimeSocket);
    }

    private static Quaternion BuildRotation(Vector3 normal, Vector3 upReference)
    {
        Vector3 forward = normal.sqrMagnitude > 0.0001f ? normal.normalized : Vector3.forward;
        Vector3 up = upReference.sqrMagnitude > 0.0001f ? upReference.normalized : Vector3.up;
        if (Mathf.Abs(Vector3.Dot(forward, up)) > 0.95f)
        {
            up = Vector3.forward;
        }

        return Quaternion.LookRotation(forward, up);
    }

    private static string BuildDedupeKey(PrototypeShipSocket socket)
    {
        Vector3 position = socket.transform.position;
        return ResolveText(socket.SocketId, socket.name) + "|"
            + socket.SocketType + "|"
            + socket.Direction + "|"
            + Mathf.RoundToInt(position.x * 1000f) + "|"
            + Mathf.RoundToInt(position.y * 1000f) + "|"
            + Mathf.RoundToInt(position.z * 1000f);
    }

    private static string ResolveText(string value, string fallback)
    {
        return !string.IsNullOrWhiteSpace(value) ? value : fallback ?? string.Empty;
    }

    private static string Sanitize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "MODULE";
        }

        return value.Trim().Replace(' ', '_').ToUpperInvariant();
    }

    [System.Serializable]
    public sealed class BindReport
    {
        public int addedSocketComponents;
        public int foundHardpoints;
        public int boundHardpoints;
        public int createdHardpointBindings;
        public int duplicateHardpointsSkipped;
        public int skippedNonBuilderHardpoints;
        public string firstHardpointName;
        public List<string> warnings = new List<string>();
    }
}
