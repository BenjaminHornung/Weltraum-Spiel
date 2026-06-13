#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

public class PrototypePlayerHudValidationTests
{
    [SetUp]
    public void SetUp()
    {
        PrototypePlayerHudSnapshotBuilder.InvalidateFallbackFindCaches();
    }

    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        PrototypeNavigationObstacleRegistry.ClearForTests();
        PrototypePlayerHudSnapshotBuilder.InvalidateFallbackFindCaches();
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
            plan.activeSegmentType = PrototypeTrajectorySegmentType.AvoidanceBurn;
            plan.segments = new[]
            {
                new PrototypeTrajectorySegment(
                    PrototypeTrajectorySegmentType.AvoidanceBurn,
                    6f,
                    Vector3.forward,
                    0.65f,
                    9.5f,
                    0.22f,
                    18f,
                    120f),
                new PrototypeTrajectorySegment(
                    PrototypeTrajectorySegmentType.Brake,
                    3.5f,
                    Vector3.back,
                    1f,
                    7f,
                    0.18f,
                    18f,
                    10f),
                new PrototypeTrajectorySegment(
                    PrototypeTrajectorySegmentType.Hold,
                    1f,
                    Vector3.zero,
                    0f,
                    0f,
                    0f,
                    18f,
                    0f)
            };
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
            Assert.That(snapshot.Navigation.PlanAuthorityLabel, Does.Contain("Strict flight plan"));
            Assert.That(snapshot.Navigation.ActiveSegmentLabel, Does.Contain("Avoid"));
            Assert.That(snapshot.Navigation.TotalPlanDurationSeconds, Is.EqualTo(10.5f).Within(0.001f));
            Assert.That(snapshot.Navigation.TotalPlanFuelKg, Is.EqualTo(0.40f).Within(0.001f));
            Assert.That(snapshot.Navigation.ManeuverStepRows.Length, Is.GreaterThanOrEqualTo(3));
            Assert.That(snapshot.Navigation.ManeuverStepRows[0], Does.Contain("T+0.0s"));
            Assert.That(snapshot.Navigation.ManeuverStepRows[0], Does.Contain("Avoid"));
            Assert.That(snapshot.Navigation.ManeuverStepRows[0], Does.Contain("MAIN 65%"));
            Assert.That(snapshot.Navigation.ManeuverStepRows[0], Does.Contain("fuel 0.22kg"));
            MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(bodyMethod);
            string body = (string)bodyMethod.Invoke(null, new object[] { snapshot.Navigation });
            Assert.That(body, Does.Contain("Authority: Strict flight plan"));
            Assert.That(body, Does.Contain("Schedule 10.5s"));
            Assert.That(body, Does.Contain("Steps:"));
            Assert.That(body, Does.Contain("1 T+0.0s-6.0s Avoid | MAIN 65%"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("Candidate"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("requested"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.AlignForBurn), Is.EqualTo("Zum Schub ausrichten"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.FinalApproach), Is.EqualTo("Endanflug"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.Complete), Is.EqualTo("Angekommen"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.Failed), Is.EqualTo("Autopilot nicht moeglich"));
        }
    }

