using System.Collections.Generic;
using UnityEngine;

public enum PrototypeShipSocketType
{
    Hardpoint,
    MainThrusterNozzle,
    MainThrusterGimbalPivot,
    RcsNozzle,
    WeaponMuzzle,
    TurretYawPivot,
    TurretPitchPivot,
    VisualOnly
}

public enum PrototypeShipSocketAxisRole
{
    ForceDirection,
    PlumeDirection,
    BarrelForward,
    ConnectorNormal
}

public enum PrototypeShipSocketDirection
{
    Unknown,
    Forward,
    Back,
    Left,
    Right,
    Up,
    Down,
    Main,
    Muzzle
}

public sealed class PrototypeShipSocket : MonoBehaviour
{
    [SerializeField] private string socketId;
    [SerializeField] private PrototypeShipSocketType socketType;
    [SerializeField] private PrototypeShipSocketAxisRole localAxisRole;
    [SerializeField] private string partId;
    [SerializeField] private string moduleId;
    [SerializeField] private string groupId;
    [SerializeField] private PrototypeShipSocketDirection direction;
    [SerializeField] private bool isRuntimeSocket = true;
    [SerializeField] private bool isBuilderSocket;
    [SerializeField] private string notes;

    public string SocketId => socketId;
    public PrototypeShipSocketType SocketType => socketType;
    public PrototypeShipSocketAxisRole LocalAxisRole => localAxisRole;
    public string PartId => partId;
    public string ModuleId => moduleId;
    public string GroupId => groupId;
    public PrototypeShipSocketDirection Direction => direction;
    public bool IsRuntimeSocket => isRuntimeSocket;
    public bool IsBuilderSocket => isBuilderSocket;
    public string Notes => notes;

    public void Configure(PrototypeShipSocketDescriptor descriptor)
    {
        socketId = string.IsNullOrWhiteSpace(descriptor.SocketId) ? name : descriptor.SocketId;
        socketType = descriptor.SocketType;
        localAxisRole = descriptor.LocalAxisRole;
        partId = descriptor.PartId ?? string.Empty;
        moduleId = descriptor.ModuleId ?? string.Empty;
        groupId = descriptor.GroupId ?? string.Empty;
        direction = descriptor.Direction;
        isRuntimeSocket = descriptor.IsRuntimeSocket;
        isBuilderSocket = descriptor.IsBuilderSocket;
        notes = descriptor.Notes ?? string.Empty;
    }
}

public struct PrototypeShipSocketDescriptor
{
    public string SocketId;
    public PrototypeShipSocketType SocketType;
    public PrototypeShipSocketAxisRole LocalAxisRole;
    public string PartId;
    public string ModuleId;
    public string GroupId;
    public PrototypeShipSocketDirection Direction;
    public bool IsRuntimeSocket;
    public bool IsBuilderSocket;
    public string Notes;
}

public static class PrototypeShipSocketUtility
{
    public const string MainThrusterNozzleName = "MainThrusterNozzle";
    public const string MainThrusterGimbalName = "MainThrusterGimbal";
    public const string ImportedMainThrusterNozzleToken = "THRUST_NOZZLE_MAIN";
    public const string RuntimeRcsNozzlePrefix = "RCS_Nozzle_";
    public const string ImportedRcsNozzleToken = "RCS_NOZZLE_";
    public const string MuzzleName = "Muzzle";
    public const string WeaponTurretBasePrefix = "WEAPON_TURRET_BASE_";
    public const string WeaponTurretYawPrefix = "WEAPON_TURRET_YAW_";
    public const string WeaponTurretPitchPrefix = "WEAPON_TURRET_PITCH_";
    public const string WeaponMuzzlePrefix = "WEAPON_MUZZLE_";
    public const string WeaponMuzzleFlashPrefix = "WEAPON_MUZZLE_FLASH_";
    public const string WeaponClearancePrefix = "WEAPON_CLEARANCE_";
    public const string WeaponArcLimitPrefix = "WEAPON_ARC_LIMIT_";

    public static int EnsureSocketsInHierarchy(Transform root)
    {
        if (root == null)
        {
            return 0;
        }

        int added = 0;
        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform current = transforms[i];
            if (current == root || current.GetComponent<PrototypeShipSocket>() != null)
            {
                continue;
            }

            if (TryInferDescriptor(current, out PrototypeShipSocketDescriptor descriptor))
            {
                EnsureSocket(current, descriptor);
                added++;
            }
        }

