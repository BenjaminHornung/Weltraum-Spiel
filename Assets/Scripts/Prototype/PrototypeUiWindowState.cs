using UnityEngine;

public sealed class PrototypeUiWindowState
{
    private const float MinimumWidth = 180f;
    private const float MinimumHeight = 42f;
    private const float ScreenPadding = 8f;

    private readonly string prefsPrefix;
    private bool hasLoadedPrefs;

    public PrototypeUiWindowState(string id, Rect defaultRect, bool defaultVisible, bool defaultCollapsed, bool rememberPosition)
    {
        Id = id;
        DefaultRect = defaultRect;
        Rect = defaultRect;
        DefaultVisible = defaultVisible;
        DefaultCollapsed = defaultCollapsed;
        Visible = defaultVisible;
        Collapsed = defaultCollapsed;
        RememberPosition = rememberPosition;
        WindowId = Mathf.Abs(id.GetHashCode());
        prefsPrefix = "prototype.ui." + id + ".";
    }

    public string Id { get; }
    public Rect Rect { get; set; }
    public Rect DefaultRect { get; private set; }
    public bool Visible { get; set; }
    public bool Collapsed { get; set; }
    public bool DefaultVisible { get; }
    public bool DefaultCollapsed { get; }
    public bool RememberPosition { get; }
    public int WindowId { get; }

    public void SetDefaultRect(Rect defaultRect)
    {
        DefaultRect = defaultRect;
    }

    public void SetSize(float width, float height)
    {
        Rect rect = Rect;
        rect.width = Mathf.Max(MinimumWidth, width);
        rect.height = Mathf.Max(MinimumHeight, height);
        Rect = rect;
    }

    public void Reset()
    {
        Rect = DefaultRect;
        Visible = DefaultVisible;
        Collapsed = DefaultCollapsed;

        if (RememberPosition)
        {
            PlayerPrefs.DeleteKey(prefsPrefix + "x");
            PlayerPrefs.DeleteKey(prefsPrefix + "y");
            PlayerPrefs.DeleteKey(prefsPrefix + "w");
            PlayerPrefs.DeleteKey(prefsPrefix + "h");
            PlayerPrefs.DeleteKey(prefsPrefix + "visible");
            PlayerPrefs.DeleteKey(prefsPrefix + "collapsed");
        }
    }

    public void LoadFromPrefs()
    {
        if (hasLoadedPrefs || !RememberPosition)
        {
            return;
        }

        hasLoadedPrefs = true;
        Rect rect = Rect;
        rect.x = PlayerPrefs.GetFloat(prefsPrefix + "x", rect.x);
        rect.y = PlayerPrefs.GetFloat(prefsPrefix + "y", rect.y);
        rect.width = PlayerPrefs.GetFloat(prefsPrefix + "w", rect.width);
        rect.height = PlayerPrefs.GetFloat(prefsPrefix + "h", rect.height);
        Rect = rect;
        Visible = PlayerPrefs.GetInt(prefsPrefix + "visible", Visible ? 1 : 0) != 0;
        Collapsed = PlayerPrefs.GetInt(prefsPrefix + "collapsed", Collapsed ? 1 : 0) != 0;
    }

    public void SaveToPrefs()
    {
        if (!RememberPosition || Event.current == null || Event.current.type != EventType.Repaint)
        {
            return;
        }

        PlayerPrefs.SetFloat(prefsPrefix + "x", Rect.x);
        PlayerPrefs.SetFloat(prefsPrefix + "y", Rect.y);
        PlayerPrefs.SetFloat(prefsPrefix + "w", Rect.width);
        PlayerPrefs.SetFloat(prefsPrefix + "h", Rect.height);
        PlayerPrefs.SetInt(prefsPrefix + "visible", Visible ? 1 : 0);
        PlayerPrefs.SetInt(prefsPrefix + "collapsed", Collapsed ? 1 : 0);
    }

    public void ClampToScreen()
    {
        Rect rect = Rect;
        float maxWidth = Mathf.Max(MinimumWidth, Screen.width - (ScreenPadding * 2f));
        float maxHeight = Mathf.Max(MinimumHeight, Screen.height - (ScreenPadding * 2f));
        rect.width = Mathf.Clamp(rect.width, MinimumWidth, maxWidth);
        rect.height = Mathf.Clamp(rect.height, MinimumHeight, maxHeight);
        rect.x = Mathf.Clamp(rect.x, ScreenPadding, Mathf.Max(ScreenPadding, Screen.width - rect.width - ScreenPadding));
        rect.y = Mathf.Clamp(rect.y, ScreenPadding, Mathf.Max(ScreenPadding, Screen.height - rect.height - ScreenPadding));
        Rect = rect;
    }
}
