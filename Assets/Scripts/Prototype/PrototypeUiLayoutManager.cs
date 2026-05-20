using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

public enum PrototypeUiPreset
{
    Basic,
    FlightTest,
    RcsTest,
    FullDiagnostics
}

public static class PrototypeUiLayoutManager
{
    public const string DiagnosticsWindowId = "flight-diagnostics";
    public const string DebugConsoleWindowId = "debug-console";
    public const string HudWindowId = "hud-navball";
    public const string KeybindWindowId = "keybinds";
    public const string MinimapWindowId = "minimap";
    public const string WeaponComputerWindowId = "weapon-computer";

    private static readonly Dictionary<string, PrototypeUiWindowState> Windows = new Dictionary<string, PrototypeUiWindowState>();
    private static int hotkeyFrame = -1;
    private const float ScreenPadding = 12f;
    private const float WindowSpacing = 12f;

    public static PrototypeUiPreset CurrentPreset { get; private set; } = PrototypeUiPreset.FlightTest;

    public static PrototypeUiWindowState GetWindow(string id, Rect defaultRect, bool defaultVisible, bool defaultCollapsed, bool rememberPosition = true)
    {
        Rect resolvedDefault = ResolveDefaultRect(id, defaultRect, GetGuiSafeArea());
        if (!Windows.TryGetValue(id, out PrototypeUiWindowState state))
        {
            state = new PrototypeUiWindowState(id, resolvedDefault, defaultVisible, defaultCollapsed, rememberPosition);
            Windows.Add(id, state);
            state.LoadFromPrefs();
        }
        else
        {
            state.SetDefaultRect(resolvedDefault);
        }

        state.ClampToScreen();
        return state;
    }

    public static void ResetLayout()
    {
        ResetLayout(GetGuiSafeArea());
    }

    public static void ResetLayout(Rect screenBounds)
    {
        foreach (PrototypeUiWindowState state in Windows.Values)
        {
            state.Reset();
            state.ClampToBounds(screenBounds);
        }

        ResolveOverlaps(screenBounds);
    }

    public static void ResolveOverlaps()
    {
        ResolveOverlaps(GetGuiSafeArea());
    }

    public static void ResolveOverlaps(Rect screenBounds)
    {
        PrototypeUiWindowState[] states = GetPriorityOrderedWindows();
        for (int i = 0; i < states.Length; i++)
        {
            PrototypeUiWindowState current = states[i];
            if (current == null || !current.Visible)
            {
                continue;
            }

            current.ClampToBounds(screenBounds);
            for (int guard = 0; guard < 24 && OverlapsAnyPreviousVisible(states, i, current.Rect); guard++)
            {
                Rect rect = current.Rect;
                rect.x += WindowSpacing;
                rect.y += WindowSpacing;
                current.Rect = rect;
                current.ClampToBounds(screenBounds);

                Rect clamped = current.Rect;
                if (Mathf.Approximately(clamped.xMax, screenBounds.xMax - ScreenPadding)
                    || Mathf.Approximately(clamped.yMax, screenBounds.yMax - ScreenPadding))
                {
                    clamped.x = screenBounds.x + ScreenPadding;
                    clamped.y = Mathf.Min(
                        screenBounds.yMax - clamped.height - ScreenPadding,
                        screenBounds.y + ScreenPadding + ((guard + 1) * WindowSpacing * 2f));
                    current.Rect = clamped;
                    current.ClampToBounds(screenBounds);
                }
            }
        }
    }

