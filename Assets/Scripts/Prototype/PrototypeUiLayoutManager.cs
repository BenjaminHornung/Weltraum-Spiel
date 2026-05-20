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

    private static readonly Dictionary<string, PrototypeUiWindowState> Windows = new Dictionary<string, PrototypeUiWindowState>();
    private static int hotkeyFrame = -1;

    public static PrototypeUiPreset CurrentPreset { get; private set; } = PrototypeUiPreset.FlightTest;

    public static PrototypeUiWindowState GetWindow(string id, Rect defaultRect, bool defaultVisible, bool defaultCollapsed, bool rememberPosition = true)
    {
        if (!Windows.TryGetValue(id, out PrototypeUiWindowState state))
        {
            state = new PrototypeUiWindowState(id, defaultRect, defaultVisible, defaultCollapsed, rememberPosition);
            Windows.Add(id, state);
            state.LoadFromPrefs();
        }
        else
        {
            state.SetDefaultRect(defaultRect);
        }

        state.ClampToScreen();
        return state;
    }

    public static void ResetLayout()
    {
        foreach (PrototypeUiWindowState state in Windows.Values)
        {
            state.Reset();
            state.ClampToScreen();
        }
    }

    public static void HandleFunctionKeys(
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap)
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
    }

    public static void ApplyPreset(
        PrototypeUiPreset preset,
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap)
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
    }

    public static void HideAll(
        PrototypeDebugOverlay diagnostics,
        PrototypeFlightDebugConsole console,
        PrototypeFlightHud hud,
        PrototypeKeybindOverlay keybinds,
        PrototypeMinimapOverlay minimap)
    {
        diagnostics?.SetWindowVisible(false);
        console?.SetConsoleVisible(false);
        hud?.SetHudVisible(false);
        keybinds?.SetWindowVisible(false);
        minimap?.SetWindowVisible(false);
    }
}
