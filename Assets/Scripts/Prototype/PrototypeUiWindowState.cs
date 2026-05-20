using UnityEngine;

public sealed class PrototypeUiWindowState
{
    private const float MinimumWidth = 180f;
    private const float MinimumHeight = 42f;
    private const float ScreenPadding = 8f;
    private const float DefaultSaveThrottleSeconds = 0.75f;

    private readonly string prefsPrefix;
    private bool hasLoadedPrefs;
    private Rect rect;
    private bool visible;
    private bool collapsed;
    private Rect persistedRect;
    private bool persistedVisible;
    private bool persistedCollapsed;
    private bool dirty;
    private float lastSaveTime = float.NegativeInfinity;

    private static IPrototypeUiPrefsStorage prefsStorage = new PlayerPrefsStorage();

    public PrototypeUiWindowState(string id, Rect defaultRect, bool defaultVisible, bool defaultCollapsed, bool rememberPosition)
    {
        Id = id;
        DefaultRect = defaultRect;
        rect = defaultRect;
        DefaultVisible = defaultVisible;
        DefaultCollapsed = defaultCollapsed;
        visible = defaultVisible;
        collapsed = defaultCollapsed;
        persistedRect = defaultRect;
        persistedVisible = defaultVisible;
        persistedCollapsed = defaultCollapsed;
        RememberPosition = rememberPosition;
        WindowId = Mathf.Abs(id.GetHashCode());
        prefsPrefix = "prototype.ui." + id + ".";
    }

    public string Id { get; }
    public Rect Rect
    {
        get => rect;
        set
        {
            if (RectApproximately(rect, value))
            {
                return;
            }

            rect = value;
            MarkDirty();
        }
    }

    public Rect DefaultRect { get; private set; }
    public bool Visible
    {
        get => visible;
        set
        {
            if (visible == value)
            {
                return;
            }

            visible = value;
            MarkDirty();
        }
    }

    public bool Collapsed
    {
        get => collapsed;
        set
        {
            if (collapsed == value)
            {
                return;
            }

            collapsed = value;
            MarkDirty();
        }
    }

    public bool DefaultVisible { get; }
    public bool DefaultCollapsed { get; }
    public bool RememberPosition { get; }
    public int WindowId { get; }
    public bool IsDirty => dirty;
    public float SaveThrottleSeconds { get; set; } = DefaultSaveThrottleSeconds;

    public static void SetPrefsStorageForTests(IPrototypeUiPrefsStorage storage)
    {
        prefsStorage = storage ?? new PlayerPrefsStorage();
    }

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
        SetStateWithoutDirty(DefaultRect, DefaultVisible, DefaultCollapsed);
        MarkPersistedClean();

        if (RememberPosition)
        {
            prefsStorage.DeleteKey(prefsPrefix + "x");
            prefsStorage.DeleteKey(prefsPrefix + "y");
            prefsStorage.DeleteKey(prefsPrefix + "w");
            prefsStorage.DeleteKey(prefsPrefix + "h");
            prefsStorage.DeleteKey(prefsPrefix + "visible");
            prefsStorage.DeleteKey(prefsPrefix + "collapsed");
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
        rect.x = prefsStorage.GetFloat(prefsPrefix + "x", rect.x);
        rect.y = prefsStorage.GetFloat(prefsPrefix + "y", rect.y);
        rect.width = prefsStorage.GetFloat(prefsPrefix + "w", rect.width);
        rect.height = prefsStorage.GetFloat(prefsPrefix + "h", rect.height);
        bool loadedVisible = prefsStorage.GetInt(prefsPrefix + "visible", Visible ? 1 : 0) != 0;
        bool loadedCollapsed = prefsStorage.GetInt(prefsPrefix + "collapsed", Collapsed ? 1 : 0) != 0;
        SetStateWithoutDirty(rect, loadedVisible, loadedCollapsed);
        MarkPersistedClean();
    }

    public void SaveToPrefs()
    {
        TrySaveToPrefsThrottled();
    }

    public bool TrySaveToPrefsThrottled()
    {
        return TrySaveToPrefsThrottled(Time.unscaledTime, true);
    }

