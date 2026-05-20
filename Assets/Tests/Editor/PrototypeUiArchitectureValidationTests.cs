#if UNITY_EDITOR
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

public class PrototypeUiArchitectureValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeUiLayoutManager.ClearWindowsForTests();
        DestroyNamed("UiArchitectureShip");
        DestroyNamed("UiArchitectureTarget");
        DestroyNamed("UiArchitectureCamera");
    }

    [Test]
    public void HudViewModelBuildsStatusAutopilotAndMomentumWithoutOnGui()
    {
        GameObject ship = new GameObject("UiArchitectureShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        PlayerShipController controller = AddFlightControllerDependencies(ship);
        PrototypeWaypointAutopilot autopilot = ship.AddComponent<PrototypeWaypointAutopilot>();
        PrototypeMomentumAssist momentumAssist = ship.AddComponent<PrototypeMomentumAssist>();
        GameObject target = new GameObject("UiArchitectureTarget");
        target.transform.position = ship.transform.position + new Vector3(0f, 0f, 100f);

        controller.SetControlMode(FlightControlMode.Precision);
        rb.linearVelocity = ship.transform.forward * 42f;

        PrototypeHudViewModel viewModel = PrototypeHudViewModelBuilder.Build(
            ship.transform,
            rb,
            controller,
            stats,
            target.transform,
            autopilot,
            momentumAssist,
            false,
            false,
            88f,
            0.05f,
            9000f,
            PrototypeFlightHud.HudMode.World);

        Assert.True(viewModel.HasVelocityMarker);
        Assert.True(viewModel.HasTargetMarker);
        Assert.That(viewModel.Status.SpeedMetersPerSecond, Is.EqualTo(42f).Within(0.01f));
        Assert.That(viewModel.Autopilot.TargetName, Is.EqualTo("none"));
        Assert.True(viewModel.MomentumAssist.IsAvailable);
        Assert.That(viewModel.ControlModeHint, Is.EqualTo("Mode: Precision"));
    }

    [Test]
    public void KeybindViewModelContainsCruisePrecisionTranslationDifferencesAndGermanFullThrottle()
    {
        PrototypeKeybindViewModel cruise = PrototypeKeybindViewModelBuilder.Build(FlightControlMode.Normal);
        PrototypeKeybindViewModel precision = PrototypeKeybindViewModelBuilder.Build(FlightControlMode.Precision);
        PrototypeKeybindViewModel translation = PrototypeKeybindViewModelBuilder.Build(FlightControlMode.Translation);

        AssertModeContains(cruise, FlightControlMode.Normal, "W/S: pitch");
        AssertModeContains(cruise, FlightControlMode.Normal, "Y/Z: full throttle");
        AssertModeContains(precision, FlightControlMode.Precision, "W/S: pitch via RCS");
        AssertModeContains(translation, FlightControlMode.Translation, "W/S: translate forward/back");
        AssertModeContains(translation, FlightControlMode.Translation, "A/D: translate left/right");
    }

    [Test]
    public void LayoutResetKeepsVisibleWindowsInsideBoundsAndAvoidsOverlap()
    {
        Rect bounds = new Rect(0f, 0f, 1280f, 720f);
        PrototypeUiLayoutManager.ClearWindowsForTests();
        PrototypeUiLayoutManager.GetWindowForTests(PrototypeUiLayoutManager.HudWindowId, new Rect(0f, 0f, 320f, 300f), true, false, bounds);
        PrototypeUiLayoutManager.GetWindowForTests(PrototypeUiLayoutManager.MinimapWindowId, new Rect(0f, 0f, 260f, 260f), true, false, bounds);
        PrototypeUiLayoutManager.GetWindowForTests(PrototypeUiLayoutManager.DiagnosticsWindowId, new Rect(0f, 0f, 360f, 260f), true, false, bounds);
        PrototypeUiLayoutManager.GetWindowForTests(PrototypeUiLayoutManager.KeybindWindowId, new Rect(0f, 0f, 320f, 260f), true, false, bounds);
        PrototypeUiLayoutManager.GetWindowForTests(PrototypeUiLayoutManager.DebugConsoleWindowId, new Rect(0f, 0f, 340f, 250f), true, false, bounds);

        PrototypeUiLayoutManager.ResetLayout(bounds);

        var visibleRects = new List<Rect>();
        foreach (PrototypeUiWindowState state in PrototypeUiLayoutManager.WindowsForTests)
        {
            if (!state.Visible)
            {
                continue;
            }

            Assert.That(state.Rect.xMin, Is.GreaterThanOrEqualTo(bounds.xMin));
            Assert.That(state.Rect.yMin, Is.GreaterThanOrEqualTo(bounds.yMin));
            Assert.That(state.Rect.xMax, Is.LessThanOrEqualTo(bounds.xMax));
            Assert.That(state.Rect.yMax, Is.LessThanOrEqualTo(bounds.yMax));
            for (int i = 0; i < visibleRects.Count; i++)
            {
                Assert.False(state.Rect.Overlaps(visibleRects[i]), $"{state.Id} overlaps window {i}");
            }

            visibleRects.Add(state.Rect);
        }
    }

    [Test]
    public void UiPresetsDoNotMutateFlightControlValues()
    {
        GameObject ship = new GameObject("UiArchitectureShip");
        ship.AddComponent<Rigidbody>();
        ship.AddComponent<ShipStats>();
        PlayerShipController controller = AddFlightControllerDependencies(ship);
        controller.SetControlMode(FlightControlMode.Translation);
        controller.SetSasEnabled(false);
        controller.SetMainThrottle(0.35f);

        GameObject cameraObject = new GameObject("UiArchitectureCamera");
        cameraObject.AddComponent<Camera>();
        var diagnostics = cameraObject.AddComponent<PrototypeDebugOverlay>();
        var console = cameraObject.AddComponent<PrototypeFlightDebugConsole>();
        var hud = cameraObject.AddComponent<PrototypeFlightHud>();
        var keybinds = cameraObject.AddComponent<PrototypeKeybindOverlay>();
        var minimap = cameraObject.AddComponent<PrototypeMinimapOverlay>();
        hud.Bind(ship.transform, ship.GetComponent<ShipStats>(), ship.GetComponent<Rigidbody>());
        keybinds.Bind(ship.transform);

        FlightControlMode initialMode = controller.ControlMode;
        bool initialSas = controller.SasEnabled;
        float initialThrottle = controller.MainThrottle;

        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.Basic, diagnostics, console, hud, keybinds, minimap);
        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.RcsTest, diagnostics, console, hud, keybinds, minimap);
        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.FullDiagnostics, diagnostics, console, hud, keybinds, minimap);

        Assert.That(controller.ControlMode, Is.EqualTo(initialMode));
        Assert.That(controller.SasEnabled, Is.EqualTo(initialSas));
        Assert.That(controller.MainThrottle, Is.EqualTo(initialThrottle).Within(0.001f));
    }

    private static void AssertModeContains(PrototypeKeybindViewModel viewModel, FlightControlMode mode, string expectedLine)
    {
        foreach (PrototypeKeybindModeBindingViewModel binding in viewModel.ModeBindings)
        {
            if (binding.Mode != mode)
            {
                continue;
            }

            CollectionAssert.Contains(binding.Differences, expectedLine);
            return;
        }

        Assert.Fail("Mode not found: " + mode);
    }

    private static PlayerShipController AddFlightControllerDependencies(GameObject ship)
    {
        Rigidbody rb = ship.GetComponent<Rigidbody>();
        if (rb == null)
        {
            rb = ship.AddComponent<Rigidbody>();
        }

        ShipStats stats = ship.GetComponent<ShipStats>();
        if (stats == null)
        {
            stats = ship.AddComponent<ShipStats>();
        }

        ShipPhysicsCore core = ship.AddComponent<ShipPhysicsCore>();
        MainThrusterBank mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<RcsThrusterController>();
        ship.AddComponent<GunModule>();
        core.Configure(rb);
        mainThruster.Configure(new MainThrusterModule[0], rb, stats, core);
        return ship.AddComponent<PlayerShipController>();
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif
