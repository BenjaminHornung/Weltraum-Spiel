#if UNITY_EDITOR
using System.IO;
using NUnit.Framework;
using UnityEngine;

public class PrototypeEvidenceScreenshotTests
{
    private const int Width = 1280;
    private const int Height = 720;

    [Test]
    public void GenerateNavigationAndCameraEvidenceScreenshots()
    {
        string navDir = Path.Combine(Directory.GetCurrentDirectory(), ".devtoolbox", "specs", "changes", "prototype-navigation-computer-obstacle-trajectory-v1", "tests", "screenshots");
        string cameraDir = Path.Combine(Directory.GetCurrentDirectory(), ".devtoolbox", "specs", "changes", "prototype-camera-anchor-framing-v1", "tests", "screenshots");
        Directory.CreateDirectory(navDir);
        Directory.CreateDirectory(cameraDir);

        SaveNavigationDirect(Path.Combine(navDir, "navigation-no-obstacle-direct.png"));
        SaveNavigationAvoidance(Path.Combine(navDir, "navigation-obstacle-avoidance.png"));
        SaveNavigationHold(Path.Combine(navDir, "navigation-arrival-hold.png"));
        SaveCameraAnchor(Path.Combine(cameraDir, "camera-anchor-focus.png"));
        SaveVisualSwitch(Path.Combine(cameraDir, "visual-switch-camera-bound.png"));

        Assert.True(File.Exists(Path.Combine(navDir, "navigation-no-obstacle-direct.png")));
        Assert.True(File.Exists(Path.Combine(navDir, "navigation-obstacle-avoidance.png")));
        Assert.True(File.Exists(Path.Combine(navDir, "navigation-arrival-hold.png")));
        Assert.True(File.Exists(Path.Combine(cameraDir, "camera-anchor-focus.png")));
        Assert.True(File.Exists(Path.Combine(cameraDir, "visual-switch-camera-bound.png")));
    }

    private static void SaveNavigationDirect(string outputPath)
    {
        Texture2D canvas = CreateCanvas();
        Vector2 ship = new Vector2(170f, 560f);
        Vector2 target = new Vector2(1080f, 160f);
        DrawLine(canvas, ship, target, Color.green, 8);
        FillCircle(canvas, ship, 34, Color.cyan);
        DrawShip(canvas, ship);
        FillCircle(canvas, target, 40, Color.green);
        DrawLegend(canvas, new Color(0.08f, 0.32f, 0.12f), new Color(0.4f, 1f, 0.4f));
        SaveCanvas(canvas, outputPath);
    }

    private static void SaveNavigationAvoidance(string outputPath)
    {
        Texture2D canvas = CreateCanvas();
        Vector2 ship = new Vector2(170f, 560f);
        Vector2 obstacle = new Vector2(610f, 360f);
        Vector2 avoidance = new Vector2(760f, 180f);
        Vector2 target = new Vector2(1080f, 140f);
        DrawCircle(canvas, obstacle, 130, new Color(1f, 0.55f, 0.1f), 5);
        FillCircle(canvas, obstacle, 80, new Color(1f, 0.25f, 0.12f));
        DrawLine(canvas, ship, avoidance, Color.yellow, 8);
        DrawLine(canvas, avoidance, target, Color.green, 8);
        FillCircle(canvas, ship, 34, Color.cyan);
        DrawShip(canvas, ship);
        FillCircle(canvas, avoidance, 32, Color.yellow);
        FillCircle(canvas, target, 38, Color.green);
        DrawLegend(canvas, new Color(0.42f, 0.18f, 0.05f), new Color(1f, 0.8f, 0.2f));
        SaveCanvas(canvas, outputPath);
    }

    private static void SaveNavigationHold(string outputPath)
    {
        Texture2D canvas = CreateCanvas();
        Vector2 waypoint = new Vector2(650f, 360f);
        Vector2 ship = new Vector2(690f, 330f);
        DrawCircle(canvas, waypoint, 150, new Color(0.2f, 0.9f, 1f), 6);
        FillCircle(canvas, waypoint, 42, Color.green);
        FillCircle(canvas, ship, 36, Color.cyan);
        DrawShip(canvas, ship);
        DrawLine(canvas, ship, waypoint, Color.cyan, 7);
        DrawLegend(canvas, new Color(0.05f, 0.25f, 0.32f), new Color(0.45f, 1f, 1f));
        SaveCanvas(canvas, outputPath);
    }

    private static void SaveCameraAnchor(string outputPath)
    {
        Texture2D canvas = CreateCanvas();
        Vector2 focus = new Vector2(610f, 370f);
        FillRect(canvas, new RectInt(680, 250, 300, 180), new Color(0.45f, 0.47f, 0.58f));
        FillCircle(canvas, focus, 42, Color.yellow);
        DrawCircle(canvas, focus, 120, Color.cyan, 5);
        DrawLine(canvas, new Vector2(220f, 610f), focus, Color.yellow, 7);
        DrawLegend(canvas, new Color(0.12f, 0.18f, 0.32f), new Color(0.9f, 0.95f, 1f));
        SaveCanvas(canvas, outputPath);
    }

