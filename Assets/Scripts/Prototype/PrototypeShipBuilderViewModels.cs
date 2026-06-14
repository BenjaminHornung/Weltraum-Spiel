using System;
using System.Collections.Generic;
using UnityEngine;

public readonly struct PrototypeShipBuilderPaletteItemViewModel
{
    public PrototypeShipBuilderPaletteItemViewModel(string definitionId, string displayName, PrototypeShipModuleCategory category, string metrics)
    {
        DefinitionId = definitionId ?? string.Empty;
        DisplayName = displayName ?? string.Empty;
        Category = category;
        Metrics = metrics ?? string.Empty;
    }

    public string DefinitionId { get; }
    public string DisplayName { get; }
    public PrototypeShipModuleCategory Category { get; }
    public string Metrics { get; }
}

public readonly struct PrototypeShipBuilderValidationRowViewModel
{
    public PrototypeShipBuilderValidationRowViewModel(PrototypeShipBuilderFindingSeverity severity, string text, string instanceId)
    {
        Severity = severity;
        Text = text ?? string.Empty;
        InstanceId = instanceId ?? string.Empty;
    }

    public PrototypeShipBuilderFindingSeverity Severity { get; }
    public string Text { get; }
    public string InstanceId { get; }
    public bool CanSelectInstance => !string.IsNullOrWhiteSpace(InstanceId);
}

public readonly struct PrototypeShipBuilderLoadRowViewModel
{
    public PrototypeShipBuilderLoadRowViewModel(string id, string name, bool isBuiltIn, bool isDamaged)
    {
        Id = id ?? string.Empty;
        Name = name ?? string.Empty;
        IsBuiltIn = isBuiltIn;
        IsDamaged = isDamaged;
    }

    public string Id { get; }
    public string Name { get; }
    public bool IsBuiltIn { get; }
    public bool IsDamaged { get; }
}

public sealed class PrototypeShipBuilderViewModel
{
    public string BlueprintId { get; set; } = string.Empty;
    public string BlueprintName { get; set; } = string.Empty;
    public bool IsDirty { get; set; }
    public bool MirrorX { get; set; }
    public float GridLevel { get; set; }
    public int ModuleCount { get; set; }
    public PrototypeShipModuleCategory ActiveCategory { get; set; } = PrototypeShipModuleCategory.Hull;
    public bool HasGhost { get; set; }
    public bool HasSelection { get; set; }
    public string SelectionTitle { get; set; } = "Kein Modul ausgewaehlt";
    public string SelectionInfo { get; set; } = string.Empty;
    public bool CanSave { get; set; }
    public bool CanTestFly { get; set; }
    public string TestFlyDisabledReason { get; set; } = string.Empty;
    public string HintText { get; set; } = "Modul links waehlen | RMB Kamera | F fokussieren";
    public string[] StatLines { get; set; } = Array.Empty<string>();
    public PrototypeShipBuilderPaletteItemViewModel[] PaletteItems { get; set; } = Array.Empty<PrototypeShipBuilderPaletteItemViewModel>();
    public PrototypeShipBuilderValidationRowViewModel[] ValidationRows { get; set; } = Array.Empty<PrototypeShipBuilderValidationRowViewModel>();
    public PrototypeShipBuilderLoadRowViewModel[] LoadRows { get; set; } = Array.Empty<PrototypeShipBuilderLoadRowViewModel>();
    public string ValidationStatus { get; set; } = "OK";

    public static PrototypeShipBuilderViewModel FromSession(
        PrototypeShipBuilderSession session,
        PrototypeShipModuleCategory activeCategory,
        float gridLevel,
        bool hasGhost,
        IReadOnlyList<PrototypeShipBlueprintStoreEntry> loadEntries = null)
    {
        session = session ?? new PrototypeShipBuilderSession(PrototypeShipBlueprintCatalog.ScoutBlueprint());
        PrototypeShipBlueprint draft = session.DraftBlueprint;
        PrototypeShipBuilderValidationResult validation = session.Validate();
        PrototypeShipBuilderStats stats = session.BuildStats();
        var viewModel = new PrototypeShipBuilderViewModel
        {
            BlueprintId = draft.BlueprintId,
            BlueprintName = draft.DisplayName,
            IsDirty = session.IsDirty,
            MirrorX = session.MirrorX,
            GridLevel = gridLevel,
            ModuleCount = draft.Instances.Length,
            ActiveCategory = activeCategory,
            HasGhost = hasGhost,
            HasSelection = !string.IsNullOrWhiteSpace(session.SelectedInstanceId),
            CanSave = session.IsDirty,
            CanTestFly = validation.IsValid,
            TestFlyDisabledReason = validation.IsValid ? string.Empty : ToGermanValidation(validation.FirstError),
            ValidationStatus = BuildValidationStatus(validation),
            StatLines = BuildStatLines(stats, validation),
            PaletteItems = BuildPaletteItems(activeCategory),
            ValidationRows = BuildValidationRows(validation),
            LoadRows = BuildLoadRows(loadEntries)
        };

        if (viewModel.HasSelection)
        {
            viewModel.SelectionTitle = ResolveSelectionTitle(draft, session.SelectedInstanceId);
            viewModel.SelectionInfo = ResolveSelectionInfo(draft, session.SelectedInstanceId);
        }
        else
        {
            viewModel.SelectionTitle = "Kein Modul ausgewaehlt";
            viewModel.SelectionInfo = string.Empty;
        }

        viewModel.HintText = hasGhost
            ? "Klick platzieren | R drehen | Q/E Ebene | Esc abbrechen"
            : viewModel.HasSelection
                ? "Ziehen verschieben | R drehen | Entf loeschen | Ctrl+Z rueckgaengig"
                : "Modul links waehlen | RMB Kamera | F fokussieren";
        return viewModel;
    }

