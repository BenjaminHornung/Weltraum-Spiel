using System;
using System.Collections.Generic;
using UnityEngine;

public enum PrototypeShipModuleCategory
{
    Cockpit = 0,
    Hull = 1,
    FuelTank = 2,
    MainThruster = 3,
    RcsBlock = 4,
    Gun = 5,
    Cargo = 6,
    Utility = 7
}

[Serializable]
public sealed class PrototypeShipModuleDefinition
{
    [SerializeField] private string definitionId;
    [SerializeField] private string displayName;
    [SerializeField] private PrototypeShipModuleCategory category;
    [SerializeField] private PrototypeModuleMassRole massRole;
    [SerializeField] private Vector3 localSize = Vector3.one;
    [SerializeField] private float dryMassKg = 100f;
    [SerializeField] private float fuelCapacityKg;
    [SerializeField] private float mainThrustForce;
    [SerializeField] private float rcsBlockThrust;
    [SerializeField] private PrototypeGunSettings gunSettings;
    [SerializeField] private Vector3 nozzleLocalPosition = new Vector3(0f, 0f, -0.55f);
    [SerializeField] private Vector3 blockedRcsDirection = Vector3.down;
    [SerializeField] private Vector3 muzzleLocalPosition = new Vector3(0f, 0f, 0.45f);

    public string DefinitionId => string.IsNullOrWhiteSpace(definitionId) ? string.Empty : definitionId.Trim();
    public string DisplayName => string.IsNullOrWhiteSpace(displayName) ? DefinitionId : displayName.Trim();
    public PrototypeShipModuleCategory Category => category;
    public PrototypeModuleMassRole MassRole => massRole;
    public Vector3 LocalSize => ClampVector(localSize, 0.01f);
    public float DryMassKg => Mathf.Max(0f, dryMassKg);
    public float FuelCapacityKg => Mathf.Max(0f, fuelCapacityKg);
    public float MainThrustForce => Mathf.Max(0f, mainThrustForce);
    public float RcsBlockThrust => Mathf.Max(0f, rcsBlockThrust);
    public PrototypeGunSettings GunSettings
    {
        get
        {
            PrototypeGunSettings settings = gunSettings.projectileSpeed > 0f ? gunSettings : PrototypeGunSettings.Default;
            settings.Clamp();
            return settings;
        }
    }
    public Vector3 NozzleLocalPosition => nozzleLocalPosition;
    public Vector3 BlockedRcsDirection => blockedRcsDirection == Vector3.zero ? Vector3.down : blockedRcsDirection.normalized;
    public Vector3 MuzzleLocalPosition => muzzleLocalPosition;