    public bool TrySaveToPrefsThrottled(float nowSeconds, bool requireRepaintEvent)
    {
        if (!RememberPosition || (requireRepaintEvent && (Event.current == null || Event.current.type != EventType.Repaint)))
        {
            return false;
        }

        if (!dirty && StateMatchesPersisted())
        {
            return false;
        }

        if (nowSeconds - lastSaveTime < SaveThrottleSeconds)
        {
            return false;
        }

        prefsStorage.SetFloat(prefsPrefix + "x", Rect.x);
        prefsStorage.SetFloat(prefsPrefix + "y", Rect.y);
        prefsStorage.SetFloat(prefsPrefix + "w", Rect.width);
        prefsStorage.SetFloat(prefsPrefix + "h", Rect.height);
        prefsStorage.SetInt(prefsPrefix + "visible", Visible ? 1 : 0);
        prefsStorage.SetInt(prefsPrefix + "collapsed", Collapsed ? 1 : 0);
        lastSaveTime = nowSeconds;
        MarkPersistedClean();
        return true;
    }

    public void MarkDirty()
    {
        dirty = true;
    }

    public void ClampToScreen()
    {
        ClampToBounds(new Rect(0f, 0f, Screen.width, Screen.height));
    }

    public void ClampToBounds(Rect bounds)
    {
        Rect rect = Rect;
        float width = Mathf.Max(1f, bounds.width);
        float height = Mathf.Max(1f, bounds.height);
        float maxWidth = Mathf.Max(MinimumWidth, width - (ScreenPadding * 2f));
        float maxHeight = Mathf.Max(MinimumHeight, height - (ScreenPadding * 2f));
        rect.width = Mathf.Clamp(rect.width, MinimumWidth, maxWidth);
        rect.height = Mathf.Clamp(rect.height, MinimumHeight, maxHeight);
        rect.x = Mathf.Clamp(rect.x, bounds.x + ScreenPadding, Mathf.Max(bounds.x + ScreenPadding, bounds.xMax - rect.width - ScreenPadding));
        rect.y = Mathf.Clamp(rect.y, bounds.y + ScreenPadding, Mathf.Max(bounds.y + ScreenPadding, bounds.yMax - rect.height - ScreenPadding));
        Rect = rect;
    }

    private void SetStateWithoutDirty(Rect nextRect, bool nextVisible, bool nextCollapsed)
    {
        rect = nextRect;
        visible = nextVisible;
        collapsed = nextCollapsed;
        dirty = false;
    }

    private void MarkPersistedClean()
    {
        persistedRect = rect;
        persistedVisible = visible;
        persistedCollapsed = collapsed;
        dirty = false;
    }

    private bool StateMatchesPersisted()
    {
        return RectApproximately(rect, persistedRect)
            && visible == persistedVisible
            && collapsed == persistedCollapsed;
    }

    private static bool RectApproximately(Rect a, Rect b)
    {
        return Mathf.Approximately(a.x, b.x)
            && Mathf.Approximately(a.y, b.y)
            && Mathf.Approximately(a.width, b.width)
            && Mathf.Approximately(a.height, b.height);
    }

    private sealed class PlayerPrefsStorage : IPrototypeUiPrefsStorage
    {
        public float GetFloat(string key, float defaultValue)
        {
            return PlayerPrefs.GetFloat(key, defaultValue);
        }

        public int GetInt(string key, int defaultValue)
        {
            return PlayerPrefs.GetInt(key, defaultValue);
        }

        public void SetFloat(string key, float value)
        {
            PlayerPrefs.SetFloat(key, value);
        }

        public void SetInt(string key, int value)
        {
            PlayerPrefs.SetInt(key, value);
        }

        public void DeleteKey(string key)
        {
            PlayerPrefs.DeleteKey(key);
        }
    }
}

public interface IPrototypeUiPrefsStorage
{
    float GetFloat(string key, float defaultValue);
    int GetInt(string key, int defaultValue);
    void SetFloat(string key, float value);
    void SetInt(string key, int value);
    void DeleteKey(string key);
}