    public static void HandleFunctionKeys(
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap,
        PrototypeWeaponComputerPanel weaponComputer)
    {
        if (Time.frameCount == hotkeyFrame)
        {
            return;
        }

        Keyboard keyboard = Keyboard.current;
        if (keyboard == null)
        {
            return;
        }

        hotkeyFrame = Time.frameCount;

        if (keyboard.f1Key.wasPressedThisFrame && keybinds != null)
        {
            keybinds.SetWindowVisible(!keybinds.IsWindowVisible);
        }

        if (keyboard.f2Key.wasPressedThisFrame && diagnostics != null)
        {
            diagnostics.SetWindowVisible(!diagnostics.IsWindowVisible);
        }

        if (keyboard.f3Key.wasPressedThisFrame && console != null)
        {
            console.SetConsoleVisible(!console.IsConsoleVisible);
        }

        if (keyboard.f4Key.wasPressedThisFrame && hud != null)
        {
            hud.SetHudVisible(!hud.ShowHud);
        }

        if (keyboard.f5Key.wasPressedThisFrame && minimap != null)
        {
            minimap.SetWindowVisible(!minimap.IsWindowVisible);
        }

        if (keyboard.f7Key.wasPressedThisFrame && weaponComputer != null)
        {
            weaponComputer.SetWindowVisible(!weaponComputer.IsWindowVisible);
        }
    }

    public static void ApplyPreset(
        PrototypeUiPreset preset,
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap,
        PrototypeWeaponComputerPanel weaponComputer = null)
    {
        CurrentPreset = preset;

        bool diagnosticsVisible = preset != PrototypeUiPreset.Basic;
        bool fullDiagnostics = preset == PrototypeUiPreset.FullDiagnostics;
        bool rcsDiagnostics = preset == PrototypeUiPreset.RcsTest || preset == PrototypeUiPreset.FullDiagnostics;
        bool consoleVisible = preset == PrototypeUiPreset.RcsTest || preset == PrototypeUiPreset.FullDiagnostics;

        if (diagnostics != null)
        {
            diagnostics.SetWindowVisible(diagnosticsVisible);
            diagnostics.SetWindowCollapsed(false);
            diagnostics.SetAdvancedDiagnostics(fullDiagnostics || rcsDiagnostics);
            diagnostics.SetRcsDiagnosticsExpanded(rcsDiagnostics);
        }

        if (console != null)
        {
            console.SetConsoleVisible(consoleVisible);
            console.SetConsoleCollapsed(preset != PrototypeUiPreset.FullDiagnostics);
            console.SetRcsDiagnosticsExpanded(rcsDiagnostics);
        }

        if (hud != null)
        {
            hud.SetHudVisible(preset != PrototypeUiPreset.Basic);
            hud.SetHudCollapsed(false);
            hud.SetShowDebugForceMarkers(rcsDiagnostics);
        }

        if (keybinds != null)
        {
            keybinds.SetWindowVisible(false);
            keybinds.SetWindowCollapsed(false);
        }

        if (minimap != null)
        {
            minimap.SetWindowVisible(preset != PrototypeUiPreset.Basic);
            minimap.SetWindowCollapsed(false);
            minimap.SetLabelsVisible(preset != PrototypeUiPreset.RcsTest);
        }

        if (weaponComputer != null)
        {
            weaponComputer.SetWindowVisible(preset != PrototypeUiPreset.Basic);
            weaponComputer.SetWindowCollapsed(false);
        }

        ResolveOverlaps();
    }

    public static void HideAll(
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap,
        PrototypeWeaponComputerPanel weaponComputer = null)
    {
        diagnostics?.SetWindowVisible(false);
        console?.SetConsoleVisible(false);
        hud?.SetHudVisible(false);
        keybinds?.SetWindowVisible(false);
        minimap?.SetWindowVisible(false);
        weaponComputer?.SetWindowVisible(false);
    }

    public static void ClearWindowsForTests()
    {
        Windows.Clear();
        hotkeyFrame = -1;
        CurrentPreset = PrototypeUiPreset.FlightTest;
    }

    public static IReadOnlyCollection<PrototypeUiWindowState> WindowsForTests => Windows.Values;

    public static Rect ResolveDefaultRectForTests(string id, Rect fallback, Rect screenBounds)
    {
        return ResolveDefaultRect(id, fallback, screenBounds);
    }

    public static PrototypeUiWindowState GetWindowForTests(string id, Rect defaultRect, bool defaultVisible, bool defaultCollapsed, Rect screenBounds)
    {
        Rect resolvedDefault = ResolveDefaultRect(id, defaultRect, screenBounds);
        var state = new PrototypeUiWindowState(id, resolvedDefault, defaultVisible, defaultCollapsed, false);
        Windows[id] = state;
        return state;
    }

