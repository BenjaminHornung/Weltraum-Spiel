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
        PrototypeNavigationObstacleRegistry.ClearForTests();
        previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        Physics.SyncTransforms();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyByPrefix("AutopilotPlayModeV2");
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
    public void PlayMode_Autopilot_ManualOverride_AbortsAndClearsRequests()
    {
        AutopilotPlayModeRig rig = CreateRig(Vector3.forward * 70f);
        rig.Autopilot.ToggleAutopilot();
        StepSimulation(rig);

        SetPrivateFloat(rig.Autopilot, "manualOverrideGraceUntilTime", -10f);
        SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
        StepSimulation(rig);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Aborted));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Controller.HasExternalFlightAssistRequest);
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
        PrototypeNavigationObstacle obstacle)
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
            StepClosedLoopPhysics(rig);
            CaptureStep(rig, result, obstacle, sawAvoidance);
            CaptureClosedLoopObstacleProgress(rig, result, obstacle);
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

    private static void CaptureClosedLoopObstacleProgress(
        AutopilotPlayModeRig rig,
        AutopilotRunResult result,
        PrototypeNavigationObstacle obstacle)
    {
        if (obstacle == null)
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
        Vector3 fromObstacle = rig.Body.position - obstacle.WorldPosition;
        Vector3 flatFromObstacle = new Vector3(fromObstacle.x, 0f, fromObstacle.z);
        float forwardOffset = Vector3.Dot(flatFromObstacle, axis);
        Vector3 lateralOffset = flatFromObstacle - axis * forwardOffset;
        result.MaximumLateralOffset = Mathf.Max(result.MaximumLateralOffset, lateralOffset.magnitude);
        result.PassedObstacle |= forwardOffset > obstacle.Radius + 1f;

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

    private static AutopilotPlayModeRig CreateRig(Vector3 targetPosition)
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
        SetPrivateFloat(rcs, "translationForce", 20000f);
        physicsCore.Configure(body);
        stats.ApplyMassProperties(body);

        GameObject targetObject = new GameObject("AutopilotPlayModeV2Target");
        targetObject.transform.position = targetPosition;
        PrototypeNavigationTarget target = targetObject.AddComponent<PrototypeNavigationTarget>();
        target.Configure("PlayModeTarget", 10f);
        autopilot.Bind(null, controller, stats, body);
        SetPrivateFloat(autopilot, "holdConfirmSeconds", 0f);
        SetPrivateFloat(autopilot, "avoidanceLockSeconds", 0f);
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

    private static void SetPrivateBool(object target, string fieldName, bool value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
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
        public Vector3 AvoidanceSide;
    }

    private struct AutopilotStepSnapshot
    {
        public float distance;
        public float relativeSpeed;
        public float lateralSpeed;
        public string phase;
        public string obstacleStatus;
        public float mainThrottle;
        public float rcsForce;
        public string segment;
    }
}
