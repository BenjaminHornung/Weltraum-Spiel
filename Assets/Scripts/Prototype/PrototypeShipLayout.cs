using System;
using UnityEngine;

[Serializable]
public sealed class PrototypeShipLayout
{
    [SerializeField] private PrototypeModuleLayoutEntry[] modules =
    {
        new PrototypeModuleLayoutEntry("Hull", Vector3.zero, new Vector3(1.8f, 1.1f, 6.0f), PrototypeModuleMassRole.Hull),
        new PrototypeModuleLayoutEntry("Cockpit", new Vector3(0f, 0.45f, 2.05f), new Vector3(1.0f, 0.45f, 1.0f), PrototypeModuleMassRole.Cockpit),
        new PrototypeModuleLayoutEntry("FuelTank", new Vector3(0f, -0.45f, 0.1f), new Vector3(1.2f, 0.35f, 2.1f), PrototypeModuleMassRole.FuelTank)
    };

    [SerializeField] private PrototypeMainThrusterLayoutEntry[] mainThrusters =
    {
        new PrototypeMainThrusterLayoutEntry("MainThrusterGimbal", "MainThrusterNozzle", new Vector3(0f, 0f, -3.35f), new Vector3(1.0f, 0.75f, 0.7f), new Vector3(0f, 0f, -0.55f))
    };