        return added;
    }

    public static PrototypeShipSocket EnsureSocket(Transform target, PrototypeShipSocketDescriptor descriptor)
    {
        if (target == null)
        {
            return null;
        }

        var socket = target.GetComponent<PrototypeShipSocket>();
        if (socket == null)
        {
            socket = target.gameObject.AddComponent<PrototypeShipSocket>();
        }

        socket.Configure(descriptor);
        return socket;
    }

    public static List<PrototypeShipSocket> FindSockets(Transform root, PrototypeShipSocketType socketType, bool inferMissingSockets = true)
    {
        var result = new List<PrototypeShipSocket>();
        if (root == null)
        {
            return result;
        }

        if (inferMissingSockets)
        {
            EnsureSocketsInHierarchy(root);
        }

        PrototypeShipSocket[] sockets = root.GetComponentsInChildren<PrototypeShipSocket>(true);
        for (int i = 0; i < sockets.Length; i++)
        {
            if (sockets[i] != null && sockets[i].SocketType == socketType)
            {
                result.Add(sockets[i]);
            }
        }

        return result;
    }

    public static Transform FindBestSocketTransform(Transform root, PrototypeShipSocketType socketType, bool inferMissingSockets = true)
    {
        List<PrototypeShipSocket> sockets = FindSockets(root, socketType, inferMissingSockets);
        if (sockets.Count > 0)
        {
            return sockets[0].transform;
        }

        if (root == null)
        {
            return null;
        }

        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform candidate = transforms[i];
            if (candidate == root)
            {
                continue;
            }

            if (socketType == PrototypeShipSocketType.MainThrusterNozzle && IsMainThrusterNozzleName(candidate.name))
            {
                return candidate;
            }

            if (socketType == PrototypeShipSocketType.MainThrusterGimbalPivot && IsMainThrusterGimbalName(candidate.name))
            {
                return candidate;
            }

            if (socketType == PrototypeShipSocketType.RcsNozzle && IsRcsNozzleName(candidate.name))
            {
                return candidate;
            }

            if (socketType == PrototypeShipSocketType.WeaponMuzzle && IsWeaponMuzzleName(candidate.name))
            {
                return candidate;
            }

            if (socketType == PrototypeShipSocketType.TurretYawPivot && IsWeaponTurretYawName(candidate.name))
            {
                return candidate;
            }

            if (socketType == PrototypeShipSocketType.TurretPitchPivot && IsWeaponTurretPitchName(candidate.name))
            {
                return candidate;
            }
        }

        return null;
    }

    public static bool IsRuntimeRcsNozzle(Transform nozzle)
    {
        if (nozzle == null || !nozzle.gameObject.activeInHierarchy || IsVisualMarkerOrGeometryName(nozzle.name))
        {
            return false;
        }

        var socket = nozzle.GetComponent<PrototypeShipSocket>();
        if (socket != null && socket.SocketType == PrototypeShipSocketType.RcsNozzle && socket.IsRuntimeSocket)
        {
            return true;
        }

        return IsRcsNozzleName(nozzle.name);
    }

    public static bool IsMainThrusterNozzleName(string transformName)
    {
        return !string.IsNullOrEmpty(transformName)
            && (transformName == MainThrusterNozzleName
                || transformName.StartsWith(MainThrusterNozzleName, System.StringComparison.Ordinal)
                || transformName.EndsWith("_" + MainThrusterNozzleName, System.StringComparison.Ordinal)
                || transformName.Contains(ImportedMainThrusterNozzleToken));
    }

    public static bool IsMainThrusterGimbalName(string transformName)
    {
        return !string.IsNullOrEmpty(transformName)
            && (transformName == MainThrusterGimbalName
                || transformName.StartsWith(MainThrusterGimbalName, System.StringComparison.Ordinal)
                || transformName.EndsWith("_" + MainThrusterGimbalName, System.StringComparison.Ordinal)
                || transformName.Contains("MAIN_THRUSTER_GIMBAL")
                || transformName.Contains("MainThrusterGimbal"));
    }

    public static bool IsRcsNozzleName(string transformName)
    {
        return !string.IsNullOrEmpty(transformName)
            && (transformName.StartsWith(RuntimeRcsNozzlePrefix, System.StringComparison.Ordinal)
                || transformName.Contains(ImportedRcsNozzleToken));
    }

    public static bool IsWeaponMuzzleName(string transformName)
    {
        if (string.IsNullOrEmpty(transformName))
        {
            return false;
        }

        if (IsWeaponMuzzleFlashName(transformName))
        {
            return false;
        }

        string upper = transformName.ToUpperInvariant();
        if (upper.Contains("MUZZLEFLASH") || upper.Contains("MUZZLE_FLASH") || (upper.Contains("MUZZLE") && (upper.Contains("FLASH") || upper.Contains("VFX"))))
        {
            return false;
        }

        return transformName == MuzzleName
            || transformName.StartsWith(MuzzleName, System.StringComparison.Ordinal)
            || upper == "MUZZLE"
            || upper.EndsWith("_MUZZLE", System.StringComparison.Ordinal)
            || upper.Contains("MUZZLE");
    }

    public static bool IsWeaponTurretBaseName(string transformName)
    {
        return StartsWithUpper(transformName, WeaponTurretBasePrefix);
    }

    public static bool IsWeaponTurretYawName(string transformName)
    {
        return StartsWithUpper(transformName, WeaponTurretYawPrefix);
    }

    public static bool IsWeaponTurretPitchName(string transformName)
    {
        return StartsWithUpper(transformName, WeaponTurretPitchPrefix);
    }

    public static bool IsWeaponMuzzleFlashName(string transformName)
    {
        return StartsWithUpper(transformName, WeaponMuzzleFlashPrefix);
    }

    public static bool IsWeaponSafetyMarkerName(string transformName)
    {
        return StartsWithUpper(transformName, WeaponClearancePrefix)
            || StartsWithUpper(transformName, WeaponArcLimitPrefix);
    }

    public static bool TryInferDescriptor(Transform transform, out PrototypeShipSocketDescriptor descriptor)
    {
        descriptor = default;
        if (transform == null)
        {
            return false;
        }

        string objectName = transform.name;
        if (IsVisualMarkerOrGeometryName(objectName))
        {
            return false;
        }

        string partId = InferPartId(transform);
        string moduleId = InferModuleId(transform);
        string groupId = InferGroupId(transform, moduleId);

        if (IsMainThrusterNozzleName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.MainThrusterNozzle, PrototypeShipSocketAxisRole.ForceDirection, partId, moduleId, groupId, PrototypeShipSocketDirection.Main, true, false, "Nozzle.forward is thrust force direction; plume renders opposite.");
            return true;
        }

        if (IsMainThrusterGimbalName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.MainThrusterGimbalPivot, PrototypeShipSocketAxisRole.ForceDirection, partId, moduleId, groupId, PrototypeShipSocketDirection.Main, true, false, "Optional main thruster visual gimbal pivot.");
            return true;
        }

        if (IsRcsNozzleName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.RcsNozzle, PrototypeShipSocketAxisRole.ForceDirection, partId, moduleId, groupId, InferDirection(objectName), true, false, "RCS nozzle socket; forward is local force direction.");
            return true;
        }

        if (IsWeaponMuzzleName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.WeaponMuzzle, PrototypeShipSocketAxisRole.BarrelForward, partId, moduleId, groupId, PrototypeShipSocketDirection.Muzzle, true, false, "Projectile spawn socket; forward is projectile direction.");
            return true;
        }

        if (objectName == "TurretYawPivot" || objectName.EndsWith("_TURRET_YAW_PIVOT", System.StringComparison.Ordinal) || IsWeaponTurretYawName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.TurretYawPivot, PrototypeShipSocketAxisRole.BarrelForward, partId, moduleId, groupId, PrototypeShipSocketDirection.Muzzle, true, true, "Turret yaw pivot marker.");
            return true;
        }

        if (objectName == "TurretPitchPivot" || objectName.EndsWith("_TURRET_PITCH_PIVOT", System.StringComparison.Ordinal) || IsWeaponTurretPitchName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.TurretPitchPivot, PrototypeShipSocketAxisRole.BarrelForward, partId, moduleId, groupId, PrototypeShipSocketDirection.Muzzle, true, true, "Turret pitch pivot marker.");
            return true;
        }

        if (IsWeaponTurretBaseName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.Hardpoint, PrototypeShipSocketAxisRole.BarrelForward, partId, moduleId, groupId, PrototypeShipSocketDirection.Muzzle, true, true, "Turret base marker.");
            return true;
        }

        if (objectName.Contains("CONN_") || objectName.Contains("HARDPOINT") || IsWeaponSafetyMarkerName(objectName))
        {
            descriptor = CreateDescriptor(objectName, PrototypeShipSocketType.Hardpoint, PrototypeShipSocketAxisRole.ConnectorNormal, partId, moduleId, groupId, InferDirection(objectName), false, true, "Builder connector or hardpoint socket.");
            return true;
        }

        return false;
    }

    private static bool IsVisualMarkerOrGeometryName(string objectName)
    {
        if (string.IsNullOrEmpty(objectName))
        {
            return false;
        }

        return objectName.StartsWith("VIS_", System.StringComparison.Ordinal)
            || objectName.Contains("_VIS_")
            || objectName.Contains("VIS_PART_")
            || objectName.Contains("_Mesh")
            || objectName.Contains("GEO_");
    }

    private static bool StartsWithUpper(string value, string prefix)
    {
        return !string.IsNullOrEmpty(value)
            && value.ToUpperInvariant().StartsWith(prefix, System.StringComparison.Ordinal);
    }

    private static PrototypeShipSocketDescriptor CreateDescriptor(string socketId, PrototypeShipSocketType socketType, PrototypeShipSocketAxisRole axisRole, string partId, string moduleId, string groupId, PrototypeShipSocketDirection direction, bool isRuntimeSocket, bool isBuilderSocket, string notes)
    {
        return new PrototypeShipSocketDescriptor
        {
            SocketId = socketId,
            SocketType = socketType,
            LocalAxisRole = axisRole,
            PartId = partId,
            ModuleId = moduleId,
            GroupId = groupId,
            Direction = direction,
            IsRuntimeSocket = isRuntimeSocket,
            IsBuilderSocket = isBuilderSocket,
            Notes = notes
        };
    }

    private static PrototypeShipSocketDirection InferDirection(string name)
    {
        string upper = name.ToUpperInvariant();
        if (upper.Contains("FORWARD") || upper.EndsWith("_FRONT"))
        {
            return PrototypeShipSocketDirection.Forward;
        }

        if (upper.Contains("BACK") || upper.Contains("REAR"))
        {
            return PrototypeShipSocketDirection.Back;
        }

        if (upper.Contains("LEFT"))
        {
            return PrototypeShipSocketDirection.Left;
        }

        if (upper.Contains("RIGHT"))
        {
            return PrototypeShipSocketDirection.Right;
        }

        if (upper.Contains("UP") || upper.Contains("TOP"))
        {
            return PrototypeShipSocketDirection.Up;
        }

        if (upper.Contains("DOWN") || upper.Contains("BOTTOM"))
        {
            return PrototypeShipSocketDirection.Down;
        }

        if (upper.Contains("MAIN"))
        {
            return PrototypeShipSocketDirection.Main;
        }

        if (upper.Contains("MUZZLE"))
        {
            return PrototypeShipSocketDirection.Muzzle;
        }

        return PrototypeShipSocketDirection.Unknown;
    }

    private static string InferPartId(Transform transform)
    {
        Transform current = transform;
        while (current != null)
        {
            string currentName = current.name;
            if (currentName.StartsWith("PART_", System.StringComparison.Ordinal))
            {
                return currentName;
            }

            current = current.parent;
        }

        return string.Empty;
    }

    private static string InferModuleId(Transform transform)
    {
        if (transform == null)
        {
            return string.Empty;
        }

        Transform parent = transform.parent;
        return parent != null ? parent.name : transform.name;
    }

    private static string InferGroupId(Transform transform, string moduleId)
    {
        if (transform == null)
        {
            return moduleId ?? string.Empty;
        }

        if (IsRcsNozzleName(transform.name) && transform.parent != null)
        {
            return transform.parent.name;
        }

        return moduleId ?? string.Empty;
    }
}
