using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;

public enum PrototypeShipBuilderFindingSeverity
{
    Warning,
    Error
}

public enum PrototypeShipBuilderFindingKind
{
    Canonical,
    HardOverlap,
    SoftOverlap,
    FreeFloating,
    ThrustOffset,
    RcsCoverage,
    CockpitPlacement
}

public readonly struct PrototypeShipBuilderFinding
{
    public PrototypeShipBuilderFinding(
        PrototypeShipBuilderFindingSeverity severity,
        PrototypeShipBuilderFindingKind kind,
        string message,
        string primaryInstanceId = "",
        string secondaryInstanceId = "")
    {
        Severity = severity;
        Kind = kind;
        Message = message ?? string.Empty;
        PrimaryInstanceId = primaryInstanceId ?? string.Empty;
        SecondaryInstanceId = secondaryInstanceId ?? string.Empty;
    }

    public PrototypeShipBuilderFindingSeverity Severity { get; }
    public PrototypeShipBuilderFindingKind Kind { get; }
    public string Message { get; }
    public string PrimaryInstanceId { get; }
    public string SecondaryInstanceId { get; }
    public bool HasInstanceReference => !string.IsNullOrWhiteSpace(PrimaryInstanceId);
}

public sealed class PrototypeShipBuilderSpatialReport
{
    private readonly List<PrototypeShipBuilderFinding> findings = new List<PrototypeShipBuilderFinding>();

    public IReadOnlyList<PrototypeShipBuilderFinding> Findings => findings;
    public int ErrorCount { get; private set; }
    public int WarningCount { get; private set; }
    public bool IsValid => ErrorCount == 0;

    public void Add(PrototypeShipBuilderFinding finding)
    {
        if (string.IsNullOrWhiteSpace(finding.Message))
        {
            return;
        }

        findings.Add(finding);
        if (finding.Severity == PrototypeShipBuilderFindingSeverity.Error)
        {
            ErrorCount++;
        }
        else
        {
            WarningCount++;
        }
    }
}

public sealed class PrototypeShipBuilderValidationResult
{
    public PrototypeShipBuilderValidationResult(
        PrototypeShipBlueprintValidationReport blueprintReport,
        PrototypeShipBuilderSpatialReport spatialReport)
    {
        BlueprintReport = blueprintReport ?? new PrototypeShipBlueprintValidationReport();
        SpatialReport = spatialReport ?? new PrototypeShipBuilderSpatialReport();
    }

    public PrototypeShipBlueprintValidationReport BlueprintReport { get; }
    public PrototypeShipBuilderSpatialReport SpatialReport { get; }
    public bool IsValid => BlueprintReport.IsValid && SpatialReport.IsValid;
    public int ErrorCount => BlueprintReport.Errors.Count + SpatialReport.ErrorCount;
    public int WarningCount => BlueprintReport.Warnings.Count + SpatialReport.WarningCount;

    public string FirstError
    {
        get
        {
            if (BlueprintReport.Errors.Count > 0)
            {
                return BlueprintReport.Errors[0];
            }

            for (int i = 0; i < SpatialReport.Findings.Count; i++)
            {
                PrototypeShipBuilderFinding finding = SpatialReport.Findings[i];
                if (finding.Severity == PrototypeShipBuilderFindingSeverity.Error)
                {
                    return finding.Message;
                }
            }

            return string.Empty;
        }
    }
}

public readonly struct PrototypeShipBuilderStats
{
    public PrototypeShipBuilderStats(
        bool isAvailable,
        float dryMassKg,
        float fuelCapacityKg,
        float totalMassKg,
        float mainThrustN,
        float fullAcceleration,
        float emptyAcceleration,
        float deltaV,
        int rcsPodCount,
        float rcsTranslationForce,
        float rcsAttitudeForce,
        Vector3 centerOfMass,
        float thrustOffset)
    {
        IsAvailable = isAvailable;
        DryMassKg = dryMassKg;
        FuelCapacityKg = fuelCapacityKg;
        TotalMassKg = totalMassKg;
        MainThrustN = mainThrustN;
        FullAcceleration = fullAcceleration;
        EmptyAcceleration = emptyAcceleration;
        DeltaV = deltaV;
        RcsPodCount = rcsPodCount;
        RcsTranslationForce = rcsTranslationForce;
        RcsAttitudeForce = rcsAttitudeForce;
        CenterOfMass = centerOfMass;
        ThrustOffset = thrustOffset;
    }

    public bool IsAvailable { get; }
    public float DryMassKg { get; }
    public float FuelCapacityKg { get; }
    public float TotalMassKg { get; }
    public float MainThrustN { get; }
    public float FullAcceleration { get; }
    public float EmptyAcceleration { get; }
    public float DeltaV { get; }
    public int RcsPodCount { get; }
    public float RcsTranslationForce { get; }
    public float RcsAttitudeForce { get; }
    public Vector3 CenterOfMass { get; }
    public float ThrustOffset { get; }

    public static PrototypeShipBuilderStats Unavailable(Vector3 centerOfMass, float thrustOffset)
    {
        return new PrototypeShipBuilderStats(false, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0, 0f, 0f, centerOfMass, thrustOffset);
    }
}