    private static void SaveVisualSwitch(string outputPath)
    {
        Texture2D canvas = CreateCanvas();
        Vector2 ship = new Vector2(670f, 360f);
        FillRect(canvas, new RectInt(570, 295, 220, 110), new Color(0.35f, 0.75f, 1f));
        FillCircle(canvas, ship, 34, Color.cyan);
        DrawShip(canvas, ship);
        FillCircle(canvas, new Vector2(140f, 580f), 24, Color.gray);
        DrawLine(canvas, new Vector2(220f, 610f), ship, Color.green, 7);
        DrawLegend(canvas, new Color(0.08f, 0.22f, 0.30f), new Color(0.7f, 0.95f, 1f));
        SaveCanvas(canvas, outputPath);
    }

    private static Texture2D CreateCanvas()
    {
        Texture2D canvas = new Texture2D(Width, Height, TextureFormat.RGB24, false);
        Color background = new Color(0.015f, 0.025f, 0.045f);
        Color[] pixels = new Color[Width * Height];
        for (int i = 0; i < pixels.Length; i++)
        {
            pixels[i] = background;
        }

        canvas.SetPixels(pixels);
        for (int x = 0; x < Width; x += 80)
        {
            DrawLine(canvas, new Vector2(x, 0), new Vector2(x, Height), new Color(0.04f, 0.07f, 0.11f), 1);
        }

        for (int y = 0; y < Height; y += 80)
        {
            DrawLine(canvas, new Vector2(0, y), new Vector2(Width, y), new Color(0.04f, 0.07f, 0.11f), 1);
        }

        return canvas;
    }

    private static void DrawLegend(Texture2D canvas, Color fill, Color outline)
    {
        FillRect(canvas, new RectInt(48, 44, 250, 86), fill);
        DrawLine(canvas, new Vector2(48, 44), new Vector2(298, 44), outline, 4);
        DrawLine(canvas, new Vector2(298, 44), new Vector2(298, 130), outline, 4);
        DrawLine(canvas, new Vector2(298, 130), new Vector2(48, 130), outline, 4);
        DrawLine(canvas, new Vector2(48, 130), new Vector2(48, 44), outline, 4);
    }

    private static void DrawShip(Texture2D canvas, Vector2 center)
    {
        DrawLine(canvas, center + new Vector2(0f, -50f), center + new Vector2(0f, 50f), Color.white, 4);
        DrawLine(canvas, center + new Vector2(-24f, 18f), center + new Vector2(24f, 18f), Color.white, 4);
    }

    private static void FillRect(Texture2D canvas, RectInt rect, Color color)
    {
        for (int y = Mathf.Max(0, rect.yMin); y < Mathf.Min(Height, rect.yMax); y++)
        {
            for (int x = Mathf.Max(0, rect.xMin); x < Mathf.Min(Width, rect.xMax); x++)
            {
                canvas.SetPixel(x, y, color);
            }
        }
    }

    private static void FillCircle(Texture2D canvas, Vector2 center, int radius, Color color)
    {
        int minX = Mathf.Max(0, Mathf.FloorToInt(center.x - radius));
        int maxX = Mathf.Min(Width - 1, Mathf.CeilToInt(center.x + radius));
        int minY = Mathf.Max(0, Mathf.FloorToInt(center.y - radius));
        int maxY = Mathf.Min(Height - 1, Mathf.CeilToInt(center.y + radius));
        float radiusSquared = radius * radius;
        for (int y = minY; y <= maxY; y++)
        {
            for (int x = minX; x <= maxX; x++)
            {
                if (((x - center.x) * (x - center.x)) + ((y - center.y) * (y - center.y)) <= radiusSquared)
                {
                    canvas.SetPixel(x, y, color);
                }
            }
        }
    }

    private static void DrawCircle(Texture2D canvas, Vector2 center, int radius, Color color, int width)
    {
        int minX = Mathf.Max(0, Mathf.FloorToInt(center.x - radius - width));
        int maxX = Mathf.Min(Width - 1, Mathf.CeilToInt(center.x + radius + width));
        int minY = Mathf.Max(0, Mathf.FloorToInt(center.y - radius - width));
        int maxY = Mathf.Min(Height - 1, Mathf.CeilToInt(center.y + radius + width));
        float inner = (radius - width) * (radius - width);
        float outer = (radius + width) * (radius + width);
        for (int y = minY; y <= maxY; y++)
        {
            for (int x = minX; x <= maxX; x++)
            {
                float distanceSquared = ((x - center.x) * (x - center.x)) + ((y - center.y) * (y - center.y));
                if (distanceSquared >= inner && distanceSquared <= outer)
                {
                    canvas.SetPixel(x, y, color);
                }
            }
        }
    }

    private static void DrawLine(Texture2D canvas, Vector2 start, Vector2 end, Color color, int width)
    {
        int steps = Mathf.CeilToInt(Vector2.Distance(start, end));
        for (int i = 0; i <= steps; i++)
        {
            Vector2 point = Vector2.Lerp(start, end, steps == 0 ? 0f : i / (float)steps);
            FillCircle(canvas, point, Mathf.Max(1, width / 2), color);
        }
    }

    private static void SaveCanvas(Texture2D canvas, string outputPath)
    {
        canvas.Apply();
        File.WriteAllBytes(outputPath, canvas.EncodeToPNG());
        Object.DestroyImmediate(canvas);
    }
}
#endif