    private static Rect ResolveDefaultRect(string id, Rect fallback, Rect screenBounds)
    {
        if (screenBounds.width <= 0f || screenBounds.height <= 0f)
        {
            return fallback;
        }

        Rect rect = fallback;
        switch (id)
        {
            case DiagnosticsWindowId:
                rect.x = screenBounds.xMax - rect.width - ScreenPadding;
                rect.y = screenBounds.y + ScreenPadding;
                break;
            case DebugConsoleWindowId:
                rect.x = screenBounds.x + ScreenPadding;
                rect.y = screenBounds.y + ScreenPadding;
                break;
            case HudWindowId:
                rect.x = screenBounds.center.x - (rect.width * 0.5f);
                rect.y = screenBounds.yMax - rect.height - ScreenPadding;
                break;
            case KeybindWindowId:
                rect.x = screenBounds.x + ScreenPadding;
                rect.y = screenBounds.yMax - rect.height - ScreenPadding;
                break;
            case MinimapWindowId:
                rect.x = screenBounds.xMax - rect.width - ScreenPadding;
                rect.y = screenBounds.yMax - rect.height - ScreenPadding;
                break;
            case WeaponComputerWindowId:
                rect.x = screenBounds.x + ScreenPadding;
                rect.y = screenBounds.y + 96f;
                break;
        }

        return ClampRect(rect, screenBounds);
    }

    private static Rect GetGuiSafeArea()
    {
        Rect safeArea = Screen.safeArea;
        if (Screen.width <= 0 || Screen.height <= 0 || safeArea.width <= 0f || safeArea.height <= 0f)
        {
            return new Rect(0f, 0f, Mathf.Max(1f, Screen.width), Mathf.Max(1f, Screen.height));
        }

        return new Rect(safeArea.x, Screen.height - safeArea.yMax, safeArea.width, safeArea.height);
    }

    private static Rect ClampRect(Rect rect, Rect bounds)
    {
        float maxWidth = Mathf.Max(180f, bounds.width - (ScreenPadding * 2f));
        float maxHeight = Mathf.Max(42f, bounds.height - (ScreenPadding * 2f));
        rect.width = Mathf.Clamp(rect.width, 180f, maxWidth);
        rect.height = Mathf.Clamp(rect.height, 42f, maxHeight);
        rect.x = Mathf.Clamp(rect.x, bounds.x + ScreenPadding, Mathf.Max(bounds.x + ScreenPadding, bounds.xMax - rect.width - ScreenPadding));
        rect.y = Mathf.Clamp(rect.y, bounds.y + ScreenPadding, Mathf.Max(bounds.y + ScreenPadding, bounds.yMax - rect.height - ScreenPadding));
        return rect;
    }

    private static PrototypeUiWindowState[] GetPriorityOrderedWindows()
    {
        string[] priority =
        {
            HudWindowId,
            MinimapWindowId,
            DiagnosticsWindowId,
            WeaponComputerWindowId,
            KeybindWindowId,
            DebugConsoleWindowId
        };

        var ordered = new List<PrototypeUiWindowState>(Windows.Count);
        for (int i = 0; i < priority.Length; i++)
        {
            if (Windows.TryGetValue(priority[i], out PrototypeUiWindowState state))
            {
                ordered.Add(state);
            }
        }

        foreach (PrototypeUiWindowState state in Windows.Values)
        {
            if (!ordered.Contains(state))
            {
                ordered.Add(state);
            }
        }

        return ordered.ToArray();
    }

    private static bool OverlapsAnyPreviousVisible(PrototypeUiWindowState[] states, int currentIndex, Rect currentRect)
    {
        for (int i = 0; i < currentIndex; i++)
        {
            PrototypeUiWindowState previous = states[i];
            if (previous != null && previous.Visible && currentRect.Overlaps(previous.Rect))
            {
                return true;
            }
        }

        return false;
    }
}
