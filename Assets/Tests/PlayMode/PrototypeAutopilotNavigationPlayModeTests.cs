using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeAutopilotNavigationPlayModeTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private enum DirectFastTransferTrackingInjectionMode
    {
        None = 0,
        Burn = 10,
        Brake = 20,
        ConsecutiveBurnCorrections = 30
    }

    private SimulationMode previousSimulationMode;

    [SetUp]
    public void SetUp()
    {
        DestroyByPrefix("AutopilotPlayModeV2");
        DestroyByPrefix("PrototypeBootstrap");
        DestroyByPrefix("PrototypeShip");
        DestroyByPrefix("PrototypeShipVisualSwitcher");
        DestroyByPrefix("PrototypeEnvironment");
        PrototypeNavigationObstacleRegistry.ClearForTests();
        previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        Physics.SyncTransforms();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyByPrefix("AutopilotPlayModeV2");
        DestroyByPrefix("PrototypeBootstrap");
        DestroyByPrefix("PrototypeShip");
        DestroyByPrefix("PrototypeShipVisualSwitcher");
        DestroyByPrefix("PrototypeEnvironment");
        PrototypeNavigationObstacleRegistry.ClearForTests();
        Physics.simulationMode = previousSimulationMode;
    }

    [Test]
    public void PlayMode_Autopilot_ReachesWaypoint_NoObstacle()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 72f);
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunHarness(rig, 760);

        Assert.NotNull(result);
        Assert.That(result.InitialDistance, Is.GreaterThan(result.FinalDistance));
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.That(result.FinalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 1.5f));
        Assert.That(result.Snapshots.Count, Is.GreaterThan(25));
    }

    [Test]
    public void PlayMode_Autopilot_AvoidsObstacle_ThenReachesWaypoint()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 96f);
        PrototypeNavigationObstacle obstacle = CreateObstacle(Vector3.forward * 42f, 8f);
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunHarness(rig, 820, obstacle);

        Assert.NotNull(result);
        Assert.True(result.SawAvoidance, "Autopilot should enter avoidance before reacquiring.");
        Assert.True(result.SawReacquire || result.SawDirectAfterAvoidance, "Autopilot should leave avoidance once the direct path clears.");
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.That(result.MinimumObstacleClearance, Is.GreaterThan(0.25f));
    }

    [Test]
    public void PlayMode_Autopilot_PhysicsAvoidsObstacleWithoutHarnessMotion()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 118f);
        PrototypeNavigationObstacle obstacle = CreateObstacle(Vector3.forward * 42f, 8f);
        SetPrivateFloat(rig.Autopilot, "avoidanceLockSeconds", 4f);
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunClosedLoopPhysics(rig, 760, obstacle);

        Assert.NotNull(result);
        Assert.True(result.SawAvoidance, "Autopilot should enter obstacle avoidance from real detector data.");
        Assert.True(result.SawActualRcsAvoidanceForce, "Closed-loop avoidance must apply real lateral RCS force through PlayerShipController.");
        Assert.True(result.PassedObstacle, "Ship should physically pass the obstacle instead of only planning a waypoint.");
        Assert.That(result.FinalDistance, Is.LessThan(result.InitialDistance), "Ship should make real progress toward the selected target.");
        Assert.That(result.MaximumLateralOffset, Is.GreaterThan(obstacle.Radius + 0.5f), "Ship should build enough lateral offset to route around the obstacle.");
        Assert.That(result.MinimumObstacleClearance, Is.GreaterThan(0.25f), "Ship should keep physical clearance outside the obstacle radius.");
    }

    [Test]
    public void PlayMode_Autopilot_LaunchCorridorObstacleCourse_PrecomputesAvoidanceBeforeFlightAndReachesTarget()
    {
        GameObject environmentHost = new GameObject("AutopilotPlayModeV2LaunchCorridorEnvironmentHost");
        PrototypeTestEnvironment environment = environmentHost.AddComponent<PrototypeTestEnvironment>();
        environment.Rebuild();
        Physics.SyncTransforms();

        PrototypeNavigationObstacle[] launchObstacles = GetLaunchCorridorObstacles();
        Assert.That(launchObstacles.Length, Is.EqualTo(3));

        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 96f);
        rig.Autopilot.ToggleAutopilot();

        StepSimulation(rig);

        Assert.True(rig.Autopilot.CurrentPlan.avoidanceActive, "preflight plan should commit to avoidance before the ship moves.");
        Assert.That(rig.Autopilot.SelectedCandidate, Is.Not.EqualTo("direct"));
        Assert.That(rig.Autopilot.PlanSegments.Length, Is.GreaterThanOrEqualTo(3));
        Assert.That(rig.Autopilot.PredictedRoute.Length, Is.GreaterThan(0));
        Assert.That(rig.Autopilot.AvoidanceWaypoint.sqrMagnitude, Is.GreaterThan(0.0001f));
        Assert.That(rig.Autopilot.CurrentPlan.directPathBlocked, Is.True);

        AutopilotRunResult result = RunClosedLoopPhysics(rig, 1200, launchObstacles);

        Assert.NotNull(result);
        Assert.True(result.SawAvoidance, "launch corridor should force avoidance before the ship reaches the obstacle course.");
        Assert.True(result.SawReacquire || result.SawDirectAfterAvoidance, "autopilot should rejoin the direct path once the launch corridor clears.");
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition),
            $"distance={result.FinalDistance:0.00} speed={rig.Body.linearVelocity.magnitude:0.00} lateral={result.FinalLateralSpeed:0.00} "
            + $"phase={rig.Autopilot.NavigationPhase} segment={rig.Autopilot.ActiveSegmentLabel} "
            + $"candidate={rig.Autopilot.SelectedCandidate} reason={rig.Autopilot.SelectedCandidateReason}\n"
            + BuildStepSnapshotTail(result, 8));
        Assert.That(result.FinalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 1.5f));
        Assert.That(result.MinimumObstacleClearance, Is.GreaterThan(0.25f));
    }

    [Test]
    public void PlayMode_Autopilot_ImportedFunctionalScoutDoesNotFlipBeforePlannedBrakeSegment()
    {
        AutopilotPlayModeRig rig = CreateImportedFunctionalRig(Vector3.forward * 250f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Body.linearVelocity = Vector3.forward * 12f;
        rig.Body.angularVelocity = Vector3.zero;
        rig.Ship.transform.rotation = Quaternion.identity;
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        Assert.True(rig.Rcs.UseImportedFunctionalSockets);
        Assert.That(rig.Rcs.InstalledNozzleCount, Is.GreaterThanOrEqualTo(8));
        Assert.True(rig.Autopilot.HasExecutableFlightPlan);
        Assert.True(rig.Autopilot.FlightPlanExecutorActive);
        PrototypeManeuverSegment flipSegment = FindRequiredFlightPlanSegment(rig.Autopilot, PrototypeManeuverPhase.FlipToRetrograde);
        Assert.That(flipSegment.startTimeSeconds, Is.GreaterThan(rig.Autopilot.FlightPlanExecutorElapsedSeconds));

        int samplesBeforeFlip = 0;
        float lastElapsed = rig.Autopilot.FlightPlanExecutorElapsedSeconds;
        List<string> trace = new List<string>();
        while (rig.Autopilot.AutopilotEngaged
            && rig.Autopilot.FlightPlanExecutorElapsedSeconds < flipSegment.startTimeSeconds - Time.fixedDeltaTime
            && samplesBeforeFlip < 220)
        {
            bool visibleSafetyReason = rig.Autopilot.NavigationObstacleDetected
                || rig.Autopilot.AvoidanceActive
                || rig.Autopilot.FlightPlanRequiresReplan
                || rig.Autopilot.FlightPlanRequiresAbort
                || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
            bool enteredBrakeBeforePlan = rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FlipForBrake
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Brake;
            Assert.False(
                enteredBrakeBeforePlan && !visibleSafetyReason,
                "Imported functional runtime entered brake/flip before the planned segment without a visible safety reason.\n"
                + BuildImportedFlightPlanTrace(rig, flipSegment, trace));

            Assert.That(
                rig.Autopilot.CurrentFlightPlanExecutionState.activePhase,
                Is.Not.EqualTo(PrototypeManeuverPhase.FlipToRetrograde).And.Not.EqualTo(PrototypeManeuverPhase.RetrogradeBurn),
                BuildImportedFlightPlanTrace(rig, flipSegment, trace));

            trace.Add(
                $"i={samplesBeforeFlip} elapsed={rig.Autopilot.FlightPlanExecutorElapsedSeconds:0.00}/{flipSegment.startTimeSeconds:0.00} "
                + $"state={rig.Autopilot.CurrentState} phase={rig.Autopilot.CurrentFlightPlanExecutionState.activePhase} "
                + $"nav={rig.Autopilot.NavigationPhase} main={rig.Autopilot.RequestedMainThrottle:0.00} "
                + $"dist={Vector3.Distance(rig.Body.position, rig.Target.Position):0.00}");
            lastElapsed = rig.Autopilot.FlightPlanExecutorElapsedSeconds;
            StepClosedLoopPhysicsWithoutForcedReplan(rig);
            samplesBeforeFlip++;
        }

        Assert.That(samplesBeforeFlip, Is.GreaterThan(8));
        Assert.That(lastElapsed, Is.LessThan(flipSegment.startTimeSeconds));
        Assert.False(rig.Autopilot.NavigationObstacleDetected);
    }

    [Test]
    public void PlayMode_FlightPlanExecutor_PreviewAndExecutionUseSamePlan()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 120f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        PrototypeFlightPlanTrackingCommand command = rig.Autopilot.CurrentFlightPlanTrackingCommand;
        Assert.True(rig.Autopilot.FlightPlanExecutorEnabled);
        Assert.True(rig.Autopilot.StrictFlightPlanExecution);
        Assert.True(rig.Autopilot.FlightPlanExecutorActive);
        Assert.True(plan.IsValid, plan.statusLabel + " " + plan.nonExecutableReasons);
        Assert.That(plan.predictedSamples.Length, Is.GreaterThan(1));
        Assert.That(rig.Autopilot.PredictedRoute.Length, Is.GreaterThan(1));
        Assert.True(command.error.hasReferenceSample);
        Assert.That(command.error.planId, Is.EqualTo(plan.planId));
        Assert.That(command.error.revision, Is.EqualTo(plan.revision));
        Assert.That(rig.Autopilot.FlightPlanSamples.Length, Is.EqualTo(plan.predictedSamples.Length));
    }

    [Test]
    public void PlayMode_FlightPlanExecutor_DirectRoute_TracksPredictedPathAndDoesNotBurnAway()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 150f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);
        float initialDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        float maxCrossTrack = 0f;
        int progradeSamples = 0;
        int awayAccelerationSamples = 0;
        var trace = new List<string>();

        for (int i = 0; i < 180; i++)
        {
            StepClosedLoopPhysicsWithoutForcedReplan(rig);
            PrototypeFlightPlanTrackingCommand command = rig.Autopilot.CurrentFlightPlanTrackingCommand;
            PrototypeFlightPlanTrackingError error = command.error;
            if (error.hasReferenceSample)
            {
                maxCrossTrack = Mathf.Max(maxCrossTrack, error.crossTrackErrorMeters);
            }

            bool prograde = error.activePhase == PrototypeManeuverPhase.ProgradeBurn
                || error.activePhase == PrototypeManeuverPhase.ReacquireRoute;
            if (prograde && command.hasCommand)
            {
                progradeSamples++;
                if (command.desiredAccelerationWorld.sqrMagnitude > 0.0001f
                    && error.plannedTangentWorld.sqrMagnitude > 0.0001f
                    && Vector3.Dot(command.desiredAccelerationWorld.normalized, error.plannedTangentWorld) < -0.05f)
                {
                    awayAccelerationSamples++;
                }
            }

            if (i % 20 == 0)
            {
                trace.Add(
                    $"i={i} dist={Vector3.Distance(rig.Body.position, rig.Target.Position):0.0} "
                    + $"phase={error.activePhase} state={rig.Autopilot.CurrentState} "
                    + $"x={error.crossTrackErrorMeters:0.0} velErr={error.velocityErrorMetersPerSecond:0.0} "
                    + $"dot={command.accelerationDotPlannedTangent:0.00} main={command.mainThrottle:0.00} "
                    + $"replan={command.replanReasons}");
            }

            if (rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }
        }

        float finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        string diagnostics = string.Join("\n", trace);
        Assert.That(finalDistance, Is.LessThan(initialDistance - 0.5f), diagnostics);
        Assert.That(maxCrossTrack, Is.LessThan(35f), diagnostics);
        Assert.That(progradeSamples, Is.GreaterThan(0), diagnostics);
        Assert.That(awayAccelerationSamples, Is.EqualTo(0), diagnostics);
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Failed), diagnostics);
    }

    [Test]
    public void PlayMode_FlightPlanExecutor_DirectRoute_HasDirectFastTransferShapeWithoutLegacyCoast()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
        rig.Body.rotation = rig.Ship.transform.rotation;
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepSimulation(rig);

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(plan.IsValid, plan.statusLabel);
        Assert.True(plan.IsDirectFastTransfer);
        Assert.That(plan.segments.Any(segment => segment.profile == PrototypeManeuverProfile.DirectFastTransfer), Is.True);
        Assert.False(
            plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Coast),
            "Direct fast transfer plan should not emit legacy coast.");
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.AlignForBurn), Is.True);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn), Is.True);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.FlipToRetrograde), Is.True);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.RetrogradeBurn), Is.True);
        Assert.That(plan.segments.Any(segment => segment.phase == PrototypeManeuverPhase.Hold), Is.True);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_NoNominalReplanDuringFullBurn()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            900,
            DirectFastTransferTrackingInjectionMode.None);

        Assert.True(rig.Autopilot.CurrentFlightPlan.IsDirectFastTransfer, BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 8);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_MainThrottleContinuousDuringBurn()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            900,
            DirectFastTransferTrackingInjectionMode.None);

        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 8);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_MainThrottleContinuousDuringBrakeAfterLatch()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1400,
            DirectFastTransferTrackingInjectionMode.None);

        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4, minBrakeSamples: 8);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_BurnToBrakeTransition_DoesNotPulseMainThrottle()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1400,
            DirectFastTransferTrackingInjectionMode.None);

        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4, minBrakeSamples: 8);
        Assert.That(trace.BurnToBrakeLowThrottleFrames, Is.EqualTo(0), BuildDirectFastTransferTraceDiagnostics(trace));
    }

    [Test]
    public void PlayMode_DirectFastTransfer_SoftTrackingDuringBurnDoesNotClearActuatorOutput()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 240f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1400,
            DirectFastTransferTrackingInjectionMode.Burn);

        Assert.That(trace.SoftTrackingInjectionCount, Is.EqualTo(1), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.True(trace.SoftErrorInjected, BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.AfterSoftBurnFrames, Is.GreaterThan(2), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.AfterSoftReplanFrames, Is.EqualTo(0), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.MinimumMainAfterSoftError, Is.GreaterThanOrEqualTo(0.95f), BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_SoftTrackingDuringBrakeDoesNotClearActuatorOutput()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 240f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1400,
            DirectFastTransferTrackingInjectionMode.Brake);

        Assert.That(trace.SoftTrackingInjectionCount, Is.EqualTo(1), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.True(trace.SoftErrorInjected, BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.AfterSoftBurnFrames, Is.GreaterThan(2), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.AfterSoftReplanFrames, Is.EqualTo(0), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.MinimumMainAfterSoftError, Is.GreaterThanOrEqualTo(0.95f), BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4, minBrakeSamples: 8);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_ConsecutiveSoftTrackingCorrectionsDoNotReplan()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 240f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1200,
            DirectFastTransferTrackingInjectionMode.ConsecutiveBurnCorrections);

        Assert.That(trace.SoftTrackingInjectionCount, Is.EqualTo(2), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(trace.SoftTrackingInjectionFrames.Count, Is.EqualTo(2), BuildDirectFastTransferTraceDiagnostics(trace));
        Assert.That(
            trace.SoftTrackingInjectionFrames[1] - trace.SoftTrackingInjectionFrames[0],
            Is.GreaterThanOrEqualTo(25).And.LessThanOrEqualTo(40),
            BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_StartRotation90deg_NoReplanFlap()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
        rig.Body.rotation = rig.Ship.transform.rotation;
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1200,
            DirectFastTransferTrackingInjectionMode.None);

        Assert.True(rig.Autopilot.CurrentFlightPlan.IsDirectFastTransfer, BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_StartRotation135deg_NoReplanFlap()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 135f, 0f);
        rig.Body.rotation = rig.Ship.transform.rotation;
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            1400,
            DirectFastTransferTrackingInjectionMode.None);

        Assert.True(rig.Autopilot.CurrentFlightPlan.IsDirectFastTransfer, BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 4);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_InitialAngularVelocity_DelaysLatchWithoutThrottlePulse()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 25f, 0f);
        rig.Body.rotation = rig.Ship.transform.rotation;
        rig.Body.angularVelocity = Vector3.up * Mathf.Deg2Rad * 12f;
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        DirectFastTransferTrace trace = RunDirectFastTransferTrace(
            rig,
            700,
            DirectFastTransferTrackingInjectionMode.None);

        Assert.That(trace.FirstBurnLatchedFrame, Is.GreaterThan(0), BuildDirectFastTransferTraceDiagnostics(trace));
        AssertDirectFastTransferNominalInvariants(trace, minBurnSamples: 3);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_StrictExecutionIgnoresLegacyBrakeCommitFlagDuringBurn()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(plan.IsDirectFastTransfer);
        PrototypeManeuverSegment burnSegment = plan.segments.First(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", burnSegment.startTimeSeconds + Time.fixedDeltaTime * 2f);
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", false);

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        string status = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
        Assert.That(rig.Autopilot.CurrentFlightPlanExecutionState.activePhase, Is.EqualTo(PrototypeManeuverPhase.ProgradeBurn));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.GreaterThanOrEqualTo(0.95f));
        Assert.False(rig.Autopilot.FlightPlanRequiresReplan, status);
        Assert.False(status.StartsWith("Replan:") && status != "Replan: none", status);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_SlowButFarAfterBrakeReacquiresWithoutLegacyBrakeLoop()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(plan.IsDirectFastTransfer);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", plan.totalDurationSeconds + Time.fixedDeltaTime);
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        rig.Body.position = Vector3.forward * 70f;
        rig.Body.linearVelocity = Vector3.zero;
        rig.Body.angularVelocity = Vector3.zero;
        rig.Ship.transform.rotation = Quaternion.identity;
        rig.Body.rotation = Quaternion.identity;
        Physics.SyncTransforms();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        string status = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
        Assert.That(rig.Autopilot.NavigationPhase, Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath));
        Assert.True(GetPrivateBool(rig.Autopilot, "directFastTransferTerminalReacquireActive"));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.False(rig.Autopilot.FlightPlanRequiresReplan, status);
        Assert.False(status.StartsWith("Replan:") && status != "Replan: none", status);
    }

    [Test]
    public void PlayMode_DirectFastTransfer_HardInvalidationFailsWithoutAutomaticReplan()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan initialPlan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(initialPlan.IsDirectFastTransfer);
        rig.Target.transform.position += Vector3.right * 80f;
        Physics.SyncTransforms();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        string status = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Failed));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Autopilot.FlightPlanRequiresReplan, status);
        Assert.True(rig.Autopilot.FlightPlanRequiresAbort, status);
        Assert.False(status.StartsWith("Replan:") && status != "Replan: none", status);
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.EqualTo(initialPlan.revision));
        Assert.That(rig.Autopilot.CurrentFlightPlan.planId, Is.EqualTo(initialPlan.planId));
    }

    [Test]
    public void PlayMode_DirectFastTransfer_MainAuthorityTimeoutFailsWithoutAutomaticReplan()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan initialPlan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(initialPlan.IsDirectFastTransfer);
        PrototypeManeuverSegment burnSegment = initialPlan.segments.First(segment => segment.phase == PrototypeManeuverPhase.ProgradeBurn);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", burnSegment.startTimeSeconds + Time.fixedDeltaTime * 2f);
        SetPrivateField(rig.Autopilot, "directFastTransferAuthorityBlockedPlanRevision", initialPlan.revision);
        SetPrivateField(rig.Autopilot, "directFastTransferAuthorityBlockedSegmentIndex", burnSegment.index);
        SetPrivateFloat(rig.Autopilot, "directFastTransferAuthorityBlockedSeconds", 5.99f);
        rig.Ship.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
        rig.Body.rotation = rig.Ship.transform.rotation;
        rig.Body.angularVelocity = Vector3.zero;
        Physics.SyncTransforms();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        string status = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Failed));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Autopilot.FlightPlanRequiresReplan, status);
        Assert.True(rig.Autopilot.FlightPlanRequiresAbort, status);
        Assert.False(status.StartsWith("Replan:") && status != "Replan: none", status);
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.EqualTo(initialPlan.revision));
        Assert.That(rig.Autopilot.CurrentFlightPlan.planId, Is.EqualTo(initialPlan.planId));
    }

    [Test]
    public void PlayMode_DirectFastTransfer_InvalidPlanDirectionDoesNotRecoverBeforeTerminalOwnership()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 1000f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan initialPlan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(initialPlan.IsDirectFastTransfer);
        PrototypeFlightPlanAbortReplanReason reasons =
            PrototypeFlightPlanAbortReplanReason.PositionDivergence
            | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
            | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;
        rig.Body.linearVelocity = Vector3.forward * 20f;
        Physics.SyncTransforms();
        rig.Autopilot.EvaluateMetrics();
        SetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "directFastTransferTerminalCaptureActive", true);
        SetPrivateBool(rig.Autopilot, "directFastTransferTerminalReacquireActive", false);

        bool recoverWithoutReacquire = InvokePrivateBoolMethod(
            rig.Autopilot,
            "ShouldRecoverStrictDirectFastTransferTerminalDivergence",
            reasons);
        SetPrivateBool(rig.Autopilot, "directFastTransferTerminalReacquireActive", true);
        bool recoverDuringReacquire = InvokePrivateBoolMethod(
            rig.Autopilot,
            "ShouldRecoverStrictDirectFastTransferTerminalDivergence",
            reasons);

        Assert.False(recoverWithoutReacquire, "InvalidPlanDirection should stay hard before terminal ownership or slow overshoot.");
        Assert.True(recoverDuringReacquire, "Executor-owned Reacquire may keep correcting its intentional off-plan path.");
    }

    [Test]
    public void PlayMode_DirectFastTransfer_ReacquireTimeoutFailsWithoutAutomaticReplan()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        SetPrivateFloat(rig.Autopilot, "navigationPlanIntervalSeconds", 999f);
        rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
        rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
        rig.Autopilot.ToggleAutopilot();
        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        PrototypeFlightPlan initialPlan = rig.Autopilot.CurrentFlightPlan;
        Assert.True(initialPlan.IsDirectFastTransfer);
        SetPrivateFloat(rig.Autopilot, "flightPlanElapsedSeconds", initialPlan.totalDurationSeconds + Time.fixedDeltaTime);
        SetPrivateBool(rig.Autopilot, "directFastTransferTerminalReacquireActive", true);
        SetPrivateFloat(
            rig.Autopilot,
            "directFastTransferTerminalReacquireStartedAtTime",
            54f);
        SetPrivateFloat(rig.Autopilot, "autopilotElapsedSeconds", 100f);
        rig.Body.position = Vector3.forward * 70f;
        rig.Body.linearVelocity = Vector3.right * 3f;
        rig.Body.angularVelocity = Vector3.zero;
        Physics.SyncTransforms();

        StepClosedLoopPhysicsWithoutForcedReplan(rig);

        string status = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Failed));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Autopilot.FlightPlanRequiresReplan, status);
        Assert.True(rig.Autopilot.FlightPlanRequiresAbort, status);
        Assert.False(status.StartsWith("Replan:") && status != "Replan: none", status);
        Assert.That(rig.Autopilot.CurrentFlightPlan.revision, Is.EqualTo(initialPlan.revision));
        Assert.That(rig.Autopilot.CurrentFlightPlan.planId, Is.EqualTo(initialPlan.planId));
    }

    [Test]
    public void PlayMode_DirectFastTransfer_TerminalBrakeRejectsProgradeCommittedDirection()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 80f);
        rig.Body.position = Vector3.forward * 45f;
        rig.Body.linearVelocity = Vector3.forward * 5f;
        rig.Body.angularVelocity = Vector3.zero;
        Physics.SyncTransforms();
        InvokeFixedUpdate(rig.Autopilot);
        SetPrivateBool(rig.Autopilot, "directFastTransferTerminalCaptureActive", true);
        SetPrivateVector3(rig.Autopilot, "committedBrakeDirection", Vector3.forward);

        InvokePrivateVoidMethod(rig.Autopilot, "ApplyDirectFastTransferTerminalBrake");

        Assert.That(Vector3.Dot(rig.Autopilot.DesiredBurnDirection.normalized, rig.Body.linearVelocity.normalized), Is.LessThan(-0.9f));
        Assert.That(Vector3.Dot(GetPrivateVector3(rig.Autopilot, "committedBrakeDirection").normalized, rig.Body.linearVelocity.normalized), Is.LessThan(-0.9f));
    }

    [Test]
    public void PlayMode_Autopilot_ClosedLoopBrake_RotatesAndUsesMainThrusterWithoutHarnessRotation()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 150f);
        rig.Body.linearVelocity = Vector3.forward * 45f;
        rig.Body.angularVelocity = Vector3.zero;
        SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
        rig.Autopilot.ToggleAutopilot();
        rig.Controller.SetRcsEnabled(false);
        rig.Controller.SetSasEnabled(false);

        AutopilotRunResult result = RunClosedLoopBrakePhysics(rig, 760);

        Assert.NotNull(result);
        Assert.That(result.MinimumRetrogradeAngle, Is.LessThan(result.InitialRetrogradeAngle - 45f), "autopilot should visibly rotate toward retrograde under real physics");
        Assert.True(result.SawActualRcsBrakeTorque, "closed-loop brake must apply real RCS torque through PlayerShipController");
        Assert.False(
            result.SawPrematureMainThrottle,
            $"main thruster should remain gated until near-retrograde alignment "
            + $"step={result.PrematureMainThrottleStep} angle={result.PrematureMainThrottleRetrogradeAngle:0.0} "
            + $"state={result.PrematureMainThrottleState} phase={result.PrematureMainThrottlePhase}");
        Assert.True(result.SawMainThrottleAfterAlignment, "main thruster should engage only after the ship is near retrograde alignment");
        Assert.True(result.SawBrakeForceOpposingVelocity, "main thruster force should oppose velocity during the deceleration burn");
        Assert.That(result.MaximumMainThrottle, Is.GreaterThan(0.05f));
    }

    [Test]
    public void PlayMode_Autopilot_StartsWithLateralVelocity_ReachesHold()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 64f);
        rig.Body.linearVelocity = Vector3.right * 5f;
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunHarness(rig, 820);

        Assert.NotNull(result);
        Assert.That(result.InitialLateralSpeed, Is.GreaterThan(result.FinalLateralSpeed));
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.That(result.FinalLateralSpeed, Is.LessThanOrEqualTo(0.35f));
    }

    [Test]
    public void PlayMode_Autopilot_HeavyCargo_ReportsLimitedOrCompletesWithinRelaxedEnvelope()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 78f);
        rig.Body.mass = 3500f;
        SetPrivateFloat(rig.Rcs, "translationForce", 80f);
        rig.Body.linearVelocity = Vector3.right * 4f;
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunHarness(rig, 420);

        Assert.NotNull(result);
        bool honestLimit = rig.Autopilot.ArrivalFailureReason == "LimitedRcsAuthority"
            || rig.Autopilot.CurrentPlan.limitedRcsAuthority
            || rig.Autopilot.BuildNavigationWarningChips().Length > 0;
        bool relaxedComplete = rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
            && result.FinalDistance <= rig.Target.ArrivalRadius + 5f;
        Assert.True(honestLimit || relaxedComplete, $"state={rig.Autopilot.CurrentState} reason={rig.Autopilot.ArrivalFailureReason}");
    }

    [Test]
    public void PlayMode_Autopilot_NoRcs_DoesNotFakePrecisionComplete()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 9f);
        SetPrivateFloat(rig.Rcs, "translationForce", 0f);
        rig.Body.linearVelocity = Vector3.right * 4f;
        rig.Autopilot.ToggleAutopilot();

        AutopilotRunResult result = RunHarness(rig, 90);

        Assert.NotNull(result);
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.That(
            rig.Autopilot.ArrivalFailureReason,
            Is.EqualTo("LimitedRcsAuthority").Or.EqualTo("LimitedHoldAuthority").Or.EqualTo("HoldNoAuthority"));
        Assert.That(result.FinalLateralSpeed, Is.GreaterThan(0.35f));
    }

    [Test]
    public void PlayMode_Autopilot_NearTargetOffAxisVelocity_DampsLaterallyWithoutMainThrottle()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 12f);
        rig.Body.linearVelocity = Vector3.right * 3f;
        rig.Ship.transform.rotation = Quaternion.LookRotation(Vector3.forward, Vector3.up);
        rig.Autopilot.ToggleAutopilot();

        StepSimulation(rig);

        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.FinalApproach).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(
            rig.Autopilot.ArrivalPhase,
            Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LateralCorrection).Or.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Hold));
        Assert.That(
            rig.Autopilot.ActiveSegmentType,
            Is.EqualTo(PrototypeTrajectorySegmentType.FinalApproach).Or.EqualTo(PrototypeTrajectorySegmentType.Hold));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.That(rig.Autopilot.RequestedRcsForce.magnitude, Is.GreaterThan(1f));
        Assert.That(Vector3.Dot(rig.Autopilot.RequestedRcsForce, rig.Body.linearVelocity), Is.LessThan(-0.01f));
    }

    [Test]
    public void PlayMode_Autopilot_NearTargetHighMassLowRcs_DetectsLimitedLateralAuthority()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 12f);
        rig.Body.mass = 4200f;
        SetPrivateFloat(rig.Rcs, "translationForce", 15f);
        rig.Body.linearVelocity = Vector3.right * 4f;
        rig.Autopilot.ToggleAutopilot();

        for (int i = 0; i < 30; i++)
        {
            StepSimulation(rig);
            if ((rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FinalApproach
                    && rig.Autopilot.ArrivalPhase == PrototypeWaypointAutopilotArrivalPhase.LateralCorrection)
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.HoldPosition)
            {
                break;
            }
        }

        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.FinalApproach).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(
            rig.Autopilot.ArrivalPhase,
            Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LateralCorrection).Or.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Hold));
        Assert.That(rig.Controller.HasExternalFlightAssistRequest, Is.True);
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.True(
            rig.Autopilot.CurrentPlan.limitedRcsAuthority
            || rig.Autopilot.CurrentPlan.limitedHoldAuthority
            || rig.Autopilot.ArrivalFailureReason == "LimitedRcsAuthority"
            || rig.Autopilot.ArrivalFailureReason == "LimitedHoldAuthority",
            $"state={rig.Autopilot.CurrentState} reason={rig.Autopilot.ArrivalFailureReason} "
            + $"limitedRcs={rig.Autopilot.CurrentPlan.limitedRcsAuthority} limitedHold={rig.Autopilot.CurrentPlan.limitedHoldAuthority}");
    }

    [Test]
    public void PlayMode_Autopilot_ManualOverride_AbortsAndClearsRequests()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 70f);
        SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
        rig.Autopilot.ToggleAutopilot();
        SetPrivateFloat(rig.Autopilot, "manualOverrideGraceUntilTime", -10f);

        for (int i = 0; i < 4; i++)
        {
            SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
            StepSimulation(rig);
            Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Aborted));
            Assert.True(rig.Autopilot.AutopilotEngaged);
        }

        SetPrivateProperty(rig.Controller, "LastManualFlightInput", false);
        StepSimulation(rig);
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Aborted));
        Assert.True(rig.Autopilot.AutopilotEngaged);

        SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
        StepSimulation(rig);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Aborted));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Controller.HasExternalFlightAssistRequest);
    }

    [Test]
    public void PlayMode_Autopilot_Arrival_NoBrakeAccelerateFlap_ReachesCompletionDeadzone()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 170f);
        rig.Body.linearVelocity = Vector3.forward * 44f + Vector3.right * 10f;
        rig.Body.angularVelocity = Vector3.up * 0.9f + Vector3.right * 0.45f;
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 15f, 0f);
        rig.Autopilot.ToggleAutopilot();

        bool enteredCompletionWindow = false;
        bool enteredCompletionEnvelope = false;
        bool leftCompletionEnvelope = false;
        bool seenArrivalComplete = false;
        int accelerateFramesInSettledArrivalWindow = 0;
        float minimumDistance = rig.Autopilot.DistanceToTarget;
        int brakeToAccelerateTransitions = 0;
        int terminalBrakeToAccelerateTransitions = 0;
        int accelerateToBrakeTransitions = 0;
        int throttleWhileFlipFrames = 0;
        bool sawBrakeApproachWindow = false;
        float maxBrakeAngularSpeed = 0f;
        float maxFlipAngularSpeed = 0f;
        float finalAngularSpeed = 0f;
        string firstCompletionWindowSample = string.Empty;
        List<string> stepTrace = new List<string>();
        bool sawArrivalBrakeCommitted = false;
        bool sawBrakeHoldActive = false;
        bool sawArrivalTerminalCaptureActive = false;
        bool previousArrivalBrakeCommitted = false;
        bool previousBrakeHoldActive = false;
        bool previousArrivalTerminalCaptureActive = false;
        string firstArrivalBrakeCommitSample = string.Empty;
        string firstBrakeHoldSample = string.Empty;
        string firstArrivalTerminalCaptureSample = string.Empty;
        List<string> stateTransitions = new List<string>();
        PrototypeWaypointAutopilotState previousState = rig.Autopilot.CurrentState;

        for (int i = 0; i < 2400; i++)
        {
            StepClosedLoopPhysics(rig);
            float distance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            minimumDistance = Mathf.Min(minimumDistance, distance);
            bool isInCompletionEnvelope = distance <= rig.Target.ArrivalRadius + 8f;

            if (distance <= rig.Target.ArrivalRadius + 8f && rig.Body.linearVelocity.magnitude <= 4f)
            {
                enteredCompletionWindow = true;
                if (string.IsNullOrEmpty(firstCompletionWindowSample))
                {
                    firstCompletionWindowSample =
                        $"i={i} dist={distance:0.00} metricDist={rig.Autopilot.DistanceToTarget:0.00} "
                        + $"speed={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                        + $"lat={rig.Autopilot.LateralSpeed:0.00} state={rig.Autopilot.CurrentState} phase={rig.Autopilot.NavigationPhase}";
                }
            }

            if (isInCompletionEnvelope)
            {
                enteredCompletionEnvelope = true;
            }
            else if (enteredCompletionEnvelope)
            {
                leftCompletionEnvelope = true;
            }

            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;
            if (enteredCompletionWindow && isInCompletionEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesInSettledArrivalWindow++;
            }

            if (currentState != previousState)
            {
                if (stateTransitions.Count < 64)
                {
                    stateTransitions.Add(
                        $"i={i} {previousState}->{currentState} dist={distance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} "
                        + $"closing={rig.Autopilot.ClosingSpeed:0.00} lat={rig.Autopilot.LateralSpeed:0.00} "
                        + $"phase={rig.Autopilot.NavigationPhase} main={rig.Autopilot.RequestedMainThrottle:0.00} "
                        + $"arrivalBrake={GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted")} "
                        + $"arrivalCapture={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")} "
                        + $"dftBrake={GetPrivateBool(rig.Autopilot, "directFastTransferBrakeCommitted")} "
                        + $"dftCapture={GetPrivateBool(rig.Autopilot, "directFastTransferTerminalCaptureActive")} "
                        + $"dftReacquire={GetPrivateBool(rig.Autopilot, "directFastTransferTerminalReacquireActive")}");
                }

                if (previousState == PrototypeWaypointAutopilotState.Brake
                    || previousState == PrototypeWaypointAutopilotState.FlipForBrake)
                {
                    if (currentState == PrototypeWaypointAutopilotState.Accelerate)
                    {
                        brakeToAccelerateTransitions++;
                        if (isInCompletionEnvelope || enteredCompletionWindow)
                        {
                            terminalBrakeToAccelerateTransitions++;
                        }
                    }
                }
                else if (previousState == PrototypeWaypointAutopilotState.Accelerate
                    && (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake))
                {
                    accelerateToBrakeTransitions++;
                }

                previousState = currentState;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake
                && rig.Autopilot.RequestedMainThrottle > 0.05f)
            {
                throttleWhileFlipFrames++;
            }

            bool currentArrivalBrakeCommitted = GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted");
            bool currentBrakeHoldActive = GetPrivateBool(rig.Autopilot, "brakeHoldActive");
            bool currentArrivalTerminalCaptureActive = GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive");
            sawArrivalBrakeCommitted |= currentArrivalBrakeCommitted;
            sawBrakeHoldActive |= currentBrakeHoldActive;
            sawArrivalTerminalCaptureActive |= currentArrivalTerminalCaptureActive;
            if (currentArrivalBrakeCommitted && !previousArrivalBrakeCommitted && string.IsNullOrEmpty(firstArrivalBrakeCommitSample))
            {
                firstArrivalBrakeCommitSample =
                    $"i={i} dist={distance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            if (currentBrakeHoldActive && !previousBrakeHoldActive && string.IsNullOrEmpty(firstBrakeHoldSample))
            {
                firstBrakeHoldSample =
                    $"i={i} dist={distance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            if (currentArrivalTerminalCaptureActive && !previousArrivalTerminalCaptureActive && string.IsNullOrEmpty(firstArrivalTerminalCaptureSample))
            {
                firstArrivalTerminalCaptureSample =
                    $"i={i} dist={distance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            previousArrivalBrakeCommitted = currentArrivalBrakeCommitted;
            previousBrakeHoldActive = currentBrakeHoldActive;
            previousArrivalTerminalCaptureActive = currentArrivalTerminalCaptureActive;

            float angularSpeed = rig.Body.angularVelocity.magnitude;
            finalAngularSpeed = angularSpeed;
            if (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                sawBrakeApproachWindow = true;
                maxBrakeAngularSpeed = Mathf.Max(maxBrakeAngularSpeed, angularSpeed);
            }
            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, angularSpeed);
            }

            if (currentState == PrototypeWaypointAutopilotState.HoldPosition)
            {
                seenArrivalComplete = true;
            }

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                seenArrivalComplete = currentState == PrototypeWaypointAutopilotState.Complete
                    || seenArrivalComplete;
                break;
            }

            stepTrace.Add(
                $"i={i} z={rig.Body.position.z:0.00} dist={distance:0.00} rel={rig.Autopilot.ClosingSpeed:0.00}/{rig.Body.linearVelocity.magnitude:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase} "
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00} "
                + $"reason={rig.Autopilot.ArrivalFailureReason}");
        }

        if (!enteredCompletionWindow)
        {
            string failureMessage = BuildArrivalDeadzoneFailureDiagnostics(
                rig,
                minimumDistance,
                maxBrakeAngularSpeed,
                maxFlipAngularSpeed,
                finalAngularSpeed,
                brakeToAccelerateTransitions,
                terminalBrakeToAccelerateTransitions,
                accelerateToBrakeTransitions,
                throttleWhileFlipFrames,
                leftCompletionEnvelope,
                firstCompletionWindowSample,
                stepTrace)
                + $"\neverArrivalBrakeCommitted={sawArrivalBrakeCommitted}"
                + $" everBrakeHoldActive={sawBrakeHoldActive}"
                + $" everArrivalTerminalCaptureActive={sawArrivalTerminalCaptureActive}"
                + $" finalArrivalBrakeCommitted={GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted")}"
                + $" finalBrakeHoldActive={GetPrivateBool(rig.Autopilot, "brakeHoldActive")}"
                + $" finalArrivalTerminalCaptureActive={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")}"
                + "\nstateTransitions:\n"
                + (stateTransitions.Count > 0 ? string.Join("\n", stateTransitions) : "none");
            Debug.LogError(failureMessage);
            Assert.Fail(failureMessage);
        }

        string diagnostics = BuildArrivalDeadzoneFailureDiagnostics(
                rig,
                minimumDistance,
                maxBrakeAngularSpeed,
                maxFlipAngularSpeed,
                finalAngularSpeed,
                brakeToAccelerateTransitions,
                terminalBrakeToAccelerateTransitions,
                accelerateToBrakeTransitions,
                throttleWhileFlipFrames,
                leftCompletionEnvelope,
                firstCompletionWindowSample,
                stepTrace)
            + $"\neverArrivalBrakeCommitted={sawArrivalBrakeCommitted}"
            + $" everBrakeHoldActive={sawBrakeHoldActive}"
            + $" everArrivalTerminalCaptureActive={sawArrivalTerminalCaptureActive}"
            + $" finalArrivalBrakeCommitted={GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted")}"
            + $" finalBrakeHoldActive={GetPrivateBool(rig.Autopilot, "brakeHoldActive")}"
            + $" finalArrivalTerminalCaptureActive={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")}"
            + "\nstateTransitions:\n"
            + (stateTransitions.Count > 0 ? string.Join("\n", stateTransitions) : "none");

        Assert.True(seenArrivalComplete, "Autopilot should enter HoldPosition or Complete near the arrival deadzone.\n" + diagnostics);
        Assert.True(
            rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
            || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.HoldPosition,
            "Autopilot should settle to Complete or HoldPosition near arrival.\n" + diagnostics);
        float finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        Assert.That(minimumDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 3f), diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 5f), diagnostics);
        Assert.That(brakeToAccelerateTransitions, Is.LessThanOrEqualTo(3), "brake -> accelerate should allow only planned transfer/terminal pulses, not repeated flapping.\n" + diagnostics);
        Assert.That(terminalBrakeToAccelerateTransitions, Is.EqualTo(0), "arrival should not return to Accelerate after terminal commit-and-brake.\n" + diagnostics);
        Assert.That(accelerateFramesInSettledArrivalWindow, Is.EqualTo(0), "arrival should not command Accelerate once it is slow inside the terminal window.\n" + diagnostics);
        Assert.That(accelerateToBrakeTransitions, Is.LessThanOrEqualTo(3), "arrival should not toggle beyond the planned transfer brake and terminal brake pulses.\n" + diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle should never be requested in FlipForBrake.\n" + diagnostics);
        Assert.True(sawBrakeApproachWindow, "arrival run should include a Brake or FlipForBrake segment before completion.\n" + diagnostics);
        Assert.That(maxBrakeAngularSpeed, Is.LessThanOrEqualTo(5.5f), "brake approach should stay rotationally bounded to reduce flip overshoot.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(4.25f), "brake flip should stay rotationally bounded before main decel burn.\n" + diagnostics);
        Assert.That(finalAngularSpeed, Is.LessThanOrEqualTo(3f), "arrival should settle near zero angular velocity.\n" + diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_TerminalOvershootBrakesAndHoldsWithoutReaccelerating()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 18f;
        rig.Body.linearVelocity = Vector3.back * 5f + Vector3.right * 8f;
        rig.Body.angularVelocity = Vector3.up * 1.2f + Vector3.right * 0.7f;
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 60f, 0f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        bool sawBrake = false;
        bool sawMainBrake = false;
        bool sawHoldOrComplete = false;
        int accelerateFramesInTerminalEnvelope = 0;
        int throttleWhileFlipFrames = 0;
        float maxFlipAngularSpeed = 0f;
        float finalDistance = rig.Autopilot.DistanceToTarget;
        List<string> stepTrace = new List<string>();
        bool sawArrivalBrakeCommitted = false;
        bool sawBrakeHoldActive = false;
        bool sawArrivalTerminalCaptureActive = false;
        bool previousArrivalBrakeCommitted = false;
        bool previousBrakeHoldActive = false;
        bool previousArrivalTerminalCaptureActive = false;
        string firstArrivalBrakeCommitSample = string.Empty;
        string firstBrakeHoldSample = string.Empty;
        string firstArrivalTerminalCaptureSample = string.Empty;
        string firstMainBrakeSample = string.Empty;

        for (int i = 0; i < 1800; i++)
        {
            StepClosedLoopPhysics(rig);
            finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            bool inTerminalEnvelope = finalDistance <= rig.Target.ArrivalRadius + 8f;
            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;

            if (inTerminalEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesInTerminalEnvelope++;
            }

            if (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                sawBrake = true;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, rig.Body.angularVelocity.magnitude);
                if (rig.Autopilot.RequestedMainThrottle > 0.05f)
                {
                    throttleWhileFlipFrames++;
                }
            }

            bool currentArrivalBrakeCommitted = GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted");
            bool currentBrakeHoldActive = GetPrivateBool(rig.Autopilot, "brakeHoldActive");
            bool currentArrivalTerminalCaptureActive = GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive");
            sawArrivalBrakeCommitted |= currentArrivalBrakeCommitted;
            sawBrakeHoldActive |= currentBrakeHoldActive;
            sawArrivalTerminalCaptureActive |= currentArrivalTerminalCaptureActive;
            if (currentArrivalBrakeCommitted && !previousArrivalBrakeCommitted && string.IsNullOrEmpty(firstArrivalBrakeCommitSample))
            {
                firstArrivalBrakeCommitSample =
                    $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            if (currentBrakeHoldActive && !previousBrakeHoldActive && string.IsNullOrEmpty(firstBrakeHoldSample))
            {
                firstBrakeHoldSample =
                    $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            if (currentArrivalTerminalCaptureActive && !previousArrivalTerminalCaptureActive && string.IsNullOrEmpty(firstArrivalTerminalCaptureSample))
            {
                firstArrivalTerminalCaptureSample =
                    $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            previousArrivalBrakeCommitted = currentArrivalBrakeCommitted;
            previousBrakeHoldActive = currentBrakeHoldActive;
            previousArrivalTerminalCaptureActive = currentArrivalTerminalCaptureActive;
            bool currentMainBrake = Vector3.Dot(rig.Controller.LastMainForceWorld, rig.Body.linearVelocity) < -0.01f;
            sawMainBrake |= currentMainBrake;
            if (currentMainBrake && string.IsNullOrEmpty(firstMainBrakeSample))
            {
                firstMainBrakeSample =
                    $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                    + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase}";
            }
            sawHoldOrComplete |= currentState == PrototypeWaypointAutopilotState.HoldPosition
                || currentState == PrototypeWaypointAutopilotState.Complete;

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }

            stepTrace.Add(
                $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase} "
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00} "
                + BuildBrakeAlignmentDiagnostics(rig));
        }

        string diagnostics = BuildTerminalOvershootDiagnostics(
            rig,
            finalDistance,
            accelerateFramesInTerminalEnvelope,
            throttleWhileFlipFrames,
            maxFlipAngularSpeed,
            stepTrace)
            + $"\neverArrivalBrakeCommitted={sawArrivalBrakeCommitted}"
            + $" everBrakeHoldActive={sawBrakeHoldActive}"
            + $" everArrivalTerminalCaptureActive={sawArrivalTerminalCaptureActive}"
            + $" finalArrivalBrakeCommitted={GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted")}"
            + $" finalBrakeHoldActive={GetPrivateBool(rig.Autopilot, "brakeHoldActive")}"
            + $" finalArrivalTerminalCaptureActive={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")}"
            + $"\nfirstArrivalBrakeCommitSample={firstArrivalBrakeCommitSample}"
            + $" firstBrakeHoldSample={firstBrakeHoldSample}"
            + $" firstArrivalTerminalCaptureSample={firstArrivalTerminalCaptureSample}"
            + $"\nfirstMainBrakeSample={firstMainBrakeSample}"
            + $"\nshouldUseTerminalVelocityBrake={InvokePrivateBoolMethod(rig.Autopilot, "ShouldUseTerminalVelocityBrake")}"
            + $" shouldKeepTerminalBrakeCommitted={InvokePrivateBoolMethod(rig.Autopilot, "ShouldKeepTerminalBrakeCommitted")}"
            + $" shouldHoldTerminalBrakeCommitUntilSettled={InvokePrivateBoolMethod(rig.Autopilot, "ShouldHoldTerminalBrakeCommitUntilSettled")}"
            + $" shouldCaptureAnyArrivalHold={InvokePrivateBoolMethod(rig.Autopilot, "ShouldCaptureAnyArrivalHold")}"
            + $" shouldUseTerminalLateralCorrection={InvokePrivateBoolMethod(rig.Autopilot, "ShouldUseTerminalLateralCorrection")}"
            + $" isWithinArrivalTerminalRange={InvokePrivateBoolMethod(rig.Autopilot, "IsWithinArrivalTerminalRange")}"
            + $" isWithinArrivalTerminalCaptureRange={InvokePrivateBoolMethod(rig.Autopilot, "IsWithinArrivalTerminalCaptureRange")}";

        Assert.True(sawBrake, "terminal overshoot should use the brake path before settling.\n" + diagnostics);
        Assert.True(sawMainBrake, "terminal overshoot should use the main thruster to remove high residual velocity.\n" + diagnostics);
        Assert.True(sawHoldOrComplete, "terminal overshoot should settle into HoldPosition or Complete.\n" + diagnostics);
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition),
            diagnostics);
        Assert.That(accelerateFramesInTerminalEnvelope, Is.EqualTo(0), "terminal overshoot must not re-enter transfer acceleration inside the arrival envelope.\n" + diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle should stay gated while flipping for terminal brake.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(4.25f), "terminal brake flip should remain visually bounded.\n" + diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 6f), diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_FineTerminalCorrectionUsesRcsOnlyBelowLowDeltaVThreshold()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 15f;
        rig.Body.linearVelocity = Vector3.right * 0.9f;
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 150f, 0f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        StepSimulation(rig);

        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.FinalApproach).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(rig.Autopilot.DistanceToTarget, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 6f));
        Assert.That(rig.Body.linearVelocity.magnitude, Is.LessThanOrEqualTo(1.25f));
        Assert.That(rig.Autopilot.TerminalRcsOnlyCorrectionActive, Is.True);
        Assert.That(rig.Autopilot.TerminalRcsOnlySpeedLimit, Is.EqualTo(1.25f).Within(0.01f));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.That(rig.Autopilot.RequestedRcsForce.magnitude, Is.GreaterThan(1f));
        Assert.That(Vector3.Dot(rig.Autopilot.RequestedRcsForce, rig.Body.linearVelocity), Is.LessThan(-0.01f));
    }

    [Test]
    public void PlayMode_Autopilot_FineTerminalCommittedBrakeLatchDoesNotPublishMainThrottle()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 15f;
        rig.Body.linearVelocity = Vector3.back * 0.35f + Vector3.right * 0.65f;
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 170f, 0f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive", true);
        SetPrivateVector3(rig.Autopilot, "committedBrakeDirection", Vector3.back);

        StepSimulation(rig);

        Assert.That(GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted"), Is.True);
        Assert.That(rig.Autopilot.TerminalRcsOnlyCorrectionActive, Is.True);
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.LessThanOrEqualTo(0.01f));
        Assert.That(rig.Autopilot.RequestedRcsForce.magnitude, Is.GreaterThan(1f));
        Assert.That(Vector3.Dot(rig.Autopilot.RequestedRcsForce, rig.Body.linearVelocity), Is.LessThan(-0.01f));
    }

    [Test]
    public void PlayMode_Autopilot_HighDeltaVTerminalBrakeStillAllowsMainThrottle()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 12f;
        rig.Body.linearVelocity = Vector3.forward * 8f;
        rig.Ship.transform.rotation = Quaternion.LookRotation(-rig.Body.linearVelocity.normalized, Vector3.up);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        StepSimulation(rig);

        Assert.That(rig.Autopilot.TerminalRcsOnlyCorrectionActive, Is.False);
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Brake).Or.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.GreaterThan(0.05f));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0.05f));
    }

    [Test]
    public void PlayMode_Autopilot_NearTargetLateralOvershoot_NoTerminalAccelerateOrSpin()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 18f;
        rig.Body.linearVelocity = Vector3.back * 2.4f + Vector3.right * 6.5f;
        rig.Body.angularVelocity = Vector3.up * 1.4f + Vector3.right * 0.8f;
        rig.Ship.transform.rotation = Quaternion.Euler(0f, 50f, 0f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        bool enteredTerminalEnvelope = false;
        bool sawBrake = false;
        bool sawHoldOrComplete = false;
        int accelerateFramesInTerminalEnvelope = 0;
        int throttleWhileFlipFrames = 0;
        float maxFlipAngularSpeed = 0f;
        float finalDistance = rig.Autopilot.DistanceToTarget;
        List<string> stepTrace = new List<string>();

        for (int i = 0; i < 2600; i++)
        {
            StepClosedLoopPhysics(rig);
            finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            bool inTerminalEnvelope = finalDistance <= rig.Target.ArrivalRadius + 8f;
            enteredTerminalEnvelope |= inTerminalEnvelope;
            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;

            if (inTerminalEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesInTerminalEnvelope++;
            }

            if (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                sawBrake = true;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, rig.Body.angularVelocity.magnitude);
                if (rig.Autopilot.RequestedMainThrottle > 0.05f)
                {
                    throttleWhileFlipFrames++;
                }
            }

            sawHoldOrComplete |= currentState == PrototypeWaypointAutopilotState.HoldPosition
                || currentState == PrototypeWaypointAutopilotState.Complete;

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }

            stepTrace.Add(
                $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase} "
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00} "
                + BuildBrakeAlignmentDiagnostics(rig));
        }

        string diagnostics = BuildTerminalOvershootDiagnostics(
            rig,
            finalDistance,
            accelerateFramesInTerminalEnvelope,
            throttleWhileFlipFrames,
            maxFlipAngularSpeed,
            stepTrace);

        Assert.That(enteredTerminalEnvelope, Is.True, "test should reach the arrival terminal envelope.\n" + diagnostics);
        Assert.That(accelerateFramesInTerminalEnvelope, Is.EqualTo(0), "arrival envelope must not re-enter transfer accelerate.\n" + diagnostics);
        Assert.True(sawBrake, "terminal approach should enter Brake or FlipForBrake before settle.\n" + diagnostics);
        Assert.True(sawHoldOrComplete, "terminal overshoot should settle into HoldPosition or Complete.\n" + diagnostics);
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition),
            diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle should stay gated while FlipForBrake.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(4.25f), "terminal flip angular speed should stay bounded.\n" + diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 6f), diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_TerminalBrakeCommit_PredictsDecelWithoutSpinOrFlap()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 32f);
        rig.Body.position = Vector3.forward * 18f + Vector3.right * 2f;
        rig.Body.linearVelocity = Vector3.back * 0.4f + Vector3.right * 7.2f;
        rig.Body.angularVelocity = Vector3.up * 1.1f + Vector3.right * 0.7f;
        rig.Ship.transform.rotation = Quaternion.Euler(18f, 95f, 8f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        bool sawTerminalBrakeCommit = false;
        bool sawHoldOrComplete = false;
        int accelerateFramesAfterCommit = 0;
        int brakeToAccelerateTransitionsAfterCommit = 0;
        int throttleWhileFlipFrames = 0;
        float integratedBrakeRotationRadians = 0f;
        float maxFlipAngularSpeed = 0f;
        float finalDistance = rig.Autopilot.DistanceToTarget;
        float maxCommittedBrakeDirectionDelta = 0f;
        Vector3 previousCommittedBrakeDirection = Vector3.zero;
        PrototypeWaypointAutopilotState previousState = rig.Autopilot.CurrentState;
        List<string> stepTrace = new List<string>();

        for (int i = 0; i < 3200; i++)
        {
            StepClosedLoopPhysics(rig);
            finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            bool inTerminalEnvelope = finalDistance <= rig.Target.ArrivalRadius + 10f;
            bool terminalBrakeCommitted = inTerminalEnvelope && GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive");
            sawTerminalBrakeCommit |= terminalBrakeCommitted;

            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;
            if (sawTerminalBrakeCommit && inTerminalEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesAfterCommit++;
            }

            if (sawTerminalBrakeCommit
                && inTerminalEnvelope
                && (previousState == PrototypeWaypointAutopilotState.Brake || previousState == PrototypeWaypointAutopilotState.FlipForBrake)
                && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                brakeToAccelerateTransitionsAfterCommit++;
            }

            if (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                integratedBrakeRotationRadians += rig.Body.angularVelocity.magnitude * Time.fixedDeltaTime;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, rig.Body.angularVelocity.magnitude);
                if (rig.Autopilot.RequestedMainThrottle > 0.05f)
                {
                    throttleWhileFlipFrames++;
                }
            }

            Vector3 committedBrakeDirection = GetPrivateVector3(rig.Autopilot, "committedBrakeDirection");
            if (terminalBrakeCommitted
                && (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
                && committedBrakeDirection.sqrMagnitude > 0.0001f)
            {
                if (previousCommittedBrakeDirection.sqrMagnitude > 0.0001f)
                {
                    maxCommittedBrakeDirectionDelta = Mathf.Max(
                        maxCommittedBrakeDirectionDelta,
                        Vector3.Angle(previousCommittedBrakeDirection.normalized, committedBrakeDirection.normalized));
                }

                previousCommittedBrakeDirection = committedBrakeDirection;
            }

            sawHoldOrComplete |= currentState == PrototypeWaypointAutopilotState.HoldPosition
                || currentState == PrototypeWaypointAutopilotState.Complete;
            previousState = currentState;

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }

            stepTrace.Add(
                $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} ang={rig.Body.angularVelocity.magnitude:0.00} "
                + $"state={currentState} phase={rig.Autopilot.NavigationPhase} main={rig.Autopilot.RequestedMainThrottle:0.00}");
        }

        string diagnostics = BuildTerminalOvershootDiagnostics(
            rig,
            finalDistance,
            accelerateFramesAfterCommit,
            throttleWhileFlipFrames,
            maxFlipAngularSpeed,
            stepTrace)
            + $"\nbrakeToAccelerateTransitionsAfterCommit={brakeToAccelerateTransitionsAfterCommit}"
            + $" integratedBrakeRotationRadians={integratedBrakeRotationRadians:0.00}"
            + $" maxCommittedBrakeDirectionDelta={maxCommittedBrakeDirectionDelta:0.00}";

        Assert.True(sawTerminalBrakeCommit, "terminal arrival should commit to a planned brake/decel path.\n" + diagnostics);
        Assert.True(sawHoldOrComplete, "terminal deadzone should capture HoldPosition or Complete instead of circling.\n" + diagnostics);
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition),
            diagnostics);
        Assert.That(accelerateFramesAfterCommit, Is.EqualTo(0), "terminal brake commit must not fall back to transfer Accelerate.\n" + diagnostics);
        Assert.That(brakeToAccelerateTransitionsAfterCommit, Is.EqualTo(0), "brake/decel should not flap after terminal commit.\n" + diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle must stay gated while flipping for brake.\n" + diagnostics);
        Assert.That(maxCommittedBrakeDirectionDelta, Is.LessThanOrEqualTo(75f), "terminal brake direction should stay latched instead of chasing retrograde every frame.\n" + diagnostics);
        Assert.That(integratedBrakeRotationRadians, Is.LessThanOrEqualTo(Mathf.PI * 1.35f), "terminal brake flip should not accumulate a full extra rotation.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(2.8f), "terminal brake flip should stay visually calm.\n" + diagnostics);
        Assert.That(rig.Body.angularVelocity.magnitude, Is.LessThanOrEqualTo(0.75f), "terminal deadzone should settle angular velocity.\n" + diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 6f), diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_OffAxisTerminalDeadzoneWithRealisticAuthority_LatchesHoldWithoutAccelerateFlap()
    {
        AutopilotPlayModeRig rig = CreateRig(
            Vector3.forward * 34f,
            translationForce: 15000f,
            holdConfirmSeconds: 0.35f,
            avoidanceLockSeconds: 0.15f);
        rig.Body.position = Vector3.forward * 20f + Vector3.right * 3f + Vector3.up * 1.5f;
        rig.Body.linearVelocity = Vector3.back * 0.8f + Vector3.right * 5.5f + Vector3.up * 1.75f;
        rig.Body.angularVelocity = Vector3.up * 0.85f + Vector3.right * 0.4f;
        rig.Ship.transform.rotation = Quaternion.Euler(11f, -42f, 7f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        bool sawTerminalCapture = false;
        bool sawHoldOrComplete = false;
        int accelerateFramesAfterCommit = 0;
        int throttleWhileFlipFrames = 0;
        float maxFlipAngularSpeed = 0f;
        float maxCommittedBrakeDirectionDelta = 0f;
        Vector3 previousCommittedBrakeDirection = Vector3.zero;
        float finalDistance = rig.Autopilot.DistanceToTarget;
        List<string> stepTrace = new List<string>();

        for (int i = 0; i < 3600; i++)
        {
            StepClosedLoopPhysics(rig);
            finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            bool inTerminalEnvelope = finalDistance <= rig.Target.ArrivalRadius + 10f;
            bool terminalCaptureActive = GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive");
            sawTerminalCapture |= terminalCaptureActive;

            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;
            if (terminalCaptureActive && inTerminalEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesAfterCommit++;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, rig.Body.angularVelocity.magnitude);
                if (rig.Autopilot.RequestedMainThrottle > 0.05f)
                {
                    throttleWhileFlipFrames++;
                }
            }

            if (terminalCaptureActive
                && (currentState == PrototypeWaypointAutopilotState.Brake
                    || currentState == PrototypeWaypointAutopilotState.FlipForBrake))
            {
                Vector3 committedBrakeDirection = GetPrivateVector3(rig.Autopilot, "committedBrakeDirection");
                if (committedBrakeDirection.sqrMagnitude > 0.0001f && previousCommittedBrakeDirection.sqrMagnitude > 0.0001f)
                {
                    maxCommittedBrakeDirectionDelta = Mathf.Max(
                        maxCommittedBrakeDirectionDelta,
                        Vector3.Angle(previousCommittedBrakeDirection.normalized, committedBrakeDirection.normalized));
                }

                if (committedBrakeDirection.sqrMagnitude > 0.0001f)
                {
                    previousCommittedBrakeDirection = committedBrakeDirection;
                }
            }

            sawHoldOrComplete |= currentState == PrototypeWaypointAutopilotState.HoldPosition
                || currentState == PrototypeWaypointAutopilotState.Complete;

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }

            stepTrace.Add(
                $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase} "
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00} "
                + BuildBrakeAlignmentDiagnostics(rig));
        }

        string diagnostics = BuildTerminalOvershootDiagnostics(
            rig,
            finalDistance,
            accelerateFramesAfterCommit,
            throttleWhileFlipFrames,
            maxFlipAngularSpeed,
            stepTrace)
            + $" maxCommittedBrakeDirectionDelta={maxCommittedBrakeDirectionDelta:0.00}";

        Assert.True(sawTerminalCapture, "realistic off-axis terminal arrival should keep the committed brake path.\n" + diagnostics);
        Assert.True(sawHoldOrComplete, "realistic off-axis terminal arrival should settle into HoldPosition or Complete.\n" + diagnostics);
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition),
            diagnostics);
        Assert.That(accelerateFramesAfterCommit, Is.EqualTo(0), "terminal commit must not fall back to transfer Accelerate.\n" + diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle must stay gated while flipping for brake.\n" + diagnostics);
        Assert.That(maxCommittedBrakeDirectionDelta, Is.LessThanOrEqualTo(25f), "terminal brake direction should not chase retrograde every frame.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(3.5f), "terminal brake flip should stay visually calm.\n" + diagnostics);
        Assert.That(rig.Body.angularVelocity.magnitude, Is.LessThanOrEqualTo(0.8f), "terminal deadzone should settle angular velocity.\n" + diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 7f), diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_TerminalOvershootWithoutRcsDoesNotEnterHold()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        SetPrivateFloat(rig.Rcs, "translationForce", 0f);
        rig.Body.position = Vector3.forward * 18f;
        rig.Body.linearVelocity = Vector3.back * 1.5f + Vector3.right * 2f;
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive", true);

        StepSimulation(rig);

        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Complete));
        Assert.That(rig.Autopilot.RequestedRcsForce.magnitude, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void PlayMode_Autopilot_TerminalAvoidanceStillWinsOverCommittedBrakeLatch()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 40f);
        rig.Body.position = Vector3.forward * 20f;
        rig.Body.linearVelocity = Vector3.right * 3f;
        PrototypeNavigationObstacle obstacle = CreateObstacle(Vector3.forward * 30f, 7f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);

        StepSimulation(rig);

        Assert.NotNull(obstacle);
        Assert.That(rig.Autopilot.NavigationObstacleDetected, Is.True);
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.ObstacleAvoidance));
        Assert.That(
            rig.Autopilot.NavigationPhase,
            Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning).Or.EqualTo(PrototypeWaypointAutopilotNavigationPhase.Avoiding));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
    }

    [Test]
    public void PlayMode_Autopilot_LongRangeBrakeCommitDoesNotActivateTerminalCaptureBeforeEnvelope()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Body.linearVelocity = Vector3.forward * 42f;
        rig.Autopilot.ToggleAutopilot();

        bool sawBrake = false;
        float preTerminalBoundaryDistance = rig.Target.ArrivalRadius + 25f;

        for (int i = 0; i < 1800; i++)
        {
            StepClosedLoopPhysics(rig);

            float distance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            if (distance <= preTerminalBoundaryDistance)
            {
                break;
            }

            if (rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Brake
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                sawBrake = true;
                Assert.False(
                    GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive"),
                    "long-range brake commit must not activate the terminal arrival capture latch before the terminal envelope.");
            }

            if (rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                Assert.Fail("Autopilot finished before long-range recovery check could be observed.");
            }
        }

        Assert.That(sawBrake, Is.True, "high-speed long-range run should enter Brake before terminal envelope.");
    }

    [Test]
    public void PlayMode_Autopilot_OffAxisLongRangeTerminalBrakeCommit_DoesNotReenterAccelerateOrSpin()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Body.linearVelocity = Vector3.forward * 36f + Vector3.right * 4.5f + Vector3.up * 1.5f;
        rig.Body.angularVelocity = Vector3.up * 0.55f + Vector3.right * 0.25f;
        rig.Ship.transform.rotation = Quaternion.Euler(8f, -58f, 6f);
        Physics.SyncTransforms();
        rig.Autopilot.ToggleAutopilot();

        bool sawTerminalCapture = false;
        bool sawBrake = false;
        bool sawHoldOrComplete = false;
        bool isCommitted = false;
        int accelerateFramesAfterCommit = 0;
        int brakeToAccelerateTransitionsAfterCommit = 0;
        int throttleWhileFlipFrames = 0;
        float integratedFlipRotationRadians = 0f;
        float maxFlipAngularSpeed = 0f;
        float finalDistance = rig.Autopilot.DistanceToTarget;
        List<string> stepTrace = new List<string>();
        PrototypeWaypointAutopilotState previousState = rig.Autopilot.CurrentState;

        for (int i = 0; i < 4200; i++)
        {
            StepClosedLoopPhysics(rig);
            finalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
            bool inTerminalEnvelope = finalDistance <= rig.Target.ArrivalRadius + 12f;
            bool terminalCaptureActive = GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive");
            isCommitted |= terminalCaptureActive;
            sawTerminalCapture |= terminalCaptureActive;

            PrototypeWaypointAutopilotState currentState = rig.Autopilot.CurrentState;
            if (isCommitted && inTerminalEnvelope && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                accelerateFramesAfterCommit++;
            }

            if (isCommitted
                && inTerminalEnvelope
                && (previousState == PrototypeWaypointAutopilotState.Brake || previousState == PrototypeWaypointAutopilotState.FlipForBrake)
                && currentState == PrototypeWaypointAutopilotState.Accelerate)
            {
                brakeToAccelerateTransitionsAfterCommit++;
            }

            if (currentState == PrototypeWaypointAutopilotState.Brake || currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                sawBrake = true;
            }

            if (currentState == PrototypeWaypointAutopilotState.FlipForBrake)
            {
                integratedFlipRotationRadians += rig.Body.angularVelocity.magnitude * Time.fixedDeltaTime;
                maxFlipAngularSpeed = Mathf.Max(maxFlipAngularSpeed, rig.Body.angularVelocity.magnitude);
                if (rig.Autopilot.RequestedMainThrottle > 0.05f)
                {
                    throttleWhileFlipFrames++;
                }
            }

            sawHoldOrComplete |= currentState == PrototypeWaypointAutopilotState.HoldPosition
                || currentState == PrototypeWaypointAutopilotState.Complete;

            if (currentState == PrototypeWaypointAutopilotState.Complete
                || currentState == PrototypeWaypointAutopilotState.Aborted
                || currentState == PrototypeWaypointAutopilotState.Failed
                || currentState == PrototypeWaypointAutopilotState.FuelInsufficient)
            {
                break;
            }

            previousState = currentState;
            stepTrace.Add(
                $"i={i} dist={finalDistance:0.00} rel={rig.Body.linearVelocity.magnitude:0.00} closing={rig.Autopilot.ClosingSpeed:0.00} "
                + $"lat={rig.Autopilot.LateralSpeed:0.00} state={currentState} phase={rig.Autopilot.NavigationPhase} "
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00}");
        }

        string diagnostics = BuildTerminalOvershootDiagnostics(
            rig,
            finalDistance,
            accelerateFramesAfterCommit,
            throttleWhileFlipFrames,
            maxFlipAngularSpeed,
            stepTrace)
            + $" sawTerminalCapture={sawTerminalCapture}"
            + $" brakeToAccelerateTransitionsAfterCommit={brakeToAccelerateTransitionsAfterCommit}"
            + $" integratedFlipRotationRadians={integratedFlipRotationRadians:0.00}";

        Assert.True(sawBrake, "off-axis long-range terminal run should use Brake/FlipForBrake before settle.\n" + diagnostics);
        Assert.True(sawTerminalCapture, "terminal capture latch should activate before completion in long-range off-axis scenarios.\n" + diagnostics);
        Assert.True(sawHoldOrComplete, "off-axis long-range terminal run should settle to HoldPosition or Complete.\n" + diagnostics);
        Assert.That(accelerateFramesAfterCommit, Is.EqualTo(0), "terminal commit should not re-enter transfer accelerate in the terminal envelope.\n" + diagnostics);
        Assert.That(brakeToAccelerateTransitionsAfterCommit, Is.EqualTo(0), "terminal brake must not flap to Accelerate after commit.\n" + diagnostics);
        Assert.That(throttleWhileFlipFrames, Is.EqualTo(0), "main throttle must stay gated while FlipForBrake.\n" + diagnostics);
        Assert.That(integratedFlipRotationRadians, Is.LessThanOrEqualTo(Mathf.PI * 2.25f), "terminal flip should stay below a full extra rotation before main decel.\n" + diagnostics);
        Assert.That(maxFlipAngularSpeed, Is.LessThanOrEqualTo(3.0f), "terminal flip angular speed should be kept visually calm.\n" + diagnostics);
        Assert.That(rig.Body.angularVelocity.magnitude, Is.LessThanOrEqualTo(0.75f), "terminal deadzone should settle angular velocity.\n" + diagnostics);
        Assert.That(finalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 7f), diagnostics);
    }

    [Test]
    public void PlayMode_Autopilot_BrakeDirectionUsesRetrogradeOutsideTerminalRangeEvenWithCaptureLatch()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 220f);
        rig.Body.linearVelocity = Vector3.forward * 30f + Vector3.right * 8f;
        Physics.SyncTransforms();

        InvokeFixedUpdate(rig.Autopilot);
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive", true);
        SetPrivateVector3(rig.Autopilot, "committedBrakeDirection", Vector3.left);

        Vector3 brakeDirection = InvokePrivateVector3Method(rig.Autopilot, "ResolveBrakeDirection").normalized;
        Vector3 expectedRetrograde = -rig.Body.linearVelocity.normalized;

        Assert.That(Vector3.Distance(rig.Body.position, rig.Target.Position), Is.GreaterThan(rig.Target.ArrivalRadius + 25f));
        Assert.That(Vector3.Angle(brakeDirection, expectedRetrograde), Is.LessThan(1f));
        Assert.That(Vector3.Angle(GetPrivateVector3(rig.Autopilot, "committedBrakeDirection").normalized, expectedRetrograde), Is.LessThan(1f));
    }

    [Test]
    public void PlayMode_Autopilot_TerminalBrakeDirectionDoesNotChaseLateralVelocity()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 30f);
        rig.Body.position = Vector3.forward * 18f;
        rig.Body.linearVelocity = Vector3.right * 6f;
        Physics.SyncTransforms();

        InvokeFixedUpdate(rig.Autopilot);
        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive", true);
        SetPrivateVector3(rig.Autopilot, "committedBrakeDirection", Vector3.back);

        Vector3 brakeDirection = InvokePrivateVector3Method(rig.Autopilot, "ResolveBrakeDirection").normalized;

        Assert.That(Vector3.Distance(rig.Body.position, rig.Target.Position), Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 8f));
        Assert.That(Vector3.Angle(Vector3.back, brakeDirection), Is.LessThanOrEqualTo(0.8f));
        Assert.That(Vector3.Angle(brakeDirection, -rig.Body.linearVelocity.normalized), Is.GreaterThan(80f));
    }

    [Test]
    public void PlayMode_Autopilot_SelectTargetClearsArrivalBrakeAndHoldHysteresis()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 120f);
        GameObject secondTargetObject = new GameObject("AutopilotPlayModeV2SecondTarget");
        secondTargetObject.transform.position = Vector3.right * 80f;
        PrototypeNavigationTarget secondTarget = secondTargetObject.AddComponent<PrototypeNavigationTarget>();
        secondTarget.Configure("SecondTarget", 10f);

        SetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted", true);
        SetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive", true);
        SetPrivateBool(rig.Autopilot, "brakeAlignmentLocked", true);
        SetPrivateBool(rig.Autopilot, "brakeHoldActive", true);
        SetPrivateFloat(rig.Autopilot, "brakeHoldStartTime", 12f);
        SetPrivateBool(rig.Autopilot, "holdConfirmStarted", true);
        SetPrivateFloat(rig.Autopilot, "holdConfirmUntilTime", 12f);
        SetPrivateVector3(rig.Autopilot, "committedBrakeDirection", Vector3.back);

        rig.Autopilot.SelectTarget(secondTarget);

        Assert.False(GetPrivateBool(rig.Autopilot, "arrivalBrakeCommitted"));
        Assert.False(GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive"));
        Assert.False(GetPrivateBool(rig.Autopilot, "brakeAlignmentLocked"));
        Assert.False(GetPrivateBool(rig.Autopilot, "brakeHoldActive"));
        Assert.False(GetPrivateBool(rig.Autopilot, "holdConfirmStarted"));
        Assert.That(GetPrivateFloat(rig.Autopilot, "brakeHoldStartTime"), Is.EqualTo(0f).Within(0.0001f));
        Assert.That(GetPrivateFloat(rig.Autopilot, "holdConfirmUntilTime"), Is.EqualTo(0f).Within(0.0001f));
        Assert.That(GetPrivateVector3(rig.Autopilot, "committedBrakeDirection"), Is.EqualTo(Vector3.zero));
    }

    private static string BuildArrivalDeadzoneFailureDiagnostics(
        AutopilotPlayModeRig rig,
        float minimumDistance,
        float maxBrakeAngularSpeed,
        float maxFlipAngularSpeed,
        float finalAngularSpeed,
        int brakeToAccelerateTransitions,
        int terminalBrakeToAccelerateTransitions,
        int accelerateToBrakeTransitions,
        int throttleWhileFlipFrames,
        bool leftCompletionEnvelope,
        string firstCompletionWindowSample,
        List<string> stepTrace)
    {
        float distance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        float angularSpeed = rig.Body.angularVelocity.magnitude;
        string finalState = $"{rig.Autopilot.CurrentState}";
        string finalPhase = $"{rig.Autopilot.NavigationPhase}";
        string lastSamples = string.Empty;

        int start = Mathf.Max(0, stepTrace.Count - 5);
        for (int i = start; i < stepTrace.Count; i++)
        {
            lastSamples += stepTrace[i] + (i + 1 < stepTrace.Count ? "\n" : string.Empty);
        }

        return
            $"Autopilot should enter completion deadzone near target before terminal state.\n"
            + $"finalState={finalState}\n"
            + $"finalPhase={finalPhase}\n"
            + $"finalPos={rig.Body.position.x:0.00},{rig.Body.position.y:0.00},{rig.Body.position.z:0.00}\n"
            + $"finalVel={rig.Body.linearVelocity.x:0.00},{rig.Body.linearVelocity.y:0.00},{rig.Body.linearVelocity.z:0.00}\n"
            + $"finalAngularVel={rig.Body.angularVelocity.x:0.00},{rig.Body.angularVelocity.y:0.00},{rig.Body.angularVelocity.z:0.00}\n"
            + $"distance={distance:0.00} minDistance={minimumDistance:0.00} maxBrakeAngularSpeed={maxBrakeAngularSpeed:0.00} maxFlipAngularSpeed={maxFlipAngularSpeed:0.00} finalAngularSpeed={finalAngularSpeed:0.00}\n"
            + $"currentDistanceToTarget={distance:0.00} arrivalRadius={rig.Target.ArrivalRadius:0.00}\n"
            + $"leftCompletionEnvelope={leftCompletionEnvelope}\n"
            + $"firstCompletionWindowSample={firstCompletionWindowSample}\n"
            + $"brakeToAccelerateTransitions={brakeToAccelerateTransitions} terminalBrakeToAccelerateTransitions={terminalBrakeToAccelerateTransitions} "
            + $"accelerateToBrakeTransitions={accelerateToBrakeTransitions} throttleWhileFlipFrames={throttleWhileFlipFrames}\n"
            + $"ArrivalFailureReason={rig.Autopilot.ArrivalFailureReason}\n"
            + $"last5Samples:\n{lastSamples}";
    }

    private static string BuildTerminalOvershootDiagnostics(
        AutopilotPlayModeRig rig,
        float finalDistance,
        int accelerateFramesInTerminalEnvelope,
        int throttleWhileFlipFrames,
        float maxFlipAngularSpeed,
        List<string> stepTrace)
    {
        string lastSamples = string.Empty;
        int start = Mathf.Max(0, stepTrace.Count - 5);
        for (int i = start; i < stepTrace.Count; i++)
        {
            lastSamples += stepTrace[i] + (i + 1 < stepTrace.Count ? "\n" : string.Empty);
        }

        return
            $"finalState={rig.Autopilot.CurrentState} phase={rig.Autopilot.NavigationPhase}\n"
            + $"finalDistance={finalDistance:0.00} finalSpeed={rig.Body.linearVelocity.magnitude:0.00} "
            + $"finalAngularSpeed={rig.Body.angularVelocity.magnitude:0.00}\n"
            + $"accelerateFramesInTerminalEnvelope={accelerateFramesInTerminalEnvelope} "
            + $"throttleWhileFlipFrames={throttleWhileFlipFrames} maxFlipAngularSpeed={maxFlipAngularSpeed:0.00}\n"
            + $"ArrivalFailureReason={rig.Autopilot.ArrivalFailureReason}\n"
            + $"last5Samples:\n{lastSamples}";
    }

    private static string BuildBrakeAlignmentDiagnostics(AutopilotPlayModeRig rig)
    {
        Vector3 desired = rig.Autopilot.DesiredBurnDirection;
        float desiredAngle = desired.sqrMagnitude > 0.0001f
            ? Vector3.Angle(rig.Ship.transform.forward, desired.normalized)
            : -1f;
        float retrogradeAngle = rig.Body.linearVelocity.sqrMagnitude > 0.0001f
            ? Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized)
            : -1f;
        return $"desiredAngle={desiredAngle:0.0} retroAngle={retrogradeAngle:0.0}";
    }

    private static string BuildStepSnapshotTail(AutopilotRunResult result, int count)
    {
        if (result == null || result.Snapshots.Count == 0)
        {
            return "lastSamples=none";
        }

        int start = Mathf.Max(0, result.Snapshots.Count - Mathf.Max(1, count));
        string text = "lastSamples:";
        for (int i = start; i < result.Snapshots.Count; i++)
        {
            AutopilotStepSnapshot sample = result.Snapshots[i];
            text += "\n"
                + $"i={i} dist={sample.distance:0.00} rel={sample.relativeSpeed:0.00} lat={sample.lateralSpeed:0.00} "
                + $"state={sample.state} phase={sample.phase} seg={sample.segment} "
                + $"main={sample.mainThrottle:0.00} cmdMain={sample.commandMainThrottle:0.00} rcs={sample.rcsForce:0.00} "
                + $"desiredAngle={sample.desiredAngle:0.0} retroAngle={sample.retrogradeAngle:0.0} "
                + $"angDeg={sample.angularSpeedDegreesPerSecond:0.0}";
        }

        return text;
    }

    private static DirectFastTransferTrace RunDirectFastTransferTrace(
        AutopilotPlayModeRig rig,
        int maxSteps,
        DirectFastTransferTrackingInjectionMode trackingInjectionMode = DirectFastTransferTrackingInjectionMode.None)
    {
        var trace = new DirectFastTransferTrace
        {
            FirstPlanRevision = -1,
            LastPlanRevision = -1,
            InjectionMode = trackingInjectionMode,
            FirstPlanId = string.Empty,
            LastPlanId = string.Empty,
            FirstBurnLatchedFrame = -1,
            FirstBrakeLatchedFrame = -1,
            MaxBrakeDesiredAngle = -1f,
            MinimumMainAfterSoftError = 1f
        };
        bool burnLatched = false;
        bool brakeLatched = false;
        bool sawRetrogradeBurnPhase = false;
        int nextConsecutiveInjectionFrame = -1;
        int softMonitorFramesRemaining = 0;

        for (int i = 0; i < maxSteps; i++)
        {
            StepClosedLoopPhysicsWithoutForcedReplan(rig);
            bool injectedThisFrame = false;
            PrototypeFlightPlan plan = rig.Autopilot.CurrentFlightPlan;
            PrototypeFlightPlanExecutionState state = rig.Autopilot.CurrentFlightPlanExecutionState;
            PrototypeFlightPlanTrackingCommand command = rig.Autopilot.CurrentFlightPlanTrackingCommand;
            float requestedMain = rig.Autopilot.RequestedMainThrottle;
            string divergenceStatus = rig.Autopilot.FlightPlanDivergenceStatusLabel ?? string.Empty;
            string arrivalReason = rig.Autopilot.ArrivalFailureReason ?? string.Empty;
            bool inProgradeBurn = state.activePhase == PrototypeManeuverPhase.ProgradeBurn;
            bool inRetrogradeBurn = state.activePhase == PrototypeManeuverPhase.RetrogradeBurn;
            bool inFlip = state.activePhase == PrototypeManeuverPhase.FlipToRetrograde;
            bool requiresReplan = rig.Autopilot.FlightPlanRequiresReplan
                || arrivalReason.Contains("FlightPlanReplan");
            string planIdentity = GetStableFlightPlanIdentity(plan, state);
            float desiredAngle = rig.Autopilot.DesiredBurnDirection.sqrMagnitude > 0.0001f
                ? Vector3.Angle(rig.Ship.transform.forward, rig.Autopilot.DesiredBurnDirection.normalized)
                : -1f;

            if (!string.IsNullOrEmpty(planIdentity))
            {
                if (string.IsNullOrEmpty(trace.FirstPlanId))
                {
                    trace.FirstPlanId = planIdentity;
                }
                else if (!string.IsNullOrEmpty(trace.LastPlanId) && planIdentity != trace.LastPlanId)
                {
                    trace.FlightPlanIdChanges++;
                    trace.Events.Add($"planId i={i} from={trace.LastPlanId} to={planIdentity} status={divergenceStatus}");
                }

                trace.LastPlanId = planIdentity;
            }

            if (plan.revision > 0)
            {
                if (trace.FirstPlanRevision < 0)
                {
                    trace.FirstPlanRevision = plan.revision;
                }

                if (trace.LastPlanRevision > 0 && plan.revision != trace.LastPlanRevision)
                {
                    if (plan.revision < trace.LastPlanRevision)
                    {
                        trace.RevisionResetFrames++;
                        trace.Events.Add(
                            $"revisionReset i={i} from={trace.LastPlanRevision} to={plan.revision} "
                            + $"status={divergenceStatus} reason={arrivalReason}");
                    }
                    else
                    {
                        trace.PlanRevisionChanges++;
                        trace.Events.Add(
                            $"revision i={i} from={trace.LastPlanRevision} to={plan.revision} "
                            + $"status={divergenceStatus} reason={arrivalReason} planId={planIdentity}");
                    }
                }

                trace.LastPlanRevision = plan.revision;
            }
            else if (trace.LastPlanRevision > 0)
            {
                trace.RevisionResetFrames++;
                trace.Events.Add(
                    $"revisionReset i={i} from={trace.LastPlanRevision} to={plan.revision} "
                    + $"status={divergenceStatus} reason={arrivalReason}");
                trace.LastPlanRevision = plan.revision;
            }

            if (requiresReplan)
            {
                trace.ReplanFrames++;
                if (burnLatched)
                {
                    trace.ReplanWhileBurnLatchedFrames++;
                }

                if (brakeLatched)
                {
                    trace.ReplanWhileBrakeLatchedFrames++;
                }

                trace.Events.Add($"replan i={i} rev={plan.revision} phase={state.activePhase} state={rig.Autopilot.CurrentState} status={divergenceStatus} reason={arrivalReason} stateReasons={state.replanReasons} cmdReasons={command.replanReasons}");
            }

            if (divergenceStatus.StartsWith("Replan:")
                && divergenceStatus != "Replan: none")
            {
                trace.ReplanStatusFrames++;
                trace.Events.Add($"status i={i} rev={plan.revision} phase={state.activePhase} state={rig.Autopilot.CurrentState} status={divergenceStatus} stateReasons={state.replanReasons} cmdReasons={command.replanReasons}");
            }

            if (inProgradeBurn)
            {
                if (requestedMain >= 0.95f)
                {
                    burnLatched = true;
                    if (trace.FirstBurnLatchedFrame < 0)
                    {
                        trace.FirstBurnLatchedFrame = i;
                    }
                }

                if (burnLatched)
                {
                    trace.BurnLatchedSamples++;
                    if (requestedMain < 0.95f)
                    {
                        trace.LowBurnThrottleFrames++;
                    }
                }
            }

            if (inRetrogradeBurn)
            {
                if (requestedMain >= 0.95f)
                {
                    brakeLatched = true;
                    sawRetrogradeBurnPhase = true;
                    if (trace.FirstBrakeLatchedFrame < 0)
                    {
                        trace.FirstBrakeLatchedFrame = i;
                    }
                }

                bool beforeBrakeEndEnvelope = rig.Autopilot.FlightPlanExecutorElapsedSeconds < state.elapsedSeconds
                    || state.activeProgress01 < 0.92f;
                if (brakeLatched && beforeBrakeEndEnvelope)
                {
                    trace.BrakeLatchedSamples++;
                    if (requestedMain < 0.95f)
                    {
                        trace.LowBrakeThrottleFrames++;
                    }
                }

                if (desiredAngle > trace.MaxBrakeDesiredAngle)
                {
                    trace.MaxBrakeDesiredAngle = desiredAngle;
                }
            }

            bool transitionMainCommanded = burnLatched
                && brakeLatched
                && inRetrogradeBurn
                && !inProgradeBurn
                && !inFlip
                && (rig.Autopilot.FlightPlanExecutorElapsedSeconds < state.elapsedSeconds
                    || state.activeProgress01 < 0.92f)
                && command.mainThrottleAllowed
                && command.mainThrottle >= 0.95f;
            if (transitionMainCommanded && requestedMain < 0.95f)
            {
                trace.BurnToBrakeLowThrottleFrames++;
                trace.Events.Add(
                    $"brakeTransitionLowMain i={i} rev={plan.revision} phase={state.activePhase} "
                    + $"state={rig.Autopilot.CurrentState} requested={requestedMain:0.00} "
                    + $"cmd={command.mainThrottle:0.00} status={divergenceStatus}");
            }

            if ((inFlip || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FlipForBrake)
                && requestedMain > 0.001f)
            {
                trace.FlipThrottleFrames++;
            }

            bool injectBurnNow = (trackingInjectionMode == DirectFastTransferTrackingInjectionMode.Burn && !trace.SoftErrorInjected)
                || (trackingInjectionMode == DirectFastTransferTrackingInjectionMode.ConsecutiveBurnCorrections
                    && trace.SoftTrackingInjectionCount == 0)
                || (trackingInjectionMode == DirectFastTransferTrackingInjectionMode.ConsecutiveBurnCorrections
                    && trace.SoftTrackingInjectionCount == 1
                    && i >= nextConsecutiveInjectionFrame);
            if (inProgradeBurn && burnLatched && injectBurnNow)
            {
                rig.Body.position += Vector3.right * 18f;
                Physics.SyncTransforms();
                trace.SoftErrorInjected = true;
                trace.SoftTrackingInjectionCount++;
                trace.SoftTrackingInjectionFrames.Add(i);
                injectedThisFrame = true;
                softMonitorFramesRemaining = 8;
                trace.Events.Add($"softInject i={i} phase={state.activePhase} mode={trackingInjectionMode} rev={plan.revision}");
                if (trackingInjectionMode == DirectFastTransferTrackingInjectionMode.ConsecutiveBurnCorrections
                    && trace.SoftTrackingInjectionCount == 1)
                {
                    nextConsecutiveInjectionFrame = i + 30;
                }
            }

            if (trackingInjectionMode == DirectFastTransferTrackingInjectionMode.Brake
                && inRetrogradeBurn
                && brakeLatched
                && !trace.SoftErrorInjected)
            {
                rig.Body.position += Vector3.up * 7f;
                Physics.SyncTransforms();
                trace.SoftErrorInjected = true;
                trace.SoftTrackingInjectionCount++;
                trace.SoftTrackingInjectionFrames.Add(i);
                injectedThisFrame = true;
                softMonitorFramesRemaining = 8;
                trace.Events.Add($"softInject i={i} phase={state.activePhase} mode={trackingInjectionMode} rev={plan.revision}");
            }

            if (softMonitorFramesRemaining > 0 && !injectedThisFrame && (inProgradeBurn || inRetrogradeBurn || inFlip))
            {
                trace.AfterSoftBurnFrames++;
                trace.MinimumMainAfterSoftError = Mathf.Min(trace.MinimumMainAfterSoftError, requestedMain);
                if (rig.Autopilot.FlightPlanRequiresReplan)
                {
                    trace.AfterSoftReplanFrames++;
                }

                softMonitorFramesRemaining--;
            }

            trace.LastDesiredAngle = desiredAngle;

            if (i % 20 == 0)
            {
                trace.Samples.Add(
                    $"i={i} rev={plan.revision} phase={state.activePhase} state={rig.Autopilot.CurrentState} "
                    + $"main={requestedMain:0.00} cmd={command.mainThrottle:0.00} allowed={command.mainThrottleAllowed} "
                    + $"replan={rig.Autopilot.FlightPlanRequiresReplan} reasons={state.replanReasons} "
                    + $"status={divergenceStatus} angle={trace.LastDesiredAngle:0.0} "
                    + $"planId={planIdentity} maxBrakeAngle={trace.MaxBrakeDesiredAngle:0.0}");
            }

            bool terminalState = rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient;
            if (terminalState)
            {
                trace.TraceEndedInTerminalState = true;
                trace.CompletedBeforeBrakeObserved = !sawRetrogradeBurnPhase;
                break;
            }
        }

        return trace;
    }

    private static string GetStableFlightPlanIdentity(PrototypeFlightPlan plan, PrototypeFlightPlanExecutionState state)
    {
        string planId = plan.planId;
        if (!string.IsNullOrWhiteSpace(planId) && planId != "flight-plan")
        {
            return "plan:" + planId;
        }

        if (!string.IsNullOrWhiteSpace(state.planId) && state.planId != "flight-plan")
        {
            return "state:" + state.planId;
        }

        if (plan.revision > 0)
        {
            return "rev:" + plan.revision;
        }

        if (state.revision > 0)
        {
            return "rev:" + state.revision;
        }

        return string.Empty;
    }

    private static void AssertDirectFastTransferNominalInvariants(
        DirectFastTransferTrace trace,
        int minBurnSamples = 0,
        int minBrakeSamples = 0)
    {
        string diagnostics = BuildDirectFastTransferTraceDiagnostics(trace);
        Assert.That(trace.PlanRevisionChanges, Is.EqualTo(0), diagnostics);
        Assert.That(trace.RevisionResetFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.FlightPlanIdChanges, Is.EqualTo(0), diagnostics);
        Assert.That(trace.ReplanFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.ReplanStatusFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.ReplanWhileBurnLatchedFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.ReplanWhileBrakeLatchedFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.LowBurnThrottleFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.LowBrakeThrottleFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.BurnToBrakeLowThrottleFrames, Is.EqualTo(0), diagnostics);
        Assert.That(trace.FlipThrottleFrames, Is.EqualTo(0), diagnostics);
        if (minBurnSamples > 0)
        {
            Assert.That(trace.BurnLatchedSamples, Is.GreaterThan(minBurnSamples), diagnostics);
        }

        if (minBrakeSamples > 0)
        {
            Assert.That(trace.BrakeLatchedSamples, Is.GreaterThan(minBrakeSamples), diagnostics);
        }
    }

    private static string BuildDirectFastTransferTraceDiagnostics(DirectFastTransferTrace trace)
    {
        if (trace == null)
        {
            return "trace=null";
        }

        int start = Mathf.Max(0, trace.Samples.Count - 10);
        string tail = string.Join("\n", trace.Samples.GetRange(start, trace.Samples.Count - start));
        int eventStart = Mathf.Max(0, trace.Events.Count - 12);
        string events = string.Join("\n", trace.Events.GetRange(eventStart, trace.Events.Count - eventStart));
        return $"firstRev={trace.FirstPlanRevision} lastRev={trace.LastPlanRevision} revChanges={trace.PlanRevisionChanges} "
            + $"planIdChanges={trace.FlightPlanIdChanges} firstPlanId={trace.FirstPlanId} lastPlanId={trace.LastPlanId} "
            + $"revResetFrames={trace.RevisionResetFrames} replanFrames={trace.ReplanFrames} "
            + $"replanStatusFrames={trace.ReplanStatusFrames} replanBurn={trace.ReplanWhileBurnLatchedFrames} "
            + $"replanBrake={trace.ReplanWhileBrakeLatchedFrames} traceEnded={trace.TraceEndedInTerminalState} "
            + $"completedBeforeBrake={trace.CompletedBeforeBrakeObserved} "
            + $"burnSamples={trace.BurnLatchedSamples} lowBurn={trace.LowBurnThrottleFrames} firstBurnLatched={trace.FirstBurnLatchedFrame} "
            + $"brakeSamples={trace.BrakeLatchedSamples} lowBrake={trace.LowBrakeThrottleFrames} firstBrakeLatched={trace.FirstBrakeLatchedFrame} "
            + $"flipThrottleFrames={trace.FlipThrottleFrames} burnToBrakeLowThrottle={trace.BurnToBrakeLowThrottleFrames} "
            + $"maxBrakeAngle={trace.MaxBrakeDesiredAngle:0.0} softInjected={trace.SoftErrorInjected} afterSoftFrames={trace.AfterSoftBurnFrames} "
            + $"softInjectionCount={trace.SoftTrackingInjectionCount} softInjectionMode={trace.InjectionMode} "
            + $"softInjectionFrames={string.Join(",", trace.SoftTrackingInjectionFrames.ToArray())} "
            + $"minAfterSoft={trace.MinimumMainAfterSoftError:0.00}\nevents:\n{events}\nsamples:\n{tail}";
    }

    private static AutopilotRunResult RunHarness(
        AutopilotPlayModeRig rig,
        int maxSteps,
        PrototypeNavigationObstacle obstacle = null)
    {
        var result = new AutopilotRunResult
        {
            InitialDistance = rig.Autopilot.DistanceToTarget,
            InitialLateralSpeed = rig.Autopilot.LastMetrics.lateralSpeed,
            MinimumObstacleClearance = float.PositiveInfinity
        };

        bool sawAvoidance = false;
        for (int i = 0; i < maxSteps; i++)
        {
            StepSimulation(rig);
            ApplyHarnessMotion(rig, obstacle, result);
            CaptureStep(rig, result, obstacle, sawAvoidance);
            sawAvoidance |= rig.Autopilot.AvoidanceActive || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.Avoiding;

            if (rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
            {
                break;
            }
        }

        result.FinalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        result.FinalLateralSpeed = ComputeLateralSpeed(rig.Body, rig.Target.Position);
        Debug.Log(
            $"AutopilotPlayModeV2 result state={rig.Autopilot.CurrentState} phase={rig.Autopilot.NavigationPhase} "
            + $"position={rig.Body.position.x:0.00},{rig.Body.position.y:0.00},{rig.Body.position.z:0.00} "
            + $"com={rig.Body.worldCenterOfMass.x:0.00},{rig.Body.worldCenterOfMass.y:0.00},{rig.Body.worldCenterOfMass.z:0.00} "
            + $"distance={result.FinalDistance:0.00} lateral={result.FinalLateralSpeed:0.00} "
            + $"sawAvoidance={result.SawAvoidance} sawReacquire={result.SawReacquire} "
            + $"sawDirectAfterAvoidance={result.SawDirectAfterAvoidance} minClearance={result.MinimumObstacleClearance:0.00} "
            + $"candidate={rig.Autopilot.SelectedCandidate} reason={rig.Autopilot.SelectedCandidateReason}");
        return result;
    }

    private static AutopilotRunResult RunClosedLoopPhysics(
        AutopilotPlayModeRig rig,
        int maxSteps,
        params PrototypeNavigationObstacle[] obstacles)
    {
        var result = new AutopilotRunResult
        {
            InitialDistance = rig.Autopilot.DistanceToTarget,
            InitialLateralSpeed = rig.Autopilot.LastMetrics.lateralSpeed,
            MinimumObstacleClearance = float.PositiveInfinity
        };

        PrototypeNavigationObstacle[] obstacleSet = obstacles ?? System.Array.Empty<PrototypeNavigationObstacle>();

        bool sawAvoidance = false;
        for (int i = 0; i < maxSteps; i++)
        {
            StepClosedLoopPhysics(rig);
            CaptureStep(rig, result, obstacleSet.Length > 0 ? obstacleSet[0] : null, sawAvoidance);
            CaptureClosedLoopObstacleProgress(rig, result, obstacleSet);
            sawAvoidance |= rig.Autopilot.AvoidanceActive
                || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
                || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.Avoiding;

            if (rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient
                || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
            {
                break;
            }
        }

        result.FinalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        result.FinalLateralSpeed = ComputeLateralSpeed(rig.Body, rig.Target.Position);
        Debug.Log(
            $"AutopilotPlayModeV2 closed-loop avoidance state={rig.Autopilot.CurrentState} phase={rig.Autopilot.NavigationPhase} "
            + $"position={rig.Body.position.x:0.00},{rig.Body.position.y:0.00},{rig.Body.position.z:0.00} "
            + $"distance={result.FinalDistance:0.00} lateral={result.FinalLateralSpeed:0.00} "
            + $"sawAvoidance={result.SawAvoidance} passedObstacle={result.PassedObstacle} "
            + $"maxLateralOffset={result.MaximumLateralOffset:0.00} minClearance={result.MinimumObstacleClearance:0.00} "
            + $"actualRcsAvoidance={result.SawActualRcsAvoidanceForce} maxRcsForce={result.MaximumActualRcsForce:0.00} "
            + $"maxRcsTorque={result.MaximumActualRcsTorque:0.00} maxMain={result.MaximumMainThrottle:0.00} "
            + $"maxRequestedRcs={result.MaximumRequestedRcsForce:0.00} maxAssistForce={result.MaximumAssistForce:0.00} "
            + $"maxAssistTorque={result.MaximumAssistTorque:0.00} "
            + $"forward={rig.Ship.transform.forward.x:0.00},{rig.Ship.transform.forward.y:0.00},{rig.Ship.transform.forward.z:0.00} "
            + $"candidate={rig.Autopilot.SelectedCandidate}");
        return result;
    }

    private static AutopilotRunResult RunClosedLoopBrakePhysics(
        AutopilotPlayModeRig rig,
        int maxSteps)
    {
        var result = new AutopilotRunResult
        {
            InitialDistance = rig.Autopilot.DistanceToTarget,
            InitialLateralSpeed = rig.Autopilot.LastMetrics.lateralSpeed,
            InitialRetrogradeAngle = rig.Body.linearVelocity.sqrMagnitude > 0.0001f
                ? Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized)
                : 180f,
            MinimumRetrogradeAngle = 180f
        };

        for (int i = 0; i < maxSteps; i++)
        {
            result.CurrentStepIndex = i;
            StepClosedLoopBrakePhysics(rig, result);
            CaptureStep(rig, result, null, false);

            if ((rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                    || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Aborted
                    || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.FuelInsufficient
                    || rig.Autopilot.CurrentState == PrototypeWaypointAutopilotState.Failed)
                && result.SawMainThrottleAfterAlignment)
            {
                break;
            }
        }

        result.FinalDistance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        result.FinalLateralSpeed = ComputeLateralSpeed(rig.Body, rig.Target.Position);
        Debug.Log(
            $"AutopilotPlayModeV2 closed-loop brake state={rig.Autopilot.CurrentState} phase={rig.Autopilot.NavigationPhase} "
            + $"initialRetro={result.InitialRetrogradeAngle:0.0} minRetro={result.MinimumRetrogradeAngle:0.0} "
            + $"maxMain={result.MaximumMainThrottle:0.00} sawTorque={result.SawActualRcsBrakeTorque} "
            + $"mainAfterAlign={result.SawMainThrottleAfterAlignment} brakeForce={result.SawBrakeForceOpposingVelocity} "
            + $"position={rig.Body.position.x:0.00},{rig.Body.position.y:0.00},{rig.Body.position.z:0.00} "
            + $"velocity={rig.Body.linearVelocity.x:0.00},{rig.Body.linearVelocity.y:0.00},{rig.Body.linearVelocity.z:0.00}");
        return result;
    }

    private static void StepSimulation(AutopilotPlayModeRig rig)
    {
        SetPrivateBool(rig.Autopilot, "navigationPlanDirty", true);
        InvokeUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);
        Physics.SyncTransforms();
    }

    private static void StepClosedLoopPhysics(AutopilotPlayModeRig rig)
    {
        SetPrivateBool(rig.Autopilot, "navigationPlanDirty", true);
        InvokeUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Controller);
        Physics.Simulate(Time.fixedDeltaTime);
        Physics.SyncTransforms();
    }

    private static void StepClosedLoopPhysicsWithoutForcedReplan(AutopilotPlayModeRig rig)
    {
        InvokeUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Controller);
        Physics.Simulate(Time.fixedDeltaTime);
        Physics.SyncTransforms();
    }

    private static void StepClosedLoopBrakePhysics(AutopilotPlayModeRig rig, AutopilotRunResult result)
    {
        SetPrivateBool(rig.Autopilot, "navigationPlanDirty", true);
        InvokeUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);
        CaptureClosedLoopBrakeCommandGate(rig, result);
        InvokeFixedUpdate(rig.Controller);
        Physics.Simulate(Time.fixedDeltaTime);
        Physics.SyncTransforms();
        CaptureClosedLoopBrakeProgress(rig, result);
    }

    private static void CaptureClosedLoopObstacleProgress(
        AutopilotPlayModeRig rig,
        AutopilotRunResult result,
        params PrototypeNavigationObstacle[] obstacles)
    {
        if (obstacles == null || obstacles.Length == 0)
        {
            return;
        }

        Vector3 axis = rig.Target.Position;
        axis.y = 0f;
        if (axis.sqrMagnitude <= 0.0001f)
        {
            axis = Vector3.forward;
        }

        axis.Normalize();
        float minimumClearance = float.PositiveInfinity;
        float maximumLateralOffset = result.MaximumLateralOffset;
        bool passedObstacle = result.PassedObstacle;

        for (int i = 0; i < obstacles.Length; i++)
        {
            PrototypeNavigationObstacle obstacle = obstacles[i];
            if (obstacle == null)
            {
                continue;
            }

            Vector3 fromObstacle = rig.Body.position - obstacle.WorldPosition;
            Vector3 flatFromObstacle = new Vector3(fromObstacle.x, 0f, fromObstacle.z);
            float forwardOffset = Vector3.Dot(flatFromObstacle, axis);
            Vector3 lateralOffset = flatFromObstacle - axis * forwardOffset;
            maximumLateralOffset = Mathf.Max(maximumLateralOffset, lateralOffset.magnitude);
            passedObstacle |= forwardOffset > obstacle.Radius + 1f;
            minimumClearance = Mathf.Min(minimumClearance, Vector3.Distance(rig.Body.position, obstacle.WorldPosition) - obstacle.Radius);
        }

        result.MaximumLateralOffset = Mathf.Max(result.MaximumLateralOffset, maximumLateralOffset);
        result.PassedObstacle |= passedObstacle;
        result.MinimumObstacleClearance = Mathf.Min(result.MinimumObstacleClearance, minimumClearance);

        Vector3 rcsForce = rig.Controller.LastRcsActualForceWorld;
        result.MaximumRequestedRcsForce = Mathf.Max(result.MaximumRequestedRcsForce, rig.Autopilot.RequestedRcsForce.magnitude);
        result.MaximumAssistForce = Mathf.Max(result.MaximumAssistForce, rig.Controller.LastFlightAssistRequest.forceWorld.magnitude);
        result.MaximumAssistTorque = Mathf.Max(result.MaximumAssistTorque, rig.Controller.LastFlightAssistRequest.torqueLocal.magnitude);
        result.MaximumActualRcsForce = Mathf.Max(result.MaximumActualRcsForce, rcsForce.magnitude);
        result.MaximumActualRcsTorque = Mathf.Max(result.MaximumActualRcsTorque, rig.Controller.LastRcsActualTorqueWorld.magnitude);
        result.MaximumMainThrottle = Mathf.Max(result.MaximumMainThrottle, rig.Controller.MainThrustCommand);
        Vector3 directToTarget = rig.Target.Position - rig.Body.position;
        directToTarget.y = 0f;
        if (directToTarget.sqrMagnitude <= 0.0001f)
        {
            directToTarget = axis;
        }

        directToTarget.Normalize();
        Vector3 lateralRcsForce = rcsForce - directToTarget * Vector3.Dot(rcsForce, directToTarget);
        if (lateralRcsForce.magnitude > 50f)
        {
            result.SawActualRcsAvoidanceForce = true;
        }
    }

    private static void CaptureClosedLoopBrakeProgress(
        AutopilotPlayModeRig rig,
        AutopilotRunResult result)
    {
        if (rig.Body.linearVelocity.sqrMagnitude > 0.0001f)
        {
            float retrogradeAngle = Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized);
            result.MinimumRetrogradeAngle = Mathf.Min(result.MinimumRetrogradeAngle, retrogradeAngle);
        }

        result.MaximumActualRcsTorque = Mathf.Max(result.MaximumActualRcsTorque, rig.Controller.LastRcsActualTorqueWorld.magnitude);
        result.MaximumAssistTorque = Mathf.Max(result.MaximumAssistTorque, rig.Controller.LastFlightAssistRequest.torqueLocal.magnitude);
        result.MaximumMainThrottle = Mathf.Max(result.MaximumMainThrottle, rig.Controller.MainThrustCommand);
        result.SawActualRcsBrakeTorque |= rig.Controller.LastRcsActualTorqueWorld.magnitude > 100f;
        result.SawBrakeForceOpposingVelocity |= Vector3.Dot(rig.Controller.LastMainForceWorld, rig.Body.linearVelocity) < -0.01f;
    }

    private static void CaptureClosedLoopBrakeCommandGate(
        AutopilotPlayModeRig rig,
        AutopilotRunResult result)
    {
        if (result.SawMainThrottleAfterAlignment)
        {
            return;
        }

        if (rig.Body.linearVelocity.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        float retrogradeAngle = Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized);
        float requestedMainThrottle = rig.Controller.HasExternalFlightAssistRequest
            ? rig.Controller.LastExternalFlightAssistRequest.mainThrottle
            : 0f;
        if (requestedMainThrottle <= 0.05f)
        {
            return;
        }

        if (retrogradeAngle <= 30f)
        {
            result.SawMainThrottleAfterAlignment = true;
        }
        else
        {
            result.SawPrematureMainThrottle = true;
            result.PrematureMainThrottleStep = result.CurrentStepIndex;
            result.PrematureMainThrottleRetrogradeAngle = retrogradeAngle;
            result.PrematureMainThrottleState = rig.Autopilot.CurrentState.ToString();
            result.PrematureMainThrottlePhase = rig.Autopilot.NavigationPhase.ToString();
        }
    }

    private static void ApplyHarnessMotion(AutopilotPlayModeRig rig, PrototypeNavigationObstacle obstacle, AutopilotRunResult result)
    {
        float deltaTime = Time.fixedDeltaTime;
        FlightAssistRequest request = rig.Controller.HasExternalFlightAssistRequest
            ? rig.Controller.LastExternalFlightAssistRequest
            : default;
        bool hasRcsAuthority = request.forceWorld.sqrMagnitude > 0.01f;
        bool hasMainAuthority = request.mainThrottle > 0.01f;
        float configuredRcsForce = GetPrivateFloat(rig.Rcs, "translationForce");
        bool canUseHarnessRcs = configuredRcsForce > 0.01f
            && !rig.Autopilot.CurrentPlan.holdNoAuthority;

        Vector3 routeTarget = rig.Autopilot.AvoidanceActive && rig.Autopilot.AvoidanceWaypoint.sqrMagnitude > 0.0001f
            ? BuildAvoidanceHarnessTarget(rig, obstacle, result)
            : rig.Target.Position;
        Vector3 toRouteTarget = routeTarget - rig.Body.position;
        Vector3 desiredDirection = toRouteTarget.sqrMagnitude > 0.0001f
            ? toRouteTarget.normalized
            : Vector3.zero;
        if (desiredDirection.sqrMagnitude > 0.0001f && (canUseHarnessRcs || hasRcsAuthority || hasMainAuthority))
        {
            rig.Ship.transform.rotation = Quaternion.LookRotation(desiredDirection, Vector3.up);
        }

        if (!canUseHarnessRcs && (configuredRcsForce <= 0.01f || rig.Autopilot.CurrentPlan.limitedRcsAuthority))
        {
            rig.Body.position += rig.Body.linearVelocity * deltaTime;
            Physics.SyncTransforms();
            return;
        }

        float distanceToRouteTarget = toRouteTarget.magnitude;
        float maxSpeed = rig.Autopilot.AvoidanceActive ? 14f : 18f;
        float desiredSpeed = Mathf.Clamp(distanceToRouteTarget * 1.35f, 0f, maxSpeed);
        float distanceToFinalTarget = Vector3.Distance(rig.Body.position, rig.Target.Position);
        if (!rig.Autopilot.AvoidanceActive && distanceToFinalTarget <= rig.Target.ArrivalRadius + 14f)
        {
            desiredSpeed = Mathf.Min(desiredSpeed, Mathf.Clamp((distanceToFinalTarget - rig.Target.ArrivalRadius) * 1.1f, 0.05f, 4f));
        }

        Vector3 desiredVelocity = desiredDirection * desiredSpeed;
        float steeringAcceleration = canUseHarnessRcs || hasRcsAuthority
            ? 36f
            : Mathf.Max(1f, GetMaxAcceleration(rig) * Mathf.Max(0.2f, request.mainThrottle));
        rig.Body.linearVelocity = Vector3.MoveTowards(
            rig.Body.linearVelocity,
            desiredVelocity,
            steeringAcceleration * deltaTime);

        if (!rig.Autopilot.AvoidanceActive && distanceToFinalTarget <= rig.Target.ArrivalRadius + 6f && canUseHarnessRcs)
        {
            rig.Body.linearVelocity = Vector3.MoveTowards(rig.Body.linearVelocity, Vector3.zero, 48f * deltaTime);
            rig.Body.position = Vector3.MoveTowards(rig.Body.position, rig.Target.Position, 24f * deltaTime);
        }
        else
        {
            rig.Body.position += rig.Body.linearVelocity * deltaTime;
        }

        Physics.SyncTransforms();
    }

    private static Vector3 BuildAvoidanceHarnessTarget(
        AutopilotPlayModeRig rig,
        PrototypeNavigationObstacle obstacle,
        AutopilotRunResult result)
    {
        Vector3 waypoint = rig.Autopilot.AvoidanceWaypoint;
        if (obstacle == null)
        {
            return waypoint;
        }

        if (result.AvoidanceSide.sqrMagnitude <= 0.0001f)
        {
            string candidate = rig.Autopilot.SelectedCandidate ?? string.Empty;
            Vector3 selectedSide = candidate.Contains("right")
                ? Vector3.right
                : candidate.Contains("left")
                    ? Vector3.left
                    : waypoint - obstacle.WorldPosition;
            selectedSide.y = 0f;
            result.AvoidanceSide = selectedSide.sqrMagnitude > 0.0001f ? selectedSide.normalized : Vector3.right;
        }

        Vector3 side = result.AvoidanceSide;
        Vector3 forward = rig.Target.Position - obstacle.WorldPosition;
        forward.y = 0f;
        if (forward.sqrMagnitude <= 0.0001f)
        {
            forward = Vector3.forward;
        }

        Vector3 forwardDirection = forward.normalized;
        float sideClearance = obstacle.EffectiveClearanceRadius + Mathf.Max(0f, rig.Autopilot.AvoidanceClearanceMeters) + 36f;
        float forwardClearance = obstacle.EffectiveClearanceRadius + Mathf.Max(0f, rig.Autopilot.AvoidanceClearanceMeters) + 36f;
        float currentForwardOffset = Vector3.Dot(rig.Body.position - obstacle.WorldPosition, forwardDirection);
        float currentSideOffset = Mathf.Abs(Vector3.Dot(rig.Body.position - obstacle.WorldPosition, side.normalized));
        if (currentForwardOffset > forwardClearance * 0.75f && currentSideOffset > sideClearance * 0.85f)
        {
            return rig.Target.Position;
        }

        if (currentForwardOffset < 0f && currentSideOffset < sideClearance * 0.8f)
        {
            return obstacle.WorldPosition
                + side.normalized * sideClearance
                - forwardDirection * forwardClearance;
        }

        return obstacle.WorldPosition
            + side.normalized * sideClearance
            + forwardDirection * forwardClearance;
    }

    private static void CaptureStep(AutopilotPlayModeRig rig, AutopilotRunResult result, PrototypeNavigationObstacle obstacle, bool previouslyAvoided)
    {
        float distance = Vector3.Distance(rig.Body.position, rig.Target.Position);
        float lateralSpeed = ComputeLateralSpeed(rig.Body, rig.Target.Position);
        PrototypeFlightPlanTrackingCommand trackingCommand = rig.Autopilot.CurrentFlightPlanTrackingCommand;
        result.Snapshots.Add(new AutopilotStepSnapshot
        {
            distance = distance,
            relativeSpeed = rig.Body.linearVelocity.magnitude,
            lateralSpeed = lateralSpeed,
            state = rig.Autopilot.CurrentState.ToString(),
            phase = rig.Autopilot.NavigationPhase.ToString(),
            obstacleStatus = rig.Autopilot.ObstacleStatus,
            mainThrottle = rig.Autopilot.RequestedMainThrottle,
            commandMainThrottle = trackingCommand.mainThrottle,
            rcsForce = rig.Autopilot.RequestedRcsForce.magnitude,
            segment = rig.Autopilot.ActiveSegmentLabel,
            desiredAngle = rig.Autopilot.DesiredBurnDirection.sqrMagnitude > 0.0001f
                ? Vector3.Angle(rig.Ship.transform.forward, rig.Autopilot.DesiredBurnDirection.normalized)
                : -1f,
            retrogradeAngle = rig.Body.linearVelocity.sqrMagnitude > 0.0001f
                ? Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized)
                : -1f,
            angularSpeedDegreesPerSecond = rig.Body.angularVelocity.magnitude * Mathf.Rad2Deg
        });

        result.SawAvoidance |= rig.Autopilot.AvoidanceActive
            || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.AvoidancePlanning
            || rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.Avoiding;
        result.SawReacquire |= rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath;
        result.SawDirectAfterAvoidance |= previouslyAvoided && rig.Autopilot.NavigationPhase == PrototypeWaypointAutopilotNavigationPhase.Direct;
        if (obstacle != null)
        {
            float clearance = Vector3.Distance(rig.Body.position, obstacle.WorldPosition)
                - obstacle.Radius;
            result.MinimumObstacleClearance = Mathf.Min(result.MinimumObstacleClearance, clearance);
        }
    }

    private static float ComputeLateralSpeed(Rigidbody body, Vector3 targetPosition)
    {
        Vector3 toTarget = targetPosition - body.position;
        if (toTarget.sqrMagnitude <= 0.0001f)
        {
            return body.linearVelocity.magnitude;
        }

        Vector3 direction = toTarget.normalized;
        Vector3 lateral = body.linearVelocity - direction * Vector3.Dot(body.linearVelocity, direction);
        return lateral.magnitude;
    }

    private static float GetMaxAcceleration(AutopilotPlayModeRig rig)
    {
        return rig.Stats.CurrentMass > 0f ? rig.Stats.Thrust / rig.Stats.CurrentMass : 0f;
    }

    private static AutopilotPlayModeRig CreateRig(
        Vector3 targetPosition,
        float translationForce = 20000f,
        float holdConfirmSeconds = 0f,
        float avoidanceLockSeconds = 0f)
    {
        GameObject ship = new GameObject("AutopilotPlayModeV2Ship");
        ship.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        body.linearDamping = 0f;
        body.angularDamping = 0f;

        ShipStats stats = ship.AddComponent<ShipStats>();
        ShipPhysicsCore physicsCore = ship.AddComponent<ShipPhysicsCore>();
        ship.AddComponent<GunModule>();
        var mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<EngineVfxController>();
        var rcs = ship.AddComponent<RcsThrusterController>();
        var mainModule = ship.AddComponent<MainThrusterModule>();
        var controller = ship.AddComponent<PlayerShipController>();
        var detector = ship.AddComponent<PrototypeObstacleDetector>();
        var autopilot = ship.AddComponent<PrototypeWaypointAutopilot>();

        mainModule.Configure(ship.transform, body, stats, physicsCore);
        mainThruster.Configure(new[] { mainModule }, body, stats, physicsCore);
        ConfigureRcsNozzles(ship.transform, rcs, body, physicsCore);
        SetPrivateFloat(rcs, "translationForce", translationForce);
        physicsCore.Configure(body);
        stats.ApplyMassProperties(body);

        GameObject targetObject = new GameObject("AutopilotPlayModeV2Target");
        targetObject.transform.position = targetPosition;
        PrototypeNavigationTarget target = targetObject.AddComponent<PrototypeNavigationTarget>();
        target.Configure("PlayModeTarget", 10f);
        autopilot.Bind(null, controller, stats, body);
        SetPrivateFloat(autopilot, "holdConfirmSeconds", holdConfirmSeconds);
        SetPrivateFloat(autopilot, "avoidanceLockSeconds", avoidanceLockSeconds);
        autopilot.SelectTarget(target);
        detector.SetIncludeNavigationObstacleComponentsWithoutCollider(true);

        return new AutopilotPlayModeRig
        {
            Ship = ship,
            Body = body,
            Stats = stats,
            Controller = controller,
            Rcs = rcs,
            Autopilot = autopilot,
            Target = target
        };
    }

    private static AutopilotPlayModeRig CreateImportedFunctionalRig(Vector3 targetPosition)
    {
        DestroyByPrefix("PrototypeBootstrap");
        DestroyByPrefix("PrototypeShip");
        DestroyByPrefix("PrototypeShipVisualSwitcher");
        GameObject host = new GameObject("PrototypeBootstrapAutopilotPlayModeV2");
        PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
        SetPrivateField(bootstrap, "buildOnStart", false);
        SetPrivateField(bootstrap, "spawnTestTarget", false);
        SetPrivateField(bootstrap, "buildTestEnvironment", false);
        SetPrivateField(bootstrap, "allowGeneratedFallbackWhenImportedAssetMissing", false);
        bootstrap.SetBuildMode(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault, false);
        bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        ship.name = "AutopilotPlayModeV2ImportedFunctionalShip";
        Rigidbody body = ship.GetComponent<Rigidbody>();
        ShipStats stats = ship.GetComponent<ShipStats>();
        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        PrototypeObstacleDetector detector = ship.GetComponent<PrototypeObstacleDetector>();
        Assert.NotNull(body);
        Assert.NotNull(stats);
        Assert.NotNull(controller);
        Assert.NotNull(rcs);
        Assert.NotNull(autopilot);
        Assert.NotNull(detector);

        Transform visualRoot = ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName);
        Assert.NotNull(visualRoot);
        Transform activeImportedVisual = FindActiveImportedVisual(visualRoot);
        Assert.NotNull(activeImportedVisual);
        Assert.That(CountVisibleShipMeshRenderers(activeImportedVisual), Is.GreaterThan(20));
        Assert.True(rcs.UseImportedFunctionalSockets);

        GameObject targetObject = new GameObject("AutopilotPlayModeV2ImportedFunctionalTarget");
        targetObject.transform.position = targetPosition;
        PrototypeNavigationTarget target = targetObject.AddComponent<PrototypeNavigationTarget>();
        target.Configure("ImportedFunctionalTarget", 10f);
        detector.SetIncludeNavigationObstacleComponentsWithoutCollider(true);
        autopilot.SelectTarget(target);
        body.useGravity = false;
        body.linearDamping = 0f;
        body.angularDamping = 0f;
        body.position = Vector3.zero;
        body.linearVelocity = Vector3.zero;
        body.angularVelocity = Vector3.zero;
        Physics.SyncTransforms();

        return new AutopilotPlayModeRig
        {
            Ship = ship,
            Body = body,
            Stats = stats,
            Controller = controller,
            Rcs = rcs,
            Autopilot = autopilot,
            Target = target
        };
    }

    private static PrototypeManeuverSegment FindRequiredFlightPlanSegment(
        PrototypeWaypointAutopilot autopilot,
        PrototypeManeuverPhase phase)
    {
        PrototypeManeuverSegment[] segments = autopilot.FlightPlanSegments;
        for (int i = 0; i < segments.Length; i++)
        {
            if (segments[i].phase == phase)
            {
                Assert.That(segments[i].durationSeconds, Is.GreaterThan(0f));
                return segments[i];
            }
        }

        Assert.Fail("Missing flight-plan segment " + phase + ".");
        return default;
    }

    private static string BuildImportedFlightPlanTrace(
        AutopilotPlayModeRig rig,
        PrototypeManeuverSegment flipSegment,
        List<string> trace)
    {
        int start = Mathf.Max(0, trace.Count - 8);
        string tail = string.Join("\n", trace.GetRange(start, trace.Count - start));
        return "elapsed=" + rig.Autopilot.FlightPlanExecutorElapsedSeconds.ToString("0.00")
            + " flipStart=" + flipSegment.startTimeSeconds.ToString("0.00")
            + " state=" + rig.Autopilot.CurrentState
            + " nav=" + rig.Autopilot.NavigationPhase
            + " activePhase=" + rig.Autopilot.CurrentFlightPlanExecutionState.activePhase
            + " obstacle=" + rig.Autopilot.ObstacleStatus
            + "\nlast samples:\n" + tail;
    }

    private static Transform FindActiveImportedVisual(Transform importedVisualRoot)
    {
        Assert.NotNull(importedVisualRoot);
        for (int i = 0; i < importedVisualRoot.childCount; i++)
        {
            Transform child = importedVisualRoot.GetChild(i);
            if (child != null && child.gameObject.activeInHierarchy)
            {
                return child;
            }
        }

        return null;
    }

    private static int CountVisibleShipMeshRenderers(Transform root)
    {
        Renderer[] renderers = root != null ? root.GetComponentsInChildren<Renderer>(true) : new Renderer[0];
        int count = 0;
        for (int i = 0; i < renderers.Length; i++)
        {
            Renderer renderer = renderers[i];
            if (renderer != null && renderer.enabled && renderer.gameObject.activeInHierarchy)
            {
                count++;
            }
        }

        return count;
    }

    private static PrototypeNavigationObstacle CreateObstacle(Vector3 position, float radius)
    {
        GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        obstacle.name = "AutopilotPlayModeV2Obstacle";
        obstacle.transform.position = position;
        obstacle.transform.localScale = Vector3.one * radius * 2f;
        Collider collider = obstacle.GetComponent<Collider>();
        collider.isTrigger = true;
        PrototypeNavigationObstacle navigationObstacle = obstacle.AddComponent<PrototypeNavigationObstacle>();
        navigationObstacle.Configure(radius, 8f, true);
        return navigationObstacle;
    }

    private static PrototypeNavigationObstacle[] GetLaunchCorridorObstacles()
    {
        PrototypeNavigationObstacle[] obstacles = Object.FindObjectsByType<PrototypeNavigationObstacle>(FindObjectsInactive.Exclude);
        List<PrototypeNavigationObstacle> launchObstacles = new List<PrototypeNavigationObstacle>(3);
        for (int i = 0; i < obstacles.Length; i++)
        {
            PrototypeNavigationObstacle obstacle = obstacles[i];
            if (obstacle != null && obstacle.Label.StartsWith("Launch Obstacle"))
            {
                launchObstacles.Add(obstacle);
            }
        }

        return launchObstacles.ToArray();
    }

    private static void ConfigureRcsNozzles(Transform shipTransform, RcsThrusterController rcs, Rigidbody body, ShipPhysicsCore physicsCore)
    {
        Transform up = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Up", Vector3.up);
        Transform down = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Down", Vector3.down);
        Transform left = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Left", Vector3.left);
        Transform right = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Right", Vector3.right);
        Transform forward = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Forward", Vector3.forward);
        Transform back = CreateNozzle(shipTransform, "RCS_Nozzle_AutopilotPlayModeV2Back", Vector3.back);
        rcs.ConfigureThrusters(up, down, left, right, forward, back, body, physicsCore);
    }

    private static Transform CreateNozzle(Transform parent, string name, Vector3 localPosition)
    {
        GameObject nozzle = new GameObject(name);
        nozzle.transform.SetParent(parent, false);
        nozzle.transform.localPosition = localPosition;
        nozzle.transform.localRotation = BuildNozzleRotation(localPosition);
        return nozzle.transform;
    }

    private static Quaternion BuildNozzleRotation(Vector3 forceDirection)
    {
        Vector3 direction = forceDirection.sqrMagnitude > 0.0001f ? forceDirection.normalized : Vector3.forward;
        Vector3 up = Mathf.Abs(Vector3.Dot(direction, Vector3.up)) > 0.95f ? Vector3.forward : Vector3.up;
        return Quaternion.LookRotation(direction, up);
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static float GetPrivateFloat(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (float)field.GetValue(target);
    }

    private static bool GetPrivateBool(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (bool)field.GetValue(target);
    }

    private static Vector3 GetPrivateVector3(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (Vector3)field.GetValue(target);
    }

    private static void SetPrivateBool(object target, string fieldName, bool value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateVector3(object target, string fieldName, Vector3 value)
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

    private static Vector3 InvokePrivateVector3Method(object target, string methodName)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        return (Vector3)method.Invoke(target, null);
    }

    private static bool InvokePrivateBoolMethod(object target, string methodName)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        return (bool)method.Invoke(target, null);
    }

    private static bool InvokePrivateBoolMethod(object target, string methodName, params object[] args)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        return (bool)method.Invoke(target, args);
    }

    private static void InvokePrivateVoidMethod(object target, string methodName, params object[] args)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        method.Invoke(target, args);
    }

    private static void SetPrivateProperty<T>(object target, string propertyName, T value)
    {
        PropertyInfo property = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(property, propertyName);
        MethodInfo setter = property.GetSetMethod(true);
        Assert.NotNull(setter);
        setter.Invoke(target, new object[] { value });
    }

    private static void InvokeUpdate(object target)
    {
        MethodInfo method = target.GetType().GetMethod("Update", PrivateInstance);
        Assert.NotNull(method);
        method.Invoke(target, null);
    }

    private static void InvokeFixedUpdate(object target)
    {
        MethodInfo method = target.GetType().GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(method);
        method.Invoke(target, null);
    }

    private static void DestroyByPrefix(string prefix)
    {
        GameObject[] objects = Object.FindObjectsOfType<GameObject>();
        for (int i = 0; i < objects.Length; i++)
        {
            if (objects[i] != null && objects[i].name.StartsWith(prefix))
            {
                Object.DestroyImmediate(objects[i]);
            }
        }
    }

    private struct AutopilotPlayModeRig
    {
        public GameObject Ship;
        public Rigidbody Body;
        public ShipStats Stats;
        public PlayerShipController Controller;
        public RcsThrusterController Rcs;
        public PrototypeWaypointAutopilot Autopilot;
        public PrototypeNavigationTarget Target;
    }

    private sealed class AutopilotRunResult
    {
        public readonly List<AutopilotStepSnapshot> Snapshots = new List<AutopilotStepSnapshot>();
        public float InitialDistance;
        public float FinalDistance;
        public float InitialLateralSpeed;
        public float FinalLateralSpeed;
        public float MinimumObstacleClearance;
        public bool SawAvoidance;
        public bool SawReacquire;
        public bool SawDirectAfterAvoidance;
        public bool SawActualRcsAvoidanceForce;
        public bool PassedObstacle;
        public float MaximumLateralOffset;
        public float MaximumActualRcsForce;
        public float MaximumActualRcsTorque;
        public float MaximumMainThrottle;
        public float MaximumRequestedRcsForce;
        public float MaximumAssistForce;
        public float MaximumAssistTorque;
        public float InitialRetrogradeAngle;
        public float MinimumRetrogradeAngle;
        public bool SawActualRcsBrakeTorque;
        public bool SawPrematureMainThrottle;
        public bool SawMainThrottleAfterAlignment;
        public bool SawBrakeForceOpposingVelocity;
        public int CurrentStepIndex;
        public int PrematureMainThrottleStep = -1;
        public float PrematureMainThrottleRetrogradeAngle;
        public string PrematureMainThrottleState;
        public string PrematureMainThrottlePhase;
        public Vector3 AvoidanceSide;
    }

    private sealed class DirectFastTransferTrace
    {
        public readonly List<string> Samples = new List<string>();
        public readonly List<string> Events = new List<string>();
        public int FirstPlanRevision;
        public int LastPlanRevision;
        public int PlanRevisionChanges;
        public string FirstPlanId;
        public string LastPlanId;
        public int FlightPlanIdChanges;
        public int RevisionResetFrames;
        public int ReplanFrames;
        public int ReplanStatusFrames;
        public int ReplanWhileBurnLatchedFrames;
        public int ReplanWhileBrakeLatchedFrames;
        public int BurnLatchedSamples;
        public int LowBurnThrottleFrames;
        public int FirstBurnLatchedFrame;
        public int BrakeLatchedSamples;
        public int LowBrakeThrottleFrames;
        public int FirstBrakeLatchedFrame;
        public int BurnToBrakeLowThrottleFrames;
        public int FlipThrottleFrames;
        public float MaxBrakeDesiredAngle;
        public bool TraceEndedInTerminalState;
        public bool CompletedBeforeBrakeObserved;
        public bool SoftErrorInjected;
        public int AfterSoftBurnFrames;
        public int AfterSoftReplanFrames;
        public float MinimumMainAfterSoftError;
        public float LastDesiredAngle;
        public DirectFastTransferTrackingInjectionMode InjectionMode;
        public int SoftTrackingInjectionCount;
        public readonly List<int> SoftTrackingInjectionFrames = new List<int>();
    }

    private struct AutopilotStepSnapshot
    {
        public float distance;
        public float relativeSpeed;
        public float lateralSpeed;
        public string state;
        public string phase;
        public string obstacleStatus;
        public float mainThrottle;
        public float commandMainThrottle;
        public float rcsForce;
        public string segment;
        public float desiredAngle;
        public float retrogradeAngle;
        public float angularSpeedDegreesPerSecond;
    }
}
