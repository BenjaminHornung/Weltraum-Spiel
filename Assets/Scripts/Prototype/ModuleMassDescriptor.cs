using UnityEngine;

[DisallowMultipleComponent]
public class ModuleMassDescriptor : MonoBehaviour
{
    [SerializeField] private string moduleId = "Module";
    [SerializeField] private float dryMassKg = 100f;
    [SerializeField] private float fuelMassKg;
    [SerializeField] private bool useCurrentShipFuel;
    [SerializeField] private Vector3 boxSize = Vector3.one;

    public string ModuleId => string.IsNullOrWhiteSpace(moduleId) ? name : moduleId;
    public float DryMassKg => Mathf.Max(0f, dryMassKg);
    public float FuelMassKg => Mathf.Max(0f, fuelMassKg);
    public bool UseCurrentShipFuel => useCurrentShipFuel;
    public Vector3 BoxSize => ClampBoxSize(boxSize);

    public float GetTotalMassKg(float currentShipFuelKg)
    {
        float moduleFuelMass = useCurrentShipFuel ? Mathf.Max(0f, currentShipFuelKg) : FuelMassKg;
        return DryMassKg + moduleFuelMass;
    }

    public float GetFuelMassKg(float currentShipFuelKg)
    {
        return useCurrentShipFuel ? Mathf.Max(0f, currentShipFuelKg) : FuelMassKg;
    }

    public void Configure(string id, float dryMass, float fuelMass, bool useShipFuel, Vector3 approximateBoxSize)
    {
        moduleId = string.IsNullOrWhiteSpace(id) ? name : id;
        dryMassKg = Mathf.Max(0f, dryMass);
        fuelMassKg = Mathf.Max(0f, fuelMass);
        useCurrentShipFuel = useShipFuel;
        boxSize = ClampBoxSize(approximateBoxSize);
    }

    private void OnValidate()
    {
        dryMassKg = Mathf.Max(0f, dryMassKg);
        fuelMassKg = Mathf.Max(0f, fuelMassKg);
        boxSize = ClampBoxSize(boxSize);
    }

    private static Vector3 ClampBoxSize(Vector3 size)
    {
        return new Vector3(
            Mathf.Max(0.01f, Mathf.Abs(size.x)),
            Mathf.Max(0.01f, Mathf.Abs(size.y)),
            Mathf.Max(0.01f, Mathf.Abs(size.z)));
    }
}

public struct ShipMassProperties
{
    public float totalMassKg;
    public float dryMassKg;
    public float fuelMassKg;
    public Vector3 localCenterOfMass;
    public Vector3 inertiaTensor;
    public int moduleCount;
    public bool hasDescriptors;

    public float TotalMassKg => Mathf.Max(0.1f, totalMassKg);
    public float DryMassKg => Mathf.Max(0f, dryMassKg);
    public float FuelMassKg => Mathf.Max(0f, fuelMassKg);
    public Vector3 LocalCenterOfMass => localCenterOfMass;
    public Vector3 InertiaTensor => ClampInertia(inertiaTensor);
    public int ModuleCount => Mathf.Max(0, moduleCount);
    public bool HasDescriptors => hasDescriptors && moduleCount > 0;

    public static ShipMassProperties Fallback(float massKg)
    {
        return new ShipMassProperties
        {
            totalMassKg = Mathf.Max(0.1f, massKg),
            dryMassKg = Mathf.Max(0.1f, massKg),
            fuelMassKg = 0f,
            localCenterOfMass = Vector3.zero,
            inertiaTensor = Vector3.one,
            moduleCount = 0,
            hasDescriptors = false
        };
    }

