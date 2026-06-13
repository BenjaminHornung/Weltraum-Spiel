#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeAutopilotNavigationComputerV2ValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [SetUp]
    public void SetUp()
    {
        DestroyByPrefix("AutopilotV2Validation");
        PrototypeNavigationObstacleRegistry.ClearForTests();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyByPrefix("AutopilotV2Validation");
        PrototypeNavigationObstacleRegistry.ClearForTests();
    }

    [Test]
    public void ObstacleDetector_OverlapAtStart_IsDetected()
    {
        var rig = CreateAutopilotRig();
        GameObject obstacleObject = CreateObstacle("AutopilotV2ValidationOverlap", Vector3.forward * 1.5f, 4f, true, true);
        Physics.SyncTransforms();

        PrototypeObstacleDetectionResult result = rig.Detector.DetectDirectPath(rig.Body, Vector3.forward * 120f, 3f);

        Assert.True(result.detected);
        Assert.AreSame(obstacleObject.GetComponent<PrototypeNavigationObstacle>(), result.obstacle);
        Assert.That(result.distance, Is.EqualTo(0f).Within(0.001f));
        Assert.That(result.hitDistance, Is.EqualTo(0f).Within(0.001f));
    }

    [Test]
    public void ObstacleDetector_MultipleObstacles_SelectsNearestBlocking()
    {
        var rig = CreateAutopilotRig();
        GameObject far = CreateObstacle("AutopilotV2ValidationFar", Vector3.forward * 80f, 4f, true, true);
        GameObject near = CreateObstacle("AutopilotV2ValidationNear", Vector3.forward * 35f, 4f, true, true);
        Physics.SyncTransforms();

        PrototypeObstacleDetectionResult result = rig.Detector.DetectDirectPath(rig.Body, Vector3.forward * 150f, 3f);

        Assert.True(result.detected);
        Assert.AreSame(near.GetComponent<PrototypeNavigationObstacle>(), result.obstacle);
        Assert.AreNotSame(far.GetComponent<PrototypeNavigationObstacle>(), result.obstacle);
    }

    [Test]
    public void ObstacleDetector_NonBlockingObstacle_IsIgnored()
    {
        var rig = CreateAutopilotRig();
        CreateObstacle("AutopilotV2ValidationNonBlocking", Vector3.forward * 35f, 4f, false, true);
        Physics.SyncTransforms();

        PrototypeObstacleDetectionResult result = rig.Detector.DetectDirectPath(rig.Body, Vector3.forward * 150f, 3f);

        Assert.True(result.IsClear);
    }

    [Test]
    public void ObstacleDetector_TriggersAreDetected()
    {
        var rig = CreateAutopilotRig();
        GameObject obstacleObject = CreateObstacle("AutopilotV2ValidationTrigger", Vector3.forward * 45f, 5f, true, true);
        Physics.SyncTransforms();

        PrototypeObstacleDetectionResult result = rig.Detector.DetectDirectPath(rig.Body, Vector3.forward * 150f, 3f);

        Assert.True(result.detected);
        Assert.True(result.collider != null && result.collider.isTrigger);
        Assert.AreSame(obstacleObject.GetComponent<PrototypeNavigationObstacle>(), result.obstacle);
    }

    [Test]
    public void Planner_DirectCandidateWinsWhenClear()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 200f),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.False(plan.avoidanceActive);
        Assert.That(plan.selectedCandidate, Is.EqualTo("direct"));
        Assert.That(plan.navigationPhase, Is.EqualTo(PrototypeAutopilotNavigationPhase.Direct));
        Assert.That(plan.candidateScores.Single().name, Is.EqualTo("direct"));
    }

    [Test]
    public void Planner_AvoidanceCandidateWinsWhenDirectBlocked()
    {
        PrototypeObstacleDetectionResult detection = CreateBlockingDetection();
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 200f),
            detection);

        Assert.True(plan.avoidanceActive);
        Assert.That(plan.selectedCandidate, Is.Not.EqualTo("direct"));
        Assert.That(plan.navigationPhase, Is.EqualTo(PrototypeAutopilotNavigationPhase.AvoidancePlanning));
        Assert.That(plan.avoidanceWaypoint.sqrMagnitude, Is.GreaterThan(0.1f));
        Assert.That(
            plan.segments.Select(segment => segment.type).ToArray(),
            Is.EqualTo(new[]
            {
                PrototypeTrajectorySegmentType.AvoidanceBurn,
                PrototypeTrajectorySegmentType.Coast,
                PrototypeTrajectorySegmentType.Brake,
                PrototypeTrajectorySegmentType.FinalApproach,
                PrototypeTrajectorySegmentType.Hold
            }));
    }

    [Test]
    public void Planner_CandidateScorePenalizesCollision()
    {
        PrototypeObstacleDetectionResult detection = CreateBlockingDetection();
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 200f),
            detection);

        PrototypeTrajectoryCandidateScore direct = plan.candidateScores.Single(score => score.name == "direct");
        PrototypeTrajectoryCandidateScore selected = plan.candidateScores.Single(score => score.name == plan.selectedCandidate);

        Assert.True(direct.collisionPredicted);
        Assert.That(direct.score, Is.LessThan(selected.score));
        Assert.That(direct.reason, Does.Contain("collision"));
    }

    [Test]
    public void Planner_CandidateScorePenalizesImpossibleBrake()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.forward * 80f, Vector3.forward * 65f, maxMainAcceleration: 3f),
            PrototypeObstacleDetectionResult.Clear(8f));

        PrototypeTrajectoryCandidateScore direct = plan.candidateScores.Single(score => score.name == "direct");

        Assert.False(direct.canBrakeBeforeTarget);
    }

    [Test]
    public void Planner_UsesBurnPlanFuelAndDeltaV()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 250f, fuelKgPerSecond: 0.8f, availableFuelKg: 20f),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.True(plan.burnPlan.HasBurn);
        Assert.That(plan.burnPlan.estimatedDeltaV, Is.GreaterThan(0f));
        Assert.That(plan.burnPlan.estimatedFuelKg, Is.GreaterThan(0f));
        Assert.That(plan.segments.Any(segment => segment.type == PrototypeTrajectorySegmentType.Burn), Is.True);
        Assert.That(plan.predictedPath.Length, Is.GreaterThan(3));
    }

    [Test]
    public void Planner_EmitsExecutableFlightPlanWithoutDroppingLegacyDiagnostics()
    {
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(
            Vector3.zero,
            Vector3.forward * 12f,
            Vector3.forward * 250f,
            fuelKgPerSecond: 0.8f,
            availableFuelKg: 20f);

        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.True(plan.isValid);
        Assert.That(plan.segments.Any(segment => segment.type == PrototypeTrajectorySegmentType.Burn), Is.True);
        Assert.That(plan.predictedPath.Length, Is.GreaterThan(3));
        Assert.True(plan.flightPlan.IsValid);
        Assert.True(plan.flightPlan.isExecutable);
        Assert.That(plan.flightPlan.totalDurationSeconds, Is.GreaterThan(plan.burnPlan.durationSeconds));
        Assert.That(plan.flightPlan.totalExpectedFuelKg, Is.GreaterThan(0f));
        Assert.That(plan.flightPlan.predictedSamples.Length, Is.GreaterThan(plan.flightPlan.SegmentCount));
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
    }

    [Test]
    public void Planner_DirectFastTransfer_RejectsHighLateralWithoutRcsHeadroom()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(
                Vector3.zero,
                Vector3.right * 160f,
                Vector3.forward * 220f,
                maxRcsForce: 100f),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.False, "High lateral drift with weak RCS authority should fall back to legacy plan.");
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Coast), Is.True, "Fallback route should include coast.");
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.True);
        Assert.False(plan.flightPlan.segments.Any(segment => segment.profile == PrototypeManeuverProfile.DirectFastTransfer), "No segment should carry DirectFastTransfer profile when infeasible.");
    }

    [Test]
    public void Planner_DirectFastTransfer_AllowsHigherLateralWhenRcsFeasible()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(
                Vector3.zero,
                Vector3.right * 160f,
                Vector3.forward * 220f,
                maxRcsForce: 20000f),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.True, "High lateral drift should be accepted when lateral correction is feasible.");
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Hold), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Coast), Is.False, "Direct-fast mode should not include legacy coast.");
    }

    [Test]
    public void DirectFastTransfer_SolverAccountsForInitialAlignDrift()
    {
        Vector3 target = Vector3.forward * 260f;
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(
                Vector3.zero,
                Vector3.forward * 18f,
                target,
                forward: Vector3.right),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.True(plan.flightPlan.IsDirectFastTransfer, plan.flightPlan.statusLabel);
        PrototypeManeuverSegment align = plan.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn);
        PrototypeManeuverSegment burn = plan.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeManeuverSegment brake = plan.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
        float distanceAfterAlign = Vector3.Distance(burn.expectedStartPosition, target);
        float remainingAtSwitch = Vector3.Distance(burn.expectedEndPosition, target);

        Assert.That(align.durationSeconds, Is.GreaterThan(0.05f));
        Assert.That(burn.expectedStartPosition.z, Is.EqualTo(18f * align.durationSeconds).Within(0.05f));
        Assert.That(burn.expectedStartPosition.z, Is.GreaterThan(0.5f), "Align segment should drift with initial velocity before burn starts.");
        Assert.That(burn.plannedSwitchDistanceMeters, Is.LessThan(distanceAfterAlign), "Switch distance should be solved from the post-align route.");
        Assert.That(remainingAtSwitch, Is.GreaterThan(distanceAfterAlign * 0.35f), "Burn should leave enough route for the planned brake after align drift.");
        Assert.That(Vector3.Dot(brake.primaryDirectionWorld, -burn.primaryDirectionWorld), Is.GreaterThan(0.98f));
    }

    [Test]
    public void DirectFastTransfer_SlowMainThrottleSpoolExtendsBurnAndBrakeDurations()
    {
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 500f);
        var planner = new PrototypeTrajectoryPlanner();

        PrototypeTrajectoryPlan instant = planner.Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0f, 0f));
        PrototypeTrajectoryPlan slow = planner.Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0.2f, 0.2f));

        Assert.True(instant.flightPlan.IsDirectFastTransfer, instant.flightPlan.statusLabel);
        Assert.True(slow.flightPlan.IsDirectFastTransfer, slow.flightPlan.statusLabel);
        PrototypeManeuverSegment instantBurn = instant.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeManeuverSegment instantBrake = instant.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
        PrototypeManeuverSegment slowBurn = slow.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeManeuverSegment slowBrake = slow.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
        DirectFastTransferGeometry instantGeometry = MeasureDirectFastTransferGeometry(instant.flightPlan.segments, snapshot.targetPosition);
        DirectFastTransferGeometry slowGeometry = MeasureDirectFastTransferGeometry(slow.flightPlan.segments, snapshot.targetPosition);

        Assert.That(slowBurn.durationSeconds, Is.GreaterThan(instantBurn.durationSeconds + 1f));
        Assert.That(slowBrake.durationSeconds, Is.GreaterThan(instantBrake.durationSeconds + 1f));
        Assert.That(
            slowBurn.plannedSwitchDistanceMeters,
            Is.GreaterThan(instantBurn.plannedSwitchDistanceMeters + 0.5f),
            "Slow spool should push the actual burn switch farther down-route because ramp losses extend the commanded burn.");
        Assert.That(
            slowGeometry.remainingAtSwitchMeters,
            Is.LessThan(instantGeometry.remainingAtSwitchMeters - 0.5f),
            "Slow spool should leave less post-switch route after the longer ramped burn, not merely move the switch in any direction.");
        Assert.That(slowGeometry.burnMeters, Is.GreaterThan(0f));
        Assert.That(slowGeometry.flipDriftMeters, Is.GreaterThan(0f));
        Assert.That(slowGeometry.brakeMeters, Is.GreaterThan(0f));
        Assert.That(
            slowGeometry.remainingAtSwitchMeters,
            Is.EqualTo(slowGeometry.flipDriftMeters + slowGeometry.brakeMeters + slowGeometry.remainingAfterBrakeMeters).Within(1.5f),
            "After the slow-spool burn switch, the emitted flip drift plus brake travel should balance the remaining route distance.");
        Assert.That(
            slowGeometry.consumedRouteMeters + slowGeometry.remainingAfterBrakeMeters,
            Is.EqualTo(slowGeometry.postAlignRouteMeters).Within(1.5f),
            "Slow-spool emitted segment geometry should consume the post-align route distance without double-counting spool or flip distance.");
        Assert.That(
            slowGeometry.consumedRouteMeters,
            Is.EqualTo(slowGeometry.postAlignRouteMeters - snapshot.arrivalRadius).Within(1.5f),
            "DirectFastTransfer should leave the terminal arrival radius for capture instead of braking all the way to target center.");
        Assert.That(
            slowGeometry.remainingAfterBrakeMeters,
            Is.EqualTo(snapshot.arrivalRadius).Within(1.5f),
            "DirectFastTransfer brake should end at about the arrival radius.");
        Assert.That(
            slowBrake.expectedEndVelocity.magnitude,
            Is.EqualTo(snapshot.arrivalSpeed).Within(0.25f),
            "DirectFastTransfer brake should hand terminal capture roughly arrivalSpeed, not a full stop.");
        Assert.That(slowBurn.expectedMainFuelKg, Is.LessThan(slowBurn.durationSeconds * snapshot.fuelKgPerSecond));
        Assert.That(slowBrake.expectedMainFuelKg, Is.LessThan(slowBrake.durationSeconds * snapshot.fuelKgPerSecond));
    }

    [Test]
    public void DirectFastTransfer_SlowMainThrottleSpoolRampsPredictedSamples()
    {
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 500f);
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0.25f, 0.25f),
            fixedDeltaTimeSeconds: 0.5f);

        Assert.True(plan.flightPlan.IsDirectFastTransfer, plan.flightPlan.statusLabel);
        PrototypeManeuverSegment burn = plan.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeTrajectoryPredictedSample[] burnSamples = plan.flightPlan.predictedSamples
            .Where(sample => sample.segmentIndex == burn.index)
            .ToArray();

        Assert.That(burnSamples.Length, Is.GreaterThan(4));
        Assert.That(burnSamples.First().expectedMainThrottle, Is.LessThan(0.2f));
        Assert.That(burnSamples.Any(sample => sample.expectedMainThrottle > 0.9f), Is.True);
        Assert.That(burnSamples.Last().expectedMainThrottle, Is.LessThan(0.2f));
    }

    [Test]
    public void Planner_DirectFastTransferScalesSegmentToleranceWithPlannedSpeed()
    {
        var planner = new PrototypeTrajectoryPlanner();
        PrototypeTrajectorySnapshot slowSnapshot = CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 220f);
        PrototypeTrajectorySnapshot fastSnapshot = CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 900f);

        PrototypeTrajectoryPlan slow = planner.Plan(slowSnapshot, PrototypeObstacleDetectionResult.Clear(8f));
        PrototypeTrajectoryPlan fast = planner.Plan(fastSnapshot, PrototypeObstacleDetectionResult.Clear(8f));

        Assert.True(slow.flightPlan.IsDirectFastTransfer, slow.flightPlan.statusLabel);
        Assert.True(fast.flightPlan.IsDirectFastTransfer, fast.flightPlan.statusLabel);
        PrototypeManeuverSegment slowBurn = slow.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeManeuverSegment fastBurn = fast.flightPlan.segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        float slowPlannedSpeed = GetPlannedSpeed(slowBurn);
        float fastPlannedSpeed = GetPlannedSpeed(fastBurn);
        float basePositionTolerance = Mathf.Max(PrototypeFlightPlanTolerance.Default.positionMeters, slowSnapshot.arrivalRadius * 0.5f);
        float baseVelocityTolerance = Mathf.Max(PrototypeFlightPlanTolerance.Default.velocityMetersPerSecond, slowSnapshot.arrivalSpeed);

        Assert.That(fastPlannedSpeed, Is.GreaterThan(slowPlannedSpeed));
        Assert.That(fastBurn.tolerance.positionMeters, Is.GreaterThan(slowBurn.tolerance.positionMeters));
        Assert.That(fastBurn.tolerance.velocityMetersPerSecond, Is.GreaterThan(slowBurn.tolerance.velocityMetersPerSecond));
        Assert.That(slowBurn.tolerance.positionMeters, Is.EqualTo(Mathf.Max(basePositionTolerance, slowPlannedSpeed * 0.5f)).Within(0.001f));
        Assert.That(slowBurn.tolerance.velocityMetersPerSecond, Is.EqualTo(Mathf.Max(baseVelocityTolerance, slowPlannedSpeed * 0.05f)).Within(0.001f));
        Assert.That(fastBurn.tolerance.positionMeters, Is.EqualTo(Mathf.Max(basePositionTolerance, fastPlannedSpeed * 0.5f)).Within(0.001f));
        Assert.That(fastBurn.tolerance.velocityMetersPerSecond, Is.EqualTo(Mathf.Max(baseVelocityTolerance, fastPlannedSpeed * 0.05f)).Within(0.001f));
        Assert.That(fastBurn.tolerance.attitudeDegrees, Is.EqualTo(PrototypeFlightPlanTolerance.Default.attitudeDegrees).Within(0.0001f));
        Assert.That(fastBurn.tolerance.angularVelocityRadiansPerSecond, Is.EqualTo(PrototypeFlightPlanTolerance.Default.angularVelocityRadiansPerSecond).Within(0.0001f));
        Assert.That(fastBurn.tolerance.timingSeconds, Is.EqualTo(PrototypeFlightPlanTolerance.Default.timingSeconds).Within(0.0001f));
        Assert.That(fastBurn.tolerance.fuelKg, Is.EqualTo(PrototypeFlightPlanTolerance.Default.fuelKg).Within(0.0001f));
        Assert.That(fastBurn.tolerance.obstacleClearanceMeters, Is.EqualTo(Mathf.Max(PrototypeFlightPlanTolerance.Default.obstacleClearanceMeters, fastSnapshot.clearanceRadius)).Within(0.0001f));
    }

    [Test]
    public void Planner_EmittedFlightPlanUsesRealShipPlanningSnapshot()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig ship = builder.CreateShip("AutopilotV2ValidationPlanningShip");
            ship.Ship.transform.position = new Vector3(4f, 0f, -3f);
            ship.Body.linearVelocity = new Vector3(0f, 0f, 9f);
            ship.Stats.ApplyMassProperties(ship.Body);
            PrototypeShipPlanningSnapshot shipSnapshot = PrototypeShipPlanningSnapshotBuilder.Build(ship.Ship.transform);
            PrototypeTrajectorySnapshot trajectorySnapshot = new PrototypeTrajectorySnapshot(
                ship.Body.worldCenterOfMass,
                ship.Body.linearVelocity,
                ship.Body.worldCenterOfMass + Vector3.forward * 220f,
                ship.Ship.transform.forward,
                ship.Body.mass,
                8f,
                ship.Rcs.TranslationForce,
                8f,
                shipSnapshot.mainThrustNewtons,
                shipSnapshot.mainFuelKgPerSecond,
                shipSnapshot.currentFuelKg,
                10f,
                1f,
                0.2f);

            PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
                trajectorySnapshot,
                PrototypeObstacleDetectionResult.Clear(8f),
                shipSnapshot,
                12f,
                0.02f);

            Assert.True(plan.flightPlan.IsValid);
            Assert.That(plan.flightPlan.createdAtTimeSeconds, Is.EqualTo(12f).Within(0.0001f));
            Assert.That(plan.flightPlan.shipSnapshot.rigidbodyMassKg, Is.EqualTo(ship.Body.mass).Within(0.0001f));
            Assert.That(plan.flightPlan.shipSnapshot.currentFuelKg, Is.EqualTo(ship.Stats.CurrentFuelKg).Within(0.0001f));
            Assert.That(plan.flightPlan.shipSnapshot.mainThrustNewtons, Is.EqualTo(shipSnapshot.mainThrustNewtons).Within(0.0001f));
            Assert.That(plan.flightPlan.shipSnapshot.rcsTranslationForceNewtons, Is.EqualTo(ship.Rcs.TranslationForce).Within(0.0001f));
            Assert.That(plan.flightPlan.predictedSamples[0].position, Is.EqualTo(ship.Body.worldCenterOfMass));
        }
    }

    [Test]
    public void Planner_DirectFastTransferRejectsImpossibleCloseHighSpeedImmediateBrake()
    {
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.forward * 45f, Vector3.forward * 150f),
            PrototypeObstacleDetectionResult.Clear(8f));

        Assert.True(plan.flightPlan.IsValid);
        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.False);
        Assert.False(plan.flightPlan.segments.Any(segment => segment.profile == PrototypeManeuverProfile.DirectFastTransfer));
    }

    [Test]
    public void Planner_EmittedFlightPlanStartsWithBrakeWhenStoppingDistanceConsumesArrival()
    {
        const float speed = 45f;
        float flipSeconds = Mathf.PI / (PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * Mathf.Deg2Rad)
            + ((PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * Mathf.Deg2Rad)
                / PrototypeFlightPlanExecutionConfig.BrakeFlipMaxAngularAccelerationRadPerSecondSquared)
            + PrototypeFlightPlanExecutionConfig.BrakeFlipDampingTimeSeconds
            + 0.4f;
        float brakeMeters = ((speed * speed) - 1f) / (2f * 8f);
        float targetDistance = (speed * flipSeconds) + brakeMeters + 10f;
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(
            Vector3.zero,
            Vector3.forward * speed,
            Vector3.forward * targetDistance);

        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f));
        ImmediateBrakeGeometry geometry = MeasureImmediateBrakeGeometry(plan.flightPlan.segments, snapshot.targetPosition);

        Assert.True(plan.flightPlan.IsValid);
        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.segments[0].type, Is.EqualTo(PrototypeTrajectorySegmentType.Brake));
        Assert.That(plan.flightPlan.segments[0].phase, Is.EqualTo(PrototypeManeuverPhase.FlipToRetrograde));
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.False);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
        Assert.That(geometry.remainingAfterBrakeMeters, Is.EqualTo(snapshot.arrivalRadius).Within(1.0f));
        Assert.That(geometry.endSpeedMetersPerSecond, Is.EqualTo(snapshot.arrivalSpeed).Within(0.25f));
    }

    [Test]
    public void Planner_DirectFastTransferImmediateBrakeAlreadyRetrogradeOmitsInitialFlip()
    {
        const float speed = 45f;
        float brakeMeters = ((speed * speed) - 1f) / (2f * 8f);
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(
            Vector3.zero,
            Vector3.forward * speed,
            Vector3.forward * (brakeMeters + 10f),
            forward: Vector3.back);

        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0f, 0f));

        Assert.True(plan.flightPlan.IsValid, plan.flightPlan.statusLabel);
        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.segments[0].type, Is.EqualTo(PrototypeTrajectorySegmentType.Brake));
        Assert.That(plan.flightPlan.segments[0].phase, Is.EqualTo(PrototypeManeuverPhase.RetrogradeBurn));
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn), Is.False);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.False);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.False);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Hold), Is.True);
    }

    [Test]
    public void Planner_DirectFastTransferBurnAlignedWithinLatchOmitsInitialAlign()
    {
        Vector3 forwardWithinLatch = Quaternion.Euler(0f, 10f, 0f) * Vector3.forward;
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(
            Vector3.zero,
            Vector3.zero,
            Vector3.forward * 500f,
            forward: forwardWithinLatch);

        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0f, 0f));

        Assert.True(plan.flightPlan.IsValid, plan.flightPlan.statusLabel);
        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.flightPlan.segments[0].phase, Is.EqualTo(PrototypeManeuverPhase.ProgradeBurn));
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn), Is.False);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
    }

    [Test]
    public void Planner_DirectFastTransferMisalignedFreshPlanKeepsAlignAndFlip()
    {
        PrototypeTrajectorySnapshot snapshot = CreateSnapshot(
            Vector3.zero,
            Vector3.zero,
            Vector3.forward * 500f,
            forward: Vector3.right);

        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            snapshot,
            PrototypeObstacleDetectionResult.Clear(8f),
            CreatePlanningSnapshot(snapshot, 0f, 0f));

        Assert.True(plan.flightPlan.IsValid, plan.flightPlan.statusLabel);
        Assert.That(plan.flightPlan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.flightPlan.segments[0].phase, Is.EqualTo(PrototypeManeuverPhase.AlignForBurn));
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.True);
        Assert.That(plan.flightPlan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
    }

    [Test]
    public void Autopilot_DirectFastTransferBrakeCommittedReplanBuildsBrakeHoldOnly()
    {
        const float speed = 45f;
        float brakeMeters = ((speed * speed) - 1f) / (2f * 8f);
        var rig = CreateAutopilotRig();
        Quaternion retrogradeRotation = Quaternion.LookRotation(Vector3.back);
        rig.Ship.transform.position = Vector3.zero;
        rig.Ship.transform.rotation = retrogradeRotation;
        rig.Body.position = Vector3.zero;
        rig.Body.rotation = retrogradeRotation;
        rig.Body.linearVelocity = Vector3.forward * speed;
        rig.Target.transform.position = Vector3.forward * (brakeMeters + 10f);
        Physics.SyncTransforms();
        rig.Autopilot.SelectTarget(rig.Target);
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", true);

        InvokePrivateVoid(rig.Autopilot, "RefreshNavigationPlan");

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(plan.IsValid, plan.statusLabel);
        Assert.That(plan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.segments.Select(segment => segment.phase), Is.EquivalentTo(new[]
        {
            PrototypeManeuverPhase.RetrogradeBurn,
            PrototypeManeuverPhase.Hold
        }));
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.False);
        Assert.That(rig.Autopilot.LastTrajectoryPlan.segments.All(segment => segment.type == PrototypeTrajectorySegmentType.Brake || segment.type == PrototypeTrajectorySegmentType.Hold), Is.True);
    }

    [Test]
    public void Autopilot_DirectFastTransferBrakeCommittedForcedReplanPreservesBrakeHoldIntent()
    {
        const float speed = 45f;
        var rig = CreateAutopilotRig();
        Quaternion retrogradeRotation = Quaternion.LookRotation(Vector3.back);
        rig.Ship.transform.position = Vector3.zero;
        rig.Ship.transform.rotation = retrogradeRotation;
        rig.Body.position = Vector3.zero;
        rig.Body.rotation = retrogradeRotation;
        rig.Body.linearVelocity = Vector3.forward * speed;
        rig.Target.transform.position = Vector3.forward * 500f;
        Physics.SyncTransforms();
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", true);
        InvokePrivateVoid(rig.Autopilot, "RefreshNavigationPlan");
        Assert.That(rig.Autopilot.CurrentFlightPlan.IsDirectFastTransfer, Is.True, rig.Autopilot.CurrentFlightPlan.statusLabel);
        Assert.That(rig.Autopilot.LastTrajectoryPlan.segments.All(segment => segment.type == PrototypeTrajectorySegmentType.Brake || segment.type == PrototypeTrajectorySegmentType.Hold), Is.True);
        var report = new PrototypeFlightPlanDivergenceReport(
            PrototypeFlightPlanAbortReplanReason.PositionDivergence,
            true,
            false,
            "test forced brake replan");

        bool handled = InvokePrivateBool(
            rig.Autopilot,
            "ForceFlightPlanSafetyReplan",
            report,
            "test forced brake replan");

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(handled);
        Assert.True(plan.IsValid, plan.statusLabel);
        Assert.That(plan.IsDirectFastTransfer, Is.True);
        Assert.That(plan.segments.Select(segment => segment.phase), Is.EqualTo(new[]
        {
            PrototypeManeuverPhase.RetrogradeBurn,
            PrototypeManeuverPhase.Hold
        }));
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Coast), Is.False);
    }

    [Test]
    public void Autopilot_DirectFastTransferBrakeCommittedForcedReplanSkipsFlipWhenMisaligned()
    {
        const float speed = 45f;
        var rig = CreateAutopilotRig();
        Quaternion misalignedRotation = Quaternion.LookRotation(Vector3.right);
        rig.Ship.transform.position = Vector3.zero;
        rig.Ship.transform.rotation = misalignedRotation;
        rig.Body.position = Vector3.zero;
        rig.Body.rotation = misalignedRotation;
        rig.Body.linearVelocity = Vector3.forward * speed;
        rig.Target.transform.position = Vector3.forward * 500f;
        Physics.SyncTransforms();
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", true);
        InvokePrivateVoid(rig.Autopilot, "RefreshNavigationPlan");
        Assert.That(rig.Autopilot.CurrentFlightPlan.IsDirectFastTransfer, Is.True, rig.Autopilot.CurrentFlightPlan.statusLabel);

        var report = new PrototypeFlightPlanDivergenceReport(
            PrototypeFlightPlanAbortReplanReason.PositionDivergence,
            true,
            false,
            "test forced misaligned brake replan");
        bool handled = InvokePrivateBool(
            rig.Autopilot,
            "ForceFlightPlanSafetyReplan",
            report,
            "test forced misaligned brake replan");

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(handled);
        Assert.That(plan.segments.Select(segment => segment.phase), Is.EqualTo(new[]
        {
            PrototypeManeuverPhase.RetrogradeBurn,
            PrototypeManeuverPhase.Hold
        }));
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn), Is.False);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.False);
    }

    [Test]
    public void Planner_HeavyShipNeedsMoreRcsForce()
    {
        PrototypeObstacleDetectionResult detection = CreateBlockingDetection();
        PrototypeTrajectoryPlan light = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 200f, massKg: 100f, maxRcsForce: 100000f),
            detection);
        PrototypeTrajectoryPlan heavy = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.zero, Vector3.forward * 200f, massKg: 1000f, maxRcsForce: 100000f),
            detection);

        Assert.That(light.requestedRcsForceWorld.magnitude, Is.GreaterThan(0f));
        Assert.That(heavy.requestedRcsForceWorld.magnitude, Is.GreaterThan(light.requestedRcsForceWorld.magnitude * 5f));
    }

    [Test]
    public void Planner_LimitedRcsReportsLimitedAuthority()
    {
        PrototypeObstacleDetectionResult detection = CreateBlockingDetection();
        PrototypeTrajectoryPlan plan = new PrototypeTrajectoryPlanner().Plan(
            CreateSnapshot(Vector3.zero, Vector3.right * 20f, Vector3.forward * 200f, massKg: 2000f, maxRcsForce: 35f),
            detection);

        Assert.True(plan.limitedRcsAuthority);
        Assert.That(plan.warningStatus, Is.EqualTo("LimitedRcsAuthority"));
        Assert.That(plan.candidateScores.Any(score => score.rcsAuthorityMargin < 0f), Is.True);
    }

    [Test]
    public void Autopilot_NoAuthorityDoesNotFakeComplete()
    {
        var rig = CreateAutopilotRig();
        SetPrivateFloat(rig.Rcs, "translationForce", 0f);
        UnityEngine.Object.DestroyImmediate(rig.Ship.GetComponent<MainThrusterModule>());
        SetPrivateField(rig.Ship.GetComponent<MainThrusterBank>(), "thrusters", Array.Empty<MainThrusterModule>());
        rig.Target.transform.position = Vector3.forward * 2f;
        rig.Body.linearVelocity = Vector3.zero;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.That(rig.Autopilot.ArrivalFailureReason, Is.EqualTo("NoAuthority"));
    }

    [Test]
    public void Autopilot_FuelInsufficientBeforeBurn()
    {
        var rig = CreateAutopilotRig();
        SetPrivateFloat(rig.Stats, "currentFuelKg", 0f);
        rig.Target.transform.position = Vector3.forward * 500f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FuelInsufficient));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Controller.HasExternalFlightAssistRequest);
    }

    [Test]
    public void Autopilot_FlightPlanExecutorDoesNotFlipBeforePlannedBrakeSegment()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        InvokeFixedUpdate(rig.Autopilot);

        PrototypeManeuverSegment flipSegment = FindRequiredSegment(rig.Autopilot, PrototypeManeuverPhase.FlipToRetrograde);
        Assert.True(rig.Autopilot.HasExecutableFlightPlan);
        Assert.True(rig.Autopilot.FlightPlanExecutorActive);
        Assert.That(rig.Autopilot.FlightPlanExecutorElapsedSeconds, Is.LessThan(flipSegment.startTimeSeconds));
        Assert.False(rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FlipForBrake
            || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Brake);
        Assert.That(
            rig.Autopilot.CurrentFlightPlanExecutionState.activePhase,
            Is.EqualTo(PrototypeManeuverPhase.AlignForBurn).Or.EqualTo(PrototypeManeuverPhase.ProgradeBurn));
    }

    [Test]
    public void Autopilot_FlightPlanExecutorEntersFlipOnlyAtPlannedSegment()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        PrototypeManeuverSegment flipSegment = FindRequiredSegment(rig.Autopilot, PrototypeManeuverPhase.FlipToRetrograde);
        MoveRigidbodyToSegmentStart(rig.Body, flipSegment);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", flipSegment.startTimeSeconds + 0.01f);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.FlightPlanExecutorActive);
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Autopilot.CurrentFlightPlanExecutionState.activePhase, Is.EqualTo(PrototypeManeuverPhase.FlipToRetrograde));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.001f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.LessThanOrEqualTo(0.001f));
    }

    [Test]
    public void Autopilot_FlightPlanExecutorFlagOffUsesLegacyFallback()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(false);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        InvokeFixedUpdate(rig.Autopilot);

        Assert.False(rig.Autopilot.FlightPlanExecutorActive);
        Assert.False(rig.Autopilot.CurrentFlightPlanExecutionState.hasActiveSegment);
    }

    [Test]
    public void Autopilot_FlightPlanDivergenceTargetMoveReplansWithVisibleReason()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        int firstRevision = rig.Autopilot.CurrentFlightPlan.revision;
        Assert.True(rig.Autopilot.HasExecutableFlightPlan);
        Assert.That(firstRevision, Is.GreaterThan(0));

        rig.Target.transform.position += Vector3.right * 24f;
        Physics.SyncTransforms();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.FlightPlanRequiresReplan);
        Assert.False(rig.Autopilot.FlightPlanRequiresAbort);
        Assert.True((rig.Autopilot.FlightPlanDivergenceReasons & PrototypeFlightPlanAbortReplanReason.TargetMoved) != 0);
        Assert.That(rig.Autopilot.FlightPlanDivergenceStatusLabel, Does.Contain("TargetMoved"));
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.GreaterThan(firstRevision));
        Assert.That(rig.Autopilot.CurrentFlightPlan.targetPositionWorld.x, Is.EqualTo(rig.Target.transform.position.x).Within(0.001f));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.001f));
    }

    [Test]
    public void Autopilot_FlightPlanDivergenceNewObstacleReplansWithVisibleReason()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 8f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        int firstRevision = rig.Autopilot.CurrentFlightPlan.revision;
        CreateObstacle("AutopilotV2ValidationLateObstacle", Vector3.forward * 60f, 7f, true, true);
        Physics.SyncTransforms();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.FlightPlanRequiresReplan);
        Assert.True((rig.Autopilot.FlightPlanDivergenceReasons & PrototypeFlightPlanAbortReplanReason.ObstacleDetected) != 0);
        Assert.That(rig.Autopilot.FlightPlanDivergenceStatusLabel, Does.Contain("ObstacleDetected"));
        Assert.True(rig.Autopilot.NavigationObstacleDetected);
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.GreaterThan(firstRevision));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.001f));
    }

    [Test]
    public void Autopilot_FlightPlanExpiredReplansInsteadOfLegacyLiveBrake()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        int firstRevision = rig.Autopilot.CurrentFlightPlan.revision;
        SetPrivateFloat(
            rig.Autopilot,
            "flightPlanElapsedSeconds",
            rig.Autopilot.CurrentFlightPlan.totalDurationSeconds + 1f);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.FlightPlanRequiresReplan);
        Assert.True((rig.Autopilot.FlightPlanDivergenceReasons & PrototypeFlightPlanAbortReplanReason.PlanExpired) != 0);
        Assert.That(rig.Autopilot.FlightPlanDivergenceStatusLabel, Does.Contain("PlanExpired"));
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.GreaterThan(firstRevision));
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.Not.EqualTo(PrototypeWaypointAutopilotState.Accelerate)
                .And.Not.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake)
                .And.Not.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.001f));
    }

    [Test]
    public void Autopilot_FlightPlanHoldWithoutRcsAbortsInsteadOfLegacyHoldGate()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 250f;
        rig.Body.linearVelocity = Vector3.forward * 8f;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        PrototypeManeuverSegment holdSegment = FindRequiredSegment(rig.Autopilot, PrototypeManeuverPhase.Hold);
        MoveRigidbodyToSegmentStart(rig.Body, holdSegment);
        SetPrivateFloat(rig.Rcs, "translationForce", 0f);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", holdSegment.startTimeSeconds + 0.01f);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Aborted));
        Assert.True(rig.Autopilot.FlightPlanRequiresAbort);
        Assert.True((rig.Autopilot.FlightPlanDivergenceReasons & PrototypeFlightPlanAbortReplanReason.NoRcsAuthority) != 0);
        Assert.That(rig.Autopilot.FlightPlanDivergenceStatusLabel, Does.Contain("NoRcsAuthority"));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.001f));
        Assert.False(rig.Controller.HasExternalFlightAssistRequest);
    }

    [Test]
    public void Autopilot_HoldRequiresStableVelocityWindow()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 2f;
        rig.Body.linearVelocity = Vector3.zero;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(false);
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.True(rig.Autopilot.AutopilotEngaged);

        SetPrivateField(rig.Autopilot, "holdConfirmStarted", true);
        SetPrivateFloat(rig.Autopilot, "holdConfirmUntilTime", 0f);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.False(rig.Autopilot.AutopilotEngaged);
    }

    [Test]
    public void Autopilot_AvoidanceWaypointPersistsAcrossFrames()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 180f;
        CreateObstacle("AutopilotV2ValidationBlocking", Vector3.forward * 55f, 7f, true, true);
        Physics.SyncTransforms();
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);
        Vector3 firstWaypoint = rig.Autopilot.AvoidanceWaypoint;

        rig.Autopilot.ReplanNow();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.AvoidanceActive);
        Assert.That(Vector3.Distance(firstWaypoint, rig.Autopilot.AvoidanceWaypoint), Is.LessThan(0.001f));
        Assert.That(
            rig.Autopilot.NavigationPhase,
            Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning).Or.EqualTo(PrototypeWaypointAutopilotNavigationPhase.Avoiding));
    }

    [Test]
    public void Autopilot_ReacquiresDirectPathAfterAvoidance()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 180f;
        GameObject obstacle = CreateObstacle("AutopilotV2ValidationBlocking", Vector3.forward * 55f, 7f, true, true);
        Physics.SyncTransforms();
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);
        Assert.True(rig.Autopilot.AvoidanceActive);

        UnityEngine.Object.DestroyImmediate(obstacle);
        Physics.SyncTransforms();
        rig.Autopilot.ReplanNow();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.False(rig.Autopilot.NavigationObstacleDetected);
        Assert.That(rig.Autopilot.NavigationPhase, Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath));
    }

    [Test]
    public void NavigationComputerHud_BuildsStructuredPanelAndWarningChips()
    {
        var rig = CreateAutopilotRig();
        SetPrivateFloat(rig.Rcs, "translationForce", 0f);
        rig.Target.transform.position = Vector3.forward * 12f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        GameObject cameraObject = new GameObject("AutopilotV2ValidationCamera");
        cameraObject.AddComponent<Camera>();
        var hud = cameraObject.AddComponent<PrototypeFlightHud>();
        hud.Bind(rig.Ship.transform, rig.Stats, rig.Body);
        hud.RefreshDiagnosticsForTests();

        Assert.That(hud.LastNavigationComputerSummary, Does.Contain("Navigation Computer"));
        Assert.That(hud.LastNavigationComputerSummary, Does.Contain("Phase"));
        Assert.That(hud.LastNavigationComputerSummary, Does.Contain("Segment"));
        Assert.That(hud.LastNavigationComputerSummary, Does.Contain("LIMITED RCS"));
        Assert.That(hud.LastNavigationComputerSummary.Split('\n').Length, Is.GreaterThanOrEqualTo(5));
    }

    [Test]
    public void NavigationComputerSources_RenderStructuredDebugAndMinimapEvidence()
    {
        string root = Directory.GetCurrentDirectory();
        string debugConsole = File.ReadAllText(Path.Combine(root, "Assets", "Scripts", "Prototype", "PrototypeFlightDebugConsole.cs"));
        string minimap = File.ReadAllText(Path.Combine(root, "Assets", "Scripts", "Prototype", "PrototypeMinimapOverlay.cs"));

        StringAssert.Contains("Plan Summary", debugConsole);
        StringAssert.Contains("Candidate Scores", debugConsole);
        StringAssert.Contains("Current Segment", debugConsole);
        StringAssert.Contains("Obstacle Detection", debugConsole);
        StringAssert.Contains("Actuator Requests", debugConsole);
        StringAssert.Contains("Fuel/Burn Estimate", debugConsole);
        StringAssert.Contains("Test Scenario Controls", debugConsole);
        StringAssert.Contains("PredictedRoute", minimap);
        StringAssert.Contains("DrawObstacleClearance", minimap);
        StringAssert.Contains("directPathBlocked", minimap);
    }

    [Test]
    public void NavigationComputerV2SyntheticEvidence_WritesMarkedHeadlessPngs()
    {
        string screenshotDir = Path.Combine(
            Directory.GetCurrentDirectory(),
            ".devtoolbox",
            "specs",
            "changes",
            "prototype-autopilot-navigation-computer-v2",
            "tests",
            "screenshots");
        Directory.CreateDirectory(screenshotDir);

        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "direct-route.png"), new Color(0.1f, 0.55f, 0.95f), false, false);
        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "obstacle-detected.png"), new Color(1f, 0.36f, 0.18f), true, false);
        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "avoidance-active.png"), new Color(1f, 0.78f, 0.18f), true, true);
        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "reacquire-direct-path.png"), new Color(0.45f, 0.72f, 1f), false, true);
        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "final-hold.png"), new Color(0.35f, 0.9f, 0.45f), false, false);
        WriteSyntheticEvidenceImage(Path.Combine(screenshotDir, "navigation-computer-gui.png"), new Color(0.25f, 0.85f, 1f), true, true);

        Assert.True(File.Exists(Path.Combine(screenshotDir, "direct-route.png")));
        Assert.True(File.Exists(Path.Combine(screenshotDir, "reacquire-direct-path.png")));
        Assert.True(File.Exists(Path.Combine(screenshotDir, "navigation-computer-gui.png")));
    }

    private static PrototypeTrajectorySnapshot CreateSnapshot(
        Vector3 position,
        Vector3 velocity,
        Vector3 target,
        float massKg = 250f,
        float maxMainAcceleration = 8f,
        float maxRcsForce = 12000f,
        float fuelKgPerSecond = 0.4f,
        float availableFuelKg = 50f,
        Vector3 forward = default)
    {
        return new PrototypeTrajectorySnapshot(
            position,
            velocity,
            target,
            forward.sqrMagnitude > 0.0001f ? forward.normalized : Vector3.forward,
            massKg,
            maxMainAcceleration,
            maxRcsForce,
            8f,
            massKg * maxMainAcceleration,
            fuelKgPerSecond,
            availableFuelKg,
            10f,
            1f,
            0.2f);
    }

    private static PrototypeShipPlanningSnapshot CreatePlanningSnapshot(
        PrototypeTrajectorySnapshot snapshot,
        float mainThrottleSpoolUpRate,
        float mainThrottleSpoolDownRate)
    {
        float mainThrust = snapshot.mainThrustNewtons > 0f
            ? snapshot.mainThrustNewtons
            : snapshot.maxMainAcceleration * snapshot.massKg;
        return new PrototypeShipPlanningSnapshot(
            new TrajectoryPredictionState(
                snapshot.position,
                snapshot.velocity,
                Quaternion.LookRotation(snapshot.forward.sqrMagnitude > 0.0001f ? snapshot.forward : Vector3.forward),
                Vector3.zero,
                0f,
                snapshot.availableFuelKg),
            snapshot.position,
            Vector3.zero,
            Vector3.one,
            Quaternion.identity,
            snapshot.massKg,
            snapshot.availableFuelKg,
            snapshot.availableFuelKg,
            mainThrust,
            snapshot.fuelKgPerSecond,
            0.35f,
            mainThrottleSpoolUpRate,
            mainThrottleSpoolDownRate,
            0f,
            0f,
            snapshot.maxRcsForce,
            snapshot.maxRcsForce,
            0f,
            0f,
            false,
            false,
            false,
            false,
            false,
            mainThrust > 0f ? 1 : 0,
            snapshot.maxRcsForce > 0f ? 1 : 0,
            0);
    }

    private struct DirectFastTransferGeometry
    {
        public float postAlignRouteMeters;
        public float burnMeters;
        public float flipDriftMeters;
        public float brakeMeters;
        public float consumedRouteMeters;
        public float remainingAtSwitchMeters;
        public float remainingAfterBrakeMeters;
    }

    private struct ImmediateBrakeGeometry
    {
        public float remainingAfterBrakeMeters;
        public float endSpeedMetersPerSecond;
    }

    private static DirectFastTransferGeometry MeasureDirectFastTransferGeometry(
        PrototypeManeuverSegment[] segments,
        Vector3 targetPosition)
    {
        PrototypeManeuverSegment burn = segments.Single(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        PrototypeManeuverSegment flip = segments.Single(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde);
        PrototypeManeuverSegment brake = segments.Single(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
        Vector3 route = targetPosition - burn.expectedStartPosition;
        Vector3 routeDirection = route.sqrMagnitude > 0.0001f ? route.normalized : Vector3.forward;
        float burnMeters = Vector3.Dot(burn.expectedEndPosition - burn.expectedStartPosition, routeDirection);
        float flipDriftMeters = Vector3.Dot(flip.expectedEndPosition - flip.expectedStartPosition, routeDirection);
        float brakeMeters = Vector3.Dot(brake.expectedEndPosition - brake.expectedStartPosition, routeDirection);

        return new DirectFastTransferGeometry
        {
            postAlignRouteMeters = Vector3.Dot(targetPosition - burn.expectedStartPosition, routeDirection),
            burnMeters = burnMeters,
            flipDriftMeters = flipDriftMeters,
            brakeMeters = brakeMeters,
            consumedRouteMeters = burnMeters + flipDriftMeters + brakeMeters,
            remainingAtSwitchMeters = Vector3.Dot(targetPosition - burn.expectedEndPosition, routeDirection),
            remainingAfterBrakeMeters = Vector3.Dot(targetPosition - brake.expectedEndPosition, routeDirection)
        };
    }

    private static ImmediateBrakeGeometry MeasureImmediateBrakeGeometry(
        PrototypeManeuverSegment[] segments,
        Vector3 targetPosition)
    {
        PrototypeManeuverSegment brake = segments.Single(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn);
        return new ImmediateBrakeGeometry
        {
            remainingAfterBrakeMeters = Vector3.Distance(targetPosition, brake.expectedEndPosition),
            endSpeedMetersPerSecond = brake.expectedEndVelocity.magnitude
        };
    }

    private static float GetPlannedSpeed(PrototypeManeuverSegment segment)
    {
        return Mathf.Max(segment.expectedStartVelocity.magnitude, segment.expectedEndVelocity.magnitude);
    }

    private static PrototypeObstacleDetectionResult CreateBlockingDetection()
    {
        var rig = CreateAutopilotRig();
        CreateObstacle("AutopilotV2ValidationPlannerObstacle", Vector3.forward * 55f, 8f, true, true);
        Physics.SyncTransforms();
        return rig.Detector.DetectDirectPath(Vector3.zero, Vector3.forward * 200f, 8f, rig.Ship.transform, Vector3.zero, 0f);
    }

    private static AutopilotRig CreateAutopilotRig()
    {
        GameObject ship = CreateShipRig();
        GameObject targetObject = new GameObject("AutopilotV2ValidationTarget");
        var target = targetObject.AddComponent<PrototypeNavigationTarget>();
        target.Configure("ValidationTarget", 10f);

        var detector = ship.GetComponent<PrototypeObstacleDetector>() ?? ship.AddComponent<PrototypeObstacleDetector>();
        detector.SetIncludeNavigationObstacleComponentsWithoutCollider(true);
        var autopilot = ship.GetComponent<PrototypeWaypointAutopilot>() ?? ship.AddComponent<PrototypeWaypointAutopilot>();
        var controller = ship.GetComponent<PlayerShipController>();
        var body = ship.GetComponent<Rigidbody>();
        var stats = ship.GetComponent<ShipStats>();
        autopilot.Bind(null, controller, stats, body);
        autopilot.SelectTarget(target);

        return new AutopilotRig
        {
            Ship = ship,
            Body = body,
            Stats = stats,
            Controller = controller,
            Rcs = ship.GetComponent<RcsThrusterController>(),
            Detector = detector,
            Autopilot = autopilot,
            Target = target
        };
    }

    private static GameObject CreateShipRig()
    {
        GameObject ship = new GameObject("AutopilotV2ValidationShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        ShipStats stats = ship.AddComponent<ShipStats>();
        ShipPhysicsCore physicsCore = ship.AddComponent<ShipPhysicsCore>();
        ship.AddComponent<GunModule>();
        var mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<EngineVfxController>();
        var rcs = ship.AddComponent<RcsThrusterController>();
        var mainModule = ship.AddComponent<MainThrusterModule>();
        ship.AddComponent<PlayerShipController>();
        ship.AddComponent<PrototypeObstacleDetector>();
        mainModule.Configure(ship.transform, body, stats, physicsCore);
        mainThruster.Configure(new[] { mainModule }, body, stats, physicsCore);
        ConfigureRcsNozzles(ship.transform, rcs, body, physicsCore);
        physicsCore.Configure(body);
        stats.ApplyMassProperties(body);
        return ship;
    }

    private static GameObject CreateObstacle(string name, Vector3 position, float radius, bool blocksAutopilot, bool trigger)
    {
        GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        obstacle.name = name;
        obstacle.transform.position = position;
        obstacle.transform.localScale = Vector3.one * Mathf.Max(0.1f, radius * 2f);
        Collider collider = obstacle.GetComponent<Collider>();
        Assert.NotNull(collider);
        collider.isTrigger = trigger;
        obstacle.AddComponent<PrototypeNavigationObstacle>().Configure(radius, 8f, blocksAutopilot);
        return obstacle;
    }

    private static void ConfigureRcsNozzles(Transform shipTransform, RcsThrusterController rcs, Rigidbody body, ShipPhysicsCore physicsCore)
    {
        Transform[] nozzleTransforms = new Transform[6];
        Vector3[] localPositions =
        {
            Vector3.up,
            Vector3.down,
            Vector3.left,
            Vector3.right,
            Vector3.forward,
            Vector3.back
        };

        for (int i = 0; i < nozzleTransforms.Length; i++)
        {
            GameObject nozzle = new GameObject("AutopilotV2ValidationRcsNozzle" + i);
            nozzle.transform.SetParent(shipTransform, false);
            nozzle.transform.localPosition = localPositions[i];
            nozzleTransforms[i] = nozzle.transform;
        }

        rcs.ConfigureThrusters(
            nozzleTransforms[0],
            nozzleTransforms[1],
            nozzleTransforms[2],
            nozzleTransforms[3],
            nozzleTransforms[4],
            nozzleTransforms[5],
            body,
            physicsCore);
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateBool(object target, string fieldName, bool value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static PrototypeManeuverSegment FindRequiredSegment(
        PrototypeWaypointAutopilot autopilot,
        PrototypeManeuverPhase phase)
    {
        PrototypeManeuverSegment segment = autopilot.FlightPlanSegments.FirstOrDefault(candidate => candidate.phase == phase);
        Assert.That(segment.phase, Is.EqualTo(phase));
        Assert.That(segment.durationSeconds, Is.GreaterThan(0f));
        return segment;
    }

    private static void MoveRigidbodyToSegmentStart(Rigidbody body, PrototypeManeuverSegment segment)
    {
        Assert.NotNull(body);
        body.position = segment.expectedStartPosition;
        body.rotation = segment.expectedStartRotation;
        body.linearVelocity = segment.expectedStartVelocity;
        body.angularVelocity = segment.expectedStartAngularVelocity;
        Physics.SyncTransforms();
    }

    private static void WriteSyntheticEvidenceImage(string path, Color accent, bool obstacle, bool avoidance)
    {
        const int width = 640;
        const int height = 360;
        var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
        Color background = new Color(0.02f, 0.025f, 0.04f, 1f);
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                texture.SetPixel(x, y, background);
            }
        }

        Fill(texture, 24, 24, 250, 136, new Color(0.06f, 0.08f, 0.12f, 1f));
        Fill(texture, 34, 42, 230, 14, accent);
        Fill(texture, 34, 68, 160, 10, new Color(0.75f, 0.9f, 1f, 1f));
        Fill(texture, 34, 92, 190, 10, avoidance ? new Color(1f, 0.82f, 0.2f, 1f) : new Color(0.35f, 0.9f, 0.45f, 1f));
        Fill(texture, 34, 116, 104, 10, obstacle ? new Color(1f, 0.34f, 0.18f, 1f) : new Color(0.35f, 0.9f, 0.45f, 1f));
        DrawLine(texture, new Vector2(90f, 276f), avoidance ? new Vector2(310f, 182f) : new Vector2(520f, 276f), accent, 4);
        if (avoidance)
        {
            DrawLine(texture, new Vector2(310f, 182f), new Vector2(520f, 276f), new Color(0.35f, 0.9f, 1f, 1f), 4);
        }

        if (obstacle)
        {
            DrawCircle(texture, new Vector2(310f, 250f), 38, new Color(1f, 0.28f, 0.15f, 1f));
        }

        Fill(texture, 440, 38, 150, 20, new Color(1f, 1f, 1f, 1f));
        Fill(texture, 440, 68, 82, 14, accent);
        Fill(texture, 440, 96, 116, 14, avoidance ? new Color(1f, 0.82f, 0.2f, 1f) : new Color(0.35f, 0.9f, 0.45f, 1f));
        File.WriteAllBytes(path, texture.EncodeToPNG());
        UnityEngine.Object.DestroyImmediate(texture);
    }

    private static void Fill(Texture2D texture, int x, int y, int width, int height, Color color)
    {
        for (int yy = Mathf.Max(0, y); yy < Mathf.Min(texture.height, y + height); yy++)
        {
            for (int xx = Mathf.Max(0, x); xx < Mathf.Min(texture.width, x + width); xx++)
            {
                texture.SetPixel(xx, yy, color);
            }
        }
    }

    private static void DrawLine(Texture2D texture, Vector2 start, Vector2 end, Color color, int radius)
    {
        int steps = Mathf.CeilToInt(Vector2.Distance(start, end));
        for (int i = 0; i <= steps; i++)
        {
            Vector2 point = Vector2.Lerp(start, end, steps > 0 ? (float)i / steps : 0f);
            Fill(texture, Mathf.RoundToInt(point.x) - radius, Mathf.RoundToInt(point.y) - radius, radius * 2, radius * 2, color);
        }
    }

    private static void DrawCircle(Texture2D texture, Vector2 center, int radius, Color color)
    {
        for (int y = -radius; y <= radius; y++)
        {
            for (int x = -radius; x <= radius; x++)
            {
                float distance = Mathf.Sqrt((x * x) + (y * y));
                if (distance >= radius - 2 && distance <= radius + 2)
                {
                    int px = Mathf.RoundToInt(center.x) + x;
                    int py = Mathf.RoundToInt(center.y) + y;
                    if (px >= 0 && px < texture.width && py >= 0 && py < texture.height)
                    {
                        texture.SetPixel(px, py, color);
                    }
                }
            }
        }
    }

    private static void InvokeFixedUpdate(object target)
    {
        MethodInfo fixedUpdate = target.GetType().GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(target, null);
    }

    private static void InvokePrivateVoid(object target, string methodName)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        method.Invoke(target, null);
    }

    private static bool InvokePrivateBool(object target, string methodName, params object[] args)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        return (bool)method.Invoke(target, args);
    }

    private static void DestroyByPrefix(string prefix)
    {
        GameObject[] objects = UnityEngine.Object.FindObjectsOfType<GameObject>();
        for (int i = 0; i < objects.Length; i++)
        {
            GameObject target = objects[i];
            if (target != null && target.name.StartsWith(prefix))
            {
                UnityEngine.Object.DestroyImmediate(target);
            }
        }
    }

    private struct AutopilotRig
    {
        public GameObject Ship;
        public Rigidbody Body;
        public ShipStats Stats;
        public PlayerShipController Controller;
        public RcsThrusterController Rcs;
        public PrototypeObstacleDetector Detector;
        public PrototypeWaypointAutopilot Autopilot;
        public PrototypeNavigationTarget Target;
    }
}
#endif
