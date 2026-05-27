using System.Collections.Generic;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeAutopilotNavigationPlayModeTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    private SimulationMode previousSimulationMode;

    [SetUp]
    public void SetUp()
    {
        DestroyByPrefix("AutopilotPlayModeV2");
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

        AutopilotRunResult result = RunClosedLoopPhysics(rig, 860, launchObstacles);

        Assert.NotNull(result);
        Assert.True(result.SawAvoidance, "launch corridor should force avoidance before the ship reaches the obstacle course.");
        Assert.True(result.SawReacquire || result.SawDirectAfterAvoidance, "autopilot should rejoin the direct path once the launch corridor clears.");
        Assert.That(
            rig.Autopilot.CurrentState,
            Is.EqualTo(PrototypeWaypointAutopilotState.Complete).Or.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(result.FinalDistance, Is.LessThanOrEqualTo(rig.Target.ArrivalRadius + 1.5f));
        Assert.That(result.MinimumObstacleClearance, Is.GreaterThan(0.25f));
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
                + $" finalArrivalTerminalCaptureActive={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")}";
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
            + $" finalArrivalTerminalCaptureActive={GetPrivateBool(rig.Autopilot, "arrivalTerminalCaptureActive")}";

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
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00}");
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
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00}");
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
                + $"main={rig.Autopilot.RequestedMainThrottle:0.00} rcs={rig.Autopilot.RequestedRcsForce.magnitude:0.00}");
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
        result.Snapshots.Add(new AutopilotStepSnapshot
        {
            distance = distance,
            relativeSpeed = rig.Body.linearVelocity.magnitude,
            lateralSpeed = lateralSpeed,
            state = rig.Autopilot.CurrentState.ToString(),
            phase = rig.Autopilot.NavigationPhase.ToString(),
            obstacleStatus = rig.Autopilot.ObstacleStatus,
            mainThrottle = rig.Autopilot.RequestedMainThrottle,
            rcsForce = rig.Autopilot.RequestedRcsForce.magnitude,
            segment = rig.Autopilot.ActiveSegmentLabel
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

    private struct AutopilotStepSnapshot
    {
        public float distance;
        public float relativeSpeed;
        public float lateralSpeed;
        public string state;
        public string phase;
        public string obstacleStatus;
        public float mainThrottle;
        public float rcsForce;
        public string segment;
    }
}