    public PrototypeShipModuleDefinition(
        string id,
        string name,
        PrototypeShipModuleCategory moduleCategory,
        PrototypeModuleMassRole moduleMassRole,
        Vector3 size,
        float dryMass,
        float fuelCapacity = 0f,
        float mainThrust = 0f,
        float rcsThrust = 0f,
        PrototypeGunSettings? weaponSettings = null,
        Vector3? nozzleOffset = null,
        Vector3? blockedRcsLocalDirection = null,
        Vector3? muzzleOffset = null)
    {
        definitionId = string.IsNullOrWhiteSpace(id) ? string.Empty : id.Trim();
        displayName = string.IsNullOrWhiteSpace(name) ? definitionId : name.Trim();
        category = moduleCategory;
        massRole = moduleMassRole;
        localSize = ClampVector(size, 0.01f);
        dryMassKg = Mathf.Max(0f, dryMass);
        fuelCapacityKg = Mathf.Max(0f, fuelCapacity);
        mainThrustForce = Mathf.Max(0f, mainThrust);
        rcsBlockThrust = Mathf.Max(0f, rcsThrust);
        gunSettings = weaponSettings ?? PrototypeGunSettings.Default;
        gunSettings.Clamp();
        nozzleLocalPosition = nozzleOffset ?? new Vector3(0f, 0f, -0.55f);
        blockedRcsDirection = blockedRcsLocalDirection ?? Vector3.down;
        muzzleLocalPosition = muzzleOffset ?? new Vector3(0f, 0f, 0.45f);
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
public sealed class PrototypeShipModuleInstance
{
    [SerializeField] private string instanceId;
    [SerializeField] private string definitionId;
    [SerializeField] private Vector3 localPosition;
    [SerializeField] private Vector3 localEulerAngles;
    [SerializeField] private Vector3 localScaleOverride = Vector3.one;

    public string InstanceId => string.IsNullOrWhiteSpace(instanceId) ? string.Empty : instanceId.Trim();
    public string DefinitionId => string.IsNullOrWhiteSpace(definitionId) ? string.Empty : definitionId.Trim();
    public Vector3 LocalPosition => localPosition;
    public Vector3 LocalEulerAngles => localEulerAngles;
    public Vector3 LocalScaleOverride => localScaleOverride;
    public bool HasScaleOverride => localScaleOverride != Vector3.zero && localScaleOverride != Vector3.one;

    public PrototypeShipModuleInstance(string id, string moduleDefinitionId, Vector3 position)
        : this(id, moduleDefinitionId, position, Vector3.zero, Vector3.one)
    {
    }

    public PrototypeShipModuleInstance(string id, string moduleDefinitionId, Vector3 position, Vector3 eulerAngles, Vector3 scaleOverride)
    {
        instanceId = string.IsNullOrWhiteSpace(id) ? string.Empty : id.Trim();
        definitionId = string.IsNullOrWhiteSpace(moduleDefinitionId) ? string.Empty : moduleDefinitionId.Trim();
        localPosition = position;
        localEulerAngles = eulerAngles;
        localScaleOverride = scaleOverride == Vector3.zero ? Vector3.one : scaleOverride;
    }
}

public sealed class PrototypeShipBlueprintValidationReport
{
    private readonly List<string> errors = new List<string>();
    private readonly List<string> warnings = new List<string>();

    public IReadOnlyList<string> Errors => errors;
    public IReadOnlyList<string> Warnings => warnings;
    public bool IsValid => errors.Count == 0;
    public int DefinitionCount { get; private set; }
    public int InstanceCount { get; private set; }
    public int CockpitCount { get; private set; }
    public int FuelTankCount { get; private set; }
    public int MainThrusterCount { get; private set; }
    public int RcsBlockCount { get; private set; }
    public int GunCount { get; private set; }
    public float DryMassKg { get; private set; }
    public float FuelCapacityKg { get; private set; }
    public float MainThrustForce { get; private set; }
    public float RcsBlockThrust { get; private set; }

    public void AddError(string message)
    {
        if (!string.IsNullOrWhiteSpace(message))
        {
            errors.Add(message);
        }
    }

    public void AddWarning(string message)
    {
        if (!string.IsNullOrWhiteSpace(message))
        {
            warnings.Add(message);
        }
    }

    public void CountDefinition()
    {
        DefinitionCount++;
    }

    public void CountInstance(PrototypeShipModuleDefinition definition)
    {
        if (definition == null)
        {
            return;
        }

        InstanceCount++;
        DryMassKg += definition.DryMassKg;
        FuelCapacityKg += definition.FuelCapacityKg;
        MainThrustForce += definition.MainThrustForce;
        RcsBlockThrust += definition.RcsBlockThrust;

        switch (definition.Category)
        {
            case PrototypeShipModuleCategory.Cockpit:
                CockpitCount++;
                break;
            case PrototypeShipModuleCategory.FuelTank:
                FuelTankCount++;
                break;
            case PrototypeShipModuleCategory.MainThruster:
                MainThrusterCount++;
                break;
            case PrototypeShipModuleCategory.RcsBlock:
                RcsBlockCount++;
                break;
            case PrototypeShipModuleCategory.Gun:
                GunCount++;
                break;
        }
    }
}

public sealed class PrototypeShipBlueprintBuildResult
{
    public PrototypeShipBlueprint Blueprint { get; }
    public PrototypeShipBlueprintValidationReport Validation { get; }
    public PrototypeShipVariant Variant { get; }
    public float TotalDryMassKg { get; }
    public float TotalFuelCapacityKg { get; }
    public float TotalMainThrustForce { get; }
    public float AverageRcsBlockThrust { get; }
    public int MainThrusterCount { get; }
    public int RcsBlockCount { get; }
    public int GunCount { get; }

    public bool IsValid => Validation != null && Validation.IsValid && Variant != null;

    public PrototypeShipBlueprintBuildResult(
        PrototypeShipBlueprint blueprint,
        PrototypeShipBlueprintValidationReport validation,
        PrototypeShipVariant variant,
        float dryMass,
        float fuelCapacity,
        float mainThrust,
        float averageRcsThrust,
        int mainThrusters,
        int rcsBlocks,
        int guns)
    {
        Blueprint = blueprint;
        Validation = validation;
        Variant = variant;
        TotalDryMassKg = Mathf.Max(0f, dryMass);
        TotalFuelCapacityKg = Mathf.Max(0f, fuelCapacity);
        TotalMainThrustForce = Mathf.Max(0f, mainThrust);
        AverageRcsBlockThrust = Mathf.Max(0f, averageRcsThrust);
        MainThrusterCount = Mathf.Max(0, mainThrusters);
        RcsBlockCount = Mathf.Max(0, rcsBlocks);
        GunCount = Mathf.Max(0, guns);
    }
}

[Serializable]
public sealed class PrototypeShipBlueprint
{
    [SerializeField] private string blueprintId;
    [SerializeField] private string displayName;
    [SerializeField] private PrototypeShipModuleDefinition[] definitions = Array.Empty<PrototypeShipModuleDefinition>();
    [SerializeField] private PrototypeShipModuleInstance[] instances = Array.Empty<PrototypeShipModuleInstance>();

    public string BlueprintId => string.IsNullOrWhiteSpace(blueprintId) ? string.Empty : blueprintId.Trim();
    public string DisplayName => string.IsNullOrWhiteSpace(displayName) ? BlueprintId : displayName.Trim();
    public PrototypeShipModuleDefinition[] Definitions => definitions ?? Array.Empty<PrototypeShipModuleDefinition>();
    public PrototypeShipModuleInstance[] Instances => instances ?? Array.Empty<PrototypeShipModuleInstance>();

    public PrototypeShipBlueprint(string id, string name, PrototypeShipModuleDefinition[] moduleDefinitions, PrototypeShipModuleInstance[] moduleInstances)
    {
        blueprintId = string.IsNullOrWhiteSpace(id) ? string.Empty : id.Trim();
        displayName = string.IsNullOrWhiteSpace(name) ? blueprintId : name.Trim();
        definitions = moduleDefinitions ?? Array.Empty<PrototypeShipModuleDefinition>();
        instances = moduleInstances ?? Array.Empty<PrototypeShipModuleInstance>();
    }

    public PrototypeShipBlueprintValidationReport Validate()
    {
        var report = new PrototypeShipBlueprintValidationReport();
        if (string.IsNullOrWhiteSpace(BlueprintId))
        {
            report.AddError("Blueprint id is required.");
        }

        var definitionById = new Dictionary<string, PrototypeShipModuleDefinition>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Definitions.Length; i++)
        {
            PrototypeShipModuleDefinition definition = Definitions[i];
            if (definition == null)
            {
                report.AddError("Module definition at index " + i + " is null.");
                continue;
            }

            string definitionId = definition.DefinitionId;
            if (string.IsNullOrWhiteSpace(definitionId))
            {
                report.AddError("Module definition at index " + i + " has no id.");
                continue;
            }

            if (definitionById.ContainsKey(definitionId))
            {
                report.AddError("Duplicate module definition id '" + definitionId + "'.");
                continue;
            }

            if (!IsFinite(definition.LocalSize))
            {
                report.AddError("Module definition '" + definitionId + "' has a non-finite size.");
            }

            if (definition.DryMassKg <= 0f)
            {
                report.AddWarning("Module definition '" + definitionId + "' has no dry mass.");
            }

            definitionById.Add(definitionId, definition);
            report.CountDefinition();
        }

        var instanceIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Instances.Length; i++)
        {
            PrototypeShipModuleInstance instance = Instances[i];
            if (instance == null)
            {
                report.AddError("Module instance at index " + i + " is null.");
                continue;
            }

            string instanceId = instance.InstanceId;
            if (string.IsNullOrWhiteSpace(instanceId))
            {
                report.AddError("Module instance at index " + i + " has no id.");
                continue;
            }

            if (!instanceIds.Add(instanceId))
            {
                report.AddError("Duplicate module instance id '" + instanceId + "'.");
            }

            if (string.IsNullOrWhiteSpace(instance.DefinitionId) || !definitionById.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition))
            {
                report.AddError("Module instance '" + instanceId + "' references missing definition '" + instance.DefinitionId + "'.");
                continue;
            }

            if (!IsFinite(instance.LocalPosition) || !IsFinite(instance.LocalEulerAngles) || !IsFinite(instance.LocalScaleOverride))
            {
                report.AddError("Module instance '" + instanceId + "' has a non-finite transform.");
            }

            report.CountInstance(definition);
        }