public sealed class PrototypeShipBuilderSession
{
    public const float GridSize = 0.25f;
    public const int MaxUndoDepth = 32;

    private readonly PrototypeShipModuleDefinition[] definitions;
    private readonly List<PrototypeShipModuleInstance> instances = new List<PrototypeShipModuleInstance>();
    private readonly Stack<PrototypeShipModuleInstance[]> undoStack = new Stack<PrototypeShipModuleInstance[]>();
    private string blueprintId;
    private string displayName;
    private string selectedInstanceId = string.Empty;
    private bool mirrorX;

    public PrototypeShipBuilderSession(PrototypeShipBlueprint blueprint)
    {
        PrototypeShipBlueprint source = blueprint ?? PrototypeShipBlueprintCatalog.ScoutBlueprint();
        blueprintId = source.BlueprintId;
        displayName = source.DisplayName;
        definitions = CloneDefinitions(source.Definitions);
        instances.AddRange(CloneInstances(source.Instances));
    }

    public PrototypeShipBlueprint DraftBlueprint => new PrototypeShipBlueprint(
        blueprintId,
        displayName,
        CloneDefinitions(definitions),
        CloneInstances(instances.ToArray()));
    public IReadOnlyList<PrototypeShipModuleDefinition> Definitions => definitions;
    public IReadOnlyList<PrototypeShipModuleInstance> Instances => instances;
    public string SelectedInstanceId => selectedInstanceId;
    public bool MirrorX => mirrorX;
    public bool IsDirty { get; private set; }
    public int UndoCount => undoStack.Count;

    public void RenameBlueprint(string id, string name)
    {
        PushUndo();
        blueprintId = string.IsNullOrWhiteSpace(id) ? blueprintId : id.Trim();
        displayName = string.IsNullOrWhiteSpace(name) ? blueprintId : name.Trim();
        MarkDirty();
    }

    public PrototypeShipModuleInstance AddModule(string definitionId, Vector3 localPosition)
    {
        PrototypeShipModuleDefinition definition = FindDefinition(definitionId);
        if (definition == null)
        {
            return null;
        }

        PushUndo();
        Vector3 snapped = Snap(localPosition);
        var primary = new PrototypeShipModuleInstance(AllocateInstanceId(definition.DefinitionId, false), definition.DefinitionId, snapped, Vector3.zero, Vector3.one);
        instances.Add(primary);
        selectedInstanceId = primary.InstanceId;
        if (mirrorX && Mathf.Abs(snapped.x) > 0.001f)
        {
            var mirror = new PrototypeShipModuleInstance(AllocateInstanceId(definition.DefinitionId, true), definition.DefinitionId, new Vector3(-snapped.x, snapped.y, snapped.z), Vector3.zero, Vector3.one);
            instances.Add(mirror);
        }

        MarkDirty();
        return primary;
    }

    public bool MoveModule(string instanceId, Vector3 localPosition)
    {
        int index = FindInstanceIndex(instanceId);
        if (index < 0)
        {
            return false;
        }

        PushUndo();
        PrototypeShipModuleInstance source = instances[index];
        instances[index] = new PrototypeShipModuleInstance(source.InstanceId, source.DefinitionId, Snap(localPosition), source.LocalEulerAngles, source.LocalScaleOverride);
        selectedInstanceId = source.InstanceId;
        MarkDirty();
        return true;
    }

    public bool RotateYaw90(string instanceId)
    {
        return Rotate(instanceId, new Vector3(0f, 90f, 0f));
    }

    public bool RotatePitch90(string instanceId)
    {
        return Rotate(instanceId, new Vector3(90f, 0f, 0f));
    }

