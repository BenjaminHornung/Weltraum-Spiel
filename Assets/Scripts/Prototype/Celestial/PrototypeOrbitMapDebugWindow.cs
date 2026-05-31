using System.Collections.Generic;
using UnityEngine;

public class PrototypeOrbitMapDebugWindow : MonoBehaviour
{
    [SerializeField] private CelestialBodyCatalog catalog;
    [SerializeField] private double epochSeconds;
    [SerializeField] private int orbitSampleCount = CelestialOrbitMapSnapshotBuilder.DefaultOrbitSampleCount;

    private static readonly Rect DefaultRect = new Rect(20f, 20f, 420f, 382f);
    private const float CollapsedHeight = 58f;
    private const int MaxReadoutRows = 6;
    private const string Title = "Orbit Map Debug";
    private const string NoCatalogLabel = "No orbit catalog available";
    private const string OrbitRenderLabel = "Orbit lines are rendered from analytical map samples.";

    private PrototypeUiWindowState windowState;
    private GUIStyle headingStyle;
    private GUIStyle noteStyle;
    private GUIStyle readoutStyle;
    private string[] readoutLines = System.Array.Empty<string>();
    private CelestialOrbitMapSnapshot snapshot;

    private void OnGUI()
    {
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        EnsureStyles();
        BuildSnapshotLines();
        windowState.SetSize(420f, windowState.Collapsed ? CollapsedHeight : 382f);
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, Title);
        windowState.ClampToScreen();
        windowState.SaveToPrefs();
    }

    public void SetCatalog(CelestialBodyCatalog sourceCatalog)
    {
        catalog = sourceCatalog;
    }

    public void SetEpochSeconds(double seconds)
    {
        epochSeconds = seconds;
    }

    private void BuildSnapshotLines()
    {
        if (!CatalogForDisplay(out CelestialBodyCatalog sourceCatalog))
        {
            snapshot = null;
            readoutLines = new[] { NoCatalogLabel };
            return;
        }

        if (CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(sourceCatalog, epochSeconds, out var builtSnapshot, orbitSampleCount))
        {
            this.snapshot = builtSnapshot;
            readoutLines = CelestialOrbitMapSnapshotBuilder.BuildDebugReadoutLines(this.snapshot, MaxReadoutRows);
            if (readoutLines.Length == 0)
            {
                readoutLines = new[] { "No bodies in snapshot." };
            }
        }
        else
        {
            snapshot = null;
            readoutLines = new[] { "Failed to build orbit snapshot." };
        }
    }

    private void ResolveWindowState()
    {
        if (windowState != null)
        {
            return;
        }

        windowState = PrototypeUiLayoutManager.GetWindow(
            PrototypeUiLayoutManager.OrbitMapDebugWindowId,
            DefaultRect,
            true,
            false);
    }

    private bool CatalogForDisplay(out CelestialBodyCatalog resolvedCatalog)
    {
        resolvedCatalog = catalog;
        if (resolvedCatalog != null)
        {
            return true;
        }

        resolvedCatalog = Resources.Load<CelestialBodyCatalog>(CelestialBodyCatalog.ResourcePath);
        if (resolvedCatalog != null)
        {
            return true;
        }

        resolvedCatalog = null;
        return false;
    }

    private void EnsureStyles()
    {
        if (headingStyle != null)
        {
            return;
        }

        headingStyle = PrototypeUiStyle.CreateSectionHeadingStyle();
        noteStyle = PrototypeUiStyle.CreateLabelStyle(10f, true);
        readoutStyle = PrototypeUiStyle.CreateLabelStyle(9f);
        noteStyle.normal.textColor = PrototypeUiStyle.MutedColor;
        readoutStyle.normal.textColor = new Color(0.93f, 0.95f, 1f, 1f);
        headingStyle.normal.textColor = new Color(0.82f, 0.94f, 1f, 1f);
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Open" : "Collapse", GUILayout.Width(78f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        GUILayout.Label(Title, headingStyle);
        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            GUILayout.Space(4f);
            GUILayout.Label("Prototype-only map diagnostics: real values and map-scaled values are kept separate.", noteStyle);
            DrawCanvasArea();
            GUILayout.Space(6f);
            DrawReadout();
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawCanvasArea()
    {
        Rect canvasRect = GUILayoutUtility.GetRect(380f, 150f, GUILayout.ExpandWidth(true));
        Color previous = GUI.color;
        GUI.color = new Color(0.02f, 0.032f, 0.06f, 0.95f);
        GUI.DrawTexture(canvasRect, Texture2D.whiteTexture);
        GUI.color = previous;

        Vector2 center = new Vector2(
            canvasRect.x + (canvasRect.width * 0.5f),
            canvasRect.y + (canvasRect.height * 0.5f));
        float radius = Mathf.Min(canvasRect.width, canvasRect.height) * 0.35f;

        DrawCanvasLine(center, center + Vector2.left * radius, Color.white);
        DrawCanvasLine(center, center + Vector2.right * radius, Color.white);
        DrawCanvasLine(center + Vector2.up * radius, center - Vector2.up * radius, new Color(0.55f, 0.85f, 1f, 1f));
        DrawOrbitLines(canvasRect);
        DrawCanvasStatusText(canvasRect);
    }

    private void DrawCanvasStatusText(Rect canvasRect)
    {
        Color previousColor = GUI.color;
        GUI.color = new Color(0.75f, 0.85f, 0.98f, 1f);
        GUI.Label(new Rect(canvasRect.x + 8f, canvasRect.y + 8f, canvasRect.width - 16f, 18f), OrbitRenderLabel, noteStyle);
        GUI.Label(new Rect(canvasRect.x + 8f, canvasRect.yMax - 22f, canvasRect.width - 16f, 18f), "Map readout below is preview-only", noteStyle);
        GUI.color = previousColor;
    }

    private void DrawOrbitLines(Rect canvasRect)
    {
        if (snapshot == null || snapshot.Bodies == null)
        {
            return;
        }

        int sampleCount = 0;
        double minX = double.PositiveInfinity;
        double minY = double.PositiveInfinity;
        double maxX = double.NegativeInfinity;
        double maxY = double.NegativeInfinity;

        for (int i = 0; i < snapshot.Bodies.Count; i++)
        {
            var samples = snapshot.Bodies[i].OrbitLineSamplesMapMeters;
            if (samples == null || samples.Count == 0)
            {
                continue;
            }

            for (int j = 0; j < samples.Count; j++)
            {
                var sample = samples[j];
                if (!double.IsFinite(sample.x) || !double.IsFinite(sample.y))
                {
                    continue;
                }

                if (sample.x < minX)
                {
                    minX = sample.x;
                }

                if (sample.x > maxX)
                {
                    maxX = sample.x;
                }

                if (sample.y < minY)
                {
                    minY = sample.y;
                }

                if (sample.y > maxY)
                {
                    maxY = sample.y;
                }

                sampleCount++;
            }
        }

        if (sampleCount == 0)
        {
            return;
        }

        float padding = 10f;
        float drawWidth = Mathf.Max(2f, canvasRect.width - (padding * 2f));
        float drawHeight = Mathf.Max(2f, canvasRect.height - (padding * 2f));
        float rangeX = (float)(maxX - minX);
        float rangeY = (float)(maxY - minY);
        if (rangeX <= 0f)
        {
            rangeX = 1f;
        }

        if (rangeY <= 0f)
        {
            rangeY = 1f;
        }

        float scale = Mathf.Min(drawWidth / rangeX, drawHeight / rangeY);
        double centerX = (minX + maxX) * 0.5d;
        double centerY = (minY + maxY) * 0.5d;
        double xOffset = centerX;
        double yOffset = centerY;

        Color previousColor = GUI.color;
        for (int i = 0; i < snapshot.Bodies.Count; i++)
        {
            CelestialOrbitMapBodySnapshot body = snapshot.Bodies[i];
            IReadOnlyList<LargeWorldVector3d> samples = body.OrbitLineSamplesMapMeters;
            if (samples == null || samples.Count < 2)
            {
                continue;
            }

            Color lineColor = Color.HSVToRGB((i * 0.2f) % 1f, 0.55f, 1f);
            Vector2 previous = default;
            bool hasPrevious = false;

            for (int j = 0; j < samples.Count; j++)
            {
                LargeWorldVector3d sample = samples[j];
                if (!double.IsFinite(sample.x) || !double.IsFinite(sample.y))
                {
                    hasPrevious = false;
                    continue;
                }

                float screenX = canvasRect.x + padding + (float)((sample.x - xOffset) * scale) + (drawWidth * 0.5f);
                float screenY = canvasRect.y + padding + (float)((yOffset - sample.y) * scale) + (drawHeight * 0.5f);
                Vector2 current = new Vector2(screenX, screenY);
                if (hasPrevious)
                {
                    DrawCanvasLine(previous, current, lineColor);
                }

                previous = current;
                hasPrevious = true;
            }
        }

        GUI.color = previousColor;
    }

    private void DrawReadout()
    {
        for (int i = 0; i < readoutLines.Length; i++)
        {
            GUILayout.Label(readoutLines[i], readoutStyle);
        }
    }

    private static void DrawCanvasLine(Vector2 start, Vector2 end, Color color)
    {
        float thickness = 1f;
        Vector2 delta = end - start;
        if (delta.sqrMagnitude < 0.0001f)
        {
            return;
        }

        Color oldColor = GUI.color;
        Matrix4x4 oldMatrix = GUI.matrix;
        GUI.color = color;
        float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
        float length = delta.magnitude;

        GUIUtility.RotateAroundPivot(angle, start);
        GUI.DrawTexture(new Rect(start.x, start.y - (thickness * 0.5f), length, thickness), Texture2D.whiteTexture);
        GUI.matrix = oldMatrix;
        GUI.color = oldColor;
    }
}
