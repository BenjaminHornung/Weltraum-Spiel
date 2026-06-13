using UnityEngine;
using UnityEngine.UI;

public sealed class PrototypeNavigationTimelineGraphic : MaskableGraphic
{
    private static readonly PrototypeNavigationTimelineSegment[] EmptySegments = System.Array.Empty<PrototypeNavigationTimelineSegment>();
    private static readonly PrototypeNavigationTimelineSegmentLayout[] EmptySegmentLayouts = System.Array.Empty<PrototypeNavigationTimelineSegmentLayout>();
    private PrototypeNavigationTimelineSegment[] segments = EmptySegments;
    private float progress01;
    private int activeSegmentIndex = -1;
    private bool compact;

    public void SetTimeline(
        PrototypeNavigationTimelineSegment[] value,
        float progress,
        int activeIndex,
        bool compactMode)
    {
        segments = value ?? EmptySegments;
        progress01 = Mathf.Clamp01(progress);
        activeSegmentIndex = activeIndex;
        compact = compactMode;
        SetVerticesDirty();
    }

    public PrototypeNavigationTimelineLayout BuildLayoutForTests(Rect rect)
    {
        return BuildLayout(rect, segments, progress01, activeSegmentIndex, compact);
    }

    protected override void OnPopulateMesh(VertexHelper vh)
    {
        vh.Clear();
        Rect rect = rectTransform.rect;
        if (rect.width <= 1f || rect.height <= 1f)
        {
            return;
        }

        PrototypeNavigationTimelineLayout layout = BuildLayout(rect, segments, progress01, activeSegmentIndex, compact);
        DrawRect(vh, rect, layout.BackgroundColor);

        if (layout.Segments.Length == 0)
        {
            DrawRect(vh, layout.TrackRect, new Color(PrototypeUiStyle.DisabledColor.r, PrototypeUiStyle.DisabledColor.g, PrototypeUiStyle.DisabledColor.b, 0.28f));
            DrawRect(vh, layout.ProgressMarkerRect, Color.white);
            return;
        }

        for (int i = 0; i < layout.Segments.Length; i++)
        {
            PrototypeNavigationTimelineSegmentLayout segmentLayout = layout.Segments[i];
            if (segmentLayout.IsActive)
            {
                DrawRect(vh, segmentLayout.ActiveHighlightRect, segmentLayout.ActiveHighlightColor);
            }

            DrawRect(vh, segmentLayout.Rect, segmentLayout.Color);
        }

        DrawRect(vh, layout.ProgressMarkerRect, Color.white);
    }

    private static PrototypeNavigationTimelineLayout BuildLayout(
        Rect rect,
        PrototypeNavigationTimelineSegment[] value,
        float progress,
        int activeIndex,
        bool compactMode)
    {
        PrototypeNavigationTimelineSegment[] layoutSegments = value ?? EmptySegments;
        Color backgroundColor = new Color(0.05f, 0.065f, 0.09f, compactMode ? 0.72f : 0.88f);
        Rect trackRect = new Rect(
            rect.xMin + (compactMode ? 2f : 4f),
            rect.yMin + (compactMode ? 3f : 5f),
            Mathf.Max(1f, rect.width - (compactMode ? 4f : 8f)),
            Mathf.Max(1f, rect.height - (compactMode ? 6f : 10f)));

        if (layoutSegments.Length == 0)
        {
            return new PrototypeNavigationTimelineLayout(
                trackRect,
                EmptySegmentLayouts,
                ProgressMarkerRect(trackRect, 0f),
                backgroundColor);
        }

        float totalDuration = 0f;
        for (int i = 0; i < layoutSegments.Length; i++)
        {
            totalDuration += Mathf.Max(0.001f, layoutSegments[i].DurationSeconds);
        }

        float minWidth = compactMode ? 4f : 9f;
        float reservedMinimum = minWidth * layoutSegments.Length;
        float proportionalWidth = Mathf.Max(0f, trackRect.width - reservedMinimum);
        float x = trackRect.xMin;
        var renderedSegments = new PrototypeNavigationTimelineSegmentLayout[layoutSegments.Length];

        for (int i = 0; i < layoutSegments.Length; i++)
        {
            float duration = Mathf.Max(0.001f, layoutSegments[i].DurationSeconds);
            float width = minWidth + proportionalWidth * (duration / totalDuration);
            if (i == layoutSegments.Length - 1)
            {
                width = trackRect.xMax - x;
            }

            Rect segmentRect = new Rect(x, trackRect.yMin, Mathf.Max(1f, width - 1f), trackRect.height);
            Color segmentColor = ColorForPhase(layoutSegments[i].Phase);
            bool active = i == activeIndex;
            Rect highlightRect = default;
            Color highlightColor = default;
            if (active)
            {
                highlightRect = Inflate(segmentRect, compactMode ? 1f : 2f);
                highlightColor = new Color(1f, 1f, 1f, compactMode ? 0.2f : 0.26f);
                segmentColor = Color.Lerp(segmentColor, Color.white, compactMode ? 0.2f : 0.28f);
            }

            renderedSegments[i] = new PrototypeNavigationTimelineSegmentLayout(segmentRect, segmentColor, active, highlightRect, highlightColor);
            x += width;
        }

        return new PrototypeNavigationTimelineLayout(
            trackRect,
            renderedSegments,
            ProgressMarkerRect(trackRect, progress),
            backgroundColor);
    }

