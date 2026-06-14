using UnityEngine;

public static class PrototypeUiStyle
{
    public const float CompactPadding = 6f;
    public const float StandardPadding = 10f;
    public const float WindowSpacing = 12f;

    public static readonly Color OkColor = new Color(0.52f, 1f, 0.6f, 1f);
    public static readonly Color WarningColor = new Color(1f, 0.82f, 0.32f, 1f);
    public static readonly Color DangerColor = new Color(1f, 0.35f, 0.35f, 1f);
    public static readonly Color DisabledColor = new Color(0.55f, 0.58f, 0.64f, 1f);
    public static readonly Color ActiveColor = new Color(0.45f, 0.78f, 1f, 1f);
    public static readonly Color MutedColor = new Color(0.7f, 0.74f, 0.8f, 1f);
    public static readonly Color PanelBackground = new Color(0.022f, 0.027f, 0.039f, 0.92f);
    public static readonly Color PanelBorder = new Color(0.25f, 0.62f, 0.72f, 0.82f);
    public static readonly Color TextPrimary = new Color(0.92f, 0.96f, 1f, 1f);
    public static readonly Color TextSecondary = new Color(0.65f, 0.72f, 0.78f, 1f);
    public static readonly Color Accent = ActiveColor;
    public static readonly Color GhostValid = new Color(0.52f, 1f, 0.6f, 0.35f);
    public static readonly Color GhostInvalid = new Color(1f, 0.35f, 0.35f, 0.35f);

    public const int DisplayFontSize = 28;
    public const int HeadlineFontSize = 20;
    public const int BodyFontSize = 16;
    public const int CaptionFontSize = 13;
    public const int MicroFontSize = 11;
    public const int MinimumReadableFontSize = 10;

    public static GUIStyle CreateLabelStyle(float fontSize = 13, bool wordWrap = false, TextAnchor alignment = TextAnchor.UpperLeft)
    {
        GUIStyle style = new GUIStyle(GUI.skin.label)
        {
            fontSize = Mathf.RoundToInt(fontSize),
            wordWrap = wordWrap,
            alignment = alignment
        };
        style.normal.textColor = Color.white;
        return style;
    }

    public static GUIStyle CreateCompactButtonStyle(float fontSize = 10, RectOffset padding = null)
    {
        GUIStyle style = new GUIStyle(GUI.skin.button)
        {
            fontSize = Mathf.RoundToInt(fontSize),
            alignment = TextAnchor.MiddleCenter,
            padding = padding ?? new RectOffset(4, 4, 2, 2)
        };
        return style;
    }

    public static GUIStyle CreateSectionHeadingStyle()
    {
        GUIStyle style = CreateLabelStyle(fontSize: 13, alignment: TextAnchor.UpperLeft);
        style.fontStyle = FontStyle.Bold;
        return style;
    }

    public static GUIStyle CreateSmallLabelStyle(float fontSize = 10)
    {
        GUIStyle style = CreateLabelStyle(fontSize, false, TextAnchor.MiddleCenter);
        style.clipping = TextClipping.Overflow;
        return style;
    }

    public static void SetColor(GUIStyle style, Color color)
    {
        if (style == null)
        {
            return;
        }

        style.normal.textColor = color;
    }
}
