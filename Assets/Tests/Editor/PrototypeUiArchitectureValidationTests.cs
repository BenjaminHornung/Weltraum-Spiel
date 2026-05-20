#if UNITY_EDITOR
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

public class PrototypeUiArchitectureValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeUiWindowState.SetPrefsStorageForTests(null);
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
    public void WindowStateDoesNotPersistUnchangedRepaintState()
    {
        var storage = new TestPrefsStorage();
        PrototypeUiWindowState.SetPrefsStorageForTests(storage);
        var state = new PrototypeUiWindowState("ui-perf-no-dirty", new Rect(10f, 20f, 300f, 200f), true, false, true);

        Assert.False(state.IsDirty);
        Assert.False(state.TrySaveToPrefsThrottled(0f, false));
        Assert.That(storage.WriteCount, Is.EqualTo(0));

        state.Visible = false;

        Assert.True(state.IsDirty);
        Assert.True(state.TrySaveToPrefsThrottled(1f, false));
        Assert.False(state.IsDirty);
        Assert.That(storage.WriteCount, Is.EqualTo(6));

        Assert.False(state.TrySaveToPrefsThrottled(2f, false));
        Assert.That(storage.WriteCount, Is.EqualTo(6));
    }

    [Test]
    public void WindowStateMarksDirtyForVisibilityCollapsedAndRectChanges()
    {
        var storage = new TestPrefsStorage();
        PrototypeUiWindowState.SetPrefsStorageForTests(storage);
        var state = new PrototypeUiWindowState("ui-perf-dirty", new Rect(10f, 20f, 300f, 200f), true, false, true);

        state.Visible = false;
        Assert.True(state.IsDirty);
        Assert.True(state.TrySaveToPrefsThrottled(1f, false));

        state.Collapsed = true;
        Assert.True(state.IsDirty);
        Assert.False(state.TrySaveToPrefsThrottled(1.1f, false));
        Assert.True(state.IsDirty);
        Assert.True(state.TrySaveToPrefsThrottled(1.8f, false));

        Rect moved = state.Rect;
        moved.x += 24f;
        state.Rect = moved;
        Assert.True(state.IsDirty);
    }

    [Test]
    public void DiagnosticsSamplingLimitsRefreshCadence()
    {
        GameObject ship = new GameObject("UiArchitectureShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        AddFlightControllerDependencies(ship);
        GameObject cameraObject = new GameObject("UiArchitectureCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeDebugOverlay overlay = cameraObject.AddComponent<PrototypeDebugOverlay>();
        overlay.Bind(ship.transform, stats, rb);
        overlay.SetAdvancedDiagnostics(true);

        overlay.RefreshVisibleDiagnosticsForTests(0f);
        overlay.RefreshVisibleDiagnosticsForTests(0.1f);
        overlay.RefreshVisibleDiagnosticsForTests(0.25f);

        Assert.That(overlay.HeavyDiagnosticsSampleCountForTests, Is.EqualTo(2));
    }

    [Test]
    public void CollapsedDebugOverlayDoesNotCollectHeavyDiagnostics()
    {
        GameObject ship = new GameObject("UiArchitectureShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        AddFlightControllerDependencies(ship);
        GameObject module = new GameObject("UiArchitectureShipModule");
        module.transform.SetParent(ship.transform, false);
        module.AddComponent<PrototypeModuleDamageState>();
        GameObject cameraObject = new GameObject("UiArchitectureCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeDebugOverlay overlay = cameraObject.AddComponent<PrototypeDebugOverlay>();
        overlay.Bind(ship.transform, stats, rb);
        overlay.SetAdvancedDiagnostics(true);
        overlay.SetDamageDiagnosticsExpandedForTests(true);
        overlay.SetWindowCollapsed(true);

        overlay.RefreshVisibleDiagnosticsForTests(0f);

        Assert.That(overlay.HeavyDiagnosticsSampleCountForTests, Is.EqualTo(0));
        Assert.That(overlay.DamageDiagnosticsSampleCountForTests, Is.EqualTo(0));
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

    [Test]
    public void FlightTestPresetKeepsDebugConsoleAndWeaponComputerClosed()
    {
        GameObject cameraObject = new GameObject("UiArchitectureCamera");
        cameraObject.AddComponent<Camera>();
        var diagnostics = cameraObject.AddComponent<PrototypeDebugOverlay>();
        var console = cameraObject.AddComponent<PrototypeFlightDebugConsole>();
        var hud = cameraObject.AddComponent<PrototypeFlightHud>();
        var keybinds = cameraObject.AddComponent<PrototypeKeybindOverlay>();
        var minimap = cameraObject.AddComponent<PrototypeMinimapOverlay>();
        var weaponComputer = cameraObject.AddComponent<PrototypeWeaponComputerPanel>();

        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.FlightTest, diagnostics, console, hud, keybinds, minimap, weaponComputer);

        Assert.True(diagnostics.IsWindowVisible);
        Assert.True(hud.ShowHud);
        Assert.True(minimap.IsWindowVisible);
        Assert.False(minimap.ShowLabels);
        Assert.False(console.IsConsoleVisible);
        Assert.False(weaponComputer.IsWindowVisible);

        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.FullDiagnostics, diagnostics, console, hud, keybinds, minimap, weaponComputer);

        Assert.True(console.IsConsoleVisible);
        Assert.True(weaponComputer.IsWindowVisible);
        Assert.True(minimap.ShowLabels);
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

    private sealed class TestPrefsStorage : IPrototypeUiPrefsStorage
    {
        private readonly Dictionary<string, float> floats = new Dictionary<string, float>();
        private readonly Dictionary<string, int> ints = new Dictionary<string, int>();

        public int WriteCount { get; private set; }
        public int DeleteCount { get; private set; }

        public float GetFloat(string key, float defaultValue)
        {
            return floats.TryGetValue(key, out float value) ? value : defaultValue;
        }

        public int GetInt(string key, int defaultValue)
        {
            return ints.TryGetValue(key, out int value) ? value : defaultValue;
        }

        public void SetFloat(string key, float value)
        {
            floats[key] = value;
            WriteCount++;
        }

        public void SetInt(string key, int value)
        {
            ints[key] = value;
            WriteCount++;
        }

        public void DeleteKey(string key)
        {
            floats.Remove(key);
            ints.Remove(key);
            DeleteCount++;
        }
    }
}
#endif
