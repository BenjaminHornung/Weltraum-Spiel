using UnityEngine;

public class PrototypeKeybindOverlay : MonoBehaviour
{
    private GUIStyle labelStyle;
    private GUIStyle headingStyle;
    private Vector2 scrollPosition;
    private PrototypeUiWindowState windowState;

    public bool IsWindowVisible => ResolveWindowState().Visible;

    private void OnGUI()
    {
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        EnsureStyles();
        windowState.SetSize(430f, windowState.Collapsed ? 58f : CalculateExpandedHeight());
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, "Keybinds");
        windowState.ClampToScreen();
        windowState.SaveToPrefs();
    }

    public void SetWindowVisible(bool visible)
    {
        ResolveWindowState().Visible = visible;
    }

    public void SetWindowCollapsed(bool collapsed)
    {
        ResolveWindowState().Collapsed = collapsed;
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.KeybindWindowId,
                new Rect(16f, 226f, 430f, 520f),
                false,
                false);
        }

        return windowState;
    }

    private void EnsureStyles()
    {
        if (labelStyle != null)
        {
            return;
        }

        labelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 13,
            wordWrap = true
        };
        labelStyle.normal.textColor = Color.white;

        headingStyle = new GUIStyle(labelStyle)
        {
            fontStyle = FontStyle.Bold
        };
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Expand" : "Collapse", GUILayout.Width(82f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        GUILayout.Label("F1 hides this help", labelStyle);
        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            scrollPosition = GUILayout.BeginScrollView(scrollPosition);
            DrawCategory("UI", "F1 Keybinds\nF2 Flight Diagnostics\nF3 Debug Console\nF4 HUD/Navball\nF5 Minimap/Radar");
            DrawCategory("Control Mode", "Caps Lock cycles Cruise / Precision / Translation\nHUD Mode button cycles the same\nDebug Console has explicit Normal, Precision, Translation buttons.");
            DrawCategory("Normal Mode", "W/S pitch\nA/D yaw\nQ/E roll\nLeft Shift / Left Ctrl throttle up/down\nX cut throttle\nY/Z full throttle\nH/N legacy RCS forward/back if RCS is enabled.");
            DrawCategory("Precision Mode", "W/S pitch via RCS\nA/D yaw via RCS\nQ/E roll via RCS\nMain thruster and gimbal disabled\nShift/Ctrl do not change throttle\nH/N optional RCS up/down.");
            DrawCategory("Translation Mode", "W/S translate forward/back\nA/D translate left/right\nH/N translate up/down\nQ/E roll remains available\nMain thruster and gimbal disabled\nShift/Ctrl do not change throttle.");
            DrawCategory("Navigation / Autopilot", "Tab next\nB previous\nG toggle Autopilot\nAutopilot uses Cruise/Main Thrust.");
            DrawCategory("Momentum Assist", "HUD button Kill Momentum\nDebug Console Engage/Abort Momentum Assist\nUses physical main/RCS/SAS assist requests, not velocity reset.");
            DrawCategory("SAS / Assist", "T toggle SAS\nHold F invert SAS");
            DrawCategory("Camera", "Right mouse orbit camera\nCamera modes: ChaseLocked -> OrbitInspect -> Side -> FreeInspect (V)\nMouse wheel zoom in all modes\nFreeInspect: hold RMB + WASD + Q/E to move inspect framing target\nBackquote/backslash/quote/3 reset framing");
            DrawCategory("Weapons", "Space fire");
            DrawCategory("Debug", "Backspace refill fuel\nHUD markers: FWD, PRO, RET, TGT\nDebug vectors add DES, ACT, RES");
            GUILayout.EndScrollView();
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawCategory(string title, string lines)
    {
        GUILayout.Space(3f);
        GUILayout.Label(title, headingStyle);
        GUILayout.Label(lines, labelStyle);
    }

    private float CalculateExpandedHeight()
    {
        float maxHeight = Mathf.Max(140f, Screen.height - 92f);
        return Mathf.Clamp(520f, 140f, maxHeight);
    }
}