    public static ShipMassProperties Calculate(Transform root, ModuleMassDescriptor[] descriptors, float currentShipFuelKg, float fallbackMassKg)
    {
        if (descriptors == null || descriptors.Length == 0)
        {
            return Fallback(fallbackMassKg);
        }

        float totalMass = 0f;
        float dryMass = 0f;
        float fuelMass = 0f;
        Vector3 weightedCenter = Vector3.zero;
        int count = 0;

        for (int i = 0; i < descriptors.Length; i++)
        {
            ModuleMassDescriptor descriptor = descriptors[i];
            if (descriptor == null || !descriptor.isActiveAndEnabled)
            {
                continue;
            }

            float mass = descriptor.GetTotalMassKg(currentShipFuelKg);
            if (mass <= 0f)
            {
                continue;
            }

            Vector3 localPosition = ToRootLocal(root, descriptor.transform);
            totalMass += mass;
            dryMass += descriptor.DryMassKg;
            fuelMass += descriptor.GetFuelMassKg(currentShipFuelKg);
            weightedCenter += localPosition * mass;
            count++;
        }

        if (count == 0 || totalMass <= 0f)
        {
            return Fallback(fallbackMassKg);
        }

        Vector3 centerOfMass = weightedCenter / totalMass;
        Vector3 inertia = Vector3.zero;

        for (int i = 0; i < descriptors.Length; i++)
        {
            ModuleMassDescriptor descriptor = descriptors[i];
            if (descriptor == null || !descriptor.isActiveAndEnabled)
            {
                continue;
            }

            float mass = descriptor.GetTotalMassKg(currentShipFuelKg);
            if (mass <= 0f)
            {
                continue;
            }

            Vector3 size = descriptor.BoxSize;
            Vector3 offset = ToRootLocal(root, descriptor.transform) - centerOfMass;

            inertia.x += (mass / 12f * ((size.y * size.y) + (size.z * size.z))) + (mass * ((offset.y * offset.y) + (offset.z * offset.z)));
            inertia.y += (mass / 12f * ((size.x * size.x) + (size.z * size.z))) + (mass * ((offset.x * offset.x) + (offset.z * offset.z)));
            inertia.z += (mass / 12f * ((size.x * size.x) + (size.y * size.y))) + (mass * ((offset.x * offset.x) + (offset.y * offset.y)));
        }

        return new ShipMassProperties
        {
            totalMassKg = totalMass,
            dryMassKg = dryMass,
            fuelMassKg = fuelMass,
            localCenterOfMass = centerOfMass,
            inertiaTensor = ClampInertia(inertia),
            moduleCount = count,
            hasDescriptors = true
        };
    }

    private static Vector3 ToRootLocal(Transform root, Transform module)
    {
        if (module == null)
        {
            return Vector3.zero;
        }

        return root != null ? root.InverseTransformPoint(module.position) : module.localPosition;
    }

    private static Vector3 ClampInertia(Vector3 value)
    {
        return new Vector3(
            Mathf.Max(0.01f, value.x),
            Mathf.Max(0.01f, value.y),
            Mathf.Max(0.01f, value.z));
    }
}

public static class PrototypeModuleMassLayout
{
    private const string ImportedFunctionalMassRootName = "ImportedFunctionalMassDescriptors";

    public static void ConfigureGeneratedPrototypeDescriptors(Transform ship, ShipStats stats)
    {
        if (ship == null || stats == null)
        {
            return;
        }

        ConfigureDescriptor(ship.Find("Hull"), "Hull", stats.HullMass, 0f, false, new Vector3(1.8f, 1.1f, 6.0f));
        ConfigureDescriptor(ship.Find("Cockpit"), "Cockpit", stats.CockpitMass, 0f, false, new Vector3(1.0f, 0.45f, 1.0f));
        ConfigureDescriptor(ship.Find("FuelTank"), "FuelTank", stats.FuelTankDryMass, stats.CurrentFuelKg, true, new Vector3(1.2f, 0.35f, 2.1f));
        ConfigureDescriptor(ship.Find("MainThrusterGimbal"), "Engine", stats.EngineMass, 0f, false, new Vector3(1.0f, 0.75f, 0.7f));
        ConfigureDescriptor(ship.Find("Gun"), "Gun", stats.GunMass, 0f, false, new Vector3(0.32f, 0.22f, 0.65f));
        ConfigureDescriptor(ship.Find("RCS_Top"), "RCS_Top", stats.RcsBlockMass, 0f, false, new Vector3(0.55f, 0.22f, 0.55f));
        ConfigureDescriptor(ship.Find("RCS_Bottom"), "RCS_Bottom", stats.RcsBlockMass, 0f, false, new Vector3(0.55f, 0.22f, 0.55f));
        ConfigureDescriptor(ship.Find("RCS_Left"), "RCS_Left", stats.RcsBlockMass, 0f, false, new Vector3(0.22f, 0.55f, 0.55f));
        ConfigureDescriptor(ship.Find("RCS_Right"), "RCS_Right", stats.RcsBlockMass, 0f, false, new Vector3(0.22f, 0.55f, 0.55f));
    }