    public static string ToGermanValidation(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        if (message.Contains("cockpit module")) return "Cockpit fehlt";
        if (message.Contains("fuel capacity")) return "Tank fehlt";
        if (message.Contains("main thruster")) return "Hauptantrieb fehlt";
        if (message.Contains("RCS block")) return "RCS fehlt";
        if (message.Contains("gun module")) return "Waffe fehlt";
        return message;
    }

    private static string BuildValidationStatus(PrototypeShipBuilderValidationResult validation)
    {
        if (validation.ErrorCount > 0)
        {
            return validation.ErrorCount + " Fehler";
        }

        if (validation.WarningCount > 0)
        {
            return validation.WarningCount + " Warnungen";
        }

        return "OK";
    }

    private static string[] BuildStatLines(PrototypeShipBuilderStats stats, PrototypeShipBuilderValidationResult validation)
    {
        if (!stats.IsAvailable || !validation.BlueprintReport.IsValid)
        {
            return new[]
            {
                "Trockenmasse      --",
                "Treibstoff        --",
                "Startmasse        --",
                "Schub             --",
                "Beschl. voll/leer --",
                "Delta-v           --",
                "RCS               --",
                "Schwerpunkt       --"
            };
        }

        return new[]
        {
            "Trockenmasse      " + PrototypeShipBuilderSession.FormatStatValue(stats.DryMassKg, "kg"),
            "Treibstoff        " + PrototypeShipBuilderSession.FormatStatValue(stats.FuelCapacityKg, "kg"),
            "Startmasse        " + PrototypeShipBuilderSession.FormatStatValue(stats.TotalMassKg, "kg"),
            "Schub             " + PrototypeShipBuilderSession.FormatStatValue(stats.MainThrustN / 1000f, "kN", 1),
            "Beschl. voll/leer " + stats.FullAcceleration.ToString("0.0") + " / " + stats.EmptyAcceleration.ToString("0.0") + " m/s2",
            "Delta-v           " + PrototypeShipBuilderSession.FormatStatValue(stats.DeltaV, "m/s"),
            "RCS               " + stats.RcsPodCount + " Pods | " + PrototypeShipBuilderSession.FormatStatValue(stats.RcsTranslationForce / 1000f, "kN", 1),
            "Schwerpunkt       z " + stats.CenterOfMass.z.ToString("+0.00;-0.00") + " m | Versatz " + stats.ThrustOffset.ToString("0.00") + " m"
        };
    }

    private static PrototypeShipBuilderPaletteItemViewModel[] BuildPaletteItems(PrototypeShipModuleCategory activeCategory)
    {
        PrototypeShipModuleDefinition[] definitions = PrototypeShipBuilderSession.BuildPaletteDefinitions();
        var items = new List<PrototypeShipBuilderPaletteItemViewModel>();
        for (int i = 0; i < definitions.Length; i++)
        {
            PrototypeShipModuleDefinition definition = definitions[i];
            if (definition == null || definition.Category != activeCategory)
            {
                continue;
            }

            items.Add(new PrototypeShipBuilderPaletteItemViewModel(
                definition.DefinitionId,
                definition.DisplayName,
                definition.Category,
                BuildMetrics(definition)));
        }

        return items.ToArray();
    }

    private static string BuildMetrics(PrototypeShipModuleDefinition definition)
    {
        switch (definition.Category)
        {
            case PrototypeShipModuleCategory.FuelTank:
                return Mathf.RoundToInt(definition.DryMassKg) + " kg | " + Mathf.RoundToInt(definition.FuelCapacityKg) + " kg Fuel";
            case PrototypeShipModuleCategory.MainThruster:
                return Mathf.RoundToInt(definition.DryMassKg) + " kg | " + (definition.MainThrustForce / 1000f).ToString("0.#") + " kN";
            case PrototypeShipModuleCategory.RcsBlock:
                return Mathf.RoundToInt(definition.DryMassKg) + " kg | " + (definition.RcsBlockThrust / 1000f).ToString("0.#") + " kN";
            case PrototypeShipModuleCategory.Gun:
                return Mathf.RoundToInt(definition.DryMassKg) + " kg | " + Mathf.RoundToInt(definition.GunSettings.projectileSpeed) + " m/s";
            default:
                return Mathf.RoundToInt(definition.DryMassKg) + " kg";
        }
    }