    public bool DuplicateModule(string instanceId)
    {
        int index = FindInstanceIndex(instanceId);
        if (index < 0)
        {
            return false;
        }

        PushUndo();
        PrototypeShipModuleInstance source = instances[index];
        var duplicate = new PrototypeShipModuleInstance(
            AllocateInstanceId(source.DefinitionId, false),
            source.DefinitionId,
            Snap(source.LocalPosition + new Vector3(GridSize, 0f, 0f)),
            source.LocalEulerAngles,
            source.LocalScaleOverride);
        instances.Add(duplicate);
        selectedInstanceId = duplicate.InstanceId;
        MarkDirty();
        return true;
    }

    public bool RemoveModule(string instanceId)
    {
        int index = FindInstanceIndex(instanceId);
        if (index < 0)
        {
            return false;
        }

        PushUndo();
        instances.RemoveAt(index);
        if (selectedInstanceId == instanceId)
        {
            selectedInstanceId = string.Empty;
        }

        MarkDirty();
        return true;
    }

    public bool SelectModule(string instanceId)
    {
        if (string.IsNullOrWhiteSpace(instanceId))
        {
            selectedInstanceId = string.Empty;
            return true;
        }

        if (FindInstanceIndex(instanceId) < 0)
        {
            return false;
        }

        selectedInstanceId = instanceId;
        return true;
    }

    public void SetMirrorX(bool enabled)
    {
        mirrorX = enabled;
    }

    public bool Undo()
    {
        if (undoStack.Count == 0)
        {
            return false;
        }

        instances.Clear();
        instances.AddRange(CloneInstances(undoStack.Pop()));
        if (!string.IsNullOrWhiteSpace(selectedInstanceId) && FindInstanceIndex(selectedInstanceId) < 0)
        {
            selectedInstanceId = string.Empty;
        }

        MarkDirty();
        return true;
    }

    public PrototypeShipBuilderValidationResult Validate()
    {
        PrototypeShipBlueprint draft = DraftBlueprint;
        PrototypeShipBlueprintValidationReport canonical = draft.Validate();
        return new PrototypeShipBuilderValidationResult(canonical, BuildSpatialReport(draft));
    }

    public PrototypeShipBuilderStats BuildStats()
    {
        PrototypeShipBlueprint draft = DraftBlueprint;
        Vector3 centerOfMass = CalculateCenterOfMass(draft, out _);
        float thrustOffset = CalculateThrustOffset(draft, centerOfMass);
        PrototypeShipBlueprintBuildResult result = draft.BuildVariant();
        if (!result.IsValid)
        {
            return PrototypeShipBuilderStats.Unavailable(centerOfMass, thrustOffset);
        }

        PrototypeShipFuelSettings fuel = result.Variant.Fuel;
        float dryMass = result.TotalDryMassKg;
        float fuelMass = result.TotalFuelCapacityKg;
        float totalMass = dryMass + fuelMass;
        float fullAcceleration = totalMass > 0f ? result.TotalMainThrustForce / totalMass : 0f;
        float emptyAcceleration = dryMass > 0f ? result.TotalMainThrustForce / dryMass : 0f;
        float deltaV = 0f;
        if (fuel.fullThrottleFuelKgPerSecond > 0f && dryMass > 0f && totalMass > dryMass)
        {
            float exhaustVelocity = result.TotalMainThrustForce / fuel.fullThrottleFuelKgPerSecond;
            deltaV = exhaustVelocity * Mathf.Log(totalMass / dryMass);
        }

        return new PrototypeShipBuilderStats(
            true,
            dryMass,
            fuelMass,
            totalMass,
            result.TotalMainThrustForce,
            fullAcceleration,
            emptyAcceleration,
            deltaV,
            result.RcsBlockCount,
            result.Variant.Rcs.translationForce,
            result.Variant.Rcs.attitudeForce,
            centerOfMass,
            thrustOffset);
    }

    public static Vector3 Snap(Vector3 value)
    {
        return new Vector3(Snap(value.x), Snap(value.y), Snap(value.z));
    }

