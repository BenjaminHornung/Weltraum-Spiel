using NUnit.Framework;
using System.IO;
using UnityEngine;

public class PrototypeShipBuilderV0PlayModeTests
{
    private SimulationMode previousSimulationMode;

    [SetUp]
    public void SetUp()
    {
        DestroyByPrefix("ShipBuilderPlayMode");
        DestroyByPrefix("PrototypeShip");
        DestroyByPrefix("PrototypeEnvironment");
        DestroyByPrefix("PrototypeTargetDummy");
        previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        Physics.SyncTransforms();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyByPrefix("ShipBuilderPlayMode");
        DestroyByPrefix("PrototypeShip");
        DestroyByPrefix("PrototypeEnvironment");
        DestroyByPrefix("PrototypeTargetDummy");
        Physics.simulationMode = previousSimulationMode;
    }

    [Test]
    public void CustomBlueprintSpawnFly_BindsGenericRcsAndMoves()
    {
        PrototypeShipBlueprint blueprint = CreateCustomBlueprint();
        PrototypeShipBlueprintBuildResult buildResult = blueprint.BuildVariant();
        Assert.True(buildResult.IsValid, string.Join("\n", buildResult.Validation.Errors));

        var host = new GameObject("ShipBuilderPlayModeBootstrapHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
        bootstrap.BuildPrototype(buildResult.Variant);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Rigidbody body = ship.GetComponent<Rigidbody>();
        ShipStats stats = ship.GetComponent<ShipStats>();
        MainThrusterBank mainThruster = ship.GetComponent<MainThrusterBank>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();

        Assert.NotNull(body);
        Assert.NotNull(stats);
        Assert.NotNull(mainThruster);
        Assert.NotNull(rcs);
        Assert.That(body.mass, Is.EqualTo(buildResult.TotalDryMassKg + buildResult.TotalFuelCapacityKg).Within(0.5f));
        Assert.That(stats.MaxFuelKg, Is.EqualTo(buildResult.TotalFuelCapacityKg).Within(0.1f));
        Assert.That(stats.Thrust, Is.EqualTo(buildResult.TotalMainThrustForce).Within(0.1f));
        Assert.That(mainThruster.ThrusterCount, Is.GreaterThan(0));
        Assert.That(rcs.InstalledNozzleCount, Is.GreaterThan(0));
        Assert.That(ship.GetComponentsInChildren<RcsThrusterBlock>(true).Length, Is.GreaterThan(0));
        Assert.That(ship.GetComponentsInChildren<PrototypeShipHardpoint>(true).Length, Is.GreaterThan(0));

        Vector3 before = body.linearVelocity;
        mainThruster.Fire(1f, 0f, 0f, Time.fixedDeltaTime);
        Physics.Simulate(Time.fixedDeltaTime);

        Assert.That(body.linearVelocity.magnitude, Is.GreaterThan(before.magnitude));
    }

    [Test]
    public void HangarGate_AllowsParkedShipAndBlocksMovingShip()
    {
        var cameraObject = new GameObject("ShipBuilderPlayModeCamera");
        cameraObject.AddComponent<Camera>();
        var ship = new GameObject("PrototypeShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        var mode = cameraObject.AddComponent<PrototypeShipBuilderMode>();
        mode.Bind(null, ship.transform, body);

        Assert.True(mode.CanEnterHangar());
        mode.EnterHangar();
        Assert.True(mode.IsActive);
        mode.ExitHangar(false);

        body.linearVelocity = Vector3.right * 1.25f;
        Assert.False(mode.CanEnterHangar());
        body.linearVelocity = Vector3.zero;
        Assert.True(mode.CanEnterHangar());
    }

    [Test]
    public void ScreenshotEvidence_CapturesBuilderAndTestFlightPngs()
    {
        string screenshotRoot = GetScreenshotRoot();
        Directory.CreateDirectory(screenshotRoot);

        var cameraObject = new GameObject("ShipBuilderPlayModeScreenshotCamera");
        Camera camera = cameraObject.AddComponent<Camera>();
        ConfigureEvidenceCamera(camera);

        var parkedShip = new GameObject("PrototypeShip");
        Rigidbody parkedBody = parkedShip.AddComponent<Rigidbody>();
        var mode = cameraObject.AddComponent<PrototypeShipBuilderMode>();
        mode.Bind(null, parkedShip.transform, parkedBody);
        mode.EnterHangar();
        mode.SetActiveCategory(PrototypeShipModuleCategory.RcsBlock);
        mode.StartGhost("rcs-pod-65");
        mode.PlaceGhost(new Vector3(2.25f, 0f, 1.5f));
        Canvas.ForceUpdateCanvases();

        CaptureScreenshot(camera, screenshotRoot, "ship-builder-hangar-1280x720.png", 1280, 720, true);
        CaptureScreenshot(camera, screenshotRoot, "ship-builder-hangar-2560x1080.png", 2560, 1080, true);

        Object.DestroyImmediate(parkedShip);
        mode.ExitHangar(true);

        PrototypeShipBlueprintBuildResult buildResult = CreateCustomBlueprint().BuildVariant();
        Assert.True(buildResult.IsValid, string.Join("\n", buildResult.Validation.Errors));
        var host = new GameObject("ShipBuilderPlayModeScreenshotBootstrapHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        bootstrap.SetBuildMode(PrototypeShipBuildMode.GeneratedPrimitiveFallback, false);
        bootstrap.BuildPrototype(buildResult.Variant);
        ConfigureEvidenceCamera(camera);
        CaptureScreenshot(camera, screenshotRoot, "ship-builder-testflight-1280x720.png", 1280, 720, false);

        Assert.That(File.Exists(Path.Combine(screenshotRoot, "ship-builder-hangar-1280x720.png")), Is.True);
        Assert.That(File.Exists(Path.Combine(screenshotRoot, "ship-builder-hangar-2560x1080.png")), Is.True);
        Assert.That(File.Exists(Path.Combine(screenshotRoot, "ship-builder-testflight-1280x720.png")), Is.True);
    }

    private static PrototypeShipBlueprint CreateCustomBlueprint()
    {
        PrototypeShipBlueprint scout = PrototypeShipBlueprintCatalog.ScoutBlueprint();
        return new PrototypeShipBlueprint(
            "ship-builder-playmode-custom",
            "Ship Builder PlayMode Custom",
            PrototypeShipBuilderSession.CloneDefinitions(scout.Definitions),
            new[]
            {
                new PrototypeShipModuleInstance("pm-hull-001", "hull-core", Vector3.zero),
                new PrototypeShipModuleInstance("pm-cockpit-001", "cockpit-mk1", new Vector3(0f, 0.5f, 2.25f)),
                new PrototypeShipModuleInstance("pm-tank-001", "fuel-tank-300", new Vector3(0f, -0.5f, 0f)),
                new PrototypeShipModuleInstance("pm-engine-001", "main-engine-45", new Vector3(0f, 0f, -3.4f)),
                new PrototypeShipModuleInstance("pm-rcs-a", "rcs-pod-65", new Vector3(0.75f, 0.7f, 0.15f), Vector3.zero, new Vector3(0.55f, 0.22f, 0.55f)),
                new PrototypeShipModuleInstance("pm-rcs-b", "rcs-pod-65", new Vector3(-0.75f, -0.7f, -0.15f), Vector3.zero, new Vector3(0.55f, 0.22f, 0.55f)),
                new PrototypeShipModuleInstance("pm-gun-001", "gun-light", new Vector3(0f, 0.15f, 3.3f))
            });
    }

    private static void DestroyByPrefix(string prefix)
    {
        Transform[] transforms = Resources.FindObjectsOfTypeAll<Transform>();
        for (int i = transforms.Length - 1; i >= 0; i--)
        {
            Transform transform = transforms[i];
            if (transform == null || transform.parent != null || transform.gameObject == null)
            {
                continue;
            }

            if (transform.gameObject.name.StartsWith(prefix, System.StringComparison.Ordinal))
            {
                Object.DestroyImmediate(transform.gameObject);
            }
        }
    }

    private static string GetScreenshotRoot()
    {
        return Path.Combine(
            Directory.GetCurrentDirectory(),
            ".devtoolbox",
            "specs",
            "changes",
            "prototype-ship-blueprint-v0",
            "tests",
            "screenshots");
    }

    private static void ConfigureEvidenceCamera(Camera camera)
    {
        Assert.NotNull(camera);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.035f, 0.045f, 0.06f, 1f);
        camera.fieldOfView = 44f;
        camera.nearClipPlane = 0.03f;
        camera.farClipPlane = 100f;
        camera.transform.position = new Vector3(7.4f, 4.8f, -8.4f);
        camera.transform.LookAt(new Vector3(0f, 0.1f, 0f));
    }

    private static void CaptureScreenshot(Camera camera, string screenshotRoot, string fileName, int width, int height, bool includeBuilderHud)
    {
        string path = Path.Combine(screenshotRoot, fileName);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        Canvas[] canvases = Resources.FindObjectsOfTypeAll<Canvas>();
        Canvas[] changedCanvases = includeBuilderHud ? BindBuilderCanvasesToCamera(canvases, camera) : System.Array.Empty<Canvas>();
        RenderTexture previousTarget = camera.targetTexture;
        RenderTexture previousActive = RenderTexture.active;
        RenderTexture renderTexture = null;
        Texture2D texture = null;

        try
        {
            renderTexture = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            texture = new Texture2D(width, height, TextureFormat.RGB24, false);
            camera.targetTexture = renderTexture;
            Canvas.ForceUpdateCanvases();
            camera.Render();
            RenderTexture.active = renderTexture;
            texture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            texture.Apply(false);
            AssertRenderablePixels(texture, fileName);
            File.WriteAllBytes(path, texture.EncodeToPNG());
            Assert.That(new FileInfo(path).Length, Is.GreaterThan(4096), path);
        }
        finally
        {
            for (int i = 0; i < changedCanvases.Length; i++)
            {
                if (changedCanvases[i] != null)
                {
                    changedCanvases[i].renderMode = RenderMode.ScreenSpaceOverlay;
                    changedCanvases[i].worldCamera = null;
                }
            }

            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;

            if (texture != null)
            {
                Object.DestroyImmediate(texture);
            }

            if (renderTexture != null)
            {
                renderTexture.Release();
                Object.DestroyImmediate(renderTexture);
            }
        }
    }

    private static Canvas[] BindBuilderCanvasesToCamera(Canvas[] canvases, Camera camera)
    {
        var changed = new System.Collections.Generic.List<Canvas>();
        for (int i = 0; i < canvases.Length; i++)
        {
            Canvas canvas = canvases[i];
            if (canvas == null || canvas.gameObject.name != "PrototypeShipBuilderHudCanvas")
            {
                continue;
            }

            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = camera;
            canvas.planeDistance = 0.5f;
            changed.Add(canvas);
        }

        return changed.ToArray();
    }

    private static void AssertRenderablePixels(Texture2D texture, string label)
    {
        int coloredPixels = 0;
        int sampledPixels = 0;
        for (int y = 0; y < texture.height; y += 12)
        {
            for (int x = 0; x < texture.width; x += 12)
            {
                Color pixel = texture.GetPixel(x, y);
                if (pixel.r > 0.08f || pixel.g > 0.08f || pixel.b > 0.08f)
                {
                    coloredPixels++;
                }

                sampledPixels++;
            }
        }

        Assert.That(coloredPixels, Is.GreaterThan(sampledPixels / 80), label);
    }
}
