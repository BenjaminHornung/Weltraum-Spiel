#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

public class PrototypeFlightPlanValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeBootstrapTestHost");
        DestroyNamed("PrototypeShip");
    }

    [Test]
    public void FlightPlanComputesOrderedTotalsFromSegments()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.AlignForBurn, PrototypeManeuverCommandMode.AttitudeOnly, 0f, 1f, 0f, 0f),
            CreateSegment(1, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 1f, 3f, 4.5f, 0f),
            CreateSegment(2, PrototypeManeuverPhase.Coast, PrototypeManeuverCommandMode.RcsAttitude, 4f, 2f, 0f, 0.1f),
            CreateSegment(3, PrototypeManeuverPhase.Hold, PrototypeManeuverCommandMode.RcsTranslation, 6f, 1f, 0f, 0.2f)
        };

        PrototypeFlightPlan plan = CreatePlan(segments);

        Assert.True(plan.IsValid);
        Assert.True(plan.isExecutable);
        Assert.That(plan.SegmentCount, Is.EqualTo(4));
        Assert.That(plan.totalDurationSeconds, Is.EqualTo(7f).Within(0.0001f));
        Assert.That(plan.totalExpectedFuelKg, Is.EqualTo(4.8f).Within(0.0001f));
        Assert.That(plan.expectedRemainingFuelKg, Is.EqualTo(15.2f).Within(0.0001f));
        Assert.That(plan.GetActiveSegmentIndex(4.5f), Is.EqualTo(2));
        Assert.That(plan.ExpectedFuelAt(2f), Is.EqualTo(18.5f).Within(0.0001f));
    }

    [Test]
    public void FlightPlanRejectsOverlappingSegments()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 2f, 2f, 1f, 0f),
            CreateSegment(1, PrototypeManeuverPhase.RetrogradeBurn, PrototypeManeuverCommandMode.MainThrottle, 1f, 2f, 1f, 0f)
        };

        PrototypeFlightPlan plan = CreatePlan(segments);

        Assert.False(plan.IsValid);
        Assert.False(plan.isExecutable);
        Assert.True((plan.nonExecutableReasons & PrototypeFlightPlanAbortReplanReason.TimeSlip) != 0);
    }

    [Test]
    public void FlightPlanRejectsFuelStarvedRoute()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, 25f, 0f)
        };

        PrototypeFlightPlan plan = CreatePlan(segments);

        Assert.False(plan.IsValid);
        Assert.False(plan.isExecutable);
        Assert.True((plan.nonExecutableReasons & PrototypeFlightPlanAbortReplanReason.FuelStarved) != 0);
    }

    [Test]
    public void FlightPlanCreateInvalidPreservesReasonAndStatus()
    {
        PrototypeFlightPlan plan = PrototypeFlightPlan.CreateInvalid(
            "blocked-plan",
            4,
            Vector3.forward * 50f,
            PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority,
            "No main thrust");

        Assert.False(plan.IsValid);
        Assert.False(plan.isExecutable);
        Assert.That(plan.planId, Is.EqualTo("blocked-plan"));
        Assert.That(plan.revision, Is.EqualTo(4));
        Assert.That(plan.statusLabel, Is.EqualTo("No main thrust"));
        Assert.True((plan.nonExecutableReasons & PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority) != 0);
    }

    [Test]
    public void TrajectoryPlanner_AttitudeEstimateUsesTrapezoidProfileForHalfTurn()
    {
        float angleDegrees = 180f;
        float actual = InvokeEstimateAttitudeSegmentSeconds(Quaternion.identity, DirectionAtYaw(angleDegrees));

        float expected = ExpectedAttitudeSegmentSeconds(angleDegrees);

        Assert.That(actual, Is.EqualTo(expected).Within(0.001f));
        Assert.That(actual, Is.LessThan(6f));
    }

    [Test]
    public void TrajectoryPlanner_AttitudeEstimateUsesTriangleProfileForSmallTurn()
    {
        float angleDegrees = 10f;
        float actual = InvokeEstimateAttitudeSegmentSeconds(Quaternion.identity, DirectionAtYaw(angleDegrees));

        float expected = ExpectedAttitudeSegmentSeconds(angleDegrees);

        Assert.That(actual, Is.EqualTo(expected).Within(0.001f));
    }

    [Test]
    public void TrajectoryPlanner_AttitudeEstimateAllowsRealisticMaximumTurnDuration()
    {
        FieldInfo field = typeof(PrototypeTrajectoryPlanner).GetField(
            "MaximumAttitudeSegmentSeconds",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(field);
        Assert.That((float)field.GetValue(null), Is.EqualTo(12f));
    }

    [Test]
    public void TrajectoryPlanner_AttitudeEstimateKeepsZeroAndNearZeroNoOp()
    {
        Assert.That(
            InvokeEstimateAttitudeSegmentSeconds(Quaternion.identity, Vector3.zero),
            Is.EqualTo(0f));
        Assert.That(
            InvokeEstimateAttitudeSegmentSeconds(Quaternion.identity, DirectionAtYaw(1f)),
            Is.EqualTo(0f));
    }

    [Test]
    public void ExecutionStateReportsActiveSegmentProgress()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.AlignForBurn, PrototypeManeuverCommandMode.AttitudeOnly, 0f, 1f, 0f, 0f),
            CreateSegment(1, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 1f, 3f, 3f, 0f)
        };
        PrototypeFlightPlan plan = CreatePlan(segments);

        PrototypeFlightPlanExecutionState state = PrototypeFlightPlanExecutionState.FromPlan(
            plan,
            2.5f,
            Vector3.forward * 2.5f,
            Vector3.forward,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(2.5f));

        Assert.True(state.IsFinite);
        Assert.False(state.requiresReplan);
        Assert.True(state.hasActiveSegment);
        Assert.That(state.activeSegmentIndex, Is.EqualTo(1));
        Assert.That(state.activePhase, Is.EqualTo(PrototypeManeuverPhase.ProgradeBurn));
        Assert.That(state.activeElapsedSeconds, Is.EqualTo(1.5f).Within(0.0001f));
        Assert.That(state.activeProgress01, Is.EqualTo(0.5f).Within(0.0001f));
    }

    [Test]
    public void ExecutionStateFlagsDivergenceAgainstSegmentTolerance()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, 1f, 0f)
        };
        PrototypeFlightPlan plan = CreatePlan(segments);

        PrototypeFlightPlanExecutionState state = PrototypeFlightPlanExecutionState.FromPlan(
            plan,
            1f,
            Vector3.right * 20f,
            Vector3.forward,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f));

        Assert.True(state.requiresReplan);
        Assert.True((state.replanReasons & PrototypeFlightPlanAbortReplanReason.PositionDivergence) != 0);
    }

    [Test]
    public void DivergenceMonitorFlagsTargetAndObstacleForReplan()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, 1f, 0f)
        };
        PrototypeFlightPlan plan = CreatePlan(segments);
        Vector3 expectedPosition = Vector3.Lerp(segments[0].expectedStartPosition, segments[0].expectedEndPosition, 0.25f);
        Vector3 expectedVelocity = Vector3.Lerp(segments[0].expectedStartVelocity, segments[0].expectedEndVelocity, 0.25f);
        Quaternion expectedRotation = Quaternion.Slerp(segments[0].expectedStartRotation, segments[0].expectedEndRotation, 0.25f);
        PrototypeFlightPlanExecutionState state = PrototypeFlightPlanExecutionState.FromPlan(
            plan,
            0.5f,
            expectedPosition,
            expectedVelocity,
            expectedRotation,
            segments[0].expectedStartAngularVelocity,
            plan.ExpectedFuelAt(0.5f));

        PrototypeFlightPlanDivergenceReport report = PrototypeFlightPlanDivergenceMonitor.Evaluate(
            plan,
            state,
            plan.targetPositionWorld + Vector3.right * 4f,
            true,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            1f);

        Assert.True(report.requiresReplan);
        Assert.False(report.requiresAbort);
        Assert.True((report.reasons & PrototypeFlightPlanAbortReplanReason.TargetMoved) != 0);
        Assert.True((report.reasons & PrototypeFlightPlanAbortReplanReason.ObstacleDetected) != 0);
        Assert.That(report.statusLabel, Does.Contain("TargetMoved"));
    }

    [Test]
    public void DivergenceMonitorFlagsMissingActuatorForAbort()
    {
        PrototypeManeuverSegment[] segments =
        {
            CreateSegment(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, 1f, 0f)
        };
        PrototypeFlightPlan plan = CreatePlan(segments);
        Vector3 expectedPosition = Vector3.Lerp(segments[0].expectedStartPosition, segments[0].expectedEndPosition, 0.25f);
        Vector3 expectedVelocity = Vector3.Lerp(segments[0].expectedStartVelocity, segments[0].expectedEndVelocity, 0.25f);
        Quaternion expectedRotation = Quaternion.Slerp(segments[0].expectedStartRotation, segments[0].expectedEndRotation, 0.25f);
        PrototypeFlightPlanExecutionState state = PrototypeFlightPlanExecutionState.FromPlan(
            plan,
            0.5f,
            expectedPosition,
            expectedVelocity,
            expectedRotation,
            segments[0].expectedStartAngularVelocity,
            plan.ExpectedFuelAt(0.5f));

        PrototypeFlightPlanDivergenceReport report = PrototypeFlightPlanDivergenceMonitor.Evaluate(
            plan,
            state,
            plan.targetPositionWorld,
            false,
            false,
            false,
            false,
            false,
            true,
            true,
            false,
            false,
            1f);

        Assert.True(report.requiresAbort);
        Assert.False(report.requiresReplan);
        Assert.True((report.reasons & PrototypeFlightPlanAbortReplanReason.ActuatorLimited) != 0);
        Assert.True((report.reasons & PrototypeFlightPlanAbortReplanReason.NoMainThrustAuthority) != 0);
        Assert.That(report.statusLabel, Does.Contain("Abort"));
    }

    [Test]
    public void FlightPlanTracker_InterpolatesSamples()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward * 3f)
            });

        bool ok = PrototypeFlightPlanTracker.TryInterpolateSample(
            plan,
            1f,
            out PrototypeTrajectoryPredictedSample sample,
            out int sampleIndex,
            out float blend);

        Assert.True(ok);
        Assert.That(sampleIndex, Is.EqualTo(0));
        Assert.That(blend, Is.EqualTo(0.5f).Within(0.0001f));
        Assert.That(sample.position, Is.EqualTo(Vector3.forward * 5f));
        Assert.That(sample.velocity, Is.EqualTo(Vector3.forward * 2f));
    }

    [Test]
    public void FlightPlanTracker_ComputesCrossTrackAndAlongTrackError()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 5f + Vector3.right * 3f,
            Vector3.forward,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.hasCommand);
        Assert.That(command.error.crossTrackErrorMeters, Is.EqualTo(3f).Within(0.05f));
        Assert.That(command.error.alongTrackErrorMeters, Is.EqualTo(0f).Within(0.05f));
        Assert.That(command.error.velocityErrorMetersPerSecond, Is.EqualTo(0f).Within(0.05f));
    }

    [Test]
    public void FlightPlanTracker_ComputesVelocityError()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward * 3f)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 5f,
            Vector3.forward * 0.5f,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.hasCommand);
        Assert.That(command.error.velocityErrorWorld, Is.EqualTo(Vector3.forward * 1.5f));
        Assert.That(command.error.velocityErrorMetersPerSecond, Is.EqualTo(1.5f).Within(0.05f));
    }

    [Test]
    public void FlightPlanTracker_OutputAccelerationPointsTowardPlannedPath()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward * 3f)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 5f,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.hasCommand);
        Assert.False(command.requiresReplan);
        Assert.That(Vector3.Dot(command.desiredAccelerationWorld.normalized, Vector3.forward), Is.GreaterThan(0.7f));
        Assert.That(command.mainThrottle, Is.GreaterThan(0f));
    }

    [Test]
    public void FlightPlanTracker_InvalidProgradeSegmentDirectionRequiresReplanBeforeThrottle()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.back)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward * 3f)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 5f,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.requiresReplan);
        Assert.False(command.mainThrottleAllowed);
        Assert.That(command.mainThrottle, Is.EqualTo(0f));
        Assert.True((command.replanReasons & PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection) != 0);
    }

    [Test]
    public void FlightPlanTracker_BrakeAccelerationOpposesVelocity()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.RetrogradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.back)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.RetrogradeBurn, Vector3.zero, Vector3.forward * 4f),
                CreateSample(2f, 0, PrototypeManeuverPhase.RetrogradeBurn, Vector3.forward * 6f, Vector3.forward * 1f)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 3f,
            Vector3.forward * 4f,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.hasCommand);
        Assert.False((command.replanReasons & PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection) != 0);
        Assert.That(command.mainDirectionDotVelocityBrake, Is.GreaterThan(0.55f));
        Assert.That(Vector3.Dot(command.mainDirectionWorld, -Vector3.forward), Is.GreaterThan(0.95f));
    }

    [Test]
    public void DirectFastTransfer_BrakeDirectionPrefersSegmentDirection()
    {
        Vector3 actualVelocity = (Vector3.forward + Vector3.right * 0.35f).normalized * 12f;
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(
                    0,
                    PrototypeManeuverPhase.RetrogradeBurn,
                    PrototypeManeuverCommandMode.MainThrottle,
                    0f,
                    2f,
                    Vector3.back,
                    profile: PrototypeManeuverProfile.DirectFastTransfer)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.RetrogradeBurn, Vector3.zero, actualVelocity),
                CreateSample(2f, 0, PrototypeManeuverPhase.RetrogradeBurn, Vector3.forward * 6f, Vector3.forward)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 3f,
            actualVelocity,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.hasCommand);
        Assert.False((command.replanReasons & PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection) != 0);
        Assert.That(Vector3.Dot(command.mainDirectionWorld, Vector3.back), Is.GreaterThan(0.99f));
    }

    [Test]
    public void DirectFastTransfer_HardInvalidDirectionStillReplans()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(
                    0,
                    PrototypeManeuverPhase.ProgradeBurn,
                    PrototypeManeuverCommandMode.MainThrottle,
                    0f,
                    2f,
                    Vector3.back,
                    profile: PrototypeManeuverProfile.DirectFastTransfer)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward * 3f)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.forward * 5f,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(1f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.requiresReplan);
        Assert.False(command.mainThrottleAllowed);
        Assert.True((command.replanReasons & PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection) != 0);
    }

    [Test]
    public void FlightPlanTracker_InvalidPlanWithoutSamples()
    {
        PrototypeFlightPlan plan = CreatePlan(new[]
        {
            CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
        });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            1f,
            Vector3.zero,
            Vector3.zero,
            Quaternion.identity,
            Vector3.zero,
            20f,
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.requiresReplan);
        Assert.False(command.hasCommand);
        Assert.True((command.replanReasons & PrototypeFlightPlanAbortReplanReason.NonExecutable) != 0);
        Assert.That(command.statusLabel, Does.Contain("no samples"));
    }

    [Test]
    public void FlightPlanTracker_ReplanWhenInitialStateMismatch()
    {
        PrototypeFlightPlan plan = CreatePlan(
            new[]
            {
                CreateSegmentWithDirection(0, PrototypeManeuverPhase.ProgradeBurn, PrototypeManeuverCommandMode.MainThrottle, 0f, 2f, Vector3.forward)
            },
            new[]
            {
                CreateSample(0f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.zero, Vector3.forward),
                CreateSample(2f, 0, PrototypeManeuverPhase.ProgradeBurn, Vector3.forward * 10f, Vector3.forward)
            });

        PrototypeFlightPlanTrackingCommand command = PrototypeFlightPlanTracker.Track(
            plan,
            0f,
            Vector3.right * 25f,
            Vector3.forward,
            Quaternion.identity,
            Vector3.zero,
            plan.ExpectedFuelAt(0f),
            Vector3.forward * 100f,
            8f,
            2f,
            100f);

        Assert.True(command.requiresReplan);
        Assert.True((command.replanReasons & PrototypeFlightPlanAbortReplanReason.PositionDivergence) != 0);
        Assert.True((command.replanReasons & PrototypeFlightPlanAbortReplanReason.TrackingDiverged) != 0);
    }

    [Test]
    public void ShipPlanningSnapshotPreservesRealAuthorityFields()
    {
        PrototypeShipPlanningSnapshot snapshot = CreateSnapshot();

        Assert.True(snapshot.IsFinite);
        Assert.True(snapshot.usesImportedFunctionalSockets);
        Assert.True(snapshot.usesPhysicalMainNozzleForces);
        Assert.True(snapshot.usesExperimentalPhysicalRcsNozzles);
        Assert.True(snapshot.centralGravityEnabled);
        Assert.True(snapshot.atmosphereEnabled);
        Assert.That(snapshot.rigidbodyMassKg, Is.EqualTo(250f).Within(0.0001f));
        Assert.That(snapshot.mainThrustNewtons, Is.EqualTo(1200f).Within(0.0001f));
        Assert.That(snapshot.mainFuelKgPerSecond, Is.EqualTo(0.6f).Within(0.0001f));
        Assert.That(snapshot.rcsTranslationForceNewtons, Is.EqualTo(35f).Within(0.0001f));
        Assert.That(snapshot.mainNozzleCount, Is.EqualTo(2));
        Assert.That(snapshot.rcsNozzleCount, Is.EqualTo(12));
        Assert.That(snapshot.massDescriptorCount, Is.EqualTo(5));
    }

    [Test]
    public void ShipPlanningSnapshotBuilderCapturesGeneratedRuntimeShipAuthority()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("GeneratedPlanningSnapshotShip");
            rig.Ship.transform.position = new Vector3(3f, 1.5f, -4f);
            rig.Body.linearVelocity = new Vector3(1.25f, -0.5f, 3f);
            rig.Body.angularVelocity = new Vector3(0.1f, 0.2f, -0.3f);
            rig.Stats.ApplyMassProperties(rig.Body);

            PrototypeShipPlanningSnapshot snapshot = PrototypeShipPlanningSnapshotBuilder.Build(rig.Ship.transform);

            Assert.True(snapshot.IsFinite);
            Assert.False(snapshot.usesImportedFunctionalSockets);
            Assert.False(snapshot.usesPhysicalMainNozzleForces);
            Assert.False(snapshot.usesExperimentalPhysicalRcsNozzles);
            Assert.That(snapshot.initialState.velocity, Is.EqualTo(rig.Body.linearVelocity));
            Assert.That(snapshot.initialState.angularVelocity, Is.EqualTo(rig.Body.angularVelocity));
            Assert.That(snapshot.worldCenterOfMass, Is.EqualTo(rig.Body.worldCenterOfMass));
            Assert.That(snapshot.localCenterOfMass, Is.EqualTo(rig.Body.centerOfMass));
            Assert.That(snapshot.rigidbodyMassKg, Is.EqualTo(rig.Body.mass).Within(0.0001f));
            Assert.That(snapshot.currentFuelKg, Is.EqualTo(rig.Stats.CurrentFuelKg).Within(0.0001f));
            Assert.That(snapshot.maxFuelKg, Is.EqualTo(rig.Stats.MaxFuelKg).Within(0.0001f));
            Assert.That(snapshot.mainNozzleCount, Is.EqualTo(1));
            Assert.That(snapshot.rcsNozzleCount, Is.EqualTo(6));
            Assert.That(snapshot.mainThrustNewtons, Is.EqualTo(rig.Stats.Thrust * rig.MainThruster.ThrottleScale).Within(0.0001f));
            Assert.That(snapshot.mainFuelKgPerSecond, Is.EqualTo(rig.Stats.FuelConsumptionKgPerSecond * rig.MainThruster.ThrottleScale).Within(0.0001f));
            Assert.That(snapshot.reverseThrustMultiplier, Is.EqualTo(rig.Stats.ReverseThrustMultiplier).Within(0.0001f));
            Assert.That(snapshot.mainGimbalLimitDegrees, Is.EqualTo(rig.MainThruster.GimbalLimitDegrees).Within(0.0001f));
            Assert.That(snapshot.rcsTranslationForceNewtons, Is.EqualTo(rig.Rcs.TranslationForce).Within(0.0001f));
            Assert.That(snapshot.rcsAttitudeForceNewtons, Is.EqualTo(rig.Rcs.AttitudeForce).Within(0.0001f));
        }
    }

    [Test]
    public void ShipPlanningSnapshotBuilderCapturesImportedFunctionalSocketEvidence()
    {
        AssetDatabase.ImportAsset("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx", ImportAssetOptions.ForceUpdate);
        GameObject host = new GameObject("PrototypeBootstrapTestHost");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "buildOnStart", false);

        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.That(bootstrap.BuildMode, Is.EqualTo(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault));
        Assert.NotNull(ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName));

        ShipStats stats = ship.GetComponent<ShipStats>();
        Rigidbody body = ship.GetComponent<Rigidbody>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        MainThrusterBank mainThruster = ship.GetComponent<MainThrusterBank>();

        PrototypeShipPlanningSnapshot snapshot = PrototypeShipPlanningSnapshotBuilder.Build(ship.transform);

        Assert.True(snapshot.IsFinite);
        Assert.True(snapshot.usesImportedFunctionalSockets);
        Assert.NotNull(stats);
        Assert.NotNull(body);
        Assert.NotNull(rcs);
        Assert.NotNull(mainThruster);
        Assert.That(snapshot.rigidbodyMassKg, Is.EqualTo(body.mass).Within(0.0001f));
        Assert.That(snapshot.currentFuelKg, Is.EqualTo(stats.CurrentFuelKg).Within(0.0001f));
        Assert.That(snapshot.maxFuelKg, Is.EqualTo(stats.MaxFuelKg).Within(0.0001f));
        Assert.That(snapshot.mainNozzleCount, Is.GreaterThanOrEqualTo(1));
        Assert.That(snapshot.rcsNozzleCount, Is.GreaterThanOrEqualTo(8));
        Assert.That(snapshot.massDescriptorCount, Is.GreaterThanOrEqualTo(5));
        Assert.That(snapshot.mainThrustNewtons, Is.GreaterThan(0f));
        Assert.That(snapshot.mainFuelKgPerSecond, Is.GreaterThan(0f));
        Assert.That(snapshot.rcsTranslationForceNewtons, Is.GreaterThan(0f));
        Assert.That(snapshot.rcsAttitudeForceNewtons, Is.GreaterThan(0f));
    }

    private static PrototypeFlightPlan CreatePlan(PrototypeManeuverSegment[] segments)
    {
        return CreatePlan(segments, System.Array.Empty<PrototypeTrajectoryPredictedSample>());
    }

    private static PrototypeFlightPlan CreatePlan(
        PrototypeManeuverSegment[] segments,
        PrototypeTrajectoryPredictedSample[] samples)
    {
        return new PrototypeFlightPlan(
            "test-plan",
            2,
            1f,
            0.02f,
            Vector3.forward * 100f,
            5f,
            0.5f,
            CreateSnapshot(),
            segments,
            samples);
    }

    private static PrototypeManeuverSegment CreateSegment(
        int index,
        PrototypeManeuverPhase phase,
        PrototypeManeuverCommandMode mode,
        float startTime,
        float duration,
        float mainFuel,
        float rcsFuel)
    {
        return CreateSegmentWithDirection(index, phase, mode, startTime, duration, Vector3.forward, mainFuel, rcsFuel);
    }

    private static PrototypeManeuverSegment CreateSegmentWithDirection(
        int index,
        PrototypeManeuverPhase phase,
        PrototypeManeuverCommandMode mode,
        float startTime,
        float duration,
        Vector3 direction,
        float mainFuel = 0f,
        float rcsFuel = 0f,
        PrototypeManeuverProfile profile = PrototypeManeuverProfile.Default)
    {
        return new PrototypeManeuverSegment(
            index,
            phase,
            mode,
            startTime,
            duration,
            direction,
            direction.normalized * startTime,
            direction.normalized * (startTime + duration),
            direction.normalized,
            direction.normalized,
            Quaternion.identity,
            Quaternion.identity,
            Vector3.zero,
            Vector3.zero,
            mode == PrototypeManeuverCommandMode.MainThrottle ? 1f : 0f,
            mode == PrototypeManeuverCommandMode.RcsTranslation ? 0.5f : 0f,
            duration,
            mainFuel,
            rcsFuel,
            new PrototypeFlightPlanTolerance(4f, 1f, 10f, 0.5f, 0.2f, 0.05f, 5f),
            PrototypeFlightPlanAbortReplanReason.PositionDivergence
                | PrototypeFlightPlanAbortReplanReason.VelocityDivergence
                | PrototypeFlightPlanAbortReplanReason.FuelMismatch,
            profile: profile);
    }

    private static PrototypeTrajectoryPredictedSample CreateSample(
        float time,
        int segmentIndex,
        PrototypeManeuverPhase phase,
        Vector3 position,
        Vector3 velocity)
    {
        return new PrototypeTrajectoryPredictedSample(
            time,
            segmentIndex,
            phase,
            position,
            velocity,
            Quaternion.identity,
            Vector3.zero,
            Mathf.Max(0f, 20f - time),
            phase == PrototypeManeuverPhase.ProgradeBurn || phase == PrototypeManeuverPhase.RetrogradeBurn ? 1f : 0f,
            Vector3.zero);
    }

    private static float InvokeEstimateAttitudeSegmentSeconds(Quaternion currentRotation, Vector3 desiredForward)
    {
        MethodInfo method = typeof(PrototypeTrajectoryPlanner).GetMethod(
            "EstimateAttitudeSegmentSeconds",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return (float)method.Invoke(null, new object[] { currentRotation, desiredForward, CreateSnapshot() });
    }

    private static Vector3 DirectionAtYaw(float angleDegrees)
    {
        return Quaternion.AngleAxis(angleDegrees, Vector3.up) * Vector3.forward;
    }

    private static float ExpectedAttitudeSegmentSeconds(float angleDegrees)
    {
        float angleRad = angleDegrees * Mathf.Deg2Rad;
        float rateRad = PrototypeFlightPlanExecutionConfig.BrakeFlipMaxTurnRateDegreesPerSecond * Mathf.Deg2Rad;
        float accel = PrototypeFlightPlanExecutionConfig.BrakeFlipMaxAngularAccelerationRadPerSecondSquared;
        float threshold = (rateRad * rateRad) / accel;
        float seconds = angleRad <= threshold
            ? 2f * Mathf.Sqrt(angleRad / accel)
            : (angleRad / rateRad) + (rateRad / accel);
        seconds += PrototypeFlightPlanExecutionConfig.BrakeFlipDampingTimeSeconds + 0.4f;
        return Mathf.Clamp(seconds, 0.2f, 12f);
    }

    private static PrototypeShipPlanningSnapshot CreateSnapshot()
    {
        return new PrototypeShipPlanningSnapshot(
            new TrajectoryPredictionState(
                Vector3.zero,
                Vector3.forward,
                Quaternion.identity,
                Vector3.zero,
                0f,
                20f),
            Vector3.zero,
            new Vector3(0.1f, -0.2f, 0.05f),
            new Vector3(4f, 5f, 6f),
            Quaternion.identity,
            250f,
            20f,
            20f,
            1200f,
            0.6f,
            0.45f,
            2f,
            3f,
            8f,
            60f,
            35f,
            22f,
            8f,
            9f,
            true,
            true,
            true,
            true,
            true,
            2,
            12,
            5);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
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