    public static PrototypeShipModuleDefinition[] BuildPaletteDefinitions()
    {
        var byId = new Dictionary<string, PrototypeShipModuleDefinition>(StringComparer.OrdinalIgnoreCase);
        PrototypeShipBlueprint[] blueprints = PrototypeShipBlueprintCatalog.BuiltInBlueprints();
        for (int i = 0; i < blueprints.Length; i++)
        {
            PrototypeShipModuleDefinition[] source = blueprints[i].Definitions;
            for (int j = 0; j < source.Length; j++)
            {
                PrototypeShipModuleDefinition definition = source[j];
                if (definition != null && !byId.ContainsKey(definition.DefinitionId))
                {
                    byId.Add(definition.DefinitionId, CloneDefinition(definition));
                }
            }
        }

        var result = new List<PrototypeShipModuleDefinition>(byId.Values);
        result.Sort((a, b) => string.Compare(a.DefinitionId, b.DefinitionId, StringComparison.OrdinalIgnoreCase));
        return result.ToArray();
    }

    public static PrototypeShipBlueprint CreateEditableCopy(PrototypeShipBlueprint source, string id)
    {
        PrototypeShipBlueprint blueprint = source ?? PrototypeShipBlueprintCatalog.ScoutBlueprint();
        string copyId = string.IsNullOrWhiteSpace(id) ? blueprint.BlueprintId + "-copy-1" : id.Trim();
        return new PrototypeShipBlueprint(copyId, blueprint.DisplayName + " Copy", CloneDefinitions(blueprint.Definitions), CloneInstances(blueprint.Instances));
    }

    public static string FormatStatValue(float value, string unit, int decimals = 0)
    {
        if (float.IsNaN(value) || float.IsInfinity(value))
        {
            return "--";
        }

        string format = decimals <= 0 ? "N0" : "N" + decimals;
        return value.ToString(format, CultureInfo.InvariantCulture).Replace(",", " ") + (string.IsNullOrEmpty(unit) ? string.Empty : " " + unit);
    }

    private bool Rotate(string instanceId, Vector3 delta)
    {
        int index = FindInstanceIndex(instanceId);
        if (index < 0)
        {
            return false;
        }

        PushUndo();
        PrototypeShipModuleInstance source = instances[index];
        Vector3 euler = source.LocalEulerAngles + delta;
        euler = new Vector3(NormalizeQuarterTurn(euler.x), NormalizeQuarterTurn(euler.y), NormalizeQuarterTurn(euler.z));
        instances[index] = new PrototypeShipModuleInstance(source.InstanceId, source.DefinitionId, source.LocalPosition, euler, source.LocalScaleOverride);
        selectedInstanceId = source.InstanceId;
        MarkDirty();
        return true;
    }

    private PrototypeShipBuilderSpatialReport BuildSpatialReport(PrototypeShipBlueprint draft)
    {
        var report = new PrototypeShipBuilderSpatialReport();
        var boxes = BuildBoxes(draft);
        for (int i = 0; i < boxes.Count; i++)
        {
            bool touchesAny = false;
            for (int j = 0; j < boxes.Count; j++)
            {
                if (i == j)
                {
                    continue;
                }

                float overlapVolume = OverlapVolume(boxes[i], boxes[j]);
                if (overlapVolume > 0f)
                {
                    touchesAny = true;
                }

                if (j <= i || overlapVolume <= 0f)
                {
                    continue;
                }

                float smallerVolume = Mathf.Min(boxes[i].Volume, boxes[j].Volume);
                float ratio = smallerVolume > 0f ? overlapVolume / smallerVolume : 0f;
                if (ratio > 0.75f)
                {
                    report.Add(new PrototypeShipBuilderFinding(
                        PrototypeShipBuilderFindingSeverity.Error,
                        PrototypeShipBuilderFindingKind.HardOverlap,
                        "Module ueberlappen stark: " + boxes[i].InstanceId + " / " + boxes[j].InstanceId,
                        boxes[i].InstanceId,
                        boxes[j].InstanceId));
                }
                else
                {
                    report.Add(new PrototypeShipBuilderFinding(
                        PrototypeShipBuilderFindingSeverity.Warning,
                        PrototypeShipBuilderFindingKind.SoftOverlap,
                        "Module beruehren sich: " + boxes[i].InstanceId + " / " + boxes[j].InstanceId,
                        boxes[i].InstanceId,
                        boxes[j].InstanceId));
                }
            }

            if (!touchesAny && boxes.Count > 1)
            {
                report.Add(new PrototypeShipBuilderFinding(
                    PrototypeShipBuilderFindingSeverity.Warning,
                    PrototypeShipBuilderFindingKind.FreeFloating,
                    "Modul schwebt frei: " + boxes[i].InstanceId,
                    boxes[i].InstanceId));
            }
        }

        Vector3 centerOfMass = CalculateCenterOfMass(draft, out float totalMass);
        float thrustOffset = CalculateThrustOffset(draft, centerOfMass);
        if (totalMass > 0f && thrustOffset > 0.35f)
        {
            report.Add(new PrototypeShipBuilderFinding(
                PrototypeShipBuilderFindingSeverity.Warning,
                PrototypeShipBuilderFindingKind.ThrustOffset,
                "Schub laeuft nicht durch den Schwerpunkt"));
        }

        AddRcsCoverageWarnings(draft, centerOfMass, report);
        AddCockpitPlacementWarning(draft, boxes, report);
        return report;
    }

