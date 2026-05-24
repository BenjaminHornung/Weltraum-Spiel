using System;
using System.IO;
using System.Reflection;
using NUnit.Framework;
#if UNITY_EDITOR
using UnityEditor.SceneManagement;
#endif
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;

public class PrototypePlayerHudLiveRuntimeEvidencePlayModeTests
{
    private const string ScenePath = "Assets/Scenes/PrototypeBootstrapHost.unity";
    private const string ChangeName = "player-ui-concept-runtime-audit-v1";
    private const string AspectRatioScalingChangeName = "player-hud-live-aspect-ratio-scaling-v1";
    private const string WorldLabelReadabilityChangeName = "player-world-label-readability-v1";
    private const string LiveEvidenceSymmetryChangeName = "player-ui-live-evidence-symmetry-v1";
    private const BindingFlags NonPublicInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    private SimulationMode previousSimulationMode;
    private float previousFixedDeltaTime;

    [SetUp]
    public void SetUp()
    {
        previousSimulationMode = Physics.simulationMode;
        previousFixedDeltaTime = Time.fixedDeltaTime;
        Physics.simulationMode = SimulationMode.Script;
        Time.fixedDeltaTime = 0.02f;
        CleanupRuntimeObjects();
        PrototypeWeaponTargetRegistry.ClearForTests();
    }

    [TearDown]
    public void TearDown()
    {
        CleanupRuntimeObjects();
        PrototypeWeaponTargetRegistry.ClearForTests();
        Physics.simulationMode = previousSimulationMode;
        Time.fixedDeltaTime = previousFixedDeltaTime;
    }