    [Test]
    public void NavigationSnapshotUsesEmittedFlightPlanForPlannerScheduleRows()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 260f);
            rig.Ship.Body.linearVelocity = Vector3.forward * 14f;
            rig.Autopilot.EvaluateMetrics();

            PrototypeShipPlanningSnapshot shipSnapshot = PrototypeShipPlanningSnapshotBuilder.Build(rig.Ship.Ship.transform);
            PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
                new PrototypeTrajectorySnapshot(
                    rig.Ship.Body.worldCenterOfMass,
                    rig.Ship.Body.linearVelocity,
                    rig.Autopilot.CurrentTarget.Position,
                    rig.Ship.Ship.transform.forward,
                    rig.Ship.Body.mass,
                    8f,
                    rig.Ship.Rcs.TranslationForce,
                    8f,
                    shipSnapshot.mainThrustNewtons,
                    shipSnapshot.mainFuelKgPerSecond,
                    shipSnapshot.currentFuelKg,
                    10f,
                    1f,
                    0.2f),
                PrototypeObstacleDetectionResult.Clear(8f),
                shipSnapshot,
                3f,
                0.02f);
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

            Assert.True(plan.flightPlan.IsValid);
            Assert.That(snapshot.Navigation.PlanAuthorityLabel, Does.Contain("Flight plan emitted"));
            Assert.That(snapshot.Navigation.PlanAuthorityLabel, Does.Contain("executor pending"));
            Assert.That(snapshot.Navigation.TotalPlanDurationSeconds, Is.EqualTo(plan.flightPlan.totalDurationSeconds).Within(0.001f));
            Assert.That(snapshot.Navigation.TotalPlanFuelKg, Is.EqualTo(plan.flightPlan.totalExpectedFuelKg).Within(0.001f));
            Assert.That(snapshot.Navigation.RouteWorldPoints.Length, Is.GreaterThan(3));
            Assert.That(snapshot.Navigation.ManeuverStepRows.Any(row => row.Contains("Main burn")), Is.True);
            Assert.That(snapshot.Navigation.ManeuverStepRows.Any(row => row.Contains("Flip retrograde")), Is.True);
            Assert.That(snapshot.Navigation.ManeuverStepRows.Any(row => row.Contains("Brake burn")), Is.True);

            MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(bodyMethod);
            string body = (string)bodyMethod.Invoke(null, new object[] { snapshot.Navigation });
            Assert.That(body, Does.Contain("Authority: Flight plan emitted"));
            Assert.That(body, Does.Contain("Steps:"));
            Assert.That(body, Does.Contain("Flip retrograde"));
            Assert.That(body, Does.Not.Contain("diagnostic preview only"));
        }
    }

    [Test]
    public void NavigationSnapshotFallsBackToDirectRouteWhenPredictedRouteIsEmpty()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 220f);
            builder.CreateObstacle("PlayerHudNonBlockingObstacle", new Vector3(80f, 0f, 120f), 8f);

            PrototypeTrajectoryPlan plan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
            plan.predictedPath = new Vector3[0];
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
            Assert.That(snapshot.Navigation.RouteWorldPoints.Length, Is.EqualTo(2), "direct route fallback points");
            Assert.That(snapshot.Navigation.RouteWorldPoints[0], Is.EqualTo(rig.Ship.Ship.transform.position));
            Assert.That(snapshot.Navigation.RouteWorldPoints[1], Is.EqualTo(rig.Autopilot.CurrentTarget.Position));
            Assert.That(snapshot.Navigation.RouteModeLabel, Is.EqualTo("Route: Direkt"));
            Assert.That(snapshot.Navigation.ActiveObstacleCount, Is.GreaterThanOrEqualTo(1));
            Assert.That(snapshot.Navigation.ObstacleSummaryLabel, Does.Contain("active"));
            Assert.That(snapshot.Navigation.ObstacleSummaryLabel, Does.Contain("no blocking cue"));

            MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(bodyMethod);
            string body = (string)bodyMethod.Invoke(null, new object[] { snapshot.Navigation });
            Assert.That(body, Does.Contain("Route: Direkt 2 pts"));
            Assert.That(body, Does.Contain("Obstacles:"));
            Assert.That(body, Does.Contain("no blocking cue"));

            MethodInfo mapLabelMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerMapLabel",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(mapLabelMethod);
            string mapLabel = (string)mapLabelMethod.Invoke(null, new object[] { snapshot });
            string[] mapLabelParts = mapLabel.Split(new[] { " | " }, System.StringSplitOptions.None);
            Assert.That(mapLabelParts.Length, Is.GreaterThanOrEqualTo(4));
            Assert.That(mapLabelParts[0], Is.EqualTo("Direct 2"));
            Assert.That(mapLabelParts[1], Is.EqualTo("No preview"));
            Assert.That(mapLabelParts[2], Does.Match("^(250 m|1 km|2\\.5 km|5 km)$"));
            Assert.That(mapLabelParts[2], Does.Not.StartWith("R "));
            Assert.That(mapLabelParts[3], Does.Contain("contact"));
        }
    }

    [Test]
    public void NavigationSnapshotUsesCelestialContextWithCatalog()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 220f);
            CelestialBodyCatalog catalog = Resources.Load<CelestialBodyCatalog>(CelestialBodyCatalog.ResourcePath);
            Assert.NotNull(catalog, $"Expected catalog at {CelestialBodyCatalog.ResourcePath}");

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.Ship.transform,
                rig.Ship.Body,
                rig.Ship.Stats,
                rig.Ship.Controller,
                rig.Autopilot,
                null,
                null,
                null,
                null,
                null,
                null,
                catalog: catalog);

            Assert.True(snapshot.Navigation.Visible, "navigation snapshot must stay visible with catalog");
            Assert.True(snapshot.Navigation.CelestialContext.HasContext, "celestial context should be present with catalog");
            Assert.That(snapshot.Navigation.CelestialContext.PilotContextLabel, Does.StartWith("Near "));
            Assert.That(snapshot.Navigation.CelestialContext.PilotContextLabel, Does.Contain(snapshot.Navigation.CelestialContext.DistanceLabel));

            MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(bodyMethod);
            string body = (string)bodyMethod.Invoke(null, new object[] { snapshot.Navigation });
            Assert.That(body, Does.Contain(snapshot.Navigation.CelestialContext.PilotContextLabel));
            if (!string.IsNullOrWhiteSpace(snapshot.Navigation.CelestialContext.DebugBodyId))
            {
                Assert.That(body, Does.Not.Contain(snapshot.Navigation.CelestialContext.DebugBodyId));
            }
            if (!string.IsNullOrWhiteSpace(snapshot.Navigation.CelestialContext.DebugParentBodyId))
            {
                Assert.That(body, Does.Not.Contain(snapshot.Navigation.CelestialContext.DebugParentBodyId));
            }
        }
    }

    [Test]
    public void NavigationPlannerBodyShowsCelestialContextWithActiveObstacleDiagnostics()
    {
        MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "BuildNavigationPlannerBody",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(bodyMethod);

        var context = new PrototypePlayerNavigationCelestialContext(
            true,
            "Helios",
            "Sol",
            "250 m",
            "Near Helios | 250 m",
            "",
            "",
            "1x");

        var navigation = new PrototypePlayerNavigationSnapshot(
            true,
            "Test target",
            "Waypoint",
            1200f,
            10f,
            -8f,
            2f,
            "ETA 0",
            "Bereit",
            "Direkter Kurs",
            "Route: Direkt",
            "Maneuver: Direkt",
            10f,
            0f,
            0f,
            System.Array.Empty<string>(),
            System.Array.Empty<Vector3>(),
            default,
            false,
            Vector3.zero,
            string.Empty,
            1,
            1,
            "Authority: Legacy live gates",
            "Active: Direkter Kurs",
            "Replan: obstacle cue",
            "Plan: none",
            "Track: --",
            "Cmd: --",
            0f,
            0f,
            System.Array.Empty<string>(),
            2,
            "2 active | cue Asteroid",
            context);

        string body = (string)bodyMethod.Invoke(null, new object[] { navigation });
        Assert.That(body, Does.Contain(context.PilotContextLabel));
        Assert.That(body, Does.Contain("Replan: obstacle cue"));
        Assert.That(body, Does.Contain("Obstacles:"));
        Assert.That(body, Does.Contain("2 active | cue Asteroid"));
        Assert.That(
            body,
            Does.Contain(context.PilotContextLabel + " | Replan: obstacle cue | Obstacles: 2 active | cue Asteroid"));
    }

    [Test]
    public void NavigationPlannerBodySkipsDebugBodyAndParentIdsForMissingCelestialDisplayNames()
    {
        MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "BuildNavigationPlannerBody",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(bodyMethod);

        var fallbackContext = new PrototypePlayerNavigationCelestialContext(
            true,
            string.Empty,
            string.Empty,
            "250 m",
            "Near Unknown body | 250 m",
            "RAW_BODY_42",
            "RAW_PARENT_42",
            "1x");

        var navigation = new PrototypePlayerNavigationSnapshot(
            true,
            "Fallback target",
            "Waypoint",
            1200f,
            10f,
            -8f,
            2f,
            "ETA 0",
            "Bereit",
            "Direkter Kurs",
            "Route: Direkt",
            "Maneuver: Direkt",
            10f,
            0f,
            0f,
            System.Array.Empty<string>(),
            System.Array.Empty<Vector3>(),
            default,
            false,
            Vector3.zero,
            string.Empty,
            1,
            1,
            celestialContext: fallbackContext);

        string body = (string)bodyMethod.Invoke(null, new object[] { navigation });
        Assert.That(body, Does.Not.Contain(fallbackContext.DebugBodyId));
        Assert.That(body, Does.Not.Contain(fallbackContext.DebugParentBodyId));
        Assert.That(body, Does.Not.Contain("around"));
        Assert.That(body, Does.Contain(fallbackContext.BodyDisplayName));
        Assert.That(body, Does.Contain(fallbackContext.PilotContextLabel));
    }

    [Test]
    public void CelestialContextDistanceFormattingUsesMkmOrAuForLargeDistances()
    {
        MethodInfo formatMethod = typeof(PrototypePlayerHudSnapshotBuilder).GetMethod(
            "FormatCelestialContextDistance",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(formatMethod);

        string kmLabel = (string)formatMethod.Invoke(null, new object[] { 999_999f });
        string mkmLabel = (string)formatMethod.Invoke(null, new object[] { 1_500_000f });
        string auBoundaryLabel = (string)formatMethod.Invoke(null, new object[] { 1_000_000f });
        string auLabel = (string)formatMethod.Invoke(null, new object[] { 149_597_870_700f });

        Assert.That(kmLabel, Is.EqualTo("1000.0 km"));
        Assert.That(auBoundaryLabel, Is.EqualTo("1.0 Mkm"));
        Assert.That(mkmLabel, Does.Contain("Mkm"));
        Assert.That(auLabel, Does.Contain("AU"));
        Assert.That(auLabel, Is.EqualTo("1.00 AU"));
    }

    [Test]
    public void NavigationSnapshotSkipsCelestialContextWithoutCatalog()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 220f);

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

            Assert.True(snapshot.Navigation.Visible, "navigation snapshot must stay visible without catalog");
            Assert.False(snapshot.Navigation.CelestialContext.HasContext, "celestial context should remain absent without catalog");

            MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "BuildNavigationPlannerBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.NotNull(bodyMethod);
            string body = (string)bodyMethod.Invoke(null, new object[] { snapshot.Navigation });
            Assert.That(body, Does.Contain(snapshot.Navigation.ReplanStatusLabel + " | Obstacles:"));
            Assert.That(body, Does.Not.Contain("Near "));
        }
    }

    [Test]
    public void NavigationPlannerMapLabelUsesNoRouteWhenRouteIsMissing()
    {
        MethodInfo bodyMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "BuildNavigationPlannerBody",
            BindingFlags.Static | BindingFlags.NonPublic);
        MethodInfo mapLabelMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "BuildNavigationPlannerMapLabel",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(bodyMethod);
        Assert.NotNull(mapLabelMethod);

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(
                    PrototypePlayerRadarBlipKind.Navigation,
                    "Waypoint",
                    new Vector3(20f, 0f, 120f)),
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        var noRouteNavigation = new PrototypePlayerNavigationSnapshot(
            true,
            "No target",
            "Waypoint",
            0f,
            0f,
            0f,
            0f,
            "--",
            "Ziel gewaehlt",
            "Direkter Kurs",
            "Route: Direkt",
            "Manoever: Kein Ziel",
            0f,
            0f,
            0f,
            new string[0],
            new Vector3[0],
            PrototypeTrajectoryPreviewSnapshot.Unavailable("Trajectory Preview", 0, 0f),
            false,
            Vector3.zero,
            string.Empty,
            0,
            0);

        PrototypePlayerHudSnapshot baseSnapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(true),
            default,
            null,
            radar);

        PrototypePlayerHudSnapshot navigationMissingRouteSnapshot = new PrototypePlayerHudSnapshot(
            baseSnapshot.Flight,
            noRouteNavigation,
            baseSnapshot.Combat,
            baseSnapshot.Arena,
            baseSnapshot.Docking,
            baseSnapshot.ShipStatus,
            baseSnapshot.Warnings,
            baseSnapshot.AssistChips,
            baseSnapshot.MarkerModel,
            baseSnapshot.Radar,
            baseSnapshot.TargetIndicators,
            baseSnapshot.ShipWorldPosition,
            baseSnapshot.ShipForward,
            baseSnapshot.NavigationTargetWorldPosition,
            baseSnapshot.CombatTargetWorldPosition);

        string body = (string)bodyMethod.Invoke(null, new object[] { navigationMissingRouteSnapshot.Navigation });
        string mapLabel = (string)mapLabelMethod.Invoke(null, new object[] { navigationMissingRouteSnapshot });
        string[] mapLabelParts = mapLabel.Split(new[] { " | " }, System.StringSplitOptions.None);

        Assert.That(body, Does.Contain("No route"));
        Assert.That(body, Does.Not.Contain("Direkte Route"));
        Assert.That(mapLabel, Does.StartWith("No route"));
        Assert.That(mapLabelParts.Length, Is.GreaterThanOrEqualTo(4));
        Assert.That(mapLabelParts[0], Is.EqualTo("No route"));
        Assert.That(mapLabelParts[1], Is.EqualTo("No preview"));
        Assert.That(mapLabelParts[2], Is.EqualTo("1 km"));
        Assert.That(mapLabelParts[3], Is.EqualTo("1 contact"));
        Assert.That(mapLabel, Does.Not.Contain("Direkte Route"));
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
    public void NavigationPlannerMapGridUsesDimmerAlphaThanCompactRadarGrid()
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
                    "Waypoint",
                    new Vector3(20f, 0f, 120f))
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

        float compactGridAlphaBefore = FindImage(playerHud, "RadarGridSegment0").color.a;

        FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);
        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(true),
                default,
                null,
                radar));

        float compactGridAlphaAfter = FindImage(playerHud, "RadarGridSegment0").color.a;
        float plannerGridAlpha = FindImage(playerHud, "NavigationPlannerMapGridSegment0").color.a;

        Assert.That(compactGridAlphaAfter, Is.EqualTo(compactGridAlphaBefore).Within(0.0001f));
        Assert.That(plannerGridAlpha, Is.LessThan(compactGridAlphaAfter));
    }

    [Test]
    public void NavigationPlannerMapFiltersGenericBlipsWhenNavigationIsVisible()
    {
        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "Waypoint", new Vector3(20f, 0f, 120f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedNavigation, "Selected Waypoint", new Vector3(30f, 0f, 130f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Combat, "Bandit", new Vector3(40f, 0f, 180f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedCombat, "Selected Bandit", new Vector3(50f, 0f, 160f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Objective, "Objective", new Vector3(60f, 0f, 200f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Docking, "Docked Outpost", new Vector3(65f, 0f, 230f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "Far Route", new Vector3(70f, 0f, 280f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Combat, "Distant Bandit", new Vector3(75f, 0f, 320f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "Very Far Route", new Vector3(85f, 0f, 420f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Beacon", new Vector3(70f, 0f, 220f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Gate, "Gate", new Vector3(80f, 0f, 240f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Station, "Station", new Vector3(90f, 0f, 260f))
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo mapBlipMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "GetNavigationPlannerMapBlips",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(mapBlipMethod);

        PrototypePlayerHudSnapshot withTargetSnapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(true),
            default,
            null,
            radar);

        PrototypePlayerRadarBlip[] filteredBlips = (PrototypePlayerRadarBlip[])mapBlipMethod.Invoke(
            null,
            new object[] { withTargetSnapshot });
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.SelectedNavigation), Is.EqualTo("Selected Waypoint"));
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.SelectedCombat), Is.EqualTo("Selected Bandit"));
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.Objective), Is.EqualTo("Objective"));
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.Navigation), Is.Null, "lowest-priority generic navigation is not shown with capped planner contacts");
        Assert.That(filteredBlips[filteredBlips.Length - 3].Kind, Is.EqualTo(PrototypePlayerRadarBlipKind.SelectedNavigation), "selected navigation remains first");
        Assert.That(filteredBlips[filteredBlips.Length - 2].Kind, Is.EqualTo(PrototypePlayerRadarBlipKind.SelectedCombat), "selected combat remains on top");
        Assert.That(filteredBlips[filteredBlips.Length - 1].Label, Is.EqualTo("Objective"), "objective remains on top");
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.Beacon), Is.Null);
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.Gate), Is.Null);
        Assert.That(GetBlipLabel(filteredBlips, PrototypePlayerRadarBlipKind.Station), Is.Null);
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.Objective), Is.EqualTo(filteredBlips.Length - 1));
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.SelectedNavigation), Is.EqualTo(filteredBlips.Length - 3));
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.SelectedCombat), Is.EqualTo(filteredBlips.Length - 2));
        Assert.That(filteredBlips.Length, Is.EqualTo(3), "lower-priority actionable contacts are clipped for planner clarity");
        Assert.That(filteredBlips[filteredBlips.Length - 1].Label, Is.Not.EqualTo("Very Far Route"));

        PrototypePlayerHudSnapshot withoutTargetSnapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(false),
            default,
            null,
            radar);
        PrototypePlayerRadarBlip[] unfilteredBlips = (PrototypePlayerRadarBlip[])mapBlipMethod.Invoke(
            null,
            new object[] { withoutTargetSnapshot });
        Assert.That(unfilteredBlips.Length, Is.EqualTo(radar.Blips.Length), "no filter when planner has no navigation target");
    }

    [Test]
    public void CompactRadarFiltersAndOrdersGenericContactsBeforeActionable()
    {
        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 0", new Vector3(10f, 0f, 10f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 1", new Vector3(20f, 0f, 20f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 2", new Vector3(30f, 0f, 30f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 3", new Vector3(40f, 0f, 40f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 4", new Vector3(50f, 0f, 50f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 5", new Vector3(60f, 0f, 60f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 6", new Vector3(70f, 0f, 70f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 7", new Vector3(80f, 0f, 80f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 8", new Vector3(90f, 0f, 90f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "Generic 9", new Vector3(100f, 0f, 100f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedNavigation, "SelNav", new Vector3(120f, 0f, 120f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedCombat, "SelCombat", new Vector3(130f, 0f, 130f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Objective, "Objective", new Vector3(140f, 0f, 140f)),
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo compactBlipMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "GetCompactRadarBlips",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(compactBlipMethod);

        PrototypePlayerHudSnapshot withTargetSnapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(true),
            default,
            null,
            radar);

        PrototypePlayerRadarBlip[] filteredBlips = (PrototypePlayerRadarBlip[])compactBlipMethod.Invoke(
            null,
            new object[] { withTargetSnapshot });

        Assert.That(filteredBlips.Length, Is.EqualTo(8), "compact limit enforces clipped contacts");
        Assert.That(filteredBlips[0].Label, Is.EqualTo("Generic 0"));
        Assert.That(filteredBlips[1].Label, Is.EqualTo("Generic 1"));
        Assert.That(filteredBlips[2].Label, Is.EqualTo("Generic 2"));
        Assert.That(filteredBlips[3].Label, Is.EqualTo("Generic 3"));
        Assert.That(filteredBlips[4].Label, Is.EqualTo("Generic 4"));
        Assert.That(filteredBlips[5].Label, Is.EqualTo("SelNav"));
        Assert.That(filteredBlips[6].Label, Is.EqualTo("SelCombat"));
        Assert.That(filteredBlips[7].Label, Is.EqualTo("Objective"));
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.Objective), Is.EqualTo(7), "selected/actionable remains visible at highest layer");
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.SelectedCombat), Is.EqualTo(6), "selected combat remains on top");
        Assert.That(IndexOfBlipKind(filteredBlips, PrototypePlayerRadarBlipKind.SelectedNavigation), Is.EqualTo(5), "selected navigation remains on top");
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
    public void RadarRangeModeDefaultsToAutoAndCanBeSetToManual()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range AUTO TEST",
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

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range AUTO TEST"));

        MethodInfo setModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "SetMinimapRangeMode",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(setModeMethod);

        setModeMethod.Invoke(playerHud, new object[] { 1 });
        PrototypePlayerHudSnapshot manualRangeSnapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            manualRangeSnapshot);

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 250 m"));
    }

    [Test]
    public void RadarRangeModeCyclesAndClamps()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range AUTO TEST",
            Vector3.zero,
            Vector3.forward,
            new PrototypePlayerRadarBlip[0],
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo setModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "SetMinimapRangeMode",
            BindingFlags.Instance | BindingFlags.NonPublic);
        MethodInfo stepModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "StepMinimapRangeMode",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(setModeMethod);
        Assert.NotNull(stepModeMethod);

        setModeMethod.Invoke(playerHud, new object[] { 4 });
        PrototypePlayerHudSnapshot snapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            snapshot);
        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 5 km"));

        stepModeMethod.Invoke(playerHud, new object[] { 1 });
        snapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            snapshot);
        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 5 km"));

        setModeMethod.Invoke(playerHud, new object[] { 1 });
        snapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            snapshot);
        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 250 m"));

        stepModeMethod.Invoke(playerHud, new object[] { -1 });
        snapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            snapshot);
        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range AUTO TEST"));

        stepModeMethod.Invoke(playerHud, new object[] { -1 });
        snapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            snapshot);
        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range AUTO TEST"));
    }

    [Test]
    public void RadarRangeModeOverridesNavigationPlannerMapLabel()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(
                    PrototypePlayerRadarBlipKind.Navigation,
                    "Waypoint",
                    new Vector3(20f, 0f, 120f))
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
                CreateNavigationSnapshot(true),
                default,
                null,
                radar));

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 1 km | 1 contact"));
        Assert.That(FindText(playerHud, "NavigationPlannerMapText").text, Does.Contain("1 km"));

        MethodInfo setModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "SetMinimapRangeMode",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(setModeMethod);
        setModeMethod.Invoke(playerHud, new object[] { 4 });

        PrototypePlayerHudSnapshot plannerSnapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(true),
                default,
                null,
                radar));
        ApplySnapshotForTest(
            playerHud,
            plannerSnapshot);

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 5 km | 1 contact"));
        Assert.That(FindText(playerHud, "NavigationPlannerMapText").text, Does.Contain("5 km"));
    }

    [Test]
    public void ManualRangeModeFiltersOutFarGenericRadarContactsButKeepsActionableBlips()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        MethodInfo setModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "SetMinimapRangeMode",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(setModeMethod);
        setModeMethod.Invoke(playerHud, new object[] { 1 });

        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "BeaconNear", new Vector3(30f, 0f, 80f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "BeaconFar", new Vector3(420f, 0f, 0f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Beacon, "BeaconVeryFar", new Vector3(2800f, 0f, 0f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "NavFar", new Vector3(4200f, 0f, 0f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Objective, "Objective", new Vector3(1800f, 0f, 0f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedCombat, "SelCombat", new Vector3(2400f, 0f, 0f)),
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        MethodInfo compactBlipMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "GetCompactRadarBlips",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(compactBlipMethod);

        PrototypePlayerHudSnapshot manualRangeSnapshot = ApplyMinimapRangeOverrideForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(false),
                default,
                null,
                radar));

        ApplySnapshotForTest(
            playerHud,
            manualRangeSnapshot);

        Assert.That(FindText(playerHud, "RadarText").text, Is.EqualTo("Range 250 m | 4 contacts"));

        bool hasNearGeneric = false;
        bool hasFarGeneric = false;
        bool hasActionableNav = false;
        PrototypePlayerRadarBlip[] compactBlips = (PrototypePlayerRadarBlip[])compactBlipMethod.Invoke(
            null,
            new object[] { manualRangeSnapshot });
        for (int i = 0; i < compactBlips.Length; i++)
        {
            if (compactBlips[i].Label == "BeaconNear")
            {
                hasNearGeneric = true;
            }

            if (compactBlips[i].Label == "BeaconFar" || compactBlips[i].Label == "BeaconVeryFar")
            {
                hasFarGeneric = true;
            }

            if (compactBlips[i].Kind == PrototypePlayerRadarBlipKind.Navigation)
            {
                hasActionableNav = true;
            }
        }

        Assert.True(hasNearGeneric, "near generic contact kept");
        Assert.False(hasFarGeneric, "far generic contact removed");
        Assert.True(hasActionableNav, "actionable contact kept");
        Assert.That(manualRangeSnapshot.Radar.Blips.Length, Is.EqualTo(4));
    }

    [Test]
    public void NavigationPlannerRangeButtonsUseSharedMinimapRangeState()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            string GetPlannerRangeFromMapLabel(string mapLabel)
            {
                string[] mapParts = mapLabel.Split(new[] { " | " }, System.StringSplitOptions.None);
                Assert.That(mapParts.Length, Is.GreaterThanOrEqualTo(3), "planner map label should include route, preview, range tokens");
                return mapParts[2].Trim();
            }

            PrototypeShipRig rig = builder.CreateShip("PlayerHudNavPlannerRangeSyncShip");

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
            playerHud.Bind(rig.Ship.transform, rig.Stats, rig.Body);
            playerHud.RefreshNow();
            FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);

            MethodInfo setModeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
                "SetMinimapRangeMode",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.NotNull(setModeMethod);

            var radar = new PrototypePlayerRadarSnapshot(
                1000f,
                "Range 1 km",
                Vector3.zero,
                Vector3.forward,
                new[]
                {
                    new PrototypePlayerRadarBlip(
                        PrototypePlayerRadarBlipKind.Navigation,
                        "Planner Nav Waypoint",
                        new Vector3(20f, 0f, 120f))
                },
                new Vector3[0],
                new Vector3[0],
                false,
                Vector3.zero);

            PrototypePlayerHudSnapshot withTargetSnapshot = CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(true),
                default,
                null,
                radar);

            setModeMethod.Invoke(playerHud, new object[] { 3 });
            PrototypePlayerHudSnapshot snapshot = ApplyMinimapRangeOverrideForTest(playerHud, withTargetSnapshot);
            ApplySnapshotForTest(playerHud, snapshot);

            string radarRange = FindText(playerHud, "RadarText").text.Split('|')[0].Trim();
            string plannerRange = GetPlannerRangeFromMapLabel(FindText(playerHud, "NavigationPlannerMapText").text);
            Assert.That(radarRange, Is.EqualTo("Range 2.5 km"));
            Assert.That(plannerRange, Is.EqualTo("2.5 km"));

            Button plannerMinus = FindButton(playerHud, "NavPlannerRangeMinus");
            Button plannerPlus = FindButton(playerHud, "NavPlannerRangePlus");
            plannerMinus.onClick.Invoke();

            snapshot = ApplyMinimapRangeOverrideForTest(playerHud, withTargetSnapshot);
            ApplySnapshotForTest(playerHud, snapshot);
            radarRange = FindText(playerHud, "RadarText").text.Split('|')[0].Trim();
            plannerRange = GetPlannerRangeFromMapLabel(FindText(playerHud, "NavigationPlannerMapText").text);
            Assert.That(radarRange, Is.EqualTo("Range 1 km"));
            Assert.That(plannerRange, Is.EqualTo("1 km"));

            plannerPlus.onClick.Invoke();

            snapshot = ApplyMinimapRangeOverrideForTest(playerHud, withTargetSnapshot);
            ApplySnapshotForTest(playerHud, snapshot);
            radarRange = FindText(playerHud, "RadarText").text.Split('|')[0].Trim();
            plannerRange = GetPlannerRangeFromMapLabel(FindText(playerHud, "NavigationPlannerMapText").text);
            Assert.That(radarRange, Is.EqualTo("Range 2.5 km"));
            Assert.That(plannerRange, Is.EqualTo("2.5 km"));

            plannerPlus.onClick.Invoke();

            snapshot = ApplyMinimapRangeOverrideForTest(playerHud, withTargetSnapshot);
            ApplySnapshotForTest(playerHud, snapshot);
            radarRange = FindText(playerHud, "RadarText").text.Split('|')[0].Trim();
            plannerRange = GetPlannerRangeFromMapLabel(FindText(playerHud, "NavigationPlannerMapText").text);
            Assert.That(radarRange, Is.EqualTo("Range 5 km"));
            Assert.That(plannerRange, Is.EqualTo("5 km"));
        }
    }

    [Test]
    public void NavigationPlannerMapRenderDeemphasizesSecondaryBlips()
    {
        var radar = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "Secondary waypoint", new Vector3(40f, 0f, 170f)),
                new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.SelectedNavigation, "Primary waypoint", new Vector3(20f, 0f, 120f))
            },
            new Vector3[0],
            new Vector3[0],
            false,
            Vector3.zero);

        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);

        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(true),
                default,
                null,
                radar));

        Image secondaryBlip = FindImage(playerHud, "NavigationPlannerMapBlip0");
        Image primaryBlip = FindImage(playerHud, "NavigationPlannerMapBlip1");
        Assert.That(primaryBlip.rectTransform.sizeDelta.x, Is.GreaterThan(secondaryBlip.rectTransform.sizeDelta.x));
        Assert.That(primaryBlip.rectTransform.sizeDelta.y, Is.GreaterThan(secondaryBlip.rectTransform.sizeDelta.y));
        Assert.That(primaryBlip.color.a, Is.GreaterThan(secondaryBlip.color.a), "primary blip should remain visually stronger");
        Assert.That(secondaryBlip.color.a, Is.LessThan(0.55f), "secondary blip should be clearly muted");
        Assert.That(primaryBlip.color.a - secondaryBlip.color.a, Is.GreaterThan(0.4f), "primary vs secondary alpha gap should be strong");
        Assert.That(primaryBlip.color.a, Is.GreaterThan(0.8f), "primary blip should stay prominent");
    }

    [Test]
    public void NavigationPlannerMapExtendsClusteredRouteToSelectedTarget()
    {
        Vector3 shipPosition = Vector3.zero;
        Vector3 selectedTarget = new Vector3(0f, 0f, 1900f);
        var radar = new PrototypePlayerRadarSnapshot(
            2500f,
            "Range 2.5 km",
            shipPosition,
            Vector3.forward,
            new[]
            {
                new PrototypePlayerRadarBlip(
                    PrototypePlayerRadarBlipKind.SelectedNavigation,
                    "Nav Waypoint 2",
                    selectedTarget,
                    10f)
            },
            new[]
            {
                shipPosition,
                new Vector3(0f, 0f, 28f),
                new Vector3(0f, 0f, 44f)
            },
            new Vector3[0],
            false,
            Vector3.zero);

        PrototypePlayerHudSnapshot snapshot = CreateHudSnapshot(
            CreateCombatSnapshot(false),
            CreateDockingSnapshot(false),
            CreateNavigationSnapshot(true),
            default,
            null,
            radar);

        MethodInfo routeMethod = typeof(PrototypePlayerHudRenderer).GetMethod(
            "BuildNavigationPlannerRouteWorldPoints",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(routeMethod);

        Vector3[] route = (Vector3[])routeMethod.Invoke(null, new object[] { snapshot, radar.RouteWorldPoints });

        Assert.That(route.Length, Is.EqualTo(4));
        Assert.That(route[0], Is.EqualTo(shipPosition));
        Assert.That(route[route.Length - 1], Is.EqualTo(selectedTarget));
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
        GameObject staleCameraObject = new GameObject("Main Camera");
        staleCameraObject.tag = "MainCamera";
        staleCameraObject.AddComponent<Camera>();
        staleCameraObject.AddComponent<PrototypePlayerHudRenderer>();
        staleCameraObject.AddComponent<PrototypePlayerHudRenderer>();

        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildBuiltInVariant(0);

        Assert.NotNull(Camera.main);
        PrototypePlayerHudRenderer playerHud = Camera.main.GetComponent<PrototypePlayerHudRenderer>();
        Assert.NotNull(playerHud);
        Assert.That(Camera.main.GetComponents<PrototypePlayerHudRenderer>().Length, Is.EqualTo(1));
        Assert.NotNull(playerHud.GetComponentInChildren<Canvas>(true));
        Assert.NotNull(Camera.main.GetComponent<PrototypeFlightHud>());
        Assert.NotNull(Camera.main.GetComponent<PrototypeDebugOverlay>());
        var assist = GameObject.Find("PrototypeShip").GetComponent<PrototypeDockingApproachAssist>();
        Assert.NotNull(assist);
        Assert.False(assist.AssistEnabled);

        playerHud.RefreshNow();

        Assert.That(playerHud.LastSnapshot.Flight.FuelMaxKg, Is.GreaterThan(0f));
        Assert.That(playerHud.LastSnapshot.Flight.ControlModeLabel, Is.EqualTo("Cruise"));
        Assert.True(playerHud.LastSnapshot.Navigation.Visible);
        Assert.That(playerHud.LastSnapshot.Navigation.TargetName, Does.Contain("Nav Waypoint"));
        Assert.False(playerHud.LastSnapshot.Docking.Visible);
        Assert.That(Labels(playerHud.LastSnapshot.Warnings), Does.Not.Contain("Ausser Docking-Reichweite"));
        Assert.That(Labels(playerHud.LastSnapshot.Warnings), Does.Not.Contain("Docking n/a"));
    }

    [Test]
    public void PlayerHudRefreshSelfBindsActivePrototypeShipWhenCreatedUnbound()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PrototypeShip");
            PrototypeWaypointManager manager = rig.Ship.AddComponent<PrototypeWaypointManager>();
            manager.EnsureDefaultWaypoints();
            PrototypeWaypointAutopilot autopilot = rig.Ship.AddComponent<PrototypeWaypointAutopilot>();
            autopilot.Bind(manager, rig.Controller, rig.Stats, rig.Body);
            autopilot.SelectTarget(manager.SelectedTarget);
            PrototypeMomentumAssist momentumAssist = rig.Ship.AddComponent<PrototypeMomentumAssist>();
            momentumAssist.Bind(rig.Controller, rig.Body, rig.Stats);
            PrototypeWeaponComputer weaponComputer = rig.Ship.AddComponent<PrototypeWeaponComputer>();
            weaponComputer.Bind(rig.Ship.transform, rig.Stats, null);

            GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
            cameraObject.tag = "MainCamera";
            cameraObject.AddComponent<Camera>();
            PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();

            playerHud.RefreshNow();

            Assert.True(playerHud.HasBoundRuntimeShip);
            Assert.True(playerHud.HasBoundNavigationComputer);
            Assert.True(playerHud.HasBoundMomentumAssist);
            Assert.True(playerHud.HasBoundWeaponComputer);
            Assert.That(playerHud.BoundShipName, Is.EqualTo("PrototypeShip"));
            Assert.That(playerHud.LastSnapshot.ShipStatus.FuelLabel, Does.StartWith("Fuel "));
            Assert.That(playerHud.LastSnapshot.ShipStatus.FuelLabel, Does.Not.Contain("n/a"));
            Assert.True(playerHud.LastSnapshot.Navigation.Visible);
            Assert.That(playerHud.LastSnapshot.Navigation.TargetName, Does.Contain("Nav Waypoint"));
        }
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
        Assert.That(objectiveBody.text, Does.Not.Contain("Reward:"));
    }

    [Test]
    public void ObjectivePanelShowsRewardOnArenaCompletionAndStaysCompactWhenIncomplete()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var activeArena = new PrototypePveArenaSnapshot("Clear the Arena", true, false, 3, 1, "Reward queued: test salvage");
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), activeArena));

        TMP_Text objectiveBody = FindText(playerHud, "ObjectiveBody");
        Assert.That(objectiveBody.text, Does.Not.Contain("Reward:"));

        var completedArena = new PrototypePveArenaSnapshot("Clear the Arena", true, true, 3, 3, "Reward queued: test salvage");
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), completedArena));

        Assert.That(objectiveBody.text, Does.Contain("Targets 3/3"));
        Assert.That(objectiveBody.text, Does.Contain("Reward: Reward queued: test salvage"));
    }

    [Test]
    public void ObjectivePanelShowsRewardPendingOnCompletedArenaWithoutRewardStub()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCameraRewardPending");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();

        var completedArena = new PrototypePveArenaSnapshot("Clear the Arena", true, true, 3, 3, string.Empty);
        ApplySnapshotForTest(playerHud, CreateHudSnapshot(CreateCombatSnapshot(false), CreateDockingSnapshot(false), CreateNavigationSnapshot(false), completedArena));

        TMP_Text objectiveBody = FindText(playerHud, "ObjectiveBody");
        Assert.That(objectiveBody.text, Does.Contain("Reward: Reward pending"));
        Assert.That(objectiveBody.text, Does.Not.Contain("Reward queued"));
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
    public void ResponsiveLayoutKeepsNavigationPlannerMapElementsSeparated()
    {
        GameObject cameraObject = new GameObject("PrototypePlayerHudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypePlayerHudRenderer playerHud = cameraObject.AddComponent<PrototypePlayerHudRenderer>();
        playerHud.RefreshNow();
        FindRect(playerHud, "NavigationPlannerPanel").gameObject.SetActive(true);
        var radarSnapshot = new PrototypePlayerRadarSnapshot(
            1000f,
            "Range 1 km",
            Vector3.zero,
            Vector3.forward,
            new[] { new PrototypePlayerRadarBlip(PrototypePlayerRadarBlipKind.Navigation, "Nav Beacon", new Vector3(20f, 0f, 80f)) },
            new[] { Vector3.zero, new Vector3(0f, 0f, 80f) },
            new Vector3[0],
            false,
            Vector3.zero);

        ApplySnapshotForTest(
            playerHud,
            CreateHudSnapshot(
                CreateCombatSnapshot(false),
                CreateDockingSnapshot(false),
                CreateNavigationSnapshot(true),
                default,
                null,
                radarSnapshot));

        AssertNavigationPlannerMapLayoutSeparated(playerHud, 1280, 720);
        AssertNavigationPlannerMapLayoutSeparated(playerHud, 800, 1400);
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
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Path:"));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Burn "));
            Assert.That(FindText(playerHud, "NavigationPlannerBody").text, Does.Contain("Stop "));
            Assert.True(FindRect(playerHud, "NavigationPlannerMapPanel").gameObject.activeSelf);
            Assert.True(FindRect(playerHud, "NavigationPlannerMapLayer").gameObject.activeInHierarchy);
            Assert.True(FindRect(playerHud, "NavigationPlannerMapGridSegment0").gameObject.activeInHierarchy);
            Assert.That(FindText(playerHud, "NavigationPlannerMapText").text, Does.Contain(" km"));

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

    private static PrototypePlayerHudSnapshot ApplyMinimapRangeOverrideForTest(
        PrototypePlayerHudRenderer playerHud,
        PrototypePlayerHudSnapshot snapshot)
    {
        MethodInfo method = typeof(PrototypePlayerHudRenderer).GetMethod(
            "ApplyMinimapRangeOverride",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return (PrototypePlayerHudSnapshot)method.Invoke(playerHud, new object[] { snapshot });
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

    private static string GetBlipLabel(PrototypePlayerRadarBlip[] blips, PrototypePlayerRadarBlipKind kind)
    {
        for (int i = 0; i < blips.Length; i++)
        {
            if (blips[i].Kind == kind)
            {
                return blips[i].Label;
            }
        }

        return null;
    }

    private static int IndexOfBlipKind(PrototypePlayerRadarBlip[] blips, PrototypePlayerRadarBlipKind kind)
    {
        for (int i = 0; i < blips.Length; i++)
        {
            if (blips[i].Kind == kind)
            {
                return i;
            }
        }

        return -1;
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

    private static void AssertNavigationPlannerMapLayoutSeparated(PrototypePlayerHudRenderer playerHud, int width, int height)
    {
        playerHud.ApplyResponsiveLayoutForTests(width, height);
        Canvas.ForceUpdateCanvases();

        RectTransform panel = FindRect(playerHud, "NavigationPlannerPanel");
        RectTransform body = FindRect(playerHud, "NavigationPlannerBody");
        RectTransform mapPanel = FindRect(playerHud, "NavigationPlannerMapPanel");
        RectTransform mapLayer = FindRect(playerHud, "NavigationPlannerMapLayer");
        RectTransform mapText = FindRect(playerHud, "NavigationPlannerMapText");
        TMP_Text mapLabelText = FindText(playerHud, "NavigationPlannerMapText");
        RectTransform[] rangeButtons =
        {
            FindRect(playerHud, "NavPlannerRangeMinus"),
            FindRect(playerHud, "NavPlannerRangeAuto"),
            FindRect(playerHud, "NavPlannerRangePlus")
        };
        RectTransform[] plannerButtons =
        {
            FindRect(playerHud, "NavPlannerPreviousTarget"),
            FindRect(playerHud, "NavPlannerNextTarget"),
            FindRect(playerHud, "NavPlannerEngage"),
            FindRect(playerHud, "NavPlannerReplan"),
            FindRect(playerHud, "NavPlannerPreview"),
            FindRect(playerHud, "NavPlannerClose")
        };

        Assert.True(panel.gameObject.activeInHierarchy, width + "x" + height + " planner hidden");
        Assert.True(mapPanel.gameObject.activeInHierarchy, width + "x" + height + " planner map hidden");
        Assert.True(mapLayer.gameObject.activeInHierarchy, width + "x" + height + " planner map layer hidden");

        Assert.False(Overlaps(mapPanel, body), width + "x" + height + " planner map panel/body overlap");
        Assert.False(Overlaps(mapLayer, mapText), width + "x" + height + " planner map layer/text overlap");
        Assert.False(Overlaps(mapLayer, body), width + "x" + height + " planner map layer/body overlap");
        Assert.False(Overlaps(mapText, body), width + "x" + height + " planner map text/body overlap");
        Assert.True(Contains(WorldRect(mapPanel), WorldRect(mapLayer)), width + "x" + height + " planner map panel/layer containment");
        Assert.True(Contains(WorldRect(mapPanel), WorldRect(mapText)), width + "x" + height + " planner map panel/text containment");
        Assert.That(mapLabelText.fontSize, Is.GreaterThanOrEqualTo(10f), width + "x" + height + " planner map label font size");
        if (width >= 860)
        {
            Assert.That(mapLayer.rect.width, Is.GreaterThanOrEqualTo(280f), width + "x" + height + " planner map layer footprint");
        }
        else
        {
            Assert.That(mapLayer.rect.width, Is.LessThanOrEqualTo(170f), width + "x" + height + " stacked planner map layer footprint");
        }

        foreach (RectTransform button in plannerButtons)
        {
            Assert.False(Overlaps(button, body), width + "x" + height + " planner button/body overlap " + button.gameObject.name);
            Assert.False(Overlaps(button, mapText), width + "x" + height + " planner button/map text overlap " + button.gameObject.name);
        }

        for (int i = 0; i < plannerButtons.Length; i++)
        {
            for (int j = i + 1; j < plannerButtons.Length; j++)
            {
                Assert.False(
                    Overlaps(plannerButtons[i], plannerButtons[j]),
                    width + "x" + height + " planner bottom buttons overlap " + plannerButtons[i].gameObject.name + " / " + plannerButtons[j].gameObject.name);
            }
        }

        for (int i = 0; i < rangeButtons.Length; i++)
        {
            Assert.False(Overlaps(rangeButtons[i], body), width + "x" + height + " planner range/button overlap " + rangeButtons[i].gameObject.name);
            Assert.False(Overlaps(rangeButtons[i], mapText), width + "x" + height + " planner range/button map text overlap " + rangeButtons[i].gameObject.name);
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

    private static Image FindImage(PrototypePlayerHudRenderer playerHud, string objectName)
    {
        Image[] images = playerHud.GetComponentsInChildren<Image>(true);
        for (int i = 0; i < images.Length; i++)
        {
            if (images[i].gameObject.name == objectName)
            {
                return images[i];
            }
        }

        Assert.Fail("Missing image " + objectName);
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