    private static List<BuilderBox> BuildBoxes(PrototypeShipBlueprint draft)
    {
        var definitions = BuildDefinitionMap(draft);
        var boxes = new List<BuilderBox>();
        PrototypeShipModuleInstance[] source = draft.Instances;
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleInstance instance = source[i];
            if (instance == null || !definitions.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition))
            {
                continue;
            }

            Vector3 size = instance.HasScaleOverride ? ClampVector(instance.LocalScaleOverride, 0.01f) : definition.LocalSize;
            Vector3 rotatedSize = RotateExtents(size, instance.LocalEulerAngles);
            Vector3 half = rotatedSize * 0.5f;
            boxes.Add(new BuilderBox(instance.InstanceId, definition.Category, instance.LocalPosition - half, instance.LocalPosition + half));
        }

        return boxes;
    }

    private static float OverlapVolume(BuilderBox a, BuilderBox b)
    {
        float x = Mathf.Max(0f, Mathf.Min(a.Max.x, b.Max.x) - Mathf.Max(a.Min.x, b.Min.x));
        float y = Mathf.Max(0f, Mathf.Min(a.Max.y, b.Max.y) - Mathf.Max(a.Min.y, b.Min.y));
        float z = Mathf.Max(0f, Mathf.Min(a.Max.z, b.Max.z) - Mathf.Max(a.Min.z, b.Min.z));
        return x * y * z;
    }

    private static Vector3 CalculateCenterOfMass(PrototypeShipBlueprint draft, out float totalMass)
    {
        var definitions = BuildDefinitionMap(draft);
        Vector3 weighted = Vector3.zero;
        totalMass = 0f;
        PrototypeShipModuleInstance[] source = draft.Instances;
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleInstance instance = source[i];
            if (instance == null || !definitions.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition))
            {
                continue;
            }

            float mass = definition.DryMassKg + definition.FuelCapacityKg;
            weighted += instance.LocalPosition * mass;
            totalMass += mass;
        }

        return totalMass > 0f ? weighted / totalMass : Vector3.zero;
    }

    private static float CalculateThrustOffset(PrototypeShipBlueprint draft, Vector3 centerOfMass)
    {
        var definitions = BuildDefinitionMap(draft);
        Vector3 weighted = Vector3.zero;
        float totalThrust = 0f;
        PrototypeShipModuleInstance[] source = draft.Instances;
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleInstance instance = source[i];
            if (instance == null
                || !definitions.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition)
                || definition.Category != PrototypeShipModuleCategory.MainThruster
                || definition.MainThrustForce <= 0f)
            {
                continue;
            }

            weighted += instance.LocalPosition * definition.MainThrustForce;
            totalThrust += definition.MainThrustForce;
        }

        if (totalThrust <= 0f)
        {
            return 0f;
        }

        Vector3 thrustCenter = weighted / totalThrust;
        return new Vector2(thrustCenter.x - centerOfMass.x, thrustCenter.y - centerOfMass.y).magnitude;
    }

    private static void AddRcsCoverageWarnings(PrototypeShipBlueprint draft, Vector3 centerOfMass, PrototypeShipBuilderSpatialReport report)
    {
        var definitions = BuildDefinitionMap(draft);
        bool plusX = false;
        bool minusX = false;
        bool plusY = false;
        bool minusY = false;
        PrototypeShipModuleInstance[] source = draft.Instances;
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleInstance instance = source[i];
            if (instance == null
                || !definitions.TryGetValue(instance.DefinitionId, out PrototypeShipModuleDefinition definition)
                || definition.Category != PrototypeShipModuleCategory.RcsBlock)
            {
                continue;
            }

            Vector3 offset = instance.LocalPosition - centerOfMass;
            plusX |= offset.x > 0.05f;
            minusX |= offset.x < -0.05f;
            plusY |= offset.y > 0.05f;
            minusY |= offset.y < -0.05f;
        }

        AddCoverageWarning(report, plusX, "+X");
        AddCoverageWarning(report, minusX, "-X");
        AddCoverageWarning(report, plusY, "+Y");
        AddCoverageWarning(report, minusY, "-Y");
    }

    private static void AddCoverageWarning(PrototypeShipBuilderSpatialReport report, bool covered, string direction)
    {
        if (!covered)
        {
            report.Add(new PrototypeShipBuilderFinding(
                PrototypeShipBuilderFindingSeverity.Warning,
                PrototypeShipBuilderFindingKind.RcsCoverage,
                "RCS deckt Richtung " + direction + " nicht ab"));
        }
    }

    private static void AddCockpitPlacementWarning(PrototypeShipBlueprint draft, List<BuilderBox> boxes, PrototypeShipBuilderSpatialReport report)
    {
        if (boxes.Count == 0)
        {
            return;
        }

        float minZ = float.PositiveInfinity;
        float maxZ = float.NegativeInfinity;
        for (int i = 0; i < boxes.Count; i++)
        {
            minZ = Mathf.Min(minZ, boxes[i].Min.z);
            maxZ = Mathf.Max(maxZ, boxes[i].Max.z);
        }

        float frontThirdStart = Mathf.Lerp(minZ, maxZ, 2f / 3f);
        for (int i = 0; i < boxes.Count; i++)
        {
            if (boxes[i].Category == PrototypeShipModuleCategory.Cockpit && boxes[i].Center.z < frontThirdStart)
            {
                report.Add(new PrototypeShipBuilderFinding(
                    PrototypeShipBuilderFindingSeverity.Warning,
                    PrototypeShipBuilderFindingKind.CockpitPlacement,
                    "Cockpit liegt weit hinten",
                    boxes[i].InstanceId));
            }
        }
    }

    private PrototypeShipModuleDefinition FindDefinition(string definitionId)
    {
        for (int i = 0; i < definitions.Length; i++)
        {
            if (definitions[i] != null && string.Equals(definitions[i].DefinitionId, definitionId, StringComparison.OrdinalIgnoreCase))
            {
                return definitions[i];
            }
        }

        return null;
    }

    private int FindInstanceIndex(string instanceId)
    {
        for (int i = 0; i < instances.Count; i++)
        {
            if (instances[i] != null && string.Equals(instances[i].InstanceId, instanceId, StringComparison.OrdinalIgnoreCase))
            {
                return i;
            }
        }

        return -1;
    }

    private string AllocateInstanceId(string definitionId, bool mirror)
    {
        string baseId = SanitizeId(definitionId);
        for (int i = 1; i < 10000; i++)
        {
            string candidate = mirror ? baseId + "-" + i + "-mirror" : baseId + "-" + i;
            if (FindInstanceIndex(candidate) < 0)
            {
                return candidate;
            }
        }

        return baseId + "-" + Guid.NewGuid().ToString("N");
    }

    private void PushUndo()
    {
        undoStack.Push(CloneInstances(instances.ToArray()));
        while (undoStack.Count > MaxUndoDepth)
        {
            TrimOldestUndo();
        }
    }

    private void TrimOldestUndo()
    {
        var items = undoStack.ToArray();
        undoStack.Clear();
        for (int i = items.Length - 2; i >= 0; i--)
        {
            undoStack.Push(items[i]);
        }
    }

    private void MarkDirty()
    {
        IsDirty = true;
    }

    private static float Snap(float value)
    {
        return Mathf.Round(value / GridSize) * GridSize;
    }

    private static float NormalizeQuarterTurn(float value)
    {
        float normalized = Mathf.Repeat(value, 360f);
        return Mathf.Round(normalized / 90f) * 90f % 360f;
    }

    public static string SanitizeId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "blueprint";
        }

        var builder = new StringBuilder(value.Length);
        bool lastDash = false;
        string lower = value.Trim().ToLowerInvariant();
        for (int i = 0; i < lower.Length; i++)
        {
            char c = lower[i];
            bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
            if (ok)
            {
                builder.Append(c);
                lastDash = false;
            }
            else if (!lastDash)
            {
                builder.Append('-');
                lastDash = true;
            }
        }

        string result = builder.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(result) ? "blueprint" : result;
    }

    private static Dictionary<string, PrototypeShipModuleDefinition> BuildDefinitionMap(PrototypeShipBlueprint blueprint)
    {
        var map = new Dictionary<string, PrototypeShipModuleDefinition>(StringComparer.OrdinalIgnoreCase);
        if (blueprint == null)
        {
            return map;
        }

        PrototypeShipModuleDefinition[] source = blueprint.Definitions;
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleDefinition definition = source[i];
            if (definition != null && !string.IsNullOrWhiteSpace(definition.DefinitionId))
            {
                map[definition.DefinitionId] = definition;
            }
        }

        return map;
    }

    private static Vector3 RotateExtents(Vector3 size, Vector3 euler)
    {
        Quaternion rotation = Quaternion.Euler(euler);
        Vector3 right = rotation * Vector3.right;
        Vector3 up = rotation * Vector3.up;
        Vector3 forward = rotation * Vector3.forward;
        return new Vector3(
            Mathf.Abs(right.x) * size.x + Mathf.Abs(up.x) * size.y + Mathf.Abs(forward.x) * size.z,
            Mathf.Abs(right.y) * size.x + Mathf.Abs(up.y) * size.y + Mathf.Abs(forward.y) * size.z,
            Mathf.Abs(right.z) * size.x + Mathf.Abs(up.z) * size.y + Mathf.Abs(forward.z) * size.z);
    }

    private static Vector3 ClampVector(Vector3 value, float minimum)
    {
        return new Vector3(Mathf.Max(minimum, Mathf.Abs(value.x)), Mathf.Max(minimum, Mathf.Abs(value.y)), Mathf.Max(minimum, Mathf.Abs(value.z)));
    }

    public static PrototypeShipModuleDefinition[] CloneDefinitions(PrototypeShipModuleDefinition[] source)
    {
        if (source == null)
        {
            return Array.Empty<PrototypeShipModuleDefinition>();
        }

        var result = new PrototypeShipModuleDefinition[source.Length];
        for (int i = 0; i < source.Length; i++)
        {
            result[i] = CloneDefinition(source[i]);
        }

        return result;
    }

    public static PrototypeShipModuleDefinition CloneDefinition(PrototypeShipModuleDefinition source)
    {
        if (source == null)
        {
            return null;
        }

        return new PrototypeShipModuleDefinition(
            source.DefinitionId,
            source.DisplayName,
            source.Category,
            source.MassRole,
            source.LocalSize,
            source.DryMassKg,
            source.FuelCapacityKg,
            source.MainThrustForce,
            source.RcsBlockThrust,
            source.GunSettings,
            source.NozzleLocalPosition,
            source.BlockedRcsDirection,
            source.MuzzleLocalPosition);
    }

    public static PrototypeShipModuleInstance[] CloneInstances(PrototypeShipModuleInstance[] source)
    {
        if (source == null)
        {
            return Array.Empty<PrototypeShipModuleInstance>();
        }

        var result = new PrototypeShipModuleInstance[source.Length];
        for (int i = 0; i < source.Length; i++)
        {
            PrototypeShipModuleInstance instance = source[i];
            result[i] = instance == null
                ? null
                : new PrototypeShipModuleInstance(instance.InstanceId, instance.DefinitionId, instance.LocalPosition, instance.LocalEulerAngles, instance.LocalScaleOverride);
        }

        return result;
    }

    private readonly struct BuilderBox
    {
        public BuilderBox(string instanceId, PrototypeShipModuleCategory category, Vector3 min, Vector3 max)
        {
            InstanceId = instanceId;
            Category = category;
            Min = min;
            Max = max;
        }

        public string InstanceId { get; }
        public PrototypeShipModuleCategory Category { get; }
        public Vector3 Min { get; }
        public Vector3 Max { get; }
        public Vector3 Center => (Min + Max) * 0.5f;
        public float Volume => Mathf.Max(0f, Max.x - Min.x) * Mathf.Max(0f, Max.y - Min.y) * Mathf.Max(0f, Max.z - Min.z);
    }
}