        if (report.InstanceCount == 0)
        {
            report.AddError("Blueprint has no module instances.");
        }

        if (report.CockpitCount == 0)
        {
            report.AddError("Blueprint requires at least one cockpit module.");
        }

        if (report.FuelTankCount == 0 || report.FuelCapacityKg <= 0f)
        {
            report.AddError("Blueprint requires fuel capacity from at least one fuel tank module.");
        }

        if (report.MainThrusterCount == 0 || report.MainThrustForce <= 0f)
        {
            report.AddError("Blueprint requires at least one main thruster with thrust.");
        }

        if (report.RcsBlockCount == 0 || report.RcsBlockThrust <= 0f)
        {
            report.AddError("Blueprint requires at least one RCS block with thrust.");
        }

        if (report.GunCount == 0)
        {
            report.AddError("Blueprint requires at least one gun module.");
        }

        return report;
    }

    public PrototypeShipBlueprintBuildResult BuildVariant()
    {
        PrototypeShipBlueprintValidationReport report = Validate();
        if (!report.IsValid)
        {
            return new PrototypeShipBlueprintBuildResult(this, report, null, report.DryMassKg, report.FuelCapacityKg, report.MainThrustForce, 0f, report.MainThrusterCount, report.RcsBlockCount, report.GunCount);
        }

        var definitionById = new Dictionary<string, PrototypeShipModuleDefinition>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Definitions.Length; i++)
        {
            PrototypeShipModuleDefinition definition = Definitions[i];
            if (definition != null && !string.IsNullOrWhiteSpace(definition.DefinitionId))
            {
                definitionById[definition.DefinitionId] = definition;
            }
        }

        var modules = new List<PrototypeModuleLayoutEntry>();
        var mainThrusters = new List<PrototypeMainThrusterLayoutEntry>();
        var rcsBlocks = new List<PrototypeRcsBlockLayoutEntry>();
        var guns = new List<PrototypeGunLayoutEntry>();

        float dryMass = 0f;
        float fuelCapacity = 0f;
        float totalMainThrust = 0f;
        float totalRcsThrust = 0f;
        float cockpitMass = 0f;
        float hullMass = 0f;
        float fuelTankDryMass = 0f;
        float engineMass = 0f;
        float gunMass = 0f;
        float rcsBlockMass = 0f;
        PrototypeGunSettings firstGunSettings = PrototypeGunSettings.Default;
        bool hasGunSettings = false;

        for (int i = 0; i < Instances.Length; i++)
        {
            PrototypeShipModuleInstance instance = Instances[i];
            PrototypeShipModuleDefinition definition = definitionById[instance.DefinitionId];
            Vector3 localSize = instance.HasScaleOverride ? ClampVector(instance.LocalScaleOverride, 0.01f) : definition.LocalSize;
            dryMass += definition.DryMassKg;
            fuelCapacity += definition.FuelCapacityKg;

            switch (definition.Category)
            {
                case PrototypeShipModuleCategory.MainThruster:
                    totalMainThrust += definition.MainThrustForce;
                    engineMass += definition.DryMassKg;
                    mainThrusters.Add(new PrototypeMainThrusterLayoutEntry(
                        instance.InstanceId,
                        "MainThrusterNozzle",
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.NozzleLocalPosition,
                        Vector3.zero,
                        definition.DryMassKg));
                    break;
                case PrototypeShipModuleCategory.RcsBlock:
                    totalRcsThrust += definition.RcsBlockThrust;
                    rcsBlockMass += definition.DryMassKg;
                    rcsBlocks.Add(new PrototypeRcsBlockLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.BlockedRcsDirection,
                        definition.DryMassKg));
                    break;
                case PrototypeShipModuleCategory.Gun:
                    gunMass += definition.DryMassKg;
                    if (!hasGunSettings)
                    {
                        firstGunSettings = definition.GunSettings;
                        hasGunSettings = true;
                    }

                    guns.Add(new PrototypeGunLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        "Muzzle",
                        definition.MuzzleLocalPosition,
                        Vector3.zero,
                        definition.DryMassKg));
                    break;
                case PrototypeShipModuleCategory.Cockpit:
                    cockpitMass += definition.DryMassKg;
                    modules.Add(new PrototypeModuleLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.MassRole,
                        definition.DryMassKg,
                        false));
                    break;
                case PrototypeShipModuleCategory.FuelTank:
                    fuelTankDryMass += definition.DryMassKg;
                    modules.Add(new PrototypeModuleLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.MassRole,
                        definition.DryMassKg,
                        true));
                    break;
                case PrototypeShipModuleCategory.Hull:
                case PrototypeShipModuleCategory.Cargo:
                case PrototypeShipModuleCategory.Utility:
                    hullMass += definition.DryMassKg;
                    modules.Add(new PrototypeModuleLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.MassRole,
                        definition.DryMassKg,
                        false));
                    break;
                default:
                    modules.Add(new PrototypeModuleLayoutEntry(
                        instance.InstanceId,
                        instance.LocalPosition,
                        instance.LocalEulerAngles,
                        localSize,
                        definition.MassRole,
                        definition.DryMassKg,
                        definition.Category == PrototypeShipModuleCategory.FuelTank));
                    break;
            }
        }

        PrototypeShipLayout layout = PrototypeShipLayout.FromEntries(modules.ToArray(), mainThrusters.ToArray(), rcsBlocks.ToArray(), guns.ToArray());
        int mainThrusterCount = Mathf.Max(1, mainThrusters.Count);
        int rcsBlockCount = Mathf.Max(1, rcsBlocks.Count);

        PrototypeShipMassSettings massSettings = PrototypeShipMassSettings.Default;
        massSettings.cockpitMass = cockpitMass;
        massSettings.hullMass = hullMass;
        massSettings.fuelTankDryMass = fuelTankDryMass;
        massSettings.engineMass = engineMass / mainThrusterCount;
        massSettings.gunMass = gunMass / Mathf.Max(1, guns.Count);
        massSettings.rcsBlockMass = rcsBlockMass / rcsBlockCount;
        massSettings.Clamp();

        PrototypeShipFuelSettings fuelSettings = PrototypeShipFuelSettings.Default;
        fuelSettings.maxFuelKg = Mathf.Max(0.01f, fuelCapacity);
        fuelSettings.currentFuelKg = fuelSettings.maxFuelKg;
        fuelSettings.fullThrottleFuelKgPerSecond = Mathf.Max(0f, totalMainThrust / 75000f);
        fuelSettings.Clamp();

        PrototypeMainThrusterSettings mainSettings = PrototypeMainThrusterSettings.Default;
        mainSettings.thrustForce = totalMainThrust / mainThrusterCount;
        mainSettings.Clamp();

        PrototypeRcsSettings rcsSettings = PrototypeRcsSettings.Default;
        rcsSettings.blockThrust = totalRcsThrust / rcsBlockCount;
        rcsSettings.translationForce = Mathf.Max(1000f, rcsSettings.blockThrust * 1.38f);
        rcsSettings.attitudeForce = rcsSettings.blockThrust;
        rcsSettings.Clamp();

        firstGunSettings.Clamp();
        PrototypeShipVariant variant = PrototypeShipVariant.FromBlueprint(
            "blueprint-" + BlueprintId,
            DisplayName,
            layout,
            mainSettings,
            rcsSettings,
            firstGunSettings,
            PrototypeCameraSettings.Default,
            massSettings,
            fuelSettings);

        return new PrototypeShipBlueprintBuildResult(this, report, variant, dryMass, fuelCapacity, totalMainThrust, rcsSettings.blockThrust, mainThrusters.Count, rcsBlocks.Count, guns.Count);
    }

    private static bool IsFinite(Vector3 value)
    {
        return float.IsFinite(value.x) && float.IsFinite(value.y) && float.IsFinite(value.z);
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(
            Mathf.Max(minimum, Mathf.Abs(value.x)),
            Mathf.Max(minimum, Mathf.Abs(value.y)),
            Mathf.Max(minimum, Mathf.Abs(value.z)));
    }
}

