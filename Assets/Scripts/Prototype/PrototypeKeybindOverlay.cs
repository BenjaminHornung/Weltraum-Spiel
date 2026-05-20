using UnityEngine;

public class PrototypeKeybindOverlay : MonoBehaviour
{
    private GUIStyle labelStyle;
    private GUIStyle headingStyle;
    private GUIStyle activeHeadingStyle;
    private GUIStyle mutedLabelStyle;
    private Vector2 scrollPosition;
    private PrototypeUiWindowState windowState;
    private PlayerShipController shipController;

    public bool IsWindowVisible => ResolveWindowState().Visible;

    public void Bind(Transform trackTarget)
    {
        shipController = trackTarget != null ? trackTarget.GetComponent<PlayerShipController>() : null;
    }

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

        headingStyle = PrototypeUiStyle.CreateSectionHeadingStyle();
        activeHeadingStyle = PrototypeUiStyle.CreateSectionHeadingStyle();
        activeHeadingStyle.normal.textColor = PrototypeUiStyle.ActiveColor;
        mutedLabelStyle = new GUIStyle(labelStyle)
        {
            fontSize = 12
        };
        mutedLabelStyle.normal.textColor = PrototypeUiStyle.MutedColor;
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
            PrototypeKeybindViewModel viewModel = PrototypeKeybindViewModelBuilder.Build(ResolveActiveControlMode());
            scrollPosition = GUILayout.BeginScrollView(scrollPosition);
            GUILayout.Label("Active Mode: " + viewModel.ActiveFlightControlModeLabel, activeHeadingStyle);
            DrawModeBindings(viewModel);

            for (int i = 0; i < viewModel.CommonSections.Count; i++)
            {
                DrawCategory(viewModel.CommonSections[i]);
            }

            GUILayout.EndScrollView();
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawModeBindings(PrototypeKeybindViewModel viewModel)
    {
        DrawCategory("Control Mode", "Caps Lock cycles Cruise / Precision / Translation\nHUD Mode button cycles the same\nDebug Console has explicit Cruise, Precision, Translation buttons.", false);
        for (int i = 0; i < viewModel.ModeBindings.Count; i++)
        {
            PrototypeKeybindModeBindingViewModel binding = viewModel.ModeBindings[i];
            GUILayout.Space(3f);
            GUILayout.Label((binding.IsActive ? "> " : string.Empty) + binding.Label, binding.IsActive ? activeHeadingStyle : headingStyle);
            GUILayout.Label(binding.Summary, binding.IsActive ? labelStyle : mutedLabelStyle);
            GUILayout.Label(string.Join("\n", binding.Differences), binding.IsActive ? labelStyle : mutedLabelStyle);
        }
    }

    private void DrawCategory(PrototypeKeybindSectionViewModel section)
    {
        DrawCategory(section.Title, string.Join("\n", section.Lines), section.DebugOnly);
    }

    private void DrawCategory(string title, string lines, bool debugOnly)
    {
        GUILayout.Space(3f);
        GUILayout.Label(debugOnly ? title + " (Debug)" : title, debugOnly ? activeHeadingStyle : headingStyle);
        GUILayout.Label(lines, debugOnly ? mutedLabelStyle : labelStyle);
    }

    private float CalculateExpandedHeight()
    {
        float maxHeight = Mathf.Max(140f, Screen.height - 92f);
        return Mathf.Clamp(520f, 140f, maxHeight);
    }

    private FlightControlMode ResolveActiveControlMode()
    {
        if (shipController == null)
        {
            shipController = FindAnyObjectByType<PlayerShipController>();
        }

        return shipController != null ? shipController.ControlMode : FlightControlMode.Normal;
    }
}