public sealed class PrototypeShipBlueprintStoreEntry
{
    public PrototypeShipBlueprintStoreEntry(PrototypeShipBlueprint blueprint, bool isBuiltIn, bool isDamaged, string displayName, string path, string error)
    {
        Blueprint = blueprint;
        IsBuiltIn = isBuiltIn;
        IsDamaged = isDamaged;
        DisplayName = displayName ?? string.Empty;
        Path = path ?? string.Empty;
        Error = error ?? string.Empty;
    }

    public PrototypeShipBlueprint Blueprint { get; }
    public bool IsBuiltIn { get; }
    public bool IsDamaged { get; }
    public string DisplayName { get; }
    public string Path { get; }
    public string Error { get; }
}

public sealed class PrototypeShipBlueprintStore
{
    private const int CurrentSchemaVersion = 1;
    private readonly string rootPath;

    [Serializable]
    private sealed class StoreFile
    {
        public int schemaVersion;
        public PrototypeShipBlueprint blueprint;
    }

    public PrototypeShipBlueprintStore(string rootPath = null)
    {
        string basePath = string.IsNullOrWhiteSpace(rootPath)
            ? Path.Combine(Application.persistentDataPath, "blueprints")
            : rootPath;
        this.rootPath = basePath;
    }

    public string RootPath => rootPath;