public static class PrototypeShipBlueprintCatalog
{
    public static PrototypeShipBlueprint[] BuiltInBlueprints()
    {
        return new[]
        {
            ScoutBlueprint(),
            HaulerBlueprint()
        };
    }

    public static PrototypeShipVariant[] BuiltInVariants()
    {
        PrototypeShipBlueprint[] blueprints = BuiltInBlueprints();
        var variants = new List<PrototypeShipVariant>(blueprints.Length);
        for (int i = 0; i < blueprints.Length; i++)
        {
            PrototypeShipBlueprintBuildResult result = blueprints[i].BuildVariant();
            if (result.IsValid)
            {
                variants.Add(result.Variant);
            }
        }

        return variants.ToArray();
    }

    public static PrototypeShipBlueprint ScoutBlueprint()
    {
        return new PrototypeShipBlueprint(
            "scout",
            "Scout Blueprint",
            new[]
            {
                Definition("cockpit-mk1", "Cockpit Mk1", PrototypeShipModuleCategory.Cockpit, PrototypeModuleMassRole.Cockpit, new Vector3(1.0f, 0.45f, 1.0f), 800f),
                Definition("hull-core", "Hull Core", PrototypeShipModuleCategory.Hull, PrototypeModuleMassRole.Hull, new Vector3(1.8f, 1.1f, 6.0f), 1000f),
                Definition("fuel-tank-300", "Fuel Tank 300", PrototypeShipModuleCategory.FuelTank, PrototypeModuleMassRole.FuelTank, new Vector3(1.2f, 0.35f, 2.1f), 400f, fuel: 300f),
                Definition("main-engine-45", "Main Engine 45", PrototypeShipModuleCategory.MainThruster, PrototypeModuleMassRole.Engine, new Vector3(1.0f, 0.75f, 0.7f), 700f, mainThrust: 45000f),
                Definition("rcs-pod-65", "RCS Pod 65", PrototypeShipModuleCategory.RcsBlock, PrototypeModuleMassRole.RcsBlock, new Vector3(0.55f, 0.22f, 0.55f), 80f, rcsThrust: 6500f),
                Definition("gun-light", "Light Gun", PrototypeShipModuleCategory.Gun, PrototypeModuleMassRole.Gun, new Vector3(0.32f, 0.22f, 0.65f), 250f, gun: Gun(1500f, 4f, 3f, 0.12f))
            },
            new[]
            {
                Instance("Hull", "hull-core", Vector3.zero),
                Instance("Cockpit", "cockpit-mk1", new Vector3(0f, 0.45f, 2.05f)),
                Instance("FuelTank", "fuel-tank-300", new Vector3(0f, -0.45f, 0.1f)),
                Instance("MainThrusterGimbal", "main-engine-45", new Vector3(0f, 0f, -3.35f)),
                Instance("RCS_Top", "rcs-pod-65", new Vector3(0f, 0.7f, 0f), Vector3.zero, new Vector3(0.55f, 0.22f, 0.55f)),
                Instance("RCS_Bottom", "rcs-pod-65", new Vector3(0f, -0.7f, 0f), Vector3.zero, new Vector3(0.55f, 0.22f, 0.55f)),
                Instance("RCS_Left", "rcs-pod-65", new Vector3(-1.02f, 0f, 0f), Vector3.zero, new Vector3(0.22f, 0.55f, 0.55f)),
                Instance("RCS_Right", "rcs-pod-65", new Vector3(1.02f, 0f, 0f), Vector3.zero, new Vector3(0.22f, 0.55f, 0.55f)),
                Instance("Gun", "gun-light", new Vector3(0f, 0.1f, 3.25f))
            });
    }