    [SerializeField] private PrototypeRcsBlockLayoutEntry[] rcsBlocks =
    {
        new PrototypeRcsBlockLayoutEntry("RCS_Top", new Vector3(0f, 0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.down),
        new PrototypeRcsBlockLayoutEntry("RCS_Bottom", new Vector3(0f, -0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.up),
        new PrototypeRcsBlockLayoutEntry("RCS_Left", new Vector3(-1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.right),
        new PrototypeRcsBlockLayoutEntry("RCS_Right", new Vector3(1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left)
    };

    [SerializeField] private PrototypeGunLayoutEntry[] guns =
    {
        new PrototypeGunLayoutEntry("Gun", new Vector3(0f, 0.1f, 3.25f), new Vector3(0.32f, 0.22f, 0.65f), "Muzzle", new Vector3(0f, 0f, 0.45f))
    };

    public PrototypeModuleLayoutEntry[] Modules => modules ?? Array.Empty<PrototypeModuleLayoutEntry>();
    public PrototypeMainThrusterLayoutEntry[] MainThrusters => mainThrusters ?? Array.Empty<PrototypeMainThrusterLayoutEntry>();
    public PrototypeRcsBlockLayoutEntry[] RcsBlocks => rcsBlocks ?? Array.Empty<PrototypeRcsBlockLayoutEntry>();
    public PrototypeGunLayoutEntry[] Guns => guns ?? Array.Empty<PrototypeGunLayoutEntry>();

    public static PrototypeShipLayout Baseline()
    {
        return new PrototypeShipLayout();
    }

    public static PrototypeShipLayout DualMainThruster()
    {
        return new PrototypeShipLayout
        {
            mainThrusters = new[]
            {
                new PrototypeMainThrusterLayoutEntry("MainThruster_Left", "MainThrusterNozzle", new Vector3(-0.55f, 0f, -3.35f), new Vector3(0.75f, 0.65f, 0.7f), new Vector3(0f, 0f, -0.55f)),
                new PrototypeMainThrusterLayoutEntry("MainThruster_Right", "MainThrusterNozzle", new Vector3(0.55f, 0f, -3.35f), new Vector3(0.75f, 0.65f, 0.7f), new Vector3(0f, 0f, -0.55f))
            }
        };
    }

    public static PrototypeShipLayout OffCenterMainThruster()
    {
        return new PrototypeShipLayout
        {
            mainThrusters = new[]
            {
                new PrototypeMainThrusterLayoutEntry("MainThruster_Offset", "MainThrusterNozzle", new Vector3(0.85f, 0f, -3.35f), new Vector3(0.9f, 0.7f, 0.7f), new Vector3(0f, 0f, -0.55f))
            }
        };
    }

    public static PrototypeShipLayout OneSidedRcs()
    {
        return new PrototypeShipLayout
        {
            rcsBlocks = new[]
            {
                new PrototypeRcsBlockLayoutEntry("RCS_Right_Only_A", new Vector3(1.02f, 0f, 1.15f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left),
                new PrototypeRcsBlockLayoutEntry("RCS_Right_Only_B", new Vector3(1.02f, 0f, -1.15f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left)
            }
        };
    }

    public static PrototypeShipLayout HeavyCargo()
    {
        return new PrototypeShipLayout
        {
            modules = new[]
            {
                new PrototypeModuleLayoutEntry("Hull", Vector3.zero, new Vector3(1.8f, 1.1f, 6.0f), PrototypeModuleMassRole.Hull),
                new PrototypeModuleLayoutEntry("Cockpit", new Vector3(0f, 0.45f, 2.05f), new Vector3(1.0f, 0.45f, 1.0f), PrototypeModuleMassRole.Cockpit),
                new PrototypeModuleLayoutEntry("FuelTank", new Vector3(0f, -0.45f, 0.1f), new Vector3(1.2f, 0.35f, 2.1f), PrototypeModuleMassRole.FuelTank),
                new PrototypeModuleLayoutEntry("CargoMass", new Vector3(0f, -0.05f, -1.35f), new Vector3(1.65f, 0.9f, 1.45f), PrototypeModuleMassRole.Custom, 2800f)
            }
        };
    }

    public static PrototypeShipLayout NoRcs()
    {
        return new PrototypeShipLayout
        {
            rcsBlocks = Array.Empty<PrototypeRcsBlockLayoutEntry>()
        };
    }
}

public enum PrototypeModuleMassRole
{
    Hull = 0,
    Cockpit = 1,
    FuelTank = 2,
    Engine = 3,
    Gun = 4,
    RcsBlock = 5,
    Custom = 100
}

[Serializable]
public struct PrototypeModuleLayoutEntry
{
    [SerializeField] private string moduleId;
    [SerializeField] private PrototypeModuleMassRole massRole;
    [SerializeField] private Vector3 localPosition;
    [SerializeField] private Vector3 localEulerAngles;
    [SerializeField] private Vector3 localScale;
    [SerializeField] private Vector3 massBoxSize;
    [SerializeField] private bool usesCurrentShipFuel;
    [SerializeField] private float dryMassKg;

    public string ModuleId => string.IsNullOrWhiteSpace(moduleId) ? "Module" : moduleId;
    public PrototypeModuleMassRole MassRole => massRole;
    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalEulerAngles => localEulerAngles;
    public Vector3 LocalScale => ClampVector(localScale, 0.01f);
    public Vector3 MassBoxSize => ClampVector(massBoxSize == Vector3.zero ? localScale : massBoxSize, 0.01f);
    public bool UsesCurrentShipFuel => usesCurrentShipFuel;
    public float DryMassKg => Mathf.Max(0f, dryMassKg);
    public bool HasDryMassOverride => dryMassKg > 0f;

    public PrototypeModuleLayoutEntry(string moduleId, Vector3 localPosition, Vector3 localScale, PrototypeModuleMassRole massRole)
        : this(moduleId, localPosition, localScale, massRole, 0f)
    {
    }

    public PrototypeModuleLayoutEntry(string moduleId, Vector3 localPosition, Vector3 localScale, PrototypeModuleMassRole massRole, float dryMassKg)
    {
        this.moduleId = moduleId;
        this.massRole = massRole;
        this.localPosition = localPosition;
        localEulerAngles = Vector3.zero;
        this.localScale = localScale;
        massBoxSize = localScale;
        usesCurrentShipFuel = massRole == PrototypeModuleMassRole.FuelTank;
        this.dryMassKg = Mathf.Max(0f, dryMassKg);
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(
            Mathf.Max(minimum, Mathf.Abs(value.x)),
            Mathf.Max(minimum, Mathf.Abs(value.y)),
            Mathf.Max(minimum, Mathf.Abs(value.z)));
    }
}

[Serializable]
public struct PrototypeMainThrusterLayoutEntry
{
    [SerializeField] private string moduleId;
    [SerializeField] private string nozzleId;
    [SerializeField] private Vector3 localPosition;
    [SerializeField] private Vector3 localEulerAngles;
    [SerializeField] private Vector3 localScale;
    [SerializeField] private Vector3 nozzleLocalPosition;
    [SerializeField] private Vector3 nozzleLocalEulerAngles;
    [SerializeField] private PrototypeMainThrusterSettings settings;

    public string ModuleId => string.IsNullOrWhiteSpace(moduleId) ? "MainThrusterGimbal" : moduleId;
    public string NozzleId => string.IsNullOrWhiteSpace(nozzleId) ? "MainThrusterNozzle" : nozzleId;
    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalEulerAngles => localEulerAngles;
    public Vector3 LocalScale => ClampVector(localScale, 0.01f);
    public Vector3 NozzleLocalPosition => nozzleLocalPosition;
    public Vector3 NozzleLocalEulerAngles => nozzleLocalEulerAngles;
    public PrototypeMainThrusterSettings Settings => settings.thrustForce > 0f ? settings : PrototypeMainThrusterSettings.Default;

    public PrototypeMainThrusterLayoutEntry(string moduleId, string nozzleId, Vector3 localPosition, Vector3 localScale, Vector3 nozzleLocalPosition)
    {
        this.moduleId = moduleId;
        this.nozzleId = nozzleId;
        this.localPosition = localPosition;
        localEulerAngles = Vector3.zero;
        this.localScale = localScale;
        this.nozzleLocalPosition = nozzleLocalPosition;
        nozzleLocalEulerAngles = Vector3.zero;
        settings = PrototypeMainThrusterSettings.Default;
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(
            Mathf.Max(minimum, Mathf.Abs(value.x)),
            Mathf.Max(minimum, Mathf.Abs(value.y)),
            Mathf.Max(minimum, Mathf.Abs(value.z)));
    }
}

[Serializable]
public struct PrototypeRcsBlockLayoutEntry
{
    [SerializeField] private string blockId;
    [SerializeField] private Vector3 localPosition;
    [SerializeField] private Vector3 localEulerAngles;
    [SerializeField] private Vector3 localScale;
    [SerializeField] private Vector3 blockedLocalDirection;
    [SerializeField] private PrototypeRcsSettings settings;

    public string BlockId => string.IsNullOrWhiteSpace(blockId) ? "RCS_Block" : blockId;
    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalEulerAngles => localEulerAngles;
    public Vector3 LocalScale => ClampVector(localScale, 0.01f);
    public Vector3 BlockedLocalDirection => blockedLocalDirection == Vector3.zero ? Vector3.down : blockedLocalDirection.normalized;
    public PrototypeRcsSettings Settings => settings.blockThrust > 0f ? settings : PrototypeRcsSettings.Default;

    public PrototypeRcsBlockLayoutEntry(string blockId, Vector3 localPosition, Vector3 localScale, Vector3 blockedLocalDirection)
    {
        this.blockId = blockId;
        this.localPosition = localPosition;
        localEulerAngles = Vector3.zero;
        this.localScale = localScale;
        this.blockedLocalDirection = blockedLocalDirection;
        settings = PrototypeRcsSettings.Default;
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(
            Mathf.Max(minimum, Mathf.Abs(value.x)),
            Mathf.Max(minimum, Mathf.Abs(value.y)),
            Mathf.Max(minimum, Mathf.Abs(value.z)));
    }
}

[Serializable]
public struct PrototypeGunLayoutEntry
{
    [SerializeField] private string moduleId;
    [SerializeField] private Vector3 localPosition;
    [SerializeField] private Vector3 localEulerAngles;
    [SerializeField] private Vector3 localScale;
    [SerializeField] private string muzzleId;
    [SerializeField] private Vector3 muzzleLocalPosition;
    [SerializeField] private Vector3 muzzleLocalEulerAngles;
    [SerializeField] private PrototypeGunSettings settings;

    public string ModuleId => string.IsNullOrWhiteSpace(moduleId) ? "Gun" : moduleId;
    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalEulerAngles => localEulerAngles;
    public Vector3 LocalScale => ClampVector(localScale, 0.01f);
    public string MuzzleId => string.IsNullOrWhiteSpace(muzzleId) ? "Muzzle" : muzzleId;
    public Vector3 MuzzleLocalPosition => muzzleLocalPosition;
    public Vector3 MuzzleLocalEulerAngles => muzzleLocalEulerAngles;
    public PrototypeGunSettings Settings => settings.projectileSpeed > 0f ? settings : PrototypeGunSettings.Default;

    public PrototypeGunLayoutEntry(string moduleId, Vector3 localPosition, Vector3 localScale, string muzzleId, Vector3 muzzleLocalPosition)
    {
        this.moduleId = moduleId;
        this.localPosition = localPosition;
        localEulerAngles = Vector3.zero;
        this.localScale = localScale;
        this.muzzleId = muzzleId;
        this.muzzleLocalPosition = muzzleLocalPosition;
        muzzleLocalEulerAngles = Vector3.zero;
        settings = PrototypeGunSettings.Default;
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(
            Mathf.Max(minimum, Mathf.Abs(value.x)),
            Mathf.Max(minimum, Mathf.Abs(value.y)),
            Mathf.Max(minimum, Mathf.Abs(value.z)));
    }
}