    public IReadOnlyList<PrototypeShipBlueprintStoreEntry> LoadAll()
    {
        var entries = new List<PrototypeShipBlueprintStoreEntry>();
        PrototypeShipBlueprint[] builtIns = PrototypeShipBlueprintCatalog.BuiltInBlueprints();
        for (int i = 0; i < builtIns.Length; i++)
        {
            entries.Add(new PrototypeShipBlueprintStoreEntry(builtIns[i], true, false, builtIns[i].DisplayName, string.Empty, string.Empty));
        }

        if (!Directory.Exists(rootPath))
        {
            return entries;
        }

        string[] files = Directory.GetFiles(rootPath, "*.json");
        Array.Sort(files, StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < files.Length; i++)
        {
            entries.Add(LoadFile(files[i]));
        }

        return entries;
    }

    public PrototypeShipBlueprintStoreEntry LoadFile(string path)
    {
        try
        {
            string json = File.ReadAllText(path);
            StoreFile storeFile = JsonUtility.FromJson<StoreFile>(json);
            if (storeFile == null || storeFile.schemaVersion != CurrentSchemaVersion || storeFile.blueprint == null)
            {
                return Damaged(path, "missing or unsupported blueprint data");
            }

            PrototypeShipBlueprintValidationReport report = storeFile.blueprint.Validate();
            if (string.IsNullOrWhiteSpace(storeFile.blueprint.BlueprintId))
            {
                return Damaged(path, "missing blueprint id");
            }

            return new PrototypeShipBlueprintStoreEntry(storeFile.blueprint, false, false, storeFile.blueprint.DisplayName, path, report.IsValid ? string.Empty : string.Join("; ", report.Errors));
        }
        catch (Exception ex)
        {
            return Damaged(path, ex.Message);
        }
    }