    public static PrototypeShipBlueprint HaulerBlueprint()
    {
        return new PrototypeShipBlueprint(
            "hauler",
            "Hauler Blueprint",
            new[]
            {
                Definition("hauler-cockpit", "Hauler Cockpit", PrototypeShipModuleCategory.Cockpit, PrototypeModuleMassRole.Cockpit, new Vector3(1.1f, 0.55f, 1.15f), 950f),
                Definition("hauler-hull", "Hauler Hull", PrototypeShipModuleCategory.Hull, PrototypeModuleMassRole.Hull, new Vector3(2.2f, 1.2f, 7.2f), 1550f),
                Definition("hauler-tank", "Hauler Fuel Tank", PrototypeShipModuleCategory.FuelTank, PrototypeModuleMassRole.FuelTank, new Vector3(1.6f, 0.45f, 2.8f), 620f, fuel: 620f),
                Definition("hauler-cargo", "Cargo Bay", PrototypeShipModuleCategory.Cargo, PrototypeModuleMassRole.Custom, new Vector3(1.9f, 0.9f, 1.8f), 1400f),
                Definition("hauler-engine", "Hauler Engine", PrototypeShipModuleCategory.MainThruster, PrototypeModuleMassRole.Engine, new Vector3(1.2f, 0.85f, 0.8f), 920f, mainThrust: 56000f),
                Definition("hauler-rcs", "Hauler RCS Pod", PrototypeShipModuleCategory.RcsBlock, PrototypeModuleMassRole.RcsBlock, new Vector3(0.62f, 0.28f, 0.62f), 120f, rcsThrust: 7600f),
                Definition("hauler-gun", "Hauler Defense Gun", PrototypeShipModuleCategory.Gun, PrototypeModuleMassRole.Gun, new Vector3(0.38f, 0.25f, 0.7f), 310f, gun: Gun(1150f, 2.6f, 3.6f, 0.16f))
            },
            new[]
            {
                Instance("HaulerHull", "hauler-hull", new Vector3(0f, 0f, -0.2f)),
                Instance("HaulerCockpit", "hauler-cockpit", new Vector3(0f, 0.52f, 2.55f)),
                Instance("HaulerFuelTank", "hauler-tank", new Vector3(0f, -0.5f, -0.15f)),
                Instance("CargoBayA", "hauler-cargo", new Vector3(0f, -0.05f, -1.65f)),
                Instance("HaulerMainThruster", "hauler-engine", new Vector3(0f, 0f, -4.1f)),
                Instance("HaulerRCS_Top", "hauler-rcs", new Vector3(0f, 0.82f, 0.55f), Vector3.zero, new Vector3(0.62f, 0.28f, 0.62f)),
                Instance("HaulerRCS_Bottom", "hauler-rcs", new Vector3(0f, -0.82f, -0.45f), Vector3.zero, new Vector3(0.62f, 0.28f, 0.62f)),
                Instance("HaulerRCS_Left", "hauler-rcs", new Vector3(-1.25f, 0f, 0.65f), Vector3.zero, new Vector3(0.28f, 0.62f, 0.62f)),
                Instance("HaulerRCS_Right", "hauler-rcs", new Vector3(1.25f, 0f, -0.65f), Vector3.zero, new Vector3(0.28f, 0.62f, 0.62f)),
                Instance("HaulerGun", "hauler-gun", new Vector3(0f, 0.16f, 3.75f))
            });
    }

