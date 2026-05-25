public readonly struct PrototypeInputBindingSection
{
    public PrototypeInputBindingSection(string title, string[] lines, bool debugOnly = false)
    {
        Title = title;
        Lines = lines;
        DebugOnly = debugOnly;
    }

    public string Title { get; }
    public string[] Lines { get; }
    public bool DebugOnly { get; }
}

public static class PrototypeInputBindingCatalog
{
    public static readonly PrototypeInputBindingSection[] GlobalSections =
    {
        new PrototypeInputBindingSection("UI", new[]
        {
            "F1 Keybinds",
            "F2 Flight Diagnostics",
            "F3 Debug Console",
            "F4 HUD/Navball",
            "F5 Minimap/Radar",
            "F6 Cycle generated/imported ship visuals",
            "F7 Weapon Computer"
        }),
        new PrototypeInputBindingSection("Navigation / Autopilot", new[]
        {
            "Tab next target",
            "B previous target",
            "G toggle Autopilot",
            "P navigation planner",
            "Debug Console also has Explicit Autopilot controls"
        }),
        new PrototypeInputBindingSection("Momentum Assist", new[]
        {
            "M Kill Momentum",
            "HUD button Kill Momentum",
            "Debug Console Engage/Abort Momentum Assist"
        }),
        new PrototypeInputBindingSection("SAS / Assist", new[]
        {
            "T toggle SAS",
            "Hold F temporarily inverts effective SAS"
        }),
        new PrototypeInputBindingSection("Camera", new[]
        {
            "Right mouse: orbit camera",
            "V cycles camera mode",
            "Mouse wheel: zoom",
            "FreeInspect: RMB + WASD + Q/E moves inspect target",
            "Backquote / Backslash / Quote / 3 reset framing"
        }),
        new PrototypeInputBindingSection("Weapons", new[]
        {
            "Space: fire",
            "Weapon Computer: multi-select targets, choose priority, toggle Auto Fire"
        }),
        new PrototypeInputBindingSection("Debug", new[]
        {
            "Backspace: refill fuel",
            "HUD markers: FWD/PRO/RET/TGT",
            "Debug vectors: DES/ACT/RES"
        }, true)
    };

    private static readonly PrototypeInputBindingSection[] CruiseModeSections =
    {
        new PrototypeInputBindingSection("Normal / Cruise", new[]
        {
            "W/S: pitch",
            "A/D: yaw",
            "Q/E: roll",
            "Shift/Ctrl: throttle up/down",
            "X: cut throttle",
            "Y/Z: full throttle",
            "R: toggle RCS",
            "H/N: legacy RCS forward/back (RCS enabled only)",
            "I/K: RCS translate down/up",
            "J/L: RCS translate left/right"
        })
    };

    private static readonly PrototypeInputBindingSection[] PrecisionModeSections =
    {
        new PrototypeInputBindingSection("Precision", new[]
        {
            "W/S: pitch via RCS",
            "A/D: yaw via RCS",
            "Q/E: roll via RCS",
            "Main thruster disabled",
            "Shift/Ctrl do not change throttle",
            "X: cut throttle",
            "Y/Z: full throttle accepted, but main thrust remains disabled while Precision is active",
            "R: toggle RCS",
            "H/N: optional RCS up/down",
            "I/K/J/L: RCS translation"
        })
    };

    private static readonly PrototypeInputBindingSection[] TranslationModeSections =
    {
        new PrototypeInputBindingSection("Translation", new[]
        {
            "W/S: translate forward/back",
            "A/D: translate left/right",
            "H/N: translate up/down",
            "Q/E: roll remains available",
            "Main thruster disabled",
            "Shift/Ctrl do not change throttle",
            "Y/Z: full throttle accepted, but main thrust remains disabled while Translation is active",
            "R: toggle RCS",
            "I/K/J/L: direct RCS translation remains available"
        })
    };

    public static string[] BuildDifference(FlightControlMode mode)
    {
        switch (mode)
        {
            case FlightControlMode.Precision:
                return PrecisionModeSections[0].Lines;
            case FlightControlMode.Translation:
                return TranslationModeSections[0].Lines;
            default:
                return CruiseModeSections[0].Lines;
        }
    }

    public static string GetModeLabel(FlightControlMode mode)
    {
        switch (mode)
        {
            case FlightControlMode.Precision:
                return "Precision";
            case FlightControlMode.Translation:
                return "Translation";
            default:
                return "Cruise";
        }
    }

    public static string GetModeSummary(FlightControlMode mode)
    {
        switch (mode)
        {
            case FlightControlMode.Precision:
                return "Precision: main thrust off; RCS attitude.";
            case FlightControlMode.Translation:
                return "Translation: main off; W/S + A/D translate.";
            default:
                return "Cruise: main thrust and full attitude.";
        }
    }

    public static PrototypeInputBindingSection[] GetModeSections(FlightControlMode mode)
    {
        switch (mode)
        {
            case FlightControlMode.Precision:
                return PrecisionModeSections;
            case FlightControlMode.Translation:
                return TranslationModeSections;
            default:
                return CruiseModeSections;
        }
    }

    public static PrototypeInputBindingSection[] GetAllModeSections()
    {
        return new[]
        {
            CruiseModeSections[0],
            PrecisionModeSections[0],
            TranslationModeSections[0]
        };
    }
}