    public string Save(PrototypeShipBlueprint blueprint)
    {
        if (blueprint == null)
        {
            throw new ArgumentNullException(nameof(blueprint));
        }

        Directory.CreateDirectory(rootPath);
        string id = PrototypeShipBuilderSession.SanitizeId(blueprint.BlueprintId);
        string path = Path.Combine(rootPath, id + ".json");
        var file = new StoreFile
        {
            schemaVersion = CurrentSchemaVersion,
            blueprint = new PrototypeShipBlueprint(id, blueprint.DisplayName, PrototypeShipBuilderSession.CloneDefinitions(blueprint.Definitions), PrototypeShipBuilderSession.CloneInstances(blueprint.Instances))
        };
        File.WriteAllText(path, JsonUtility.ToJson(file, true));
        return path;
    }

    public bool Delete(string blueprintId)
    {
        string id = PrototypeShipBuilderSession.SanitizeId(blueprintId);
        string path = Path.Combine(rootPath, id + ".json");
        if (!File.Exists(path))
        {
            return false;
        }

        File.Delete(path);
        return true;
    }

    public bool Exists(string blueprintId)
    {
        return File.Exists(Path.Combine(rootPath, PrototypeShipBuilderSession.SanitizeId(blueprintId) + ".json"));
    }

    public string AllocateCopyId(string sourceId)
    {
        string baseId = PrototypeShipBuilderSession.SanitizeId(sourceId) + "-copy";
        for (int i = 1; i < 10000; i++)
        {
            string candidate = baseId + "-" + i;
            if (!Exists(candidate))
            {
                return candidate;
            }
        }

        return baseId + "-" + Guid.NewGuid().ToString("N");
    }

    private static PrototypeShipBlueprintStoreEntry Damaged(string path, string error)
    {
        string name = Path.GetFileNameWithoutExtension(path);
        return new PrototypeShipBlueprintStoreEntry(null, false, true, name + " beschaedigt", path, error);
    }
}