    private static Rect Inflate(Rect rect, float amount)
    {
        return new Rect(rect.xMin - amount, rect.yMin - amount, rect.width + amount * 2f, rect.height + amount * 2f);
    }

    private static Color ColorForPhase(PrototypeManeuverPhase phase)
    {
        switch (phase)
        {
            case PrototypeManeuverPhase.ProgradeBurn:
            case PrototypeManeuverPhase.AvoidanceBurn:
            case PrototypeManeuverPhase.ReacquireRoute:
                return new Color(PrototypeUiStyle.ActiveColor.r, PrototypeUiStyle.ActiveColor.g, PrototypeUiStyle.ActiveColor.b, 0.92f);
            case PrototypeManeuverPhase.FlipToRetrograde:
                return new Color(PrototypeUiStyle.WarningColor.r, PrototypeUiStyle.WarningColor.g, PrototypeUiStyle.WarningColor.b, 0.94f);
            case PrototypeManeuverPhase.RetrogradeBurn:
            case PrototypeManeuverPhase.LateralCorrection:
                return new Color(1f, 0.5f, 0.22f, 0.94f);
            case PrototypeManeuverPhase.FinalApproach:
            case PrototypeManeuverPhase.Hold:
                return new Color(PrototypeUiStyle.OkColor.r, PrototypeUiStyle.OkColor.g, PrototypeUiStyle.OkColor.b, 0.9f);
            case PrototypeManeuverPhase.AlignForBurn:
            case PrototypeManeuverPhase.Coast:
                return new Color(PrototypeUiStyle.MutedColor.r, PrototypeUiStyle.MutedColor.g, PrototypeUiStyle.MutedColor.b, 0.58f);
            default:
                return new Color(PrototypeUiStyle.DisabledColor.r, PrototypeUiStyle.DisabledColor.g, PrototypeUiStyle.DisabledColor.b, 0.46f);
        }
    }

    private static Rect ProgressMarkerRect(Rect trackRect, float normalized)
    {
        float x = Mathf.Lerp(trackRect.xMin, trackRect.xMax, Mathf.Clamp01(normalized));
        return new Rect(x - 1.2f, trackRect.yMin - 3f, 2.4f, trackRect.height + 6f);
    }

    private static void DrawRect(VertexHelper vh, Rect rect, Color color)
    {
        int index = vh.currentVertCount;
        UIVertex vertex = UIVertex.simpleVert;
        vertex.color = color;
        vertex.position = new Vector2(rect.xMin, rect.yMin);
        vh.AddVert(vertex);
        vertex.position = new Vector2(rect.xMin, rect.yMax);
        vh.AddVert(vertex);
        vertex.position = new Vector2(rect.xMax, rect.yMax);
        vh.AddVert(vertex);
        vertex.position = new Vector2(rect.xMax, rect.yMin);
        vh.AddVert(vertex);
        vh.AddTriangle(index, index + 1, index + 2);
        vh.AddTriangle(index, index + 2, index + 3);
    }
}

public readonly struct PrototypeNavigationTimelineLayout
{
    public PrototypeNavigationTimelineLayout(
        Rect trackRect,
        PrototypeNavigationTimelineSegmentLayout[] segments,
        Rect progressMarkerRect,
        Color backgroundColor)
    {
        TrackRect = trackRect;
        Segments = segments ?? System.Array.Empty<PrototypeNavigationTimelineSegmentLayout>();
        ProgressMarkerRect = progressMarkerRect;
        BackgroundColor = backgroundColor;
    }

    public Rect TrackRect { get; }
    public PrototypeNavigationTimelineSegmentLayout[] Segments { get; }
    public Rect ProgressMarkerRect { get; }
    public Color BackgroundColor { get; }
}

public readonly struct PrototypeNavigationTimelineSegmentLayout
{
    public PrototypeNavigationTimelineSegmentLayout(
        Rect rect,
        Color color,
        bool isActive,
        Rect activeHighlightRect,
        Color activeHighlightColor)
    {
        Rect = rect;
        Color = color;
        IsActive = isActive;
        ActiveHighlightRect = activeHighlightRect;
        ActiveHighlightColor = activeHighlightColor;
    }

    public Rect Rect { get; }
    public Color Color { get; }
    public bool IsActive { get; }
    public Rect ActiveHighlightRect { get; }
    public Color ActiveHighlightColor { get; }
}