    [Test]
    [Category("PlayerHudEvidence")]
    [Timeout(120000)]
    public void PrototypeBootstrapRuntimePlayerHudEvidenceCapturesLiveStates()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        PrototypeUiLayoutManager.ResetPresetToBasic();
        GameObject host = new GameObject("PrototypePlayerHudLiveEvidenceHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildPveArena", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", true);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        LiveHudRig rig = ResolveRig();
        ConfigureHudCanvasForCameraCapture(rig);
        RunFrames(rig, 3);

        string screenshotRoot = GetScreenshotRoot();
        Directory.CreateDirectory(screenshotRoot);

        rig.Autopilot.SelectTarget(null);
        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        rig.PlayerHud.SetTargetDockingPort(null);
        RunFrames(rig, 3);
        PrototypePlayerHudSnapshot cruise = CaptureLiveState(
            rig,
            screenshotRoot,
            "12-live-cruise-objective-16x9.png",
            1280,
            720);
        Assert.That(cruise.Arena.IsVisible, Is.True, "live cruise/objective arena snapshot");
        Assert.That(cruise.Combat.TargetName, Is.EqualTo("No target"), "live cruise/objective should not have an active combat target");
        Assert.That(HasIndicator(cruise, PrototypePlayerTargetIndicatorKind.Combat), Is.False, "live cruise/objective should not project an active combat target");
        Assert.That(cruise.Docking.Visible, Is.False, "live cruise/objective should not be docking-preempted");
        AssertPanelsSeparated(rig.PlayerHud, false);

        PrototypeNavigationTarget navTarget = rig.Autopilot.SelectNextTarget();
        Assert.NotNull(navTarget, "live navigation target");
        rig.Autopilot.ReplanNow();
        rig.Autopilot.ToggleAutopilot();
        RunFrames(rig, 8);
        PrototypePlayerHudSnapshot navigation = CaptureLiveState(
            rig,
            screenshotRoot,
            "13-live-navigation-autopilot-16x9.png",
            1280,
            720);
        Assert.That(navigation.Navigation.Visible, Is.True, "live navigation snapshot");
        Assert.That(navigation.Navigation.TargetCount, Is.GreaterThan(0), "live navigation target count");
        Assert.That(navigation.Radar.Blips.Length, Is.GreaterThan(0), "live navigation radar blips");
        Assert.That(HasIndicator(navigation, PrototypePlayerTargetIndicatorKind.Navigation), Is.True, "live navigation target indicator");
        AssertPanelsSeparated(rig.PlayerHud, false);

        rig.WeaponComputer.RefreshTargets();
        Assert.That(rig.WeaponComputer.SelectNextTarget(), Is.True, "live combat target selection");
        rig.WeaponComputer.SetAutoFireEnabled(true);
        rig.WeaponComputer.SetPriorityMode(PrototypeWeaponTargetPriorityMode.Nearest);
        RunFrames(rig, 8);
        PrototypePlayerHudSnapshot combat = CaptureLiveState(
            rig,
            screenshotRoot,
            "14-live-combat-target-16x9.png",
            1280,
            720);
        Assert.That(combat.Combat.Visible, Is.True, "live combat snapshot");
        Assert.NotNull(rig.WeaponComputer.ActiveTargetTransform, "live weapon computer active target");
        Assert.That(HasIndicator(combat, PrototypePlayerTargetIndicatorKind.Combat), Is.True, "live combat target indicator");
        Assert.That(HasRadarBlip(combat, PrototypePlayerRadarBlipKind.SelectedCombat), Is.True, "live selected combat radar blip");
        AssertPanelsSeparated(rig.PlayerHud, false);

        rig.Autopilot.Abort("live evidence docking");
        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        DockingPort targetDockingPort = rig.DockingAssist.TargetDockingPort;
        Assert.NotNull(targetDockingPort, "live docking target port");
        rig.PlayerHud.SetTargetDockingPort(targetDockingPort);
        rig.DockingAssist.SetAssistEnabled(true);
        InvokeIfExists(rig.DockingAssist, "FixedUpdate");
        RunFrames(rig, 6);
        PrototypePlayerHudSnapshot docking = CaptureLiveState(
            rig,
            screenshotRoot,
            "15-live-docking-assist-16x9.png",
            1280,
            720);
        Assert.That(docking.Docking.Visible, Is.True, "live docking snapshot");
        Assert.That(HasIndicator(docking, PrototypePlayerTargetIndicatorKind.Docking), Is.True, "live docking target indicator");
        Assert.That(HasRadarBlip(docking, PrototypePlayerRadarBlipKind.Docking), Is.True, "live docking radar blip");
        AssertPanelsSeparated(rig.PlayerHud, false);

        SetPrivateField(rig.Stats, "currentFuelKg", rig.Stats.MaxFuelKg * 0.04f);
        rig.PlayerHud.SetTargetDockingPort(null);
        SetHelpVisible(rig.PlayerHud, true);
        RunFrames(rig, 3);
        PrototypePlayerHudSnapshot warningHelp = CaptureLiveState(
            rig,
            screenshotRoot,
            "16-live-warning-help-4x3.png",
            1024,
            768);
        Assert.That(HasWarning(warningHelp, "Treibstoff niedrig"), Is.True, "live low-fuel warning");
        AssertHelpModal(rig.PlayerHud);

        SetHelpVisible(rig.PlayerHud, false);
        rig.WeaponComputer.RefreshTargets();
        Assert.That(rig.WeaponComputer.SelectNextTarget(), Is.True, "live 4:3 combat target selection");
        rig.WeaponComputer.SetAutoFireEnabled(true);
        RunFrames(rig, 6);
        PrototypePlayerHudSnapshot combatFourByThree = CaptureLiveState(
            rig,
            screenshotRoot,
            "17-live-combat-target-4x3.png",
            1024,
            768);
        Assert.That(combatFourByThree.Combat.Visible, Is.True, "live 4:3 combat snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);

        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        rig.PlayerHud.SetTargetDockingPort(targetDockingPort);
        RunFrames(rig, 6);
        PrototypePlayerHudSnapshot dockingFourByThree = CaptureLiveState(
            rig,
            screenshotRoot,
            "18-live-docking-assist-4x3.png",
            1024,
            768);
        Assert.That(dockingFourByThree.Docking.Visible, Is.True, "live 4:3 docking snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
    }

    [Test]
    [Category("PlayerHudEvidence")]
    [Timeout(120000)]
    public void PrototypeBootstrapRuntimePlayerHudEvidenceCapturesAspectRatioMatrix()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        PrototypeUiLayoutManager.ResetPresetToBasic();
        GameObject host = new GameObject("PrototypePlayerHudLiveEvidenceHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildPveArena", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", true);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        LiveHudRig rig = ResolveRig();
        ConfigureHudCanvasForCameraCapture(rig);
        RunFrames(rig, 3);

        string screenshotRoot = GetScreenshotRoot(AspectRatioScalingChangeName);
        Directory.CreateDirectory(screenshotRoot);

        rig.Autopilot.SelectTarget(null);
        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        rig.PlayerHud.SetTargetDockingPort(null);
        RunFrames(rig, 3);

        PrototypePlayerHudSnapshot cruiseUltrawide = CaptureLiveState(
            rig,
            screenshotRoot,
            "20-live-cruise-ultrawide-2560x1080.png",
            2560,
            1080);
        Assert.That(cruiseUltrawide.Arena.IsVisible, Is.True, "live ultrawide cruise/objective arena snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);

        PrototypePlayerHudSnapshot cruiseSixteenTen = CaptureLiveState(
            rig,
            screenshotRoot,
            "21-live-cruise-16x10-1440x900.png",
            1440,
            900);
        Assert.That(cruiseSixteenTen.Arena.IsVisible, Is.True, "live 16:10 cruise/objective arena snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);

        PrototypePlayerHudSnapshot cruisePortrait = CaptureLiveState(
            rig,
            screenshotRoot,
            "22-live-cruise-portrait-900x1600.png",
            900,
            1600);
        Assert.That(cruisePortrait.Arena.IsVisible, Is.True, "live portrait cruise/objective arena snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);

        PrototypePlayerHudSnapshot cruiseMinimum = CaptureLiveState(
            rig,
            screenshotRoot,
            "23-live-cruise-minimum-640x480.png",
            640,
            480);
        Assert.That(cruiseMinimum.Arena.IsVisible, Is.True, "live minimum cruise/objective arena snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);

        PrototypeNavigationTarget navTarget = rig.Autopilot.SelectNextTarget();
        Assert.NotNull(navTarget, "live aspect navigation target");
        rig.Autopilot.ReplanNow();
        rig.Autopilot.ToggleAutopilot();
        RunFrames(rig, 8);
        PrototypePlayerHudSnapshot navigationPortrait = CaptureLiveState(
            rig,
            screenshotRoot,
            "24-live-navigation-portrait-900x1600.png",
            900,
            1600);
        Assert.That(navigationPortrait.Navigation.Visible, Is.True, "live portrait navigation snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);

        PrototypePlayerHudSnapshot navigationUltrawide = CaptureLiveState(
            rig,
            screenshotRoot,
            "25-live-navigation-ultrawide-2560x1080.png",
            2560,
            1080);
        Assert.That(navigationUltrawide.Navigation.Visible, Is.True, "live ultrawide navigation snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);

        rig.Autopilot.Abort("aspect ratio evidence combat");
        rig.WeaponComputer.RefreshTargets();
        Assert.That(rig.WeaponComputer.SelectNextTarget(), Is.True, "live aspect combat target selection");
        rig.WeaponComputer.SetAutoFireEnabled(true);
        RunFrames(rig, 6);
        PrototypePlayerHudSnapshot combatMinimum = CaptureLiveState(
            rig,
            screenshotRoot,
            "26-live-combat-minimum-640x480.png",
            640,
            480);
        Assert.That(combatMinimum.Combat.Visible, Is.True, "live minimum combat snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);

        SetPrivateField(rig.Stats, "currentFuelKg", rig.Stats.MaxFuelKg * 0.04f);
        SetHelpVisible(rig.PlayerHud, true);
        RunFrames(rig, 3);
        PrototypePlayerHudSnapshot helpPortrait = CaptureLiveState(
            rig,
            screenshotRoot,
            "27-live-help-portrait-900x1600.png",
            900,
            1600);
        Assert.That(HasWarning(helpPortrait, "Treibstoff niedrig"), Is.True, "live portrait help low-fuel warning");
        AssertPanelsSeparated(rig.PlayerHud, true);
    }

    [Test]
    [Category("PlayerHudEvidence")]
    [Timeout(120000)]
    public void PrototypeBootstrapRuntimePlayerHudEvidenceCapturesFourByThreeCruiseAndNavigation()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        PrototypeUiLayoutManager.ResetPresetToBasic();
        GameObject host = new GameObject("PrototypePlayerHudLiveEvidenceHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildPveArena", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", true);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        LiveHudRig rig = ResolveRig();
        ConfigureHudCanvasForCameraCapture(rig);
        RunFrames(rig, 3);

        string screenshotRoot = GetScreenshotRoot(LiveEvidenceSymmetryChangeName);
        Directory.CreateDirectory(screenshotRoot);

        rig.Autopilot.SelectTarget(null);
        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        rig.PlayerHud.SetTargetDockingPort(null);
        RunFrames(rig, 3);

        PrototypePlayerHudSnapshot cruiseFourByThree = CaptureLiveState(
            rig,
            screenshotRoot,
            "31-live-cruise-objective-4x3.png",
            1024,
            768);
        Assert.That(cruiseFourByThree.Arena.IsVisible, Is.True, "live 4:3 cruise/objective arena snapshot");
        Assert.That(cruiseFourByThree.Combat.TargetName, Is.EqualTo("No target"), "live 4:3 cruise/objective should not have an active combat target");
        Assert.That(cruiseFourByThree.Docking.Visible, Is.False, "live 4:3 cruise/objective should not be docking-preempted");
        Assert.That(HasIndicator(cruiseFourByThree, PrototypePlayerTargetIndicatorKind.Combat), Is.False, "live 4:3 cruise/objective should not project an active combat target");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);

        PrototypeNavigationTarget navTarget = rig.Autopilot.SelectNextTarget();
        Assert.NotNull(navTarget, "live 4:3 navigation target");
        rig.Autopilot.ReplanNow();
        rig.Autopilot.ToggleAutopilot();
        RunFrames(rig, 8);

        PrototypePlayerHudSnapshot navigationFourByThree = CaptureLiveState(
            rig,
            screenshotRoot,
            "32-live-navigation-autopilot-4x3.png",
            1024,
            768);
        Assert.That(navigationFourByThree.Navigation.Visible, Is.True, "live 4:3 navigation snapshot");
        Assert.That(navigationFourByThree.Navigation.TargetCount, Is.GreaterThan(0), "live 4:3 navigation target count");
        Assert.That(navigationFourByThree.Radar.Blips.Length, Is.GreaterThan(0), "live 4:3 navigation radar blips");
        Assert.That(HasIndicator(navigationFourByThree, PrototypePlayerTargetIndicatorKind.Navigation), Is.True, "live 4:3 navigation target indicator");
        AssertPanelsSeparated(rig.PlayerHud, false);
        AssertActiveButtonTextNotOverflowing(rig.PlayerHud);
    }

    [Test]
    [Category("PlayerWorldLabelEvidence")]
    [Timeout(120000)]
    public void PrototypeBootstrapRuntimePlayerHudEvidenceHidesDebugWorldLabelsInTraining()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        PrototypeUiLayoutManager.ResetPresetToBasic();
        GameObject host = new GameObject("PrototypePlayerHudLiveEvidenceHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", true);
        SetPrivateField(bootstrap, "buildPveArena", true);
        SetPrivateField(bootstrap, "buildTestEnvironment", true);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        LiveHudRig rig = ResolveRig();
        ConfigureHudCanvasForCameraCapture(rig);
        rig.Autopilot.SelectTarget(null);
        rig.WeaponComputer.ClearSelection();
        rig.WeaponComputer.SetAutoFireEnabled(false);
        rig.PlayerHud.SetTargetDockingPort(null);
        RunFrames(rig, 3);

        AssertNoWorldLabelText("ORIGIN");
        AssertNoWorldLabelText("STATION / HANGAR");

        string screenshotRoot = GetScreenshotRoot(WorldLabelReadabilityChangeName);
        Directory.CreateDirectory(screenshotRoot);
        PrototypePlayerHudSnapshot snapshot = CaptureLiveState(
            rig,
            screenshotRoot,
            "30-live-cruise-no-origin-label-1280x720.png",
            1280,
            720);
        Assert.That(snapshot.Arena.IsVisible, Is.True, "world-label readability cruise/objective snapshot");
        AssertPanelsSeparated(rig.PlayerHud, false);
    }

    private static LiveHudRig ResolveRig()
    {
        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship, "PrototypeShip");
        Camera camera = Camera.main;
        Assert.NotNull(camera, "Main Camera");

        var rig = new LiveHudRig
        {
            Ship = ship,
            Camera = camera,
            FollowCamera = camera.GetComponent<SimpleFollowCamera>(),
            PlayerHud = camera.GetComponent<PrototypePlayerHudRenderer>(),
            Body = ship.GetComponent<Rigidbody>(),
            Stats = ship.GetComponent<ShipStats>(),
            Controller = ship.GetComponent<PlayerShipController>(),
            Autopilot = ship.GetComponent<PrototypeWaypointAutopilot>(),
            WeaponComputer = ship.GetComponent<PrototypeWeaponComputer>(),
            ArenaLoop = Object.FindAnyObjectByType<PrototypePveArenaLoop>(),
            DockingAssist = ship.GetComponent<PrototypeDockingApproachAssist>()
        };

        Assert.NotNull(rig.FollowCamera, "SimpleFollowCamera");
        Assert.NotNull(rig.PlayerHud, "PrototypePlayerHudRenderer");
        Assert.NotNull(rig.Body, "Rigidbody");
        Assert.NotNull(rig.Stats, "ShipStats");
        Assert.NotNull(rig.Controller, "PlayerShipController");
        Assert.NotNull(rig.Autopilot, "PrototypeWaypointAutopilot");
        Assert.NotNull(rig.WeaponComputer, "PrototypeWeaponComputer");
        Assert.NotNull(rig.ArenaLoop, "PrototypePveArenaLoop");
        Assert.NotNull(rig.DockingAssist, "PrototypeDockingApproachAssist");
        return rig;
    }

    private static void ConfigureHudCanvasForCameraCapture(LiveHudRig rig)
    {
        Canvas canvas = rig.PlayerHud.GetComponentInChildren<Canvas>(true);
        Assert.NotNull(canvas, "PrototypePlayerHudCanvas");
        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = rig.Camera;
        canvas.planeDistance = 1f;
        Canvas.ForceUpdateCanvases();
    }

    private static PrototypePlayerHudSnapshot CaptureLiveState(
        LiveHudRig rig,
        string screenshotRoot,
        string fileName,
        int width,
        int height)
    {
        rig.PlayerHud.RefreshNow();
        rig.PlayerHud.ApplyResponsiveLayoutForTests(width, height);
        Canvas.ForceUpdateCanvases();
        string path = CaptureScreenshot(rig.Camera, screenshotRoot, fileName, width, height);
        Assert.That(File.Exists(path), Is.True, path);
        Assert.That(new FileInfo(path).Length, Is.GreaterThan(4096), path);
        return rig.PlayerHud.LastSnapshot;
    }

    private static string CaptureScreenshot(Camera camera, string screenshotRoot, string fileName, int width, int height)
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
            camera.Render();
            RenderTexture.active = renderTexture;
            texture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            texture.Apply(false);
            AssertRenderablePixels(texture, fileName);
            File.WriteAllBytes(path, texture.EncodeToPNG());
        }
        finally
        {
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

        return path;
    }

    private static void AssertRenderablePixels(Texture2D texture, string label)
    {
        Color32[] pixels = texture.GetPixels32();
        Assert.That(pixels.Length, Is.GreaterThan(0), label);

        Color32 first = pixels[pixels.Length / 2];
        int variedSamples = 0;
        int litSamples = 0;
        for (int i = 0; i < pixels.Length; i += 97)
        {
            Color32 pixel = pixels[i];
            int delta = Math.Abs(pixel.r - first.r) + Math.Abs(pixel.g - first.g) + Math.Abs(pixel.b - first.b);
            if (delta > 12)
            {
                variedSamples++;
            }

            if (pixel.r + pixel.g + pixel.b > 48)
            {
                litSamples++;
            }
        }

        Assert.That(variedSamples, Is.GreaterThan(12), label + " varied pixels");
        Assert.That(litSamples, Is.GreaterThan(12), label + " lit pixels");
    }

    private static void RunFrames(LiveHudRig rig, int frameCount)
    {
        for (int i = 0; i < frameCount; i++)
        {
            InvokeIfExists(rig.Controller, "Update");
            InvokeIfExists(rig.Autopilot, "Update");
            InvokeIfExists(rig.WeaponComputer, "Update");
            InvokeIfExists(rig.DockingAssist, "FixedUpdate");
            InvokeIfExists(rig.Autopilot, "FixedUpdate");
            InvokeIfExists(rig.Controller, "FixedUpdate");
            Physics.Simulate(Time.fixedDeltaTime);
            InvokeIfExists(rig.FollowCamera, "LateUpdate");
            rig.PlayerHud.RefreshNow();
        }
    }

    private static void SetHelpVisible(PrototypePlayerHudRenderer playerHud, bool visible)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("SetHelpVisible", NonPublicInstance);
        Assert.NotNull(method, "SetHelpVisible");
        method.Invoke(playerHud, new object[] { visible });
        Canvas.ForceUpdateCanvases();
    }

    private static void AssertHelpModal(PrototypePlayerHudRenderer playerHud)
    {
        GameObject helpPanel = (GameObject)GetPrivateField(playerHud, "helpPanel");
        Assert.NotNull(helpPanel, "helpPanel");
        Assert.That(helpPanel.activeSelf, Is.True, "help panel active");
        Assert.That(IsActive(playerHud, "ContextPanel"), Is.False, "help hides context");
        Assert.That(IsActive(playerHud, "RadarPanel"), Is.False, "help hides radar");
        Assert.That(IsActive(playerHud, "ShipSystems"), Is.False, "help hides ship systems");
        Assert.That(IsActive(playerHud, "ObjectivePanel"), Is.False, "help hides objective");

        RectTransform help = FindRect(playerHud, "PlayerHelp");
        RectTransform bottom = FindRect(playerHud, "FlightStatusBar");
        Assert.That(Overlaps(help, bottom), Is.False, "help does not overlap bottom bar");
    }

    private static void AssertPanelsSeparated(PrototypePlayerHudRenderer playerHud, bool helpVisible)
    {
        if (helpVisible)
        {
            AssertHelpModal(playerHud);
            AssertActiveHudRectsInsideCanvas(playerHud);
            return;
        }

        RectTransform top = FindRect(playerHud, "AlertAssistStrip");
        RectTransform bottom = FindRect(playerHud, "FlightStatusBar");
        RectTransform systems = FindRect(playerHud, "ShipSystems");
        RectTransform objective = FindRect(playerHud, "ObjectivePanel");
        RectTransform context = FindRect(playerHud, "ContextPanel");
        RectTransform radar = FindRect(playerHud, "RadarPanel");

        Assert.That(Overlaps(top, objective), Is.False, "top/objective overlap");
        Assert.That(Overlaps(top, radar), Is.False, "top/radar overlap");
        Assert.That(Overlaps(systems, bottom), Is.False, "systems/bottom overlap");
        Assert.That(Overlaps(objective, systems), Is.False, "objective/systems overlap");
        Assert.That(Overlaps(context, radar), Is.False, "context/radar overlap");
        Assert.That(Overlaps(context, bottom), Is.False, "context/bottom overlap");
        Assert.That(Overlaps(radar, bottom), Is.False, "radar/bottom overlap");
        AssertActiveHudRectsInsideCanvas(playerHud);
        AssertActiveControlRowsInsideContext(playerHud);
    }

    private static void AssertActiveHudRectsInsideCanvas(PrototypePlayerHudRenderer playerHud)
    {
        Canvas canvas = playerHud.GetComponentInChildren<Canvas>(true);
        Assert.NotNull(canvas, "PrototypePlayerHudCanvas");
        RectTransform canvasRect = canvas.GetComponent<RectTransform>();
        Assert.NotNull(canvasRect, "canvas rect");
        Rect canvasWorldRect = ToWorldRect(canvasRect);

        string[] fixedRects =
        {
            "AlertAssistStrip",
            "FlightStatusBar",
            "ShipSystems",
            "ObjectivePanel",
            "ContextPanel",
            "RadarPanel",
            "PlayerHelp",
            "TargetIndicatorLabel0",
            "TargetIndicatorLabel1",
            "TargetIndicatorLabel2",
            "TargetIndicatorLabel3",
            "TargetIndicatorLabel4",
            "TargetIndicatorLabel5"
        };

        for (int i = 0; i < fixedRects.Length; i++)
        {
            RectTransform rect = FindRect(playerHud, fixedRects[i]);
            if (rect == null || !rect.gameObject.activeInHierarchy)
            {
                continue;
            }

            AssertRectContains(canvasWorldRect, ToWorldRect(rect), fixedRects[i] + " inside canvas");
        }
    }

    private static void AssertActiveControlRowsInsideContext(PrototypePlayerHudRenderer playerHud)
    {
        RectTransform context = FindRect(playerHud, "ContextPanel");
        Rect contextRect = ToWorldRect(context);
        string[] rows = { "NavigationControls", "CombatControls" };

        for (int i = 0; i < rows.Length; i++)
        {
            RectTransform row = FindRect(playerHud, rows[i]);
            if (row == null || !row.gameObject.activeInHierarchy)
            {
                continue;
            }

            AssertRectContains(contextRect, ToWorldRect(row), rows[i] + " inside context panel");
        }
    }

    private static void AssertActiveButtonTextNotOverflowing(PrototypePlayerHudRenderer playerHud)
    {
        string[] buttonTextNames =
        {
            "KillMomentumText",
            "NavPreviousTargetText",
            "NavNextTargetText",
            "NavAutopilotText",
            "NavReplanText",
            "NavPreviewText",
            "CombatPreviousTargetText",
            "CombatNextTargetText",
            "CombatClearTargetText",
            "CombatAutoFireText",
            "CombatPriorityText"
        };

        for (int i = 0; i < buttonTextNames.Length; i++)
        {
            TMP_Text text = FindText(playerHud, buttonTextNames[i]);
            if (text == null || !text.gameObject.activeInHierarchy)
            {
                continue;
            }

            text.ForceMeshUpdate();
            Assert.That(text.isTextOverflowing, Is.False, buttonTextNames[i] + " overflow");
        }
    }

    private static void AssertRectContains(Rect outer, Rect inner, string message)
    {
        const float tolerance = 1.5f;
        Assert.That(inner.xMin, Is.GreaterThanOrEqualTo(outer.xMin - tolerance), message + " left");
        Assert.That(inner.yMin, Is.GreaterThanOrEqualTo(outer.yMin - tolerance), message + " bottom");
        Assert.That(inner.xMax, Is.LessThanOrEqualTo(outer.xMax + tolerance), message + " right");
        Assert.That(inner.yMax, Is.LessThanOrEqualTo(outer.yMax + tolerance), message + " top");
    }

    private static bool HasIndicator(PrototypePlayerHudSnapshot snapshot, PrototypePlayerTargetIndicatorKind kind)
    {
        PrototypePlayerTargetIndicator[] indicators = snapshot.TargetIndicators.Indicators;
        for (int i = 0; i < indicators.Length; i++)
        {
            if (indicators[i].Kind == kind)
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasRadarBlip(PrototypePlayerHudSnapshot snapshot, PrototypePlayerRadarBlipKind kind)
    {
        PrototypePlayerRadarBlip[] blips = snapshot.Radar.Blips;
        for (int i = 0; i < blips.Length; i++)
        {
            if (blips[i].Kind == kind)
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasWarning(PrototypePlayerHudSnapshot snapshot, string label)
    {
        PrototypePlayerHudChip[] warnings = snapshot.Warnings;
        for (int i = 0; i < warnings.Length; i++)
        {
            if (warnings[i].Label == label)
            {
                return true;
            }
        }

        return false;
    }

    private static void AssertNoWorldLabelText(string text)
    {
        TextMesh[] labels = Object.FindObjectsByType<TextMesh>(FindObjectsInactive.Include);
        for (int i = 0; i < labels.Length; i++)
        {
            if (labels[i] != null && labels[i].text == text)
            {
                Assert.Fail("Unexpected world label text in player evidence: " + text);
            }
        }
    }

    private static void InvokeIfExists(object target, string methodName)
    {
        if (target == null)
        {
            return;
        }

        MethodInfo method = target.GetType().GetMethod(methodName, NonPublicInstance);
        if (method != null)
        {
            method.Invoke(target, null);
        }
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static object GetPrivateField(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
        Assert.NotNull(field, fieldName);
        return field.GetValue(target);
    }

    private static bool IsActive(Component root, string objectName)
    {
        RectTransform rect = FindRect(root, objectName);
        return rect != null && rect.gameObject.activeSelf;
    }

    private static RectTransform FindRect(Component root, string objectName)
    {
        RectTransform[] rects = root.GetComponentsInChildren<RectTransform>(true);
        for (int i = 0; i < rects.Length; i++)
        {
            if (rects[i] != null && rects[i].gameObject.name == objectName)
            {
                return rects[i];
            }
        }

        Assert.Fail("Missing RectTransform: " + objectName);
        return null;
    }

    private static TMP_Text FindText(Component root, string objectName)
    {
        TMP_Text[] texts = root.GetComponentsInChildren<TMP_Text>(true);
        for (int i = 0; i < texts.Length; i++)
        {
            if (texts[i] != null && texts[i].gameObject.name == objectName)
            {
                return texts[i];
            }
        }

        Assert.Fail("Missing TMP_Text: " + objectName);
        return null;
    }

    private static bool Overlaps(RectTransform first, RectTransform second)
    {
        if (first == null || second == null || !first.gameObject.activeSelf || !second.gameObject.activeSelf)
        {
            return false;
        }

        return ToWorldRect(first).Overlaps(ToWorldRect(second));
    }

    private static Rect ToWorldRect(RectTransform rect)
    {
        Vector3[] corners = new Vector3[4];
        rect.GetWorldCorners(corners);
        float minX = Mathf.Min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
        float maxX = Mathf.Max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
        float minY = Mathf.Min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
        float maxY = Mathf.Max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
        return Rect.MinMaxRect(minX, minY, maxX, maxY);
    }

    private static string GetScreenshotRoot()
    {
        return GetScreenshotRoot(ChangeName);
    }

    private static string GetScreenshotRoot(string changeName)
    {
        string projectRoot = Directory.GetCurrentDirectory();
        if (!Directory.Exists(Path.Combine(projectRoot, "Assets")))
        {
            projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        }

        return Path.Combine(
            projectRoot,
            ".devtoolbox",
            "specs",
            "changes",
            changeName,
            "tests",
            "screenshots");
    }

    private static void CleanupRuntimeObjects()
    {
        DestroyNamed("PrototypePlayerHudLiveEvidenceHost");
        DestroyNamed("PrototypeBootstrapPlayModeHost");
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShipVisualSwitcher_Manager");
        DestroyNamed("PrototypeShipVisualSwitcher");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeDockingApproachTarget");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("PrototypePveArena");
        DestroyNamed("PrototypeTestEnvironment");
        DestroyNamed("PrototypeProjectileSimulation");
        DestroyNamed("PrototypeProjectile");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }

    private sealed class LiveHudRig
    {
        public GameObject Ship;
        public Camera Camera;
        public SimpleFollowCamera FollowCamera;
        public PrototypePlayerHudRenderer PlayerHud;
        public Rigidbody Body;
        public ShipStats Stats;
        public PlayerShipController Controller;
        public PrototypeWaypointAutopilot Autopilot;
        public PrototypeWeaponComputer WeaponComputer;
        public PrototypePveArenaLoop ArenaLoop;
        public PrototypeDockingApproachAssist DockingAssist;
    }
}
