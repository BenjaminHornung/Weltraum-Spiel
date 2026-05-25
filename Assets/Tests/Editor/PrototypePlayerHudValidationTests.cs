#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using NUnit.Framework;
using TMPro;
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
        PrototypeNavigationObstacleRegistry.ClearForTests();
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeDockingApproachTarget");
        DestroyNamed("PrototypePlayerHudCamera");
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("PrototypeEnvironment");
        DestroyNamed("PlayerHudDockSource");
        DestroyNamed("PlayerHudDockTarget");
        DestroyNamed("PlayerHudRadarArena");
        DestroyNamed("PlayerHudRadarDockTarget");
        DestroyNamed("PlayerHudRadarEnvironment");
        DestroyNamed("PlayerHudRadarMidZoomTarget");
        DestroyNamed("PlayerHudRadarMidZoomWaypointManager");
        DestroyNamed("PlayerHudRadarSceneWaypoint");
        DestroyNamed("PlayerHudRadarWaypointManager");
        DestroyNamed("PlayerHudNavManager");
        DestroyNamed("PlayerHudIndicatorShip");
        DestroyNamed("PlayerHudIndicatorWaypointManager");
        DestroyNamed("PlayerHudIndicatorCombatTarget");
        DestroyNamed("PlayerHudIndicatorDockTarget");
        DestroyNamed("PlayerHudIndicatorArena");
        DestroyNamed("PlayerHudIndicatorProjectionCamera");
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
            Assert.That(snapshot.Flight.ControlModeHint, Is.EqualTo("Translation: main off; W/S + A/D translate."));
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
            Assert.That(snapshot.Navigation.RouteModeLabel, Is.EqualTo("Route: Ausweichkurs"));
            Assert.That(snapshot.Navigation.ManeuverIntentLabel, Is.EqualTo("Manoever: Ausweichkurs geplant"));
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
    public void NavigationSnapshotDescribesFlipAndMainDecelBurnIntent()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 150f);
            rig.Ship.Body.linearVelocity = Vector3.forward * 45f;
            rig.Autopilot.ToggleAutopilot();

            InvokeFixedUpdate(rig.Autopilot);

            PrototypePlayerHudSnapshot flipSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.Ship.transform,
                rig.Ship.Body,
                rig.Ship.Stats,
                rig.Ship.Controller,
                rig.Autopilot,
                null,
                null,
                null,
                null);

            Assert.That(flipSnapshot.Navigation.ManeuverIntentLabel, Is.EqualTo("Manoever: Zum Bremsen drehen"));
            Assert.That(flipSnapshot.Navigation.StoppingDistanceMeters, Is.GreaterThan(0f));
            Assert.That(flipSnapshot.Navigation.RequiredBurnSeconds, Is.GreaterThan(0f));
            Assert.That(rig.Ship.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(0.0001f));

            rig.Ship.Ship.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
            InvokeFixedUpdate(rig.Autopilot);

            PrototypePlayerHudSnapshot brakeSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.Ship.transform,
                rig.Ship.Body,
                rig.Ship.Stats,
                rig.Ship.Controller,
                rig.Autopilot,
                null,
                null,
                null,
                null);

            Assert.That(brakeSnapshot.Navigation.ManeuverIntentLabel, Is.EqualTo("Manoever: Main-Decel-Burn"));
            Assert.That(rig.Ship.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0.5f));
        }
    }

    [Test]
    public void RadarSnapshotCollectsGameplayBlipsRoutePreviewAndHazards()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeCombatRig combatRig = builder.CreateCombatRig("PlayerHudRadarShip");
            GameObject managerObject = new GameObject("PlayerHudRadarWaypointManager");
            PrototypeWaypointManager manager = managerObject.AddComponent<PrototypeWaypointManager>();
            manager.EnsureDefaultWaypoints();

            PrototypeWaypointAutopilot autopilot = combatRig.Ship.Ship.AddComponent<PrototypeWaypointAutopilot>();
            autopilot.Bind(manager, combatRig.Ship.Controller, combatRig.Ship.Stats, combatRig.Ship.Body);
            autopilot.SelectTarget(FindNavigationTargetByName(manager, "Nav Waypoint 1"));

            PrototypeTrajectoryPlan plan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
            plan.predictedPath = new[]
            {
                combatRig.Ship.Ship.transform.position,
                combatRig.Ship.Ship.transform.position + Vector3.forward * 120f,
                combatRig.Ship.Ship.transform.position + Vector3.forward * 260f
            };
            plan.avoidanceActive = true;
            plan.avoidanceWaypoint = combatRig.Ship.Ship.transform.position + new Vector3(42f, 0f, 140f);
            plan.obstacleLabel = "Radar Hazard";
            SetAutoProperty(autopilot, "LastTrajectoryPlan", plan);

            PrototypeTrajectoryPreviewNavMap preview = combatRig.Ship.Ship.AddComponent<PrototypeTrajectoryPreviewNavMap>();
            preview.ConfigureForTests(true, 4, 10, 0.1f, false, true);
            preview.Bind(combatRig.Ship.Ship.transform, combatRig.Ship.Body, combatRig.Ship.Stats, combatRig.Ship.PhysicsCore, autopilot);

            builder.CreateWeaponTarget("PlayerHudRadarCombatTarget", new Vector3(70f, 0f, 180f));
            combatRig.Computer.RefreshTargets();
            Assert.That(combatRig.Computer.AvailableTargets.Count, Is.GreaterThan(0));
            combatRig.Computer.ToggleTarget(combatRig.Computer.AvailableTargets[0]);
            Assert.NotNull(combatRig.Computer.ActiveTargetTransform);

            GameObject arenaObject = new GameObject("PlayerHudRadarArena");
            PrototypePveArenaLoop arenaLoop = arenaObject.AddComponent<PrototypePveArenaLoop>();
            arenaLoop.StartOrResetArena();

            GameObject dockingObject = new GameObject("PlayerHudRadarDockTarget");
            dockingObject.transform.position = new Vector3(120f, 0f, 320f);
            DockingPort dockingTarget = dockingObject.AddComponent<DockingPort>();
            dockingTarget.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);

            GameObject environmentObject = new GameObject("PlayerHudRadarEnvironment");
            PrototypeTestEnvironment environment = environmentObject.AddComponent<PrototypeTestEnvironment>();
            environment.Rebuild();

            builder.CreateObstacle("PlayerHudRadarObstacle", new Vector3(28f, 0f, 92f), 10f);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                combatRig.Ship.Ship.transform,
                combatRig.Ship.Body,
                combatRig.Ship.Stats,
                combatRig.Ship.Controller,
                autopilot,
                null,
                combatRig.Computer,
                null,
                dockingTarget,
                arenaLoop,
                null,
                preview);

            Assert.That(snapshot.Radar.RangeMeters, Is.EqualTo(1000f));
            Assert.That(snapshot.Radar.RangeLabel, Is.EqualTo("Range 1 km"));
            Assert.That(snapshot.Radar.RouteWorldPoints.Length, Is.EqualTo(3));
            Assert.That(snapshot.Radar.TrajectoryPreviewWorldPoints.Length, Is.GreaterThan(1));
            Assert.True(snapshot.Radar.HasAvoidanceWaypoint);
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.SelectedNavigation, "Nav Waypoint");
            Assert.That(CountRadarKind(snapshot.Radar, PrototypePlayerRadarBlipKind.Navigation), Is.GreaterThanOrEqualTo(2));
            Assert.That(CountRadarKind(snapshot.Radar, PrototypePlayerRadarBlipKind.Objective), Is.GreaterThanOrEqualTo(3));
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.SelectedCombat, "PlayerHudRadarCombatTarget");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Docking, "PlayerHudRadarDockTarget");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Beacon, "Beacon");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Gate, "Gate");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Station, "Station");
            Assert.That(CountRadarKind(snapshot.Radar, PrototypePlayerRadarBlipKind.Hazard), Is.GreaterThan(0));
            Assert.That(
                snapshot.Radar.Blips[snapshot.Radar.Blips.Length - 2].Kind,
                Is.EqualTo(PrototypePlayerRadarBlipKind.SelectedNavigation),
                "selected navigation blip is drawn above lower-priority map contacts");
            Assert.That(
                snapshot.Radar.Blips[snapshot.Radar.Blips.Length - 1].Kind,
                Is.EqualTo(PrototypePlayerRadarBlipKind.SelectedCombat),
                "selected combat blip is drawn last so the minimap cannot hide it under the contact cluster");
        }
    }

    [Test]
    public void RadarSnapshotFallsBackToSceneNavigationTargetsWhenAutopilotManagerIsMissing()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudRadarFallbackShip");
            PrototypeWaypointAutopilot autopilot = rig.Ship.GetComponent<PrototypeWaypointAutopilot>();
            if (autopilot == null)
            {
                autopilot = rig.Ship.AddComponent<PrototypeWaypointAutopilot>();
            }

            GameObject waypointObject = new GameObject("PlayerHudRadarSceneWaypoint");
            waypointObject.transform.position = new Vector3(125f, 0f, 420f);
            PrototypeNavigationTarget waypoint = waypointObject.AddComponent<PrototypeNavigationTarget>();
            waypoint.Configure("Loose Scene Waypoint", 10f);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                autopilot,
                null,
                null,
                null,
                null,
                null,
                null,
                null);

            Assert.That(snapshot.Radar.Blips.Length, Is.GreaterThan(0), "scene navigation radar contacts");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Navigation, "Loose Scene Waypoint");
        }
    }

    [Test]
    public void RadarSnapshotFallsBackToCombatTargetDiscoveryWhenWeaponSourcesAreEmpty()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeCombatRig combatRig = builder.CreateCombatRig("PlayerHudRadarCombatFallbackShip");
            builder.CreateWeaponTarget("PlayerHudRadarFallbackCombatTarget", new Vector3(80f, 0f, 190f));

            PrototypeWeaponTargetRegistry.ClearForTests();
            combatRig.Computer.RefreshTargets();

            Assert.That(PrototypeWeaponTargetRegistry.RegisteredCount, Is.EqualTo(0), "registry forced empty");
            Assert.That(combatRig.Computer.AvailableTargets.Count, Is.EqualTo(0), "weapon computer sources empty");

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                combatRig.Ship.Ship.transform,
                combatRig.Ship.Body,
                combatRig.Ship.Stats,
                combatRig.Ship.Controller,
                null,
                null,
                combatRig.Computer,
                null,
                null);

            Assert.That(snapshot.Radar.Blips.Length, Is.GreaterThan(0), "fallback combat discovery populated");
            AssertRadarContains(snapshot.Radar, PrototypePlayerRadarBlipKind.Combat, "PlayerHudRadarFallbackCombatTarget");
        }
    }

    [Test]
    public void NavigationPlannerMapShowsRadarContactsWithoutActiveRoute()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(
                    PrototypePlayerRadarBlipKind.Navigation,
                    "Loose Scene Waypoint",
                    new Vector3(125f, 0f, 420f),
                    10f)
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);
        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));

        Assert.True(FindRect(playerHud, "NavigationPlannerMapPanel").gameObject.activeSelf);
        Assert.True(FindRect(playerHud, "NavigationPlannerMapLayer").gameObject.activeInHierarchy);
        Assert.True(FindRect(playerHud, "NavigationPlannerMapGridSegment0").gameObject.activeInHierarchy);
        Assert.True(FindRect(playerHud, "NavigationPlannerMapBlip0").gameObject.activeInHierarchy);
        Assert.That(FindText(playerHud, "NavigationPlannerMapText").text, Does.Contain("1 contact"));
        Assert.False(FindRect(playerHud, "RadarPanel").gameObject.activeSelf);
    }

    [Test]
    public void RadarTextUsesSnapshotAutoRangeLabelAndContactCount()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var radar = new PrototypePlayerRadarSnapshot(
            250f,
            "Range 250 m",
            Vector3.zero,
            Vector3.forward,
            new PrototypePlayerRadarBlip[0],
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 250 m"));

        radar = new PrototypePlayerRadarSnapshot(
            250f,
            "Range 250 m",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(
                    PrototypePlayerRadarBlipKind.Navigation,
                    "Nearest waypoint",
                    new Vector3(0f, 0f, 120f))
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 250 m | 1 contact"));
    }

    [Test]
    public void RadarAutoRangeUsesMidZoomForMediumDistanceNavigationTarget()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudRadarMidZoomShip");
            GameObject targetObject = new GameObject("PlayerHudRadarMidZoomTarget");
            targetObject.transform.position = new Vector3(0f, 0f, 1900f);
            PrototypeNavigationTarget target = targetObject.AddComponent<PrototypeNavigationTarget>();
            target.Configure("Medium Nav Target", 10f);

            PrototypeWaypointAutopilot autopilot = rig.Ship.AddComponent<PrototypeWaypointAutopilot>();
            autopilot.Bind(null, rig.Controller, rig.Stats, rig.Body);
            autopilot.SelectTarget(target);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                autopilot,
                null,
                null,
                null,
                null);

            Assert.That(snapshot.Navigation.TargetName, Is.EqualTo("Medium Nav Target"));
            Assert.That(snapshot.Radar.RangeMeters, Is.EqualTo(2500f));
            Assert.That(snapshot.Radar.RangeLabel, Is.EqualTo("Range 2.5 km"));
            Assert.That(snapshot.Radar.RouteWorldPoints.Length, Is.EqualTo(2), "direct selected-target route line");
            Assert.That(snapshot.Radar.RouteWorldPoints[0], Is.EqualTo(rig.Ship.transform.position));
            Assert.That(snapshot.Radar.RouteWorldPoints[1], Is.EqualTo(target.Position));
        }
    }

    [Test]
    public void RadarWorldToLayerPointExpandsCloseContactsForMidRangeImageLayer()
    {
        var radar = new PrototypePlayerRadarSnapshot(
            2500f,
            "Range 2.5 km",
            Vector3.zero,
            Vector3.forward,
            new PrototypePlayerRadarBlip[0],
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod(
            "RadarWorldToLayerPoint",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        Vector2 nearContact = (Vector2)method.Invoke(null, new object[] { radar, new Vector3(100f, 0f, 0f), 100f });
        Vector2 edgeContact = (Vector2)method.Invoke(null, new object[] { radar, new Vector3(2500f, 0f, 0f), 100f });

        Assert.That(nearContact.magnitude, Is.GreaterThan(10f), "close contact should be visibly separated from center");
        Assert.That(edgeContact.magnitude, Is.InRange(99.9f, 100f), "range edge should still map to panel edge");
        Assert.That(nearContact.magnitude, Is.LessThan(edgeContact.magnitude), "close points must remain inside edge distance");
    }

    [Test]
    public void RadarGraphicClampRadarPointExpandsCloseContactsForMidRange()
    {
        var radar = new PrototypePlayerRadarSnapshot(
            2500f,
            "Range 2.5 km",
            Vector3.zero,
            Vector3.forward,
            new PrototypePlayerRadarBlip[0],
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo method = typeof(PrototypePlayerHudRadarGraphic).GetMethod(
            "ClampRadarPoint",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        Vector2 nearContact = (Vector2)method.Invoke(null, new object[] { Vector2.zero, 100f, radar, new Vector3(100f, 0f, 0f) });
        Vector2 edgeContact = (Vector2)method.Invoke(null, new object[] { Vector2.zero, 100f, radar, new Vector3(2500f, 0f, 0f) });

        Assert.That(nearContact.magnitude, Is.GreaterThan(10f), "close contact should be visibly separated from center");
        Assert.That(edgeContact.magnitude, Is.InRange(99.9f, 100f), "range edge should still map to panel edge");
        Assert.That(nearContact.magnitude, Is.LessThan(edgeContact.magnitude), "close points must remain inside edge distance");
    }

    [Test]
    public void TargetIndicatorSnapshotCollectsSelectedAndObjectiveTargets()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeCombatRig combatRig = builder.CreateCombatRig("PlayerHudIndicatorShip");
            GameObject managerObject = new GameObject("PlayerHudIndicatorWaypointManager");
            PrototypeWaypointManager manager = managerObject.AddComponent<PrototypeWaypointManager>();
            manager.EnsureDefaultWaypoints();

            PrototypeWaypointAutopilot autopilot = combatRig.Ship.Ship.AddComponent<PrototypeWaypointAutopilot>();
            autopilot.Bind(manager, combatRig.Ship.Controller, combatRig.Ship.Stats, combatRig.Ship.Body);
            autopilot.SelectTarget(manager.SelectedTarget);

            builder.CreateWeaponTarget("PlayerHudIndicatorCombatTarget", new Vector3(35f, 0f, 140f));
            combatRig.Computer.RefreshTargets();
            combatRig.Computer.ToggleTarget(combatRig.Computer.AvailableTargets[0]);

            DockingPort sourceDocking = combatRig.Ship.Ship.AddComponent<DockingPort>();
            sourceDocking.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
            GameObject dockingObject = new GameObject("PlayerHudIndicatorDockTarget");
            dockingObject.transform.position = new Vector3(0f, 0f, 70f);
            DockingPort dockingTarget = dockingObject.AddComponent<DockingPort>();
            dockingTarget.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);

            GameObject arenaObject = new GameObject("PlayerHudIndicatorArena");
            PrototypePveArenaLoop arenaLoop = arenaObject.AddComponent<PrototypePveArenaLoop>();
            arenaLoop.StartOrResetArena();

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                combatRig.Ship.Ship.transform,
                combatRig.Ship.Body,
                combatRig.Ship.Stats,
                combatRig.Ship.Controller,
                autopilot,
                null,
                combatRig.Computer,
                sourceDocking,
                dockingTarget,
                arenaLoop,
                null,
                null);

            AssertIndicatorContains(snapshot.TargetIndicators, PrototypePlayerTargetIndicatorKind.Navigation, "Nav Waypoint", true);
            AssertIndicatorContains(snapshot.TargetIndicators, PrototypePlayerTargetIndicatorKind.Combat, "PlayerHudIndicatorCombatTarget", true);
            AssertIndicatorContains(snapshot.TargetIndicators, PrototypePlayerTargetIndicatorKind.Docking, "PlayerHudIndicatorDockTarget", true);
            Assert.That(CountIndicatorKind(snapshot.TargetIndicators, PrototypePlayerTargetIndicatorKind.Objective), Is.GreaterThanOrEqualTo(3));

            PrototypePlayerHudSnapshot noDockingSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
                combatRig.Ship.Ship.transform,
                combatRig.Ship.Body,
                combatRig.Ship.Stats,
                combatRig.Ship.Controller,
                autopilot,
                null,
                combatRig.Computer,
                sourceDocking,
                null,
                arenaLoop,
                null,
                null);

            Assert.That(CountIndicatorKind(noDockingSnapshot.TargetIndicators, PrototypePlayerTargetIndicatorKind.Docking), Is.EqualTo(0));
        }
    }

    [Test]
    public void TargetIndicatorProjectionClampsOffscreenAndHidesRiskyLabels()
    {
        GameObject cameraObject = new GameObject("PlayerHudIndicatorProjectionCamera");
        Camera projectionCamera = cameraObject.AddComponent<Camera>();
        cameraObject.transform.position = Vector3.zero;
        cameraObject.transform.rotation = Quaternion.identity;
        projectionCamera.nearClipPlane = 0.1f;
        projectionCamera.farClipPlane = 2000f;

        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var indicators = new PrototypePlayerTargetIndicatorSnapshot(new[]
        {
            new PrototypePlayerTargetIndicator(
                PrototypePlayerTargetIndicatorKind.Navigation,
                "Forward Nav",
                "Ziel gewaehlt",
                new Vector3(0f, 0f, 120f),
                120f,
                PrototypePlayerHudSeverity.Info,
                0f,
                true,
                true),
            new PrototypePlayerTargetIndicator(
                PrototypePlayerTargetIndicatorKind.Combat,
                "Far Right Combat",
                "Bereit",
                new Vector3(500f, 0f, 120f),
                514f,
                PrototypePlayerHudSeverity.Info,
                0.8f,
                true,
                true),
            new PrototypePlayerTargetIndicator(
                PrototypePlayerTargetIndicatorKind.Docking,
                "Behind Dock",
                "Docking",
                new Vector3(0f, 0f, -80f),
                80f,
                PrototypePlayerHudSeverity.Warning,
                0f,
                true,
                true),
            new PrototypePlayerTargetIndicator(
                PrototypePlayerTargetIndicatorKind.Objective,
                "High Objective",
                "Objective",
                new Vector3(0f, 500f, 120f),
                514f,
                PrototypePlayerHudSeverity.Info,
                0f,
                false,
                true)
        });

        PrototypePlayerHudSnapshot snapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(false),
            default,
            null,
            null,
            indicators);

        PrototypePlayerProjectedTargetIndicator[] projected = playerHud.ProjectTargetIndicatorsForTests(1280, 720, snapshot);

        Assert.That(projected.Length, Is.EqualTo(4));
        Assert.False(projected[0].Offscreen);
        Assert.True(projected[0].LabelVisible);
        Assert.True(projected[1].Offscreen);
        Assert.True(projected[2].Offscreen);
        Assert.That(projected[1].CanvasPosition.x, Is.LessThanOrEqualTo(244.5f));
        Assert.True(projected[3].Offscreen);
        Assert.That(projected[3].CanvasPosition.y, Is.LessThanOrEqualTo(224.5f));

        PrototypePlayerProjectedTargetIndicator[] tinyProjected = playerHud.ProjectTargetIndicatorsForTests(640, 480, snapshot);
        Assert.False(tinyProjected[0].LabelVisible);

        ApplySnapshotForTest(playerHud, snapshot);
        AssertTargetIndicatorLabelsDoNotOverlap(playerHud);
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
        PrototypeTurretFireStatus lineBlocked = PrototypeTurretFireStatus.Blocked(
            PrototypeTurretFireBlockReason.LineBlocked,
            "line blocked",
            distanceMeters: 20f,
            hasSelectedTarget: true);

        string outOfArcLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(outOfArc);
        string cooldownLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(cooldown);
        string lineBlockedLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(lineBlocked);

        Assert.That(outOfArcLabel, Is.EqualTo("Ausserhalb Feuerwinkel"));
        Assert.That(cooldownLabel, Is.EqualTo("Cooldown 0.4s"));
        Assert.That(lineBlockedLabel, Is.EqualTo("Schusslinie blockiert"));
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
        Assert.That(help, Does.Contain("F5: navigation map"));
        Assert.That(help, Does.Contain("F7: combat computer"));
        Assert.That(help, Does.Contain("P navigation planner"));
        Assert.That(help, Does.Contain("M Kill Momentum"));
        Assert.That(help, Does.Contain("C cycle combat target"));
        Assert.That(help, Does.Not.Contain("Debug Console"));
        Assert.That(help, Does.Not.Contain("Flight Diagnostics"));
        Assert.That(help, Does.Not.Contain("DES/ACT/RES"));
        Assert.That(help, Does.Not.Contain("Backspace: refill fuel"));
        Assert.That(help, Does.Not.Contain("F6"));
        Assert.That(help, Does.Not.Contain("Keybinds"));
        Assert.That(help, Does.Not.Contain("F7 Weapon Computer"));
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
    public void BootstrapStartResetsStalePrototypePresetToBasicPlayerView()
    {
        PrototypeUiLayoutManager.ApplyPreset(PrototypeUiPreset.FullDiagnostics, null, null, null, null, null, null);

        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();
        MethodInfo start = typeof(PrototypeBootstrap).GetMethod("Start", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(start);

        start.Invoke(bootstrap, null);

        Assert.That(PrototypeUiLayoutManager.CurrentPreset, Is.EqualTo(PrototypeUiPreset.Basic));
        Assert.NotNull(Camera.main);
        Assert.False(Camera.main.GetComponent<PrototypeFlightHud>().ShowHud);
        Assert.False(Camera.main.GetComponent<PrototypeDebugOverlay>().IsWindowVisible);
        Assert.False(Camera.main.GetComponent<PrototypeMinimapOverlay>().IsWindowVisible);
        Assert.False(Camera.main.GetComponent<PrototypeWeaponComputerPanel>().IsWindowVisible);
    }

    [Test]
    public void BasicPresetBlocksLegacyF2F3F4F5F7PresetRouting()
    {
        Assert.False(PrototypeUiLayoutManager.ShouldRouteF2ToPrototypeDebugOverlay(PrototypeUiPreset.Basic));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF2ToPrototypeDebugOverlay(PrototypeUiPreset.FlightTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF2ToPrototypeDebugOverlay(PrototypeUiPreset.RcsTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF2ToPrototypeDebugOverlay(PrototypeUiPreset.FullDiagnostics));
        Assert.False(PrototypeUiLayoutManager.ShouldRouteF3ToPrototypeFlightDebugConsole(PrototypeUiPreset.Basic));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF3ToPrototypeFlightDebugConsole(PrototypeUiPreset.FlightTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF3ToPrototypeFlightDebugConsole(PrototypeUiPreset.RcsTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF3ToPrototypeFlightDebugConsole(PrototypeUiPreset.FullDiagnostics));
        Assert.False(PrototypeUiLayoutManager.ShouldRouteF4ToPrototypeFlightHud(PrototypeUiPreset.Basic));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF4ToPrototypeFlightHud(PrototypeUiPreset.FlightTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF4ToPrototypeFlightHud(PrototypeUiPreset.RcsTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF4ToPrototypeFlightHud(PrototypeUiPreset.FullDiagnostics));
        Assert.False(PrototypeUiLayoutManager.ShouldRouteF5ToPrototypeMinimap(PrototypeUiPreset.Basic));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF5ToPrototypeMinimap(PrototypeUiPreset.FlightTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF5ToPrototypeMinimap(PrototypeUiPreset.RcsTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF5ToPrototypeMinimap(PrototypeUiPreset.FullDiagnostics));
        Assert.False(PrototypeUiLayoutManager.ShouldRouteF7ToPrototypeWeaponComputer(PrototypeUiPreset.Basic));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF7ToPrototypeWeaponComputer(PrototypeUiPreset.FlightTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF7ToPrototypeWeaponComputer(PrototypeUiPreset.RcsTest));
        Assert.True(PrototypeUiLayoutManager.ShouldRouteF7ToPrototypeWeaponComputer(PrototypeUiPreset.FullDiagnostics));
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
    public void CombatNoTargetDoesNotPreemptNavigationOrObjective()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var combatNoTarget = new PrototypePlayerCombatSnapshot(
            true,
            "No target",
            0f,
            "--",
            0f,
            "No target",
            PrototypePlayerHudSeverity.Disabled,
            "Auto Fire: Off",
            "ManualOrder");
        var arena = new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 0, string.Empty);

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(combatNoTarget, CreateDockingSnapshot(false), CreateNavigationSnapshot(true), arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Navigation: Nav Beacon"));
        Assert.False(FindRect(playerHud, "CombatControls").gameObject.activeInHierarchy);

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(combatNoTarget, CreateDockingSnapshot(false), CreateNavigationSnapshot(false), arena));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Objective: Clear the Arena"));
        Assert.False(FindRect(playerHud, "CombatControls").gameObject.activeInHierarchy);

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(combatNoTarget, CreateDockingSnapshot(false), CreateNavigationSnapshot(false), default));
        Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Combat: No target"));
        Assert.True(FindRect(playerHud, "CombatControls").gameObject.activeInHierarchy);
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

        TMP_Text systems = FindText(playerHud, "SystemsText");
        TMP_Text objectiveTitle = FindText(playerHud, "ObjectiveTitle");
        TMP_Text objectiveBody = FindText(playerHud, "ObjectiveBody");

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
    public void RuntimeOverlayRendersBelowFixedHudPanels()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        RectTransform overlay = FindRect(playerHud, "FlightMarkers");
        string[] fixedPanels =
        {
            "AlertAssistStrip",
            "FlightStatusBar",
            "ShipSystems",
            "ObjectivePanel",
            "ContextPanel",
            "RadarPanel"
        };

        for (int i = 0; i < fixedPanels.Length; i++)
        {
            RectTransform panel = FindRect(playerHud, fixedPanels[i]);
            Assert.That(overlay.GetSiblingIndex(), Is.LessThan(panel.GetSiblingIndex()), fixedPanels[i] + " should render above target overlay");
        }
    }

    [Test]
    public void GeneratedPlayerHudUsesTextMeshProAndReadableMinimumFontSizes()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        Canvas canvas = playerHud.GetComponentInChildren<Canvas>(true);
        Assert.NotNull(canvas);

        TMP_Text[] tmpTexts = canvas.GetComponentsInChildren<TMP_Text>(true);
        UnityEngine.UI.Text[] legacyTexts = canvas.GetComponentsInChildren<UnityEngine.UI.Text>(true);
        Assert.That(tmpTexts.Length, Is.GreaterThanOrEqualTo(24));
        Assert.That(legacyTexts.Length, Is.EqualTo(0));
        Assert.That(FindText(playerHud, "Speed"), Is.InstanceOf<TextMeshProUGUI>());
        Assert.That(FindText(playerHud, "KillMomentumText"), Is.InstanceOf<TextMeshProUGUI>());
        Assert.That(FindText(playerHud, "TargetIndicatorLabel0"), Is.InstanceOf<TextMeshProUGUI>());

        for (int i = 0; i < tmpTexts.Length; i++)
        {
            Assert.That(tmpTexts[i].fontSize, Is.GreaterThanOrEqualTo(10f), tmpTexts[i].gameObject.name + " readable size");
            Assert.NotNull(tmpTexts[i].font, tmpTexts[i].gameObject.name + " TMP font asset");
        }
    }

    [Test]
    public void ResponsiveLayoutKeepsNavigationComputerControlsSeparated()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(true), default));

        AssertNavigationControlsSeparated(playerHud, 2560, 1080);
        AssertNavigationControlsSeparated(playerHud, 1920, 1080);
        AssertNavigationControlsSeparated(playerHud, 1280, 720);
        AssertNavigationControlsSeparated(playerHud, 1024, 768);
        AssertNavigationControlsSeparated(playerHud, 900, 1600);
        AssertNavigationControlsSeparated(playerHud, 640, 480);
    }

    [Test]
    public void ResponsiveLayoutKeepsCombatComputerControlsSeparated()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(true), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), default));

        AssertCombatControlsSeparated(playerHud, 2560, 1080);
        AssertCombatControlsSeparated(playerHud, 1920, 1080);
        AssertCombatControlsSeparated(playerHud, 1280, 720);
        AssertCombatControlsSeparated(playerHud, 1024, 768);
        AssertCombatControlsSeparated(playerHud, 900, 1600);
        AssertCombatControlsSeparated(playerHud, 640, 480);
    }

    [Test]
    public void ResponsiveLayoutKeepsHelpPanelClearOfContextAtFourByThree()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(true), default));

        RectTransform help = FindRect(playerHud, "PlayerHelp");
        SetHelpVisibleForTest(playerHud, true);
        playerHud.ApplyResponsiveLayoutForTests(1024, 768);
        Canvas.ForceUpdateCanvases();

        RectTransform context = FindRect(playerHud, "ContextPanel");
        RectTransform radar = FindRect(playerHud, "RadarPanel");
        RectTransform bottom = FindRect(playerHud, "FlightStatusBar");
        RectTransform systems = FindRect(playerHud, "ShipSystems");
        RectTransform objective = FindRect(playerHud, "ObjectivePanel");

        Assert.True(help.gameObject.activeSelf);
        Assert.False(context.gameObject.activeSelf);
        Assert.False(radar.gameObject.activeSelf);
        Assert.False(systems.gameObject.activeSelf);
        Assert.False(objective.gameObject.activeSelf);
        Assert.False(Overlaps(help, bottom), "4:3 help/bottom " + WorldRect(help) + " / " + WorldRect(bottom));
    }

    [Test]
    public void CombatComputerControlsReuseWeaponComputerApis()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeCombatRig combatRig = builder.CreateCombatRig("PlayerHudCombatControlsShip");
            builder.CreateWeaponTarget("PlayerHudCombatControlsTargetA", combatRig.Muzzle.position + Vector3.forward * 40f);
            builder.CreateWeaponTarget("PlayerHudCombatControlsTargetB", combatRig.Muzzle.position + Vector3.forward * 70f);
            combatRig.Computer.RefreshTargets();

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(combatRig.Ship.Ship.transform, combatRig.Ship.Stats, combatRig.Ship.Body);
            playerHud.RefreshNow();

            RectTransform controls = FindRect(playerHud, "CombatControls");
            Assert.True(controls.gameObject.activeInHierarchy);
            Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Combat: No target"));
            Assert.That(FindText(playerHud, "CombatAutoFireText").text, Is.EqualTo("Auto Off"));
            Assert.That(FindText(playerHud, "CombatPriorityText").text, Is.EqualTo("Prio Manual"));

            Button next = FindButton(playerHud, "CombatNextTarget");
            Button previous = FindButton(playerHud, "CombatPreviousTarget");
            Button clear = FindButton(playerHud, "CombatClearTarget");
            Button autoFire = FindButton(playerHud, "CombatAutoFire");
            Button priority = FindButton(playerHud, "CombatPriority");

            Assert.True(next.interactable);
            Assert.True(previous.interactable);
            Assert.False(clear.interactable);
            Assert.True(autoFire.interactable);
            Assert.True(priority.interactable);

            next.onClick.Invoke();
            Assert.NotNull(combatRig.Computer.ActiveTarget);
            Assert.That(FindText(playerHud, "ContextTitle").text, Does.StartWith("Combat: PlayerHudCombatControlsTarget"));
            Assert.True(FindButton(playerHud, "CombatClearTarget").interactable);

            autoFire.onClick.Invoke();
            Assert.True(combatRig.Computer.AutoFireEnabled);
            Assert.That(FindText(playerHud, "CombatAutoFireText").text, Is.EqualTo("Auto On"));
            Assert.That(FindText(playerHud, "ContextBody").text, Does.Contain("Auto Fire:"));

            priority.onClick.Invoke();
            Assert.That(combatRig.Computer.PriorityMode, Is.EqualTo(PrototypeWeaponTargetPriorityMode.Nearest));
            Assert.That(FindText(playerHud, "CombatPriorityText").text, Is.EqualTo("Prio Near"));

            clear.onClick.Invoke();
            Assert.Null(combatRig.Computer.ActiveTarget);
            Assert.That(combatRig.Computer.SelectedTargetCount, Is.EqualTo(0));
            Assert.That(FindText(playerHud, "ContextTitle").text, Is.EqualTo("Combat: No target"));
        }
    }

    [Test]
    public void CombatComputerPopupUsesPlayerHudUguiControls()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeCombatRig combatRig = builder.CreateCombatRig("PlayerHudCombatPopupShip");
            builder.CreateWeaponTarget("PlayerHudCombatPopupTargetA", combatRig.Muzzle.position + Vector3.forward * 40f);
            builder.CreateWeaponTarget("PlayerHudCombatPopupTargetB", combatRig.Muzzle.position + Vector3.forward * 70f);
            combatRig.Computer.RefreshTargets();

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(combatRig.Ship.Ship.transform, combatRig.Ship.Stats, combatRig.Ship.Body);
            SetCombatComputerVisibleForTest(playerHud, true);

            RectTransform panel = FindRect(playerHud, "CombatComputerPanel");
            Assert.True(panel.gameObject.activeSelf);
            Assert.False(FindRect(playerHud, "ContextPanel").gameObject.activeSelf);
            Assert.False(FindRect(playerHud, "RadarPanel").gameObject.activeSelf);
            Assert.That(FindText(playerHud, "CombatComputerTitle").text, Is.EqualTo("Combat Computer"));
            Assert.That(FindText(playerHud, "CombatComputerBody").text, Does.Contain("Target No target"));

            Button next = FindButton(playerHud, "CombatComputerNextTarget");
            Button autoFire = FindButton(playerHud, "CombatComputerAutoFire");
            Button priority = FindButton(playerHud, "CombatComputerPriority");

            Assert.True(next.interactable);
            next.onClick.Invoke();
            Assert.NotNull(combatRig.Computer.ActiveTarget);
            Assert.That(FindText(playerHud, "CombatComputerBody").text, Does.Contain(combatRig.Computer.ActiveTarget.Label));

            autoFire.onClick.Invoke();
            Assert.True(combatRig.Computer.AutoFireEnabled);
            Assert.That(FindText(playerHud, "CombatComputerAutoFireText").text, Is.EqualTo("Auto On"));

            priority.onClick.Invoke();
            Assert.That(combatRig.Computer.PriorityMode, Is.EqualTo(PrototypeWeaponTargetPriorityMode.Nearest));
            Assert.That(FindText(playerHud, "CombatComputerPriorityText").text, Is.EqualTo("Prio Near"));
        }
    }

    [Test]
    public void CombatComputerControlsHideOutsideCombatContext()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(true), default));

        Assert.False(FindRect(playerHud, "CombatControls").gameObject.activeInHierarchy);
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
            TMP_Text label = FindText(playerHud, "KillMomentumText");
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
    public void KillMomentumKeybindIsDocumentedAndRoutedInPlayerHud()
    {
        string help = PrototypePlayerHudSnapshotBuilder.BuildPlayerHelpText(FlightControlMode.Normal, false);
        string source = File.ReadAllText(Path.Combine(Application.dataPath, "Scripts", "Prototype", "PrototypePlayerHud.cs"));

        Assert.That(help, Does.Contain("M Kill Momentum"));
        Assert.That(help, Does.Contain("F5: navigation map"));
        Assert.That(source, Does.Contain("keyboard.mKey.wasPressedThisFrame"));
        Assert.That(source, Does.Contain("HandleKillMomentumAction(\"keybind\")"));
        Assert.That(source, Does.Contain("keyboard.f5Key.wasPressedThisFrame"));
        Assert.That(source, Does.Contain("SetNavigationPlannerVisible"));
        Assert.That(source, Does.Contain("keyboard.cKey.wasPressedThisFrame"));
        Assert.That(source, Does.Contain("HandleCombatTargetCycle"));
    }

    [Test]
    public void NavigationComputerControlsReuseAutopilotAndPreviewApis()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudNavShip");
            GameObject managerObject = new GameObject("PlayerHudNavManager");
            PrototypeWaypointManager manager = managerObject.AddComponent<PrototypeWaypointManager>();
            manager.EnsureDefaultWaypoints();

            PrototypeWaypointAutopilot autopilot = rig.Ship.GetComponent<PrototypeWaypointAutopilot>();
            if (autopilot == null)
            {
                autopilot = rig.Ship.AddComponent<PrototypeWaypointAutopilot>();
            }

            autopilot.Bind(manager, rig.Controller, rig.Stats, rig.Body);
            autopilot.SelectTarget(manager.SelectedTarget);

            PrototypeTrajectoryPreviewNavMap preview = rig.Ship.AddComponent<PrototypeTrajectoryPreviewNavMap>();
            preview.Bind(rig.Ship.transform, rig.Body, rig.Stats, rig.PhysicsCore, autopilot);
            preview.ConfigureForTests(true, 8, 12, 0.1f, false, true);

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(rig.Ship.transform, rig.Stats, rig.Body);
            playerHud.RefreshNow();

            int initialIndex = manager.SelectedIndex;
            string initialTargetName = autopilot.CurrentTarget != null ? autopilot.CurrentTarget.DisplayName : string.Empty;
            string initialTargetLabel = "Target " + (initialIndex + 1) + "/" + manager.TargetCount;

            RectTransform controls = FindRect(playerHud, "NavigationControls");
            Assert.True(controls.gameObject.activeInHierarchy);
            Assert.That(FindText(playerHud, "ContextBody").text, Does.Contain(initialTargetLabel));
            Assert.That(FindText(playerHud, "NavAutopilotText").text, Is.EqualTo("Engage"));
            Assert.That(FindText(playerHud, "NavPreviewText").text, Is.EqualTo("Preview On"));

            Button next = FindButton(playerHud, "NavNextTarget");
            Button previous = FindButton(playerHud, "NavPreviousTarget");
            Button autopilotButton = FindButton(playerHud, "NavAutopilot");
            Button replan = FindButton(playerHud, "NavReplan");
            Button previewButton = FindButton(playerHud, "NavPreview");

            Assert.True(next.interactable);
            Assert.True(previous.interactable);
            Assert.True(autopilotButton.interactable);
            Assert.True(replan.interactable);
            Assert.True(previewButton.interactable);

            next.onClick.Invoke();
            Assert.NotNull(autopilot.CurrentTarget);
            Assert.That(autopilot.CurrentTarget.DisplayName, Is.Not.EqualTo(initialTargetName));
            Assert.That(FindText(playerHud, "ContextBody").text, Does.Contain("Target " + (manager.SelectedIndex + 1) + "/" + manager.TargetCount));

            previewButton.onClick.Invoke();
            Assert.False(preview.PreviewEnabled);
            Assert.That(FindText(playerHud, "NavPreviewText").text, Is.EqualTo("Preview Off"));

            autopilotButton.onClick.Invoke();
            Assert.True(autopilot.AutopilotEngaged);
            Assert.That(FindText(playerHud, "NavAutopilotText").text, Is.EqualTo("Abort AP"));

            replan.onClick.Invoke();
            Assert.NotNull(autopilot.CurrentTarget);
        }
    }

    [Test]
    public void NavigationPlannerPopupUsesAutopilotAndPreviewApis()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudNavPlannerShip");
            GameObject managerObject = new GameObject("PlayerHudNavPlannerManager");
            PrototypeWaypointManager manager = managerObject.AddComponent<PrototypeWaypointManager>();
            manager.EnsureDefaultWaypoints();

            PrototypeWaypointAutopilot autopilot = rig.Ship.GetComponent<PrototypeWaypointAutopilot>();
            if (autopilot == null)
            {
                autopilot = rig.Ship.AddComponent<PrototypeWaypointAutopilot>();
            }

            autopilot.Bind(manager, rig.Controller, rig.Stats, rig.Body);
            autopilot.SelectTarget(manager.SelectedTarget);

            PrototypeTrajectoryPreviewNavMap preview = rig.Ship.AddComponent<PrototypeTrajectoryPreviewNavMap>();
            preview.Bind(rig.Ship.transform, rig.Body, rig.Stats, rig.PhysicsCore, autopilot);
            preview.ConfigureForTests(true, 8, 12, 0.1f, false, true);

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(rig.Ship.transform, rig.Stats, rig.Body);
            playerHud.RefreshNow();

            FindButton(playerHud, "NavReplan").onClick.Invoke();

            RectTransform panel = FindRect(playerHud, "NavigationPlannerPanel");
            Assert.True(panel.gameObject.activeSelf);
            Assert.False(FindRect(playerHud, "ContextPanel").gameObject.activeSelf);
            Assert.False(FindRect(playerHud, "RadarPanel").gameObject.activeSelf);
            Assert.That(FindText(playerHud, "NavigationPlannerTitle").text, Is.EqualTo("Navigation Planner"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Target 1/"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Manoever:"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Route:"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Burn req"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Stop "));
            Assert.True(FindRect(playerHud, "NavigationPlannerMapPanel").gameObject.activeSelf);
            Assert.True(FindRect(playerHud, "NavigationPlannerMapLayer").gameObject.activeInHierarchy);
            Assert.True(FindRect(playerHud, "NavigationPlannerMapGridSegment0").gameObject.activeInHierarchy);
            Assert.That(FindText(playerHud, "NavigationPlannerMapText").text, Does.Contain("Range "));

            Button next = FindButton(playerHud, "NavPlannerNextTarget");
            Button engage = FindButton(playerHud, "NavPlannerEngage");
            Button previewButton = FindButton(playerHud, "NavPlannerPreview");

            Assert.True(next.interactable);
            next.onClick.Invoke();
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Target " + (manager.SelectedIndex + 1) + "/" + manager.TargetCount));

            previewButton.onClick.Invoke();
            Assert.False(preview.PreviewEnabled);
            Assert.That(FindText(playerHud, "NavPlannerPreviewText").text, Is.EqualTo("Preview Off"));

            engage.onClick.Invoke();
            Assert.True(autopilot.AutopilotEngaged);
            Assert.That(FindText(playerHud, "NavPlannerEngageText").text, Is.EqualTo("Abort AP"));
        }
    }

    [Test]
    public void NavigationComputerControlsHideOutsideNavigationContext()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(true), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), default));

        Assert.False(FindRect(playerHud, "NavigationControls").gameObject.activeInHierarchy);
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
        PrototypePlayerHudChip[] warnings = null,
        PrototypePlayerRadarSnapshot? radar = null,
        PrototypePlayerTargetIndicatorSnapshot? targetIndicators = null)
    {
        PrototypePlayerRadarSnapshot radarSnapshot = radar ?? new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new PrototypePlayerRadarBlip[0],
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);
        PrototypePlayerTargetIndicatorSnapshot targetIndicatorSnapshot = targetIndicators
            ?? new PrototypePlayerTargetIndicatorSnapshot(new PrototypePlayerTargetIndicator[0]);
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
            radarSnapshot,
            targetIndicatorSnapshot,
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
            visible ? "Route: Direkt" : "Route: Kein Ziel",
            visible ? "Manoever: Direkt-Burn bereit" : "Manoever: Kein Ziel",
            visible ? 140f : 0f,
            visible ? 12f : 0f,
            visible ? 60f : 0f,
            new string[0],
            new Vector3[0],
            PrototypeTrajectoryPreviewSnapshot.Unavailable("Trajectory Preview", 0, 0f),
            false,
            Vector3.zero,
            string.Empty,
            visible ? 2 : 0,
            visible ? 3 : 0);
    }

    private static void ApplySnapshotForTest(PrototypePlayerHudRenderer playerHud, PrototypePlayerHudSnapshot snapshot)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("ApplySnapshot", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(playerHud, new object[] { snapshot });
        Canvas.ForceUpdateCanvases();
    }

    private static void SetHelpVisibleForTest(PrototypePlayerHudRenderer playerHud, bool visible)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("SetHelpVisible", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(playerHud, new object[] { visible });
        Canvas.ForceUpdateCanvases();
    }

    private static void SetCombatComputerVisibleForTest(PrototypePlayerHudRenderer playerHud, bool visible)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod("SetCombatComputerVisible", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(playerHud, new object[] { visible });
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

    private static void AssertRadarContains(PrototypePlayerRadarSnapshot radar, PrototypePlayerRadarBlipKind kind, string labelPart)
    {
        for (int i = 0; i < radar.Blips.Length; i++)
        {
            PrototypePlayerRadarBlip blip = radar.Blips[i];
            if (blip.Kind == kind && blip.Label.Contains(labelPart))
            {
                return;
            }
        }

        Assert.Fail("Missing radar blip " + kind + " containing " + labelPart);
    }

    private static PrototypeNavigationTarget FindNavigationTargetByName(PrototypeWaypointManager manager, string displayName)
    {
        Assert.NotNull(manager);
        PrototypeNavigationTarget[] targets = manager.NavigationTargets;
        for (int i = 0; i < targets.Length; i++)
        {
            if (targets[i] != null && targets[i].DisplayName == displayName)
            {
                return targets[i];
            }
        }

        Assert.Fail("Missing navigation target " + displayName);
        return null;
    }

    private static int CountRadarKind(PrototypePlayerRadarSnapshot radar, PrototypePlayerRadarBlipKind kind)
    {
        int count = 0;
        for (int i = 0; i < radar.Blips.Length; i++)
        {
            if (radar.Blips[i].Kind == kind)
            {
                count++;
            }
        }

        return count;
    }

    private static void AssertIndicatorContains(
        PrototypePlayerTargetIndicatorSnapshot snapshot,
        PrototypePlayerTargetIndicatorKind kind,
        string labelPart,
        bool selected)
    {
        for (int i = 0; i < snapshot.Indicators.Length; i++)
        {
            PrototypePlayerTargetIndicator indicator = snapshot.Indicators[i];
            if (indicator.Kind == kind && indicator.Selected == selected && indicator.Label.Contains(labelPart))
            {
                return;
            }
        }

        Assert.Fail("Missing target indicator " + kind + " containing " + labelPart);
    }

    private static int CountIndicatorKind(PrototypePlayerTargetIndicatorSnapshot snapshot, PrototypePlayerTargetIndicatorKind kind)
    {
        int count = 0;
        for (int i = 0; i < snapshot.Indicators.Length; i++)
        {
            if (snapshot.Indicators[i].Kind == kind)
            {
                count++;
            }
        }

        return count;
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

    private static void InvokeFixedUpdate(object target)
    {
        MethodInfo method = target.GetType().GetMethod("FixedUpdate", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        method.Invoke(target, null);
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

    private static void AssertTargetIndicatorLabelsDoNotOverlap(PrototypePlayerHudRenderer playerHud)
    {
        var visibleLabels = new List<RectTransform>();
        for (int i = 0; i < 6; i++)
        {
            RectTransform rect = FindRect(playerHud, "TargetIndicatorLabel" + i);
            if (rect.gameObject.activeInHierarchy)
            {
                visibleLabels.Add(rect);
            }
        }

        for (int i = 0; i < visibleLabels.Count; i++)
        {
            for (int j = i + 1; j < visibleLabels.Count; j++)
            {
                Assert.False(Overlaps(visibleLabels[i], visibleLabels[j]), "target indicator label overlap " + i + "/" + j);
            }
        }
    }

    private static void AssertNavigationControlsSeparated(PrototypePlayerHudRenderer playerHud, int width, int height)
    {
        playerHud.ApplyResponsiveLayoutForTests(width, height);
        Canvas.ForceUpdateCanvases();

        RectTransform row = FindRect(playerHud, "NavigationControls");
        RectTransform body = FindRect(playerHud, "ContextBody");
        RectTransform gauges = FindRect(playerHud, "ContextGauges");
        RectTransform[] buttons =
        {
            FindRect(playerHud, "NavPreviousTarget"),
            FindRect(playerHud, "NavNextTarget"),
            FindRect(playerHud, "NavAutopilot"),
            FindRect(playerHud, "NavReplan"),
            FindRect(playerHud, "NavPreview")
        };

        Assert.True(row.gameObject.activeInHierarchy, width + "x" + height + " nav controls hidden");
        Assert.False(Overlaps(row, body), width + "x" + height + " nav controls/body");
        Assert.False(Overlaps(row, gauges), width + "x" + height + " nav controls/gauges");

        Rect rowRect = WorldRect(row);
        for (int i = 0; i < buttons.Length; i++)
        {
            Rect buttonRect = WorldRect(buttons[i]);
            Assert.True(Contains(rowRect, buttonRect), width + "x" + height + " nav button outside row " + buttons[i].gameObject.name);
            for (int j = i + 1; j < buttons.Length; j++)
            {
                Assert.False(Overlaps(buttons[i], buttons[j]), width + "x" + height + " nav button overlap " + i + "/" + j);
            }
        }
    }

    private static void AssertCombatControlsSeparated(PrototypePlayerHudRenderer playerHud, int width, int height)
    {
        playerHud.ApplyResponsiveLayoutForTests(width, height);
        Canvas.ForceUpdateCanvases();

        RectTransform row = FindRect(playerHud, "CombatControls");
        RectTransform body = FindRect(playerHud, "ContextBody");
        RectTransform gauges = FindRect(playerHud, "ContextGauges");
        RectTransform[] buttons =
        {
            FindRect(playerHud, "CombatPreviousTarget"),
            FindRect(playerHud, "CombatNextTarget"),
            FindRect(playerHud, "CombatClearTarget"),
            FindRect(playerHud, "CombatAutoFire"),
            FindRect(playerHud, "CombatPriority")
        };

        Assert.True(row.gameObject.activeInHierarchy, width + "x" + height + " combat controls hidden");
        Assert.False(Overlaps(row, body), width + "x" + height + " combat controls/body");
        Assert.False(Overlaps(row, gauges), width + "x" + height + " combat controls/gauges");

        Rect rowRect = WorldRect(row);
        for (int i = 0; i < buttons.Length; i++)
        {
            Rect buttonRect = WorldRect(buttons[i]);
            Assert.True(Contains(rowRect, buttonRect), width + "x" + height + " combat button outside row " + buttons[i].gameObject.name);
            for (int j = i + 1; j < buttons.Length; j++)
            {
                Assert.False(Overlaps(buttons[i], buttons[j]), width + "x" + height + " combat button overlap " + i + "/" + j);
            }
        }
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

    private static TMP_Text FindText(PrototypePlayerHudRenderer playerHud, string objectName)
    {
        TMP_Text[] texts = playerHud.GetComponentsInChildren<TMP_Text>(true);
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

    private static bool Contains(Rect outer, Rect inner)
    {
        const float epsilon = 0.5f;
        return inner.xMin >= outer.xMin - epsilon
            && inner.xMax <= outer.xMax + epsilon
            && inner.yMin >= outer.yMin - epsilon
            && inner.yMax <= outer.yMax + epsilon;
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
