#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeFlightPlanValidationTests
{
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

    private static PrototypeFlightPlan CreatePlan(PrototypeManeuverSegment[] segments)
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
            System.Array.Empty<PrototypeTrajectoryPredictedSample>());
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
        return new PrototypeManeuverSegment(
            index,
            phase,
            mode,
            startTime,
            duration,
            Vector3.forward,
            Vector3.forward * startTime,
            Vector3.forward * (startTime + duration),
            Vector3.forward,
            Vector3.forward,
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
                | PrototypeFlightPlanAbortReplanReason.FuelMismatch);
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
}
#endif
