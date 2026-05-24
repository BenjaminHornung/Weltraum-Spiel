#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEngine;

public static class PrototypePlayerHudRuntimeEvidenceExporter
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private const string EvidenceChangeName = "player-ui-concept-runtime-audit-v1";

    [MenuItem("Tools/Prototype/Export Player HUD Runtime Evidence")]
    public static void ExportFromMenu()
    {
        Export();
    }

    public static string[] Export()
    {
        string screenshotRoot = GetScreenshotRoot();
        Directory.CreateDirectory(screenshotRoot);

        var ownedObjects = new List<GameObject>();
        var ownedMaterials = new List<Material>();
        var disabledCameras = new List<Camera>();
        try
        {
            DisableExistingCameras(disabledCameras);
            Camera camera = CreateEvidenceCamera(ownedObjects, ownedMaterials);
            PrototypePlayerHudRenderer playerHud = camera.gameObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.RefreshNow();
            ConfigureHudCanvasForCameraCapture(camera);

            ApplySnapshot(playerHud, CreateCombatSnapshot());
            string combat = CaptureScreenshot(playerHud, camera, screenshotRoot, "05-active-combat-target-gameview.png", 1280, 720);
            string combatFourByThree = CaptureScreenshot(playerHud, camera, screenshotRoot, "08-active-combat-target-4x3-gameview.png", 1024, 768);

            ApplySnapshot(playerHud, CreateDockingSnapshot());
            string docking = CaptureScreenshot(playerHud, camera, screenshotRoot, "06-active-docking-gameview.png", 1280, 720);
            string dockingFourByThree = CaptureScreenshot(playerHud, camera, screenshotRoot, "09-active-docking-4x3-gameview.png", 1024, 768);

            SetHelpVisible(playerHud, true);
            ApplySnapshot(playerHud, CreateWarningHelpSnapshot());
            string warningHelp = CaptureScreenshot(playerHud, camera, screenshotRoot, "07-warning-help-4x3-gameview.png", 1024, 768);
            string warningHelpSixteenByNine = CaptureScreenshot(playerHud, camera, screenshotRoot, "10-warning-help-16x9-gameview.png", 1280, 720);

            SetHelpVisible(playerHud, false);
            ApplySnapshot(playerHud, CreateWarningCombatSnapshot());
            string warningCombatFourByThree = CaptureScreenshot(playerHud, camera, screenshotRoot, "11-warning-combat-4x3-gameview.png", 1024, 768);

            Debug.Log(
                "Player HUD runtime evidence exported: "
                + combat + " | "
                + docking + " | "
                + warningHelp + " | "
                + combatFourByThree + " | "
                + dockingFourByThree + " | "
                + warningHelpSixteenByNine + " | "
                + warningCombatFourByThree);
            return new[]
            {
                combat,
                docking,
                warningHelp,
                combatFourByThree,
                dockingFourByThree,
                warningHelpSixteenByNine,
                warningCombatFourByThree
            };
        }
        finally
        {
            for (int i = 0; i < disabledCameras.Count; i++)
            {
                if (disabledCameras[i] != null)
                {
                    disabledCameras[i].enabled = true;
                }
            }

            for (int i = ownedObjects.Count - 1; i >= 0; i--)
            {
                if (ownedObjects[i] != null)
                {
                    UnityEngine.Object.DestroyImmediate(ownedObjects[i]);
                }
            }

            for (int i = ownedMaterials.Count - 1; i >= 0; i--)
            {
                if (ownedMaterials[i] != null)
                {
                    UnityEngine.Object.DestroyImmediate(ownedMaterials[i]);
                }
            }
        }
    }

    private static Camera CreateEvidenceCamera(List<GameObject> ownedObjects, List<Material> ownedMaterials)
    {
        GameObject cameraObject = Track(ownedObjects, new GameObject("PlayerHudRuntimeEvidenceCamera"));
        cameraObject.transform.SetPositionAndRotation(new Vector3(0f, 0f, -12f), Quaternion.identity);
        Camera camera = cameraObject.AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.015f, 0.022f, 0.035f, 1f);
        camera.fieldOfView = 60f;
        camera.nearClipPlane = 0.1f;
        camera.farClipPlane = 500f;
        camera.depth = 100f;

        CreatePrimitive(ownedObjects, ownedMaterials, "CombatEvidenceTarget", PrimitiveType.Cube, new Vector3(-1.8f, 0.4f, 34f), new Vector3(1.7f, 1.2f, 1.7f), new Color(0.95f, 0.22f, 0.12f, 1f));
        CreatePrimitive(ownedObjects, ownedMaterials, "DockingEvidencePort", PrimitiveType.Cylinder, new Vector3(1.4f, -0.2f, 24f), new Vector3(1.3f, 0.22f, 1.3f), new Color(0.18f, 0.72f, 1f, 1f));
        CreatePrimitive(ownedObjects, ownedMaterials, "NavEvidenceBeacon", PrimitiveType.Sphere, new Vector3(0f, 1.8f, 54f), new Vector3(1.1f, 1.1f, 1.1f), new Color(0.25f, 0.85f, 1f, 1f));

        return camera;
    }

    private static PrototypePlayerHudSnapshot CreateCombatSnapshot()
    {
        return new PrototypePlayerHudSnapshot(
            CreateFlightSnapshot(142f, 48f, "Translation", "Translation: main off; W/S + A/D translate."),
            CreateNavigationSnapshot(false),
            new PrototypePlayerCombatSnapshot(
                true,
                "Arena Target 01",
                0.46f,
                "46/100",
                340f,
                "Ready",
                PrototypePlayerHudSeverity.Info,
                "Auto Fire: Armed",
                "Nearest"),
            new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 1, "Reward: salvage voucher"),
            CreateDockingSnapshot(false),
            CreateShipStatus("Weapon ready"),
            new[] { new PrototypePlayerHudChip("Auto Fire armed", PrototypePlayerHudSeverity.Info) },
            new[] { new PrototypePlayerHudChip("Combat target selected", PrototypePlayerHudSeverity.Info) },
            default,
            CreateRadarSnapshot(),
            new PrototypePlayerTargetIndicatorSnapshot(new[]
            {
                new PrototypePlayerTargetIndicator(
                    PrototypePlayerTargetIndicatorKind.Combat,
                    "Arena Target 01",
                    "Ready",
                    new Vector3(-1.8f, 0.4f, 34f),
                    340f,
                    PrototypePlayerHudSeverity.Info,
                    0.46f,
                    true,
                    true),
                new PrototypePlayerTargetIndicator(
                    PrototypePlayerTargetIndicatorKind.Objective,
                    "Arena Objective",
                    "1/3",
                    new Vector3(0f, 1.8f, 54f),
                    540f,
                    PrototypePlayerHudSeverity.Warning,
                    0f,
                    false,
                    true)
            }),
            Vector3.zero,
            Vector3.forward,
            null,
            new Vector3(-1.8f, 0.4f, 34f));
    }

    private static PrototypePlayerHudSnapshot CreateDockingSnapshot()
    {
        PrototypePlayerDockingSnapshot docking = new PrototypePlayerDockingSnapshot(
            true,
            "Docking Port A",
            18f,
            2f,
            0.3f,
            0.1f,
            new Vector2(0.18f, -0.08f),
            "Lock-Kriterien erfuellt",
            PrototypePlayerHudSeverity.Info,
            "Prototype: Hard Lock noch nicht verbunden",
            true,
            "Soft Capture bereit",
            true,
            "Soft Capture Assist aktiv",
            0.2f,
            0.2f,
            0.2f);

        return new PrototypePlayerHudSnapshot(
            CreateFlightSnapshot(12f, 6f, "Precision", "Precision: main disabled; RCS translation active."),
            CreateNavigationSnapshot(false),
            CreateCombatSnapshot(false),
            new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 1, string.Empty),
            docking,
            CreateShipStatus("Weapon standby"),
            new[] { new PrototypePlayerHudChip("Docking assist aktiv", PrototypePlayerHudSeverity.Info) },
            new[] { new PrototypePlayerHudChip("Soft Capture bereit", PrototypePlayerHudSeverity.Info) },
            default,
            CreateRadarSnapshot(),
            new PrototypePlayerTargetIndicatorSnapshot(new[]
            {
                new PrototypePlayerTargetIndicator(
                    PrototypePlayerTargetIndicatorKind.Docking,
                    "Docking Port A",
                    "Soft Capture bereit",
                    new Vector3(1.4f, -0.2f, 24f),
                    18f,
                    PrototypePlayerHudSeverity.Info,
                    0f,
                    true,
                    true)
            }),
            Vector3.zero,
            Vector3.forward,
            new Vector3(1.4f, -0.2f, 24f),
            null);
    }

    private static PrototypePlayerHudSnapshot CreateWarningHelpSnapshot()
    {
        return new PrototypePlayerHudSnapshot(
            CreateFlightSnapshot(27f, 0f, "Translation", "Translation: main off; W/S + A/D translate."),
            CreateNavigationSnapshot(true),
            CreateCombatSnapshot(false),
            new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 1, string.Empty),
            CreateDockingSnapshot(false),
            new PrototypePlayerShipStatusSnapshot(
                "Fuel 4%",
                "Main disabled by mode",
                "RCS limited",
                "SAS hold",
                "Weapon standby",
                "Modules damaged"),
            new[]
            {
                new PrototypePlayerHudChip("Treibstoff niedrig", PrototypePlayerHudSeverity.Warning),
                new PrototypePlayerHudChip("RCS Schub reduziert", PrototypePlayerHudSeverity.Warning)
            },
            new[] { new PrototypePlayerHudChip("Autopilot route preview", PrototypePlayerHudSeverity.Info) },
            default,
            CreateRadarSnapshot(),
            new PrototypePlayerTargetIndicatorSnapshot(new[]
            {
                new PrototypePlayerTargetIndicator(
                    PrototypePlayerTargetIndicatorKind.Navigation,
                    "Nav Beacon",
                    "ETA nicht auf Kurs",
                    new Vector3(0f, 1.8f, 54f),
                    840f,
                    PrototypePlayerHudSeverity.Info,
                    0f,
                    true,
                    true)
            }),
            Vector3.zero,
            Vector3.forward,
            new Vector3(0f, 1.8f, 54f),
            null);
    }

    private static PrototypePlayerHudSnapshot CreateWarningCombatSnapshot()
    {
        return new PrototypePlayerHudSnapshot(
            CreateFlightSnapshot(118f, 36f, "Translation", "Translation: main off; W/S + A/D translate."),
            CreateNavigationSnapshot(false),
            new PrototypePlayerCombatSnapshot(
                true,
                "Arena Target 01",
                0.32f,
                "32/100",
                280f,
                "Out of arc",
                PrototypePlayerHudSeverity.Warning,
                "Auto Fire: Waiting",
                "Low Health"),
            new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 2, "Reward: salvage voucher"),
            CreateDockingSnapshot(false),
            new PrototypePlayerShipStatusSnapshot(
                "Fuel 7%",
                "Main ready",
                "RCS limited",
                "SAS hold",
                "Weapon aligning",
                "Modules damaged"),
            new[]
            {
                new PrototypePlayerHudChip("Treibstoff niedrig", PrototypePlayerHudSeverity.Warning),
                new PrototypePlayerHudChip("Weapon not aligned", PrototypePlayerHudSeverity.Warning)
            },
            new[] { new PrototypePlayerHudChip("Combat target selected", PrototypePlayerHudSeverity.Info) },
            default,
            CreateRadarSnapshot(),
            new PrototypePlayerTargetIndicatorSnapshot(new[]
            {
                new PrototypePlayerTargetIndicator(
                    PrototypePlayerTargetIndicatorKind.Combat,
                    "Arena Target 01",
                    "Out of arc",
                    new Vector3(-1.8f, 0.4f, 34f),
                    280f,
                    PrototypePlayerHudSeverity.Warning,
                    0.32f,
                    true,
                    true)
            }),
            Vector3.zero,
            Vector3.forward,
            null,
            new Vector3(-1.8f, 0.4f, 34f));
    }

    private static PrototypePlayerFlightSnapshot CreateFlightSnapshot(float speed, float throttle, string mode, string hint)
    {
        return new PrototypePlayerFlightSnapshot(
            speed,
            throttle,
            42f,
            100f,
            mode,
            hint,
            mode == "Translation" ? "Main disabled by mode" : "Main ready",
            "RCS ready",
            "SAS hold");
    }

    private static PrototypePlayerNavigationSnapshot CreateNavigationSnapshot(bool visible)
    {
        return new PrototypePlayerNavigationSnapshot(
            visible,
            visible ? "Nav Beacon" : "No target",
            "Beacon",
            visible ? 840f : 0f,
            18f,
            -2f,
            4f,
            visible ? "ETA nicht auf Kurs" : "--",
            visible ? "Ziel gewaehlt" : "Bereit",
            visible ? "Direkter Kurs" : "Kein Kurs",
            visible ? new[] { "Limited RCS" } : new string[0],
            new[] { Vector3.zero, new Vector3(0f, 0f, 24f), new Vector3(0f, 1.8f, 54f) },
            new PrototypeTrajectoryPreviewSnapshot(
                true,
                PrototypeTrajectoryPreviewStatus.Valid,
                "Autopilot route",
                new[] { Vector3.zero, new Vector3(0f, 0f, 24f), new Vector3(0f, 1.8f, 54f) },
                3,
                16,
                12f,
                true,
                false,
                false,
                false,
                false,
                TrajectoryBurnPlan.None),
            false,
            Vector3.zero,
            string.Empty,
            visible ? 2 : 0,
            visible ? 3 : 0);
    }

    private static PrototypePlayerCombatSnapshot CreateCombatSnapshot(bool visible)
    {
        return new PrototypePlayerCombatSnapshot(
            visible,
            visible ? "Arena Target 01" : "No target",
            visible ? 0.46f : 0f,
            visible ? "46/100" : "--",
            visible ? 340f : 0f,
            visible ? "Ready" : "Weapon standby",
            visible ? PrototypePlayerHudSeverity.Info : PrototypePlayerHudSeverity.Disabled,
            visible ? "Auto Fire: Armed" : "Auto Fire: Off",
            "Nearest");
    }

    private static PrototypePlayerDockingSnapshot CreateDockingSnapshot(bool visible)
    {
        return new PrototypePlayerDockingSnapshot(
            visible,
            "Docking Port A",
            18f,
            2f,
            0.3f,
            0.1f,
            Vector2.zero,
            visible ? "Lock-Kriterien erfuellt" : "Assist inaktiv",
            visible ? PrototypePlayerHudSeverity.Info : PrototypePlayerHudSeverity.Disabled,
            visible ? "Prototype: Hard Lock noch nicht verbunden" : string.Empty,
            visible,
            visible ? "Soft Capture bereit" : "Soft Capture nicht aktiv",
            visible,
            visible ? "Soft Capture Assist aktiv" : "Assist inaktiv",
            visible ? 0.2f : 0f,
            visible ? 0.2f : 0f,
            visible ? 0.2f : 0f);
    }

    private static PrototypePlayerShipStatusSnapshot CreateShipStatus(string weaponLabel)
    {
        return new PrototypePlayerShipStatusSnapshot(
            "Fuel 42%",
            "Main ready",
            "RCS ready",
            "SAS hold",
            weaponLabel,
            "Modules nominal");
    }

    private static PrototypePlayerRadarSnapshot CreateRadarSnapshot()
    {
        return new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedCombat, "Arena Target 01", new Vector3(-1.8f, 0.4f, 34f), 0.46f),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Docking, "Docking Port A", new Vector3(1.4f, -0.2f, 24f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedNavigation, "Nav Beacon", new Vector3(0f, 1.8f, 54f))
            },
            new[] { Vector3.zero, new Vector3(0f, 0f, 24f), new Vector3(0f, 1.8f, 54f) },
            new[] { Vector3.zero, new Vector3(0f, 0f, 18f), new Vector3(0f, 1.8f, 42f) },
            false,
            Vector3.zero);
    }

    private static string CaptureScreenshot(
        PrototypePlayerHudRenderer playerHud,
        Camera camera,
        string screenshotRoot,
        string fileName,
        int width,
        int height)
    {
        string path = Path.Combine(screenshotRoot, fileName);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        RenderTexture previousTarget = camera.targetTexture;
        RenderTexture previousActive = RenderTexture.active;
        RenderTexture renderTexture = null;
        Texture2D texture = null;

        try
        {
            renderTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            texture = new Texture2D(width, height, TextureFormat.RGB24, false);
            camera.targetTexture = renderTexture;
            playerHud.ApplyResponsiveLayoutForTests(width, height);
            Canvas.ForceUpdateCanvases();
            camera.Render();
            RenderTexture.active = renderTexture;
            texture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            texture.Apply(false);
            File.WriteAllBytes(path, texture.EncodeToPNG());
        }
        finally
        {
            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;

            if (texture != null)
            {
                UnityEngine.Object.DestroyImmediate(texture);
            }

            if (renderTexture != null)
            {
                renderTexture.Release();
                UnityEngine.Object.DestroyImmediate(renderTexture);
            }
        }

        if (!File.Exists(path) || new FileInfo(path).Length <= 4096)
        {
            throw new IOException("Screenshot was not written or is unexpectedly small: " + path);
        }

        return path;
    }

    private static void ConfigureHudCanvasForCameraCapture(Camera camera)
    {
        Canvas canvas = camera.GetComponentInChildren<Canvas>(true);
        if (canvas == null)
        {
            throw new MissingReferenceException("PrototypePlayerHudCanvas was not created.");
        }

        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = camera;
        canvas.planeDistance = 1f;
        Canvas.ForceUpdateCanvases();
    }

    private static void ApplySnapshot(PrototypePlayerHudRenderer playerHud, PrototypePlayerHudSnapshot snapshot)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("ApplySnapshot", PrivateInstance);
        if (method == null)
        {
            throw new MissingMethodException(nameof(PrototypePlayerHudRenderer), "ApplySnapshot");
        }

        method.Invoke(playerHud, new object[] { snapshot });
        Canvas.ForceUpdateCanvases();
    }

    private static void SetHelpVisible(PrototypePlayerHudRenderer playerHud, bool visible)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("SetHelpVisible", PrivateInstance);
        if (method == null)
        {
            throw new MissingMethodException(nameof(PrototypePlayerHudRenderer), "SetHelpVisible");
        }

        method.Invoke(playerHud, new object[] { visible });
        Canvas.ForceUpdateCanvases();
    }

    private static string GetScreenshotRoot()
    {
        return Path.Combine(
            Directory.GetCurrentDirectory(),
            ".devtoolbox",
            "specs",
            "changes",
            EvidenceChangeName,
            "tests",
            "screenshots");
    }

    private static void DisableExistingCameras(List<Camera> disabledCameras)
    {
        Camera[] cameras = UnityEngine.Object.FindObjectsByType<Camera>();
        for (int i = 0; i < cameras.Length; i++)
        {
            if (cameras[i].enabled)
            {
                cameras[i].enabled = false;
                disabledCameras.Add(cameras[i]);
            }
        }
    }

    private static GameObject CreatePrimitive(
        List<GameObject> ownedObjects,
        List<Material> ownedMaterials,
        string name,
        PrimitiveType primitiveType,
        Vector3 position,
        Vector3 scale,
        Color color)
    {
        GameObject primitive = Track(ownedObjects, GameObject.CreatePrimitive(primitiveType));
        primitive.name = name;
        primitive.transform.position = position;
        primitive.transform.localScale = scale;

        Renderer renderer = primitive.GetComponent<Renderer>();
        if (renderer != null)
        {
            Material material = renderer.sharedMaterial != null
                ? new Material(renderer.sharedMaterial)
                : new Material(Shader.Find("Standard"));
            material.name = name + "RuntimeEvidenceMaterial";
            material.color = color;
            renderer.sharedMaterial = material;
            ownedMaterials.Add(material);
        }

        return primitive;
    }

    private static GameObject Track(List<GameObject> ownedObjects, GameObject gameObject)
    {
        ownedObjects.Add(gameObject);
        return gameObject;
    }
}
#endif