    private static PrototypeShipBuilderValidationRowViewModel[] BuildValidationRows(PrototypeShipBuilderValidationResult validation)
    {
        var rows = new List<PrototypeShipBuilderValidationRowViewModel>();
        for (int i = 0; i < validation.BlueprintReport.Errors.Count; i++)
        {
            rows.Add(new PrototypeShipBuilderValidationRowViewModel(PrototypeShipBuilderFindingSeverity.Error, ToGermanValidation(validation.BlueprintReport.Errors[i]), string.Empty));
        }

        for (int i = 0; i < validation.BlueprintReport.Warnings.Count; i++)
        {
            rows.Add(new PrototypeShipBuilderValidationRowViewModel(PrototypeShipBuilderFindingSeverity.Warning, ToGermanValidation(validation.BlueprintReport.Warnings[i]), string.Empty));
        }

        for (int i = 0; i < validation.SpatialReport.Findings.Count; i++)
        {
            PrototypeShipBuilderFinding finding = validation.SpatialReport.Findings[i];
            rows.Add(new PrototypeShipBuilderValidationRowViewModel(finding.Severity, finding.Message, finding.PrimaryInstanceId));
        }

        return rows.ToArray();
    }

    private static PrototypeShipBuilderLoadRowViewModel[] BuildLoadRows(IReadOnlyList<PrototypeShipBlueprintStoreEntry> entries)
    {
        if (entries == null)
        {
            return Array.Empty<PrototypeShipBuilderLoadRowViewModel>();
        }

        var rows = new PrototypeShipBuilderLoadRowViewModel[entries.Count];
        for (int i = 0; i < entries.Count; i++)
        {
            PrototypeShipBlueprintStoreEntry entry = entries[i];
            rows[i] = new PrototypeShipBuilderLoadRowViewModel(
                entry.Blueprint != null ? entry.Blueprint.BlueprintId : entry.DisplayName,
                entry.DisplayName,
                entry.IsBuiltIn,
                entry.IsDamaged);
        }

        return rows;
    }

    private static string ResolveSelectionTitle(PrototypeShipBlueprint draft, string selectedInstanceId)
    {
        PrototypeShipModuleInstance instance = FindInstance(draft, selectedInstanceId);
        PrototypeShipModuleDefinition definition = FindDefinition(draft, instance != null ? instance.DefinitionId : string.Empty);
        return definition != null && instance != null ? definition.DisplayName + "\n" + instance.InstanceId : "Kein Modul ausgewaehlt";
    }

    private static string ResolveSelectionInfo(PrototypeShipBlueprint draft, string selectedInstanceId)
    {
        PrototypeShipModuleInstance instance = FindInstance(draft, selectedInstanceId);
        if (instance == null)
        {
            return string.Empty;
        }

        PrototypeShipModuleDefinition definition = FindDefinition(draft, instance.DefinitionId);
        string metrics = definition != null ? BuildMetrics(definition) : string.Empty;
        return "Position " + instance.LocalPosition.x.ToString("0.00") + " / " + instance.LocalPosition.y.ToString("0.00") + " / " + instance.LocalPosition.z.ToString("0.00")
            + "\nRotation " + Mathf.RoundToInt(instance.LocalEulerAngles.x) + "/" + Mathf.RoundToInt(instance.LocalEulerAngles.y) + "/" + Mathf.RoundToInt(instance.LocalEulerAngles.z)
            + "\n" + metrics;
    }

    private static PrototypeShipModuleInstance FindInstance(PrototypeShipBlueprint draft, string instanceId)
    {
        PrototypeShipModuleInstance[] instances = draft.Instances;
        for (int i = 0; i < instances.Length; i++)
        {
            if (instances[i] != null && string.Equals(instances[i].InstanceId, instanceId, StringComparison.OrdinalIgnoreCase))
            {
                return instances[i];
            }
        }

        return null;
    }

    private static PrototypeShipModuleDefinition FindDefinition(PrototypeShipBlueprint draft, string definitionId)
    {
        PrototypeShipModuleDefinition[] definitions = draft.Definitions;
        for (int i = 0; i < definitions.Length; i++)
        {
            if (definitions[i] != null && string.Equals(definitions[i].DefinitionId, definitionId, StringComparison.OrdinalIgnoreCase))
            {
                return definitions[i];
            }
        }

        return null;
    }
}
