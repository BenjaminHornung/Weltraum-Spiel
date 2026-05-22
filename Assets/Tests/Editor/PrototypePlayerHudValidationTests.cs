#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

public class PrototypePlayerHudValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeDockingApproachTarget");
        DestroyNamed("PrototypePlayerHudCamera");
        DestroyNamed("PlayerHudDockSource");
        DestroyNamed("PlayerHudDockTarget");
        DestroyNamed("PlayerHudCombatShip");
        DestroyNamed("PlayerHudWeaponComputer");
        DestroyNamed("PlayerHudDamageShip");
        DestroyNamed("PlayerHudDamagedRcs");
        DestroyNamed("PlayerHudMomentumShip");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("EventSystem");
        DestroyNamed("PrototypePlayerHudEventSystem");
    }

    [Test]
    public void SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudFlightShip");
            rig.Controller.SetControlMode(FlightControlMode.Translation);
            rig.Body.linearVelocity = rig.Ship.transform.forward * 37f;
            SetPrivateField(rig.Stats, "currentFuelKg", 12f);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                null,
                null,
                null,
                null,
                null);

            Assert.That(snapshot.Flight.SpeedMetersPerSecond, Is.EqualTo(37f).Within(0.01f));
            Assert.That(snapshot.Flight.ControlModeLabel, Is.EqualTo("Translation"));
            Assert.That(snapshot.Flight.ControlModeHint, Does.Contain("Translation disables main thrust"));
            Assert.That(snapshot.Flight.RcsLabel, Does.Contain("RCS"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Contain("Treibstoff niedrig"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Not.Contain("DES"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Not.Contain("residual"));
        }
    }

    [Test]
    public void NavigationSnapshotUsesFriendlyLabelsRouteAndAvoidanceWithoutPlannerDebugValues()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 220f);
            rig.Autopilot.EvaluateMetrics();

            PrototypeTrajectoryPlan plan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
            plan.predictedPath = new[]
            {
                rig.Ship.Ship.transform.position,
                rig.Ship.Ship.transform.position + Vector3.forward * 80f,
                rig.Autopilot.CurrentTarget.Position
            };
            plan.avoidanceActive = true;
            plan.avoidanceWaypoint = rig.Ship.Ship.transform.position + new Vector3(25f, 0f, 80f);
            plan.obstacleLabel = "Asteroid";
            SetAutoProperty(rig.Autopilot, "LastTrajectoryPlan", plan);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.Ship.transform,
                rig.Ship.Body,
                rig.Ship.Stats,
                rig.Ship.Controller,
                rig.Autopilot,
                null,
                null,
                null,
                null);

            Assert.True(snapshot.Navigation.Visible);
            Assert.That(snapshot.Navigation.TargetName, Is.EqualTo("HeadlessAutopilotTarget"));
            Assert.That(snapshot.Navigation.TargetTypeLabel, Is.EqualTo("Waypoint"));
            Assert.That(snapshot.Navigation.DistanceMeters, Is.GreaterThan(100f));
            Assert.That(snapshot.Navigation.PhaseLabel, Is.EqualTo("Direkter Kurs"));
            Assert.That(snapshot.Navigation.RouteWorldPoints.Length, Is.EqualTo(3));
            Assert.True(snapshot.Navigation.HasAvoidanceCue);
            Assert.That(snapshot.Navigation.AvoidanceLabel, Does.Contain("Asteroid"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("Candidate"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("requested"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.AlignForBurn), Is.EqualTo("Zum Schub ausrichten"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.FinalApproach), Is.EqualTo("Endanflug"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.Complete), Is.EqualTo("Angekommen"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.Failed), Is.EqualTo("Autopilot nicht moeglich"));
        }
    }

    [Test]
    public void CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak()
    {
        PrototypeTurretFireStatus outOfArc = PrototypeTurretFireStatus.Blocked(
            PrototypeTurretFireBlockReason.OutOfArc,
            "out of arc",
            requestedYawDegrees: 42f,
            requestedPitchDegrees: 11f,
            appliedYawDegrees: 12f,
            appliedPitchDegrees: 4f,
            distanceMeters: 320f,
            hasSelectedTarget: true);
        PrototypeTurretFireStatus cooldown = PrototypeTurretFireStatus.Blocked(
            PrototypeTurretFireBlockReason.Cooldown,
            "cooldown",
            cooldownRemainingSeconds: 0.4f,
            distanceMeters: 320f,
            hasSelectedTarget: true);

        string outOfArcLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(outOfArc);
        string cooldownLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(cooldown);

        Assert.That(outOfArcLabel, Is.EqualTo("Ausserhalb Feuerwinkel"));
        Assert.That(cooldownLabel, Is.EqualTo("Cooldown 0.4s"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Yaw"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Pitch"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Hit"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Projectile"));
    }

    [Test]
    public void CombatAutoFireNoTargetUsesPlayerLabelWithoutDebugTuning()
    {
        GameObject ship = new GameObject("PlayerHudCombatShip");
        GameObject computerObject = new GameObject("PlayerHudWeaponComputer");
        computerObject.transform.SetParent(ship.transform, false);
        PrototypeWeaponComputer computer = computerObject.AddComponent<PrototypeWeaponComputer>();
        computer.SetAutoFireEnabled(true);

        PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
            ship.transform,
            null,
            null,
            null,
            null,
            null,
            computer,
            null,
            null);

        Assert.True(snapshot.Combat.Visible);
        Assert.That(snapshot.Combat.TargetName, Is.EqualTo("No target"));
        Assert.That(snapshot.Combat.AutoFireLabel, Is.EqualTo("Auto Fire: No target"));
        Assert.That(snapshot.Combat.FireStatusLabel, Does.Not.Contain("HitChance"));
        Assert.That(snapshot.Combat.FireStatusLabel, Does.Not.Contain("Projectile"));
    }

    [Test]
    public void DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder()
    {
        GameObject sourceObject = new GameObject("PlayerHudDockSource");
        GameObject targetObject = new GameObject("PlayerHudDockTarget");
        sourceObject.AddComponent<Rigidbody>().useGravity = false;
        targetObject.AddComponent<Rigidbody>().useGravity = false;
        DockingPort source = sourceObject.AddComponent<DockingPort>();
        DockingPort target = targetObject.AddComponent<DockingPort>();
        source.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        target.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        sourceObject.transform.position = Vector3.zero;
        targetObject.transform.position = Vector3.forward * 0.2f;
        targetObject.transform.rotation = Quaternion.Euler(0f, 180f, 0f);

        PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
            sourceObject.transform,
            sourceObject.GetComponent<Rigidbody>(),
            null,
            null,
            null,
            null,
            null,
            source,
            target);

        Assert.True(snapshot.Docking.Visible);
        Assert.That(snapshot.Docking.StatusLabel, Is.EqualTo("Lock-Kriterien erfuellt"));
        Assert.That(snapshot.Docking.HardLockLabel, Is.EqualTo("Prototype: Hard Lock noch nicht verbunden"));
        Assert.True(snapshot.Docking.SoftCaptureRequested);
        Assert.That(snapshot.Docking.SoftCaptureLabel, Is.EqualTo("Soft Capture bereit"));
        Assert.That(snapshot.Docking.DistanceRatio, Is.LessThan(1f));
        Assert.That(snapshot.Docking.AngleRatio, Is.LessThan(1f));
        Assert.That(snapshot.Docking.SpeedRatio, Is.LessThan(1f));
        Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateDockingDiagnostic("relative-velocity-too-high"), Is.EqualTo("Anflug zu schnell"));
        Assert.That(snapshot.Docking.HardLockLabel, Does.Not.Contain("Docked"));
    }

    [Test]
    public void ShipStatusSummarizesWorstDamageAndReducedRcsWithoutRawInternals()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudDamageShip");
            GameObject rcsObject = new GameObject("PlayerHudDamagedRcs");
            rcsObject.transform.SetParent(rig.Controller.transform, false);
            PrototypeModuleDamageState damage = rcsObject.AddComponent<PrototypeModuleDamageState>();
            damage.Configure("RCS Block", 100f, 0.2f);
            damage.SetIntegrityFraction(0.5f);
            RcsThrusterBlock rcsBlock = rcsObject.AddComponent<RcsThrusterBlock>();
            rcsBlock.ConfigureDamageState(damage);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                null,
                null,
                null,
                null,
                null);

            Assert.That(snapshot.ShipStatus.DamageLabel, Does.Contain("1 modules damaged"));
            Assert.That(snapshot.ShipStatus.DamageLabel, Does.Contain("RCS Block 50%"));
            Assert.That(snapshot.ShipStatus.DamageLabel, Does.Contain("RCS thrust reduced"));
            Assert.That(snapshot.ShipStatus.DamageLabel, Does.Not.Contain("COM"));
            Assert.That(snapshot.ShipStatus.DamageLabel, Does.Not.Contain("inertia"));
        }
    }

    [Test]
    public void PlayerHelpExcludesDebugOnlyControlsByDefault()
    {
        string help = PrototypePlayerHudSnapshotBuilder.BuildPlayerHelpText(FlightControlMode.Translation, false);

        Assert.That(help, Does.Contain("W/S: translate forward/back"));
        Assert.That(help, Does.Contain("Space: fire"));
        Assert.That(help, Does.Contain("F1: player help"));
        Assert.That(help, Does.Not.Contain("Debug Console"));
        Assert.That(help, Does.Not.Contain("Flight Diagnostics"));
        Assert.That(help, Does.Not.Contain("DES/ACT/RES"));
        Assert.That(help, Does.Not.Contain("Backspace: refill fuel"));
        Assert.That(help, Does.Not.Contain("F6"));
        Assert.That(help, Does.Not.Contain("Keybinds"));
    }

    [Test]
    public void BootstrapBindsPlayerHudCanvasSeparateFromPrototypeWindows()
    {
        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildBuiltInVariant(0);

        Assert.NotNull(Camera.main);
        PrototypePlayerHudRenderer playerHud = Camera.main.GetComponent<PrototypePlayerHudRenderer>();
        Assert.NotNull(playerHud);
        Assert.NotNull(playerHud.GetComponentInChildren<Canvas>(true));
        Assert.NotNull(Camera.main.GetComponent<PrototypeFlightHud>());
        Assert.NotNull(Camera.main.GetComponent<PrototypeDebugOverlay>());
        var assist = GameObject.Find("PrototypeShip").GetComponent<PrototypeDockingApproachAssist>();
        Assert.NotNull(assist);
        Assert.False(assist.AssistEnabled);

        playerHud.RefreshNow();

        Assert.That(playerHud.LastSnapshot.Flight.FuelMaxKg, Is.GreaterThan(0f));
        Assert.That(playerHud.LastSnapshot.Flight.ControlModeLabel, Is.EqualTo("Cruise"));
        Assert.False(playerHud.LastSnapshot.Docking.Visible);
        Assert.That(Labels(playerHud.LastSnapshot.Warnings), Does.Not.Contain("Ausser Docking-Reichweite"));
        Assert.That(Labels(playerHud.LastSnapshot.Warnings), Does.Not.Contain("Docking n/a"));
    }

    [Test]
    public void ContextPriorityShowsCriticalCombatDockingNavigationObjectiveInOrder()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var combat = new PrototypePlayerCombatSnapshot(
            true,
            "Arena Target 01",
            0.45f,
            "45/100",
            320f,
            "Ready",
            PrototypePlayerHudSeverity.Info,
            "Auto Fire: Armed",
            "Nearest");
        var docking = CreateDockingSnapshot(true);
        var navigation = CreateNavigationSnapshot(true);
        var arena = new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 0, string.Empty);

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), docking, navigation, arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Docking: Docking Port A"));

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(combat, docking, navigation, arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Combat: Arena Target 01"));

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(combat, docking, navigation, arena, new[] { new PrototypePlayerHudChip("RCS nicht verfuegbar", PrototypePlayerHudSeverity.Danger) }));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Critical"));
        Assert.That(FindText(playerHud, "ContextBody").text, Is.EqualTo("RCS nicht verfuegbar"));

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), navigation, arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Navigation: Nav Beacon"));

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Objective: Clear the Arena"));
    }

    [Test]
    public void ObjectivePanelSeparatesArenaProgressFromShipSystems()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var arena = new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 1, string.Empty);
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), arena));

        Text systems = FindText(playerHud, "SystemsText");
        Text objectiveTitle = FindText(playerHud, "ObjectiveTitle");
        Text objectiveBody = FindText(playerHud, "ObjectiveBody");

        Assert.That(systems.text, Does.Contain("Fuel"));
        Assert.That(systems.text, Does.Not.Contain("Arena"));
        Assert.That(systems.text, Does.Not.Contain("Clear the Arena"));
        Assert.That(objectiveTitle.transform.parent.gameObject.activeSelf, Is.True);
        Assert.That(objectiveTitle.text, Is.EqualTo("Clear the Arena"));
        Assert.That(objectiveBody.text, Does.Contain("Targets 1/3"));
    }

    [Test]
    public void ResponsiveLayoutKeepsHudPanelsSeparatedAcrossAspectRatios()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        AssertNoPanelOverlap(playerHud, 2560, 1080);
        AssertNoPanelOverlap(playerHud, 1920, 1080);
        AssertNoPanelOverlap(playerHud, 1440, 900);
        AssertNoPanelOverlap(playerHud, 1280, 720);
        AssertNoPanelOverlap(playerHud, 1024, 768);
        AssertNoPanelOverlap(playerHud, 900, 1600);
        AssertNoPanelOverlap(playerHud, 800, 600);
        AssertNoPanelOverlap(playerHud, 640, 480);
    }

    [Test]
    public void RefreshRebindsGeneratedCanvasWithoutCreatingDuplicateHudWindows()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        SetPrivateField(playerHud, "canvas", null);
        SetPrivateField(playerHud, "canvasScaler", null);
        playerHud.RefreshNow();

        int canvasCount = 0;
        Canvas[] canvases = playerHud.GetComponentsInChildren<Canvas>(true);
        for (int i = 0; i < canvases.Length; i++)
        {
            if (canvases[i] != null && canvases[i].gameObject.name == "PrototypePlayerHudCanvas")
            {
                canvasCount++;
            }
        }

        Assert.That(canvasCount, Is.EqualTo(1));
    }

    [Test]
    public void PlayerHudDoesNotRenderSecondImguiRadarPath()
    {
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypePlayerHud.cs"));

        Assert.That(source, Does.Not.Contain("private void OnGUI()"));
        Assert.That(source, Does.Not.Contain("DrawRadarGui(new Rect"));
    }

    [Test]
    public void ExistingEventSystemReceivesCompatibleInputModuleWithoutDuplicateEventSystem()
    {
        GameObject existingEventSystemObject = new GameObject("EventSystem");
        EventSystem existingEventSystem = existingEventSystemObject.AddComponent<EventSystem>();
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();

        playerHud.RefreshNow();

        Assert.NotNull(existingEventSystem.GetComponent<InputSystemUIInputModule>());
        Assert.Null(GameObject.Find("PrototypePlayerHudEventSystem"));
    }

    [Test]
    public void KillMomentumButtonActivatesIdleAbortsActiveAndDisablesUnavailable()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudMomentumShip");
            PrototypeMomentumAssist assist = rig.Ship.GetComponent<PrototypeMomentumAssist>();
            if (assist == null)
            {
                assist = rig.Ship.AddComponent<PrototypeMomentumAssist>();
            }

            assist.Bind(rig.Controller, rig.Body, rig.Stats);
            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(rig.Ship.transform, rig.Stats, rig.Body);
            SetPrivateField(playerHud, "momentumAssist", assist);
            playerHud.RefreshNow();

            Button button = FindButton(playerHud, "KillMomentum");
            Text label = FindText(playerHud, "KillMomentumText");
            Assert.True(button.interactable);
            Assert.That(label.text, Is.EqualTo("Kill Momentum"));

            SetPrivateField(assist, "isActive", true);
            SetPrivateField(assist, "currentState", PrototypeMomentumAssistState.MainBrake);
            playerHud.RefreshNow();

            Assert.True(button.interactable);
            Assert.That(label.text, Is.EqualTo("Abort Assist"));
            button.onClick.Invoke();
            Assert.False(assist.IsActive);
            Assert.That(assist.CurrentState, Is.EqualTo(PrototypeMomentumAssistState.Aborted));

            SetPrivateField(assist, "currentState", PrototypeMomentumAssistState.NoAuthority);
            playerHud.RefreshNow();

            Assert.False(button.interactable);
            Assert.That(label.text, Is.EqualTo("No Authority"));
        }
    }

    [Test]
    public void WarningChipsAreUniqueAndDangerSeverityWinsPriority()
    {
        PrototypePlayerCombatSnapshot combat = new PrototypePlayerCombatSnapshot(
            true,
            "Target",
            1f,
            "100/100",
            25f,
            "Shared Alert",
            PrototypePlayerHudSeverity.Danger,
            "Auto Fire: Waiting",
            "ManualOrder");
        PrototypePlayerDockingSnapshot docking = new PrototypePlayerDockingSnapshot(
            true,
            "Dock",
            1f,
            0f,
            0f,
            0f,
            Vector2.zero,
            "Shared Alert",
            PrototypePlayerHudSeverity.Warning,
            "Prototype: Hard Lock noch nicht verbunden",
            false,
            string.Empty,
            false,
            "Assist inaktiv",
            0f,
            0f,
            0f);
        MethodInfo method = typeof(PrototypePlayerHudSnapshotBuilder).GetMethod("BuildWarningChips", BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        var chips = (PrototypePlayerHudChip[])method.Invoke(null, new object[] { null, null, null, null, combat, docking });

        int sharedCount = 0;
        for (int i = 0; i < chips.Length; i++)
        {
            if (chips[i].Label == "Shared Alert")
            {
                sharedCount++;
            }
        }

        Assert.That(sharedCount, Is.EqualTo(1));
        Assert.That(chips[0].Label, Is.EqualTo("Shared Alert"));
        Assert.That(chips[0].Severity, Is.EqualTo(PrototypePlayerHudSeverity.Danger));
    }

    [Test]
    public void WarningStripDoesNotDuplicateAssistChipWhenWarningsAreEmpty()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudMomentumShip");
            PrototypeMomentumAssist assist = rig.Ship.GetComponent<PrototypeMomentumAssist>();
            if (assist == null)
            {
                assist = rig.Ship.AddComponent<PrototypeMomentumAssist>();
            }

            assist.Bind(rig.Controller, rig.Body, rig.Stats);
            SetPrivateField(assist, "isActive", true);
            SetPrivateField(assist, "currentState", PrototypeMomentumAssistState.MainBrake);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                null,
                assist,
                null,
                null,
                null);
            MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("BuildWarningStrip", BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(method);

            string strip = (string)method.Invoke(null, new object[] { snapshot });

            Assert.That(snapshot.Warnings.Length, Is.EqualTo(0));
            Assert.That(snapshot.AssistChips.Length, Is.GreaterThan(0));
            Assert.That(strip, Is.EqualTo("Flight nominal"));
            Assert.That(strip, Is.Not.EqualTo(snapshot.AssistChips[0].Label));
        }
    }

    private static PrototypePlayerHudSnapshot CreateHudSnapshot(
        PrototypePlayerCombatSnapshot combat,
        PrototypePlayerDockingSnapshot docking,
        PrototypePlayerNavigationSnapshot navigation,
        PrototypePveArenaSnapshot arena,
        PrototypePlayerHudChip[] warnings = null)
    {
        return new PrototypePlayerHudSnapshot(
            new PrototypePlayerFlightSnapshot(0f, 0f, 100f, 100f, "Cruise", string.Empty, "Main ready", "RCS ready", "SAS on"),
            navigation,
            combat,
            arena,
            docking,
            new PrototypePlayerShipStatusSnapshot("Fuel 100%", "Main ready", "RCS ready", "SAS on", "Weapon standby", "Modules nominal"),
            warnings ?? new PrototypePlayerHudChip[0],
            new PrototypePlayerHudChip[0],
            default,
            Vector3.zero,
            Vector3.forward,
            null,
            null);
    }

    private static PrototypePlayerCombatSnapshot CreateCombatSnapshot(bool visible)
    {
        return new PrototypePlayerCombatSnapshot(
            visible,
            visible ? "Arena Target 01" : "No target",
            visible ? 0.45f : 0f,
            visible ? "45/100" : "--",
            visible ? 320f : 0f,
            visible ? "Ready" : "Weapon standby",
            visible ? PrototypePlayerHudSeverity.Info : PrototypePlayerHudSeverity.Disabled,
            visible ? "Auto Fire: Armed" : "Auto Fire: Off",
            "ManualOrder");
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
            "Lock-Kriterien erfuellt",
            PrototypePlayerHudSeverity.Info,
            "Prototype: Hard Lock noch nicht verbunden",
            true,
            "Soft Capture bereit",
            visible,
            visible ? "Soft Capture Assist aktiv" : "Assist inaktiv",
            0.2f,
            0.2f,
            0.2f);
    }

    private static PrototypePlayerNavigationSnapshot CreateNavigationSnapshot(bool visible)
    {
        return new PrototypePlayerNavigationSnapshot(
            visible,
            visible ? "Nav Beacon" : "No target",
            "Waypoint",
            visible ? 840f : 0f,
            0f,
            0f,
            0f,
            "--",
            "Ziel gewaehlt",
            "Direkter Kurs",
            new string[0],
            new Vector3[0],
            PrototypeTrajectoryPreviewSnapshot.Unavailable("Trajectory Preview", 0, 0f),
            false,
            Vector3.zero,
            string.Empty);
    }

    private static void ApplySnapshotForTest(PrototypePlayerHudRenderer playerHud, PrototypePlayerHudSnapshot snapshot)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("ApplySnapshot", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(playerHud, new object[] { snapshot });
        Canvas.ForceUpdateCanvases();
    }

    private static string[] Labels(PrototypePlayerHudChip[] chips)
    {
        string[] labels = new string[chips.Length];
        for (int i = 0; i < chips.Length; i++)
        {
            labels[i] = chips[i].Label;
        }

        return labels;
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetAutoProperty(object target, string propertyName, object value)
    {
        FieldInfo field = target.GetType().GetField("<" + propertyName + ">k__BackingField", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, propertyName);
        field.SetValue(target, value);
    }

    private static void AssertNoPanelOverlap(PrototypePlayerHudRenderer playerHud, int width, int height)
    {
        playerHud.ApplyResponsiveLayoutForTests(width, height);
        Canvas.ForceUpdateCanvases();

        RectTransform bottom = FindRect(playerHud, "FlightStatusBar");
        RectTransform systems = FindRect(playerHud, "ShipSystems");
        RectTransform objective = FindRect(playerHud, "ObjectivePanel");
        RectTransform context = FindRect(playerHud, "ContextPanel");
        RectTransform radar = FindRect(playerHud, "RadarPanel");
        RectTransform top = FindRect(playerHud, "AlertAssistStrip");
        RectTransform throttle = FindRect(playerHud, "ThrottleBarBackground");
        RectTransform fuel = FindRect(playerHud, "FuelBarBackground");
        RectTransform mode = FindRect(playerHud, "Mode");
        RectTransform rcs = FindRect(playerHud, "Rcs");
        RectTransform sas = FindRect(playerHud, "Sas");
        RectTransform killMomentum = FindRect(playerHud, "KillMomentum");
        RectTransform primaryWarning = FindRect(playerHud, "PrimaryWarning");
        RectTransform assist1 = FindRect(playerHud, "AssistChip1");
        RectTransform assist2 = FindRect(playerHud, "AssistChip2");
        RectTransform assist3 = FindRect(playerHud, "AssistChip3");
        RectTransform objectiveTitle = FindRect(playerHud, "ObjectiveTitle");
        RectTransform objectiveBody = FindRect(playerHud, "ObjectiveBody");
        objective.gameObject.SetActive(true);
        Canvas.ForceUpdateCanvases();

        Assert.False(Overlaps(bottom, systems), width + "x" + height + " bottom/systems");
        Assert.False(Overlaps(bottom, context), width + "x" + height + " bottom/context");
        Assert.False(Overlaps(bottom, objective), width + "x" + height + " bottom/objective");
        Assert.False(Overlaps(systems, context), width + "x" + height + " systems/context");
        Assert.False(Overlaps(systems, objective), width + "x" + height + " systems/objective");
        Assert.False(Overlaps(objective, context), width + "x" + height + " objective/context");
        Assert.False(Overlaps(context, radar), width + "x" + height + " context/radar");
        Assert.False(Overlaps(top, radar), width + "x" + height + " top/radar");
        Assert.False(Overlaps(top, objective), width + "x" + height + " top/objective");
        Assert.False(Overlaps(objective, radar), width + "x" + height + " objective/radar");
        Assert.False(Overlaps(throttle, fuel), width + "x" + height + " throttle/fuel");
        Assert.False(Overlaps(fuel, rcs), width + "x" + height + " fuel/rcs");
        Assert.False(Overlaps(rcs, sas), width + "x" + height + " rcs/sas");
        Assert.False(Overlaps(mode, killMomentum), width + "x" + height + " mode/button");
        Assert.False(Overlaps(sas, killMomentum), width + "x" + height + " sas/button");
        Assert.False(Overlaps(primaryWarning, assist1), width + "x" + height + " warning/assist1");
        Assert.False(Overlaps(primaryWarning, assist2), width + "x" + height + " warning/assist2");
        Assert.False(Overlaps(primaryWarning, assist3), width + "x" + height + " warning/assist3");
        Assert.False(Overlaps(objectiveTitle, objectiveBody), width + "x" + height + " objective title/body");
    }

    private static RectTransform FindRect(PrototypePlayerHudRenderer playerHud, string objectName)
    {
        RectTransform[] rects = playerHud.GetComponentsInChildren<RectTransform>(true);
        for (int i = 0; i < rects.Length; i++)
        {
            if (rects[i].gameObject.name == objectName)
            {
                return rects[i];
            }
        }

        Assert.Fail("Missing rect " + objectName);
        return null;
    }

    private static Button FindButton(PrototypePlayerHudRenderer playerHud, string objectName)
    {
        Button[] buttons = playerHud.GetComponentsInChildren<Button>(true);
        for (int i = 0; i < buttons.Length; i++)
        {
            if (buttons[i].gameObject.name == objectName)
            {
                return buttons[i];
            }
        }

        Assert.Fail("Missing button " + objectName);
        return null;
    }

    private static Text FindText(PrototypePlayerHudRenderer playerHud, string objectName)
    {
        Text[] texts = playerHud.GetComponentsInChildren<Text>(true);
        for (int i = 0; i < texts.Length; i++)
        {
            if (texts[i].gameObject.name == objectName)
            {
                return texts[i];
            }
        }

        Assert.Fail("Missing text " + objectName);
        return null;
    }

    private static bool Overlaps(RectTransform a, RectTransform b)
    {
        Rect rectA = WorldRect(a);
        Rect rectB = WorldRect(b);
        return rectA.xMin < rectB.xMax
            && rectA.xMax > rectB.xMin
            && rectA.yMin < rectB.yMax
            && rectA.yMax > rectB.yMin;
    }

    private static Rect WorldRect(RectTransform rect)
    {
        Vector3[] corners = new Vector3[4];
        rect.GetWorldCorners(corners);
        return Rect.MinMaxRect(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
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