    private static PrototypeShipModuleDefinition Definition(
        string id,
        string name,
        PrototypeShipModuleCategory category,
        PrototypeModuleMassRole massRole,
        Vector3 size,
        float dryMass,
        float fuel = 0f,
        float mainThrust = 0f,
        float rcsThrust = 0f,
        PrototypeGunSettings? gun = null)
    {
        return new PrototypeShipModuleDefinition(id, name, category, massRole, size, dryMass, fuel, mainThrust, rcsThrust, gun);
    }

    private static PrototypeShipModuleInstance Instance(string id, string definitionId, Vector3 localPosition)
    {
        return new PrototypeShipModuleInstance(id, definitionId, localPosition);
    }

    private static PrototypeShipModuleInstance Instance(string id, string definitionId, Vector3 localPosition, Vector3 localEulerAngles, Vector3 localScaleOverride)
    {
        return new PrototypeShipModuleInstance(id, definitionId, localPosition, localEulerAngles, localScaleOverride);
    }

    private static PrototypeGunSettings Gun(float projectileSpeed, float fireRate, float lifetime, float projectileMass)
    {
        PrototypeGunSettings settings = PrototypeGunSettings.Default;
        settings.projectileSpeed = projectileSpeed;
        settings.projectileFireRate = fireRate;
        settings.projectileLifetime = lifetime;
        settings.projectileMass = projectileMass;
        settings.projectileDiameter = Mathf.Max(PrototypeGunSettings.MinimumProjectileDiameter, projectileMass);
        settings.projectileRadius = settings.projectileDiameter * 0.5f;
        settings.Clamp();
        return settings;
    }
}