    public static void ConfigureGeneratedPrototypeDescriptors(Transform ship, ShipStats stats, PrototypeShipLayout layout)
    {
        if (ship == null || stats == null)
        {
            return;
        }

        if (layout == null)
        {
            ConfigureGeneratedPrototypeDescriptors(ship, stats);
            return;
        }

        PrototypeModuleLayoutEntry[] modules = layout.Modules;
        for (int i = 0; i < modules.Length; i++)
        {
            PrototypeModuleLayoutEntry module = modules[i];
            ConfigureDescriptor(
                ship.Find(module.ModuleId),
                module.ModuleId,
                GetModuleDryMass(stats, module.MassRole, module.HasDryMassOverride, module.DryMassKg),
                module.UsesCurrentShipFuel ? stats.CurrentFuelKg : 0f,
                module.UsesCurrentShipFuel,
                module.MassBoxSize);
        }

        PrototypeMainThrusterLayoutEntry[] mainThrusters = layout.MainThrusters;
        for (int i = 0; i < mainThrusters.Length; i++)
        {
            PrototypeMainThrusterLayoutEntry thruster = mainThrusters[i];
            ConfigureDescriptor(
                ship.Find(thruster.ModuleId),
                thruster.ModuleId,
                thruster.HasDryMassOverride ? thruster.DryMassKg : stats.EngineMass,
                0f,
                false,
                thruster.LocalScale);
        }

        PrototypeGunLayoutEntry[] guns = layout.Guns;
        for (int i = 0; i < guns.Length; i++)
        {
            PrototypeGunLayoutEntry gun = guns[i];
            ConfigureDescriptor(
                ship.Find(gun.ModuleId),
                gun.ModuleId,
                gun.HasDryMassOverride ? gun.DryMassKg : stats.GunMass,
                0f,
                false,
                gun.LocalScale);
        }

        PrototypeRcsBlockLayoutEntry[] rcsBlocks = layout.RcsBlocks;
        for (int i = 0; i < rcsBlocks.Length; i++)
        {
            PrototypeRcsBlockLayoutEntry block = rcsBlocks[i];
            ConfigureDescriptor(
                ship.Find(block.BlockId),
                block.BlockId,
                block.HasDryMassOverride ? block.DryMassKg : stats.RcsBlockMass,
                0f,
                false,
                block.LocalScale);
        }
    }

