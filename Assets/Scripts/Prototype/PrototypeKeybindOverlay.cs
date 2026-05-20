using UnityEngine;

public class PrototypeKeybindOverlay : MonoBehaviour
{
    private GUIStyle labelStyle;
    private GUIStyle headingStyle;
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
        windowState.SetSize(430f, windowState.Collapsed ? 58f : 520f);
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
            DrawCategory("UI", "F1 Keybinds\nF2 Flight Diagnostics\nF3 Debug Console\nF4 HUD/Navball\nF5 Minimap/Radar");
            DrawCategory("Flight", "W/S Pitch\nA/D Yaw\nQ/E Roll");
            DrawCategory("Main Throttle", "Left Shift / Left Ctrl throttle up/down\nX cut throttle\nY/Z full throttle");
            DrawCategory("RCS", "R toggle RCS\nH/N translate forward/back\nI/K translate down/up\nJ/L translate left/right");
            DrawCategory("SAS/Precision", "T toggle SAS\nHold F invert SAS\nCaps Lock precision mode");
            DrawCategory("Camera", "Right mouse orbit\nV camera mode\nBackquote reset camera");
            DrawCategory("Weapons", "Space fire");
            DrawCategory("Debug", "Backspace refill fuel\nHUD markers: FWD, PRO, RET, TGT\nDebug vectors add DES, ACT, RES");
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
}