    public static void ConfigureImportedFunctionalDescriptors(Transform ship, ShipStats stats, PrototypeShipBuildMode buildMode)
    {
        if (ship == null || stats == null)
        {
            return;
        }

        Transform root = EnsureMassDescriptorRoot(ship);
        bool cargo = buildMode == PrototypeShipBuildMode.ImportedDemoCargoFunctional;
        Vector3 hullSize = cargo ? new Vector3(3.4f, 1.6f, 8.2f) : new Vector3(2.2f, 1.2f, 5.4f);
        Vector3 cockpitPosition = cargo ? new Vector3(0f, 0.45f, 2.45f) : new Vector3(0f, 0.38f, 1.75f);
        Vector3 fuelPosition = cargo ? new Vector3(0f, -0.05f, -0.65f) : new Vector3(0f, -0.05f, -0.45f);
        Vector3 enginePosition = cargo ? new Vector3(0f, 0f, -4.0f) : new Vector3(0f, 0f, -2.65f);
        Vector3 gunPosition = cargo ? new Vector3(0f, 0.72f, 2.9f) : new Vector3(0f, 0.55f, 2.35f);
        float rcsX = cargo ? 1.55f : 1.05f;
        float rcsY = cargo ? 0.75f : 0.55f;
        float rcsZ = cargo ? 1.9f : 1.25f;

        ConfigureDescriptor(EnsureDescriptorAnchor(root, "Hull", Vector3.zero), "ImportedHull", stats.HullMass, 0f, false, hullSize);
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "Cockpit", cockpitPosition), "ImportedCockpit", stats.CockpitMass, 0f, false, cargo ? new Vector3(1.4f, 0.8f, 1.6f) : new Vector3(1.0f, 0.65f, 1.2f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "FuelTank", fuelPosition), "ImportedFuelTank", stats.FuelTankDryMass, stats.CurrentFuelKg, true, cargo ? new Vector3(2.5f, 0.9f, 3.0f) : new Vector3(1.6f, 0.7f, 2.0f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "Engine", enginePosition), "ImportedEngine", stats.EngineMass, 0f, false, cargo ? new Vector3(1.8f, 1.0f, 1.2f) : new Vector3(1.2f, 0.85f, 0.9f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "Gun", gunPosition), "ImportedGun", stats.GunMass, 0f, false, cargo ? new Vector3(0.65f, 0.45f, 1.1f) : new Vector3(0.45f, 0.32f, 0.85f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "RCS_Top", new Vector3(0f, rcsY, rcsZ)), "ImportedRCS_Top", stats.RcsBlockMass, 0f, false, new Vector3(0.7f, 0.28f, 0.7f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "RCS_Bottom", new Vector3(0f, -rcsY, rcsZ)), "ImportedRCS_Bottom", stats.RcsBlockMass, 0f, false, new Vector3(0.7f, 0.28f, 0.7f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "RCS_Left", new Vector3(-rcsX, 0f, -rcsZ)), "ImportedRCS_Left", stats.RcsBlockMass, 0f, false, new Vector3(0.28f, 0.7f, 0.7f));
        ConfigureDescriptor(EnsureDescriptorAnchor(root, "RCS_Right", new Vector3(rcsX, 0f, -rcsZ)), "ImportedRCS_Right", stats.RcsBlockMass, 0f, false, new Vector3(0.28f, 0.7f, 0.7f));
    }

    private static Transform EnsureMassDescriptorRoot(Transform ship)
    {
        Transform root = ship.Find(ImportedFunctionalMassRootName);
        if (root == null)
        {
            root = new GameObject(ImportedFunctionalMassRootName).transform;
            root.SetParent(ship, false);
        }

        root.localPosition = Vector3.zero;
        root.localRotation = Quaternion.identity;
        root.localScale = Vector3.one;
        root.gameObject.hideFlags = HideFlags.DontSaveInBuild;
        return root;
    }

    private static Transform EnsureDescriptorAnchor(Transform root, string name, Vector3 localPosition)
    {
        Transform anchor = root.Find(name);
        if (anchor == null)
        {
            anchor = new GameObject(name).transform;
            anchor.SetParent(root, false);
        }

        anchor.localPosition = localPosition;
        anchor.localRotation = Quaternion.identity;
        anchor.localScale = Vector3.one;
        return anchor;
    }

    private static float GetModuleDryMass(ShipStats stats, PrototypeModuleMassRole role, bool hasOverride, float overrideMass)
    {
        if (hasOverride)
        {
            return overrideMass;
        }

        switch (role)
        {
            case PrototypeModuleMassRole.Cockpit:
                return stats.CockpitMass;
            case PrototypeModuleMassRole.FuelTank:
                return stats.FuelTankDryMass;
            case PrototypeModuleMassRole.Engine:
                return stats.EngineMass;
            case PrototypeModuleMassRole.Gun:
                return stats.GunMass;
            case PrototypeModuleMassRole.RcsBlock:
                return stats.RcsBlockMass;
            case PrototypeModuleMassRole.Hull:
            case PrototypeModuleMassRole.Custom:
            default:
                return stats.HullMass;
        }
    }

    private static void ConfigureDescriptor(Transform module, string id, float dryMassKg, float fuelMassKg, bool useShipFuel, Vector3 boxSize)
    {
        if (module == null)
        {
            return;
        }

        ModuleMassDescriptor descriptor = module.GetComponent<ModuleMassDescriptor>();
        if (descriptor == null)
        {
            descriptor = module.gameObject.AddComponent<ModuleMassDescriptor>();
        }

        descriptor.Configure(id, dryMassKg, fuelMassKg, useShipFuel, boxSize);

        PrototypeModuleDamageState damageState = module.GetComponent<PrototypeModuleDamageState>();
        if (damageState == null)
        {
            damageState = module.gameObject.AddComponent<PrototypeModuleDamageState>();
        }

        damageState.Configure(id, 100f, 0f);

        RcsThrusterBlock rcsBlock = module.GetComponent<RcsThrusterBlock>();
        if (rcsBlock != null)
        {
            rcsBlock.ConfigureDamageState(damageState);
        }
    }
}
